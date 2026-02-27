/**
 * Popup script for AI Browser Guard.
 *
 * Controls the extension popup UI.
 */

import type { MessagePayload, MessageType } from '../types/events';
import type { AgentIdentity } from '../types/agent';
import type { DelegationRule } from '../types/delegation';
import type { AgentSession } from '../session/types';
import type { BoundaryAlert } from '../alerts/boundary';
import { createInitialWizardState, renderWizard, finalizeWizard } from '../delegation/wizard';
import type { WizardState } from '../delegation/wizard';

interface PopupState {
  detectedAgents: AgentIdentity[];
  activeDelegation: DelegationRule | null;
  killSwitchActive: boolean;
  recentViolations: BoundaryAlert[];
  sessions: AgentSession[];
  wizardState: WizardState | null;
  loading: boolean;
}

let popupState: PopupState = {
  detectedAgents: [],
  activeDelegation: null,
  killSwitchActive: false,
  recentViolations: [],
  sessions: [],
  wizardState: null,
  loading: true,
};

function initialize(): void {
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    queryBackgroundStatus();
  });
}

async function queryBackgroundStatus(): Promise<void> {
  try {
    const response = await sendToBackground('STATUS_QUERY', {});
    if (response && typeof response === 'object') {
      const data = response as {
        detectedAgents?: AgentIdentity[];
        activeDelegation?: DelegationRule | null;
        killSwitchActive?: boolean;
        recentViolations?: BoundaryAlert[];
      };
      popupState.detectedAgents = data.detectedAgents ?? [];
      popupState.activeDelegation = data.activeDelegation ?? null;
      popupState.killSwitchActive = data.killSwitchActive ?? false;
      popupState.recentViolations = data.recentViolations ?? [];
    }
  } catch {
    // Background may not be available
  }

  // Also fetch sessions
  try {
    const sessionResponse = await sendToBackground('SESSION_QUERY', {});
    if (sessionResponse && typeof sessionResponse === 'object') {
      const data = sessionResponse as { sessions?: AgentSession[] };
      popupState.sessions = data.sessions ?? [];
    }
  } catch {
    // Ignore
  }

  popupState.loading = false;
  renderAll();
}

function setupEventListeners(): void {
  const killSwitchBtn = document.getElementById('kill-switch-btn');
  if (killSwitchBtn) {
    killSwitchBtn.addEventListener('click', onKillSwitchClick);
  }

  const wizardBtn = document.getElementById('delegation-wizard-btn');
  if (wizardBtn) {
    wizardBtn.addEventListener('click', onDelegationWizardClick);
  }

  // Listen for live updates from background
  chrome.runtime.onMessage.addListener((message: MessagePayload) => {
    if (!message || !message.type) return;

    switch (message.type) {
      case 'DETECTION_RESULT':
        queryBackgroundStatus();
        break;
      case 'KILL_SWITCH_RESULT':
        popupState.killSwitchActive = true;
        renderAll();
        break;
      case 'DELEGATION_UPDATE':
        queryBackgroundStatus();
        break;
    }
  });

  // Listen for delegation activation from wizard
  document.addEventListener('delegation-activated', ((e: CustomEvent<DelegationRule>) => {
    const rule = e.detail;
    sendToBackground('DELEGATION_UPDATE', rule).then(() => {
      popupState.activeDelegation = rule;
      popupState.wizardState = null;
      const wizardContainer = document.getElementById('wizard-container');
      if (wizardContainer) {
        wizardContainer.classList.add('hidden');
        wizardContainer.innerHTML = '';
      }
      renderAll();
    }).catch(() => {
      // Show error
    });
  }) as EventListener);
}

async function onKillSwitchClick(): Promise<void> {
  const btn = document.getElementById('kill-switch-btn') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

  try {
    await sendToBackground('KILL_SWITCH_ACTIVATE', { trigger: 'button' });
    popupState.killSwitchActive = true;
    popupState.detectedAgents = [];
    popupState.activeDelegation = null;
    renderAll();
  } catch {
    if (btn) btn.disabled = false;
  }
}

function onDelegationWizardClick(): void {
  const wizardContainer = document.getElementById('wizard-container');
  if (!wizardContainer) return;

  if (wizardContainer.classList.contains('hidden')) {
    wizardContainer.classList.remove('hidden');
    popupState.wizardState = createInitialWizardState();
    renderWizardUI();
  } else {
    wizardContainer.classList.add('hidden');
    wizardContainer.innerHTML = '';
    popupState.wizardState = null;
  }
}

function renderWizardUI(): void {
  const wizardContainer = document.getElementById('wizard-container');
  if (!wizardContainer || !popupState.wizardState) return;

  renderWizard(wizardContainer, popupState.wizardState, (newState) => {
    popupState.wizardState = newState;
    renderWizardUI();
  });
}

function renderAll(): void {
  renderDetectionPanel();
  renderKillSwitchPanel();
  renderDelegationPanel();
  renderViolationsPanel();
  renderTimelinePanel();
  renderStatusBadge();
}

