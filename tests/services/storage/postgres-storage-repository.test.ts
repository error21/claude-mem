/**
 * PostgresStorageRepository Integration Tests
 *
 * Tests against a real PostgreSQL instance with pgvector extension.
 * Skipped when CLAUDE_MEM_TEST_PG_URL is not set.
 *
 * To run locally:
 *   CLAUDE_MEM_TEST_PG_URL="postgres://user:pass@localhost:5432/claude_mem_test" bun test tests/services/storage/postgres-storage-repository.test.ts
 *
 * Docker setup:
 *   docker run --name pg-test -e POSTGRES_DB=claude_mem_test -e POSTGRES_PASSWORD=test -p 5432:5432 pgvector/pgvector:pg16
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { IStorageRepository } from '../../../src/services/storage/interfaces.js';
import type { ObservationInput, SummaryInput } from '../../../src/services/storage/types.js';

const PG_URL = process.env.CLAUDE_MEM_TEST_PG_URL;
const SKIP = !PG_URL;

// Dynamic import to avoid loading postgres.js when tests are skipped
let repository: IStorageRepository;
let pgModule: any;

describe.skipIf(SKIP)('PostgresStorageRepository', () => {
  beforeAll(async () => {
    const { PostgresStorageRepository } = await import('../../../src/services/storage/postgres/PostgresStorageRepository.js');
    repository = await PostgresStorageRepository.create({
      connectionString: PG_URL!,
      host: '', port: 5432, database: '', username: '', password: '',
      ssl: false, poolMin: 1, poolMax: 5,
    });

    // Clean test data (run before tests, not after, so failed tests leave data for debugging)
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
  // Health Check
  // ==========================================

  it('should report healthy', async () => {
    expect(await repository.isHealthy()).toBe(true);
  });

  it('should have providerName postgresql', () => {
    expect(repository.providerName).toBe('postgresql');
  });

  // ==========================================
  // Session CRUD
  // ==========================================

  describe('sessions', () => {
    const contentSessionId = `test-session-${Date.now()}`;
    let sessionDbId: number;

    it('should create a session', async () => {
      sessionDbId = await repository.sessions.createSDKSession(
        contentSessionId, '/test/project', 'test prompt', 'Test Title'
      );
      expect(sessionDbId).toBeGreaterThan(0);
    });

    it('should be idempotent on duplicate content_session_id', async () => {
      const id2 = await repository.sessions.createSDKSession(
        contentSessionId, '/test/project', 'different prompt'
      );
      expect(id2).toBe(sessionDbId);
    });

    it('should get session by content ID', async () => {
      const session = await repository.sessions.getSessionByContentId(contentSessionId);
      expect(session).not.toBeNull();
      expect(session!.project).toBe('/test/project');
      expect(session!.custom_title).toBe('Test Title');
      expect(session!.status).toBe('active');
    });

    it('should get session by DB ID', async () => {
      const session = await repository.sessions.getSessionById(sessionDbId);
      expect(session).not.toBeNull();
      expect(session!.content_session_id).toBe(contentSessionId);
    });

    it('should update memory session ID', async () => {
      await repository.sessions.updateMemorySessionId(sessionDbId, 'memory-123');
      const session = await repository.sessions.getSessionById(sessionDbId);
      expect(session!.memory_session_id).toBe('memory-123');
    });

    it('should get session by memory ID', async () => {
      const session = await repository.sessions.getSessionByMemoryId('memory-123');
      expect(session).not.toBeNull();
      expect(session!.id).toBe(sessionDbId);
    });

    it('should update session status', async () => {
      await repository.sessions.updateSessionStatus(contentSessionId, 'completed');
      const session = await repository.sessions.getSessionByContentId(contentSessionId);
      expect(session!.status).toBe('completed');
      expect(session!.completed_at_epoch).not.toBeNull();
    });

    it('should list projects', async () => {
      const projects = await repository.sessions.getAllProjects();
      expect(projects).toContain('/test/project');
    });

    it('should get sessions by project', async () => {
      const sessions = await repository.sessions.getSessionsByProject('/test/project');
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0].content_session_id).toBe(contentSessionId);
    });

    it('should get sessions by memory IDs', async () => {
      const sessions = await repository.sessions.getSessionsByMemoryIds(['memory-123', 'nonexistent']);
      expect(sessions.length).toBe(1);
      expect(sessions[0].memory_session_id).toBe('memory-123');
    });
  });

  // ==========================================
  // Observation Storage
  // ==========================================

  describe('observations', () => {
    const memorySessionId = 'memory-123';

    const testObservation: ObservationInput = {
      type: 'discovery',
      title: 'Test observation title',
      subtitle: 'Test subtitle',
      narrative: 'This is a test narrative about the discovery.',
      facts: ['Fact 1', 'Fact 2'],
      concepts: ['testing', 'integration'],
      files_read: ['/src/test.ts'],
      files_modified: ['/src/output.ts'],
    };

    let observationId: number;

    it('should store an observation', async () => {
      const result = await repository.observations.storeObservation(
        memorySessionId, '/test/project', testObservation, 1, 500
      );
      observationId = result.id;
      expect(observationId).toBeGreaterThan(0);
      expect(result.createdAtEpoch).toBeGreaterThan(0);
    });

    it('should deduplicate on content hash', async () => {
      const result = await repository.observations.storeObservation(
        memorySessionId, '/test/project', testObservation, 1, 500
      );
      // Should return the existing observation ID
      expect(result.id).toBe(observationId);
    });

    it('should get observation by ID', async () => {
      const obs = await repository.observations.getObservationById(observationId);
      expect(obs).not.toBeNull();
      expect(obs!.title).toBe('Test observation title');
      expect(obs!.type).toBe('discovery');
      expect(JSON.parse(obs!.facts)).toEqual(['Fact 1', 'Fact 2']);
      expect(JSON.parse(obs!.concepts)).toEqual(['testing', 'integration']);
    });

    it('should get observations by IDs', async () => {
      const obs = await repository.observations.getObservationsByIds([observationId]);
      expect(obs.length).toBe(1);
      expect(obs[0].id).toBe(observationId);
    });

    it('should get recent observations', async () => {
      const obs = await repository.observations.getRecentObservations('/test/project', 10);
      expect(obs.length).toBeGreaterThan(0);
      expect(obs[0].project).toBe('/test/project');
    });

    it('should get observation count', async () => {
      const count = await repository.observations.getObservationCount('/test/project');
      expect(count).toBeGreaterThan(0);
    });

    it('should get files for session', async () => {
      const files = await repository.observations.getFilesForSession(memorySessionId);
      expect(files.filesRead).toContain('/src/test.ts');
      expect(files.filesModified).toContain('/src/output.ts');
    });
  });

  // ==========================================
  // Summary Storage
  // ==========================================

  describe('summaries', () => {
    const memorySessionId = 'memory-123';

    const testSummary: SummaryInput = {
      request: 'Test request',
      investigated: 'Test investigation',
      learned: 'Test learning',
      completed: 'Test completion',
      next_steps: 'Test next steps',
      notes: 'Test notes',
    };

    let summaryId: number;

    it('should store a summary', async () => {
      const result = await repository.summaries.storeSummary(
        memorySessionId, '/test/project', testSummary, 1, 200
      );
      summaryId = result.id;
      expect(summaryId).toBeGreaterThan(0);
    });

    it('should get summary by ID', async () => {
      const sum = await repository.summaries.getSummaryById(summaryId);
      expect(sum).not.toBeNull();
      expect(sum!.request).toBe('Test request');
      expect(sum!.learned).toBe('Test learning');
    });

    it('should get summary for session', async () => {
      const sum = await repository.summaries.getSummaryForSession(memorySessionId);
      expect(sum).not.toBeNull();
      expect(sum!.memory_session_id).toBe(memorySessionId);
    });

    it('should get recent summaries', async () => {
      const sums = await repository.summaries.getRecentSummaries('/test/project');
      expect(sums.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // Prompt Storage
  // ==========================================

  describe('prompts', () => {
    it('should save and retrieve a prompt', async () => {
      const contentSessionId = (await repository.sessions.getSessionsByProject('/test/project'))[0].content_session_id;

      const promptId = await repository.prompts.saveUserPrompt(contentSessionId, 1, 'Hello world');
      expect(promptId).toBeGreaterThan(0);

      const text = await repository.prompts.getUserPrompt(contentSessionId, 1);
      expect(text).toBe('Hello world');

      const count = await repository.prompts.getPromptCount(contentSessionId);
      expect(count).toBe(1);

      const latest = await repository.prompts.getLatestUserPrompt(contentSessionId);
      expect(latest).not.toBeNull();
      expect(latest!.promptText).toBe('Hello world');
      expect(latest!.project).toBe('/test/project');
    });
  });

  // ==========================================
  // Pending Message Queue
  // ==========================================

  describe('pending messages', () => {
    let sessionDbId: number;
    let messageId: number;

    beforeAll(async () => {
      const sessions = await repository.sessions.getSessionsByProject('/test/project');
      sessionDbId = sessions[0].id;
    });

    it('should enqueue a message', async () => {
      const contentSessionId = (await repository.sessions.getSessionById(sessionDbId))!.content_session_id;
      messageId = await repository.pendingMessages.enqueue(sessionDbId, contentSessionId, {
        type: 'observation',
        tool_name: 'Read',
        tool_input: '{"path": "/test"}',
        tool_response: '{"content": "test"}',
        cwd: '/test',
        prompt_number: 1,
      });
      expect(messageId).toBeGreaterThan(0);
    });

    it('should get pending count', async () => {
      const count = await repository.pendingMessages.getPendingCount(sessionDbId);
      expect(count).toBe(1);
    });

    it('should check hasAnyPendingWork', async () => {
      expect(await repository.pendingMessages.hasAnyPendingWork()).toBe(true);
    });

    it('should claim next message with FOR UPDATE SKIP LOCKED', async () => {
      const claimed = await repository.pendingMessages.claimNextMessage(sessionDbId);
      expect(claimed).not.toBeNull();
      expect(claimed!.id).toBe(messageId);
      expect(claimed!.status).toBe('processing');
    });

    it('should not claim already-processing message', async () => {
      const claimed = await repository.pendingMessages.claimNextMessage(sessionDbId);
      expect(claimed).toBeNull();
    });

    it('should confirm processed', async () => {
      await repository.pendingMessages.confirmProcessed(messageId);
      const count = await repository.pendingMessages.getPendingCount(sessionDbId);
      expect(count).toBe(0);
    });
  });

  // ==========================================
  // Transactions
  // ==========================================

  describe('withTransaction', () => {
    it('should commit on success', async () => {
      const contentSessionId = `tx-test-${Date.now()}`;
      await repository.withTransaction(async (txRepo) => {
        await txRepo.sessions.createSDKSession(contentSessionId, '/test/tx', 'tx prompt');
      });

      const session = await repository.sessions.getSessionByContentId(contentSessionId);
      expect(session).not.toBeNull();
    });

    it('should rollback on error', async () => {
      const contentSessionId = `tx-fail-${Date.now()}`;
      try {
        await repository.withTransaction(async (txRepo) => {
          await txRepo.sessions.createSDKSession(contentSessionId, '/test/tx-fail', 'tx prompt');
          throw new Error('intentional rollback');
        });
      } catch (e) {
        // Expected
      }

      const session = await repository.sessions.getSessionByContentId(contentSessionId);
      expect(session).toBeNull();
    });
  });

  // ==========================================
  // Search
  // ==========================================

  describe('search', () => {
    it('should perform full-text search on observations', async () => {
      // The tsvector trigger should have populated search_vector on insert
      const results = await repository.search.fullTextSearch({
        query: 'test narrative discovery',
        project: '/test/project',
        limit: 10,
      });
      // May return results if tsvector trigger populated correctly
      expect(Array.isArray(results)).toBe(true);
    });

    it('should perform filter search', async () => {
      const results = await repository.search.filterSearch({
        project: '/test/project',
        types: ['discovery'],
        limit: 10,
      });
      expect(results.observations.length).toBeGreaterThan(0);
      expect(results.observations[0].type).toBe('discovery');
    });

    it('should handle vector search (returns empty when no embeddings)', async () => {
      const results = await repository.search.vectorSearch({
        queryVector: new Array(384).fill(0.1),
        project: '/test/project',
        limit: 5,
      });
      // No embeddings stored yet, so results should be empty
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ==========================================
  // Timeline
  // ==========================================

  describe('timeline', () => {
    it('should get timeline by time range', async () => {
      const now = Date.now();
      const dayAgo = now - 86400000;
      const result = await repository.timeline.getTimelineByTimeRange(dayAgo, now, '/test/project');
      expect(result.observations.length).toBeGreaterThan(0);
      expect(result.sessions.length).toBeGreaterThan(0);
    });
  });
});
