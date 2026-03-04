/**
 * DataMigrationTool - SQLite to PostgreSQL data migration.
 *
 * Migrates tables in foreign-key dependency order with batch processing,
 * progress tracking, dry-run mode, and post-migration verification.
 * Embedding vectors are regenerated from scratch (not extracted from ChromaDB).
 */

import type { IStorageRepository } from '../interfaces.js';
import type { EmbeddingQueue } from '../embedding/EmbeddingQueue.js';
import { logger } from '../../../utils/logger.js';

export interface MigrationOptions {
  dryRun: boolean;
  batchSize: number;
  skipEmbeddings: boolean;
}

export interface MigrationProgress {
  table: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

export interface MigrationResult {
  success: boolean;
  tables: MigrationProgress[];
  duration: number;
  embeddingBackfillQueued: number;
}

type LogFn = (message: string) => void;

export class DataMigrationTool {
  private readonly sqliteRepo: IStorageRepository;
  private readonly postgresRepo: IStorageRepository;
  private readonly embeddingQueue: EmbeddingQueue | null;
  private readonly log: LogFn;

  constructor(
    sqliteRepo: IStorageRepository,
    postgresRepo: IStorageRepository,
    embeddingQueue?: EmbeddingQueue,
    log?: LogFn
  ) {
    this.sqliteRepo = sqliteRepo;
    this.postgresRepo = postgresRepo;
    this.embeddingQueue = embeddingQueue || null;
    this.log = log || ((msg: string) => console.log(msg));
  }

  /**
   * Execute the full SQLite → PostgreSQL data migration.
   */
  async migrate(options: MigrationOptions): Promise<MigrationResult> {
    const startTime = Date.now();

    if (options.dryRun) {
      return this.dryRun();
    }

    const results: MigrationProgress[] = [];

    // Migrate in foreign-key dependency order
    const migrations = [
      { name: 'sdk_sessions', fn: () => this.migrateSessions(options) },
      { name: 'observations', fn: () => this.migrateObservations(options) },
      { name: 'session_summaries', fn: () => this.migrateSummaries(options) },
      { name: 'user_prompts', fn: () => this.migratePrompts(options) },
      { name: 'pending_messages', fn: () => this.migratePendingMessages(options) },
    ];

    for (const migration of migrations) {
      try {
        this.log(`Migrating ${migration.name}...`);
        const progress = await migration.fn();
        results.push(progress);
        this.log(`  ${migration.name}: ${progress.migrated}/${progress.total} migrated, ${progress.skipped} skipped, ${progress.errors} errors`);
      } catch (error) {
        logger.error('DB', `Migration failed for ${migration.name}`, {}, error as Error);
        results.push({
          table: migration.name,
          total: 0,
          migrated: 0,
          skipped: 0,
          errors: 1,
        });
        return {
          success: false,
          tables: results,
          duration: Date.now() - startTime,
          embeddingBackfillQueued: 0,
        };
      }
    }

    // Post-migration verification
    this.log('\nVerifying migration...');
    await this.verify(results);

    // Queue embedding backfill
    let embeddingCount = 0;
    if (!options.skipEmbeddings && this.embeddingQueue) {
      this.log('\nQueueing embedding backfill...');
      embeddingCount = await this.embeddingQueue.backfill();
      this.log(`  Queued ${embeddingCount} records for embedding generation`);
    }

    return {
      success: true,
      tables: results,
      duration: Date.now() - startTime,
      embeddingBackfillQueued: embeddingCount,
    };
  }

