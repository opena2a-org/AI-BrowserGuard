/**
 * Session timeline management.
 *
 * Maintains a chronological log of agent actions per session.
 * Each entry records what happened, where, and whether it was allowed.
 */

import type { AgentEvent, AgentEventType } from '../types/events';
import type { AgentCapability } from '../types/agent';
import type { AgentSession, SessionSummary } from './types';

/**
 * Create a new timeline event.
 *
 * @param type - The event type.
 * @param url - The URL where the event occurred.
 * @param description - Human-readable description of the event.
 * @param options - Optional fields (targetSelector, attemptedAction, outcome, ruleId).
 * @returns A fully populated AgentEvent with generated ID and timestamp.
 *
 * TODO: Generate UUID v4 for the event ID.
 * Set timestamp to current ISO 8601 time.
 * Default outcome to "informational" if not provided.
 */
export function createTimelineEvent(
  type: AgentEventType,
  url: string,
  description: string,
  options?: {
    targetSelector?: string;
    attemptedAction?: AgentCapability;
    outcome?: 'allowed' | 'blocked' | 'informational';
    ruleId?: string;
  }
): AgentEvent {
  // TODO: Generate UUID, set timestamp, merge options with defaults.
  throw new Error('Not implemented');
}

/**
 * Append an event to a session's timeline.
 * Also updates the session summary statistics.
 *
 * @param session - The session to append to.
 * @param event - The event to append.
 * @returns The updated session with the new event and recalculated summary.
 *
 * TODO: Push event to session.events array.
 * Recalculate summary statistics (totalActions, allowedActions, blockedActions, violations).
 * Update topUrls based on URL frequency.
 * Update durationSeconds based on first and last event timestamps.
 */
export function appendEventToSession(
  session: AgentSession,
  event: AgentEvent
): AgentSession {
  // TODO: Append event, recalculate summary, return updated session.
  throw new Error('Not implemented');
}

/**
 * Compute summary statistics from a session's event timeline.
 *
 * @param events - The session's event array.
 * @param startedAt - ISO 8601 timestamp when the session started.
 * @returns Computed summary statistics.
 *
 * TODO: Count events by outcome type.
 * Extract unique URLs and rank by frequency.
 * Calculate duration from startedAt to the last event timestamp.
 */
export function computeSessionSummary(
  events: AgentEvent[],
  startedAt: string
): SessionSummary {
  // TODO: Iterate events, count by outcome, extract URLs, calculate duration.
  throw new Error('Not implemented');
}

/**
 * Filter timeline events by type, URL, or outcome.
 * Used by the popup to display filtered views of session activity.
 *
 * @param events - The full event array to filter.
 * @param filters - Filter criteria. All provided filters are ANDed together.
 * @returns Filtered array of events.
 */
export function filterTimelineEvents(
  events: AgentEvent[],
  filters: {
    type?: AgentEventType;
    url?: string;
    outcome?: 'allowed' | 'blocked' | 'informational';
  }
): AgentEvent[] {
  // TODO: Apply each filter criterion. Return events matching all criteria.
  throw new Error('Not implemented');
}

/**
 * Get the most recent N events from a session.
 * Used for popup display where space is limited.
 *
 * @param events - The full event array.
 * @param count - Maximum number of events to return.
 * @returns The most recent events, newest first.
 */
export function getRecentEvents(events: AgentEvent[], count: number): AgentEvent[] {
  // TODO: Slice the last `count` events and reverse for newest-first ordering.
  throw new Error('Not implemented');
}
