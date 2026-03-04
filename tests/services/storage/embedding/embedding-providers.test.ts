/**
 * Tests for IEmbeddingProvider implementations and EmbeddingQueue.
 *
 * ApiEmbeddingProvider tests use mocked HTTP responses.
 * LocalEmbeddingProvider tests are skipped if onnxruntime-node is not installed.
 * EmbeddingQueue tests verify batch processing, retry, and backfill.
 */

import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { ApiEmbeddingProvider } from '../../../../src/services/storage/embedding/ApiEmbeddingProvider.js';
import { EmbeddingQueue } from '../../../../src/services/storage/embedding/EmbeddingQueue.js';
import type { IEmbeddingProvider } from '../../../../src/services/storage/embedding/IEmbeddingProvider.js';
import type { EmbeddingTask, EmbeddingUpdateFn, EmbeddingBackfillQueryFn } from '../../../../src/services/storage/embedding/EmbeddingQueue.js';

// ============================================================
// ApiEmbeddingProvider Tests
// ============================================================

describe('ApiEmbeddingProvider', () => {
  describe('constructor', () => {
    it('should throw if no API key provided', () => {
      expect(() => new ApiEmbeddingProvider({
        provider: 'openai',
      })).toThrow('API key required');
    });

    it('should configure OpenAI defaults', () => {
      const provider = new ApiEmbeddingProvider({
        provider: 'openai',
        apiKey: 'test-key',
      });
      expect(provider.name).toBe('openai');
      expect(provider.dimensions).toBe(1536);
    });

    it('should configure Voyage defaults', () => {
      const provider = new ApiEmbeddingProvider({
        provider: 'voyage',
        apiKey: 'test-key',
      });
      expect(provider.name).toBe('voyage');
      expect(provider.dimensions).toBe(512);
    });

    it('should accept custom dimensions', () => {
      const provider = new ApiEmbeddingProvider({
        provider: 'openai',
        apiKey: 'test-key',
        dimensions: 384,
      });
      expect(provider.dimensions).toBe(384);
    });

    it('should accept custom model name', () => {
      const provider = new ApiEmbeddingProvider({
        provider: 'openai',
        apiKey: 'test-key',
        modelName: 'text-embedding-3-large',
      });
      expect(provider.name).toBe('openai');
    });

    it('should reject unsupported provider', () => {
      expect(() => new ApiEmbeddingProvider({
        provider: 'local' as any,
        apiKey: 'test-key',
      })).toThrow('does not support provider');
    });
  });

  describe('generateEmbedding', () => {
    it('should return embedding vector from API', async () => {
      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());
      const mockResponse = {
        data: [{ embedding: mockEmbedding, index: 0 }],
        usage: { prompt_tokens: 5, total_tokens: 5 },
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      ) as any;

      try {
        const provider = new ApiEmbeddingProvider({
          provider: 'openai',
          apiKey: 'test-key',
        });
        const result = await provider.generateEmbedding('test text');
        expect(result).toHaveLength(1536);
        expect(result).toEqual(mockEmbedding);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should throw on API error', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Rate limited', { status: 429 }))
      ) as any;

      try {
        const provider = new ApiEmbeddingProvider({
          provider: 'openai',
          apiKey: 'test-key',
        });
        await expect(provider.generateEmbedding('test')).rejects.toThrow('429');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('generateEmbeddings', () => {
    it('should return empty array for empty input', async () => {
      const provider = new ApiEmbeddingProvider({
        provider: 'openai',
        apiKey: 'test-key',
      });
      const result = await provider.generateEmbeddings([]);
      expect(result).toEqual([]);
    });

    it('should return embeddings in correct order regardless of API order', async () => {
      const emb0 = [1, 2, 3];
      const emb1 = [4, 5, 6];
      // API returns in reverse index order
      const mockResponse = {
        data: [
          { embedding: emb1, index: 1 },
          { embedding: emb0, index: 0 },
        ],
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      ) as any;

      try {
        const provider = new ApiEmbeddingProvider({
          provider: 'openai',
          apiKey: 'test-key',
        });
        const result = await provider.generateEmbeddings(['first', 'second']);
        expect(result[0]).toEqual(emb0);
        expect(result[1]).toEqual(emb1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should include dimensions param for OpenAI with non-default dims', async () => {
      const mockResponse = {
        data: [{ embedding: [1, 2, 3], index: 0 }],
      };

      let capturedBody: any;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock((_url: string, opts: any) => {
        capturedBody = JSON.parse(opts.body);
        return Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }) as any;

      try {
        const provider = new ApiEmbeddingProvider({
          provider: 'openai',
          apiKey: 'test-key',
          dimensions: 384,
        });
        await provider.generateEmbeddings(['test']);
        expect(capturedBody.dimensions).toBe(384);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

// ============================================================
// EmbeddingQueue Tests
// ============================================================

describe('EmbeddingQueue', () => {
  let mockProvider: IEmbeddingProvider;
  let updateCalls: Array<{ table: string; id: number; vector: string }>;
  let mockUpdateFn: EmbeddingUpdateFn;
  let mockBackfillFn: EmbeddingBackfillQueryFn;

  beforeEach(() => {
    updateCalls = [];
    mockProvider = {
      name: 'test',
      dimensions: 3,
      generateEmbedding: async (text: string) => [0.1, 0.2, 0.3],
      generateEmbeddings: async (texts: string[]) =>
        texts.map(() => [0.1, 0.2, 0.3]),
    };
    mockUpdateFn = async (table, id, vector) => {
      updateCalls.push({ table, id, vector });
    };
    mockBackfillFn = async (table, textExpr, limit) => [];
  });

  it('should process enqueued tasks', async () => {
    const queue = new EmbeddingQueue(mockProvider, mockUpdateFn, mockBackfillFn, {
      batchSize: 2,
    });

    const tasks: EmbeddingTask[] = [
      { id: 1, table: 'observations', text: 'hello' },
      { id: 2, table: 'observations', text: 'world' },
    ];

    queue.enqueue(tasks);

    // Wait for processing
    await new Promise(r => setTimeout(r, 100));

    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0].id).toBe(1);
    expect(updateCalls[1].id).toBe(2);
    expect(updateCalls[0].vector).toContain('0.1');
  });

  it('should report stats', async () => {
    const queue = new EmbeddingQueue(mockProvider, mockUpdateFn, mockBackfillFn);

    const stats = queue.getStats();
    expect(stats.queued).toBe(0);
    expect(stats.processed).toBe(0);
    expect(stats.failed).toBe(0);
    expect(stats.isProcessing).toBe(false);
  });

  it('should retry on failure with exponential backoff', async () => {
    let callCount = 0;
    const failingProvider: IEmbeddingProvider = {
      ...mockProvider,
      generateEmbeddings: async () => {
        callCount++;
        if (callCount <= 2) throw new Error('API error');
        return [[0.1, 0.2, 0.3]];
      },
    };

    const queue = new EmbeddingQueue(failingProvider, mockUpdateFn, mockBackfillFn, {
      maxRetries: 3,
      batchSize: 1,
    });

    queue.enqueue([{ id: 1, table: 'observations', text: 'test' }]);

    // Wait for retries (exponential backoff: 2s + 4s)
    await new Promise(r => setTimeout(r, 8000));

    expect(callCount).toBe(3); // 2 failures + 1 success
    expect(updateCalls).toHaveLength(1);

    const stats = queue.getStats();
    expect(stats.processed).toBe(1);
    expect(stats.failed).toBe(0);
  }, 15000); // Extended timeout for backoff

  it('should mark tasks as failed after max retries', async () => {
    const alwaysFailProvider: IEmbeddingProvider = {
      ...mockProvider,
      generateEmbeddings: async () => {
        throw new Error('permanent failure');
      },
    };

    const queue = new EmbeddingQueue(alwaysFailProvider, mockUpdateFn, mockBackfillFn, {
      maxRetries: 2,
      batchSize: 1,
    });

    queue.enqueue([{ id: 1, table: 'observations', text: 'test' }]);

    // Wait for retries
    await new Promise(r => setTimeout(r, 6000));

    expect(updateCalls).toHaveLength(0); // No updates on failure
    const stats = queue.getStats();
    expect(stats.failed).toBe(1);
  }, 10000);

  it('should backfill from database', async () => {
    const backfillFn: EmbeddingBackfillQueryFn = async (table, _textExpr, limit) => {
      if (table === 'observations') {
        return [
          { id: 10, text: 'obs text 1' },
          { id: 11, text: 'obs text 2' },
        ];
      }
      return [];
    };

    const queue = new EmbeddingQueue(mockProvider, mockUpdateFn, backfillFn);
    const count = await queue.backfill(100);

    expect(count).toBe(2);

    // Wait for processing
    await new Promise(r => setTimeout(r, 200));

    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0].id).toBe(10);
    expect(updateCalls[0].table).toBe('observations');
  });

  it('should handle batch processing correctly', async () => {
    const queue = new EmbeddingQueue(mockProvider, mockUpdateFn, mockBackfillFn, {
      batchSize: 2,
    });

    // Enqueue 5 tasks (should create 3 batches: 2, 2, 1)
    const tasks: EmbeddingTask[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      table: 'observations' as const,
      text: `text ${i}`,
    }));

    queue.enqueue(tasks);
    await new Promise(r => setTimeout(r, 200));

    expect(updateCalls).toHaveLength(5);
    const stats = queue.getStats();
    expect(stats.processed).toBe(5);
  });
});

// ============================================================
// LocalEmbeddingProvider Tests (conditional)
// ============================================================

describe('LocalEmbeddingProvider', () => {
  let isAvailable = false;

  try {
    // Check if onnxruntime-node is available
    require.resolve('onnxruntime-node');
    isAvailable = true;
  } catch {
    // Not available
  }

  it.skipIf(!isAvailable)('should produce 384-dimensional vectors', async () => {
    const { LocalEmbeddingProvider } = await import(
      '../../../../src/services/storage/embedding/LocalEmbeddingProvider.js'
    );
    const provider = new LocalEmbeddingProvider();
    expect(provider.dimensions).toBe(384);
    expect(provider.name).toBe('local-minilm');
  });

  it.skipIf(!isAvailable)('should generate normalized vectors', async () => {
    const { LocalEmbeddingProvider } = await import(
      '../../../../src/services/storage/embedding/LocalEmbeddingProvider.js'
    );
    const provider = new LocalEmbeddingProvider();
    const embedding = await provider.generateEmbedding('test text');

    expect(embedding).toHaveLength(384);

    // Check L2 normalization (norm should be ~1.0)
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 2);
  }, 60000); // Model download may take time
});
