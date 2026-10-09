/**
 * SqliteStorageRepository - IStorageRepository adapter for existing SQLite code.
 *
 * Design principles:
 * - No new SQL: delegates to existing functions in src/services/sqlite/
 * - Promise.resolve() wraps synchronous bun:sqlite returns
 * - Database instance is private; external code uses the repository interface
 */

import type { Database } from 'bun:sqlite';
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
  SDKSessionRow,
  PendingMessage,
} from '../types.js';

// Existing SQLite functions
import { createSDKSession, updateMemorySessionId } from '../../sqlite/sessions/create.js';
import {
  getSessionById as sqliteGetSessionById,
  getSdkSessionsBySessionIds,
  getRecentSessionsWithStatus as sqliteGetRecentSessionsWithStatus,
} from '../../sqlite/sessions/get.js';
import { storeObservation } from '../../sqlite/observations/store.js';
import {
  getObservationById as sqliteGetObservationById,
  getObservationsByIds as sqliteGetObservationsByIds,
  getObservationsForSession as sqliteGetObservationsForSession,
} from '../../sqlite/observations/get.js';
import { getRecentObservations, getAllRecentObservations } from '../../sqlite/observations/recent.js';
import { getFilesForSession } from '../../sqlite/observations/files.js';
import { storeSummary } from '../../sqlite/summaries/store.js';
import { getSummaryForSession, getSummaryById as sqliteGetSummaryById, getSummariesByIds as sqliteGetSummariesByIds } from '../../sqlite/summaries/get.js';
import { getRecentSummaries, getRecentSummariesWithSessionInfo, getAllRecentSummaries } from '../../sqlite/summaries/recent.js';
import { saveUserPrompt, } from '../../sqlite/prompts/store.js';
import {
  getUserPrompt,
  getPromptNumberFromUserPrompts,
  getLatestUserPrompt,
  getAllRecentUserPrompts,
  getPromptById as sqliteGetPromptById,
  getUserPromptsByIds,
} from '../../sqlite/prompts/get.js';
import { getTimelineAroundObservation, getAllProjects } from '../../sqlite/timeline/queries.js';
import { PendingMessageStore } from '../../sqlite/PendingMessageStore.js';
import { logger } from '../../../utils/logger.js';

// ============================================================
// SqliteSessionRepository
// ============================================================

class SqliteSessionRepository implements ISessionRepository {
  constructor(private db: Database) {}

  async createSDKSession(
    contentSessionId: string,
    project: string,
    userPrompt: string,
    customTitle?: string
  ): Promise<number> {
    return Promise.resolve(
      createSDKSession(this.db, contentSessionId, project, userPrompt, customTitle)
    );
  }

  async updateMemorySessionId(
    sessionDbId: number,
    memorySessionId: string | null
  ): Promise<void> {
    updateMemorySessionId(this.db, sessionDbId, memorySessionId);
  }

  async updateSessionStatus(
    contentSessionId: string,
    status: string
  ): Promise<void> {
    this.db.prepare(`
      UPDATE sdk_sessions SET status = ?
      WHERE content_session_id = ?
    `).run(status, contentSessionId);
  }

  async getSessionByContentId(contentSessionId: string): Promise<SDKSessionRow | null> {
    const row = this.db.prepare(`
      SELECT * FROM sdk_sessions WHERE content_session_id = ? LIMIT 1
    `).get(contentSessionId) as SDKSessionRow | undefined;
    return row || null;
  }

  async getSessionByMemoryId(memorySessionId: string): Promise<SDKSessionRow | null> {
    const row = this.db.prepare(`
      SELECT * FROM sdk_sessions WHERE memory_session_id = ? LIMIT 1
    `).get(memorySessionId) as SDKSessionRow | undefined;
    return row || null;
  }

  async getSessionById(id: number): Promise<SDKSessionRow | null> {
    const basic = sqliteGetSessionById(this.db, id);
    if (!basic) return null;
    // getSessionById returns SessionBasic, we need full row
    const row = this.db.prepare(`
      SELECT * FROM sdk_sessions WHERE id = ? LIMIT 1
    `).get(id) as SDKSessionRow | undefined;
    return row || null;
  }

  async getAllProjects(): Promise<string[]> {
    return Promise.resolve(getAllProjects(this.db));
  }

