/**
 * Popup script for AI Browser Guard.
 *
 * Controls the extension popup UI.
 */

import type { MessagePayload, MessageType } from '../types/events';
import type { AgentIdentity } from '../types/agent';
import type { DelegationRule } from '../types/delegation';
import type { AgentSession, LifetimeStats } from '../session/types';
import type { BoundaryAlert } from '../alerts/boundary';
import { createInitialWizardState, renderWizard } from '../delegation/wizard';
import type { WizardState } from '../delegation/wizard';
import { createRuleFromPreset } from '../delegation/rules';

interface PopupState {
  detectedAgents: AgentIdentity[];
  activeDelegation: DelegationRule | null;
  killSwitchActive: boolean;
  recentViolations: BoundaryAlert[];
  sessions: AgentSession[];
  wizardState: WizardState | null;
  loading: boolean;
  lifetimeStats: LifetimeStats | null;
}

let popupState: PopupState = {
  detectedAgents: [],
  activeDelegation: null,
  killSwitchActive: false,
  recentViolations: [],
  sessions: [],
  wizardState: null,
  loading: true,
  lifetimeStats: null,
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
      popupState.lifetimeStats = (data as { lifetimeStats?: LifetimeStats }).lifetimeStats ?? null;
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
  // Re-render delegation panel so Configure/Cancel label updates
  renderDelegationPanel();
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
  renderMetricsPanel();
  renderStatusBadge();
}

function renderDetectionPanel(): void {
  const container = document.getElementById('detection-content');
  if (!container) return;

  if (popupState.loading) {
    container.innerHTML = '<p class="placeholder-text-inline">Loading...</p>';
    return;
  }

  if (popupState.detectedAgents.length === 0) {
    container.innerHTML = '<p class="placeholder-text-inline">No agents detected</p>';
    return;
  }

  container.innerHTML = '';
  for (const agent of popupState.detectedAgents) {
    const card = document.createElement('div');
    card.className = 'detection-card';

    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;';

    const name = document.createElement('strong');
    name.textContent = formatAgentType(agent.type);

    const badge = document.createElement('span');
    badge.className = 'severity-badge severity-badge-high';
    badge.textContent = `Confidence: ${agent.confidence}`;

    headerRow.appendChild(name);
    headerRow.appendChild(badge);

    const metaRow = document.createElement('div');
    metaRow.style.cssText = 'font-size: 12px; color: var(--text-secondary); font-weight: 500;';

    const ts = document.createElement('span');
    ts.textContent = formatTimestamp(agent.detectedAt) + ' ';
    metaRow.appendChild(ts);

    for (const m of agent.detectionMethods) {
      const tag = document.createElement('span');
      tag.className = 'method-tag';
      tag.textContent = m;
      metaRow.appendChild(tag);
    }

    const urlRow = document.createElement('div');
    urlRow.style.cssText = 'font-size: 12px; color: var(--text-secondary); font-weight: 500; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    urlRow.textContent = truncateUrl(agent.originUrl, 45);
    urlRow.title = agent.originUrl;

    const quickAllowRow = document.createElement('div');
    quickAllowRow.style.cssText = 'display: flex; gap: 6px; margin-top: 6px;';

    const allowReadOnlyBtn = document.createElement('button');
    allowReadOnlyBtn.type = 'button';
    allowReadOnlyBtn.className = 'btn btn-secondary btn-sm';
    allowReadOnlyBtn.textContent = 'Allow Read-Only';
    allowReadOnlyBtn.addEventListener('click', () => {
      onQuickAllowClick('readOnly').catch(() => { /* ignore */ });
    });

    const allowFullBtn = document.createElement('button');
    allowFullBtn.type = 'button';
    allowFullBtn.className = 'btn btn-primary btn-sm';
    allowFullBtn.textContent = 'Allow Full Access';
    allowFullBtn.addEventListener('click', () => {
      onQuickAllowClick('fullAccess').catch(() => { /* ignore */ });
    });

    quickAllowRow.appendChild(allowReadOnlyBtn);
    quickAllowRow.appendChild(allowFullBtn);

    card.appendChild(headerRow);
    card.appendChild(metaRow);
    card.appendChild(urlRow);
    card.appendChild(quickAllowRow);
    container.appendChild(card);
  }
}

