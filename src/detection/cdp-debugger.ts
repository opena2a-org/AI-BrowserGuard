/**
 * CDP Debugger Attachment Detection.
 *
 * Uses the chrome.debugger API to detect when an external automation
 * framework (Playwright, Puppeteer, or any CDP client) is connected
 * to browser targets.
 *
 * This is the most reliable detection method because ALL modern
 * automation frameworks (Playwright, Puppeteer, Selenium 4+,
 * Anthropic Computer Use, OpenAI Operator) communicate with the
 * browser via Chrome DevTools Protocol. The chrome.debugger API
 * can detect these connections at the browser level, regardless
 * of what the page-level JavaScript context shows.
 *
 * Requires the "debugger" permission in manifest.json.
 */

import type { AgentType, DetectionConfidence, DetectionMethod } from '../types/agent';

export interface DebuggerDetectionResult {
  detected: boolean;
  method: DetectionMethod;
  confidence: DetectionConfidence;
  detail: string;
  targets: DebuggerTarget[];
  inferredFramework: AgentType;
}

export interface DebuggerTarget {
  targetId: string;
  type: string;
  title: string;
  url: string;
  attached: boolean;
  tabId?: number;
}

/**
 * Check all browser targets for attached debuggers.
 *
 * When a CDP client (Playwright, Puppeteer, etc.) connects to Chrome,
 * it attaches to one or more targets. This function queries the browser
 * for all targets and identifies those with active debugger attachments.
 *
 * Must be called from the background service worker (chrome.debugger is
 * not available in content scripts).
 */
export async function detectDebuggerAttachment(): Promise<DebuggerDetectionResult> {
  const noDetection: DebuggerDetectionResult = {
    detected: false,
    method: 'cdp-connection',
    confidence: 'low',
    detail: 'No external debugger attachment detected.',
    targets: [],
    inferredFramework: 'unknown',
  };

  // chrome.debugger may not be available if permission is missing
  if (typeof chrome === 'undefined' || !chrome.debugger || !chrome.debugger.getTargets) {
    return {
      ...noDetection,
      detail: 'chrome.debugger API not available (missing debugger permission).',
    };
  }

  try {
    const targets = await new Promise<chrome.debugger.TargetInfo[]>((resolve, reject) => {
      chrome.debugger.getTargets((result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });

    // Find targets with an attached debugger
    const attachedTargets = targets.filter((t) => t.attached);

    if (attachedTargets.length === 0) {
      return noDetection;
    }

    // Map to our target format
    const detectedTargets: DebuggerTarget[] = attachedTargets.map((t) => ({
      targetId: t.id,
      type: t.type,
      title: t.title,
      url: t.url,
      attached: t.attached,
      tabId: t.tabId,
    }));

    // Infer framework from target characteristics
    const framework = inferFrameworkFromTargets(targets, attachedTargets);

    return {
      detected: true,
      method: 'cdp-connection',
      confidence: 'confirmed',
      detail: `External debugger attached to ${attachedTargets.length} target(s). Framework: ${framework}.`,
      targets: detectedTargets,
      inferredFramework: framework,
    };
  } catch (err) {
    return {
      ...noDetection,
      detail: `Failed to query debugger targets: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Infer which automation framework is connected based on target patterns.
 *
 * Different frameworks have different connection patterns:
 * - Playwright: typically attaches to specific page targets
 * - Puppeteer: attaches to the browser target first
 * - Selenium 4+: uses CDP via BiDi, attaches to browser target
 */
function inferFrameworkFromTargets(
  allTargets: chrome.debugger.TargetInfo[],
  attachedTargets: chrome.debugger.TargetInfo[],
): AgentType {
  // Check if the browser target itself is attached (Puppeteer pattern)
  const browserTargetAttached = attachedTargets.some((t) => t.type === 'browser');

  // Check for page-only attachment (Playwright pattern)
  const onlyPageTargets = attachedTargets.every((t) => t.type === 'page');

  // Check target URLs for framework hints
  const allUrls = attachedTargets.map((t) => t.url).join(' ');
  const allTitles = attachedTargets.map((t) => t.title).join(' ');

  if (allUrls.includes('playwright') || allTitles.includes('playwright')) {
    return 'playwright';
  }
  if (allUrls.includes('puppeteer') || allTitles.includes('puppeteer')) {
    return 'puppeteer';
  }

  // Playwright typically attaches per-page without the browser target
  if (onlyPageTargets && !browserTargetAttached) {
    return 'playwright';
  }

  // Puppeteer typically attaches to the browser target
  if (browserTargetAttached) {
    return 'puppeteer';
  }

  return 'cdp-generic';
}

/**
 * Start monitoring for debugger attachments.
 *
 * Polls chrome.debugger.getTargets() at the specified interval and
 * invokes the callback when a new attachment is detected.
 *
 * Must be called from the background service worker.
 *
 * @returns Cleanup function to stop monitoring.
 */
export function monitorDebuggerAttachment(
  callback: (result: DebuggerDetectionResult) => void,
  intervalMs = 3000,
): () => void {
  let stopped = false;
  let lastDetectedCount = 0;

  const check = async () => {
    if (stopped) return;
    const result = await detectDebuggerAttachment();

    if (result.detected && result.targets.length !== lastDetectedCount) {
      lastDetectedCount = result.targets.length;
      callback(result);
    } else if (!result.detected) {
      lastDetectedCount = 0;
    }
  };

  // Initial check
  check().catch(() => { /* ignore */ });

  const intervalId = setInterval(() => {
    check().catch(() => { /* ignore */ });
  }, intervalMs);

  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}