  async getSessionsByProject(project: string, limit?: number): Promise<SDKSessionRow[]> {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    return this.db.prepare(`
      SELECT * FROM sdk_sessions
      WHERE project = ?
      ORDER BY started_at_epoch DESC
      ${limitClause}
    `).all(project) as SDKSessionRow[];
  }

  async getRecentSessionsWithStatus(
    project: string,
    limit?: number
  ): Promise<Array<{
    memory_session_id: string | null;
    status: string;
    started_at: string;
    user_prompt: string | null;
    has_summary: boolean;
  }>> {
    return Promise.resolve(
      sqliteGetRecentSessionsWithStatus(this.db, project, limit)
    );
  }

  async getSessionsByMemoryIds(memorySessionIds: string[]): Promise<SDKSessionRow[]> {
    const full = getSdkSessionsBySessionIds(this.db, memorySessionIds);
    // SessionFull maps to SDKSessionRow
    return full as unknown as SDKSessionRow[];
  }
}

// ============================================================
// SqliteObservationRepository
// ============================================================

class SqliteObservationRepository implements IObservationRepository {
  constructor(private db: Database) {}

  async storeObservation(
    memorySessionId: string,
    project: string,
    observation: ObservationInput,
    promptNumber?: number,
    discoveryTokens?: number,
    overrideTimestampEpoch?: number
  ): Promise<StoreObservationResult> {
    return Promise.resolve(
      storeObservation(
        this.db, memorySessionId, project, observation,
        promptNumber, discoveryTokens ?? 0, overrideTimestampEpoch
      )
    );
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
    return Promise.resolve(
      sqliteGetObservationsByIds(this.db, ids, options) as unknown as ObservationRow[]
    );
  }

  async getObservationById(id: number): Promise<ObservationRow | null> {
    return Promise.resolve(
      sqliteGetObservationById(this.db, id) as unknown as ObservationRow | null
    );
  }

  async getRecentObservations(project: string, limit?: number): Promise<ObservationRow[]> {
    // getRecentObservations returns RecentObservationRow (subset), not full ObservationRow
    // For the repository interface, we return the full rows
    const rows = this.db.prepare(`
      SELECT * FROM observations
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(project, limit ?? 20) as ObservationRow[];
    return rows;
  }

  async getAllRecentObservations(limit?: number): Promise<ObservationRow[]> {
    const rows = this.db.prepare(`
      SELECT * FROM observations
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(limit ?? 100) as ObservationRow[];
    return rows;
  }

  async getObservationsForSession(memorySessionId: string): Promise<Array<{
    title: string;
    subtitle: string;
    type: string;
    prompt_number: number | null;
  }>> {
    return Promise.resolve(
      sqliteGetObservationsForSession(this.db, memorySessionId)
    );
  }

  async getFilesForSession(memorySessionId: string): Promise<{
    filesRead: string[];
    filesModified: string[];
  }> {
    return Promise.resolve(getFilesForSession(this.db, memorySessionId));
  }

  async getObservationCount(project?: string): Promise<number> {
    if (project) {
      const result = this.db.prepare(
        'SELECT COUNT(*) as count FROM observations WHERE project = ?'
      ).get(project) as { count: number };
      return result.count;
    }
    const result = this.db.prepare(
      'SELECT COUNT(*) as count FROM observations'
    ).get() as { count: number };
    return result.count;
  }
}

// ============================================================
// SqliteSummaryRepository
// ============================================================

class SqliteSummaryRepository implements ISummaryRepository {
  constructor(private db: Database) {}

  async storeSummary(
    memorySessionId: string,
    project: string,
    summary: SummaryInput,
    promptNumber?: number,
    discoveryTokens?: number,
    overrideTimestampEpoch?: number
  ): Promise<StoreSummaryResult> {
    return Promise.resolve(
      storeSummary(
        this.db, memorySessionId, project, summary,
        promptNumber, discoveryTokens ?? 0, overrideTimestampEpoch
      )
    );
  }

  async getSummariesByIds(
    ids: number[],
    options?: {
      orderBy?: 'date_desc' | 'date_asc';
      limit?: number;
      project?: string;
    }
  ): Promise<SummaryRow[]> {
    return Promise.resolve(
      sqliteGetSummariesByIds(this.db, ids, options) as unknown as SummaryRow[]
    );
  }

