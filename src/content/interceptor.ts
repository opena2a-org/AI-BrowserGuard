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
const MSG_CDP_DETECTED = 'AI_GUARD:CDP_DETECTED';

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
        .replace(/\*\*/g, '\x00') // placeholder to protect double-star from single-star pass
        .replace(/\*/g, '[^.]*')
        .replace(/\x00/g, '.*');  // restore double-star as any-depth wildcard
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

// ── Secure-context guard ─────────────────────────────────────────────────────
// This script runs in the MAIN world (page JS context). Only install API
// intercepts on secure origins — http: pages do not support Web Crypto APIs
// and are not a target environment for agent-assisted browsing sessions.
// The check uses `!== false` so that undefined (older runtimes, test env)
// is treated as secure and the module proceeds normally.
if (globalThis.isSecureContext !== false) {

// ── CDP stack trace detection ────────────────────────────────────────────────
// When automation frameworks (Playwright, Puppeteer) execute code via CDP's
// Runtime.evaluate or Runtime.callFunctionOn, the V8 call stack contains
// framework-specific signatures that cannot be hidden. We intercept
// Error.prepareStackTrace to inspect structured call sites as they are created.

/** Known stack trace patterns for automation frameworks. */
const CDP_STACK_PATTERNS = [
  { pattern: /UtilityScript/, framework: 'playwright' },
  { pattern: /__puppeteer_evaluation_script__/, framework: 'puppeteer' },
  { pattern: /pptr:/, framework: 'puppeteer' },
  { pattern: /ExecutionContext\._evaluateInternal/, framework: 'puppeteer' },
] as const;

let cdpDetectionReported = false;

/** Report a CDP detection to the isolated world content script. */
function reportCdpDetection(framework: string, detail: string, signals: Record<string, unknown>): void {
  if (cdpDetectionReported) return;
  cdpDetectionReported = true;
  window.postMessage({
    type: MSG_CDP_DETECTED,
    nonce: guardNonce,
    framework,
    detail,
    signals,
    timestamp: new Date().toISOString(),
  }, '*');
}

/**
 * Check the call stack of the CURRENT execution for CDP automation patterns.
 * Call this from within intercepted API functions (window.open, form.submit, etc.)
 * to detect if the call originated from CDP-evaluated code.
 */
function probeCallStack(): void {
  if (cdpDetectionReported) return;
  try {
    const stack = new Error('__abg_probe__').stack ?? '';
    for (const { pattern, framework } of CDP_STACK_PATTERNS) {
      if (pattern.test(stack)) {
        reportCdpDetection(framework, `Detected ${framework} via intercepted API call stack.`, {
          stackSnippet: stack.substring(0, 500),
        });
        return;
      }
    }
  } catch {
    // Do not let probe errors affect page functionality
  }
}

// Install Error.prepareStackTrace trap (V8-specific).
// This intercepts ALL Error creation in the page context, allowing us to
// detect CDP-evaluated code even when it doesn't call our intercepted APIs.
const _originalPrepareStackTrace = (Error as unknown as Record<string, unknown>).prepareStackTrace as
  ((err: Error, sites: NodeJS.CallSite[]) => string) | undefined;

(Error as unknown as Record<string, unknown>).prepareStackTrace = function (
  err: Error,
  callSites: NodeJS.CallSite[],
): string {
  if (!cdpDetectionReported) {
    try {
      for (const site of callSites) {
        const fnName = site.getFunctionName() ?? '';
        const typeName = site.getTypeName() ?? '';
        const fileName = site.getFileName() ?? '';
        const combined = `${typeName}.${fnName} ${fileName}`;

        for (const { pattern, framework } of CDP_STACK_PATTERNS) {
          if (pattern.test(combined) || pattern.test(fnName) || pattern.test(typeName) || pattern.test(fileName)) {
            reportCdpDetection(framework, `Detected ${framework} via Error.prepareStackTrace trap.`, {
              typeName, fnName, fileName,
            });
            break;
          }
        }
        if (cdpDetectionReported) break;
      }
    } catch {
      // Never let inspection errors propagate
    }
  }

  // Delegate to original or produce default format
  if (_originalPrepareStackTrace) {
    return _originalPrepareStackTrace(err, callSites);
  }
  return `${err}\n${callSites.map((s) => `    at ${s}`).join('\n')}`;
};

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
  probeCallStack();
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
  probeCallStack();
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
  probeCallStack();
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
  probeCallStack();
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

} // end secure-context guard
