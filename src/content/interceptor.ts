/**
 * MAIN world content script — capability boundary interceptor.
 *
 * Runs in the page's JavaScript context (not the extension isolated world).
 * Intercepts low-level browser APIs that agents use to bypass DOM event
 * interception: window.open, history.pushState/replaceState,
 * HTMLFormElement.prototype.submit, and the Navigation API.
 *
 * IMPORTANT: This script CANNOT use any chrome.* APIs.
 * Communication with the isolated content script uses window.postMessage.
 *
 * Security: a shared nonce received from the isolated world ensures only
 * our extension can update the stored delegation rules.
 */

const MSG_INIT = 'AI_GUARD:INIT';
const MSG_RULE_UPDATE = 'AI_GUARD:RULE_UPDATE';
const MSG_ACTION = 'AI_GUARD:ACTION';
const MSG_ALLOW_ONCE = 'AI_GUARD:ALLOW_ONCE';

interface InterceptorRule {
  isActive: boolean;
  expiresAt: string | null;
  actionRestrictions: Array<{ capability: string; action: 'allow' | 'block' }>;
  sitePatterns: Array<{ pattern: string; action: 'allow' | 'block' }>;
}

let activeRule: InterceptorRule | null = null;
let guardNonce: string | null = null;

/**
 * One-time overrides granted via the "Allow once" notification button.
 * Each entry is a `${capability}:${url}` key. The interceptors check this
 * set before enforcing the active rule, and consume (remove) the entry on
 * first use so that the exception applies exactly once.
 */
const allowedOnce: Set<string> = new Set();

/**
 * Returns true and removes the entry if a one-time override exists for this
 * capability + url combination.
 */
function consumeAllowedOnce(capability: string, url: string): boolean {
  const key = `${capability}:${url}`;
  if (allowedOnce.has(key)) {
    allowedOnce.delete(key);
    return true;
  }
  return false;
}

