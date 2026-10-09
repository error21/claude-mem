/**
 * Storage abstraction interfaces for claude-mem.
 *
 * Defines the repository pattern used to abstract storage backends.
 * All methods return Promise<T> to support both synchronous SQLite
 * (via Promise.resolve() wrapping) and asynchronous PostgreSQL.
 *
 * Domain-specific sub-interfaces compose into the unified IStorageRepository.
 */

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
  TimelineEntry,
  PendingMessage,
} from './types.js';

// ============================================================
// ISessionRepository - Session CRUD operations
// ============================================================

export interface ISessionRepository {
  /**
   * Create an SDK session (idempotent: existing content_session_id is ignored).
   * @returns Session database ID
   */
  createSDKSession(
    contentSessionId: string,
    project: string,
    userPrompt: string,
    customTitle?: string
  ): Promise<number>;

  /**
   * Update the memory_session_id for a session.
   */
  updateMemorySessionId(
    sessionDbId: number,
    memorySessionId: string | null
  ): Promise<void>;

  /**
   * Update session status (active/completed/failed).
   */
  updateSessionStatus(
    contentSessionId: string,
    status: string
  ): Promise<void>;

  /**
   * Get session by content_session_id.
   */
  getSessionByContentId(contentSessionId: string): Promise<SDKSessionRow | null>;

  /**
   * Get session by memory_session_id.
   */
  getSessionByMemoryId(memorySessionId: string): Promise<SDKSessionRow | null>;

  /**
   * Get session by database ID.
   */
  getSessionById(id: number): Promise<SDKSessionRow | null>;

  /**
   * Get all distinct project names.
   */
  getAllProjects(): Promise<string[]>;

  /**
   * Get sessions for a project.
   */
  getSessionsByProject(project: string, limit?: number): Promise<SDKSessionRow[]>;

  /**
   * Get recent sessions with summary status for a project.
   */
  getRecentSessionsWithStatus(
    project: string,
    limit?: number
  ): Promise<Array<{
    memory_session_id: string | null;
    status: string;
    started_at: string;
    user_prompt: string | null;
    has_summary: boolean;
  }>>;

  /**
   * Get sessions by multiple memory_session_ids.
   */
  getSessionsByMemoryIds(memorySessionIds: string[]): Promise<SDKSessionRow[]>;
}

// ============================================================
// IObservationRepository - Observation storage and retrieval
// ============================================================

export interface IObservationRepository {
  /**
   * Store an observation with content-hash deduplication.
   * @returns Store result with ID and creation timestamp
   */
  storeObservation(
    memorySessionId: string,
    project: string,
    observation: ObservationInput,
    promptNumber?: number,
    discoveryTokens?: number,
    overrideTimestampEpoch?: number
  ): Promise<StoreObservationResult>;

  /**
   * Get observations by ID array.
   */
  getObservationsByIds(
    ids: number[],
    options?: {
      orderBy?: 'date_desc' | 'date_asc';
      limit?: number;
      project?: string;
      type?: string | string[];
      concepts?: string | string[];
      files?: string | string[];
    }
  ): Promise<ObservationRow[]>;

  /**
   * Get single observation by ID.
   */
  getObservationById(id: number): Promise<ObservationRow | null>;

  /**
   * Get recent observations for a project.
   */
  getRecentObservations(project: string, limit?: number): Promise<ObservationRow[]>;

  /**
   * Get all recent observations across projects.
   */
  getAllRecentObservations(limit?: number): Promise<ObservationRow[]>;

  /**
   * Get observations for a specific session.
   */
  getObservationsForSession(memorySessionId: string): Promise<Array<{
    title: string;
    subtitle: string;
    type: string;
    prompt_number: number | null;
  }>>;

  /**
   * Get files read/modified for a session.
   */
  getFilesForSession(memorySessionId: string): Promise<{
    filesRead: string[];
    filesModified: string[];
  }>;

  /**
   * Get observation count, optionally filtered by project.
   */
  getObservationCount(project?: string): Promise<number>;
}

// ============================================================
// ISummaryRepository - Summary storage and retrieval
// ============================================================

export interface ISummaryRepository {
  /**
   * Store a session summary.
   * @returns Store result with ID and creation timestamp
   */
  storeSummary(
    memorySessionId: string,
    project: string,
    summary: SummaryInput,
    promptNumber?: number,
    discoveryTokens?: number,
    overrideTimestampEpoch?: number
  ): Promise<StoreSummaryResult>;

  /**
   * Get summaries by ID array.
   */
  getSummariesByIds(
    ids: number[],
    options?: {
      orderBy?: 'date_desc' | 'date_asc';
      limit?: number;
      project?: string;
    }
  ): Promise<SummaryRow[]>;

  /**
   * Get single summary by ID.
   */
  getSummaryById(id: number): Promise<SummaryRow | null>;

  /**
   * Get the most recent summary for a session.
   */
  getSummaryForSession(memorySessionId: string): Promise<SummaryRow | null>;

  /**
   * Get recent summaries for a project.
   */
  getRecentSummaries(project: string, limit?: number): Promise<SummaryRow[]>;

  /**
   * Get recent summaries with session info for context display.
   */
  getRecentSummariesWithSessionInfo(
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
  }>>;

  /**
   * Get all recent summaries across projects.
   */
  getAllRecentSummaries(limit?: number): Promise<SummaryRow[]>;
}

// ============================================================
// IPromptRepository - User prompt storage and retrieval
// ============================================================

export interface IPromptRepository {
  /**
   * Save a user prompt.
   * @returns Database row ID
   */
  saveUserPrompt(
    contentSessionId: string,
    promptNumber: number,
    promptText: string
  ): Promise<number>;

