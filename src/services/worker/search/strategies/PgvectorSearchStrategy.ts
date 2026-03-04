/**
 * PgvectorSearchStrategy - Hybrid vector + full-text search for PostgreSQL
 *
 * Combines pgvector cosine distance with tsvector ranking using
 * Reciprocal Rank Fusion (RRF) for optimal hybrid search results.
 * Falls back to FTS-only when embedding generation fails.
 */

import { BaseSearchStrategy } from './SearchStrategy.js';
import type {
  StrategySearchOptions,
  StrategySearchResult,
  ObservationSearchResult,
  SessionSummarySearchResult,
  UserPromptSearchResult,
} from '../types.js';
import { SEARCH_CONSTANTS } from '../types.js';
import type { IEmbeddingProvider } from '../../../storage/embedding/IEmbeddingProvider.js';
import type { IStorageRepository } from '../../../storage/interfaces.js';
import { logger } from '../../../../utils/logger.js';

// RRF constant (k=60 is standard)
const RRF_K = 60;

export class PgvectorSearchStrategy extends BaseSearchStrategy {
  readonly name = 'pgvector';
  private readonly repository: IStorageRepository;
  private readonly embeddingProvider: IEmbeddingProvider;

  constructor(repository: IStorageRepository, embeddingProvider: IEmbeddingProvider) {
    super();
    this.repository = repository;
    this.embeddingProvider = embeddingProvider;
  }

  canHandle(options: StrategySearchOptions): boolean {
    // Handle all queries when PostgreSQL provider is active
    return this.repository.providerName === 'postgresql';
  }

  async search(options: StrategySearchOptions): Promise<StrategySearchResult> {
    const {
      query,
      project,
      limit = SEARCH_CONSTANTS.DEFAULT_LIMIT,
      searchType = 'all',
    } = options;

    if (!query) {
      // No query text - delegate to filter search via repository
      return this.filterSearch(options);
    }

    // Generate query embedding vector
    let queryVector: number[] | null = null;
    try {
      queryVector = await this.embeddingProvider.generateEmbedding(query);
    } catch (err) {
      logger.error('EMBEDDING', 'Query embedding generation failed, falling back to FTS', {}, err as Error);
    }

    const observations: ObservationSearchResult[] = [];
    const sessions: SessionSummarySearchResult[] = [];
    const prompts: UserPromptSearchResult[] = [];

    // Search each category based on searchType
    if (searchType === 'all' || searchType === 'observations') {
      const obsResults = await this.repository.search.fullTextSearch({
        query,
        project,
        limit,
        tables: ['observations'],
      });

      if (queryVector) {
        const vectorResults = await this.repository.search.vectorSearch({
          queryVector,
          project,
          limit,
          tables: ['observations'],
        });

        // RRF merge: combine FTS and vector results
        const merged = this.rrfMerge(
          obsResults.map((h, i) => ({ id: h.id, rank: i + 1 })),
          vectorResults.map((h, i) => ({ id: h.id, rank: i + 1 }))
        );

        // Hydrate observation rows from merged IDs
        const ids = merged.slice(0, limit).map(m => m.id);
        if (ids.length > 0) {
          const rows = await this.repository.observations.getObservationsByIds(ids, {
            project,
          });
          for (const row of rows) {
            const mergedEntry = merged.find(m => m.id === row.id);
            observations.push({
              ...row,
              score: mergedEntry?.score ?? 0,
            } as ObservationSearchResult);
          }
          // Sort by score descending
          observations.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        }
      } else {
        // FTS only - hydrate from hit IDs
        const ids = obsResults.slice(0, limit).map(h => h.id);
        if (ids.length > 0) {
          const rows = await this.repository.observations.getObservationsByIds(ids, {
            project,
          });
          for (const row of rows) {
            const hit = obsResults.find(h => h.id === row.id);
            observations.push({
              ...row,
              score: hit?.score ?? 0,
            } as ObservationSearchResult);
          }
          observations.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        }
      }
    }

    if (searchType === 'all' || searchType === 'sessions') {
      const sessionLimit = Math.ceil(limit / 3);
      const ftsResults = await this.repository.search.fullTextSearch({
        query,
        project,
        limit: sessionLimit,
        tables: ['summaries'],
      });

      if (queryVector) {
        const vectorResults = await this.repository.search.vectorSearch({
          queryVector,
          project,
          limit: sessionLimit,
          tables: ['summaries'],
        });

        const merged = this.rrfMerge(
          ftsResults.map((h, i) => ({ id: h.id, rank: i + 1 })),
          vectorResults.map((h, i) => ({ id: h.id, rank: i + 1 }))
        );

        const ids = merged.slice(0, sessionLimit).map(m => m.id);
        if (ids.length > 0) {
          const rows = await this.repository.summaries.getSummariesByIds(ids, { project });
          for (const row of rows) {
            const mergedEntry = merged.find(m => m.id === row.id);
            sessions.push({
              ...row,
              score: mergedEntry?.score ?? 0,
            } as SessionSummarySearchResult);
          }
          sessions.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        }
      } else {
        const ids = ftsResults.slice(0, sessionLimit).map(h => h.id);
        if (ids.length > 0) {
          const rows = await this.repository.summaries.getSummariesByIds(ids, { project });
          for (const row of rows) {
            const hit = ftsResults.find(h => h.id === row.id);
            sessions.push({
              ...row,
              score: hit?.score ?? 0,
            } as SessionSummarySearchResult);
          }
          sessions.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        }
      }
    }

    if (searchType === 'all' || searchType === 'prompts') {
      const promptLimit = Math.ceil(limit / 5);
      const ftsResults = await this.repository.search.fullTextSearch({
        query,
        project,
        limit: promptLimit,
        tables: ['prompts'],
      });

      if (queryVector) {
        const vectorResults = await this.repository.search.vectorSearch({
          queryVector,
          project,
          limit: promptLimit,
          tables: ['prompts'],
        });

        const merged = this.rrfMerge(
          ftsResults.map((h, i) => ({ id: h.id, rank: i + 1 })),
          vectorResults.map((h, i) => ({ id: h.id, rank: i + 1 }))
        );

        const ids = merged.slice(0, promptLimit).map(m => m.id);
        if (ids.length > 0) {
          const rows = await this.repository.prompts.getPromptsByIds(ids, { project });
          for (const row of rows) {
            const mergedEntry = merged.find(m => m.id === row.id);
            prompts.push({
              ...row,
              score: mergedEntry?.score ?? 0,
            } as UserPromptSearchResult);
          }
          prompts.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        }
      } else {
        const ids = ftsResults.slice(0, promptLimit).map(h => h.id);
        if (ids.length > 0) {
          const rows = await this.repository.prompts.getPromptsByIds(ids, { project });
          for (const row of rows) {
            const hit = ftsResults.find(h => h.id === row.id);
            prompts.push({
              ...row,
              score: hit?.score ?? 0,
            } as UserPromptSearchResult);
          }
          prompts.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        }
      }
    }

    return {
      results: { observations, sessions, prompts },
      usedChroma: false,
      fellBack: queryVector === null,
      strategy: 'pgvector',
    };
  }

