/**
 * Chrome notification integration for boundary alerts.
 *
 * Delivers system-level notifications when agents violate delegation
 * boundaries. Uses the chrome.notifications API to show actionable
 * alerts outside the browser window.
 */

import type { BoundaryAlert, AlertSeverity } from './boundary';

/**
 * Notification configuration.
 */
export interface NotificationConfig {
  /** Whether notifications are enabled. */
  enabled: boolean;

  /** Minimum severity level to trigger a notification. */
  minimumSeverity: AlertSeverity;

  /** Whether to play a sound with notifications. */
  playSound: boolean;

  /** Auto-dismiss timeout in milliseconds. 0 = no auto-dismiss. */
  autoDismissMs: number;
}

/**
 * Default notification configuration.
 */
export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  minimumSeverity: 'medium',
  playSound: true,
  autoDismissMs: 10000,
};

/**
 * Show a Chrome notification for a boundary alert.
 *
 * @param alert - The boundary alert to notify about.
 * @param config - Notification configuration.
 * @returns The notification ID, or null if notification was suppressed.
 *
 * TODO: Check if notifications are enabled and alert meets minimum severity.
 * Use chrome.notifications.create with:
 *   - type: "basic"
 *   - iconUrl: appropriate icon based on severity
 *   - title: alert.title
 *   - message: alert.message
 *   - priority: mapped from severity (critical=2, high=1, medium=0, low=0)
 *   - buttons: ["Allow once", "Dismiss"] if allowOneTimeOverride is true
 * Set up auto-dismiss timeout if configured.
 * Return the notification ID.
 */
export function showBoundaryNotification(
  alert: BoundaryAlert,
  config?: Partial<NotificationConfig>
): string | null {
  // TODO: Create Chrome notification for boundary alert.
  throw new Error('Not implemented');
}

/**
 * Map alert severity to notification priority.
 *
 * @param severity - The alert severity.
 * @returns Chrome notification priority (0, 1, or 2).
 */
export function severityToPriority(severity: AlertSeverity): number {
  const priorityMap: Record<AlertSeverity, number> = {
    critical: 2,
    high: 1,
    medium: 0,
    low: 0,
  };
  return priorityMap[severity];
}

/**
 * Check if a severity meets the minimum threshold for notification.
 *
 * @param severity - The alert's severity.
 * @param minimum - The minimum severity to trigger notification.
 * @returns Whether the alert should generate a notification.
 */
export function meetsSeverityThreshold(
  severity: AlertSeverity,
  minimum: AlertSeverity
): boolean {
  const order: AlertSeverity[] = ['low', 'medium', 'high', 'critical'];
  return order.indexOf(severity) >= order.indexOf(minimum);
}

/**
 * Set up notification button click handlers.
 *
 * Chrome notifications support up to 2 action buttons.
 * Button 0: "Allow once" - triggers one-time override.
 * Button 1: "Dismiss" - closes the notification.
 *
 * @param onAllowOnce - Callback when "Allow once" is clicked.
 * @returns Cleanup function to remove the listener.
 *
 * TODO: Add chrome.notifications.onButtonClicked listener.
 * Route button index to appropriate callback.
 * Return function that removes the listener.
 */
export function setupNotificationHandlers(
  onAllowOnce: (notificationId: string) => void
): () => void {
  // TODO: Set up chrome.notifications.onButtonClicked listener.
  throw new Error('Not implemented');
}

/**
 * Clear all active notifications.
 * Called during kill switch activation to clean up the notification area.
 *
 * TODO: Use chrome.notifications.getAll to find active notifications.
 * Clear each one with chrome.notifications.clear.
 */
export async function clearAllNotifications(): Promise<void> {
  // TODO: Enumerate and clear all active notifications.
  throw new Error('Not implemented');
}
