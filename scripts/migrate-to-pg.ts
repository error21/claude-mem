#!/usr/bin/env bun
/**
 * SQLite to PostgreSQL data migration CLI tool.
 *
 * Usage:
 *   bun scripts/migrate-to-pg.ts                    # Run full migration
 *   bun scripts/migrate-to-pg.ts --dry-run          # Preview only (count records)
 *   bun scripts/migrate-to-pg.ts --batch-size 500   # Custom batch size
 *   bun scripts/migrate-to-pg.ts --skip-embeddings  # Skip embedding generation
 *
 * Prerequisites:
 *   - PostgreSQL with pgvector must be running and configured in settings.json
 *   - CLAUDE_MEM_STORAGE_PROVIDER must be set to 'postgresql' in settings
 *   - Or provide CLAUDE_MEM_PG_CONNECTION_STRING environment variable
 */

import { join } from 'path';
import { homedir } from 'os';
import { SettingsDefaultsManager } from '../src/shared/SettingsDefaultsManager.js';
import { StorageProviderFactory } from '../src/services/storage/StorageProviderFactory.js';
import { DataMigrationTool } from '../src/services/storage/migration/DataMigrationTool.js';
import type { MigrationOptions } from '../src/services/storage/migration/DataMigrationTool.js';
import type { IStorageRepository } from '../src/services/storage/interfaces.js';

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipEmbeddings = args.includes('--skip-embeddings');
const batchSizeIdx = args.indexOf('--batch-size');
const batchSize = batchSizeIdx >= 0 ? parseInt(args[batchSizeIdx + 1], 10) || 1000 : 1000;

const options: MigrationOptions = {
  dryRun,
  batchSize,
  skipEmbeddings,
};

console.log('=== claude-mem: SQLite → PostgreSQL Migration ===\n');
console.log(`Mode: ${dryRun ? 'DRY RUN (preview only)' : 'LIVE MIGRATION'}`);
console.log(`Batch size: ${batchSize}`);
console.log(`Embeddings: ${skipEmbeddings ? 'SKIPPED' : 'will be generated after migration'}`);
console.log('');

async function main() {
  // Load settings
  const settingsPath = join(homedir(), '.claude-mem', 'settings.json');
  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);

  // Verify PostgreSQL is configured
  const provider = settings.CLAUDE_MEM_STORAGE_PROVIDER;
  if (provider !== 'postgresql' && !settings.CLAUDE_MEM_PG_CONNECTION_STRING && !process.env.CLAUDE_MEM_PG_CONNECTION_STRING) {
    console.error('ERROR: PostgreSQL is not configured.');
    console.error('Set CLAUDE_MEM_STORAGE_PROVIDER=postgresql in settings.json');
    console.error('Or provide CLAUDE_MEM_PG_CONNECTION_STRING environment variable');
    process.exit(2);
  }

  // Initialize SQLite repository (source)
  // Force SQLite settings for the source
  const sqliteSettings = { ...settings, CLAUDE_MEM_STORAGE_PROVIDER: 'sqlite' };
  console.log('Source: SQLite (default database)');

  let sqliteRepo: IStorageRepository;
  try {
    sqliteRepo = await StorageProviderFactory.create(sqliteSettings);
    const healthy = await sqliteRepo.isHealthy();
    if (!healthy) throw new Error('SQLite database not healthy');
    console.log('  SQLite: connected');
  } catch (error) {
    console.error(`ERROR: Failed to connect to SQLite: ${(error as Error).message}`);
    process.exit(2);
  }

  // Initialize PostgreSQL repository (target)
  console.log(`Target: PostgreSQL at ${settings.CLAUDE_MEM_PG_HOST}:${settings.CLAUDE_MEM_PG_PORT}/${settings.CLAUDE_MEM_PG_DATABASE}`);

  let postgresRepo: IStorageRepository;
  try {
    postgresRepo = await StorageProviderFactory.createPostgres(settings);
    const healthy = await postgresRepo.isHealthy();
    if (!healthy) throw new Error('PostgreSQL not healthy');
    console.log('  PostgreSQL: connected');
  } catch (error) {
    console.error(`ERROR: Failed to connect to PostgreSQL: ${(error as Error).message}`);
    await sqliteRepo?.close();
    process.exit(2);
  }

  console.log('');

  // Run migration
  const migrationTool = new DataMigrationTool(
    sqliteRepo,
    postgresRepo,
    undefined, // embeddingQueue - will be initialized separately if needed
    (msg) => console.log(msg)
  );

  try {
    const result = await migrationTool.migrate(options);

    console.log('\n=== Migration Summary ===');
    console.log(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log('');

    for (const table of result.tables) {
      const countStr = table.total >= 0 ? String(table.total) : '?';
      console.log(`  ${table.table.padEnd(20)} total: ${countStr.padStart(6)}, migrated: ${String(table.migrated).padStart(6)}, skipped: ${String(table.skipped).padStart(4)}, errors: ${table.errors}`);
    }

    if (result.embeddingBackfillQueued > 0) {
      console.log(`\nEmbedding backfill: ${result.embeddingBackfillQueued} records queued`);
    }

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error(`\nMigration failed: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    await sqliteRepo?.close();
    await postgresRepo?.close();
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
