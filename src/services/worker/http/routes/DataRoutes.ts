/**
 * Data Routes
 *
 * Handles data retrieval operations: observations, summaries, prompts, stats, processing status.
 * All endpoints use direct database access via service layer.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { readFileSync, statSync, existsSync } from 'fs';
import { logger } from '../../../../utils/logger.js';
import { homedir } from 'os';
import { getPackageRoot } from '../../../../shared/paths.js';
import { getWorkerPort } from '../../../../shared/worker-utils.js';
import { PaginationHelper } from '../../PaginationHelper.js';
import { DatabaseManager } from '../../DatabaseManager.js';
import { SessionManager } from '../../SessionManager.js';
import { SSEBroadcaster } from '../../SSEBroadcaster.js';
import type { WorkerService } from '../../../worker-service.js';
import { BaseRouteHandler } from '../BaseRouteHandler.js';

export class DataRoutes extends BaseRouteHandler {
  constructor(
    private paginationHelper: PaginationHelper,
    private dbManager: DatabaseManager,
    private sessionManager: SessionManager,
    private sseBroadcaster: SSEBroadcaster,
    private workerService: WorkerService,
    private startTime: number
  ) {
    super();
  }

  setupRoutes(app: express.Application): void {
    // Pagination endpoints
    app.get('/api/observations', this.handleGetObservations.bind(this));
    app.get('/api/summaries', this.handleGetSummaries.bind(this));
    app.get('/api/prompts', this.handleGetPrompts.bind(this));

    // Fetch by ID endpoints
    app.get('/api/observation/:id', this.handleGetObservationById.bind(this));
    app.post('/api/observations/batch', this.handleGetObservationsByIds.bind(this));
    app.get('/api/session/:id', this.handleGetSessionById.bind(this));
    app.post('/api/sdk-sessions/batch', this.handleGetSdkSessionsByIds.bind(this));
    app.get('/api/prompt/:id', this.handleGetPromptById.bind(this));

    // Metadata endpoints
    app.get('/api/stats', this.handleGetStats.bind(this));
    app.get('/api/projects', this.handleGetProjects.bind(this));

    // Processing status endpoints
    app.get('/api/processing-status', this.handleGetProcessingStatus.bind(this));
    app.post('/api/processing', this.handleSetProcessing.bind(this));

    // Pending queue management endpoints
    app.get('/api/pending-queue', this.handleGetPendingQueue.bind(this));
    app.post('/api/pending-queue/process', this.handleProcessPendingQueue.bind(this));
    app.delete('/api/pending-queue/failed', this.handleClearFailedQueue.bind(this));
    app.delete('/api/pending-queue/all', this.handleClearAllQueue.bind(this));

    // Import endpoint
    app.post('/api/import', this.handleImport.bind(this));

    // Migration status endpoint (embedding backfill progress)
    app.get('/api/migration/status', this.handleGetMigrationStatus.bind(this));
  }

  /**
   * Get paginated observations
   */
  private handleGetObservations = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const { offset, limit, project } = this.parsePaginationParams(req);
    const result = await this.paginationHelper.getObservations(offset, limit, project);
    res.json(result);
  });

  /**
   * Get paginated summaries
   */
  private handleGetSummaries = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const { offset, limit, project } = this.parsePaginationParams(req);
    const result = await this.paginationHelper.getSummaries(offset, limit, project);
    res.json(result);
  });

  /**
   * Get paginated user prompts
   */
  private handleGetPrompts = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const { offset, limit, project } = this.parsePaginationParams(req);
    const result = await this.paginationHelper.getPrompts(offset, limit, project);
    res.json(result);
  });

  /**
   * Get observation by ID
   * GET /api/observation/:id
   */
  private handleGetObservationById = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const id = this.parseIntParam(req, res, 'id');
    if (id === null) return;

    const repo = this.dbManager.getRepository();
    const observation = await repo.observations.getObservationById(id);

    if (!observation) {
      this.notFound(res, `Observation #${id} not found`);
      return;
    }

    res.json(observation);
  });

  /**
   * Get observations by array of IDs
   * POST /api/observations/batch
   * Body: { ids: number[], orderBy?: 'date_desc' | 'date_asc', limit?: number, project?: string }
   */
  private handleGetObservationsByIds = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    let { ids, orderBy, limit, project } = req.body;

    // Coerce string-encoded arrays from MCP clients (e.g. "[1,2,3]" or "1,2,3")
    if (typeof ids === 'string') {
      try { ids = JSON.parse(ids); } catch { ids = ids.split(',').map(Number); }
    }

    if (!ids || !Array.isArray(ids)) {
      this.badRequest(res, 'ids must be an array of numbers');
      return;
    }

    if (ids.length === 0) {
      res.json([]);
      return;
    }

    // Validate all IDs are numbers
    if (!ids.every(id => typeof id === 'number' && Number.isInteger(id))) {
      this.badRequest(res, 'All ids must be integers');
      return;
    }

    const repo = this.dbManager.getRepository();
    const observations = await repo.observations.getObservationsByIds(ids, { orderBy, limit, project });

    res.json(observations);
  });

  /**
   * Get session by ID
   * GET /api/session/:id
   */
  private handleGetSessionById = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const id = this.parseIntParam(req, res, 'id');
    if (id === null) return;

    const repo = this.dbManager.getRepository();
    const session = await repo.sessions.getSessionById(id);

    if (!session) {
      this.notFound(res, `Session #${id} not found`);
      return;
    }

    res.json(session);
  });

  /**
   * Get SDK sessions by SDK session IDs
   * POST /api/sdk-sessions/batch
   * Body: { memorySessionIds: string[] }
   */
  private handleGetSdkSessionsByIds = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    let { memorySessionIds } = req.body;

    // Coerce string-encoded arrays from MCP clients (e.g. '["a","b"]' or "a,b")
    if (typeof memorySessionIds === 'string') {
      try { memorySessionIds = JSON.parse(memorySessionIds); } catch { memorySessionIds = memorySessionIds.split(',').map((s: string) => s.trim()); }
    }

    if (!Array.isArray(memorySessionIds)) {
      this.badRequest(res, 'memorySessionIds must be an array');
      return;
    }

    const repo = this.dbManager.getRepository();
    const sessions = await repo.sessions.getSessionsByMemoryIds(memorySessionIds);
    res.json(sessions);
  });

  /**
   * Get user prompt by ID
   * GET /api/prompt/:id
   */
  private handleGetPromptById = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const id = this.parseIntParam(req, res, 'id');
    if (id === null) return;

    const repo = this.dbManager.getRepository();
    const prompt = await repo.prompts.getPromptById(id);

    if (!prompt) {
      this.notFound(res, `Prompt #${id} not found`);
      return;
    }

    res.json(prompt);
  });

  /**
   * Get database statistics (with worker metadata)
   */
  private handleGetStats = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const repo = this.dbManager.getRepository();

    // Read version from package.json
    const packageRoot = getPackageRoot();
    const packageJsonPath = path.join(packageRoot, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const version = packageJson.version;

    // Get database stats via repository
    const totalObservations = await repo.observations.getObservationCount();

    // For session/summary counts, use provider-appropriate approach
    let totalSessions = 0;
    let totalSummaries = 0;
    if (repo.providerName === 'sqlite') {
      // SQLite: use legacy SessionStore for counts not in repository interface
      try {
        const store = this.dbManager.getSessionStore();
        const db = store.db;
        totalSessions = (db.prepare('SELECT COUNT(*) as count FROM sdk_sessions').get() as { count: number }).count;
        totalSummaries = (db.prepare('SELECT COUNT(*) as count FROM session_summaries').get() as { count: number }).count;
      } catch {
        // Fallback: estimate from projects
        const projects = await repo.sessions.getAllProjects();
        totalSessions = projects.length; // Approximate
      }
    } else {
      // PostgreSQL: get counts via repository methods
      const projects = await repo.sessions.getAllProjects();
      // Use allRecentSummaries/allRecentObservations with high limit as count proxy
      // This is approximate but avoids adding count methods to the interface
      totalSessions = projects.length; // Approximate: at minimum one session per project
      try {
        const summaries = await repo.summaries.getAllRecentSummaries(1);
        // If we got at least one summary, there are summaries
        totalSummaries = summaries.length > 0 ? summaries.length : 0;
      } catch {
        totalSummaries = 0;
      }
    }

    // Get database file size and path (only meaningful for SQLite)
    const dbPath = path.join(homedir(), '.claude-mem', 'claude-mem.db');
    let dbSize = 0;
    if (repo.providerName === 'sqlite' && existsSync(dbPath)) {
      dbSize = statSync(dbPath).size;
    }

    // Worker metadata
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const activeSessions = this.sessionManager.getActiveSessionCount();
    const sseClients = this.sseBroadcaster.getClientCount();

    res.json({
      worker: {
        version,
        uptime,
        activeSessions,
        sseClients,
        port: getWorkerPort()
      },
      database: {
        provider: repo.providerName,
        path: repo.providerName === 'sqlite' ? dbPath : null,
        size: dbSize,
        observations: totalObservations,
        sessions: totalSessions,
        summaries: totalSummaries
      }
    });
  });

  /**
   * Get list of distinct projects from observations
   * GET /api/projects
   */
  private handleGetProjects = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const repo = this.dbManager.getRepository();
    const projects = await repo.sessions.getAllProjects();
    res.json({ projects });
  });

  /**
   * Get current processing status
   * GET /api/processing-status
   */
  private handleGetProcessingStatus = this.wrapHandler((req: Request, res: Response): void => {
    const isProcessing = this.sessionManager.isAnySessionProcessing();
    const queueDepth = this.sessionManager.getTotalActiveWork(); // Includes queued + actively processing
    res.json({ isProcessing, queueDepth });
  });

  /**
   * Set processing status (called by hooks)
   * NOTE: This now broadcasts computed status based on active processing (ignores input)
   */
  private handleSetProcessing = this.wrapHandler((req: Request, res: Response): void => {
    // Broadcast current computed status (ignores manual input)
    this.workerService.broadcastProcessingStatus();

    const isProcessing = this.sessionManager.isAnySessionProcessing();
    const queueDepth = this.sessionManager.getTotalQueueDepth();
    const activeSessions = this.sessionManager.getActiveSessionCount();

    res.json({ status: 'ok', isProcessing, queueDepth, activeSessions });
  });

  /**
   * Parse pagination parameters from request query
   */
  private parsePaginationParams(req: Request): { offset: number; limit: number; project?: string } {
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100); // Max 100
    const project = req.query.project as string | undefined;

    return { offset, limit, project };
  }

  /**
   * Import memories from export file
   * POST /api/import
   * Body: { sessions: [], summaries: [], observations: [], prompts: [] }
   */
  private handleImport = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const repo = this.dbManager.getRepository();

    // Import uses SQLite-specific bulk methods not on the repository interface
    if (repo.providerName !== 'sqlite') {
      res.status(501).json({
        error: 'Import is not yet supported for PostgreSQL storage provider'
      });
      return;
    }

    const { sessions, summaries, observations, prompts } = req.body;

    const stats = {
      sessionsImported: 0,
      sessionsSkipped: 0,
      summariesImported: 0,
      summariesSkipped: 0,
      observationsImported: 0,
      observationsSkipped: 0,
      promptsImported: 0,
      promptsSkipped: 0
    };

    const store = this.dbManager.getSessionStore();

    // Import sessions first (dependency for everything else)
    if (Array.isArray(sessions)) {
      for (const session of sessions) {
        const result = store.importSdkSession(session);
        if (result.imported) {
          stats.sessionsImported++;
        } else {
          stats.sessionsSkipped++;
        }
      }
    }

    // Import summaries (depends on sessions)
    if (Array.isArray(summaries)) {
      for (const summary of summaries) {
        const result = store.importSessionSummary(summary);
        if (result.imported) {
          stats.summariesImported++;
        } else {
          stats.summariesSkipped++;
        }
      }
    }

    // Import observations (depends on sessions)
    if (Array.isArray(observations)) {
      for (const obs of observations) {
        const result = store.importObservation(obs);
        if (result.imported) {
          stats.observationsImported++;
        } else {
          stats.observationsSkipped++;
        }
      }
    }

    // Import prompts (depends on sessions)
    if (Array.isArray(prompts)) {
      for (const prompt of prompts) {
        const result = store.importUserPrompt(prompt);
        if (result.imported) {
          stats.promptsImported++;
        } else {
          stats.promptsSkipped++;
        }
      }
    }

    res.json({
      success: true,
      stats
    });
  });

  /**
   * Get pending queue contents
   * GET /api/pending-queue
   * Returns all pending, processing, and failed messages with optional recently processed
   */
  private handleGetPendingQueue = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const repo = this.dbManager.getRepository();

    // Get queue contents (pending, processing, failed) via repository
    const queueMessages = await repo.pendingMessages.getQueueMessages();

    // Get sessions with pending work via repository
    const sessionsWithPending = await repo.pendingMessages.getSessionsWithPendingMessages();

    // getRecentlyProcessed and getStuckCount are SQLite-only (PendingMessageStore extras)
    let recentlyProcessed: any[] = [];
    let stuckCount = 0;
    if (repo.providerName === 'sqlite') {
      try {
        const { PendingMessageStore } = require('../../../sqlite/PendingMessageStore.js');
        const pendingStore = new PendingMessageStore(this.dbManager.getSessionStore().db, 3);
        recentlyProcessed = pendingStore.getRecentlyProcessed(20, 30);
        stuckCount = pendingStore.getStuckCount(5 * 60 * 1000);
      } catch {
        // Fallback: omit extra data
      }
    }

    res.json({
      queue: {
        messages: queueMessages,
        totalPending: queueMessages.filter((m: { status: string }) => m.status === 'pending').length,
        totalProcessing: queueMessages.filter((m: { status: string }) => m.status === 'processing').length,
        totalFailed: queueMessages.filter((m: { status: string }) => m.status === 'failed').length,
        stuckCount
      },
      recentlyProcessed,
      sessionsWithPendingWork: sessionsWithPending
    });
  });

  /**
   * Process pending queue
   * POST /api/pending-queue/process
   * Body: { sessionLimit?: number } - defaults to 10
   * Starts SDK agents for sessions with pending messages
   */
  private handleProcessPendingQueue = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const sessionLimit = Math.min(
      Math.max(parseInt(req.body.sessionLimit, 10) || 10, 1),
      100 // Max 100 sessions at once
    );

    const result = await this.workerService.processPendingQueues(sessionLimit);

    res.json({
      success: true,
      ...result
    });
  });

  /**
   * Clear all failed messages from the queue
   * DELETE /api/pending-queue/failed
   * Returns the number of messages cleared
   */
  private handleClearFailedQueue = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const repo = this.dbManager.getRepository();
    let clearedCount = 0;

    if (repo.providerName === 'sqlite') {
      const { PendingMessageStore } = require('../../../sqlite/PendingMessageStore.js');
      const pendingStore = new PendingMessageStore(this.dbManager.getSessionStore().db, 3);
      clearedCount = pendingStore.clearFailed();
    } else {
      // PostgreSQL: clearFailed not yet on IPendingMessageRepository
      // For now, return 0 and log a warning
      logger.warn('QUEUE', 'clearFailed not implemented for PostgreSQL provider');
    }

    logger.info('QUEUE', 'Cleared failed queue messages', { clearedCount });

    res.json({
      success: true,
      clearedCount
    });
  });

  /**
   * Clear all messages from the queue (pending, processing, and failed)
   * DELETE /api/pending-queue/all
   * Returns the number of messages cleared
   */
  private handleClearAllQueue = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const repo = this.dbManager.getRepository();
    let clearedCount = 0;

    if (repo.providerName === 'sqlite') {
      const { PendingMessageStore } = require('../../../sqlite/PendingMessageStore.js');
      const pendingStore = new PendingMessageStore(this.dbManager.getSessionStore().db, 3);
      clearedCount = pendingStore.clearAll();
    } else {
      // PostgreSQL: clearAll not yet on IPendingMessageRepository
      logger.warn('QUEUE', 'clearAll not implemented for PostgreSQL provider');
    }

    logger.warn('QUEUE', 'Cleared ALL queue messages (pending, processing, failed)', { clearedCount });

    res.json({
      success: true,
      clearedCount
    });
  });

  /**
   * Get migration/embedding backfill status.
   * Returns embedding progress for PostgreSQL provider.
   */
  private handleGetMigrationStatus = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const repo = this.dbManager.getRepository();
    const providerName = repo.providerName;

    if (providerName !== 'postgresql') {
      res.json({
        provider: 'sqlite',
        embeddingBackfill: null,
        message: 'Embedding backfill only applies to PostgreSQL provider',
      });
      return;
    }

    // Query observation count as a proxy for total records
    const totalObservations = await repo.observations.getObservationCount();

    res.json({
      provider: 'postgresql',
      totalObservations,
      message: 'PostgreSQL storage active',
    });
  });
}
