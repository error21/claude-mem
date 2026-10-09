/**
 * PaginationHelper: DRY pagination utility
 *
 * Responsibility:
 * - DRY helper for paginated queries
 * - Eliminates copy-paste across observations/summaries/prompts endpoints
 * - Efficient LIMIT+1 trick to avoid COUNT(*) query
 * - Supports both SQLite and PostgreSQL via IStorageRepository
 */

import { DatabaseManager } from './DatabaseManager.js';
import { logger } from '../../utils/logger.js';
import type { PaginatedResult, Observation, Summary, UserPrompt } from '../worker-types.js';

export class PaginationHelper {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * Strip project path from file paths using heuristic
   * Converts "/Users/user/project/src/file.ts" -> "src/file.ts"
   * Uses first occurrence of project name from left (project root)
   */
  private stripProjectPath(filePath: string, projectName: string): string {
    const marker = `/${projectName}/`;
    const index = filePath.indexOf(marker);

    if (index !== -1) {
      // Strip everything before and including the project name
      return filePath.substring(index + marker.length);
    }

    // Fallback: return original path if project name not found
    return filePath;
  }

  /**
   * Strip project path from JSON array of file paths
   */
  private stripProjectPaths(filePathsStr: string | null, projectName: string): string | null {
    if (!filePathsStr) return filePathsStr;

    try {
      // Parse JSON array
      const paths = JSON.parse(filePathsStr) as string[];

      // Strip project path from each file
      const strippedPaths = paths.map(p => this.stripProjectPath(p, projectName));

      // Return as JSON string
      return JSON.stringify(strippedPaths);
    } catch (err) {
      logger.debug('WORKER', 'File paths is plain string, using as-is', {}, err as Error);
      return filePathsStr;
    }
  }

  /**
   * Sanitize observation by stripping project paths from files
   */
  private sanitizeObservation(obs: Observation): Observation {
    return {
      ...obs,
      files_read: this.stripProjectPaths(obs.files_read, obs.project),
      files_modified: this.stripProjectPaths(obs.files_modified, obs.project)
    };
  }

  /**
   * Get paginated observations
   */
  async getObservations(offset: number, limit: number, project?: string): Promise<PaginatedResult<Observation>> {
    const repo = this.dbManager.getRepository();

    // Fetch limit+1 to check hasMore
    const fetchLimit = limit + 1;
    let results: any[];

    if (project) {
      results = await repo.observations.getRecentObservations(project, fetchLimit);
    } else {
      results = await repo.observations.getAllRecentObservations(fetchLimit);
    }

    // Apply offset manually (repository methods don't support offset natively)
    // For large offsets this is suboptimal but works for both providers
    if (offset > 0) {
      // For SQLite, fall back to raw SQL pagination if available
      if (repo.providerName === 'sqlite') {
        try {
          const sqlResult = this.paginateSqlite<Observation>(
            'observations',
            'id, memory_session_id, project, type, title, subtitle, narrative, text, facts, concepts, files_read, files_modified, prompt_number, created_at, created_at_epoch',
            offset,
            limit,
            project
          );
          return {
            ...sqlResult,
            items: sqlResult.items.map(obs => this.sanitizeObservation(obs))
          };
        } catch {
          // Fallback to repository approach
        }
      }

      // For PostgreSQL or fallback: fetch enough to cover offset+limit
      const allResults = project
        ? await repo.observations.getRecentObservations(project, offset + fetchLimit)
        : await repo.observations.getAllRecentObservations(offset + fetchLimit);
      results = allResults.slice(offset, offset + fetchLimit);
    }

    const items = results.slice(0, limit) as Observation[];
    return {
      items: items.map(obs => this.sanitizeObservation(obs)),
      hasMore: results.length > limit,
      offset,
      limit
    };
  }

  /**
   * Get paginated summaries
   */
  async getSummaries(offset: number, limit: number, project?: string): Promise<PaginatedResult<Summary>> {
    const repo = this.dbManager.getRepository();

    // For SQLite, use raw SQL for proper JOIN and pagination
    if (repo.providerName === 'sqlite') {
      try {
        return this.getSummariesSqlite(offset, limit, project);
      } catch {
        // Fallback to repository approach
      }
    }

    // For PostgreSQL: use repository methods
    const fetchLimit = limit + 1;
    let results: any[];

    if (project) {
      results = await repo.summaries.getRecentSummaries(project, offset + fetchLimit);
    } else {
      results = await repo.summaries.getAllRecentSummaries(offset + fetchLimit);
    }

    // Apply offset
    const sliced = results.slice(offset, offset + fetchLimit);

    return {
      items: sliced.slice(0, limit) as Summary[],
      hasMore: sliced.length > limit,
      offset,
      limit
    };
  }

