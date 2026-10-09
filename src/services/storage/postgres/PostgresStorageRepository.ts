/**
 * PostgresStorageRepository - IStorageRepository implementation for PostgreSQL.
 *
 * Uses postgres.js (porsager/postgres) for tagged template SQL queries
 * with built-in connection pooling and parameterized queries.
 *
 * Design:
 * - Each sub-repository receives the same `sql` instance
 * - withTransaction creates a transactional sql and wraps sub-repos
 * - All JSON fields (facts, concepts, files_*) stored as TEXT (same as SQLite)
 * - Embedding and search_vector columns managed by triggers (v3 migration)
 */

import type {
  IStorageRepository,
  ISessionRepository,
  IObservationRepository,
  ISummaryRepository,
  IPromptRepository,
  IPendingMessageRepository,
  ITimelineRepository,
  ISearchRepository,
} from '../interfaces.js';
import type {
  SDKSessionRow,
  ObservationRow,
  ObservationInput,
  StoreObservationResult,
  SummaryRow,
  SummaryInput,
  StoreSummaryResult,
  PromptRow,
  PersistentPendingMessage,
  QueueMessage,
  SearchHit,
  VectorSearchHit,
  PendingMessage,
} from '../types.js';
import type { PostgresConnectionConfig } from '../StorageProviderFactory.js';
import { PostgresMigrationRunner } from './PostgresMigrationRunner.js';
import { logger } from '../../../utils/logger.js';
import { createHash } from 'crypto';

// postgres.js Sql type - use `any` for the inner sql parameter since
// TransactionSql and Sql share the tagged template interface but TypeScript
// can't unify their call signatures cleanly in a union type.
type PgSql = any;

// ============================================================
// PostgresSessionRepository
// ============================================================

class PostgresSessionRepository implements ISessionRepository {
  constructor(private sql: PgSql) {}

  async createSDKSession(
    contentSessionId: string,
    project: string,
    userPrompt: string,
    customTitle?: string
  ): Promise<number> {
    const now = Date.now();
    const [row] = await this.sql`
      INSERT INTO sdk_sessions (content_session_id, project, user_prompt, custom_title, started_at_epoch)
      VALUES (${contentSessionId}, ${project}, ${userPrompt}, ${customTitle ?? null}, ${now})
      ON CONFLICT (content_session_id) DO NOTHING
      RETURNING id
    `;
    if (row) return row.id;

    // Already exists - fetch the existing ID
    const [existing] = await this.sql`
      SELECT id FROM sdk_sessions WHERE content_session_id = ${contentSessionId}
    `;
    return existing.id;
  }

  async updateMemorySessionId(sessionDbId: number, memorySessionId: string | null): Promise<void> {
    await this.sql`
      UPDATE sdk_sessions SET memory_session_id = ${memorySessionId}
      WHERE id = ${sessionDbId}
    `;
  }

  async updateSessionStatus(contentSessionId: string, status: string): Promise<void> {
    const completedEpoch = (status === 'completed' || status === 'failed') ? Date.now() : null;
    await this.sql`
      UPDATE sdk_sessions
      SET status = ${status}, completed_at_epoch = ${completedEpoch},
          completed_at = ${completedEpoch ? new Date().toISOString() : null}
      WHERE content_session_id = ${contentSessionId}
    `;
  }

  async getSessionByContentId(contentSessionId: string): Promise<SDKSessionRow | null> {
    const [row] = await this.sql`
      SELECT * FROM sdk_sessions WHERE content_session_id = ${contentSessionId}
    `;
    return row ? this.mapRow(row) : null;
  }

  async getSessionByMemoryId(memorySessionId: string): Promise<SDKSessionRow | null> {
    const [row] = await this.sql`
      SELECT * FROM sdk_sessions WHERE memory_session_id = ${memorySessionId}
    `;
    return row ? this.mapRow(row) : null;
  }

  async getSessionById(id: number): Promise<SDKSessionRow | null> {
    const [row] = await this.sql`
      SELECT * FROM sdk_sessions WHERE id = ${id}
    `;
    return row ? this.mapRow(row) : null;
  }

  async getAllProjects(): Promise<string[]> {
    const rows = await this.sql`
      SELECT DISTINCT project FROM sdk_sessions ORDER BY project
    `;
    return rows.map((r: any) => r.project);
  }

  async getSessionsByProject(project: string, limit = 100): Promise<SDKSessionRow[]> {
    const rows = await this.sql`
      SELECT * FROM sdk_sessions WHERE project = ${project}
      ORDER BY started_at_epoch DESC LIMIT ${limit}
    `;
    return rows.map((r: any) => this.mapRow(r));
  }

