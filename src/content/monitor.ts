/**
 * Capability boundary monitor.
 *
 * Tracks what an agent does vs. what it is allowed to do under the
 * active delegation rules. Intercepts actions at the content script
 * level before they can affect the page.
 */

import type { AgentCapability } from '../types/agent';
import type { AgentEvent, BoundaryViolation, MessagePayload } from '../types/events';
import type { DelegationRule, DelegationScope, SitePattern } from '../types/delegation';

/**
 * Monitor state tracking current delegation and observed actions.
 */
export interface MonitorState {
  /** The currently active delegation rule, if any. */
  activeRule: DelegationRule | null;

  /** Whether monitoring is active. */
  isMonitoring: boolean;

  /** Count of actions allowed in the current session. */
  allowedCount: number;

  /** Count of actions blocked in the current session. */
  blockedCount: number;

  /** Recent violations for display in popup. */
  recentViolations: BoundaryViolation[];
}

/**
 * Result of checking an action against delegation rules.
 */
export interface BoundaryCheckResult {
  /** Whether the action is permitted. */
  allowed: boolean;

  /** The rule that governs this decision, if any. */
  matchedRule: DelegationRule | null;

  /** Reason for the decision (human-readable). */
  reason: string;

  /** The specific site pattern or action restriction that matched. */
  matchDetail?: string;
}

/**
 * Check whether an agent action is permitted under the active delegation rules.
 *
 * Evaluation order:
 * 1. If no delegation rule is active, all actions are blocked (fail-closed).
 * 2. Check if the delegation has expired (time bound).
 * 3. Check URL against site patterns (first match wins).
 * 4. Check action type against action restrictions.
 * 5. If action passes all checks, it is allowed.
 *
 * @param action - The capability the agent is attempting to use.
 * @param url - The URL where the action is being attempted.
 * @param rule - The active delegation rule.
 * @returns Whether the action is allowed and why.
 *
 * TODO: Implement fail-closed default (no rule = blocked).
 * Check time bound expiration.
 * Match URL against site patterns using glob matching.
 * Check action type against restriction list.
 * Return detailed result for logging and notification.
 */
export function checkBoundary(
  action: AgentCapability,
  url: string,
  rule: DelegationRule | null
): BoundaryCheckResult {
  // TODO: Implement boundary checking logic.
  throw new Error('Not implemented');
}

/**
 * Match a URL against a site pattern using glob-style matching.
 *
 * Supported patterns:
 * - "*.example.com" matches any subdomain of example.com.
 * - "https://example.com/*" matches any path on example.com.
 * - "https://example.com/specific" matches exactly that URL.
 *
 * @param url - The URL to match.
 * @param pattern - The glob pattern to match against.
 * @returns Whether the URL matches the pattern.
 *
 * TODO: Convert glob pattern to regex.
 * Handle wildcard (*) as "match any characters except /".
 * Handle double wildcard (**) as "match any characters including /".
 * Handle protocol, hostname, and path separately for clarity.
 */
export function matchSitePattern(url: string, pattern: string): boolean {
  // TODO: Convert glob to regex and test against URL.
  throw new Error('Not implemented');
}

/**
 * Start monitoring agent actions in the current page.
 *
 * Sets up DOM event interceptors to catch agent actions before they execute:
 * - MutationObserver for DOM modifications.
 * - Event listeners for click, input, submit, and form events.
 * - Navigation observer for page changes.
 * - Network request interceptor for fetch/XHR (via monkey-patching).
 *
 * @param rule - The active delegation rule to enforce.
 * @param onViolation - Callback for boundary violations.
 * @param onAction - Callback for all agent actions (allowed and blocked).
 * @returns Cleanup function to stop monitoring.
 *
 * TODO: Set up MutationObserver on document.body for DOM changes.
 * Add capturing event listeners for click, input, submit, keydown.
 * For each intercepted event, determine the agent capability being used.
 * Call checkBoundary() and either allow or preventDefault+stopPropagation.
 * Fire onViolation for blocked actions, onAction for all actions.
 * Return cleanup function that disconnects observer and removes listeners.
 */
export function startBoundaryMonitor(
  rule: DelegationRule | null,
  onViolation: (violation: BoundaryViolation) => void,
  onAction: (event: AgentEvent) => void
): () => void {
  // TODO: Set up DOM interception and boundary enforcement.
  throw new Error('Not implemented');
}

/**
 * Update the active delegation rule for the monitor.
 * Called when the user changes delegation settings via the popup.
 *
 * @param rule - The new active delegation rule, or null to block everything.
 *
 * TODO: Update the internal monitor state.
 * Re-evaluate any pending actions against the new rule.
 */
export function updateActiveRule(rule: DelegationRule | null): void {
  // TODO: Update internal state and re-evaluate.
  throw new Error('Not implemented');
}

/**
 * Check if the current delegation has expired based on its time bound.
 *
 * @param rule - The delegation rule to check.
 * @returns Whether the delegation has expired.
 *
 * TODO: Compare current time against rule.scope.timeBound.expiresAt.
 * If timeBound is null, the delegation never expires.
 */
export function isDelegationExpired(rule: DelegationRule): boolean {
  // TODO: Check time bound expiration.
  throw new Error('Not implemented');
}

/**
 * Get the current monitor state for display in the popup.
 *
 * @returns The current monitoring state.
 */
export function getMonitorState(): MonitorState {
  // TODO: Return the current internal monitor state.
  throw new Error('Not implemented');
}