  /**
   * Get paginated user prompts
   */
  async getPrompts(offset: number, limit: number, project?: string): Promise<PaginatedResult<UserPrompt>> {
    const repo = this.dbManager.getRepository();

    // For SQLite, use raw SQL for proper JOIN and pagination
    if (repo.providerName === 'sqlite') {
      try {
        return this.getPromptsSqlite(offset, limit, project);
      } catch {
        // Fallback to repository approach
      }
    }

    // For PostgreSQL: use repository methods
    const fetchLimit = limit + 1;
    const results = await repo.prompts.getAllRecentUserPrompts(offset + fetchLimit);

    // Apply offset and project filter
    let filtered = results;
    if (project) {
      filtered = results.filter(p => p.project === project);
    }
    const sliced = filtered.slice(offset, offset + fetchLimit);

    return {
      items: sliced.slice(0, limit) as unknown as UserPrompt[],
      hasMore: sliced.length > limit,
      offset,
      limit
    };
  }

  // ============================================================
  // SQLite-specific methods (use raw db.prepare for efficient pagination)
  // ============================================================

  /**
   * SQLite-specific paginated summaries with JOIN
   */
  private getSummariesSqlite(offset: number, limit: number, project?: string): PaginatedResult<Summary> {
    const db = this.dbManager.getSessionStore().db;

    let query = `
      SELECT
        ss.id,
        s.content_session_id as session_id,
        ss.request,
        ss.investigated,
        ss.learned,
        ss.completed,
        ss.next_steps,
        ss.project,
        ss.created_at,
        ss.created_at_epoch
      FROM session_summaries ss
      JOIN sdk_sessions s ON ss.memory_session_id = s.memory_session_id
    `;
    const params: any[] = [];

    if (project) {
      query += ' WHERE ss.project = ?';
      params.push(project);
    }

    query += ' ORDER BY ss.created_at_epoch DESC LIMIT ? OFFSET ?';
    params.push(limit + 1, offset);

    const stmt = db.prepare(query);
    const results = stmt.all(...params) as Summary[];

    return {
      items: results.slice(0, limit),
      hasMore: results.length > limit,
      offset,
      limit
    };
  }

  /**
   * SQLite-specific paginated user prompts with JOIN
   */
  private getPromptsSqlite(offset: number, limit: number, project?: string): PaginatedResult<UserPrompt> {
    const db = this.dbManager.getSessionStore().db;

    let query = `
      SELECT up.id, up.content_session_id, s.project, up.prompt_number, up.prompt_text, up.created_at, up.created_at_epoch
      FROM user_prompts up
      JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
    `;
    const params: any[] = [];

    if (project) {
      query += ' WHERE s.project = ?';
      params.push(project);
    }

    query += ' ORDER BY up.created_at_epoch DESC LIMIT ? OFFSET ?';
    params.push(limit + 1, offset);

    const stmt = db.prepare(query);
    const results = stmt.all(...params) as UserPrompt[];

    return {
      items: results.slice(0, limit),
      hasMore: results.length > limit,
      offset,
      limit
    };
  }

  /**
   * SQLite-specific generic pagination implementation (DRY)
   */
  private paginateSqlite<T>(
    table: string,
    columns: string,
    offset: number,
    limit: number,
    project?: string
  ): PaginatedResult<T> {
    const db = this.dbManager.getSessionStore().db;

    let query = `SELECT ${columns} FROM ${table}`;
    const params: any[] = [];

    if (project) {
      query += ' WHERE project = ?';
      params.push(project);
    }

    query += ' ORDER BY created_at_epoch DESC LIMIT ? OFFSET ?';
    params.push(limit + 1, offset); // Fetch one extra to check hasMore

    const stmt = db.prepare(query);
    const results = stmt.all(...params) as T[];

    return {
      items: results.slice(0, limit),
      hasMore: results.length > limit,
      offset,
      limit
    };
  }
}
