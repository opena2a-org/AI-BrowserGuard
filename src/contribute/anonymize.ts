/**
 * Anonymization functions for contribution data.
 * Strips all personally identifiable information before sending to the Registry.
 *
 * What is KEPT: framework type, detection method, confidence, action counts, durations
 * What is STRIPPED: URLs, page content, user data, IP addresses, selectors, element content
 */

import type { DetectionEvent } from '../types/events';
import type { AgentSession } from '../session/types';
import type { DetectionContribution, SessionContribution, ContributeEvent } from './types';

/**
 * Create an anonymized detection contribution from a detection event.
 */
export function anonymizeDetection(event: DetectionEvent, hadDelegation: boolean): ContributeEvent {
  const data: DetectionContribution = {
    framework: event.agent?.type ?? 'unknown',
    detectionMethods: [...event.methods],
    confidence: event.confidence,
    hadDelegation,
  };

  return {
    type: 'detection_summary',
    timestamp: new Date().toISOString(),
    data,
  };
}

/**
 * Create an anonymized session summary contribution from a completed session.
 */
export function anonymizeSession(session: AgentSession): ContributeEvent {
  const durationSeconds = session.endedAt && session.startedAt
    ? Math.floor((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
    : 0;

  // Extract unique action types from events (strip URLs and selectors)
  const actionTypes = new Set<string>();
  for (const event of session.events) {
    if (event.attemptedAction) {
      actionTypes.add(event.attemptedAction);
    }
  }

  const data: SessionContribution = {
    framework: session.agent.type,
    durationSeconds,
    totalActions: session.summary.totalActions,
    allowedActions: session.summary.allowedActions,
    blockedActions: session.summary.blockedActions,
    violations: session.summary.violations,
    endReason: session.endReason ?? 'unknown',
    hadDelegation: session.delegationRule !== null,
    actionTypes: Array.from(actionTypes),
  };

  return {
    type: 'session_summary',
    timestamp: new Date().toISOString(),
    data,
  };
}
