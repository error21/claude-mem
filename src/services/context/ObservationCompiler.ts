/**
 * ObservationCompiler - Query building and data retrieval for context
 *
 * Handles database queries for observations and summaries, plus transcript extraction.
 * Uses IStorageRepository for backend-agnostic queries (supports both SQLite and PostgreSQL).
 */

import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { logger } from '../../utils/logger.js';
import { CLAUDE_CONFIG_DIR } from '../../shared/paths.js';
import type { IStorageRepository } from '../storage/interfaces.js';
import type { ObservationRow, SummaryRow } from '../storage/types.js';
import type {
  ContextConfig,
  Observation,
  SessionSummary,
  SummaryTimelineItem,
  TimelineItem,
  PriorMessages,
} from './types.js';
import { SUMMARY_LOOKAHEAD } from './types.js';

/**
 * Fetch multiplier: we request more rows than needed from the repository
 * to account for in-memory type/concept filtering reducing the result set.
 */
const FETCH_MULTIPLIER = 5;

/**
 * Check if an observation's concepts array intersects with the required concepts.
 * Concepts are stored as a JSON array string (e.g. '["architecture","testing"]').
 */
function hasMatchingConcept(conceptsJson: string | null, requiredConcepts: Set<string>): boolean {
  if (!conceptsJson) return false;
  try {
    const concepts: string[] = JSON.parse(conceptsJson);
    return concepts.some(c => requiredConcepts.has(c));
  } catch {
    return false;
  }
}

/**
 * Map an ObservationRow to the Observation type used by context rendering.
 */
function toObservation(row: ObservationRow): Observation {
  return {
    id: row.id,
    memory_session_id: row.memory_session_id,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle,
    narrative: row.narrative,
    facts: row.facts,
    concepts: row.concepts,
    files_read: row.files_read,
    files_modified: row.files_modified,
    discovery_tokens: row.discovery_tokens,
    created_at: row.created_at,
    created_at_epoch: row.created_at_epoch,
    project: row.project,
  };
}

/**
 * Map a SummaryRow to the SessionSummary type used by context rendering.
 */
function toSessionSummary(row: SummaryRow): SessionSummary {
  return {
    id: row.id,
    memory_session_id: row.memory_session_id,
    request: row.request,
    investigated: row.investigated,
    learned: row.learned,
    completed: row.completed,
    next_steps: row.next_steps,
    created_at: row.created_at,
    created_at_epoch: row.created_at_epoch,
    project: row.project,
  };
}

/**
 * Query observations from database with type and concept filtering.
 * Uses IStorageRepository for backend-agnostic access (SQLite and PostgreSQL).
 */
export async function queryObservations(
  repo: IStorageRepository,
  project: string,
  config: ContextConfig
): Promise<Observation[]> {
  const typeSet = config.observationTypes;
  const conceptSet = config.observationConcepts;
  const fetchLimit = config.totalObservationCount * FETCH_MULTIPLIER;

  const rows = await repo.observations.getRecentObservations(project, fetchLimit);

  return rows
    .filter(row => typeSet.has(row.type) && hasMatchingConcept(row.concepts, conceptSet))
    .slice(0, config.totalObservationCount)
    .map(toObservation);
}

/**
 * Query recent session summaries from database.
 * Uses IStorageRepository for backend-agnostic access (SQLite and PostgreSQL).
 */
export async function querySummaries(
  repo: IStorageRepository,
  project: string,
  config: ContextConfig
): Promise<SessionSummary[]> {
  const limit = config.sessionCount + SUMMARY_LOOKAHEAD;
  const rows = await repo.summaries.getRecentSummaries(project, limit);
  return rows.map(toSessionSummary);
}

/**
 * Query observations from multiple projects (for worktree support).
 *
 * Returns observations from all specified projects, filtered by type and concept,
 * interleaved chronologically. Uses IStorageRepository for backend-agnostic access.
 */
export async function queryObservationsMulti(
  repo: IStorageRepository,
  projects: string[],
  config: ContextConfig
): Promise<Observation[]> {
  const typeSet = config.observationTypes;
  const conceptSet = config.observationConcepts;
  const projectSet = new Set(projects);
  const fetchLimit = config.totalObservationCount * FETCH_MULTIPLIER;

  const rows = await repo.observations.getAllRecentObservations(fetchLimit);

  return rows
    .filter(row =>
      projectSet.has(row.project) &&
      typeSet.has(row.type) &&
      hasMatchingConcept(row.concepts, conceptSet)
    )
    .slice(0, config.totalObservationCount)
    .map(toObservation);
}

/**
 * Query session summaries from multiple projects (for worktree support).
 *
 * Returns summaries from all specified projects, interleaved chronologically.
 * Uses IStorageRepository for backend-agnostic access.
 */
