/**
 * Session timeline management.
 *
 * Maintains a chronological log of agent actions per session.
 * Each entry records what happened, where, and whether it was allowed.
 */

import type { AgentEvent, AgentEventType } from '../types/events';
import type { AgentCapability } from '../types/agent';
import type { AgentSession, SessionSummary } from './types';

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Create a new timeline event.
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
  return {
    id: generateId(),
    type,
    timestamp: new Date().toISOString(),
    url,
    description,
    outcome: options?.outcome ?? 'informational',
    targetSelector: options?.targetSelector,
    attemptedAction: options?.attemptedAction,
    ruleId: options?.ruleId,
  };
}

/**
 * Append an event to a session's timeline and recalculate summary.
 */
export function appendEventToSession(
  session: AgentSession,
  event: AgentEvent
): AgentSession {
  const events = [...session.events, event];
  const summary = computeSessionSummary(events, session.startedAt);
  return { ...session, events, summary };
}

/**
 * Compute summary statistics from a session's event timeline.
 */
export function computeSessionSummary(
  events: AgentEvent[],
  startedAt: string
): SessionSummary {
  let totalActions = 0;
  let allowedActions = 0;
  let blockedActions = 0;
  let violations = 0;
  const urlCounts = new Map<string, number>();

  for (const event of events) {
    if (event.outcome === 'allowed') {
      totalActions++;
      allowedActions++;
    } else if (event.outcome === 'blocked') {
      totalActions++;
      blockedActions++;
    }
    if (event.type === 'boundary-violation') {
      violations++;
    }
    if (event.url) {
      urlCounts.set(event.url, (urlCounts.get(event.url) ?? 0) + 1);
    }
  }

  const topUrls = [...urlCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([url]) => url);

  let durationSeconds: number | null = null;
  if (events.length > 0) {
    const lastEvent = events[events.length - 1];
    const start = new Date(startedAt).getTime();
    const end = new Date(lastEvent.timestamp).getTime();
    durationSeconds = Math.round((end - start) / 1000);
  }

  return {
    totalActions,
    allowedActions,
    blockedActions,
    violations,
    topUrls,
    durationSeconds,
  };
}

/**
 * Filter timeline events by type, URL, or outcome.
 */
export function filterTimelineEvents(
  events: AgentEvent[],
  filters: {
    type?: AgentEventType;
    url?: string;
    outcome?: 'allowed' | 'blocked' | 'informational';
  }
): AgentEvent[] {
  return events.filter((event) => {
    if (filters.type !== undefined && event.type !== filters.type) return false;
    if (filters.url !== undefined && event.url !== filters.url) return false;
    if (filters.outcome !== undefined && event.outcome !== filters.outcome) return false;
    return true;
  });
}

/**
 * Get the most recent N events, newest first.
 */
export function getRecentEvents(events: AgentEvent[], count: number): AgentEvent[] {
  return events.slice(-count).reverse();
}
