/**
 * PostgresMigrationRunner
 *
 * Manages PostgreSQL schema migrations with version tracking.
 * Each migration runs in a transaction with automatic rollback on failure.
 *
 * Migration versions:
 * - v1: Core tables (sdk_sessions, observations, session_summaries, user_prompts, pending_messages)
 *        with pgvector embedding columns and tsvector search columns
 * - v2: Indexes (HNSW vector, GIN tsvector, project composites, content_hash unique)
 * - v3: tsvector auto-update triggers
 * - v4: Row Level Security (RLS) policies for project isolation
 * - v5: Japanese full-text search (pg_bigm, optional)
 */

import { logger } from '../../../utils/logger.js';

// Use `any` for the sql parameter since postgres.js types vary between versions
// and the tagged template call signature doesn't need strict typing here.
type PgSql = any;

export class PostgresMigrationRunner {
  constructor(private sql: PgSql) {}

  /**
   * Run all migrations in order. Each migration is idempotent.
   */
  async runAllMigrations(): Promise<void> {
    // Create schema_versions table if it doesn't exist
    await this.sql`
      CREATE TABLE IF NOT EXISTS schema_versions (
        id SERIAL PRIMARY KEY,
        version INTEGER UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await this.runMigration(1, () => this.migrationV1_CoreTables());
    await this.runMigration(2, () => this.migrationV2_Indexes());
    await this.runMigration(3, () => this.migrationV3_TsvectorTriggers());
    await this.runMigration(4, () => this.migrationV4_RLSPolicies());
    await this.runMigration(5, () => this.migrationV5_JapaneseFTS());

    logger.info('DB', 'PostgreSQL migrations complete');
  }

  /**
   * Run a single migration within a transaction, skipping if already applied.
   */
  private async runMigration(version: number, fn: () => Promise<void>): Promise<void> {
    // Check if already applied
    const [existing] = await this.sql`
      SELECT version FROM schema_versions WHERE version = ${version}
    `;
    if (existing) return;

    logger.info('DB', `Running PostgreSQL migration v${version}`);

    await this.sql.begin(async (tx: PgSql) => {
      // Temporarily reassign sql for the migration function to use the transaction
      const originalSql = this.sql;
      this.sql = tx;
      try {
        await fn();
        await tx`
          INSERT INTO schema_versions (version) VALUES (${version})
        `;
      } finally {
        this.sql = originalSql;
      }
    });

    logger.info('DB', `PostgreSQL migration v${version} applied`);
  }

  /**
   * Migration v1: Enable pgvector and create all core tables.
   */
  private async migrationV1_CoreTables(): Promise<void> {
    // Enable pgvector extension
    await this.sql`CREATE EXTENSION IF NOT EXISTS vector`;

    // sdk_sessions
    await this.sql`
      CREATE TABLE IF NOT EXISTS sdk_sessions (
        id SERIAL PRIMARY KEY,
        content_session_id TEXT UNIQUE NOT NULL,
        memory_session_id TEXT UNIQUE,
        project TEXT NOT NULL,
        user_prompt TEXT,
        custom_title TEXT,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'completed', 'failed')),
        cwd TEXT,
        hostname TEXT,
        mode TEXT,
        worker_port INTEGER,
        prompt_counter INTEGER DEFAULT 0,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at_epoch BIGINT NOT NULL,
        completed_at TIMESTAMPTZ,
        completed_at_epoch BIGINT
      )
    `;

    // observations (with embedding and search_vector columns)
    await this.sql`
      CREATE TABLE IF NOT EXISTS observations (
        id SERIAL PRIMARY KEY,
        memory_session_id TEXT NOT NULL
          REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE,
        project TEXT NOT NULL,
        text TEXT,
        type TEXT NOT NULL,
        title TEXT,
        subtitle TEXT,
        facts TEXT,
        narrative TEXT,
        concepts TEXT,
        files_read TEXT,
        files_modified TEXT,
        prompt_number INTEGER,
        discovery_tokens INTEGER DEFAULT 0,
        content_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at_epoch BIGINT NOT NULL,
        embedding vector(384),
        search_vector tsvector
      )
    `;

    // session_summaries (with embedding and search_vector columns)
    await this.sql`
      CREATE TABLE IF NOT EXISTS session_summaries (
        id SERIAL PRIMARY KEY,
        memory_session_id TEXT NOT NULL
          REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE,
        project TEXT NOT NULL,
        request TEXT,
        investigated TEXT,
        learned TEXT,
        completed TEXT,
        next_steps TEXT,
        files_read TEXT,
        files_edited TEXT,
        notes TEXT,
        prompt_number INTEGER,
        discovery_tokens INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at_epoch BIGINT NOT NULL,
        embedding vector(384),
        search_vector tsvector
      )
    `;

    // user_prompts (with embedding and search_vector columns)
    await this.sql`
      CREATE TABLE IF NOT EXISTS user_prompts (
        id SERIAL PRIMARY KEY,
        content_session_id TEXT NOT NULL
          REFERENCES sdk_sessions(content_session_id) ON DELETE CASCADE,
        prompt_number INTEGER NOT NULL,
        prompt_text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at_epoch BIGINT NOT NULL,
        embedding vector(384),
        search_vector tsvector
      )
    `;

    // pending_messages
    await this.sql`
      CREATE TABLE IF NOT EXISTS pending_messages (
        id SERIAL PRIMARY KEY,
        session_db_id INTEGER NOT NULL
          REFERENCES sdk_sessions(id) ON DELETE CASCADE,
        content_session_id TEXT NOT NULL,
        message_type TEXT NOT NULL
          CHECK (message_type IN ('observation', 'summarize')),
        tool_name TEXT,
        tool_input TEXT,
        tool_response TEXT,
        cwd TEXT,
        last_user_message TEXT,
        last_assistant_message TEXT,
        prompt_number INTEGER,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at_epoch BIGINT NOT NULL,
        started_processing_at_epoch BIGINT,
        completed_at_epoch BIGINT,
        failed_at_epoch BIGINT
      )
    `;
  }

  /**
   * Migration v2: Create all indexes.
   * - HNSW vector indexes on embedding columns (cosine distance)
   * - GIN indexes on search_vector columns
   * - Project composite indexes for efficient scoping
   * - Unique index on content_hash for deduplication
   */
  private async migrationV2_Indexes(): Promise<void> {
    // -- sdk_sessions indexes --
    await this.sql`CREATE INDEX IF NOT EXISTS idx_sdk_sessions_content_id ON sdk_sessions(content_session_id)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_sdk_sessions_memory_id ON sdk_sessions(memory_session_id)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_sdk_sessions_project ON sdk_sessions(project)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_sdk_sessions_status ON sdk_sessions(status)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_sdk_sessions_started ON sdk_sessions(started_at_epoch DESC)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_sdk_sessions_project_started ON sdk_sessions(project, started_at_epoch DESC)`;

    // -- observations indexes --
    await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_memory_session ON observations(memory_session_id)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at_epoch DESC)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_project_created ON observations(project, created_at_epoch DESC)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_content_hash ON observations(content_hash, created_at_epoch)`;
    // HNSW vector index for cosine similarity search
    await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_embedding ON observations USING hnsw (embedding vector_cosine_ops)`;
    // GIN index for full-text search
    await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_search_vector ON observations USING gin (search_vector)`;

    // -- session_summaries indexes --
    await this.sql`CREATE INDEX IF NOT EXISTS idx_summaries_memory_session ON session_summaries(memory_session_id)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_summaries_project ON session_summaries(project)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_summaries_created ON session_summaries(created_at_epoch DESC)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_summaries_project_created ON session_summaries(project, created_at_epoch DESC)`;
    // HNSW vector index
    await this.sql`CREATE INDEX IF NOT EXISTS idx_summaries_embedding ON session_summaries USING hnsw (embedding vector_cosine_ops)`;
    // GIN index
    await this.sql`CREATE INDEX IF NOT EXISTS idx_summaries_search_vector ON session_summaries USING gin (search_vector)`;

    // -- user_prompts indexes --
    await this.sql`CREATE INDEX IF NOT EXISTS idx_prompts_content_session ON user_prompts(content_session_id)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_prompts_created ON user_prompts(created_at_epoch DESC)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_prompts_lookup ON user_prompts(content_session_id, prompt_number)`;
    // HNSW vector index
    await this.sql`CREATE INDEX IF NOT EXISTS idx_prompts_embedding ON user_prompts USING hnsw (embedding vector_cosine_ops)`;
    // GIN index
    await this.sql`CREATE INDEX IF NOT EXISTS idx_prompts_search_vector ON user_prompts USING gin (search_vector)`;

    // -- pending_messages indexes --
    await this.sql`CREATE INDEX IF NOT EXISTS idx_pending_messages_session ON pending_messages(session_db_id)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_pending_messages_status ON pending_messages(status)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_pending_messages_content_session ON pending_messages(content_session_id)`;
  }

  /**
   * Migration v3: Create tsvector auto-update trigger functions.
   * Automatically populates search_vector on INSERT/UPDATE using weighted fields.
   */
  private async migrationV3_TsvectorTriggers(): Promise<void> {
    // Observations: title (A), subtitle + narrative (B), facts + concepts (C)
    await this.sql`
      CREATE OR REPLACE FUNCTION observations_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.subtitle, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.narrative, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.facts, '')), 'C') ||
          setweight(to_tsvector('english', COALESCE(NEW.concepts, '')), 'C');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `;
    await this.sql`
      DROP TRIGGER IF EXISTS observations_search_vector_trigger ON observations
    `;
    await this.sql`
      CREATE TRIGGER observations_search_vector_trigger
        BEFORE INSERT OR UPDATE ON observations
        FOR EACH ROW EXECUTE FUNCTION observations_search_vector_update()
    `;

    // Session summaries: request (A), investigated + learned (B), completed (B), next_steps (C), notes (D)
    await this.sql`
      CREATE OR REPLACE FUNCTION summaries_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', COALESCE(NEW.request, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.investigated, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.learned, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.completed, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.next_steps, '')), 'C') ||
          setweight(to_tsvector('english', COALESCE(NEW.notes, '')), 'D');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `;
    await this.sql`
      DROP TRIGGER IF EXISTS summaries_search_vector_trigger ON session_summaries
    `;
    await this.sql`
      CREATE TRIGGER summaries_search_vector_trigger
        BEFORE INSERT OR UPDATE ON session_summaries
        FOR EACH ROW EXECUTE FUNCTION summaries_search_vector_update()
    `;

    // User prompts: prompt_text (A)
    await this.sql`
      CREATE OR REPLACE FUNCTION prompts_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', COALESCE(NEW.prompt_text, '')), 'A');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `;
    await this.sql`
      DROP TRIGGER IF EXISTS prompts_search_vector_trigger ON user_prompts
    `;
    await this.sql`
      CREATE TRIGGER prompts_search_vector_trigger
        BEFORE INSERT OR UPDATE ON user_prompts
        FOR EACH ROW EXECUTE FUNCTION prompts_search_vector_update()
    `;
  }

  /**
   * Migration v4: Enable Row Level Security for project isolation.
   * Uses current_setting('app.current_project', true) for session-scoped filtering.
   * When the setting is not set, all rows are accessible.
   */
  private async migrationV4_RLSPolicies(): Promise<void> {
    const tables = ['sdk_sessions', 'observations', 'session_summaries', 'user_prompts', 'pending_messages'];

    for (const table of tables) {
      await this.sql`ALTER TABLE ${this.sql(table)} ENABLE ROW LEVEL SECURITY`;

      // Drop existing policy to make migration idempotent
      await this.sql.unsafe(`DROP POLICY IF EXISTS project_isolation ON ${table}`);

      // Create policy: allow full access when app.current_project is not set,
      // and project-scoped access when it is set.
      // pending_messages and user_prompts don't have a project column directly,
      // so use a subquery via content_session_id → sdk_sessions JOIN
      if (table === 'pending_messages' || table === 'user_prompts') {
        await this.sql.unsafe(`
          CREATE POLICY project_isolation ON ${table}
            FOR ALL
            USING (
              current_setting('app.current_project', true) IS NULL
              OR current_setting('app.current_project', true) = ''
              OR content_session_id IN (
                SELECT content_session_id FROM sdk_sessions
                WHERE project = current_setting('app.current_project', true)
              )
            )
        `);
      } else {
        await this.sql.unsafe(`
          CREATE POLICY project_isolation ON ${table}
            FOR ALL
            USING (
              current_setting('app.current_project', true) IS NULL
              OR current_setting('app.current_project', true) = ''
              OR project = current_setting('app.current_project', true)
            )
        `);
      }
    }

    // Force RLS to apply to table owners as well (needed for non-superuser connections)
    for (const table of tables) {
      await this.sql`ALTER TABLE ${this.sql(table)} FORCE ROW LEVEL SECURITY`;
    }
  }

  /**
   * Migration v5: Optional Japanese full-text search via pg_bigm.
   * Gracefully skips if pg_bigm extension is not available.
   */
  private async migrationV5_JapaneseFTS(): Promise<void> {
    // Check if pg_bigm is available BEFORE attempting CREATE EXTENSION.
    // CREATE EXTENSION failure inside a transaction aborts the entire transaction
    // in PostgreSQL, making the subsequent schema_versions INSERT fail too.
    const [extAvailable] = await this.sql`
      SELECT 1 FROM pg_available_extensions WHERE name = 'pg_bigm'
    `;

    if (!extAvailable) {
      logger.info('DB', 'pg_bigm extension not available, skipping Japanese FTS indexes (English tsvector still active)');
      return;
    }

    await this.sql`CREATE EXTENSION IF NOT EXISTS pg_bigm`;

    // Create bigram GIN indexes for Japanese text search
    await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_title_bigm ON observations USING gin (title gin_bigm_ops)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_observations_narrative_bigm ON observations USING gin (narrative gin_bigm_ops)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_summaries_request_bigm ON session_summaries USING gin (request gin_bigm_ops)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_prompts_text_bigm ON user_prompts USING gin (prompt_text gin_bigm_ops)`;

    logger.info('DB', 'pg_bigm extension enabled for Japanese full-text search');
  }
}
