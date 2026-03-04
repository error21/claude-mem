/**
 * Local embedding provider using ONNX Runtime with all-MiniLM-L6-v2 model.
 *
 * Generates 384-dimensional embeddings locally without API calls.
 * The ONNX model and tokenizer are lazy-loaded on first use.
 * Both onnxruntime-node and the model files are optional dependencies.
 */

import type { IEmbeddingProvider } from './IEmbeddingProvider.js';
import { logger } from '../../../utils/logger.js';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { homedir } from 'os';

const MODEL_DIR = join(homedir(), '.claude-mem', 'models');
const MODEL_NAME = 'all-MiniLM-L6-v2';
const MODEL_FILE = 'model.onnx';
const TOKENIZER_FILE = 'tokenizer.json';
const MODEL_URL = `https://huggingface.co/sentence-transformers/${MODEL_NAME}/resolve/main/onnx/${MODEL_FILE}`;
const TOKENIZER_URL = `https://huggingface.co/sentence-transformers/${MODEL_NAME}/resolve/main/${TOKENIZER_FILE}`;

// Simple wordpiece tokenizer subset for all-MiniLM-L6-v2
// The model uses BERT-style [CLS] + tokens + [SEP] encoding
const CLS_TOKEN_ID = 101;
const SEP_TOKEN_ID = 102;
const PAD_TOKEN_ID = 0;
const UNK_TOKEN_ID = 100;
const MAX_SEQ_LENGTH = 128;

interface TokenizerVocab {
  [token: string]: number;
}

export class LocalEmbeddingProvider implements IEmbeddingProvider {
  readonly dimensions = 384;
  readonly name = 'local-minilm';

  private session: unknown | null = null;
  private vocab: TokenizerVocab | null = null;
  private initPromise: Promise<void> | null = null;

  async generateEmbedding(text: string): Promise<number[]> {
    const results = await this.generateEmbeddings([text]);
    return results[0];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    await this.ensureModelLoaded();

    const results: number[][] = [];
    // Process one at a time to manage memory
    for (const text of texts) {
      const embedding = await this.runInference(text);
      results.push(embedding);
    }
    return results;
  }

  private async ensureModelLoaded(): Promise<void> {
    if (this.session && this.vocab) return;

    // Prevent concurrent initialization
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.loadModel();
    await this.initPromise;
  }

