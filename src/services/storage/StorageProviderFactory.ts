/**
 * StorageProviderFactory
 *
 * Creates the appropriate IStorageRepository implementation based on settings.
 * Uses dynamic import for PostgreSQL dependencies to avoid bundling them
 * when only SQLite is needed.
 */

import type { SettingsDefaults } from '../../shared/SettingsDefaultsManager.js';
import type { IStorageRepository } from './interfaces.js';
import { SqliteStorageRepository } from './sqlite/SqliteStorageRepository.js';
import { logger } from '../../utils/logger.js';

export interface PostgresConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  connectionString: string;  // If set, overrides individual params
  poolMin: number;
  poolMax: number;
}

export class StorageProviderFactory {
  /**
   * Create an IStorageRepository based on the configured storage provider.
   *
   * For SQLite: instantiates SqliteStorageRepository directly (no PostgreSQL imports loaded).
   * For PostgreSQL: dynamically imports postgres.js and creates PostgresStorageRepository.
   */
  static async create(settings: SettingsDefaults): Promise<IStorageRepository> {
    const provider = settings.CLAUDE_MEM_STORAGE_PROVIDER || 'sqlite';

    if (provider === 'postgresql') {
      return this.createPostgresRepository(settings);
    }

    // Default: SQLite
    return this.createSqliteRepository();
  }

  /**
   * Create SQLite-backed repository using the existing SessionStore initialization.
   */
  private static createSqliteRepository(): IStorageRepository {
    // Import SessionStore to get initialized Database instance
    // (SessionStore handles DB path resolution and migration)
    const { SessionStore } = require('../sqlite/SessionStore.js');
    const sessionStore = new SessionStore();
    return new SqliteStorageRepository(sessionStore.db);
  }

  /**
   * Create PostgreSQL-backed repository from settings.
   * Public entry point for use in migration scripts and tools.
   */
  static async createPostgres(settings: SettingsDefaults): Promise<IStorageRepository> {
    return this.createPostgresRepository(settings);
  }

  /**
   * Create PostgreSQL-backed repository via dynamic import.
   * Exits with code 2 on connection failure (per hook exit code contract).
   */
  private static async createPostgresRepository(settings: SettingsDefaults): Promise<IStorageRepository> {
    const config = this.buildPostgresConfig(settings);

    try {
      // Dynamic import to avoid bundling postgres.js for SQLite-only users
      const { PostgresStorageRepository } = await import('./postgres/PostgresStorageRepository.js');
      const repository = await PostgresStorageRepository.create(config);

      logger.info('DB', `PostgreSQL connection established (pool: ${config.poolMin}-${config.poolMax})`);
      return repository;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('DB', `Failed to connect to PostgreSQL: ${message}`);
      console.error(`[FATAL] PostgreSQL connection failed: ${message}`);
      console.error('Check your CLAUDE_MEM_PG_* settings or CLAUDE_MEM_PG_CONNECTION_STRING');
      process.exit(2);
    }
  }

  /**
   * Build PostgreSQL connection config from settings.
   * Supports both connection string and individual parameter modes.
   */
  static buildPostgresConfig(settings: SettingsDefaults): PostgresConnectionConfig {
    return {
      host: settings.CLAUDE_MEM_PG_HOST || '127.0.0.1',
      port: parseInt(settings.CLAUDE_MEM_PG_PORT || '5432', 10),
      database: settings.CLAUDE_MEM_PG_DATABASE || 'claude_mem',
      username: settings.CLAUDE_MEM_PG_USER || '',
      password: settings.CLAUDE_MEM_PG_PASSWORD || '',
      ssl: settings.CLAUDE_MEM_PG_SSL === 'true',
      connectionString: settings.CLAUDE_MEM_PG_CONNECTION_STRING || '',
      poolMin: parseInt(settings.CLAUDE_MEM_PG_POOL_MIN || '2', 10),
      poolMax: parseInt(settings.CLAUDE_MEM_PG_POOL_MAX || '10', 10),
    };
  }
}
