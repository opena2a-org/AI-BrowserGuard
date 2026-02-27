/**
 * Capability boundary monitor.
 *
 * Tracks what an agent does vs. what it is allowed to do under the
 * active delegation rules.
 */

import type { AgentCapability } from '../types/agent';
import type { AgentEvent, BoundaryViolation } from '../types/events';
import type { DelegationRule } from '../types/delegation';
import { evaluateRule, isTimeBoundExpired } from '../delegation/rules';
import { createTimelineEvent } from '../session/timeline';

export interface MonitorState {
  activeRule: DelegationRule | null;
  isMonitoring: boolean;
  allowedCount: number;
  blockedCount: number;
  recentViolations: BoundaryViolation[];
}

export interface BoundaryCheckResult {
  allowed: boolean;
  matchedRule: DelegationRule | null;
  reason: string;
  matchDetail?: string;
}

let monitorState: MonitorState = {
  activeRule: null,
  isMonitoring: false,
  allowedCount: 0,
  blockedCount: 0,
  recentViolations: [],
};

/**
 * Check whether an agent action is permitted under delegation rules.
 * Fail-closed: no rule = blocked.
 */
export function checkBoundary(
  action: AgentCapability,
  url: string,
  rule: DelegationRule | null
): BoundaryCheckResult {
  if (!rule) {
    return {
      allowed: false,
      matchedRule: null,
      reason: 'No active delegation rule. All actions are blocked by default.',
    };
  }

  if (!rule.isActive) {
    return {
      allowed: false,
      matchedRule: rule,
      reason: 'Delegation rule is no longer active.',
    };
  }

  if (isDelegationExpired(rule)) {
    return {
      allowed: false,
      matchedRule: rule,
      reason: 'Delegation has expired.',
    };
  }

  const result = evaluateRule(rule, action, url);
  return {
    allowed: result.allowed,
    matchedRule: rule,
    reason: result.reason,
  };
}

/**
 * Match a URL against a site pattern using glob-style matching.
 */
export function matchSitePattern(url: string, pattern: string): boolean {
  try {
    if (!pattern.includes('://')) {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;
      const regexStr = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^.]*');
      return new RegExp(`^${regexStr}$`).test(hostname);
    }
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*');
    return new RegExp(`^${regexStr}$`).test(url);
  } catch {
    return false;
  }
}

function mapEventToCapability(eventType: string): AgentCapability | null {
  switch (eventType) {
    case 'click': return 'click';
    case 'input': return 'type-text';
    case 'submit': return 'submit-form';
    case 'keydown': return 'type-text';
    default: return null;
  }
}

function getSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.');
    if (classes) return `${el.tagName.toLowerCase()}.${classes}`;
  }
  return el.tagName.toLowerCase();
}

/**
 * Start monitoring agent actions in the current page.
 */
export function startBoundaryMonitor(
  rule: DelegationRule | null,
  onViolation: (violation: BoundaryViolation) => void,
  onAction: (event: AgentEvent) => void
): () => void {
  monitorState = {
    activeRule: rule,
    isMonitoring: true,
    allowedCount: 0,
    blockedCount: 0,
    recentViolations: [],
  };

  const cleanups: Array<() => void> = [];

  // Intercept user interaction events
  const interceptionHandler = (e: Event) => {
    if (!monitorState.isMonitoring) return;
    if (e.isTrusted) return; // Only intercept synthetic/untrusted events from agents

    const capability = mapEventToCapability(e.type);
    if (!capability) return;

    const target = e.target as Element;
    const selector = target ? getSelector(target) : undefined;
    const url = window.location.href;

    const result = checkBoundary(capability, url, monitorState.activeRule);

    if (result.allowed) {
      monitorState.allowedCount++;
      const event = createTimelineEvent('action-allowed', url, `${capability} allowed`, {
        targetSelector: selector,
        attemptedAction: capability,
        outcome: 'allowed',
        ruleId: monitorState.activeRule?.id,
      });
      onAction(event);
    } else {
      monitorState.blockedCount++;
      e.preventDefault();
      e.stopPropagation();

      const violation: BoundaryViolation = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        agentId: '',
        attemptedAction: capability,
        url,
        targetSelector: selector,
        blockingRuleId: monitorState.activeRule?.id ?? 'none',
        reason: result.reason,
        userOverride: false,
      };
      monitorState.recentViolations.push(violation);
      if (monitorState.recentViolations.length > 50) {
        monitorState.recentViolations.shift();
      }
      onViolation(violation);

      const event = createTimelineEvent('action-blocked', url, `${capability} blocked: ${result.reason}`, {
        targetSelector: selector,
        attemptedAction: capability,
        outcome: 'blocked',
        ruleId: monitorState.activeRule?.id,
      });
      onAction(event);
    }
  };

  const eventTypes = ['click', 'input', 'submit', 'keydown'];
  for (const type of eventTypes) {
    document.addEventListener(type, interceptionHandler, { capture: true });
  }
  cleanups.push(() => {
    for (const type of eventTypes) {
      document.removeEventListener(type, interceptionHandler, { capture: true });
    }
  });

  // MutationObserver for DOM modifications
  const observer = new MutationObserver((mutations) => {
    if (!monitorState.isMonitoring) return;

    for (const mutation of mutations) {
      if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
        const url = window.location.href;
        const result = checkBoundary('modify-dom', url, monitorState.activeRule);

        if (!result.allowed) {
          const target = mutation.target as Element;
          const violation: BoundaryViolation = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            agentId: '',
            attemptedAction: 'modify-dom',
            url,
            targetSelector: target?.nodeType === 1 ? getSelector(target) : 'document',
            blockingRuleId: monitorState.activeRule?.id ?? 'none',
            reason: result.reason,
            userOverride: false,
          };
          onViolation(violation);
        }
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
  cleanups.push(() => observer.disconnect());

  return () => {
    monitorState.isMonitoring = false;
    for (const cleanup of cleanups) {
      try { cleanup(); } catch { /* ignore */ }
    }
  };
}

/**
 * Update the active delegation rule.
 */
export function updateActiveRule(rule: DelegationRule | null): void {
  monitorState.activeRule = rule;
}

/**
 * Check if the current delegation has expired.
 */
export function isDelegationExpired(rule: DelegationRule): boolean {
  return isTimeBoundExpired(rule.scope.timeBound);
}

/**
 * Get the current monitor state.
 */
export function getMonitorState(): MonitorState {
  return { ...monitorState };
}
