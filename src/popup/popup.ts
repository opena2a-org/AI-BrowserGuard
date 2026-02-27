/**
 * Popup script for AI Browser Guard.
 *
 * Controls the extension popup UI: status display, kill switch button,
 * delegation wizard, violation list, and session timeline.
 * Communicates with the background service worker via chrome.runtime messages.
 */

import type { MessagePayload, MessageType } from '../types/events';
import type { AgentIdentity } from '../types/agent';
import type { DelegationRule } from '../types/delegation';
import type { AgentSession } from '../session/types';
import type { BoundaryAlert } from '../alerts/boundary';
import type { WizardState } from '../delegation/wizard';

/**
 * Popup UI state.
 * Mirrors relevant background state for rendering.
 */
interface PopupState {
  /** Currently detected agents (from background). */
  detectedAgents: AgentIdentity[];

  /** Active delegation rule. */
  activeDelegation: DelegationRule | null;

  /** Whether the kill switch is active. */
  killSwitchActive: boolean;

  /** Recent boundary violations for display. */
  recentViolations: BoundaryAlert[];

  /** Recent session data for timeline display. */
  sessions: AgentSession[];

  /** Delegation wizard state, if wizard is open. */
  wizardState: WizardState | null;

  /** Whether the popup is currently loading data from background. */
  loading: boolean;
}

/**
 * Global popup state.
 */
let popupState: PopupState = {
  detectedAgents: [],
  activeDelegation: null,
  killSwitchActive: false,
  recentViolations: [],
  sessions: [],
  wizardState: null,
  loading: true,
};

/**
 * Initialize the popup.
 *
 * Lifecycle:
 * 1. Query background for current status.
 * 2. Render the UI based on received state.
 * 3. Set up event listeners for buttons.
 * 4. Set up message listener for live updates.
 *
 * TODO: Send STATUS_QUERY to background.
 * On response, populate popupState with current detection, delegation, and session data.
 * Call render functions for each panel.
 * Attach click handler to kill switch button.
 * Attach click handler to delegation wizard button.
 * Add chrome.runtime.onMessage listener for live updates from background.
 */
function initialize(): void {
  // TODO: Query background, populate state, render, attach listeners.
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    queryBackgroundStatus();
  });
}

/**
 * Query the background service worker for current status.
 *
 * TODO: Send STATUS_QUERY message via chrome.runtime.sendMessage.
 * On response, update popupState fields.
 * Call renderAll() to update the UI.
 * Set loading to false.
 */
async function queryBackgroundStatus(): Promise<void> {
  // TODO: Send status query and update state.
  popupState.loading = false;
  renderAll();
}

/**
 * Set up event listeners for all interactive elements.
 *
 * TODO: Attach click handler to #kill-switch-btn -> onKillSwitchClick.
 * Attach click handler to #delegation-wizard-btn -> onDelegationWizardClick.
 * Add chrome.runtime.onMessage listener for background broadcasts.
 */
function setupEventListeners(): void {
  const killSwitchBtn = document.getElementById('kill-switch-btn');
  if (killSwitchBtn) {
    killSwitchBtn.addEventListener('click', onKillSwitchClick);
  }

  const wizardBtn = document.getElementById('delegation-wizard-btn');
  if (wizardBtn) {
    wizardBtn.addEventListener('click', onDelegationWizardClick);
  }
}

/**
 * Handle kill switch button click.
 *
 * TODO: Send KILL_SWITCH_ACTIVATE message to background.
 * On response, update popupState.killSwitchActive = true.
 * Render kill switch panel to show confirmation.
 * Disable the button to prevent double-click.
 */
async function onKillSwitchClick(): Promise<void> {
  // TODO: Send kill switch command to background and update UI.
}

/**
 * Handle delegation wizard button click.
 *
 * TODO: Toggle wizard visibility.
 * If showing, initialize wizard state and render wizard.
 * If hiding, clear wizard state.
 */
function onDelegationWizardClick(): void {
  // TODO: Show/hide delegation wizard.
  const wizardContainer = document.getElementById('wizard-container');
  if (wizardContainer) {
    wizardContainer.classList.toggle('hidden');
  }
}

/**
 * Render all UI panels based on current state.
 */