function renderDetectionPanel(): void {
  const container = document.getElementById('detection-content');
  if (!container) return;

  if (popupState.loading) {
    container.innerHTML = '<p class="placeholder-text">Loading...</p>';
    return;
  }

  if (popupState.detectedAgents.length === 0) {
    container.innerHTML = '<p class="placeholder-text">No agents detected on this page.</p>';
    return;
  }

  container.innerHTML = '';
  for (const agent of popupState.detectedAgents) {
    const card = document.createElement('div');
    card.className = 'detection-card';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <strong style="font-size: 13px;">${formatAgentType(agent.type)}</strong>
        <span class="confidence-label confidence-${agent.confidence}">${agent.confidence}</span>
      </div>
      <div style="font-size: 11px; color: var(--text-secondary);">
        Detected: ${formatTimestamp(agent.detectedAt)}
      </div>
      <div style="margin-top: 4px;">
        ${agent.detectionMethods.map((m) => `<span class="method-tag">${m}</span>`).join(' ')}
      </div>
    `;
    container.appendChild(card);
  }
}

function renderKillSwitchPanel(): void {
  const btn = document.getElementById('kill-switch-btn') as HTMLButtonElement | null;
  if (!btn) return;

  btn.disabled = popupState.detectedAgents.length === 0 && !popupState.killSwitchActive;

  if (popupState.killSwitchActive) {
    btn.textContent = 'Kill Switch Active - All Agents Terminated';
    btn.disabled = true;
  } else {
    btn.textContent = 'Emergency Kill Switch';
  }
}

function renderDelegationPanel(): void {
  const content = document.getElementById('delegation-content');
  if (!content) return;

  if (popupState.activeDelegation) {
    const rule = popupState.activeDelegation;
    const presetNames: Record<string, string> = {
      readOnly: 'Read-Only',
      limited: 'Limited Access',
      fullAccess: 'Full Access',
    };

    let timeInfo = '';
    if (rule.scope.timeBound) {
      const remaining = new Date(rule.scope.timeBound.expiresAt).getTime() - Date.now();
      if (remaining > 0) {
        const mins = Math.ceil(remaining / 60000);
        timeInfo = `<div style="font-size: 11px; color: var(--warning);">Expires in ${mins} minute(s)</div>`;
      } else {
        timeInfo = '<div style="font-size: 11px; color: var(--danger);">Expired</div>';
      }
    }

    content.innerHTML = `
      <div style="margin-bottom: 8px;">
        <strong>Active: ${presetNames[rule.preset] ?? rule.preset}</strong>
        ${rule.label ? `<span style="font-size: 11px; color: var(--text-secondary);"> - ${rule.label}</span>` : ''}
      </div>
      ${timeInfo}
      <button id="delegation-wizard-btn" class="btn btn-secondary" style="margin-top: 8px;">Change Delegation</button>
    `;

    // Re-bind wizard button
    const wizardBtn = document.getElementById('delegation-wizard-btn');
    if (wizardBtn) {
      wizardBtn.addEventListener('click', onDelegationWizardClick);
    }
  } else {
    content.innerHTML = `
      <p class="placeholder-text">No active delegation. Configure access rules before an agent connects.</p>
      <button id="delegation-wizard-btn" class="btn btn-primary">Configure Delegation</button>
    `;
    const wizardBtn = document.getElementById('delegation-wizard-btn');
    if (wizardBtn) {
      wizardBtn.addEventListener('click', onDelegationWizardClick);
    }
  }
}

function renderViolationsPanel(): void {
  const container = document.getElementById('violations-list');
  if (!container) return;

  if (popupState.recentViolations.length === 0) {
    container.innerHTML = '<p class="placeholder-text">No violations recorded.</p>';
    return;
  }

  container.innerHTML = '';
  for (const alert of popupState.recentViolations.slice(-10).reverse()) {
    const item = document.createElement('div');
    item.className = 'event-item';
    item.innerHTML = `
      <div class="event-outcome outcome-blocked"></div>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; justify-content: space-between;">
          <span style="font-size: 12px; font-weight: 500;">${alert.title}</span>
          <span class="severity-badge severity-${alert.severity}">${alert.severity}</span>
        </div>
        <div style="font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${truncateUrl(alert.violation.url)}
        </div>
        <div style="font-size: 10px; color: var(--text-muted);">
          ${formatTimestamp(alert.violation.timestamp)}
        </div>
      </div>
    `;
    container.appendChild(item);
  }
}

function renderTimelinePanel(): void {
  const container = document.getElementById('timeline-list');
  if (!container) return;

  // Get events from the most recent session
  const latestSession = popupState.sessions[0];
  if (!latestSession || latestSession.events.length === 0) {
    container.innerHTML = '<p class="placeholder-text">No session activity.</p>';
    return;
  }

  container.innerHTML = '';
  const recentEvents = latestSession.events.slice(-15).reverse();
  for (const event of recentEvents) {
    const item = document.createElement('div');
    item.className = 'event-item';
    const outcomeClass = event.outcome === 'allowed' ? 'outcome-allowed'
      : event.outcome === 'blocked' ? 'outcome-blocked'
      : 'outcome-info';

    item.innerHTML = `
      <div class="event-outcome ${outcomeClass}"></div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 12px;">${event.description}</div>
        <div style="font-size: 10px; color: var(--text-muted);">
          ${formatTimestamp(event.timestamp)} | ${truncateUrl(event.url, 30)}
        </div>
      </div>
    `;
    container.appendChild(item);
  }
}

function renderStatusBadge(): void {
  const indicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  if (!indicator || !statusText) return;

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

function formatTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatAgentType(type: string): string {
  const names: Record<string, string> = {
    playwright: 'Playwright',
    puppeteer: 'Puppeteer',
    selenium: 'Selenium',
    'anthropic-computer-use': 'Anthropic Computer Use',
    'openai-operator': 'OpenAI Operator',
    'cdp-generic': 'CDP Agent',
    'webdriver-generic': 'WebDriver Agent',
    unknown: 'Unknown Agent',
  };
  return names[type] ?? type;
}

function truncateUrl(url: string, maxLength: number = 40): string {
  if (url.length <= maxLength) return url;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const path = parsed.pathname;
    const available = maxLength - host.length - 3;
    if (available <= 0) return host.substring(0, maxLength - 3) + '...';
    return host + path.substring(0, available) + '...';
  } catch {
    return url.substring(0, maxLength - 3) + '...';
  }
}

initialize();
