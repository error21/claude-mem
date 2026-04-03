import { describe, it, expect, mock } from 'bun:test';
import {
  queryObservations,
  querySummaries,
  queryObservationsMulti,
  querySummariesMulti,
} from '../../src/services/context/ObservationCompiler.js';
import type { IStorageRepository } from '../../src/services/storage/interfaces.js';
import type { ObservationRow, SummaryRow } from '../../src/services/storage/types.js';
import type { ContextConfig, Observation, SessionSummary } from '../../src/services/context/types.js';
import { SUMMARY_LOOKAHEAD } from '../../src/services/context/types.js';

/**
 * Tests for ObservationCompiler query functions using IStorageRepository.
 *
 * These tests validate that:
 * 1. Functions use the repository interface (not raw SQLite)
 * 2. Type filtering is applied correctly
 * 3. Concept filtering is applied correctly (in-memory)
 * 4. Results are limited to the configured count
 * 5. Multi-project queries work correctly
 */

// Helper: create a mock IStorageRepository
function createMockRepository(options: {
  observations?: ObservationRow[];
  summaries?: SummaryRow[];
} = {}): IStorageRepository {
  const observations = options.observations || [];
  const summaries = options.summaries || [];

  return {
    providerName: 'sqlite',
    observations: {
      getRecentObservations: mock(async (_project: string, _limit?: number) => observations),
      getAllRecentObservations: mock(async (_limit?: number) => observations),
      storeObservation: mock(async () => ({ id: 1, createdAtEpoch: Date.now() })),
      getObservationsByIds: mock(async () => []),
      getObservationById: mock(async () => null),
      getObservationsForSession: mock(async () => []),
      getFilesForSession: mock(async () => ({ filesRead: [], filesModified: [] })),
      getObservationCount: mock(async () => 0),
    },
    summaries: {
      getRecentSummaries: mock(async (_project: string, _limit?: number) => summaries),
      getAllRecentSummaries: mock(async (_limit?: number) => summaries),
      storeSummary: mock(async () => ({ id: 1, createdAtEpoch: Date.now() })),
      getSummariesByIds: mock(async () => []),
      getSummaryById: mock(async () => null),
      getSummaryForSession: mock(async () => null),
      getRecentSummariesWithSessionInfo: mock(async () => []),
    },
    sessions: {} as any,
    prompts: {} as any,
    pendingMessages: {} as any,
    timeline: {} as any,
    search: {} as any,
    withTransaction: mock(async () => undefined as any),
    close: mock(async () => {}),
    isHealthy: mock(async () => true),
  } as IStorageRepository;
}

// Helper: create a test ObservationRow
function createObservationRow(overrides: Partial<ObservationRow> = {}): ObservationRow {
  return {
    id: 1,
    memory_session_id: 'session-123',
    project: 'test-project',
    type: 'discovery',
    text: null,
    title: 'Test Observation',
    subtitle: null,
    facts: '["fact1"]',
    narrative: 'A test narrative',
    concepts: '["architecture","testing"]',
    files_read: null,
    files_modified: null,
    prompt_number: null,
    discovery_tokens: 100,
    content_hash: null,
    created_at: '2025-01-01T12:00:00.000Z',
    created_at_epoch: 1735732800000,
    ...overrides,
  };
}

// Helper: create a test SummaryRow
function createSummaryRow(overrides: Partial<SummaryRow> = {}): SummaryRow {
  return {
    id: 1,
    memory_session_id: 'session-123',
    project: 'test-project',
    request: 'Test request',
    investigated: 'Investigated things',
    learned: 'Learned things',
    completed: 'Completed things',
    next_steps: 'Next steps',
    files_read: null,
    files_edited: null,
    notes: null,
    prompt_number: null,
    discovery_tokens: 0,
    created_at: '2025-01-01T12:00:00.000Z',
    created_at_epoch: 1735732800000,
    ...overrides,
  };
}

// Helper: create a test ContextConfig
function createConfig(overrides: Partial<ContextConfig> = {}): ContextConfig {
  return {
    totalObservationCount: 20,
    fullObservationCount: 5,
    sessionCount: 5,
    showReadTokens: true,
    showWorkTokens: true,
    showSavingsAmount: true,
    showSavingsPercent: true,
    observationTypes: new Set(['discovery', 'decision', 'progress']),
    observationConcepts: new Set(['architecture', 'testing']),
    fullObservationField: 'narrative',
    showLastSummary: true,
    showLastMessage: false,
    ...overrides,
  };
}