  /**
   * Dry-run mode: count records only, no actual migration.
   */
  private async dryRun(): Promise<MigrationResult> {
    this.log('DRY RUN - counting records only\n');

    const results: MigrationProgress[] = [];

    // Count observations
    const obsCount = await this.sqliteRepo.observations.getObservationCount();
    results.push({ table: 'observations', total: obsCount, migrated: 0, skipped: 0, errors: 0 });

    // Count sessions via getAllProjects and summing
    const projects = await this.sqliteRepo.sessions.getAllProjects();
    let sessionCount = 0;
    for (const project of projects) {
      const sessions = await this.sqliteRepo.sessions.getSessionsByProject(project, 100000);
      sessionCount += sessions.length;
    }
    results.unshift({ table: 'sdk_sessions', total: sessionCount, migrated: 0, skipped: 0, errors: 0 });

    // For summaries/prompts/pending, report from observations as proxy
    results.push({ table: 'session_summaries', total: -1, migrated: 0, skipped: 0, errors: 0 });
    results.push({ table: 'user_prompts', total: -1, migrated: 0, skipped: 0, errors: 0 });
    results.push({ table: 'pending_messages', total: -1, migrated: 0, skipped: 0, errors: 0 });

    for (const r of results) {
      const countStr = r.total >= 0 ? String(r.total) : '(count unavailable)';
      this.log(`  ${r.table}: ${countStr} records`);
    }

    return {
      success: true,
      tables: results,
      duration: 0,
      embeddingBackfillQueued: 0,
    };
  }

  /**
   * Migrate sessions (must be first due to foreign key constraints).
   */
  private async migrateSessions(options: MigrationOptions): Promise<MigrationProgress> {
    const projects = await this.sqliteRepo.sessions.getAllProjects();
    let total = 0;
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const project of projects) {
      const sessions = await this.sqliteRepo.sessions.getSessionsByProject(project, 100000);
      total += sessions.length;

      for (let i = 0; i < sessions.length; i += options.batchSize) {
        const batch = sessions.slice(i, i + options.batchSize);

        for (const session of batch) {
          try {
            // Check if already exists in target
            const existing = await this.postgresRepo.sessions.getSessionByContentId(
              session.content_session_id
            );
            if (existing) {
              skipped++;
              continue;
            }

            const dbId = await this.postgresRepo.sessions.createSDKSession(
              session.content_session_id,
              session.project,
              session.user_prompt || '',
              session.custom_title || undefined
            );

            // Update memory session ID if set
            if (session.memory_session_id) {
              await this.postgresRepo.sessions.updateMemorySessionId(
                dbId,
                session.memory_session_id
              );
            }

            // Update status if not active
            if (session.status && session.status !== 'active') {
              await this.postgresRepo.sessions.updateSessionStatus(
                session.content_session_id,
                session.status
              );
            }

            migrated++;
          } catch (error) {
            errors++;
            logger.error('DB', `Failed to migrate session ${session.content_session_id}`, {}, error as Error);
          }
        }
      }
    }

    return { table: 'sdk_sessions', total, migrated, skipped, errors };
  }

  /**
   * Migrate observations.
   */
  private async migrateObservations(options: MigrationOptions): Promise<MigrationProgress> {
    const projects = await this.sqliteRepo.sessions.getAllProjects();
    let total = 0;
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const project of projects) {
      // Get all observations for this project
      const observations = await this.sqliteRepo.observations.getRecentObservations(
        project, 100000
      );
      total += observations.length;

      for (let i = 0; i < observations.length; i += options.batchSize) {
        const batch = observations.slice(i, i + options.batchSize);

        for (const obs of batch) {
          try {
            await this.postgresRepo.observations.storeObservation(
              obs.memory_session_id,
              obs.project,
              {
                type: obs.type,
                title: obs.title,
                subtitle: obs.subtitle,
                facts: obs.facts ? JSON.parse(obs.facts) : [],
                narrative: obs.narrative,
                concepts: obs.concepts ? JSON.parse(obs.concepts) : [],
                files_read: obs.files_read ? JSON.parse(obs.files_read) : [],
                files_modified: obs.files_modified ? JSON.parse(obs.files_modified) : [],
              },
              obs.prompt_number ?? undefined,
              obs.discovery_tokens,
              obs.created_at_epoch
            );
            migrated++;
          } catch (error) {
            // Likely a duplicate (content-hash dedup)
            const msg = (error as Error).message || '';
            if (msg.includes('duplicate') || msg.includes('content_hash')) {
              skipped++;
            } else {
              errors++;
              logger.error('DB', `Failed to migrate observation ${obs.id}`, {}, error as Error);
            }
          }
        }
      }
    }