function renderKillSwitchPanel(): void {
  const btn = document.getElementById('kill-switch-btn') as HTMLButtonElement | null;
  if (!btn) return;

  if (popupState.killSwitchActive) {
    // Replace kill switch button with Resume Monitoring
    btn.textContent = 'Resume Monitoring';
    btn.disabled = false;
    btn.className = 'btn btn-primary btn-sm';
    btn.onclick = () => { onResumeMonitoringClick().catch(() => { /* ignore */ }); };
  } else if (popupState.detectedAgents.length > 0) {
    // Agent active — show kill switch enabled and dangerous
    btn.textContent = 'Kill Switch';
    btn.disabled = false;
    btn.className = 'btn-danger-compact';
    btn.onclick = () => { onKillSwitchClick().catch(() => { /* ignore */ }); };
  } else {
    // Idle — no agent to kill, show as neutral/inactive
    btn.textContent = 'Kill Switch';
    btn.disabled = true;
    btn.className = 'btn btn-secondary btn-sm';
    btn.onclick = null;
  }
}

async function onResumeMonitoringClick(): Promise<void> {
  const btn = document.getElementById('kill-switch-btn') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

  try {
    await sendToBackground('KILL_SWITCH_RESET', {});
    popupState.killSwitchActive = false;
    renderAll();
  } catch {
    if (btn) btn.disabled = false;
  }
}

async function onQuickAllowClick(preset: 'readOnly' | 'fullAccess'): Promise<void> {
  const rule = createRuleFromPreset(preset);
  try {
    await sendToBackground('DELEGATION_UPDATE', rule);
    popupState.activeDelegation = rule;
    popupState.wizardState = null;
    const wizardContainer = document.getElementById('wizard-container');
    if (wizardContainer) {
      wizardContainer.classList.add('hidden');
      wizardContainer.innerHTML = '';
    }
    renderAll();
  } catch {
    // Ignore — background may not be available
  }
}

function renderDelegationPanel(): void {
  const content = document.getElementById('delegation-content');
  if (!content) return;

  if (popupState.activeDelegation) {
    const rule = popupState.activeDelegation;
    const presetNames: Record<string, string> = {
      readOnly: 'Read-Only',
      limited: 'Limited',
      fullAccess: 'Full Access',
    };

    content.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'delegation-empty';

    const labelSpan = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = presetNames[rule.preset] ?? rule.preset;
    labelSpan.appendChild(strong);

    if (rule.scope.timeBound) {
      const remaining = new Date(rule.scope.timeBound.expiresAt).getTime() - Date.now();
      const timeSpan = document.createElement('span');
      timeSpan.style.cssText = 'font-size: 12px; font-weight: 500;';
      if (remaining > 0) {
        const mins = Math.ceil(remaining / 60000);
        timeSpan.style.color = 'var(--color-warning)';
        timeSpan.textContent = ` (${mins}m left)`;
      } else {
        timeSpan.style.color = 'var(--color-danger)';
        timeSpan.textContent = ' (expired)';
      }
      labelSpan.appendChild(timeSpan);
    }

    const changeBtn = document.createElement('button');
    changeBtn.id = 'delegation-wizard-btn';
    changeBtn.className = 'btn btn-secondary btn-sm';
    changeBtn.textContent = 'Change';
    changeBtn.addEventListener('click', onDelegationWizardClick);

    row.appendChild(labelSpan);
    row.appendChild(changeBtn);
    content.appendChild(row);
  } else {
    const wizardOpen = popupState.wizardState !== null;
    content.innerHTML = `
      <div class="delegation-empty">
        <span class="placeholder-text-inline">No delegation active</span>
        <button id="delegation-wizard-btn" class="btn ${wizardOpen ? 'btn-secondary' : 'btn-primary'} btn-sm">${wizardOpen ? 'Cancel' : 'Configure'}</button>
      </div>
    `;
    const wizardBtn = document.getElementById('delegation-wizard-btn');
    if (wizardBtn) {
      wizardBtn.addEventListener('click', onDelegationWizardClick);
    }
  }
}