  /**
   * Reciprocal Rank Fusion merges two ranked lists.
   * score = 1/(k+rank_fts) + 1/(k+rank_vector)
   */
  private rrfMerge(
    ftsRanked: Array<{ id: number; rank: number }>,
    vectorRanked: Array<{ id: number; rank: number }>
  ): Array<{ id: number; score: number }> {
    const scores = new Map<number, number>();

    for (const { id, rank } of ftsRanked) {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + rank));
    }
    for (const { id, rank } of vectorRanked) {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + rank));
    }

    return Array.from(scores.entries())
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Handle filter-only queries (no text search).
   */
  private async filterSearch(options: StrategySearchOptions): Promise<StrategySearchResult> {
    const {
      project,
      obsType,
      concepts,
      files,
      dateRange,
      limit = SEARCH_CONSTANTS.DEFAULT_LIMIT,
      offset = 0,
      searchType = 'all',
      orderBy = 'date_desc',
    } = options;

    const filterResult = await this.repository.search.filterSearch({
      project,
      types: obsType ? (Array.isArray(obsType) ? obsType : [obsType]) : undefined,
      concepts: concepts ? (Array.isArray(concepts) ? concepts : [concepts]) : undefined,
      files: files ? (Array.isArray(files) ? files : [files]) : undefined,
      dateRange: dateRange ? { start: dateRange.start as number, end: dateRange.end as number } : undefined,
      limit,
      offset,
      orderBy: orderBy === 'relevance' ? 'date_desc' : orderBy,
      searchType,
    });

    return {
      results: {
        observations: filterResult.observations as ObservationSearchResult[],
        sessions: filterResult.sessions as SessionSummarySearchResult[],
        prompts: filterResult.prompts as UserPromptSearchResult[],
      },
      usedChroma: false,
      fellBack: false,
      strategy: 'pgvector',
    };
  }
}
