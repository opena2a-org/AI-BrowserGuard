/**
 * Session types for tracking agent activity over time.
 *
 * A session represents a single period of agent activity in the browser,
 * from detection to termination (or page unload).
 */

import type { AgentIdentity } from '../types/agent';
import type { AgentEvent } from '../types/events';
import type { DelegationRule } from '../types/delegation';

/**
 * A complete agent session with timeline of events.
 * The free tier stores up to 5 sessions in chrome.storage.local.
 */
export interface AgentSession {
  /** Unique session identifier (UUID v4). */
  id: string;

  /** The detected agent associated with this session. */
  agent: AgentIdentity;

  /** The delegation rule that was active during this session, if any. */
  delegationRule: DelegationRule | null;

  /** Chronological list of events that occurred during this session. */
  events: AgentEvent[];

  /** ISO 8601 timestamp when the session started (agent first detected). */
  startedAt: string;

  /** ISO 8601 timestamp when the session ended. Null if session is active. */
  endedAt: string | null;

  /** How the session ended. */
  endReason: 'kill-switch' | 'delegation-expired' | 'agent-disconnected' | 'page-unload' | null;

  /** Summary statistics for quick display in popup. */
  summary: SessionSummary;
}

/**
 * Summary statistics for a session.
 * Pre-computed for efficient rendering in the popup timeline view.
 */
export interface SessionSummary {
  /** Total number of actions the agent performed. */
  totalActions: number;

  /** Number of actions that were allowed. */
  allowedActions: number;

  /** Number of actions that were blocked. */
  blockedActions: number;

  /** Number of boundary violations. */
  violations: number;

  /** The most-visited URLs during this session (top 5). */
  topUrls: string[];

  /** Duration of the session in seconds. Null if session is still active. */
  durationSeconds: number | null;
}

/**
 * Aggregate storage schema for chrome.storage.local.
 * This is the top-level shape of all persisted data.
 */
export interface StorageSchema {
  /** Last 5 agent sessions, newest first. */
  sessions: AgentSession[];

  /** Currently active delegation rules. */
  delegationRules: DelegationRule[];

  /** User preferences and settings. */
  settings: UserSettings;

  /** Recent detection events for debugging (last 100). */
  detectionLog: import('../types/events').DetectionEvent[];
}

/**
 * User-configurable settings.
 */
export interface UserSettings {
  /** Whether detection is enabled. Default: true. */
  detectionEnabled: boolean;

  /** Whether boundary alerts show Chrome notifications. Default: true. */
  notificationsEnabled: boolean;

  /** Kill switch keyboard shortcut. Default: "Ctrl+Shift+K" / "Cmd+Shift+K". */
  killSwitchShortcut: string;

  /** Maximum sessions to retain. Default: 5 (free tier limit). */
  maxSessions: number;

  /** Maximum detection log entries. Default: 100. */
  maxDetectionLogEntries: number;

  /** Whether to automatically block unidentified agents. Default: false. */
  autoBlockUnknownAgents: boolean;
}

/**
 * Default user settings applied on first install.
 */
export const DEFAULT_SETTINGS: UserSettings = {
  detectionEnabled: true,
  notificationsEnabled: true,
  killSwitchShortcut: 'Ctrl+Shift+K',
  maxSessions: 5,
  maxDetectionLogEntries: 100,
  autoBlockUnknownAgents: false,
};
