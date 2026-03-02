/**
 * Session persistence layer using chrome.storage.local.
 *
 * Manages reading and writing of sessions, delegation rules, settings,
 * and detection logs. Enforces session limits (5 sessions, 100 log entries).
 */

import type { AgentSession, StorageSchema, UserSettings } from './types';
import { DEFAULT_SETTINGS } from './types';
import type { DelegationRule } from '../types/delegation';
import type { DetectionEvent } from '../types/events';

const DEFAULT_STORAGE: StorageSchema = {
  sessions: [],
  delegationRules: [],
  settings: DEFAULT_SETTINGS,
  detectionLog: [],
};

/**
 * Retrieve the full storage schema from chrome.storage.local.
 * Returns default values for any missing keys.
 */
export async function getStorageState(): Promise<StorageSchema> {
  try {
    const result = await chrome.storage.local.get(
      Object.keys(DEFAULT_STORAGE)
    );
    return {
      sessions: result.sessions ?? DEFAULT_STORAGE.sessions,
      delegationRules: result.delegationRules ?? DEFAULT_STORAGE.delegationRules,
      settings: { ...DEFAULT_SETTINGS, ...(result.settings ?? {}) },
      detectionLog: result.detectionLog ?? DEFAULT_STORAGE.detectionLog,
    };
  } catch (err) {
    console.error('[AI Browser Guard] Storage read error:', err);
    return { ...DEFAULT_STORAGE };
  }
}

/**
 * Save a new agent session to storage.
 * Enforces the limit of 5 sessions by evicting the oldest.
 */
export async function saveSession(session: AgentSession): Promise<void> {
  try {
    const state = await getStorageState();
    const sessions = [session, ...state.sessions];
    const maxSessions = state.settings.maxSessions ?? 5;
    if (sessions.length > maxSessions) {
      sessions.length = maxSessions;
    }
    await chrome.storage.local.set({ sessions });
  } catch (err) {
    console.error('[AI Browser Guard] Failed to save session:', err);
  }
}

/**
 * Update an existing session in storage.
 */
export async function updateSession(
  sessionId: string,
  updater: (session: AgentSession) => AgentSession
): Promise<void> {
  try {
    const state = await getStorageState();
    const index = state.sessions.findIndex((s) => s.id === sessionId);
    if (index === -1) {
      console.warn('[AI Browser Guard] Session not found:', sessionId);
      return;
    }
    state.sessions[index] = updater(state.sessions[index]);
    await chrome.storage.local.set({ sessions: state.sessions });
  } catch (err) {
    console.error('[AI Browser Guard] Failed to update session:', err);
  }
}

/**
 * Retrieve all stored sessions.
 */
export async function getSessions(): Promise<AgentSession[]> {
  const state = await getStorageState();
  return state.sessions;
}

/**
 * Save or update delegation rules in storage.
 */
export async function saveDelegationRules(rules: DelegationRule[]): Promise<void> {
  try {
    await chrome.storage.local.set({ delegationRules: rules });
  } catch (err) {
    console.error('[AI Browser Guard] Failed to save delegation rules:', err);
  }
}

/**
 * Retrieve all delegation rules from storage.
 */
export async function getDelegationRules(): Promise<DelegationRule[]> {
  const state = await getStorageState();
  return state.delegationRules;
}

/**
 * Append a detection event to the log.
 * Enforces the limit of 100 log entries by evicting the oldest.
 */
export async function appendDetectionLog(event: DetectionEvent): Promise<void> {
  try {
    const state = await getStorageState();
    const log = [...state.detectionLog, event];
    const maxEntries = state.settings.maxDetectionLogEntries ?? 100;
    if (log.length > maxEntries) {
      log.splice(0, log.length - maxEntries);
    }
    await chrome.storage.local.set({ detectionLog: log });
  } catch (err) {
    console.error('[AI Browser Guard] Failed to append detection log:', err);
  }
}

/**
 * Retrieve user settings from storage.
 */
export async function getSettings(): Promise<UserSettings> {
  const state = await getStorageState();
  return state.settings;
}

/**
 * Update user settings in storage (partial merge).
 */
export async function updateSettings(updates: Partial<UserSettings>): Promise<void> {
  try {
    const current = await getSettings();
    const merged = { ...current, ...updates };
    await chrome.storage.local.set({ settings: merged });
  } catch (err) {
    console.error('[AI Browser Guard] Failed to update settings:', err);
  }
}

/**
 * Clear all stored data.
 */
export async function clearAllStorage(): Promise<void> {
  try {
    await chrome.storage.local.clear();
  } catch (err) {
    console.error('[AI Browser Guard] Failed to clear storage:', err);
  }
}