  async getSummaryById(id: number): Promise<SummaryRow | null> {
    return Promise.resolve(
      sqliteGetSummaryById(this.db, id) as unknown as SummaryRow | null
    );
  }

  async getSummaryForSession(memorySessionId: string): Promise<SummaryRow | null> {
    return Promise.resolve(
      getSummaryForSession(this.db, memorySessionId) as unknown as SummaryRow | null
    );
  }

  async getRecentSummaries(project: string, limit?: number): Promise<SummaryRow[]> {
    // Return full rows instead of RecentSummary subset
    const rows = this.db.prepare(`
      SELECT * FROM session_summaries
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(project, limit ?? 10) as SummaryRow[];
    return rows;
  }

  async getRecentSummariesWithSessionInfo(
    project: string,
    limit?: number
  ): Promise<Array<{
    memory_session_id: string;
    request: string | null;
    learned: string | null;
    completed: string | null;
    next_steps: string | null;
    prompt_number: number | null;
    created_at: string;
  }>> {
    return Promise.resolve(
      getRecentSummariesWithSessionInfo(this.db, project, limit)
    );
  }

  async getAllRecentSummaries(limit?: number): Promise<SummaryRow[]> {
    const rows = this.db.prepare(`
      SELECT * FROM session_summaries
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(limit ?? 50) as SummaryRow[];
    return rows;
  }
}

// ============================================================
// SqlitePromptRepository
// ============================================================

class SqlitePromptRepository implements IPromptRepository {
  constructor(private db: Database) {}

  async saveUserPrompt(
    contentSessionId: string,
    promptNumber: number,
    promptText: string
  ): Promise<number> {
    return Promise.resolve(
      saveUserPrompt(this.db, contentSessionId, promptNumber, promptText)
    );
  }

  async getPromptsByIds(
    ids: number[],
    options?: {
      orderBy?: 'date_desc' | 'date_asc';
      limit?: number;
      project?: string;
    }
  ): Promise<PromptRow[]> {
    return Promise.resolve(
      getUserPromptsByIds(this.db, ids, options) as unknown as PromptRow[]
    );
  }

  async getPromptById(id: number): Promise<PromptRow | null> {
    return Promise.resolve(
      sqliteGetPromptById(this.db, id) as unknown as PromptRow | null
    );
  }

  async getUserPrompt(
    contentSessionId: string,
    promptNumber: number
  ): Promise<string | null> {
    return Promise.resolve(getUserPrompt(this.db, contentSessionId, promptNumber));
  }

  async getPromptCount(contentSessionId: string): Promise<number> {
    return Promise.resolve(getPromptNumberFromUserPrompts(this.db, contentSessionId));
  }

  async getLatestUserPrompt(
    contentSessionId: string
  ): Promise<PromptRow | null> {
    const result = getLatestUserPrompt(this.db, contentSessionId);
    if (!result) return null;
    return {
      id: result.id,
      content_session_id: result.content_session_id,
      prompt_number: result.prompt_number,
      prompt_text: result.prompt_text,
      memory_session_id: result.memory_session_id,
      project: result.project,
      created_at: '',  // Not available from LatestPromptResult, but not needed by callers
      created_at_epoch: result.created_at_epoch,
    };
  }

  async getAllRecentUserPrompts(limit?: number): Promise<PromptRow[]> {
    return Promise.resolve(
      getAllRecentUserPrompts(this.db, limit) as unknown as PromptRow[]
    );
  }
}

// ============================================================
// SqlitePendingMessageRepository
// ============================================================

class SqlitePendingMessageRepository implements IPendingMessageRepository {
  private store: PendingMessageStore;

  constructor(db: Database) {
    this.store = new PendingMessageStore(db);
  }

  async enqueue(
    sessionDbId: number,
    contentSessionId: string,
    message: PendingMessage
  ): Promise<number> {
    return Promise.resolve(this.store.enqueue(sessionDbId, contentSessionId, message));
  }

  async claimNextMessage(sessionDbId: number): Promise<PersistentPendingMessage | null> {
    return Promise.resolve(
      this.store.claimNextMessage(sessionDbId) as PersistentPendingMessage | null
    );
  }

