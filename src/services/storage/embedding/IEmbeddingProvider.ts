/**
 * Embedding provider interface for generating vector embeddings.
 *
 * Abstracts over local (ONNX Runtime) and API-based (OpenAI/Voyage)
 * embedding generation to support pgvector search in PostgreSQL.
 */

export interface EmbeddingProviderConfig {
  provider: 'local' | 'openai' | 'voyage';
  apiKey?: string;
  modelName?: string;
  dimensions?: number;
}

export interface IEmbeddingProvider {
  /**
   * Generate an embedding vector for a single text.
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Generate embedding vectors for multiple texts in a batch.
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;

  /**
   * The dimensionality of vectors produced by this provider.
   */
  readonly dimensions: number;

  /**
   * Provider identifier (e.g. 'openai', 'voyage', 'local-minilm').
   */
  readonly name: string;
}