function renderAll(): void {
  renderDetectionPanel();
  renderKillSwitchPanel();
  renderDelegationPanel();
  renderViolationsPanel();
  renderTimelinePanel();
  renderStatusBadge();
}

/**
 * Render the detection status panel.
 *
 * TODO: Get #detection-content element.
 * If agents detected, show detection cards with agent type, confidence, methods.
 * If no agents, show placeholder text.
 * Enable kill switch button if agents are detected.
 */
function renderDetectionPanel(): void {
  const container = document.getElementById('detection-content');
  if (!container) return;

  if (popupState.detectedAgents.length === 0) {
    container.innerHTML = '<p class="placeholder-text">No agents detected on this page.</p>';
    return;
  }

  // TODO: Render detection card for each detected agent.
  // Include: agent type, confidence level, detection methods as tags.
}

/**
 * Render the kill switch panel state.
 *
 * TODO: Get #kill-switch-btn element.
 * Enable button if agents are detected.
 * If kill switch is active, change button text and style to show confirmed state.
 */
function renderKillSwitchPanel(): void {
  const btn = document.getElementById('kill-switch-btn') as HTMLButtonElement | null;
  if (!btn) return;

  btn.disabled = popupState.detectedAgents.length === 0 && !popupState.killSwitchActive;

  if (popupState.killSwitchActive) {
    btn.textContent = 'Kill Switch Active - All Agents Terminated';
    btn.disabled = true;
  }
}

/**
 * Render the delegation panel.
 *
 * TODO: Get #delegation-content element.
 * If active delegation, show delegation details (preset, time remaining, scope).
 * If no delegation, show setup prompt and wizard button.
 */
function renderDelegationPanel(): void {
  // TODO: Render delegation status or setup prompt.
}

/**
 * Render the violations list.
 *
 * TODO: Get #violations-list element.
 * If violations exist, render each as an event-item with severity badge.
 * If no violations, show placeholder.
 */
function renderViolationsPanel(): void {
  // TODO: Render violation list items.
}

/**
 * Render the session timeline.
 *
 * TODO: Get #timeline-list element.
 * If sessions exist, render recent events with outcome indicators.
 * If no sessions, show placeholder.
 */
function renderTimelinePanel(): void {
  // TODO: Render timeline event items.
}

/**
 * Update the status badge in the header.
 *
 * Status priority: kill switch > detected > delegated > idle.
 *
 * TODO: Get #status-indicator and #status-text elements.
 * Remove all status-* classes.
 * Add appropriate class and text based on state.
 */
function renderStatusBadge(): void {
  const indicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  if (!indicator || !statusText) return;

  // Remove all status classes
  indicator.classList.remove('status-idle', 'status-detected', 'status-killed', 'status-delegated');

  if (popupState.killSwitchActive) {
    indicator.classList.add('status-killed');
    statusText.textContent = 'Killed';
  } else if (popupState.detectedAgents.length > 0) {
    indicator.classList.add('status-detected');
    statusText.textContent = `${popupState.detectedAgents.length} Agent(s) Detected`;
  } else if (popupState.activeDelegation) {
    indicator.classList.add('status-delegated');
    statusText.textContent = 'Delegated';
  } else {
    indicator.classList.add('status-idle');
    statusText.textContent = 'Monitoring';
  }
}

/**
 * Send a typed message to the background service worker.
 *
 * @param type - The message type.
 * @param data - The message payload.
 * @returns Promise resolving to the response.
 */
async function sendToBackground(type: MessageType, data: unknown): Promise<unknown> {
  const message: MessagePayload = {
    type,
    data,
    sentAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Format a timestamp for display in the popup.
 *
 * @param isoTimestamp - ISO 8601 timestamp string.
 * @returns Formatted time string (e.g., "14:32:05").
 */
function formatTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Truncate a URL for display in limited space.
 *
 * @param url - The full URL.
 * @param maxLength - Maximum display length.
 * @returns Truncated URL string.
 */
function truncateUrl(url: string, maxLength: number = 40): string {
  if (url.length <= maxLength) return url;
  const parsed = new URL(url);
  const host = parsed.hostname;
  const path = parsed.pathname;
  const available = maxLength - host.length - 3; // 3 for "..."
  if (available <= 0) return host.substring(0, maxLength - 3) + '...';
  return host + path.substring(0, available) + '...';
}

// Initialize popup
initialize();