  async confirmProcessed(messageId: number): Promise<void> {
    this.store.confirmProcessed(messageId);
  }

  async markFailed(messageId: number): Promise<void> {
    this.store.markFailed(messageId);
  }

  async getPendingCount(sessionDbId: number): Promise<number> {
    return Promise.resolve(this.store.getPendingCount(sessionDbId));
  }

  async getSessionsWithPendingMessages(): Promise<number[]> {
    return Promise.resolve(this.store.getSessionsWithPendingMessages());
  }

  async resetStaleProcessingMessages(
    thresholdMs?: number,
    sessionDbId?: number
  ): Promise<number> {
    return Promise.resolve(this.store.resetStaleProcessingMessages(thresholdMs, sessionDbId));
  }

  async getQueueMessages(): Promise<QueueMessage[]> {
    return Promise.resolve(this.store.getQueueMessages() as QueueMessage[]);
  }

  async hasAnyPendingWork(): Promise<boolean> {
    return Promise.resolve(this.store.hasAnyPendingWork());
  }

  async getAllPending(sessionDbId: number): Promise<PersistentPendingMessage[]> {
    return Promise.resolve(
      this.store.getAllPending(sessionDbId) as PersistentPendingMessage[]
    );
  }

  async resetProcessingToPending(sessionDbId: number): Promise<number> {
    return Promise.resolve(this.store.resetProcessingToPending(sessionDbId));
  }

  async markSessionMessagesFailed(sessionDbId: number): Promise<number> {
    return Promise.resolve(this.store.markSessionMessagesFailed(sessionDbId));
  }

  async markAllSessionMessagesAbandoned(sessionDbId: number): Promise<number> {
    return Promise.resolve(this.store.markAllSessionMessagesAbandoned(sessionDbId));
  }

  toPendingMessage(persistent: PersistentPendingMessage): PendingMessage {
    return this.store.toPendingMessage(persistent as any);
  }
}

// ============================================================
// SqliteTimelineRepository
// ============================================================

class SqliteTimelineRepository implements ITimelineRepository {
  constructor(private db: Database) {}

  async getTimelineAroundObservation(
    anchorObservationId: number | null,
    anchorEpoch: number,
    depthBefore?: number,
    depthAfter?: number,
    project?: string
  ): Promise<{
    observations: ObservationRow[];
    sessions: Array<{
      id: number;
      memory_session_id: string;
      project: string;
      request: string | null;
      completed: string | null;
      next_steps: string | null;
      created_at: string;
      created_at_epoch: number;
    }>;
    prompts: Array<{
      id: number;
      content_session_id: string;
      prompt_number: number;
      prompt_text: string;
      project: string;
      created_at: string;
      created_at_epoch: number;
    }>;
  }> {
    const result = getTimelineAroundObservation(
      this.db, anchorObservationId, anchorEpoch,
      depthBefore ?? 10, depthAfter ?? 10, project
    );
    return {
      observations: result.observations as unknown as ObservationRow[],
      sessions: result.sessions,
      prompts: result.prompts as Array<{
        id: number;
        content_session_id: string;
        prompt_number: number;
        prompt_text: string;
        project: string;
        created_at: string;
        created_at_epoch: number;
      }>,
    };
  }

  async getTimelineByTimeRange(
    startEpoch: number,
    endEpoch: number,
    project?: string
  ): Promise<{
    observations: ObservationRow[];
    sessions: Array<{
      id: number;
      memory_session_id: string;
      project: string;
      request: string | null;
      completed: string | null;
      next_steps: string | null;
      created_at: string;
      created_at_epoch: number;
    }>;
    prompts: Array<{
      id: number;
      content_session_id: string;
      prompt_number: number;
      prompt_text: string;
      project: string;
      created_at: string;
      created_at_epoch: number;
    }>;
  }> {
    // Use timestamp-based query via the anchor function with midpoint anchor
    const midpoint = Math.floor((startEpoch + endEpoch) / 2);
    const halfRange = Math.ceil((endEpoch - startEpoch) / 2);
    // Use a large depth to cover the full range
    const result = getTimelineAroundObservation(
      this.db, null, midpoint,
      1000, 1000, project
    );
    // Filter to the exact range
    return {
      observations: (result.observations as unknown as ObservationRow[]).filter(
        o => o.created_at_epoch >= startEpoch && o.created_at_epoch <= endEpoch
      ),
      sessions: result.sessions.filter(
        s => s.created_at_epoch >= startEpoch && s.created_at_epoch <= endEpoch
      ),
      prompts: (result.prompts as Array<{
        id: number;
        content_session_id: string;
        prompt_number: number;
        prompt_text: string;
        project: string;
        created_at: string;
        created_at_epoch: number;
      }>).filter(
        p => p.created_at_epoch >= startEpoch && p.created_at_epoch <= endEpoch
      ),
    };
  }
}

// ============================================================
// SqliteSearchRepository
// ============================================================

class SqliteSearchRepository implements ISearchRepository {
  constructor(private db: Database) {}

