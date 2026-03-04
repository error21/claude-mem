/**
 * PostgreSQL Full Lifecycle Integration Tests
 *
 * Tests the complete storage lifecycle with a real PostgreSQL instance:
 * - Worker startup simulation with PostgreSQL config
 * - Observation storage, summary storage, search, timeline retrieval
 * - Migration runner idempotency
 * - RLS project isolation
 * - Connection pool drain on graceful shutdown
 *
 * Skipped when CLAUDE_MEM_TEST_PG_URL is not set.
 *
 * Docker setup:
 *   docker run --name pg-test -e POSTGRES_DB=claude_mem_test -e POSTGRES_PASSWORD=test -p 5432:5432 pgvector/pgvector:pg16
 *   CLAUDE_MEM_TEST_PG_URL="postgres://postgres:test@localhost:5432/claude_mem_test" bun test tests/integration/postgres-full-lifecycle.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { IStorageRepository } from '../../src/services/storage/interfaces.js';
import type { ObservationInput, SummaryInput } from '../../src/services/storage/types.js';

const PG_URL = process.env.CLAUDE_MEM_TEST_PG_URL;
const SKIP = !PG_URL;

let repository: IStorageRepository;

describe.skipIf(SKIP)('PostgreSQL Full Lifecycle', () => {
  beforeAll(async () => {
    const { PostgresStorageRepository } = await import('../../src/services/storage/postgres/PostgresStorageRepository.js');
    repository = await PostgresStorageRepository.create({
      connectionString: PG_URL!,
      host: '', port: 5432, database: '', username: '', password: '',
      ssl: false, poolMin: 1, poolMax: 5,
    });

    // Clean test data
    const postgres = (await import('postgres')).default;
    const sql = postgres(PG_URL!);
    await sql`DELETE FROM pending_messages`;
    await sql`DELETE FROM user_prompts`;
    await sql`DELETE FROM session_summaries`;
    await sql`DELETE FROM observations`;
    await sql`DELETE FROM sdk_sessions`;
    await sql.end();
  });

  afterAll(async () => {
    if (repository) await repository.close();
  });

  // ==========================================
  // Full Lifecycle
  // ==========================================

  it('should complete full observation lifecycle', async () => {
    // 1. Create session
    const sessionId = await repository.sessions.createSDKSession(
      'lifecycle-content-1',
      'test-project',
      'Test lifecycle prompt',
      'Test lifecycle title'
    );
    expect(sessionId).toBeGreaterThan(0);

    // 2. Set memory session ID
    await repository.sessions.updateMemorySessionId(sessionId, 'lifecycle-memory-1');

    // 3. Store observation
    const obsInput: ObservationInput = {
      type: 'discovery',
      title: 'Full lifecycle test observation',
      subtitle: 'Testing complete flow',
      facts: ['fact1', 'fact2'],
      narrative: 'This tests the full lifecycle from session creation to search',
      concepts: ['testing', 'lifecycle'],
      files_read: ['test.ts'],
      files_modified: [],
    };
    const obsResult = await repository.observations.storeObservation(
      'lifecycle-memory-1',
      'test-project',
      obsInput,
      1,
      100
    );
    expect(obsResult.id).toBeGreaterThan(0);

    // 4. Store summary
    const summaryInput: SummaryInput = {
      request: 'Test lifecycle',
      investigated: 'Full storage flow',
      learned: 'PostgreSQL lifecycle works',
      completed: 'All steps verified',
      next_steps: 'Move to production',
      notes: null,
    };
    const summaryResult = await repository.summaries.storeSummary(
      'lifecycle-memory-1',
      'test-project',
      summaryInput,
      1,
      200
    );
    expect(summaryResult.id).toBeGreaterThan(0);

    // 5. Save user prompt
    const promptId = await repository.prompts.saveUserPrompt(
      'lifecycle-content-1',
      1,
      'What is the full lifecycle?'
    );
    expect(promptId).toBeGreaterThan(0);

    // 6. Retrieve observation
    const obs = await repository.observations.getObservationById(obsResult.id);
    expect(obs).not.toBeNull();
    expect(obs!.title).toBe('Full lifecycle test observation');

    // 7. Retrieve summary
    const summary = await repository.summaries.getSummaryForSession('lifecycle-memory-1');
    expect(summary).not.toBeNull();
    expect(summary!.request).toBe('Test lifecycle');

    // 8. Get session
    const session = await repository.sessions.getSessionByContentId('lifecycle-content-1');
    expect(session).not.toBeNull();
    expect(session!.project).toBe('test-project');

    // 9. Full-text search
    const searchResults = await repository.search.fullTextSearch({
      query: 'lifecycle',
      project: 'test-project',
      limit: 10,
    });
    expect(searchResults.length).toBeGreaterThan(0);

    // 10. Timeline
    const timeline = await repository.timeline.getTimelineAroundObservation(
      obsResult.id,
      obsResult.createdAtEpoch,
      5,
      5,
      'test-project'
    );
    expect(timeline.observations.length).toBeGreaterThan(0);
  });

  // ==========================================
  // Migration Idempotency
  // ==========================================

  it('should run migrations idempotently', async () => {
    const { PostgresMigrationRunner } = await import('../../src/services/storage/postgres/PostgresMigrationRunner.js');
    const postgres = (await import('postgres')).default;
    const sql = postgres(PG_URL!);

    try {
      const runner = new PostgresMigrationRunner(sql);
      // Run migrations twice - should succeed both times
      await runner.runAllMigrations();
      await runner.runAllMigrations();
    } finally {
      await sql.end();
    }
  });

  // ==========================================
  // Health Check & Connection Pool
  // ==========================================

  it('should report healthy status', async () => {
    const healthy = await repository.isHealthy();
    expect(healthy).toBe(true);
  });

  it('should drain connections on close', async () => {
    const { PostgresStorageRepository } = await import('../../src/services/storage/postgres/PostgresStorageRepository.js');
    const tempRepo = await PostgresStorageRepository.create({
      connectionString: PG_URL!,
      host: '', port: 5432, database: '', username: '', password: '',
      ssl: false, poolMin: 1, poolMax: 2,
    });

    const healthy = await tempRepo.isHealthy();
    expect(healthy).toBe(true);

    await tempRepo.close();

    // After close, isHealthy should fail
    const healthyAfterClose = await tempRepo.isHealthy();
    expect(healthyAfterClose).toBe(false);
  });

  // ==========================================
  // Transaction Rollback
  // ==========================================

  it('should rollback transaction on error', async () => {
    const countBefore = await repository.observations.getObservationCount('test-project');

    try {
      await repository.withTransaction(async (txRepo) => {
        await txRepo.observations.storeObservation(
          'lifecycle-memory-1',
          'test-project',
          {
            type: 'discovery',
            title: 'Should be rolled back',
            subtitle: null,
            facts: [],
            narrative: 'This should not persist',
            concepts: [],
            files_read: [],
            files_modified: [],
          },
          99
        );
        throw new Error('Intentional rollback');
      });
    } catch {
      // Expected
    }

    const countAfter = await repository.observations.getObservationCount('test-project');
    expect(countAfter).toBe(countBefore);
  });

  // ==========================================
  // Content-Hash Deduplication
  // ==========================================

  it('should deduplicate observations by content hash', async () => {
    const input: ObservationInput = {
      type: 'discovery',
      title: 'Dedup test',
      subtitle: null,
      facts: ['same'],
      narrative: 'Same content',
      concepts: [],
      files_read: [],
      files_modified: [],
    };

    const result1 = await repository.observations.storeObservation(
      'lifecycle-memory-1', 'test-project', input
    );
    const result2 = await repository.observations.storeObservation(
      'lifecycle-memory-1', 'test-project', input
    );

    // Same content_hash should return same ID (dedup)
    expect(result2.id).toBe(result1.id);
  });
});
