/**
 * Shared type definitions for storage abstraction layer.
 * These types are backend-agnostic (no bun:sqlite or postgres.js imports).
 *
 * Row types represent the canonical data shape returned by all repository implementations.
 * SQLite and PostgreSQL adapters map their native results to these types.
 */

import type { PendingMessage } from '../worker-types.js';

// ============================================================
// Session Row Types
// ============================================================

export interface SDKSessionRow {
  id: number;
  content_session_id: string;
  memory_session_id: string | null;
  project: string;
  user_prompt: string | null;
  custom_title: string | null;
  status: 'active' | 'completed' | 'failed';
  cwd: string | null;
  hostname: string | null;
  mode: string | null;
  worker_port: number | null;
  prompt_counter: number | null;
  started_at: string;
  started_at_epoch: number;
  completed_at: string | null;
  completed_at_epoch: number | null;
}

// ============================================================
// Observation Row Types
// ============================================================

export interface ObservationRow {
  id: number;
  memory_session_id: string;
  project: string;
  type: string;
  text: string | null;
  title: string | null;
  subtitle: string | null;
  facts: string | null;       // JSON array string
  narrative: string | null;
  concepts: string | null;     // JSON array string
  files_read: string | null;   // JSON array string
  files_modified: string | null; // JSON array string
  prompt_number: number | null;
  discovery_tokens: number;
  content_hash: string | null;
  created_at: string;
  created_at_epoch: number;
}

export interface ObservationInput {
  type: string;
  title: string | null;
  subtitle: string | null;
  facts: string[];
  narrative: string | null;
  concepts: string[];
  files_read: string[];
  files_modified: string[];
}

export interface StoreObservationResult {
  id: number;
  createdAtEpoch: number;
}

// ============================================================
// Summary Row Types
// ============================================================

export interface SummaryRow {
  id: number;
  memory_session_id: string;
  project: string;
  request: string | null;
  investigated: string | null;
  learned: string | null;
  completed: string | null;
  next_steps: string | null;
  files_read: string | null;   // JSON array string
  files_edited: string | null; // JSON array string
  notes: string | null;
  prompt_number: number | null;
  discovery_tokens: number;
  created_at: string;
  created_at_epoch: number;
}

export interface SummaryInput {
  request: string;
  investigated: string;
  learned: string;
  completed: string;
  next_steps: string;
  notes: string | null;
}

export interface StoreSummaryResult {
  id: number;
  createdAtEpoch: number;
}

// ============================================================
// Prompt Row Types
// ============================================================

export interface PromptRow {
  id: number;
  content_session_id: string;
  prompt_number: number;
  prompt_text: string;
  project: string | null;      // From JOIN with sdk_sessions
  memory_session_id: string | null; // From JOIN with sdk_sessions
  created_at: string;
  created_at_epoch: number;
}

// ============================================================
// Pending Message Types
// ============================================================

export interface PersistentPendingMessage {
  id: number;
  session_db_id: number;
  content_session_id: string;
  message_type: 'observation' | 'summarize';
  tool_name: string | null;
  tool_input: string | null;
  tool_response: string | null;
  cwd: string | null;
  last_assistant_message: string | null;
  prompt_number: number | null;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  retry_count: number;
  created_at_epoch: number;
  started_processing_at_epoch: number | null;
  completed_at_epoch: number | null;
  failed_at_epoch: number | null;
}

export interface QueueMessage extends PersistentPendingMessage {
  project: string | null;
}

// ============================================================
// Search Result Types
// ============================================================

export interface SearchHit {
  id: number;
  table: 'observations' | 'summaries' | 'prompts';
  score: number;
  project: string;
}

export interface VectorSearchHit extends SearchHit {
  distance: number;
}

// ============================================================
// Timeline Types
// ============================================================

export interface TimelineEntry {
  id: number;
  type: 'observation' | 'summary' | 'prompt';
  title: string;
  project: string;
  created_at_epoch: number;
  memory_session_id?: string;
  content_session_id?: string;
}

// ============================================================
// Re-export PendingMessage from worker-types for interface use
// ============================================================

export type { PendingMessage };
