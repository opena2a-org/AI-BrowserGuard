/**
 * Background service worker entry point.
 *
 * Central coordinator for the extension.
 */

import type { MessagePayload, DetectionEvent, KillSwitchEvent, AgentEvent, BoundaryViolation } from '../types/events';
import type { AgentIdentity } from '../types/agent';
import type { DelegationRule } from '../types/delegation';
import type { AgentSession } from '../session/types';
import { getStorageState, saveSession, updateSession, saveDelegationRules, appendDetectionLog, updateSettings } from '../session/storage';
import { createTimelineEvent, appendEventToSession } from '../session/timeline';
import { executeBackgroundKillSwitch, createInitialKillSwitchState } from '../killswitch/index';
import type { KillSwitchState } from '../killswitch/index';
import { isTimeBoundExpired } from '../delegation/rules';
import { setupNotificationHandlers, clearAllNotifications } from '../alerts/notification';
import { createBoundaryAlert } from '../alerts/boundary';
import type { BoundaryAlert } from '../alerts/boundary';

interface BackgroundState {
  activeAgents: Map<number, AgentIdentity>;
  activeSessions: Map<number, string>; // tabId -> sessionId
  delegationRules: DelegationRule[];
  killSwitch: KillSwitchState;
  recentAlerts: BoundaryAlert[];
}

const state: BackgroundState = {
  activeAgents: new Map(),
  activeSessions: new Map(),
  delegationRules: [],
  killSwitch: createInitialKillSwitchState(),
  recentAlerts: [],
};

function initialize(): void {
  loadPersistedState().then(() => {
    updateBadge();
  }).catch((err) => {
    console.error('[AI Browser Guard] Failed to load state:', err);
  });

  // Message routing
  chrome.runtime.onMessage.addListener(handleMessage);

  // Tab lifecycle
  chrome.tabs.onRemoved.addListener((tabId) => {
    handleTabRemoved(tabId).catch(() => { /* ignore */ });
  });

  // Delegation expiration alarm
  chrome.alarms.create('delegation-check', { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'delegation-check') {
      checkDelegationExpiration().catch(() => { /* ignore */ });
    }
  });

  // Kill switch keyboard shortcut
  registerKeyboardShortcut();

  // Notification handlers
  setupNotificationHandlers((notificationId) => {
    // Handle "Allow once" clicks - future enhancement
    console.log('[AI Browser Guard] Override requested for notification:', notificationId);
  });

  console.log('[AI Browser Guard] Background service worker initialized');
}

async function loadPersistedState(): Promise<void> {
  const stored = await getStorageState();
  state.delegationRules = stored.delegationRules;

  // Check for active sessions that may have survived a restart
  for (const session of stored.sessions) {
    if (!session.endedAt) {
      // Mark stale sessions as ended
      await updateSession(session.id, (s) => ({
        ...s,
        endedAt: new Date().toISOString(),
        endReason: 'agent-disconnected',
      }));
    }
  }
}