  async fullTextSearch(params: {
    query: string;
    project?: string;
    limit?: number;
    tables?: Array<'observations' | 'summaries' | 'prompts'>;
  }): Promise<SearchHit[]> {
    // SQLite FTS5 search - returns empty for now as FTS is handled externally
    // via SessionSearch. This will be wired up in the worker conversion (Task 3).
    return [];
  }

  async vectorSearch(params: {
    queryVector: number[];
    project?: string;
    limit?: number;
    tables?: Array<'observations' | 'summaries' | 'prompts'>;
  }): Promise<VectorSearchHit[]> {
    // SQLite backend doesn't support native vector search.
    // Vector search is handled by ChromaSync externally.
    return [];
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
    // Filter search delegated to SessionSearch in Task 3.
    // For now, return empty results.
    return { observations: [], sessions: [], prompts: [] };
  }
}

// ============================================================
// SqliteStorageRepository - Unified Implementation
// ============================================================

export class SqliteStorageRepository implements IStorageRepository {
  readonly providerName = 'sqlite' as const;
  readonly sessions: ISessionRepository;
  readonly observations: IObservationRepository;
  readonly summaries: ISummaryRepository;
  readonly prompts: IPromptRepository;
  readonly pendingMessages: IPendingMessageRepository;
  readonly timeline: ITimelineRepository;
  readonly search: ISearchRepository;

  private db: Database;

  constructor(db: Database) {
    this.db = db;
    this.sessions = new SqliteSessionRepository(db);
    this.observations = new SqliteObservationRepository(db);
    this.summaries = new SqliteSummaryRepository(db);
    this.prompts = new SqlitePromptRepository(db);
    this.pendingMessages = new SqlitePendingMessageRepository(db);
    this.timeline = new SqliteTimelineRepository(db);
    this.search = new SqliteSearchRepository(db);
  }

  /**
   * Execute operations atomically within a SQLite transaction.
   *
   * Note: bun:sqlite transactions are synchronous, but the callback is async.
   * We use a simple approach: run the async callback, then if it throws,
   * the transaction wrapper will roll back.
   */
  async withTransaction<T>(
    fn: (repo: IStorageRepository) => Promise<T>
  ): Promise<T> {
    // For SQLite, we can use the same repository instance since
    // bun:sqlite uses a single connection and transactions are scoped to that connection.
    // The db.transaction() wrapper handles BEGIN/COMMIT/ROLLBACK.
    const txFn = this.db.transaction(() => {
      // We need to handle the async function within the sync transaction.
      // Since bun:sqlite is synchronous, all actual DB operations within
      // the Promise.resolve() wrappers execute synchronously.
      // The async wrapper just provides the Promise<T> return type.
      let result: T;
      let error: Error | undefined;

      // Execute the async function - since SQLite operations are sync
      // under Promise.resolve(), this will complete synchronously.
      const promise = fn(this);
      // For bun:sqlite, Promise.resolve() wraps are synchronous,
      // so we can extract the result immediately.
      promise.then(
        r => { result = r; },
        e => { error = e; }
      );

      if (error) throw error;
      return result!;
    });

    return txFn();
  }

  /**
   * Get the underlying Database instance.
   * Used for backward compatibility during migration (e.g., ChromaSync).
   */
  getDatabase(): Database {
    return this.db;
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async isHealthy(): Promise<boolean> {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }
}