  /**
   * Get prompts by ID array.
   */
  getPromptsByIds(
    ids: number[],
    options?: {
      orderBy?: 'date_desc' | 'date_asc';
      limit?: number;
      project?: string;
    }
  ): Promise<PromptRow[]>;

  /**
   * Get single prompt by ID.
   */
  getPromptById(id: number): Promise<PromptRow | null>;

  /**
   * Get a specific prompt by session and prompt number.
   */
  getUserPrompt(
    contentSessionId: string,
    promptNumber: number
  ): Promise<string | null>;

  /**
   * Get prompt count for a session.
   */
  getPromptCount(contentSessionId: string): Promise<number>;

  /**
   * Get latest prompt for a session (with session metadata).
   * Returns full PromptRow for Chroma sync and SSE broadcast.
   */
  getLatestUserPrompt(
    contentSessionId: string
  ): Promise<PromptRow | null>;

  /**
   * Get all recent prompts across projects.
   */
  getAllRecentUserPrompts(limit?: number): Promise<PromptRow[]>;
}

// ============================================================
// IPendingMessageRepository - Work queue operations
// ============================================================

export interface IPendingMessageRepository {
  /**
   * Enqueue a message for processing.
   * @returns Database row ID
   */
  enqueue(
    sessionDbId: number,
    contentSessionId: string,
    message: PendingMessage
  ): Promise<number>;

  /**
   * Atomically claim the next pending message for a session.
   * PostgreSQL: SELECT ... FOR UPDATE SKIP LOCKED
   * SQLite: Transaction-based UPDATE
   */
  claimNextMessage(sessionDbId: number): Promise<PersistentPendingMessage | null>;

  /**
   * Confirm processing complete and remove from queue.
   */
  confirmProcessed(messageId: number): Promise<void>;

  /**
   * Mark a message as failed.
   */
  markFailed(messageId: number): Promise<void>;

  /**
   * Get pending message count for a session.
   */
  getPendingCount(sessionDbId: number): Promise<number>;

  /**
   * Get session IDs that have pending messages.
   */
  getSessionsWithPendingMessages(): Promise<number[]>;

  /**
   * Reset stale processing messages back to pending.
   * @returns Number of messages reset
   */
  resetStaleProcessingMessages(
    thresholdMs?: number,
    sessionDbId?: number
  ): Promise<number>;

  /**
   * Get all queue messages with project info (for UI display).
   */
  getQueueMessages(): Promise<QueueMessage[]>;

  /**
   * Check if any pending or processing work exists.
   */
  hasAnyPendingWork(): Promise<boolean>;

  /**
   * Get all pending messages for a session.
   */
  getAllPending(sessionDbId: number): Promise<PersistentPendingMessage[]>;

  /**
   * Reset all processing messages to pending for a session.
   * @returns Number of messages reset
   */
  resetProcessingToPending(sessionDbId: number): Promise<number>;

  /**
   * Mark all messages for a session as failed.
   * @returns Number of messages marked
   */
  markSessionMessagesFailed(sessionDbId: number): Promise<number>;

  /**
   * Mark all messages for a session as abandoned.
   * @returns Number of messages marked
   */
  markAllSessionMessagesAbandoned(sessionDbId: number): Promise<number>;

  /**
   * Convert a PersistentPendingMessage to a PendingMessage.
   */
  toPendingMessage(persistent: PersistentPendingMessage): PendingMessage;
}

// ============================================================
// ITimelineRepository - Timeline data retrieval
// ============================================================

export interface ITimelineRepository {
  /**
   * Get timeline data anchored around an observation ID.
   */
  getTimelineAroundObservation(
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
  }>;

  /**
   * Get timeline data by time range.
   */
  getTimelineByTimeRange(
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
  }>;
}

// ============================================================
// ISearchRepository - Search operations
// ============================================================

export interface ISearchRepository {
  /**
   * Full-text search.
   * SQLite: FTS5 MATCH
   * PostgreSQL: tsvector @@ ts_query
   */
  fullTextSearch(params: {
    query: string;
    project?: string;
    limit?: number;
    tables?: Array<'observations' | 'summaries' | 'prompts'>;
  }): Promise<SearchHit[]>;

  /**
   * Vector similarity search.
   * SQLite: Returns empty (vector search handled by ChromaSync externally)
   * PostgreSQL: pgvector <=> cosine distance
   */
  vectorSearch(params: {
    queryVector: number[];
    project?: string;
    limit?: number;
    tables?: Array<'observations' | 'summaries' | 'prompts'>;
  }): Promise<VectorSearchHit[]>;

  /**
   * Filter-based search (metadata queries: type, concepts, date range).
   */
  filterSearch(params: {
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
  }>;
}

// ============================================================
// IStorageRepository - Unified interface
// ============================================================

export interface IStorageRepository {
  readonly sessions: ISessionRepository;
  readonly observations: IObservationRepository;
  readonly summaries: ISummaryRepository;
  readonly prompts: IPromptRepository;
  readonly pendingMessages: IPendingMessageRepository;
  readonly timeline: ITimelineRepository;
  readonly search: ISearchRepository;

  /**
   * Execute operations atomically within a transaction.
   * SQLite: db.transaction()
   * PostgreSQL: sql.begin()
   *
   * The callback receives a transactional repository instance.
   * All sub-repository operations within the callback use the same transaction.
   */
  withTransaction<T>(
    fn: (repo: IStorageRepository) => Promise<T>
  ): Promise<T>;

  /**
   * Storage backend identifier.
   */
  readonly providerName: 'sqlite' | 'postgresql';

  /**
   * Clean up resources and close connections.
   */
  close(): Promise<void>;

  /**
   * Health check - verify the storage backend is responsive.
   */
  isHealthy(): Promise<boolean>;
}