  private async loadModel(): Promise<void> {
    // Dynamic import to keep onnxruntime-node optional
    let ort: any;
    try {
      // @ts-ignore - onnxruntime-node is an optional dependency
      ort = await import('onnxruntime-node');
    } catch {
      throw new Error(
        'onnxruntime-node is not installed. Install it with: npm install onnxruntime-node\n' +
        'Or use an API-based embedding provider (openai/voyage) instead.'
      );
    }

    const modelDir = join(MODEL_DIR, MODEL_NAME);
    const modelPath = join(modelDir, MODEL_FILE);
    const tokenizerPath = join(modelDir, TOKENIZER_FILE);

    // Download model files if not present
    if (!existsSync(modelPath) || !existsSync(tokenizerPath)) {
      await this.downloadModelFiles(modelDir, modelPath, tokenizerPath);
    }

    // Load tokenizer vocabulary
    const tokenizerData = JSON.parse(readFileSync(tokenizerPath, 'utf-8'));
    this.vocab = tokenizerData.model?.vocab || tokenizerData.vocab || {};

    // Create ONNX inference session
    this.session = await (ort as any).InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });

    logger.info('EMBEDDING', `Loaded local embedding model: ${MODEL_NAME}`);
  }

  private async downloadModelFiles(
    modelDir: string,
    modelPath: string,
    tokenizerPath: string
  ): Promise<void> {
    if (!existsSync(modelDir)) {
      mkdirSync(modelDir, { recursive: true });
    }

    logger.info('EMBEDDING', `Downloading ${MODEL_NAME} model files...`);

    if (!existsSync(modelPath)) {
      const response = await fetch(MODEL_URL);
      if (!response.ok) {
        throw new Error(`Failed to download model: ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(modelPath, buffer);
      logger.info('EMBEDDING', `Downloaded model: ${MODEL_FILE}`);
    }

    if (!existsSync(tokenizerPath)) {
      const response = await fetch(TOKENIZER_URL);
      if (!response.ok) {
        throw new Error(`Failed to download tokenizer: ${response.status}`);
      }
      const text = await response.text();
      writeFileSync(tokenizerPath, text, 'utf-8');
      logger.info('EMBEDDING', `Downloaded tokenizer: ${TOKENIZER_FILE}`);
    }
  }

  private tokenize(text: string): { inputIds: number[]; attentionMask: number[] } {
    if (!this.vocab) throw new Error('Tokenizer not loaded');

    // Simple WordPiece tokenization
    const tokens: number[] = [CLS_TOKEN_ID];

    // Lowercase and split into words
    const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);

    for (const word of words) {
      if (tokens.length >= MAX_SEQ_LENGTH - 1) break;

      // Try full word first
      if (this.vocab[word] !== undefined) {
        tokens.push(this.vocab[word]);
        continue;
      }

      // WordPiece subword tokenization
      let remaining = word;
      let isFirst = true;
      while (remaining.length > 0 && tokens.length < MAX_SEQ_LENGTH - 1) {
        let found = false;
        for (let end = remaining.length; end > 0; end--) {
          const sub = isFirst ? remaining.slice(0, end) : `##${remaining.slice(0, end)}`;
          if (this.vocab[sub] !== undefined) {
            tokens.push(this.vocab[sub]);
            remaining = remaining.slice(end);
            isFirst = false;
            found = true;
            break;
          }
        }
        if (!found) {
          tokens.push(UNK_TOKEN_ID);
          break;
        }
      }
    }

    tokens.push(SEP_TOKEN_ID);

    // Pad to MAX_SEQ_LENGTH
    const inputIds = [...tokens];
    const attentionMask = new Array(tokens.length).fill(1);

    while (inputIds.length < MAX_SEQ_LENGTH) {
      inputIds.push(PAD_TOKEN_ID);
      attentionMask.push(0);
    }

    return { inputIds, attentionMask };
  }

  private async runInference(text: string): Promise<number[]> {
    const session = this.session as any;
    const { inputIds, attentionMask } = this.tokenize(text);

    // Create ONNX tensors
    // @ts-ignore - onnxruntime-node is an optional dependency
    const ort = await import('onnxruntime-node');
    const Tensor = ort.Tensor;

    const inputIdsTensor = new Tensor(
      'int64',
      BigInt64Array.from(inputIds.map(BigInt)),
      [1, MAX_SEQ_LENGTH]
    );
    const attentionMaskTensor = new Tensor(
      'int64',
      BigInt64Array.from(attentionMask.map(BigInt)),
      [1, MAX_SEQ_LENGTH]
    );
    const tokenTypeIdsTensor = new Tensor(
      'int64',
      new BigInt64Array(MAX_SEQ_LENGTH),
      [1, MAX_SEQ_LENGTH]
    );

    const feeds: Record<string, unknown> = {
      input_ids: inputIdsTensor,
      attention_mask: attentionMaskTensor,
      token_type_ids: tokenTypeIdsTensor,
    };

    const results = await session.run(feeds);

    // Get token embeddings from last_hidden_state (shape: [1, seq_len, 384])
    const output = results.last_hidden_state || results.token_embeddings;
    if (!output) {
      // Fallback: use first output
      const outputKey = Object.keys(results)[0];
      return this.meanPoolAndNormalize(results[outputKey].data, attentionMask);
    }

    return this.meanPoolAndNormalize(output.data as Float32Array, attentionMask);
  }

  private meanPoolAndNormalize(
    data: Float32Array | number[],
    attentionMask: number[]
  ): number[] {
    const seqLen = MAX_SEQ_LENGTH;
    const hiddenSize = this.dimensions;
    const embedding = new Array(hiddenSize).fill(0);
    let maskSum = 0;

    // Mean pooling: average token embeddings weighted by attention mask
    for (let i = 0; i < seqLen; i++) {
      if (attentionMask[i] === 0) continue;
      maskSum += 1;
      for (let j = 0; j < hiddenSize; j++) {
        embedding[j] += data[i * hiddenSize + j];
      }
    }

    if (maskSum > 0) {
      for (let j = 0; j < hiddenSize; j++) {
        embedding[j] /= maskSum;
      }
    }

    // L2 normalization
    let norm = 0;
    for (let j = 0; j < hiddenSize; j++) {
      norm += embedding[j] * embedding[j];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let j = 0; j < hiddenSize; j++) {
        embedding[j] /= norm;
      }
    }

    return embedding;
  }
}
