/**
 * Asynchronous embedding generation queue.
 *
 * Processes embedding tasks in batches with exponential backoff retry.
 * Supports backfill of records with NULL embeddings on startup.
 * On final failure, embeddings remain NULL and tsvector search serves as fallback.
 */

import type { IEmbeddingProvider } from './IEmbeddingProvider.js';
import { logger } from '../../../utils/logger.js';

export interface EmbeddingTask {
  id: number;
  table: 'observations' | 'session_summaries' | 'user_prompts';
  text: string;
}

export interface EmbeddingQueueStats {
  queued: number;
  processed: number;
  failed: number;
  isProcessing: boolean;
}

/**
 * Function type for executing UPDATE queries on the database.
 * Abstracts the SQL execution so EmbeddingQueue is not coupled to a specific driver.
 */
export type EmbeddingUpdateFn = (
  table: string,
  id: number,
  vector: string
) => Promise<void>;

/**
 * Function type for querying records with NULL embeddings for backfill.
 */
export type EmbeddingBackfillQueryFn = (
  table: string,
  textExpression: string,
  limit: number
) => Promise<Array<{ id: number; text: string }>>;

export class EmbeddingQueue {
  private queue: EmbeddingTask[] = [];
  private processing = false;
  private readonly provider: IEmbeddingProvider;
  private readonly updateFn: EmbeddingUpdateFn;
  private readonly backfillQueryFn: EmbeddingBackfillQueryFn;
  private readonly batchSize: number;
  private readonly maxRetries: number;

  private processedCount = 0;
  private failedCount = 0;

  constructor(
    provider: IEmbeddingProvider,
    updateFn: EmbeddingUpdateFn,
    backfillQueryFn: EmbeddingBackfillQueryFn,
    options?: { batchSize?: number; maxRetries?: number }
  ) {
    this.provider = provider;
    this.updateFn = updateFn;
    this.backfillQueryFn = backfillQueryFn;
    this.batchSize = options?.batchSize ?? 32;
    this.maxRetries = options?.maxRetries ?? 3;
  }

  /**
   * Add embedding tasks to the queue. Starts processing if not already running.
   */
  enqueue(tasks: EmbeddingTask[]): void {
    this.queue.push(...tasks);
    if (!this.processing) {
      // Fire-and-forget background processing
      this.processQueue().catch(err => {
        logger.error('EMBEDDING', 'Queue processing crashed', {}, err as Error);
        this.processing = false;
      });
    }
  }

  /**
   * Backfill records with NULL embeddings across all tables.
   * Called on worker startup when PostgreSQL provider is active.
   * @returns Number of records queued for embedding generation
   */
  async backfill(limit = 1000): Promise<number> {
    const tables = ['observations', 'session_summaries', 'user_prompts'] as const;
    let totalQueued = 0;

    for (const table of tables) {
      const textExpr = this.getTextExpression(table);
      const rows = await this.backfillQueryFn(table, textExpr, limit);

      if (rows.length > 0) {
        this.enqueue(
          rows.map(r => ({ id: r.id, table, text: r.text }))
        );
        totalQueued += rows.length;
        logger.info('EMBEDDING', `Backfill queued ${rows.length} records from ${table}`);
      }
    }

    return totalQueued;
  }

  /**
   * Get current queue statistics.
   */
  getStats(): EmbeddingQueueStats {
    return {
      queued: this.queue.length,
      processed: this.processedCount,
      failed: this.failedCount,
      isProcessing: this.processing,
    };
  }

  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);
      const texts = batch.map(t => t.text);

      let retries = 0;
      let success = false;

      while (retries < this.maxRetries && !success) {
        try {
          const embeddings = await this.provider.generateEmbeddings(texts);

          // Update each record with its embedding vector
          for (let i = 0; i < batch.length; i++) {
            const task = batch[i];
            const vector = `[${embeddings[i].join(',')}]`;
            await this.updateFn(task.table, task.id, vector);
          }

          this.processedCount += batch.length;
          success = true;
        } catch (error) {
          retries++;
          if (retries >= this.maxRetries) {
            logger.error('EMBEDDING', `Batch failed after ${this.maxRetries} retries`, {
              batchSize: batch.length,
            }, error as Error);
            this.failedCount += batch.length;
            // Leave embedding as NULL - tsvector search remains available
          } else {
            // Exponential backoff: 2s, 4s, 8s...
            const delay = 1000 * Math.pow(2, retries);
            logger.info('EMBEDDING', `Retry ${retries}/${this.maxRetries} after ${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
          }
        }
      }
    }

    this.processing = false;
  }

  /**
   * Get the SQL text expression for embedding text generation per table.
   */
  private getTextExpression(
    table: 'observations' | 'session_summaries' | 'user_prompts'
  ): string {
    switch (table) {
      case 'observations':
        return "COALESCE(title, '') || ' ' || COALESCE(narrative, '') || ' ' || COALESCE(facts, '')";
      case 'session_summaries':
        return "COALESCE(request, '') || ' ' || COALESCE(investigated, '') || ' ' || COALESCE(learned, '') || ' ' || COALESCE(completed, '')";
      case 'user_prompts':
        return 'prompt_text';
    }
  }
}