export async function querySummariesMulti(
  repo: IStorageRepository,
  projects: string[],
  config: ContextConfig
): Promise<SessionSummary[]> {
  const projectSet = new Set(projects);
  const fetchLimit = (config.sessionCount + SUMMARY_LOOKAHEAD) * FETCH_MULTIPLIER;

  const rows = await repo.summaries.getAllRecentSummaries(fetchLimit);

  return rows
    .filter(row => projectSet.has(row.project))
    .slice(0, config.sessionCount + SUMMARY_LOOKAHEAD)
    .map(toSessionSummary);
}

/**
 * Convert cwd path to dashed format for transcript lookup
 */
function cwdToDashed(cwd: string): string {
  return cwd.replace(/\//g, '-');
}

/**
 * Extract prior messages from transcript file
 */
export function extractPriorMessages(transcriptPath: string): PriorMessages {
  try {
    if (!existsSync(transcriptPath)) {
      return { userMessage: '', assistantMessage: '' };
    }

    const content = readFileSync(transcriptPath, 'utf-8').trim();
    if (!content) {
      return { userMessage: '', assistantMessage: '' };
    }

    const lines = content.split('\n').filter(line => line.trim());
    let lastAssistantMessage = '';

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const line = lines[i];
        if (!line.includes('"type":"assistant"')) {
          continue;
        }

        const entry = JSON.parse(line);
        if (entry.type === 'assistant' && entry.message?.content && Array.isArray(entry.message.content)) {
          let text = '';
          for (const block of entry.message.content) {
            if (block.type === 'text') {
              text += block.text;
            }
          }
          text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
          if (text) {
            lastAssistantMessage = text;
            break;
          }
        }
      } catch (parseError) {
        logger.debug('PARSER', 'Skipping malformed transcript line', { lineIndex: i }, parseError as Error);
        continue;
      }
    }

    return { userMessage: '', assistantMessage: lastAssistantMessage };
  } catch (error) {
    logger.failure('WORKER', `Failed to extract prior messages from transcript`, { transcriptPath }, error as Error);
    return { userMessage: '', assistantMessage: '' };
  }
}

/**
 * Get prior session messages if enabled
 */
export function getPriorSessionMessages(
  observations: Observation[],
  config: ContextConfig,
  currentSessionId: string | undefined,
  cwd: string
): PriorMessages {
  if (!config.showLastMessage || observations.length === 0) {
    return { userMessage: '', assistantMessage: '' };
  }

  const priorSessionObs = observations.find(obs => obs.memory_session_id !== currentSessionId);
  if (!priorSessionObs) {
    return { userMessage: '', assistantMessage: '' };
  }

  const priorSessionId = priorSessionObs.memory_session_id;
  const dashedCwd = cwdToDashed(cwd);
  // Use CLAUDE_CONFIG_DIR to support custom Claude config directories
  const transcriptPath = path.join(CLAUDE_CONFIG_DIR, 'projects', dashedCwd, `${priorSessionId}.jsonl`);
  return extractPriorMessages(transcriptPath);
}

/**
 * Prepare summaries for timeline display
 */
export function prepareSummariesForTimeline(
  displaySummaries: SessionSummary[],
  allSummaries: SessionSummary[]
): SummaryTimelineItem[] {
  const mostRecentSummaryId = allSummaries[0]?.id;

  return displaySummaries.map((summary, i) => {
    const olderSummary = i === 0 ? null : allSummaries[i + 1];
    return {
      ...summary,
      displayEpoch: olderSummary ? olderSummary.created_at_epoch : summary.created_at_epoch,
      displayTime: olderSummary ? olderSummary.created_at : summary.created_at,
      shouldShowLink: summary.id !== mostRecentSummaryId
    };
  });
}

/**
 * Build unified timeline from observations and summaries
 */
export function buildTimeline(
  observations: Observation[],
  summaries: SummaryTimelineItem[]
): TimelineItem[] {
  const timeline: TimelineItem[] = [
    ...observations.map(obs => ({ type: 'observation' as const, data: obs })),
    ...summaries.map(summary => ({ type: 'summary' as const, data: summary }))
  ];

  // Sort chronologically
  timeline.sort((a, b) => {
    const aEpoch = a.type === 'observation' ? a.data.created_at_epoch : a.data.displayEpoch;
    const bEpoch = b.type === 'observation' ? b.data.created_at_epoch : b.data.displayEpoch;
    return aEpoch - bEpoch;
  });

  return timeline;
}

/**
 * Get set of observation IDs that should show full details
 */
export function getFullObservationIds(observations: Observation[], count: number): Set<number> {
  return new Set(
    observations
      .slice(0, count)
      .map(obs => obs.id)
  );
}