  async getRecentSessionsWithStatus(project: string, limit = 10): Promise<Array<{
    memory_session_id: string | null;
    status: string;
    started_at: string;
    user_prompt: string | null;
    has_summary: boolean;
  }>> {
    const rows = await this.sql`
      SELECT s.memory_session_id, s.status, s.started_at, s.user_prompt,
             EXISTS(SELECT 1 FROM session_summaries ss WHERE ss.memory_session_id = s.memory_session_id) as has_summary
      FROM sdk_sessions s
      WHERE s.project = ${project}
      ORDER BY s.started_at_epoch DESC
      LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      memory_session_id: r.memory_session_id,
      status: r.status,
      started_at: r.started_at instanceof Date ? r.started_at.toISOString() : String(r.started_at),
      user_prompt: r.user_prompt,
      has_summary: r.has_summary,
    }));
  }

  async getSessionsByMemoryIds(memorySessionIds: string[]): Promise<SDKSessionRow[]> {
    if (memorySessionIds.length === 0) return [];
    const rows = await this.sql`
      SELECT * FROM sdk_sessions WHERE memory_session_id = ANY(${memorySessionIds})
    `;
    return rows.map((r: any) => this.mapRow(r));
  }

  private mapRow(r: any): SDKSessionRow {
    return {
      id: r.id,
      content_session_id: r.content_session_id,
      memory_session_id: r.memory_session_id,
      project: r.project,
      user_prompt: r.user_prompt,
      custom_title: r.custom_title,
      status: r.status,
      cwd: r.cwd,
      hostname: r.hostname,
      mode: r.mode,
      worker_port: r.worker_port,
      prompt_counter: r.prompt_counter ?? 0,
      started_at: r.started_at instanceof Date ? r.started_at.toISOString() : String(r.started_at ?? ''),
      started_at_epoch: Number(r.started_at_epoch),
      completed_at: r.completed_at instanceof Date ? r.completed_at.toISOString() : (r.completed_at ?? null),
      completed_at_epoch: r.completed_at_epoch ? Number(r.completed_at_epoch) : null,
    };
  }
}

// ============================================================
// PostgresObservationRepository
// ============================================================

class PostgresObservationRepository implements IObservationRepository {
  constructor(private sql: PgSql) {}

  async storeObservation(
    memorySessionId: string,
    project: string,
    observation: ObservationInput,
    promptNumber?: number,
    discoveryTokens?: number,
    overrideTimestampEpoch?: number
  ): Promise<StoreObservationResult> {
    const now = overrideTimestampEpoch ?? Date.now();
    const contentHash = this.computeContentHash(observation);
    const factsJson = JSON.stringify(observation.facts || []);
    const conceptsJson = JSON.stringify(observation.concepts || []);
    const filesReadJson = JSON.stringify(observation.files_read || []);
    const filesModifiedJson = JSON.stringify(observation.files_modified || []);

    // Check for duplicate (within 24h window)
    const dayAgo = now - 86400000;
    const [dup] = await this.sql`
      SELECT id, created_at_epoch FROM observations
      WHERE content_hash = ${contentHash} AND created_at_epoch > ${dayAgo}
      LIMIT 1
    `;
    if (dup) {
      return { id: dup.id, createdAtEpoch: Number(dup.created_at_epoch) };
    }

    const [row] = await this.sql`
      INSERT INTO observations (
        memory_session_id, project, type, title, subtitle, facts, narrative,
        concepts, files_read, files_modified, prompt_number, discovery_tokens,
        content_hash, created_at_epoch
      ) VALUES (
        ${memorySessionId}, ${project}, ${observation.type},
        ${observation.title || null}, ${observation.subtitle || null},
        ${factsJson}, ${observation.narrative || null},
        ${conceptsJson}, ${filesReadJson}, ${filesModifiedJson},
        ${promptNumber ?? null}, ${discoveryTokens ?? 0},
        ${contentHash}, ${now}
      )
      RETURNING id, created_at_epoch
    `;
    return { id: row.id, createdAtEpoch: Number(row.created_at_epoch) };
  }

  async getObservationsByIds(
    ids: number[],
    options?: {
      orderBy?: 'date_desc' | 'date_asc';
      limit?: number;
      project?: string;
      type?: string | string[];
      concepts?: string | string[];
      files?: string | string[];
    }
  ): Promise<ObservationRow[]> {
    if (ids.length === 0) return [];

    // Build dynamic query parts
    const conditions: string[] = [`id = ANY(ARRAY[${ids.join(',')}])`];
    if (options?.project) {
      conditions.push(`project = '${this.escapeStr(options.project)}'`);
    }
    if (options?.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      conditions.push(`type = ANY(ARRAY[${types.map(t => `'${this.escapeStr(t)}'`).join(',')}])`);
    }

    const orderDir = options?.orderBy === 'date_asc' ? 'ASC' : 'DESC';
    const limitClause = options?.limit ? `LIMIT ${options.limit}` : '';

    const rows = await this.sql.unsafe(
      `SELECT * FROM observations WHERE ${conditions.join(' AND ')}
       ORDER BY created_at_epoch ${orderDir} ${limitClause}`
    );
    return rows.map((r: any) => this.mapRow(r));
  }

  async getObservationById(id: number): Promise<ObservationRow | null> {
    const [row] = await this.sql`
      SELECT * FROM observations WHERE id = ${id}
    `;
    return row ? this.mapRow(row) : null;
  }

  async getRecentObservations(project: string, limit = 50): Promise<ObservationRow[]> {
    const rows = await this.sql`
      SELECT * FROM observations WHERE project = ${project}
      ORDER BY created_at_epoch DESC LIMIT ${limit}
    `;
    return rows.map((r: any) => this.mapRow(r));
  }

  async getAllRecentObservations(limit = 50): Promise<ObservationRow[]> {
    const rows = await this.sql`
      SELECT * FROM observations ORDER BY created_at_epoch DESC LIMIT ${limit}
    `;
    return rows.map((r: any) => this.mapRow(r));
  }

  async getObservationsForSession(memorySessionId: string): Promise<Array<{
    title: string;
    subtitle: string;
    type: string;
    prompt_number: number | null;
  }>> {
    const rows = await this.sql`
      SELECT title, subtitle, type, prompt_number FROM observations
      WHERE memory_session_id = ${memorySessionId}
      ORDER BY created_at_epoch ASC
    `;
    return rows.map((r: any) => ({
      title: r.title || '',
      subtitle: r.subtitle || '',
      type: r.type,
      prompt_number: r.prompt_number,
    }));
  }

  async getFilesForSession(memorySessionId: string): Promise<{
    filesRead: string[];
    filesModified: string[];
  }> {
    const rows = await this.sql`
      SELECT files_read, files_modified FROM observations
      WHERE memory_session_id = ${memorySessionId}
    `;
    const filesRead = new Set<string>();
    const filesModified = new Set<string>();
    for (const row of rows) {
      try {
        const fr = JSON.parse(row.files_read || '[]');
        const fm = JSON.parse(row.files_modified || '[]');
        for (const f of fr) filesRead.add(f);
        for (const f of fm) filesModified.add(f);
      } catch { /* skip malformed JSON */ }
    }
    return { filesRead: [...filesRead], filesModified: [...filesModified] };
  }

  async getObservationCount(project?: string): Promise<number> {
    if (project) {
      const [row] = await this.sql`SELECT COUNT(*)::int as count FROM observations WHERE project = ${project}`;
      return row.count;
    }
    const [row] = await this.sql`SELECT COUNT(*)::int as count FROM observations`;
    return row.count;
  }

  private computeContentHash(obs: ObservationInput): string {
    const content = [obs.type, obs.title, obs.narrative, JSON.stringify(obs.facts)].join('|');
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private escapeStr(s: string): string {
    return s.replace(/'/g, "''");
  }

  private mapRow(r: any): ObservationRow {
    return {
      id: r.id,
      memory_session_id: r.memory_session_id,
      project: r.project,
      text: r.text,
      type: r.type,
      title: r.title || '',
      subtitle: r.subtitle || null,
      facts: r.facts || '[]',
      narrative: r.narrative || '',
      concepts: r.concepts || '[]',
      files_read: r.files_read || '[]',
      files_modified: r.files_modified || '[]',
      prompt_number: r.prompt_number,
      discovery_tokens: r.discovery_tokens ?? 0,
      content_hash: r.content_hash || '',
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
      created_at_epoch: Number(r.created_at_epoch),
    };
  }
}

// ============================================================
// PostgresSummaryRepository
// ============================================================

class PostgresSummaryRepository implements ISummaryRepository {
  constructor(private sql: PgSql) {}

  async storeSummary(
    memorySessionId: string,
    project: string,
    summary: SummaryInput,
    promptNumber?: number,
    discoveryTokens?: number,
    overrideTimestampEpoch?: number
  ): Promise<StoreSummaryResult> {
    const now = overrideTimestampEpoch ?? Date.now();

    const [row] = await this.sql`
      INSERT INTO session_summaries (
        memory_session_id, project, request, investigated, learned, completed,
        next_steps, notes, prompt_number, discovery_tokens, created_at_epoch
      ) VALUES (
        ${memorySessionId}, ${project},
        ${summary.request || null}, ${summary.investigated || null},
        ${summary.learned || null}, ${summary.completed || null},
        ${summary.next_steps || null},
        ${summary.notes || null}, ${promptNumber ?? null},
        ${discoveryTokens ?? 0}, ${now}
      )
      RETURNING id, created_at_epoch
    `;
    return { id: row.id, createdAtEpoch: Number(row.created_at_epoch) };
  }

  async getSummariesByIds(
    ids: number[],
    options?: { orderBy?: 'date_desc' | 'date_asc'; limit?: number; project?: string }
  ): Promise<SummaryRow[]> {
    if (ids.length === 0) return [];
    const orderDir = options?.orderBy === 'date_asc' ? 'ASC' : 'DESC';
    const conditions = [`id = ANY(ARRAY[${ids.join(',')}])`];
    if (options?.project) conditions.push(`project = '${options.project.replace(/'/g, "''")}'`);
    const limitClause = options?.limit ? `LIMIT ${options.limit}` : '';

    const rows = await this.sql.unsafe(
      `SELECT * FROM session_summaries WHERE ${conditions.join(' AND ')}
       ORDER BY created_at_epoch ${orderDir} ${limitClause}`
    );
    return rows.map((r: any) => this.mapRow(r));
  }

  async getSummaryById(id: number): Promise<SummaryRow | null> {
    const [row] = await this.sql`SELECT * FROM session_summaries WHERE id = ${id}`;
    return row ? this.mapRow(row) : null;
  }

  async getSummaryForSession(memorySessionId: string): Promise<SummaryRow | null> {
    const [row] = await this.sql`
      SELECT * FROM session_summaries
      WHERE memory_session_id = ${memorySessionId}
      ORDER BY created_at_epoch DESC LIMIT 1
    `;
    return row ? this.mapRow(row) : null;
  }

  async getRecentSummaries(project: string, limit = 10): Promise<SummaryRow[]> {
    const rows = await this.sql`
      SELECT * FROM session_summaries WHERE project = ${project}
      ORDER BY created_at_epoch DESC LIMIT ${limit}
    `;
    return rows.map((r: any) => this.mapRow(r));
  }

  async getRecentSummariesWithSessionInfo(project: string, limit = 10): Promise<Array<{
    memory_session_id: string;
    request: string | null;
    learned: string | null;
    completed: string | null;
    next_steps: string | null;
    prompt_number: number | null;
    created_at: string;
  }>> {
    const rows = await this.sql`
      SELECT memory_session_id, request, learned, completed, next_steps,
             prompt_number, created_at
      FROM session_summaries WHERE project = ${project}
      ORDER BY created_at_epoch DESC LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      memory_session_id: r.memory_session_id,
      request: r.request,
      learned: r.learned,
      completed: r.completed,
      next_steps: r.next_steps,
      prompt_number: r.prompt_number,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
    }));
  }

  async getAllRecentSummaries(limit = 10): Promise<SummaryRow[]> {
    const rows = await this.sql`
      SELECT * FROM session_summaries ORDER BY created_at_epoch DESC LIMIT ${limit}
    `;
    return rows.map((r: any) => this.mapRow(r));
  }

  private mapRow(r: any): SummaryRow {
    return {
      id: r.id,
      memory_session_id: r.memory_session_id,
      project: r.project,
      request: r.request,
      investigated: r.investigated,
      learned: r.learned,
      completed: r.completed,
      next_steps: r.next_steps,
      files_read: r.files_read || '[]',
      files_edited: r.files_edited || '[]',
      notes: r.notes,
      prompt_number: r.prompt_number,
      discovery_tokens: r.discovery_tokens ?? 0,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
      created_at_epoch: Number(r.created_at_epoch),
    };
  }
}

// ============================================================
// PostgresPromptRepository
// ============================================================

class PostgresPromptRepository implements IPromptRepository {
  constructor(private sql: PgSql) {}

  async saveUserPrompt(contentSessionId: string, promptNumber: number, promptText: string): Promise<number> {
    const now = Date.now();
    const [row] = await this.sql`
      INSERT INTO user_prompts (content_session_id, prompt_number, prompt_text, created_at_epoch)
      VALUES (${contentSessionId}, ${promptNumber}, ${promptText}, ${now})
      RETURNING id
    `;
    return row.id;
  }

  async getPromptsByIds(
    ids: number[],
    options?: { orderBy?: 'date_desc' | 'date_asc'; limit?: number; project?: string }
  ): Promise<PromptRow[]> {
    if (ids.length === 0) return [];
    const orderDir = options?.orderBy === 'date_asc' ? 'ASC' : 'DESC';
    const limitClause = options?.limit ? `LIMIT ${options.limit}` : '';

    // Join with sdk_sessions to get project and memory_session_id
    const rows = await this.sql.unsafe(
      `SELECT p.*, s.project, s.memory_session_id
       FROM user_prompts p
       JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
       WHERE p.id = ANY(ARRAY[${ids.join(',')}])
       ORDER BY p.created_at_epoch ${orderDir} ${limitClause}`
    );
    return rows.map((r: any) => this.mapRow(r));
  }

  async getPromptById(id: number): Promise<PromptRow | null> {
    const [row] = await this.sql`
      SELECT p.*, s.project, s.memory_session_id
      FROM user_prompts p
      JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
      WHERE p.id = ${id}
    `;
    return row ? this.mapRow(row) : null;
  }

  async getUserPrompt(contentSessionId: string, promptNumber: number): Promise<string | null> {
    const [row] = await this.sql`
      SELECT prompt_text FROM user_prompts
      WHERE content_session_id = ${contentSessionId} AND prompt_number = ${promptNumber}
    `;
    return row?.prompt_text ?? null;
  }

  async getPromptCount(contentSessionId: string): Promise<number> {
    const [row] = await this.sql`
      SELECT COUNT(*)::int as count FROM user_prompts WHERE content_session_id = ${contentSessionId}
    `;
    return row.count;
  }

  async getLatestUserPrompt(contentSessionId: string): Promise<PromptRow | null> {
    const [row] = await this.sql`
      SELECT p.id, p.content_session_id, p.prompt_number, p.prompt_text,
             p.created_at, p.created_at_epoch, s.memory_session_id, s.project
      FROM user_prompts p
      JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
      WHERE p.content_session_id = ${contentSessionId}
      ORDER BY p.prompt_number DESC LIMIT 1
    `;
    if (!row) return null;
    return this.mapRow(row);
  }

  async getAllRecentUserPrompts(limit = 50): Promise<PromptRow[]> {
    const rows = await this.sql`
      SELECT p.*, s.project, s.memory_session_id
      FROM user_prompts p
      JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
      ORDER BY p.created_at_epoch DESC LIMIT ${limit}
    `;
    return rows.map((r: any) => this.mapRow(r));
  }

  private mapRow(r: any): PromptRow {
    return {
      id: r.id,
      content_session_id: r.content_session_id,
      prompt_number: r.prompt_number,
      prompt_text: r.prompt_text,
      project: r.project || '',
      memory_session_id: r.memory_session_id || null,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
      created_at_epoch: Number(r.created_at_epoch),
    };
  }
}

// ============================================================
// PostgresPendingMessageRepository
// ============================================================

class PostgresPendingMessageRepository implements IPendingMessageRepository {
  constructor(private sql: PgSql) {}

  async enqueue(sessionDbId: number, contentSessionId: string, message: PendingMessage): Promise<number> {
    const now = Date.now();
    const [row] = await this.sql`
      INSERT INTO pending_messages (
        session_db_id, content_session_id, message_type, tool_name, tool_input,
        tool_response, cwd, last_assistant_message, prompt_number, created_at_epoch
      ) VALUES (
        ${sessionDbId}, ${contentSessionId}, ${message.type},
        ${message.tool_name || null}, ${message.tool_input || null},
        ${message.tool_response || null}, ${message.cwd || null},
        ${message.last_assistant_message || null}, ${message.prompt_number ?? null}, ${now}
      )
      RETURNING id
    `;
    return row.id;
  }

  async claimNextMessage(sessionDbId: number): Promise<PersistentPendingMessage | null> {
    // Use FOR UPDATE SKIP LOCKED for concurrent-safe claiming
    const now = Date.now();
    const rows = await this.sql`
      WITH next_msg AS (
        SELECT id FROM pending_messages
        WHERE session_db_id = ${sessionDbId} AND status = 'pending'
        ORDER BY created_at_epoch ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE pending_messages
      SET status = 'processing', started_processing_at_epoch = ${now}
      WHERE id = (SELECT id FROM next_msg)
      RETURNING *
    `;
    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  async confirmProcessed(messageId: number): Promise<void> {
    await this.sql`
      UPDATE pending_messages
      SET status = 'processed', completed_at_epoch = ${Date.now()}
      WHERE id = ${messageId}
    `;
  }

  async markFailed(messageId: number): Promise<void> {
    await this.sql`
      UPDATE pending_messages
      SET status = 'failed', failed_at_epoch = ${Date.now()}, retry_count = retry_count + 1
      WHERE id = ${messageId}
    `;
  }

  async getPendingCount(sessionDbId: number): Promise<number> {
    const [row] = await this.sql`
      SELECT COUNT(*)::int as count FROM pending_messages
      WHERE session_db_id = ${sessionDbId} AND status IN ('pending', 'processing')
    `;
    return row.count;
  }

  async getSessionsWithPendingMessages(): Promise<number[]> {
    const rows = await this.sql`
      SELECT DISTINCT session_db_id FROM pending_messages
      WHERE status IN ('pending', 'processing')
    `;
    return rows.map((r: any) => r.session_db_id);
  }

  async resetStaleProcessingMessages(thresholdMs = 120000, sessionDbId?: number): Promise<number> {
    const threshold = Date.now() - thresholdMs;
    if (sessionDbId !== undefined) {
      const result = await this.sql`
        UPDATE pending_messages SET status = 'pending', started_processing_at_epoch = NULL
        WHERE status = 'processing' AND started_processing_at_epoch < ${threshold}
          AND session_db_id = ${sessionDbId}
      `;
      return result.count;
    }
    const result = await this.sql`
      UPDATE pending_messages SET status = 'pending', started_processing_at_epoch = NULL
      WHERE status = 'processing' AND started_processing_at_epoch < ${threshold}
    `;
    return result.count;
  }

  async getQueueMessages(): Promise<QueueMessage[]> {
    const rows = await this.sql`
      SELECT pm.*, s.project
      FROM pending_messages pm
      LEFT JOIN sdk_sessions s ON s.id = pm.session_db_id
      ORDER BY pm.created_at_epoch DESC
    `;
    return rows.map((r: any) => ({ ...this.mapRow(r), project: r.project || null }));
  }

  async hasAnyPendingWork(): Promise<boolean> {
    const [row] = await this.sql`
      SELECT EXISTS(SELECT 1 FROM pending_messages WHERE status IN ('pending', 'processing')) as has_work
    `;
    return row.has_work;
  }

  async getAllPending(sessionDbId: number): Promise<PersistentPendingMessage[]> {
    const rows = await this.sql`
      SELECT * FROM pending_messages
      WHERE session_db_id = ${sessionDbId} AND status IN ('pending', 'processing')
      ORDER BY created_at_epoch ASC
    `;
    return rows.map((r: any) => this.mapRow(r));
  }

  async resetProcessingToPending(sessionDbId: number): Promise<number> {
    const result = await this.sql`
      UPDATE pending_messages SET status = 'pending', started_processing_at_epoch = NULL
      WHERE session_db_id = ${sessionDbId} AND status = 'processing'
    `;
    return result.count;
  }

  async markSessionMessagesFailed(sessionDbId: number): Promise<number> {
    const now = Date.now();
    const result = await this.sql`
      UPDATE pending_messages
      SET status = 'failed', failed_at_epoch = ${now}
      WHERE session_db_id = ${sessionDbId} AND status IN ('pending', 'processing')
    `;
    return result.count;
  }

  async markAllSessionMessagesAbandoned(sessionDbId: number): Promise<number> {
    const now = Date.now();
    const result = await this.sql`
      UPDATE pending_messages
      SET status = 'failed', failed_at_epoch = ${now}
      WHERE session_db_id = ${sessionDbId} AND status IN ('pending', 'processing')
    `;
    return result.count;
  }

  toPendingMessage(persistent: PersistentPendingMessage): PendingMessage {
    return {
      type: persistent.message_type as 'observation' | 'summarize',
      tool_name: persistent.tool_name || undefined,
      tool_input: persistent.tool_input || undefined,
      tool_response: persistent.tool_response || undefined,
      cwd: persistent.cwd || undefined,
      last_assistant_message: persistent.last_assistant_message || undefined,
      prompt_number: persistent.prompt_number ?? undefined,
    };
  }

  private mapRow(r: any): PersistentPendingMessage {
    return {
      id: r.id,
      session_db_id: r.session_db_id,
      content_session_id: r.content_session_id,
      message_type: r.message_type,
      tool_name: r.tool_name,
      tool_input: r.tool_input,
      tool_response: r.tool_response,
      cwd: r.cwd,
      last_assistant_message: r.last_assistant_message,
      prompt_number: r.prompt_number,
      status: r.status,
      retry_count: r.retry_count,
      created_at_epoch: Number(r.created_at_epoch),
      started_processing_at_epoch: r.started_processing_at_epoch ? Number(r.started_processing_at_epoch) : null,
      completed_at_epoch: r.completed_at_epoch ? Number(r.completed_at_epoch) : null,
      failed_at_epoch: r.failed_at_epoch ? Number(r.failed_at_epoch) : null,
    };
  }
}

// ============================================================
// PostgresTimelineRepository
// ============================================================

class PostgresTimelineRepository implements ITimelineRepository {
  constructor(private sql: PgSql) {}

  async getTimelineAroundObservation(
    anchorObservationId: number | null,
    anchorEpoch: number,
    depthBefore = 10,
    depthAfter = 10,
    project?: string
  ): Promise<{
    observations: ObservationRow[];
    sessions: Array<{
      id: number; memory_session_id: string; project: string;
      request: string | null; completed: string | null; next_steps: string | null;
      created_at: string; created_at_epoch: number;
    }>;
    prompts: Array<{
      id: number; content_session_id: string; prompt_number: number;
      prompt_text: string; project: string; created_at: string; created_at_epoch: number;
    }>;
  }> {
    const beforeEpoch = anchorEpoch;
    const afterEpoch = anchorEpoch;

    // Observations before and after anchor
    const obsBefore = project
      ? await this.sql`
          SELECT * FROM observations WHERE created_at_epoch <= ${beforeEpoch} AND project = ${project}
          ORDER BY created_at_epoch DESC LIMIT ${depthBefore}
        `
      : await this.sql`
          SELECT * FROM observations WHERE created_at_epoch <= ${beforeEpoch}
          ORDER BY created_at_epoch DESC LIMIT ${depthBefore}
        `;

    const obsAfter = project
      ? await this.sql`
          SELECT * FROM observations WHERE created_at_epoch > ${afterEpoch} AND project = ${project}
          ORDER BY created_at_epoch ASC LIMIT ${depthAfter}
        `
      : await this.sql`
          SELECT * FROM observations WHERE created_at_epoch > ${afterEpoch}
          ORDER BY created_at_epoch ASC LIMIT ${depthAfter}
        `;

    const allObs = [...obsBefore.reverse(), ...obsAfter];
    if (allObs.length === 0) {
      return { observations: [], sessions: [], prompts: [] };
    }

    const minEpoch = Math.min(...allObs.map((o: any) => Number(o.created_at_epoch)));
    const maxEpoch = Math.max(...allObs.map((o: any) => Number(o.created_at_epoch)));

    const sessions = project
      ? await this.sql`
          SELECT ss.id, ss.memory_session_id, ss.project, ss.request, ss.completed,
                 ss.next_steps, ss.created_at, ss.created_at_epoch
          FROM session_summaries ss
          WHERE ss.created_at_epoch BETWEEN ${minEpoch} AND ${maxEpoch} AND ss.project = ${project}
          ORDER BY ss.created_at_epoch DESC
        `
      : await this.sql`
          SELECT ss.id, ss.memory_session_id, ss.project, ss.request, ss.completed,
                 ss.next_steps, ss.created_at, ss.created_at_epoch
          FROM session_summaries ss
          WHERE ss.created_at_epoch BETWEEN ${minEpoch} AND ${maxEpoch}
          ORDER BY ss.created_at_epoch DESC
        `;

    const prompts = project
      ? await this.sql`
          SELECT p.id, p.content_session_id, p.prompt_number, p.prompt_text,
                 s.project, p.created_at, p.created_at_epoch
          FROM user_prompts p
          JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
          WHERE p.created_at_epoch BETWEEN ${minEpoch} AND ${maxEpoch} AND s.project = ${project}
          ORDER BY p.created_at_epoch DESC
        `
      : await this.sql`
          SELECT p.id, p.content_session_id, p.prompt_number, p.prompt_text,
                 s.project, p.created_at, p.created_at_epoch
          FROM user_prompts p
          JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
          WHERE p.created_at_epoch BETWEEN ${minEpoch} AND ${maxEpoch}
          ORDER BY p.created_at_epoch DESC
        `;

    return {
      observations: allObs.map((r: any) => this.mapObservation(r)),
      sessions: sessions.map((r: any) => ({
        id: r.id,
        memory_session_id: r.memory_session_id,
        project: r.project,
        request: r.request,
        completed: r.completed,
        next_steps: r.next_steps,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
        created_at_epoch: Number(r.created_at_epoch),
      })),
      prompts: prompts.map((r: any) => ({
        id: r.id,
        content_session_id: r.content_session_id,
        prompt_number: r.prompt_number,
        prompt_text: r.prompt_text,
        project: r.project,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
        created_at_epoch: Number(r.created_at_epoch),
      })),
    };
  }

  async getTimelineByTimeRange(
    startEpoch: number,
    endEpoch: number,
    project?: string
  ): Promise<{
    observations: ObservationRow[];
    sessions: Array<{
      id: number; memory_session_id: string; project: string;
      request: string | null; completed: string | null; next_steps: string | null;
      created_at: string; created_at_epoch: number;
    }>;
    prompts: Array<{
      id: number; content_session_id: string; prompt_number: number;
      prompt_text: string; project: string; created_at: string; created_at_epoch: number;
    }>;
  }> {
    const observations = project
      ? await this.sql`
          SELECT * FROM observations
          WHERE created_at_epoch BETWEEN ${startEpoch} AND ${endEpoch} AND project = ${project}
          ORDER BY created_at_epoch DESC
        `
      : await this.sql`
          SELECT * FROM observations
          WHERE created_at_epoch BETWEEN ${startEpoch} AND ${endEpoch}
          ORDER BY created_at_epoch DESC
        `;

    const sessions = project
      ? await this.sql`
          SELECT ss.id, ss.memory_session_id, ss.project, ss.request, ss.completed,
                 ss.next_steps, ss.created_at, ss.created_at_epoch
          FROM session_summaries ss
          WHERE ss.created_at_epoch BETWEEN ${startEpoch} AND ${endEpoch} AND ss.project = ${project}
          ORDER BY ss.created_at_epoch DESC
        `
      : await this.sql`
          SELECT ss.id, ss.memory_session_id, ss.project, ss.request, ss.completed,
                 ss.next_steps, ss.created_at, ss.created_at_epoch
          FROM session_summaries ss
          WHERE ss.created_at_epoch BETWEEN ${startEpoch} AND ${endEpoch}
          ORDER BY ss.created_at_epoch DESC
        `;

    const prompts = project
      ? await this.sql`
          SELECT p.id, p.content_session_id, p.prompt_number, p.prompt_text,
                 s.project, p.created_at, p.created_at_epoch
          FROM user_prompts p
          JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
          WHERE p.created_at_epoch BETWEEN ${startEpoch} AND ${endEpoch} AND s.project = ${project}
          ORDER BY p.created_at_epoch DESC
        `
      : await this.sql`
          SELECT p.id, p.content_session_id, p.prompt_number, p.prompt_text,
                 s.project, p.created_at, p.created_at_epoch
          FROM user_prompts p
          JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
          WHERE p.created_at_epoch BETWEEN ${startEpoch} AND ${endEpoch}
          ORDER BY p.created_at_epoch DESC
        `;

    return {
      observations: observations.map((r: any) => this.mapObservation(r)),
      sessions: sessions.map((r: any) => ({
        id: r.id,
        memory_session_id: r.memory_session_id,
        project: r.project,
        request: r.request,
        completed: r.completed,
        next_steps: r.next_steps,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
        created_at_epoch: Number(r.created_at_epoch),
      })),
      prompts: prompts.map((r: any) => ({
        id: r.id,
        content_session_id: r.content_session_id,
        prompt_number: r.prompt_number,
        prompt_text: r.prompt_text,
        project: r.project,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
        created_at_epoch: Number(r.created_at_epoch),
      })),
    };
  }

  private mapObservation(r: any): ObservationRow {
    return {
      id: r.id,
      memory_session_id: r.memory_session_id,
      project: r.project,
      text: r.text,
      type: r.type,
      title: r.title || '',
      subtitle: r.subtitle || null,
      facts: r.facts || '[]',
      narrative: r.narrative || '',
      concepts: r.concepts || '[]',
      files_read: r.files_read || '[]',
      files_modified: r.files_modified || '[]',
      prompt_number: r.prompt_number,
      discovery_tokens: r.discovery_tokens ?? 0,
      content_hash: r.content_hash || '',
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
      created_at_epoch: Number(r.created_at_epoch),
    };
  }
}

// ============================================================
// PostgresSearchRepository
// ============================================================

class PostgresSearchRepository implements ISearchRepository {
  constructor(private sql: PgSql) {}

  async fullTextSearch(params: {
    query: string;
    project?: string;
    limit?: number;
    tables?: Array<'observations' | 'summaries' | 'prompts'>;
  }): Promise<SearchHit[]> {
    const { query, project, limit = 50 } = params;
    const tables = params.tables || ['observations', 'summaries', 'prompts'];
    const results: SearchHit[] = [];

    if (tables.includes('observations')) {
      const rows = project
        ? await this.sql`
            SELECT id, ts_rank(search_vector, plainto_tsquery('english', ${query})) as score
            FROM observations
            WHERE search_vector @@ plainto_tsquery('english', ${query}) AND project = ${project}
            ORDER BY score DESC LIMIT ${limit}
          `
        : await this.sql`
            SELECT id, ts_rank(search_vector, plainto_tsquery('english', ${query})) as score
            FROM observations
            WHERE search_vector @@ plainto_tsquery('english', ${query})
            ORDER BY score DESC LIMIT ${limit}
          `;
      for (const r of rows) {
        results.push({ id: r.id, table: 'observations', score: r.score, project: project || '' });
      }
    }

    if (tables.includes('summaries')) {
      const rows = project
        ? await this.sql`
            SELECT id, ts_rank(search_vector, plainto_tsquery('english', ${query})) as score
            FROM session_summaries
            WHERE search_vector @@ plainto_tsquery('english', ${query}) AND project = ${project}
            ORDER BY score DESC LIMIT ${limit}
          `
        : await this.sql`
            SELECT id, ts_rank(search_vector, plainto_tsquery('english', ${query})) as score
            FROM session_summaries
            WHERE search_vector @@ plainto_tsquery('english', ${query})
            ORDER BY score DESC LIMIT ${limit}
          `;
      for (const r of rows) {
        results.push({ id: r.id, table: 'summaries', score: r.score, project: project || '' });
      }
    }

    if (tables.includes('prompts')) {
      const rows = project
        ? await this.sql`
            SELECT p.id, ts_rank(p.search_vector, plainto_tsquery('english', ${query})) as score
            FROM user_prompts p
            JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
            WHERE p.search_vector @@ plainto_tsquery('english', ${query}) AND s.project = ${project}
            ORDER BY score DESC LIMIT ${limit}
          `
        : await this.sql`
            SELECT id, ts_rank(search_vector, plainto_tsquery('english', ${query})) as score
            FROM user_prompts
            WHERE search_vector @@ plainto_tsquery('english', ${query})
            ORDER BY score DESC LIMIT ${limit}
          `;
      for (const r of rows) {
        results.push({ id: r.id, table: 'prompts', score: r.score, project: project || '' });
      }
    }

    // Sort by score descending across all tables
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async vectorSearch(params: {
    queryVector: number[];
    project?: string;
    limit?: number;
    tables?: Array<'observations' | 'summaries' | 'prompts'>;
  }): Promise<VectorSearchHit[]> {
    const { queryVector, project, limit = 20 } = params;
    const tables = params.tables || ['observations', 'summaries', 'prompts'];
    const results: VectorSearchHit[] = [];
    const vectorStr = `[${queryVector.join(',')}]`;

    if (tables.includes('observations')) {
      const rows = project
        ? await this.sql.unsafe(
            `SELECT id, embedding <=> '${vectorStr}' as distance
             FROM observations
             WHERE embedding IS NOT NULL AND project = $1
             ORDER BY distance ASC LIMIT $2`,
            [project, limit]
          )
        : await this.sql.unsafe(
            `SELECT id, embedding <=> '${vectorStr}' as distance
             FROM observations
             WHERE embedding IS NOT NULL
             ORDER BY distance ASC LIMIT $1`,
            [limit]
          );
      for (const r of rows) {
        results.push({ id: r.id, table: 'observations', score: 1 - r.distance, distance: r.distance, project: project || '' });
      }
    }

    if (tables.includes('summaries')) {
      const rows = project
        ? await this.sql.unsafe(
            `SELECT id, embedding <=> '${vectorStr}' as distance
             FROM session_summaries
             WHERE embedding IS NOT NULL AND project = $1
             ORDER BY distance ASC LIMIT $2`,
            [project, limit]
          )
        : await this.sql.unsafe(
            `SELECT id, embedding <=> '${vectorStr}' as distance
             FROM session_summaries
             WHERE embedding IS NOT NULL
             ORDER BY distance ASC LIMIT $1`,
            [limit]
          );
      for (const r of rows) {
        results.push({ id: r.id, table: 'summaries', score: 1 - r.distance, distance: r.distance, project: project || '' });
      }
    }

    if (tables.includes('prompts')) {
      const rows = project
        ? await this.sql.unsafe(
            `SELECT p.id, p.embedding <=> '${vectorStr}' as distance
             FROM user_prompts p
             JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
             WHERE p.embedding IS NOT NULL AND s.project = $1
             ORDER BY distance ASC LIMIT $2`,
            [project, limit]
          )
        : await this.sql.unsafe(
            `SELECT id, embedding <=> '${vectorStr}' as distance
             FROM user_prompts
             WHERE embedding IS NOT NULL
             ORDER BY distance ASC LIMIT $1`,
            [limit]
          );
      for (const r of rows) {
        results.push({ id: r.id, table: 'prompts', score: 1 - r.distance, distance: r.distance, project: project || '' });
      }
    }

    return results.sort((a, b) => a.distance - b.distance).slice(0, limit);
  }

  async filterSearch(params: {
    project?: string;
    types?: string[];
    concepts?: string[];
    files?: string[];
    dateRange?: { start: number; end: number };
    limit?: number;
    offset?: number;
    orderBy?: 'date_desc' | 'date_asc';
    searchType?: 'observations' | 'sessions' | 'prompts' | 'all';
    isFolder?: boolean;
  }): Promise<{
    observations: ObservationRow[];
    sessions: SummaryRow[];
    prompts: PromptRow[];
  }> {
    const { project, limit = 50, offset = 0, searchType = 'all' } = params;
    const orderDir = params.orderBy === 'date_asc' ? 'ASC' : 'DESC';
    let observations: ObservationRow[] = [];
    let sessions: SummaryRow[] = [];
    let prompts: PromptRow[] = [];

    if (searchType === 'observations' || searchType === 'all') {
      const conditions: string[] = [];
      if (project) conditions.push(`project = '${project.replace(/'/g, "''")}'`);
      if (params.types?.length) {
        conditions.push(`type = ANY(ARRAY[${params.types.map(t => `'${t.replace(/'/g, "''")}'`).join(',')}])`);
      }
      if (params.dateRange) {
        conditions.push(`created_at_epoch >= ${params.dateRange.start}`);
        conditions.push(`created_at_epoch <= ${params.dateRange.end}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = await this.sql.unsafe(
        `SELECT * FROM observations ${where}
         ORDER BY created_at_epoch ${orderDir} LIMIT ${limit} OFFSET ${offset}`
      );
      observations = rows.map((r: any) => ({
        id: r.id, memory_session_id: r.memory_session_id, project: r.project,
        text: r.text, type: r.type, title: r.title || '', subtitle: r.subtitle || null,
        facts: r.facts || '[]', narrative: r.narrative || '',
        concepts: r.concepts || '[]', files_read: r.files_read || '[]',
        files_modified: r.files_modified || '[]', prompt_number: r.prompt_number,
        discovery_tokens: r.discovery_tokens ?? 0, content_hash: r.content_hash || '',
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
        created_at_epoch: Number(r.created_at_epoch),
      }));
    }

    if (searchType === 'sessions' || searchType === 'all') {
      const conditions: string[] = [];
      if (project) conditions.push(`project = '${project.replace(/'/g, "''")}'`);
      if (params.dateRange) {
        conditions.push(`created_at_epoch >= ${params.dateRange.start}`);
        conditions.push(`created_at_epoch <= ${params.dateRange.end}`);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = await this.sql.unsafe(
        `SELECT * FROM session_summaries ${where}
         ORDER BY created_at_epoch ${orderDir} LIMIT ${limit} OFFSET ${offset}`
      );
      sessions = rows.map((r: any) => ({
        id: r.id, memory_session_id: r.memory_session_id, project: r.project,
        request: r.request, investigated: r.investigated, learned: r.learned,
        completed: r.completed, next_steps: r.next_steps,
        files_read: r.files_read || '[]', files_edited: r.files_edited || '[]',
        notes: r.notes, prompt_number: r.prompt_number,
        discovery_tokens: r.discovery_tokens ?? 0,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
        created_at_epoch: Number(r.created_at_epoch),
      }));
    }

    if (searchType === 'prompts' || searchType === 'all') {
      const conditions: string[] = [];
      if (project) conditions.push(`s.project = '${project.replace(/'/g, "''")}'`);
      if (params.dateRange) {
        conditions.push(`p.created_at_epoch >= ${params.dateRange.start}`);
        conditions.push(`p.created_at_epoch <= ${params.dateRange.end}`);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = await this.sql.unsafe(
        `SELECT p.*, s.project, s.memory_session_id FROM user_prompts p
         JOIN sdk_sessions s ON s.content_session_id = p.content_session_id
         ${where}
         ORDER BY p.created_at_epoch ${orderDir} LIMIT ${limit} OFFSET ${offset}`
      );
      prompts = rows.map((r: any) => ({
        id: r.id, content_session_id: r.content_session_id,
        prompt_number: r.prompt_number, prompt_text: r.prompt_text,
        project: r.project || '', memory_session_id: r.memory_session_id || null,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
        created_at_epoch: Number(r.created_at_epoch),
      }));
    }

    return { observations, sessions, prompts };
  }
}

