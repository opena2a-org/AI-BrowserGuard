/**
 * Chrome DevTools Protocol (CDP) detection patterns.
 *
 * Detects when a CDP client is connected to the browser, which indicates
 * programmatic control by an automation framework.
 */

import type { DetectionMethod, DetectionConfidence } from '../types/agent';

export interface CdpDetectionResult {
  detected: boolean;
  method: DetectionMethod;
  confidence: DetectionConfidence;
  detail: string;
  signals: Record<string, unknown>;
}

/**
 * Check for CDP connection indicators in the current page context.
 */
export function detectCdpConnection(): CdpDetectionResult {
  const signals: Record<string, unknown> = {};
  const found: string[] = [];

  // Check for __cdp_binding_* properties
  const windowKeys = Object.getOwnPropertyNames(window);
  for (const key of windowKeys) {
    if (key.startsWith('__cdp_') || key.startsWith('__chromium_')) {
      found.push(key);
      signals[key] = true;
    }
  }

  // Check for Playwright/Puppeteer bindings (these use CDP internally)
  const cdpBindings = [
    '__playwright_evaluation_script__',
    '__puppeteer_evaluation_script__',
    '__playwright',
    '__puppeteer',
  ];
  for (const binding of cdpBindings) {
    if (binding in window) {
      found.push(binding);
      signals[binding] = true;
    }
  }

  // Check for DevToolsAPI presence
  if ('DevToolsAPI' in window) {
    found.push('DevToolsAPI');
    signals.devToolsAPI = true;
  }

  const detected = found.length > 0;
  return {
    detected,
    method: 'cdp-connection',
    confidence: detected ? (found.length >= 2 ? 'confirmed' : 'high') : 'low',
    detail: detected
      ? `CDP indicators found: ${found.join(', ')}.`
      : 'No CDP connection indicators detected.',
    signals,
  };
}

/**
 * Check for Playwright-specific CDP bindings.
 */
export function detectPlaywrightBindings(): CdpDetectionResult {
  const signals: Record<string, unknown> = {};
  const found: string[] = [];

  const playwrightMarkers = [
    '__playwright_evaluation_script__',
    '__playwright',
    '__pw_',
    'playwright',
  ];

  const windowKeys = Object.getOwnPropertyNames(window);
  for (const key of windowKeys) {
    if (key.startsWith('__pw_') || key.startsWith('__playwright')) {
      found.push(key);
      signals[key] = true;
    }
  }

  for (const marker of playwrightMarkers) {
    if (marker in window && !found.includes(marker)) {
      found.push(marker);
      signals[marker] = true;
    }
  }

  // Check for Playwright-injected utility selectors
  try {
    const utilitySelectors = ['_playwright_selector_engine_'];
    for (const sel of utilitySelectors) {
      if (sel in window) {
        found.push(sel);
        signals[sel] = true;
      }
    }
  } catch {
    // Ignore access errors
  }

  return {
    detected: found.length > 0,
    method: 'framework-fingerprint',
    confidence: found.length > 0 ? 'confirmed' : 'low',
    detail: found.length > 0
      ? `Playwright bindings found: ${found.join(', ')}.`
      : 'No Playwright bindings detected.',
    signals,
  };
}

/**
 * Check for Puppeteer-specific CDP markers.
 */
export function detectPuppeteerBindings(): CdpDetectionResult {
  const signals: Record<string, unknown> = {};
  const found: string[] = [];

  const windowKeys = Object.getOwnPropertyNames(window);
  for (const key of windowKeys) {
    if (key.startsWith('__puppeteer') || key.startsWith('puppeteer_')) {
      found.push(key);
      signals[key] = true;
    }
  }

  // Check for DevToolsAPI-related globals used by Puppeteer
  const puppeteerMarkers = [
    '__puppeteer_evaluation_script__',
    'puppeteer',
  ];
  for (const marker of puppeteerMarkers) {
    if (marker in window && !found.includes(marker)) {
      found.push(marker);
      signals[marker] = true;
    }
  }

  return {
    detected: found.length > 0,
    method: 'framework-fingerprint',
    confidence: found.length > 0 ? 'confirmed' : 'low',
    detail: found.length > 0
      ? `Puppeteer bindings found: ${found.join(', ')}.`
      : 'No Puppeteer bindings detected.',
    signals,
  };
}

/**
 * Monitor for new CDP connections by observing window property additions.
 */
export function monitorCdpConnections(
  callback: (result: CdpDetectionResult) => void
): () => void {
  let stopped = false;
  const knownKeys = new Set(Object.getOwnPropertyNames(window));

  const intervalId = setInterval(() => {
    if (stopped) return;
    const currentKeys = Object.getOwnPropertyNames(window);
    for (const key of currentKeys) {
      if (knownKeys.has(key)) continue;
      knownKeys.add(key);

      if (
        key.startsWith('__cdp_') ||
        key.startsWith('__playwright') ||
        key.startsWith('__puppeteer') ||
        key.startsWith('__pw_') ||
        key.startsWith('__chromium_')
      ) {
        callback({
          detected: true,
          method: 'cdp-connection',
          confidence: 'high',
          detail: `New CDP binding detected: ${key}.`,
          signals: { [key]: true, detectedAt: Date.now() },
        });
      }
    }
  }, 2000);

  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}
