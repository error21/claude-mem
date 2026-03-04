/**
 * Storage abstraction layer for claude-mem.
 *
 * Provides a backend-agnostic repository interface that supports
 * both SQLite (default) and PostgreSQL storage backends.
 */

export type {
  // Interfaces
  IStorageRepository,
  ISessionRepository,
  IObservationRepository,
  ISummaryRepository,
  IPromptRepository,
  IPendingMessageRepository,
  ITimelineRepository,
  ISearchRepository,
} from './interfaces.js';

export type {
  // Row types
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
} from './types.js';

// SQLite implementation
export { SqliteStorageRepository } from './sqlite/SqliteStorageRepository.js';

// PostgreSQL implementation
export { PostgresStorageRepository } from './postgres/PostgresStorageRepository.js';
export { PostgresMigrationRunner } from './postgres/PostgresMigrationRunner.js';

// Factory
export { StorageProviderFactory } from './StorageProviderFactory.js';
export type { PostgresConnectionConfig } from './StorageProviderFactory.js';

// Embedding
export type { IEmbeddingProvider, EmbeddingProviderConfig } from './embedding/IEmbeddingProvider.js';
export { ApiEmbeddingProvider } from './embedding/ApiEmbeddingProvider.js';
export { LocalEmbeddingProvider } from './embedding/LocalEmbeddingProvider.js';