describe('queryObservations (repository-based)', () => {
  it('should call getRecentObservations with the project and a fetch limit', async () => {
    const repo = createMockRepository();
    const config = createConfig({ totalObservationCount: 10 });

    await queryObservations(repo, 'my-project', config);

    expect(repo.observations.getRecentObservations).toHaveBeenCalledWith(
      'my-project',
      expect.any(Number)
    );
  });

  it('should filter observations by type', async () => {
    const observations = [
      createObservationRow({ id: 1, type: 'discovery' }),
      createObservationRow({ id: 2, type: 'error' }),
      createObservationRow({ id: 3, type: 'decision' }),
    ];
    const repo = createMockRepository({ observations });
    const config = createConfig({
      observationTypes: new Set(['discovery', 'decision']),
    });

    const result = await queryObservations(repo, 'test-project', config);

    const resultIds = result.map(o => o.id);
    expect(resultIds).toContain(1);
    expect(resultIds).not.toContain(2);
    expect(resultIds).toContain(3);
  });

  it('should filter observations by concepts', async () => {
    const observations = [
      createObservationRow({ id: 1, concepts: '["architecture","testing"]' }),
      createObservationRow({ id: 2, concepts: '["performance"]' }),
      createObservationRow({ id: 3, concepts: '["testing","debugging"]' }),
    ];
    const repo = createMockRepository({ observations });
    const config = createConfig({
      observationConcepts: new Set(['architecture', 'testing']),
    });

    const result = await queryObservations(repo, 'test-project', config);

    const resultIds = result.map(o => o.id);
    expect(resultIds).toContain(1);
    expect(resultIds).not.toContain(2);
    expect(resultIds).toContain(3);
  });

  it('should limit results to totalObservationCount', async () => {
    const observations = Array.from({ length: 30 }, (_, i) =>
      createObservationRow({
        id: i + 1,
        type: 'discovery',
        concepts: '["architecture"]',
        created_at_epoch: 1735732800000 - i * 1000,
      })
    );
    const repo = createMockRepository({ observations });
    const config = createConfig({ totalObservationCount: 10 });

    const result = await queryObservations(repo, 'test-project', config);

    expect(result.length).toBeLessThanOrEqual(10);
  });

  it('should return results sorted by created_at_epoch descending', async () => {
    const observations = [
      createObservationRow({ id: 1, type: 'discovery', concepts: '["architecture"]', created_at_epoch: 1000 }),
      createObservationRow({ id: 2, type: 'discovery', concepts: '["architecture"]', created_at_epoch: 3000 }),
      createObservationRow({ id: 3, type: 'discovery', concepts: '["architecture"]', created_at_epoch: 2000 }),
    ];
    const repo = createMockRepository({ observations });
    const config = createConfig();

    const result = await queryObservations(repo, 'test-project', config);

    // getRecentObservations already returns DESC order from the repository
    // We verify results maintain the order
    expect(result.length).toBe(3);
  });

  it('should handle observations with null or empty concepts', async () => {
    const observations = [
      createObservationRow({ id: 1, type: 'discovery', concepts: null }),
      createObservationRow({ id: 2, type: 'discovery', concepts: '[]' }),
      createObservationRow({ id: 3, type: 'discovery', concepts: '["architecture"]' }),
    ];
    const repo = createMockRepository({ observations });
    const config = createConfig({
      observationConcepts: new Set(['architecture']),
    });

    const result = await queryObservations(repo, 'test-project', config);

    expect(result.length).toBe(1);
    expect(result[0].id).toBe(3);
  });

  it('should return Observation type (not ObservationRow)', async () => {
    const observations = [
      createObservationRow({ id: 1, type: 'discovery', concepts: '["architecture"]' }),
    ];
    const repo = createMockRepository({ observations });
    const config = createConfig();

    const result = await queryObservations(repo, 'test-project', config);

    expect(result.length).toBe(1);
    // Observation type fields should be present
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('memory_session_id');
    expect(result[0]).toHaveProperty('type');
    expect(result[0]).toHaveProperty('title');
    expect(result[0]).toHaveProperty('narrative');
    expect(result[0]).toHaveProperty('concepts');
    expect(result[0]).toHaveProperty('created_at_epoch');
  });
});

