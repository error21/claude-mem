/**
 * SettingsManager: DRY settings CRUD utility
 *
 * Responsibility:
 * - DRY helper for viewer settings CRUD
 * - Eliminates duplication in settings read/write logic
 * - Type-safe settings management
 *
 * Note: viewer_settings table only exists in SQLite.
 * For PostgreSQL, settings fall back to in-memory defaults.
 */

import { DatabaseManager } from './DatabaseManager.js';
import { logger } from '../../utils/logger.js';
import type { ViewerSettings } from '../worker-types.js';

export class SettingsManager {
  private dbManager: DatabaseManager;
  private readonly defaultSettings: ViewerSettings = {
    sidebarOpen: true,
    selectedProject: null,
    theme: 'system'
  };
  // In-memory cache for PostgreSQL mode (no viewer_settings table)
  private inMemorySettings: ViewerSettings | null = null;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * Check if using SQLite provider (viewer_settings table is available)
   */
  private isSqlite(): boolean {
    try {
      return this.dbManager.getRepository().providerName === 'sqlite';
    } catch {
      return false;
    }
  }

  /**
   * Get current viewer settings (with defaults)
   */
  getSettings(): ViewerSettings {
    // PostgreSQL: use in-memory settings (viewer_settings table doesn't exist)
    if (!this.isSqlite()) {
      return { ...(this.inMemorySettings || this.defaultSettings) };
    }

    try {
      const db = this.dbManager.getSessionStore().db;
      const stmt = db.prepare('SELECT key, value FROM viewer_settings');
      const rows = stmt.all() as Array<{ key: string; value: string }>;

      const settings: ViewerSettings = { ...this.defaultSettings };
      for (const row of rows) {
        const key = row.key as keyof ViewerSettings;
        if (key in settings) {
          settings[key] = JSON.parse(row.value) as ViewerSettings[typeof key];
        }
      }

      return settings;
    } catch (error) {
      logger.debug('WORKER', 'Failed to load settings, using defaults', {}, error as Error);
      return { ...this.defaultSettings };
    }
  }

  /**
   * Update viewer settings (partial update)
   */
  updateSettings(updates: Partial<ViewerSettings>): ViewerSettings {
    // PostgreSQL: store in memory only
    if (!this.isSqlite()) {
      if (!this.inMemorySettings) {
        this.inMemorySettings = { ...this.defaultSettings };
      }
      Object.assign(this.inMemorySettings, updates);
      return { ...this.inMemorySettings };
    }

    try {
      const db = this.dbManager.getSessionStore().db;

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO viewer_settings (key, value)
        VALUES (?, ?)
      `);

      for (const [key, value] of Object.entries(updates)) {
        stmt.run(key, JSON.stringify(value));
      }
    } catch (error) {
      logger.debug('WORKER', 'Failed to persist settings, using in-memory fallback', {}, error as Error);
      if (!this.inMemorySettings) {
        this.inMemorySettings = { ...this.defaultSettings };
      }
      Object.assign(this.inMemorySettings, updates);
    }

    return this.getSettings();
  }
}
