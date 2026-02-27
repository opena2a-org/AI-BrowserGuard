/**
 * WebDriver flag detection.
 *
 * Detects the navigator.webdriver property and related automation flags
 * that are set when a browser is controlled by WebDriver-compliant tools.
 */

import type { DetectionMethod, DetectionConfidence } from '../types/agent';

export interface WebDriverDetectionResult {
  detected: boolean;
  method: DetectionMethod;
  confidence: DetectionConfidence;
  detail: string;
  signals: Record<string, unknown>;
}

/**
 * Check the navigator.webdriver property.
 * Also checks whether the property descriptor has been tampered with.
 */
export function detectWebDriverFlag(): WebDriverDetectionResult {
  const signals: Record<string, unknown> = {};

  // Direct value check
  const webdriverValue = navigator.webdriver;
  signals.webdriverValue = webdriverValue;

  // Property descriptor check for tampering
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'webdriver');
  signals.hasOwnDescriptor = !!descriptor;
  if (descriptor) {
    signals.configurable = descriptor.configurable;
    signals.enumerable = descriptor.enumerable;
    signals.writable = descriptor.writable;
  }

  // Check prototype descriptor
  const protoDescriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(navigator),
    'webdriver'
  );
  signals.protoDescriptor = !!protoDescriptor;

  if (webdriverValue === true) {
    return {
      detected: true,
      method: 'webdriver-flag',
      confidence: 'high',
      detail: 'navigator.webdriver is true, indicating WebDriver automation.',
      signals,
    };
  }

  // Check for tampering: if the property is own (overridden) and set to false
  if (descriptor && webdriverValue === false) {
    return {
      detected: true,
      method: 'webdriver-flag',
      confidence: 'medium',
      detail: 'navigator.webdriver was overridden to false, suggesting automation evasion.',
      signals,
    };
  }

  return {
    detected: false,
    method: 'webdriver-flag',
    confidence: 'low',
    detail: 'No WebDriver flag detected.',
    signals,
  };
}

/**
 * Check for additional automation-related navigator anomalies.
 */
export function detectNavigatorAnomalies(): WebDriverDetectionResult {
  const signals: Record<string, unknown> = {};
  let detected = false;
  const details: string[] = [];

  // Headless: plugins length is 0
  signals.pluginsLength = navigator.plugins.length;
  if (navigator.plugins.length === 0) {
    detected = true;
    details.push('No browser plugins detected (headless indicator).');
  }

  // Empty or missing languages
  signals.languages = navigator.languages;
  if (!navigator.languages || navigator.languages.length === 0) {
    detected = true;
    details.push('No browser languages set (headless indicator).');
  }

  // Notification permission check (headless defaults to denied)
  try {
    signals.notificationPermission = Notification.permission;
    if (Notification.permission === 'denied') {
      details.push('Notifications are denied by default.');
    }
  } catch {
    signals.notificationPermission = 'unavailable';
  }

  return {
    detected,
    method: 'automation-flag',
    confidence: detected ? 'medium' : 'low',
    detail: details.length > 0 ? details.join(' ') : 'No navigator anomalies detected.',
    signals,
  };
}

/**
 * Check for Selenium-specific markers.
 */
export function detectSeleniumMarkers(): WebDriverDetectionResult {
  const signals: Record<string, unknown> = {};
  const foundMarkers: string[] = [];

  // Check for $cdc_ prefixed properties on document
  const docKeys = Object.getOwnPropertyNames(document);
  for (const key of docKeys) {
    if (key.startsWith('$cdc_') || key.startsWith('$wdc_')) {
      foundMarkers.push(key);
      signals[key] = true;
    }
  }

  // Check for Selenium globals on window
  const seleniumGlobals = [
    'callSelenium',
    '_selenium',
    'callPhantom',
    '__nightmare',
    '_Selenium_IDE_Recorder',
  ];
  for (const name of seleniumGlobals) {
    if (name in window) {
      foundMarkers.push(name);
      signals[name] = true;
    }
  }

  // Check for ChromeDriver properties
  const windowKeys = Object.getOwnPropertyNames(window);
  for (const key of windowKeys) {
    if (key.startsWith('cdc_') || key.startsWith('$chrome_asyncScriptInfo')) {
      foundMarkers.push(key);
      signals[key] = true;
    }
  }

  return {
    detected: foundMarkers.length > 0,
    method: 'framework-fingerprint',
    confidence: foundMarkers.length > 0 ? 'confirmed' : 'low',
    detail: foundMarkers.length > 0
      ? `Selenium markers found: ${foundMarkers.join(', ')}.`
      : 'No Selenium markers detected.',
    signals,
  };
}

/**
 * Monitor for late-set WebDriver flags.
 */
export function monitorWebDriverChanges(
  callback: (result: WebDriverDetectionResult) => void
): () => void {
  let stopped = false;

  // Poll periodically since property interception may not be possible
  const intervalId = setInterval(() => {
    if (stopped) return;
    const result = detectWebDriverFlag();
    if (result.detected) {
      callback(result);
    }
  }, 3000);

  // Also try to intercept property definition
  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}