function handleMessage(
  message: MessagePayload,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean {
  if (!message || !message.type) return false;

  const tabId = sender.tab?.id;

  switch (message.type) {
    case 'DETECTION_RESULT': {
      if (tabId !== undefined) {
        handleDetection(tabId, message.data as DetectionEvent).then(() => {
          sendResponse({ success: true });
        }).catch(() => {
          sendResponse({ success: false });
        });
        return true; // async response
      }
      return false;
    }

    case 'AGENT_ACTION': {
      if (tabId !== undefined) {
        handleAgentAction(tabId, message.data as AgentEvent);
      }
      sendResponse({ success: true });
      return false;
    }

    case 'BOUNDARY_CHECK_REQUEST': {
      const violation = message.data as BoundaryViolation;
      handleBoundaryViolation(tabId, violation);
      sendResponse({ success: true });
      return false;
    }

    case 'KILL_SWITCH_ACTIVATE': {
      executeKillSwitch(
        (message.data as { trigger?: string })?.trigger as 'button' | 'keyboard-shortcut' | 'api' ?? 'button'
      ).then((event) => {
        sendResponse({ success: true, event });
      }).catch(() => {
        sendResponse({ success: false });
      });
      return true; // async response
    }

    case 'DELEGATION_UPDATE': {
      const rule = message.data as DelegationRule;
      handleDelegationUpdate(rule).then(() => {
        sendResponse({ success: true });
      }).catch(() => {
        sendResponse({ success: false });
      });
      return true;
    }

    case 'SESSION_QUERY': {
      getStorageState().then((stored) => {
        sendResponse({ sessions: stored.sessions });
      }).catch(() => {
        sendResponse({ sessions: [] });
      });
      return true;
    }

    case 'STATUS_QUERY': {
      const agents = Array.from(state.activeAgents.values());
      const activeRule = state.delegationRules.find((r) => r.isActive) ?? null;
      sendResponse({
        detectedAgents: agents,
        activeDelegation: activeRule,
        killSwitchActive: state.killSwitch.isActive,
        recentViolations: state.recentAlerts,
        delegationRules: state.delegationRules,
      });
      return false;
    }

    case 'SETTINGS_UPDATE': {
      const updates = message.data as Record<string, unknown>;
      updateSettings(updates).then(() => {
        sendResponse({ success: true });
      }).catch(() => {
        sendResponse({ success: false });
      });
      return true;
    }

    default:
      return false;
  }
}

async function handleDetection(tabId: number, event: DetectionEvent): Promise<void> {
  if (!event.agent) return;

  state.activeAgents.set(tabId, event.agent);

  // Create a new session
  const session: AgentSession = {
    id: crypto.randomUUID(),
    agent: event.agent,
    delegationRule: state.delegationRules.find((r) => r.isActive) ?? null,
    events: [],
    startedAt: new Date().toISOString(),
    endedAt: null,
    endReason: null,
    summary: {
      totalActions: 0,
      allowedActions: 0,
      blockedActions: 0,
      violations: 0,
      topUrls: [],
      durationSeconds: null,
    },
  };

  // Add detection event to timeline
  const timelineEvent = createTimelineEvent('detection', event.url, `Agent detected: ${event.agent.type}`, {
    outcome: 'informational',
  });
  const updatedSession = appendEventToSession(session, timelineEvent);

  await saveSession(updatedSession);
  state.activeSessions.set(tabId, updatedSession.id);

  // Log detection
  await appendDetectionLog(event);

  updateBadge();
}

function handleAgentAction(tabId: number, event: AgentEvent): void {
  const sessionId = state.activeSessions.get(tabId);
  if (!sessionId) return;

  updateSession(sessionId, (session) => appendEventToSession(session, event)).catch(() => {
    // Ignore storage errors for individual events
  });
}

function handleBoundaryViolation(tabId: number | undefined, violation: BoundaryViolation): void {
  const activeRule = state.delegationRules.find((r) => r.isActive);
  if (!activeRule) return;

  const alert = createBoundaryAlert(violation, activeRule);
  state.recentAlerts.push(alert);
  if (state.recentAlerts.length > 20) {
    state.recentAlerts.shift();
  }

  // Log the violation as a timeline event if we have a session
  if (tabId !== undefined) {
    const sessionId = state.activeSessions.get(tabId);
    if (sessionId) {
      const event = createTimelineEvent('boundary-violation', violation.url,
        `Violation: ${violation.attemptedAction} blocked`, {
          attemptedAction: violation.attemptedAction,
          outcome: 'blocked',
          ruleId: violation.blockingRuleId,
          targetSelector: violation.targetSelector,
        });
      updateSession(sessionId, (session) => appendEventToSession(session, event)).catch(() => { /* ignore */ });
    }
  }
}

async function handleDelegationUpdate(rule: DelegationRule): Promise<void> {
  // Deactivate all existing rules
  for (const r of state.delegationRules) {
    r.isActive = false;
  }

  // Add or update the new rule
  const existingIndex = state.delegationRules.findIndex((r) => r.id === rule.id);
  if (existingIndex >= 0) {
    state.delegationRules[existingIndex] = rule;
  } else {
    state.delegationRules.push(rule);
  }

  await saveDelegationRules(state.delegationRules);

  // Broadcast to all content scripts
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'DELEGATION_UPDATE',
        data: rule,
        sentAt: new Date().toISOString(),
      });
    } catch {
      // Tab may not have content script
    }
  }

  updateBadge();
}

async function executeKillSwitch(
  trigger: 'button' | 'keyboard-shortcut' | 'api'
): Promise<KillSwitchEvent> {
  const agentIds = Array.from(state.activeAgents.values()).map((a) => a.id);

  const event = await executeBackgroundKillSwitch(trigger, agentIds, []);

  state.killSwitch.isActive = true;
  state.killSwitch.lastEvent = event;
  state.killSwitch.lastActivatedAt = event.timestamp;

  // Clear active agents
  state.activeAgents.clear();

  // Deactivate all delegation rules
  for (const rule of state.delegationRules) {
    rule.isActive = false;
  }
  await saveDelegationRules(state.delegationRules);

  // End all active sessions
  for (const [tabId, sessionId] of state.activeSessions.entries()) {
    await updateSession(sessionId, (session) => ({
      ...session,
      endedAt: new Date().toISOString(),
      endReason: 'kill-switch' as const,
    }));
    state.activeSessions.delete(tabId);
  }

  await clearAllNotifications();
  updateBadge();

  return event;
}

function updateBadge(): void {
  try {
    if (state.killSwitch.isActive) {
      chrome.action.setBadgeText({ text: 'X' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      return;
    }

    const agentCount = state.activeAgents.size;
    if (agentCount > 0) {
      chrome.action.setBadgeText({ text: String(agentCount) });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
      return;
    }

    const hasActiveDelegation = state.delegationRules.some((r) => r.isActive);
    if (hasActiveDelegation) {
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
      return;
    }

    chrome.action.setBadgeText({ text: '' });
  } catch {
    // Badge API may not be available in all contexts
  }
}

async function handleTabRemoved(tabId: number): Promise<void> {
  const sessionId = state.activeSessions.get(tabId);
  if (sessionId) {
    await updateSession(sessionId, (session) => ({
      ...session,
      endedAt: new Date().toISOString(),
      endReason: 'page-unload' as const,
    }));
    state.activeSessions.delete(tabId);
  }
  state.activeAgents.delete(tabId);
  updateBadge();
}

async function checkDelegationExpiration(): Promise<void> {
  let changed = false;
  for (const rule of state.delegationRules) {
    if (rule.isActive && isTimeBoundExpired(rule.scope.timeBound)) {
      rule.isActive = false;
      changed = true;

      // Notify content scripts
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id === undefined) continue;
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'DELEGATION_UPDATE',
            data: null,
            sentAt: new Date().toISOString(),
          });
        } catch {
          // Tab may not have content script
        }
      }
    }
  }

  if (changed) {
    await saveDelegationRules(state.delegationRules);
    updateBadge();
  }
}

function registerKeyboardShortcut(): void {
  try {
    chrome.commands.onCommand.addListener((command) => {
      if (command === 'kill-switch') {
        executeKillSwitch('keyboard-shortcut').catch(() => { /* ignore */ });
      }
    });
  } catch {
    // Commands API may not be available
  }
}

initialize();
