/**
 * DatabaseManager: Single long-lived database connection
 *
 * Responsibility:
 * - Manage single database connection for worker lifetime
 * - Provide centralized access to SessionStore, SessionSearch, and IStorageRepository
 * - High-level database operations
 * - ChromaSync integration
 */

import { SessionStore } from '../sqlite/SessionStore.js';
import { SessionSearch } from '../sqlite/SessionSearch.js';
import { ChromaSync } from '../sync/ChromaSync.js';
import { SettingsDefaultsManager, type SettingsDefaults } from '../../shared/SettingsDefaultsManager.js';
import { USER_SETTINGS_PATH } from '../../shared/paths.js';
import { logger } from '../../utils/logger.js';
import type { DBSession } from '../worker-types.js';
import type { IStorageRepository } from '../storage/interfaces.js';
import { StorageProviderFactory } from '../storage/StorageProviderFactory.js';

export class DatabaseManager {
  private sessionStore: SessionStore | null = null;
  private sessionSearch: SessionSearch | null = null;
  private chromaSync: ChromaSync | null = null;
  private repository: IStorageRepository | null = null;

  /**
   * Initialize database connection (once, stays open)
   */
  async initialize(): Promise<void> {
    const settings = SettingsDefaultsManager.loadFromFile(USER_SETTINGS_PATH);
    const provider = settings.CLAUDE_MEM_STORAGE_PROVIDER || 'sqlite';

    // Create repository via factory (handles SQLite vs PostgreSQL selection)
    this.repository = await StorageProviderFactory.create(settings);

    // For SQLite provider, also create legacy SessionStore/SessionSearch
    // (needed for backward compatibility with worker-service.ts call sites)
    if (provider !== 'postgresql') {
      this.sessionStore = new SessionStore();
      this.sessionSearch = new SessionSearch();
    }

    // Initialize ChromaSync only if Chroma is enabled and using SQLite
    // (PostgreSQL uses pgvector for vector search, doesn't need ChromaSync)
    const chromaEnabled = settings.CLAUDE_MEM_CHROMA_ENABLED !== 'false';
    if (chromaEnabled && provider !== 'postgresql') {
      this.chromaSync = new ChromaSync('claude-mem');
    } else if (provider === 'postgresql') {
      logger.info('DB', 'PostgreSQL provider active, ChromaSync disabled (using pgvector)');
    } else {
      logger.info('DB', 'Chroma disabled via CLAUDE_MEM_CHROMA_ENABLED=false, using SQLite-only search');
    }

    logger.info('DB', `Database initialized (provider: ${this.repository.providerName})`);
  }

  /**
   * Close database connection and cleanup all resources
   */
  async close(): Promise<void> {
    // Close ChromaSync first (MCP connection lifecycle managed by ChromaMcpManager)
    if (this.chromaSync) {
      await this.chromaSync.close();
      this.chromaSync = null;
    }

    // Close via repository if available (it owns the connection)
    if (this.repository) {
      await this.repository.close();
      this.repository = null;
      // Clear sessionStore/sessionSearch references (connection closed by repository)
      this.sessionStore = null;
      this.sessionSearch = null;
    } else {
      // Fallback: close directly if repository not yet initialized
      if (this.sessionStore) {
        this.sessionStore.close();
        this.sessionStore = null;
      }
      if (this.sessionSearch) {
        this.sessionSearch.close();
        this.sessionSearch = null;
      }
    }
    logger.info('DB', 'Database closed');
  }

  /**
   * Get the IStorageRepository interface (throws if not initialized).
   * Prefer this over getSessionStore() for new code.
   */
  getRepository(): IStorageRepository {
    if (!this.repository) {
      throw new Error('Database not initialized');
    }
    return this.repository;
  }

  /**
   * Get SessionStore instance (throws if not initialized)
   * @deprecated Use getRepository() for new code. Kept for backward compatibility.
   */
  getSessionStore(): SessionStore {
    if (!this.sessionStore) {
      throw new Error('Database not initialized');
    }
    return this.sessionStore;
  }

  /**
   * Get SessionSearch instance (throws if not initialized)
   * @deprecated Use getRepository().search for new code. Kept for backward compatibility.
   */
  getSessionSearch(): SessionSearch {
    if (!this.sessionSearch) {
      throw new Error('Database not initialized');
    }
    return this.sessionSearch;
  }

  /**
   * Get ChromaSync instance (returns null if Chroma is disabled)
   */
  getChromaSync(): ChromaSync | null {
    return this.chromaSync;
  }

  // REMOVED: cleanupOrphanedSessions - violates "EVERYTHING SHOULD SAVE ALWAYS"
  // Worker restarts don't make sessions orphaned. Sessions are managed by hooks
  // and exist independently of worker state.

  /**
   * Get session by ID (throws if not found)
   * Uses repository interface to support both SQLite and PostgreSQL.
   */
  async getSessionById(sessionDbId: number): Promise<{
    id: number;
    content_session_id: string;
    memory_session_id: string | null;
    project: string;
    user_prompt: string;
  }> {
    const repo = this.getRepository();
    const session = await repo.sessions.getSessionById(sessionDbId);
    if (!session) {
      throw new Error(`Session ${sessionDbId} not found`);
    }
    return {
      id: session.id,
      content_session_id: session.content_session_id,
      memory_session_id: session.memory_session_id,
      project: session.project,
      user_prompt: session.user_prompt || '',
    };
  }

}