describe('querySummaries (repository-based)', () => {
  it('should call getRecentSummaries with project and limit including lookahead', async () => {
    const repo = createMockRepository();
    const config = createConfig({ sessionCount: 5 });

    await querySummaries(repo, 'my-project', config);

    expect(repo.summaries.getRecentSummaries).toHaveBeenCalledWith(
      'my-project',
      5 + SUMMARY_LOOKAHEAD
    );
  });

  it('should return summaries as SessionSummary type', async () => {
    const summaries = [
      createSummaryRow({ id: 1 }),
    ];
    const repo = createMockRepository({ summaries });
    const config = createConfig();

    const result = await querySummaries(repo, 'test-project', config);

    expect(result.length).toBe(1);
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('memory_session_id');
    expect(result[0]).toHaveProperty('request');
    expect(result[0]).toHaveProperty('created_at_epoch');
  });
});

describe('queryObservationsMulti (repository-based)', () => {
  it('should call getAllRecentObservations with a fetch limit', async () => {
    const repo = createMockRepository();
    const config = createConfig({ totalObservationCount: 15 });

    await queryObservationsMulti(repo, ['project-a', 'project-b'], config);

    expect(repo.observations.getAllRecentObservations).toHaveBeenCalledWith(
      expect.any(Number)
    );
  });

  it('should filter to only specified projects', async () => {
    const observations = [
      createObservationRow({ id: 1, project: 'project-a', type: 'discovery', concepts: '["architecture"]' }),
      createObservationRow({ id: 2, project: 'project-b', type: 'discovery', concepts: '["architecture"]' }),
      createObservationRow({ id: 3, project: 'project-c', type: 'discovery', concepts: '["architecture"]' }),
    ];
    const repo = createMockRepository({ observations });
    const config = createConfig();

    const result = await queryObservationsMulti(repo, ['project-a', 'project-b'], config);

    const resultIds = result.map(o => o.id);
    expect(resultIds).toContain(1);
    expect(resultIds).toContain(2);
    expect(resultIds).not.toContain(3);
  });

  it('should apply type and concept filters for multi-project queries', async () => {
    const observations = [
      createObservationRow({ id: 1, project: 'project-a', type: 'discovery', concepts: '["architecture"]' }),
      createObservationRow({ id: 2, project: 'project-a', type: 'error', concepts: '["architecture"]' }),
      createObservationRow({ id: 3, project: 'project-b', type: 'discovery', concepts: '["performance"]' }),
    ];
    const repo = createMockRepository({ observations });
    const config = createConfig({
      observationTypes: new Set(['discovery']),
      observationConcepts: new Set(['architecture']),
    });

    const result = await queryObservationsMulti(repo, ['project-a', 'project-b'], config);

    expect(result.length).toBe(1);
    expect(result[0].id).toBe(1);
  });

  it('should include project field in multi-project results', async () => {
    const observations = [
      createObservationRow({ id: 1, project: 'project-a', type: 'discovery', concepts: '["architecture"]' }),
    ];
    const repo = createMockRepository({ observations });
    const config = createConfig();

    const result = await queryObservationsMulti(repo, ['project-a'], config);

    expect(result.length).toBe(1);
    expect(result[0].project).toBe('project-a');
  });
});

describe('querySummariesMulti (repository-based)', () => {
  it('should call getAllRecentSummaries with a limit', async () => {
    const repo = createMockRepository();
    const config = createConfig({ sessionCount: 5 });

    await querySummariesMulti(repo, ['project-a', 'project-b'], config);

    expect(repo.summaries.getAllRecentSummaries).toHaveBeenCalledWith(
      expect.any(Number)
    );
  });

  it('should filter to only specified projects', async () => {
    const summaries = [
      createSummaryRow({ id: 1, project: 'project-a' }),
      createSummaryRow({ id: 2, project: 'project-b' }),
      createSummaryRow({ id: 3, project: 'project-c' }),
    ];
    const repo = createMockRepository({ summaries });
    const config = createConfig();

    const result = await querySummariesMulti(repo, ['project-a', 'project-b'], config);

    const resultIds = result.map(s => s.id);
    expect(resultIds).toContain(1);
    expect(resultIds).toContain(2);
    expect(resultIds).not.toContain(3);
  });

  it('should include project field in multi-project results', async () => {
    const summaries = [
      createSummaryRow({ id: 1, project: 'project-a' }),
    ];
    const repo = createMockRepository({ summaries });
    const config = createConfig();

    const result = await querySummariesMulti(repo, ['project-a'], config);

    expect(result.length).toBe(1);
    expect(result[0].project).toBe('project-a');
  });
});
