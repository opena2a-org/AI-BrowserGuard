/**
 * Generic automation framework detection.
 *
 * Detects automation frameworks that may not leave WebDriver or CDP traces,
 * including browser-based AI agents and newer frameworks.
 */

import type { AgentType, DetectionMethod, DetectionConfidence } from '../types/agent';

export interface FrameworkDetectionResult {
  detected: boolean;
  frameworkType: AgentType;
  method: DetectionMethod;
  confidence: DetectionConfidence;
  detail: string;
  signals: Record<string, unknown>;
}

/**
 * Detect Anthropic Computer Use agent patterns.
 *
 * Anthropic Computer Use operates via screenshot + click patterns
 * with pixel-perfect coordinates and fixed inference timing.
 */
export function detectAnthropicComputerUse(): FrameworkDetectionResult {
  const signals: Record<string, unknown> = {};
  const found: string[] = [];

  // Check for Computer Use-specific injected globals
  const markers = [
    '__anthropic_computer_use__',
    '__computer_use__',
    '__anthropic_tool__',
  ];
  for (const marker of markers) {
    if (marker in window) {
      found.push(marker);
      signals[marker] = true;
    }
  }

  // Check for screenshot API overrides (canvas.toDataURL, getDisplayMedia)
  try {
    const canvasProto = HTMLCanvasElement.prototype;
    const toDataURLDesc = Object.getOwnPropertyDescriptor(canvasProto, 'toDataURL');
    if (toDataURLDesc && !toDataURLDesc.writable && toDataURLDesc.configurable) {
      signals.toDataURLModified = true;
    }
  } catch {
    // Ignore
  }

  return {
    detected: found.length > 0,
    frameworkType: 'anthropic-computer-use',
    method: 'framework-fingerprint',
    confidence: found.length > 0 ? 'high' : 'low',
    detail: found.length > 0
      ? `Anthropic Computer Use indicators: ${found.join(', ')}.`
      : 'No Anthropic Computer Use indicators detected.',
    signals,
  };
}

/**
 * Detect OpenAI Operator agent patterns.
 */
export function detectOpenAIOperator(): FrameworkDetectionResult {
  const signals: Record<string, unknown> = {};
  const found: string[] = [];

  // Check for Operator-specific globals
  const markers = [
    '__openai_operator__',
    '__operator_runtime__',
    '__openai_browser_tool__',
  ];
  for (const marker of markers) {
    if (marker in window) {
      found.push(marker);
      signals[marker] = true;
    }
  }

  // Check for modified user agent indicating custom Chromium
  const ua = navigator.userAgent;
  if (ua.includes('Operator') || ua.includes('OpenAI')) {
    found.push('userAgent');
    signals.userAgent = ua;
  }

  // Check for accessibility tree query patterns
  if ('getComputedAccessibleNode' in Element.prototype) {
    signals.accessibilityAPI = true;
  }

  return {
    detected: found.length > 0,
    frameworkType: 'openai-operator',
    method: 'framework-fingerprint',
    confidence: found.length > 0 ? 'high' : 'low',
    detail: found.length > 0
      ? `OpenAI Operator indicators: ${found.join(', ')}.`
      : 'No OpenAI Operator indicators detected.',
    signals,
  };
}

/**
 * Run all framework-specific detection checks.
 */
export function detectAllFrameworks(): FrameworkDetectionResult[] {
  const results: FrameworkDetectionResult[] = [];

  const computerUse = detectAnthropicComputerUse();
  if (computerUse.detected) results.push(computerUse);

  const operator = detectOpenAIOperator();
  if (operator.detected) results.push(operator);

  const generic = detectGenericAutomation();
  if (generic.detected) results.push(generic);

  return results;
}

/**
 * Check for generic automation indicators that are not framework-specific.
 */
export function detectGenericAutomation(): FrameworkDetectionResult {
  const signals: Record<string, unknown> = {};
  const indicators: string[] = [];

  // Headless Chrome indicators
  // chrome.loadTimes and chrome.csi are missing in headless mode
  const chromeObj = (window as unknown as Record<string, unknown>).chrome as Record<string, unknown> | undefined;
  if (chromeObj) {
    signals.hasLoadTimes = 'loadTimes' in chromeObj;
    signals.hasCsi = 'csi' in chromeObj;

    if (!('loadTimes' in chromeObj)) {
      indicators.push('missing chrome.loadTimes');
    }
    if (!('csi' in chromeObj)) {
      indicators.push('missing chrome.csi');
    }
  }

  // Check screen dimensions vs viewport for headless
  if (window.outerWidth === 0 && window.outerHeight === 0) {
    indicators.push('zero outer dimensions');
    signals.outerWidth = window.outerWidth;
    signals.outerHeight = window.outerHeight;
  }

  // Check for missing browser-specific APIs
  if (!window.chrome) {
    indicators.push('window.chrome missing');
    signals.chromePresent = false;
  }

  // Check WebGL renderer for headless indicators
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        signals.webglRenderer = renderer;
        if (typeof renderer === 'string' && (renderer.includes('SwiftShader') || renderer.includes('llvmpipe'))) {
          indicators.push('software renderer (headless indicator)');
        }
      }
    }
  } catch {
    // Ignore WebGL errors
  }

  const detected = indicators.length >= 2;
  return {
    detected,
    frameworkType: detected ? 'cdp-generic' : 'unknown',
    method: 'automation-flag',
    confidence: detected ? 'medium' : 'low',
    detail: detected
      ? `Generic automation indicators: ${indicators.join(', ')}.`
      : 'No generic automation indicators detected.',
    signals,
  };
}
