/**
 * Inline toast notifications for blocked actions.
 *
 * Injects a small slide-in toast at the bottom-right of the page when
 * the extension blocks an agent action. Provides immediate, in-context
 * feedback so the user knows why something stopped working.
 *
 * Runs in the ISOLATED world content script — has DOM access and can
 * communicate with the background via chrome.runtime.
 */

const TOAST_CONTAINER_ID = 'abg-toast-container';
const MAX_VISIBLE_TOASTS = 3;
const AUTO_DISMISS_MS = 8000;
const CRITICAL_AUTO_DISMISS_MS = 0; // stays until user interacts

/** Capability labels for user-friendly display. */
const CAPABILITY_LABELS: Record<string, string> = {
  'submit-form': 'form submission',
  'open-tab': 'new tab',
  'navigate': 'navigation',
  'click': 'click',
  'type-text': 'text input',
  'download-file': 'file download',
  'modify-dom': 'page modification',
  'execute-script': 'script execution',
  'read-dom': 'page reading',
  'screenshot': 'screenshot',
  'close-tab': 'tab close',
};

/** Severity for determining toast persistence. */
const CRITICAL_CAPABILITIES = new Set(['submit-form', 'execute-script']);

interface ToastOptions {
  capability: string;
  url: string;
  reason: string;
  onWhitelist?: (domain: string) => void;
  onDismiss?: () => void;
}

/** Extract the registrable domain from a URL for whitelisting. */
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Ensure the toast container element exists in the page. */
function ensureContainer(): HTMLElement {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (container) return container;

  container = document.createElement('div');
  container.id = TOAST_CONTAINER_ID;

  // Use a shadow DOM to isolate styles from the host page.
  const shadow = container.attachShadow({ mode: 'closed' });

  const styleEl = document.createElement('style');
  styleEl.textContent = getToastStyles();
  shadow.appendChild(styleEl);

  const inner = document.createElement('div');
  inner.className = 'abg-toast-inner';
  shadow.appendChild(inner);

  // Store reference to the inner container on the host element.
  (container as unknown as { _inner: HTMLElement })._inner = inner;

  document.documentElement.appendChild(container);
  return container;
}

function getInner(container: HTMLElement): HTMLElement {
  return (container as unknown as { _inner: HTMLElement })._inner;
}

/**
 * Show a toast notification for a blocked action.
 * Returns a cleanup function to remove the toast.
 */
export function showBlockedToast(options: ToastOptions): () => void {
  const { capability, url, reason, onWhitelist, onDismiss } = options;
  const container = ensureContainer();
  const inner = getInner(container);

  // Limit visible toasts
  while (inner.children.length >= MAX_VISIBLE_TOASTS) {
    inner.removeChild(inner.firstChild!);
  }

  const toast = document.createElement('div');
  toast.className = 'abg-toast';
  toast.setAttribute('role', 'alert');

  const isCritical = CRITICAL_CAPABILITIES.has(capability);
  const label = CAPABILITY_LABELS[capability] ?? capability;
  const domain = extractDomain(url);

  // Icon (shield)
  const icon = document.createElement('span');
  icon.className = 'abg-toast-icon';
  icon.textContent = '\u{1F6E1}'; // shield emoji as fallback — CSS replaces with SVG
  icon.setAttribute('aria-hidden', 'true');

  // Message
  const msg = document.createElement('span');
  msg.className = 'abg-toast-msg';
  msg.textContent = `AI Browser Guard blocked ${label} on this page.`;

  // Actions row
  const actions = document.createElement('span');
  actions.className = 'abg-toast-actions';

  if (domain && onWhitelist) {
    const whitelistBtn = document.createElement('button');
    whitelistBtn.className = 'abg-toast-btn abg-toast-btn-allow';
    whitelistBtn.textContent = `Allow on ${domain}`;
    whitelistBtn.addEventListener('click', () => {
      onWhitelist(domain);
      removeToast();
    });
    actions.appendChild(whitelistBtn);
  }

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'abg-toast-btn abg-toast-btn-dismiss';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.addEventListener('click', () => {
    removeToast();
    onDismiss?.();
  });
  actions.appendChild(dismissBtn);

  toast.appendChild(icon);
  toast.appendChild(msg);
  toast.appendChild(actions);
  inner.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('abg-toast-visible');
  });

  let dismissed = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const removeToast = () => {
    if (dismissed) return;
    dismissed = true;
    if (timeoutId) clearTimeout(timeoutId);
    toast.classList.remove('abg-toast-visible');
    toast.classList.add('abg-toast-exit');
    setTimeout(() => {
      try { inner.removeChild(toast); } catch { /* already removed */ }
    }, 300); // match CSS transition
  };

  // Auto-dismiss for non-critical
  const dismissMs = isCritical ? CRITICAL_AUTO_DISMISS_MS : AUTO_DISMISS_MS;
  if (dismissMs > 0) {
    timeoutId = setTimeout(removeToast, dismissMs);
  }

  return removeToast;
}

/** CSS for toast notifications, scoped inside shadow DOM. */
function getToastStyles(): string {
  return `
    .abg-toast-inner {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .abg-toast {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #1a1a2e;
      border: 1px solid rgba(6, 182, 212, 0.3);
      border-radius: 8px;
      color: #e0e0e0;
      font-size: 13px;
      line-height: 1.4;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      pointer-events: auto;
      transform: translateX(120%);
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
      max-width: 420px;
    }

    .abg-toast-visible {
      transform: translateX(0);
      opacity: 1;
    }

    .abg-toast-exit {
      transform: translateX(120%);
      opacity: 0;
    }

    .abg-toast-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }

    .abg-toast-msg {
      flex: 1;
      color: #e0e0e0;
    }

    .abg-toast-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }

    .abg-toast-btn {
      border: none;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
    }

    .abg-toast-btn-allow {
      background: rgba(6, 182, 212, 0.2);
      color: #06b6d4;
      border: 1px solid rgba(6, 182, 212, 0.3);
    }
    .abg-toast-btn-allow:hover {
      background: rgba(6, 182, 212, 0.35);
    }

    .abg-toast-btn-dismiss {
      background: rgba(255, 255, 255, 0.08);
      color: #999;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .abg-toast-btn-dismiss:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ccc;
    }
  `;
}