// ============================================================
// PostgresStorageRepository - Unified implementation
// ============================================================

export class PostgresStorageRepository implements IStorageRepository {
  readonly sessions: ISessionRepository;
  readonly observations: IObservationRepository;
  readonly summaries: ISummaryRepository;
  readonly prompts: IPromptRepository;
  readonly pendingMessages: IPendingMessageRepository;
  readonly timeline: ITimelineRepository;
  readonly search: ISearchRepository;
  readonly providerName = 'postgresql' as const;

  private constructor(private sql: PgSql) {
    this.sessions = new PostgresSessionRepository(sql);
    this.observations = new PostgresObservationRepository(sql);
    this.summaries = new PostgresSummaryRepository(sql);
    this.prompts = new PostgresPromptRepository(sql);
    this.pendingMessages = new PostgresPendingMessageRepository(sql);
    this.timeline = new PostgresTimelineRepository(sql);
    this.search = new PostgresSearchRepository(sql);
  }

  /**
   * Create and initialize a PostgresStorageRepository.
   * Establishes connection, runs migrations, and validates health.
   */
  static async create(config: PostgresConnectionConfig): Promise<PostgresStorageRepository> {
    const postgres = (await import('postgres')).default;

    const sqlOptions: any = {
      max: config.poolMax,
      idle_timeout: 30,
      connect_timeout: 10,
    };

    let sql: PgSql;
    if (config.connectionString) {
      sql = postgres(config.connectionString, sqlOptions);
    } else {
      sql = postgres({
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password,
        ssl: config.ssl,
        ...sqlOptions,
      });
    }

    // Test connection
    try {
      await sql`SELECT 1`;
    } catch (error) {
      await sql.end();
      throw error;
    }

    // Run migrations
    const migrationRunner = new PostgresMigrationRunner(sql);
    await migrationRunner.runAllMigrations();

    return new PostgresStorageRepository(sql);
  }

  async withTransaction<T>(fn: (repo: IStorageRepository) => Promise<T>): Promise<T> {
    return this.sql.begin(async (tx: PgSql) => {
      // Create a transactional repository with the transaction sql
      const txRepo: IStorageRepository = {
        sessions: new PostgresSessionRepository(tx),
        observations: new PostgresObservationRepository(tx),
        summaries: new PostgresSummaryRepository(tx),
        prompts: new PostgresPromptRepository(tx),
        pendingMessages: new PostgresPendingMessageRepository(tx),
        timeline: new PostgresTimelineRepository(tx),
        search: new PostgresSearchRepository(tx),
        providerName: 'postgresql',
        withTransaction: () => { throw new Error('Nested transactions not supported'); },
        close: () => Promise.resolve(),
        isHealthy: () => Promise.resolve(true),
      };
      return fn(txRepo);
    });
  }

  async close(): Promise<void> {
    await this.sql.end();
    logger.info('DB', 'PostgreSQL connection pool closed');
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.sql`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
