/**
 * Types for the Registry contribution pipeline.
 * Browser Guard contributes anonymized detection data to the OpenA2A
 * trust registry, helping build community trust scores for AI agents.
 */

/** A single contribution event ready for submission to the Registry. */
export interface ContributeEvent {
  /** Event type identifier. */
  type: 'detection_summary' | 'session_summary' | 'behavioral_summary';

  /** ISO 8601 timestamp when this event was created. */
  timestamp: string;

  /** Detection data (anonymized -- no URLs, no page content, no user data). */
  data: DetectionContribution | SessionContribution | BehavioralContribution;
}

/** Anonymized detection event for a single agent detection. */
export interface DetectionContribution {
  /** Framework detected (e.g., "playwright", "puppeteer", "selenium"). */
  framework: string;

  /** Detection methods used (e.g., ["cdp-connection", "framework-fingerprint"]). */
  detectionMethods: string[];

  /** Confidence level of the detection. */
  confidence: string;

  /** Whether a delegation rule was active during detection. */
  hadDelegation: boolean;
}

/** Anonymized session summary contributed at session end. */
export interface SessionContribution {
  /** Framework type for the agent in this session. */
  framework: string;

  /** Duration of the session in seconds. */
  durationSeconds: number;

  /** Total actions observed. */
  totalActions: number;

  /** Actions that were allowed. */
  allowedActions: number;

  /** Actions that were blocked. */
  blockedActions: number;

  /** Number of boundary violations. */
  violations: number;

  /** How the session ended. */
  endReason: string;

  /** Whether a delegation rule was active. */
  hadDelegation: boolean;

  /** Types of actions observed (e.g., ["navigate", "click", "type-text"]). */
  actionTypes: string[];
}

/** Anonymized behavioral summary (aggregated over time). */
export interface BehavioralContribution {
  /** Framework type. */
  framework: string;

  /** Total sessions observed for this framework. */
  totalSessions: number;

  /** Average session duration in seconds. */
  avgDurationSeconds: number;

  /** Total actions observed across sessions. */
  totalActions: number;

  /** Overall block rate (0.0 - 1.0). */
  blockRate: number;
}

/** Consent state for the contribution feature. */
export interface ContributeConsent {
  /** Whether the user has opted in to contributing. */
  enabled: boolean;

  /** ISO 8601 timestamp when consent was granted (or null). */
  grantedAt: string | null;

  /** Whether the delayed consent tip has been shown. */
  tipShown: boolean;

  /** Whether the delayed consent tip has been dismissed. */
  tipDismissed: boolean;

  /** Total detection events since install (used to trigger tip). */
  detectionsSinceInstall: number;

  /** ISO 8601 timestamp of first detection (used for 3-day trigger). */
  firstDetectionAt: string | null;
}

/** Queued batch of events waiting to be sent. */
export interface ContributeQueue {
  /** Events waiting to be sent. */
  events: ContributeEvent[];

  /** ISO 8601 timestamp of last successful flush. */
  lastFlushedAt: string | null;

  /** Number of successful flushes. */
  totalFlushes: number;

  /** Total events contributed across all time. */
  totalContributed: number;
}

export const DEFAULT_CONSENT: ContributeConsent = {
  enabled: false,
  grantedAt: null,
  tipShown: false,
  tipDismissed: false,
  detectionsSinceInstall: 0,
  firstDetectionAt: null,
};

export const DEFAULT_QUEUE: ContributeQueue = {
  events: [],
  lastFlushedAt: null,
  totalFlushes: 0,
  totalContributed: 0,
};
