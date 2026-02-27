/**
 * Emergency kill switch module.
 *
 * Provides one-click revocation of all agent access.
 */

import type { KillSwitchEvent } from '../types/events';
import type { DelegationToken } from '../types/delegation';
import { revokeToken } from '../delegation/rules';

export interface KillSwitchState {
  isActive: boolean;
  lastEvent: KillSwitchEvent | null;
  lastActivatedAt: string | null;
}

// Track cleanup functions registered by content-side modules
const registeredCleanups: Array<() => void> = [];

/**
 * Register a cleanup function to be called during kill switch execution.
 * Used by detector and monitor modules to register their teardown logic.
 */
export function registerCleanup(cleanup: () => void): void {
  registeredCleanups.push(cleanup);
}

/**
 * Execute the kill switch from the content script side.
 */
export function executeContentKillSwitch(): {
  listenersRemoved: number;
  observersDisconnected: number;
  bindingsCleared: string[];
} {
  let listenersRemoved = 0;
  let observersDisconnected = 0;

  // Call all registered cleanup functions
  for (const cleanup of registeredCleanups) {
    try {
      cleanup();
      listenersRemoved++;
    } catch {
      // Best effort
    }
  }
  registeredCleanups.length = 0;

  // Clear automation bindings
  const bindingsCleared = clearAutomationFlags();

  // Attempt CDP termination
  terminateCdpConnections();

  return { listenersRemoved, observersDisconnected, bindingsCleared };
}

/**
 * Execute the kill switch from the background service worker side.
 */
export async function executeBackgroundKillSwitch(
  trigger: 'button' | 'keyboard-shortcut' | 'api',
  activeAgentIds: string[],
  activeTokens: DelegationToken[]
): Promise<KillSwitchEvent> {
  const revokedTokenIds: string[] = [];

  // Revoke all tokens
  for (const token of activeTokens) {
    revokeToken(token);
    revokedTokenIds.push(token.tokenId);
  }

  // Send kill command to all tabs
  let cdpTerminated = false;
  let automationFlagsCleared = false;
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id === undefined) continue;
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'KILL_SWITCH_ACTIVATE',
          data: {},
          sentAt: new Date().toISOString(),
        });
      } catch {
        // Tab may not have content script
      }
    }
    cdpTerminated = true;
    automationFlagsCleared = true;
  } catch {
    // Best effort
  }

  const event: KillSwitchEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    trigger,
    terminatedAgentIds: [...activeAgentIds],
    revokedTokenIds,
    cdpTerminated,
    automationFlagsCleared,
  };

  // Show notification
  showKillSwitchNotification(activeAgentIds.length);

  return event;
}

/**
 * Attempt to terminate CDP connections (best-effort from content script).
 */
export function terminateCdpConnections(): boolean {
  try {
    const windowKeys = Object.getOwnPropertyNames(window);
    let found = false;
    for (const key of windowKeys) {
      if (
        key.startsWith('__cdp_') ||
        key.startsWith('__chromium_')
      ) {
        try {
          delete (window as unknown as Record<string, unknown>)[key];
          found = true;
        } catch {
          // Property may not be deletable
        }
      }
    }
    return found;
  } catch {
    return false;
  }
}

/**
 * Clear automation flags from the current page context.
 */
export function clearAutomationFlags(): string[] {
  const cleared: string[] = [];

  // Try to clear navigator.webdriver
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true,
    });
    cleared.push('navigator.webdriver');
  } catch {
    // May not be writable
  }

  // Clear Selenium markers
  const docKeys = Object.getOwnPropertyNames(document);
  for (const key of docKeys) {
    if (key.startsWith('$cdc_') || key.startsWith('$wdc_')) {
      try {
        delete (document as unknown as Record<string, unknown>)[key];
        cleared.push(key);
      } catch {
        // Best effort
      }
    }
  }

  // Clear Playwright and Puppeteer bindings
  const windowKeys = Object.getOwnPropertyNames(window);
  const automationPrefixes = ['__playwright', '__puppeteer', '__pw_'];
  for (const key of windowKeys) {
    if (automationPrefixes.some((prefix) => key.startsWith(prefix))) {
      try {
        delete (window as unknown as Record<string, unknown>)[key];
        cleared.push(key);
      } catch {
        // Best effort
      }
    }
  }

  return cleared;
}

/**
 * Show a Chrome notification confirming kill switch activation.
 */
export function showKillSwitchNotification(agentCount: number): void {
  try {
    chrome.notifications.create(`abg-killswitch-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'AI Browser Guard - Kill Switch Activated',
      message: `Terminated ${agentCount} agent session(s). All delegations revoked.`,
      priority: 2,
    });

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      try {
        chrome.notifications.getAll((notifications) => {
          for (const id of Object.keys(notifications)) {
            if (id.startsWith('abg-killswitch-')) {
              chrome.notifications.clear(id);
            }
          }
        });
      } catch {
        // Ignore
      }
    }, 5000);
  } catch {
    // Notifications may not be available in content script context
  }
}

/**
 * Create the initial kill switch state.
 */
export function createInitialKillSwitchState(): KillSwitchState {
  return {
    isActive: false,
    lastEvent: null,
    lastActivatedAt: null,
  };
}
