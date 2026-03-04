/**
 * API-based embedding provider supporting OpenAI and Voyage endpoints.
 *
 * Uses fetch() for HTTP calls with proper error handling.
 * Both providers follow the same request/response format.
 */

import type { IEmbeddingProvider, EmbeddingProviderConfig } from './IEmbeddingProvider.js';
import { logger } from '../../../utils/logger.js';

const DEFAULT_OPENAI_MODEL = 'text-embedding-3-small';
const DEFAULT_OPENAI_DIMENSIONS = 1536;
const DEFAULT_VOYAGE_MODEL = 'voyage-3-lite';
const DEFAULT_VOYAGE_DIMENSIONS = 512;

interface EmbeddingApiResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { prompt_tokens: number; total_tokens: number };
}

export class ApiEmbeddingProvider implements IEmbeddingProvider {
  readonly dimensions: number;
  readonly name: string;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly modelName: string;

  constructor(config: EmbeddingProviderConfig) {
    if (!config.apiKey) {
      throw new Error(`API key required for ${config.provider} embedding provider`);
    }
    this.apiKey = config.apiKey;

    if (config.provider === 'openai') {
      this.endpoint = 'https://api.openai.com/v1/embeddings';
      this.modelName = config.modelName || DEFAULT_OPENAI_MODEL;
      this.dimensions = config.dimensions || DEFAULT_OPENAI_DIMENSIONS;
      this.name = 'openai';
    } else if (config.provider === 'voyage') {
      this.endpoint = 'https://api.voyageai.com/v1/embeddings';
      this.modelName = config.modelName || DEFAULT_VOYAGE_MODEL;
      this.dimensions = config.dimensions || DEFAULT_VOYAGE_DIMENSIONS;
      this.name = 'voyage';
    } else {
      throw new Error(`ApiEmbeddingProvider does not support provider: ${config.provider}`);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const results = await this.generateEmbeddings([text]);
    return results[0];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const body: Record<string, unknown> = {
      model: this.modelName,
      input: texts,
    };

    // OpenAI supports explicit dimensions parameter for dimensionality reduction
    if (this.name === 'openai' && this.dimensions !== DEFAULT_OPENAI_DIMENSIONS) {
      body.dimensions = this.dimensions;
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      const msg = `Embedding API error (${this.name}): ${response.status} - ${errorText}`;
      logger.error('EMBEDDING', msg);
      throw new Error(msg);
    }

    const data = (await response.json()) as EmbeddingApiResponse;

    // Sort by index to ensure order matches input order
    const sorted = data.data.sort((a, b) => a.index - b.index);
    return sorted.map(d => d.embedding);
  }
}
