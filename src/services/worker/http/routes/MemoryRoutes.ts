/**
 * Memory Routes
 *
 * Handles manual memory/observation saving.
 * POST /api/memory/save - Save a manual memory observation
 */

import express, { Request, Response } from 'express';
import { BaseRouteHandler } from '../BaseRouteHandler.js';
import { logger } from '../../../../utils/logger.js';
import type { DatabaseManager } from '../../DatabaseManager.js';

export class MemoryRoutes extends BaseRouteHandler {
  constructor(
    private dbManager: DatabaseManager,
    private defaultProject: string
  ) {
    super();
  }

  setupRoutes(app: express.Application): void {
    app.post('/api/memory/save', this.handleSaveMemory.bind(this));
  }

  /**
   * POST /api/memory/save - Save a manual memory/observation
   * Body: { text: string, title?: string, project?: string }
   */
  private handleSaveMemory = this.wrapHandler(async (req: Request, res: Response): Promise<void> => {
    const { text, title, project } = req.body;
    const targetProject = project || this.defaultProject;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      this.badRequest(res, 'text is required and must be non-empty');
      return;
    }

    const repo = this.dbManager.getRepository();
    const chromaSync = this.dbManager.getChromaSync();

    // 1. Get or create manual session for project
    // Use a deterministic content_session_id for manual memories per project
    const manualContentSessionId = `manual-memory-${targetProject}`;
    let session = await repo.sessions.getSessionByContentId(manualContentSessionId);
    let memorySessionId: string;

    if (!session) {
      // Create a new manual session
      const sessionDbId = await repo.sessions.createSDKSession(
        manualContentSessionId,
        targetProject,
        'Manual memories',
        'Manual Memories'
      );
      // Use the content_session_id as the memory_session_id for manual sessions
      memorySessionId = manualContentSessionId;
      await repo.sessions.updateMemorySessionId(sessionDbId, memorySessionId);
    } else {
      memorySessionId = session.memory_session_id || manualContentSessionId;
    }

    // 2. Build observation
    const observation = {
      type: 'discovery',  // Use existing valid type
      title: title || text.substring(0, 60).trim() + (text.length > 60 ? '...' : ''),
      subtitle: 'Manual memory',
      facts: [] as string[],
      narrative: text,
      concepts: [] as string[],
      files_read: [] as string[],
      files_modified: [] as string[]
    };

    // 3. Store observation via repository
    const result = await repo.observations.storeObservation(
      memorySessionId,
      targetProject,
      observation,
      0,  // promptNumber
      0   // discoveryTokens
    );

    logger.info('HTTP', 'Manual observation saved', {
      id: result.id,
      project: targetProject,
      title: observation.title
    });

    // 4. Sync to ChromaDB (async, fire-and-forget) - only if available (SQLite mode)
    if (chromaSync) {
      chromaSync.syncObservation(
        result.id,
        memorySessionId,
        targetProject,
        observation,
        0,
        result.createdAtEpoch,
        0
      ).catch(err => {
        logger.error('CHROMA', 'ChromaDB sync failed', { id: result.id }, err as Error);
      });
    }

    // 5. Return success
    res.json({
      success: true,
      id: result.id,
      title: observation.title,
      project: targetProject,
      message: `Memory saved as observation #${result.id}`
    });
  });
}
