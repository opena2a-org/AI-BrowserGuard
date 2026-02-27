/**
 * Capability boundary alert system.
 *
 * Generates alerts when an agent attempts actions that exceed its
 * delegated permissions. Provides the data needed for both in-popup
 * display and Chrome notification delivery.
 */

import type { BoundaryViolation, AgentEvent } from '../types/events';
import type { AgentCapability } from '../types/agent';
import type { DelegationRule } from '../types/delegation';

/**
 * Alert severity based on the type of violation.
 * - "critical": Action that could cause data loss or financial harm (e.g., form submission on banking site).
 * - "high": Action that modifies state (e.g., clicking a delete button).
 * - "medium": Action that could leak information (e.g., navigating to a blocked site).
 * - "low": Action that is out of scope but low risk (e.g., opening a new tab).
 */
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * A fully formed alert ready for display and notification.
 */
export interface BoundaryAlert {
  /** The underlying violation data. */
  violation: BoundaryViolation;

  /** Computed severity of this alert. */
  severity: AlertSeverity;

  /** Human-readable title for the alert (e.g., "Form submission blocked"). */
  title: string;

  /** Detailed message explaining what happened and why it was blocked. */
  message: string;

  /** Whether the user has the option to allow this action as a one-time override. */
  allowOneTimeOverride: boolean;

  /** Whether this alert has been acknowledged by the user. */
  acknowledged: boolean;
}

/**
 * Create a boundary alert from a violation.
 *
 * @param violation - The boundary violation that triggered this alert.
 * @param rule - The delegation rule that was violated.
 * @returns A fully formed alert for display.
 *
 * TODO: Determine severity based on the attempted action and URL.
 * Map capabilities to severity: submit-form/execute-script = critical,
 * click/modify-dom = high, navigate = medium, read-dom/open-tab = low.
 * Generate title and message from violation details.
 * Set allowOneTimeOverride to true for medium/low severity.
 */
export function createBoundaryAlert(
  violation: BoundaryViolation,
  rule: DelegationRule
): BoundaryAlert {
  // TODO: Build alert from violation and rule.
  throw new Error('Not implemented');
}

/**
 * Determine the severity of a capability violation.
 *
 * @param capability - The capability that was attempted.
 * @param url - The URL where it was attempted.
 * @returns The computed severity.
 *
 * TODO: Map capabilities to base severity.
 * Upgrade severity if URL matches sensitive patterns (e.g., *.bank.com, *.gov).
 * Return the final severity.
 */
export function classifyViolationSeverity(
  capability: AgentCapability,
  url: string
): AlertSeverity {
  // TODO: Classify severity based on capability and URL sensitivity.
  throw new Error('Not implemented');
}

/**
 * Generate a human-readable alert title from a capability violation.
 *
 * @param capability - The attempted capability.
 * @returns A concise title string (e.g., "Form submission blocked").
 */
export function generateAlertTitle(capability: AgentCapability): string {
  // TODO: Map each capability to a descriptive title.
  const titles: Record<AgentCapability, string> = {
    navigate: 'Navigation blocked',
    'read-dom': 'Page read blocked',
    click: 'Click interaction blocked',
    'type-text': 'Text input blocked',
    'submit-form': 'Form submission blocked',
    'download-file': 'File download blocked',
    'open-tab': 'New tab blocked',
    'close-tab': 'Tab closure blocked',
    screenshot: 'Screenshot blocked',
    'execute-script': 'Script execution blocked',
    'modify-dom': 'DOM modification blocked',
  };
  return titles[capability] || 'Action blocked';
}

/**
 * Generate a detailed alert message.
 *
 * @param violation - The violation details.
 * @param ruleName - The name of the rule that blocked the action.
 * @returns A multi-line message suitable for notification display.
 *
 * TODO: Format message with: what was attempted, on which URL,
 * which rule blocked it, and what the user can do.
 */
export function generateAlertMessage(
  violation: BoundaryViolation,
  ruleName: string
): string {
  // TODO: Build detailed message from violation and rule name.
  throw new Error('Not implemented');
}

/**
 * Handle a user's one-time override of a blocked action.
 *
 * When a user clicks "Allow once" on an alert, this function:
 * 1. Marks the violation's userOverride as true.
 * 2. Temporarily allows the specific action on the specific URL.
 * 3. Logs the override in the session timeline.
 *
 * @param alertId - The ID of the alert being overridden.
 * @param violation - The violation to override.
 * @returns Updated violation with userOverride = true.
 *
 * TODO: Set userOverride = true.
 * Send a message to the content script to allow the blocked action.
 * Create a timeline event logging the user override.
 */
export function handleOneTimeOverride(
  alertId: string,
  violation: BoundaryViolation
): BoundaryViolation {
  // TODO: Process the one-time override.
  throw new Error('Not implemented');
}