    return { table: 'observations', total, migrated, skipped, errors };
  }

  /**
   * Migrate session summaries.
   */
  private async migrateSummaries(options: MigrationOptions): Promise<MigrationProgress> {
    const projects = await this.sqliteRepo.sessions.getAllProjects();
    let total = 0;
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const project of projects) {
      const summaries = await this.sqliteRepo.summaries.getRecentSummaries(
        project, 100000
      );
      total += summaries.length;

      for (let i = 0; i < summaries.length; i += options.batchSize) {
        const batch = summaries.slice(i, i + options.batchSize);

        for (const summary of batch) {
          try {
            await this.postgresRepo.summaries.storeSummary(
              summary.memory_session_id,
              summary.project,
              {
                request: summary.request || '',
                investigated: summary.investigated || '',
                learned: summary.learned || '',
                completed: summary.completed || '',
                next_steps: summary.next_steps || '',
                notes: summary.notes,
              },
              summary.prompt_number ?? undefined,
              summary.discovery_tokens,
              summary.created_at_epoch
            );
            migrated++;
          } catch (error) {
            errors++;
            logger.error('DB', `Failed to migrate summary ${summary.id}`, {}, error as Error);
          }
        }
      }
    }

    return { table: 'session_summaries', total, migrated, skipped, errors };
  }

  /**
   * Migrate user prompts.
   */
  private async migratePrompts(options: MigrationOptions): Promise<MigrationProgress> {
    // Get all prompts via getAllRecentUserPrompts
    const prompts = await this.sqliteRepo.prompts.getAllRecentUserPrompts(100000);
    const total = prompts.length;
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < prompts.length; i += options.batchSize) {
      const batch = prompts.slice(i, i + options.batchSize);

      for (const prompt of batch) {
        try {
          await this.postgresRepo.prompts.saveUserPrompt(
            prompt.content_session_id,
            prompt.prompt_number,
            prompt.prompt_text
          );
          migrated++;
        } catch (error) {
          const msg = (error as Error).message || '';
          if (msg.includes('duplicate') || msg.includes('unique')) {
            skipped++;
          } else {
            errors++;
            logger.error('DB', `Failed to migrate prompt ${prompt.id}`, {}, error as Error);
          }
        }
      }
    }

    return { table: 'user_prompts', total, migrated, skipped, errors };
  }

  /**
   * Migrate pending messages (only pending/processing status).
   */
  private async migratePendingMessages(options: MigrationOptions): Promise<MigrationProgress> {
    const queueMessages = await this.sqliteRepo.pendingMessages.getQueueMessages();
    // Only migrate pending or processing messages
    const eligible = queueMessages.filter(
      m => m.status === 'pending' || m.status === 'processing'
    );
    const total = eligible.length;
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const msg of eligible) {
      try {
        // Find the session in PostgreSQL
        const session = await this.postgresRepo.sessions.getSessionById(msg.session_db_id);
        if (!session) {
          // Try by content_session_id
          const sessionByContent = await this.postgresRepo.sessions.getSessionByContentId(
            msg.content_session_id
          );
          if (!sessionByContent) {
            skipped++;
            continue;
          }
        }

        await this.postgresRepo.pendingMessages.enqueue(
          msg.session_db_id,
          msg.content_session_id,
          this.sqliteRepo.pendingMessages.toPendingMessage(msg)
        );
        migrated++;
      } catch (error) {
        errors++;
        logger.error('DB', `Failed to migrate pending message ${msg.id}`, {}, error as Error);
      }
    }

    return { table: 'pending_messages', total, migrated, skipped, errors };
  }

  /**
   * Post-migration verification: compare record counts.
   */
  private async verify(results: MigrationProgress[]): Promise<void> {
    for (const progress of results) {
      const expected = progress.total - progress.skipped;
      if (progress.migrated !== expected && progress.errors === 0) {
        this.log(`  WARNING: ${progress.table} count mismatch - expected ${expected}, got ${progress.migrated}`);
      } else {
        this.log(`  ${progress.table}: OK (${progress.migrated} records)`);
      }
    }
  }
}