/** Glob-style URL pattern matching (mirrors monitor.ts matchSitePattern). */
export function matchesPattern(url: string, pattern: string): boolean {
  try {
    if (!pattern.includes('://')) {
      const hostname = new URL(url).hostname;
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

/** Check whether a capability is allowed under the current active rule. Fail-closed. */
export function isActionAllowed(
  capability: string,
  url: string,
  rule: InterceptorRule | null = activeRule
): { allowed: boolean; reason: string } {
  if (!rule || !rule.isActive) {
    return { allowed: false, reason: 'No active delegation rule' };
  }
  if (rule.expiresAt && new Date(rule.expiresAt).getTime() < Date.now()) {
    return { allowed: false, reason: 'Delegation has expired' };
  }

  // Blocked site patterns take precedence
  for (const p of rule.sitePatterns) {
    if (matchesPattern(url, p.pattern) && p.action === 'block') {
      return { allowed: false, reason: `Site blocked by pattern: ${p.pattern}` };
    }
  }

  const restriction = rule.actionRestrictions.find((r) => r.capability === capability);
  if (!restriction) {
    return { allowed: false, reason: `Capability '${capability}' not permitted` };
  }
  return {
    allowed: restriction.action === 'allow',
    reason: restriction.action === 'allow'
      ? 'Allowed by delegation rule'
      : `'${capability}' blocked by delegation rule`,
  };
}

/** Report an intercepted action back to the isolated world. */
function reportAction(
  capability: string,
  url: string,
  blocked: boolean,
  reason: string
): void {
  window.postMessage({
    type: MSG_ACTION,
    nonce: guardNonce,
    capability,
    url,
    blocked,
    reason,
    timestamp: new Date().toISOString(),
  }, '*');
}

// Listen for messages from the isolated world
window.addEventListener('message', (e: MessageEvent) => {
  if (e.source !== window || !e.data) return;

  if (e.data.type === MSG_INIT && !guardNonce) {
    guardNonce = e.data.nonce as string;
    return;
  }

  if (e.data.type === MSG_RULE_UPDATE) {
    if (!guardNonce || e.data.nonce !== guardNonce) return; // reject unsigned messages
    activeRule = (e.data.rule as InterceptorRule | null) ?? null;
    return;
  }

  if (e.data.type === MSG_ALLOW_ONCE) {
    if (!guardNonce || e.data.nonce !== guardNonce) return; // reject unsigned messages
    const capability = e.data.capability as string;
    const url = e.data.url as string;
    if (capability && url) {
      allowedOnce.add(`${capability}:${url}`);
    }
  }
});

// ── window.open (open-tab capability) ───────────────────────────────────────
const _originalOpen = window.open.bind(window);
window.open = function (
  url?: string | URL,
  target?: string,
  features?: string
): Window | null {
  const urlStr = url?.toString() ?? window.location.href;
  if (consumeAllowedOnce('open-tab', urlStr)) return _originalOpen(url, target, features);
  const { allowed, reason } = isActionAllowed('open-tab', urlStr);
  reportAction('open-tab', urlStr, !allowed, reason);
  if (!allowed) return null;
  return _originalOpen(url, target, features);
};

// ── HTMLFormElement.prototype.submit (bypasses the 'submit' DOM event) ──────
const _originalFormSubmit = HTMLFormElement.prototype.submit;
HTMLFormElement.prototype.submit = function (this: HTMLFormElement): void {
  const url = this.action || window.location.href;
  if (consumeAllowedOnce('submit-form', url)) { _originalFormSubmit.call(this); return; }
  const { allowed, reason } = isActionAllowed('submit-form', url);
  reportAction('submit-form', url, !allowed, reason);
  if (!allowed) return;
  _originalFormSubmit.call(this);
};

// ── history.pushState (SPA navigation) ──────────────────────────────────────
const _originalPushState = history.pushState.bind(history);
history.pushState = function (
  state: unknown,
  unused: string,
  url?: string | URL | null
): void {
  const urlStr = url?.toString() ?? window.location.href;
  if (consumeAllowedOnce('navigate', urlStr)) { _originalPushState(state, unused, url); return; }
  const { allowed, reason } = isActionAllowed('navigate', urlStr);
  reportAction('navigate', urlStr, !allowed, reason);
  if (!allowed) return;
  _originalPushState(state, unused, url);
};

// ── history.replaceState (SPA navigation) ───────────────────────────────────
const _originalReplaceState = history.replaceState.bind(history);
history.replaceState = function (
  state: unknown,
  unused: string,
  url?: string | URL | null
): void {
  const urlStr = url?.toString() ?? window.location.href;
  if (consumeAllowedOnce('navigate', urlStr)) { _originalReplaceState(state, unused, url); return; }
  const { allowed, reason } = isActionAllowed('navigate', urlStr);
  reportAction('navigate', urlStr, !allowed, reason);
  if (!allowed) return;
  _originalReplaceState(state, unused, url);
};

// ── Navigation API (Chrome 102+) — catches location.href = assignments ──────
type NavigationEventTarget = EventTarget & {
  addEventListener(
    type: 'navigate',
    listener: (e: NavigateEvent) => void
  ): void;
};
interface NavigateEvent extends Event {
  readonly isTrusted: boolean;
  readonly destination: { readonly url: string };
  preventDefault(): void;
}

const nav = (window as unknown as Record<string, unknown>).navigation as
  NavigationEventTarget | undefined;
if (nav) {
  nav.addEventListener('navigate', (e: NavigateEvent) => {
    if (e.isTrusted) return; // user-initiated navigation — do not intercept
    const url = e.destination?.url ?? window.location.href;
    if (consumeAllowedOnce('navigate', url)) return;
    const { allowed, reason } = isActionAllowed('navigate', url);
    reportAction('navigate', url, !allowed, reason);
    if (!allowed) {
      try { e.preventDefault(); } catch { /* some navigate events are not cancellable */ }
    }
  });
}