function renderViolationsPanel(): void {
  const panel = document.getElementById('violations-panel');
  const container = document.getElementById('violations-list');
  if (!container || !panel) return;

  if (popupState.recentViolations.length === 0) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');
  container.innerHTML = '';
  for (const alert of popupState.recentViolations.slice(-10).reverse()) {
    const item = document.createElement('div');
    item.className = 'event-item';

    const dot = document.createElement('div');
    dot.className = 'event-outcome outcome-blocked';

    const body = document.createElement('div');
    body.style.cssText = 'flex: 1; min-width: 0;';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; justify-content: space-between;';

    const titleSpan = document.createElement('span');
    titleSpan.style.cssText = 'font-size: 13px; font-weight: 600;';
    titleSpan.textContent = alert.title;

    const sevBadge = document.createElement('span');
    sevBadge.className = `severity-badge severity-${alert.severity}`;
    sevBadge.textContent = alert.severity;

    topRow.appendChild(titleSpan);
    topRow.appendChild(sevBadge);

    const urlLine = document.createElement('div');
    urlLine.style.cssText = 'font-size: 12px; color: var(--text-secondary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    urlLine.textContent = truncateUrl(alert.violation.url);

    const tsLine = document.createElement('div');
    tsLine.style.cssText = 'font-size: 11px; color: var(--text-secondary); font-weight: 500;';
    tsLine.textContent = formatTimestamp(alert.violation.timestamp);

    body.appendChild(topRow);
    body.appendChild(urlLine);
    body.appendChild(tsLine);
    item.appendChild(dot);
    item.appendChild(body);
    container.appendChild(item);
  }
}

function renderTimelinePanel(): void {
  const panel = document.getElementById('timeline-panel');
  const container = document.getElementById('timeline-list');
  if (!container || !panel) return;

  const latestSession = popupState.sessions[0];
  if (!latestSession || latestSession.events.length === 0) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');
  container.innerHTML = '';
  const recentEvents = latestSession.events.slice(-15).reverse();
  for (const event of recentEvents) {
    const item = document.createElement('div');
    item.className = 'event-item';
    const outcomeClass = event.outcome === 'allowed' ? 'outcome-allowed'
      : event.outcome === 'blocked' ? 'outcome-blocked'
      : 'outcome-info';

    const dot = document.createElement('div');
    dot.className = `event-outcome ${outcomeClass}`;

    const body = document.createElement('div');
    body.style.cssText = 'flex: 1; min-width: 0;';

    const descLine = document.createElement('div');
    descLine.style.cssText = 'font-size: 13px; font-weight: 500;';
    descLine.textContent = event.description;

    const metaLine = document.createElement('div');
    metaLine.style.cssText = 'font-size: 12px; color: var(--text-secondary); font-weight: 500;';
    metaLine.textContent = `${formatTimestamp(event.timestamp)} | ${truncateUrl(event.url, 30)}`;

    body.appendChild(descLine);
    body.appendChild(metaLine);
    item.appendChild(dot);
    item.appendChild(body);
    container.appendChild(item);
  }
}

function renderMetricsPanel(): void {
  const panel = document.getElementById('metrics-panel');
  const grid = document.getElementById('metrics-grid');
  const since = document.getElementById('metrics-since');
  if (!panel || !grid || !since) return;

  const stats = popupState.lifetimeStats;
  if (!stats || stats.totalSessions === 0) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');
  grid.innerHTML = '';

  // Sessions monitored
  addMetricCell(grid, String(stats.totalSessions), 'sessions monitored');

  // Actions blocked — show 0 as a positive ("no violations")
  if (stats.totalActionsBlocked > 0) {
    addMetricCell(grid, String(stats.totalActionsBlocked), 'actions blocked');
  } else {
    addMetricCell(grid, 'None', 'violations detected');
  }

  // Top detected agent framework
  const types = Object.entries(stats.agentTypesDetected);
  if (types.length > 0) {
    const topType = types.sort((a, b) => b[1] - a[1])[0][0];
    addMetricCell(grid, formatAgentType(topType), 'most seen framework');
  } else {
    const uniqueCount = types.length;
    addMetricCell(grid, String(uniqueCount), 'framework types');
  }

  // "Active since" line
  since.textContent = '';
  if (stats.firstActiveAt) {
    const date = new Date(stats.firstActiveAt);
    const daysSince = Math.floor((Date.now() - date.getTime()) / 86400000);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const sinceText = document.createElement('span');
    sinceText.textContent = daysSince === 0
      ? `Monitoring active since today (${dateStr})`
      : `Monitoring active since ${dateStr} (${daysSince} day${daysSince === 1 ? '' : 's'})`;
    since.appendChild(sinceText);
  }
}

function addMetricCell(container: HTMLElement, value: string, label: string): void {
  const cell = document.createElement('div');
  cell.className = 'metric-cell';

  const val = document.createElement('div');
  val.className = 'metric-value';
  val.textContent = value;

  const lbl = document.createElement('div');
  lbl.className = 'metric-label';
  lbl.textContent = label;

  cell.appendChild(val);
  cell.appendChild(lbl);
  container.appendChild(cell);
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
