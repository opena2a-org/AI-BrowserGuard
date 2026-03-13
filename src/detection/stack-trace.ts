/**
 * Stack trace analysis for CDP execution context detection.
 *
 * When automation frameworks execute code via CDP (e.g., page.evaluate()),
 * the JavaScript call stack contains framework-specific signatures that
 * cannot be hidden:
 *
 * - Playwright: "UtilityScript.evaluate" in stack frames
 * - Puppeteer: "__puppeteer_evaluation_script__" or "pptr:" prefixes
 * - Generic CDP: "eval at evaluate" with anonymous source URLs
 *
 * This module provides detection by analyzing Error stack traces from
 * within the page's JavaScript context (MAIN world).
 *
 * IMPORTANT: This module runs in the page's JS context (MAIN world),
 * NOT in the extension's isolated world. It cannot use chrome.* APIs.
 */

import type { AgentType, DetectionConfidence, DetectionMethod } from '../types/agent';

export interface StackTraceDetectionResult {
  detected: boolean;
  method: DetectionMethod;
  confidence: DetectionConfidence;
  frameworkType: AgentType;
  detail: string;
  signals: Record<string, unknown>;
}

/** Known stack trace patterns for automation frameworks. */
const FRAMEWORK_PATTERNS: Array<{
  pattern: RegExp;
  framework: AgentType;
  label: string;
  confidence: DetectionConfidence;
}> = [
  {
    pattern: /UtilityScript\.evaluate/,
    framework: 'playwright',
    label: 'Playwright UtilityScript',
    confidence: 'confirmed',
  },
  {
    pattern: /UtilityScript\.<anonymous>/,
    framework: 'playwright',
    label: 'Playwright UtilityScript (anonymous)',
    confidence: 'confirmed',
  },
  {
    pattern: /__puppeteer_evaluation_script__/,
    framework: 'puppeteer',
    label: 'Puppeteer evaluation script',
    confidence: 'confirmed',
  },
  {
    pattern: /pptr:/,
    framework: 'puppeteer',
    label: 'Puppeteer pptr: protocol',
    confidence: 'confirmed',
  },
  {
    pattern: /ExecutionContext\._evaluateInternal/,
    framework: 'puppeteer',
    label: 'Puppeteer ExecutionContext',
    confidence: 'high',
  },
  {
    // Selenium WebDriver: executeScript injects via callFunction wrapper
    // Verified against real Selenium 4.41 + ChromeDriver 146 + Chrome 145
    pattern: /callFunction\b/,
    framework: 'selenium',
    label: 'Selenium callFunction',
    confidence: 'high',
  },
  {
    // Selenium WebDriver: executeScript appears in stack when running user JS
    // Verified against real Selenium 4.41 + Chrome 145
    pattern: /executeScript\b/,
    framework: 'selenium',
    label: 'Selenium executeScript',
    confidence: 'medium',
  },
  {
    pattern: /eval at evaluate \((?:<anonymous>|:[\d]+:[\d]+)\)/,
    framework: 'cdp-generic',
    label: 'CDP Runtime.evaluate',
    confidence: 'high',
  },
];

/**
 * Analyze an Error stack trace for automation framework signatures.
 *
 * Call this with `new Error().stack` captured from within the page context.
 * The detection works because CDP-injected code produces stack frames
 * that cannot be faked or hidden by the automation framework.
 */
export function analyzeStackTrace(stack: string): StackTraceDetectionResult {
  const signals: Record<string, unknown> = {};
  const matches: Array<{ label: string; framework: AgentType; confidence: DetectionConfidence }> = [];

  for (const { pattern, framework, label, confidence } of FRAMEWORK_PATTERNS) {
    if (pattern.test(stack)) {
      matches.push({ label, framework, confidence });
      signals[label] = true;
    }
  }

  if (matches.length === 0) {
    return {
      detected: false,
      method: 'framework-fingerprint',
      confidence: 'low',
      frameworkType: 'unknown',
      detail: 'No automation signatures found in stack trace.',
      signals,
    };
  }

  // Use the highest-confidence match
  const best = matches.reduce((a, b) => {
    const order: DetectionConfidence[] = ['low', 'medium', 'high', 'confirmed'];
    return order.indexOf(b.confidence) > order.indexOf(a.confidence) ? b : a;
  });

  return {
    detected: true,
    method: 'framework-fingerprint',
    confidence: best.confidence,
    frameworkType: best.framework,
    detail: `Automation framework detected via stack trace: ${matches.map(m => m.label).join(', ')}.`,
    signals,
  };
}

/**
 * Set up a trap that monitors for CDP-evaluated code.
 *
 * This works by patching `Error.prepareStackTrace` (V8-specific) to
 * inspect stack frames as they are created. When code evaluated via CDP
 * creates an Error, the structured call sites reveal the automation
 * framework.
 *
 * Returns a cleanup function and a callback that fires on detection.
 */
export function installStackTraceTrap(
  onDetection: (result: StackTraceDetectionResult) => void,
): () => void {
  // Track whether we already reported to avoid flooding
  let reported = false;

  // Store the original prepareStackTrace (may be undefined)
  const originalPrepare = (Error as unknown as Record<string, unknown>).prepareStackTrace as
    ((err: Error, callSites: NodeJS.CallSite[]) => string) | undefined;

  /**
   * V8's Error.prepareStackTrace receives structured CallSite objects
   * before they are serialized to a string. We inspect these for
   * automation patterns, then delegate to the original formatter.
   */
  (Error as unknown as Record<string, unknown>).prepareStackTrace = function (
    err: Error,
    callSites: NodeJS.CallSite[],
  ): string {
    if (!reported) {
      try {
        for (const site of callSites) {
          const fnName = site.getFunctionName() ?? '';
          const typeName = site.getTypeName() ?? '';
          const fileName = site.getFileName() ?? '';

          // Playwright: UtilityScript.evaluate
          if (typeName === 'UtilityScript' || fnName.includes('UtilityScript')) {
            reported = true;
            onDetection({
              detected: true,
              method: 'framework-fingerprint',
              confidence: 'confirmed',
              frameworkType: 'playwright',
              detail: `Playwright detected: ${typeName}.${fnName} in call stack.`,
              signals: { typeName, fnName, fileName },
            });
            break;
          }

          // Puppeteer: __puppeteer_evaluation_script__ or pptr:
          if (fileName.includes('__puppeteer_evaluation_script__') || fileName.startsWith('pptr:')) {
            reported = true;
            onDetection({
              detected: true,
              method: 'framework-fingerprint',
              confidence: 'confirmed',
              frameworkType: 'puppeteer',
              detail: `Puppeteer detected: ${fileName} in call stack.`,
              signals: { typeName, fnName, fileName },
            });
            break;
          }

          // Selenium: callFunction is the wrapper ChromeDriver uses for executeScript
          if (fnName === 'callFunction' || fnName === 'executeScript') {
            reported = true;
            onDetection({
              detected: true,
              method: 'framework-fingerprint',
              confidence: 'high',
              frameworkType: 'selenium',
              detail: `Selenium detected: ${fnName} in call stack.`,
              signals: { typeName, fnName, fileName },
            });
            break;
          }
        }
      } catch {
        // Do not let inspection errors propagate — page stability is paramount
      }
    }

    // Delegate to original or produce default stack string
    if (originalPrepare) {
      return originalPrepare(err, callSites);
    }
    return `${err}\n${callSites.map((s) => `    at ${s}`).join('\n')}`;
  };

  return () => {
    // Restore original
    (Error as unknown as Record<string, unknown>).prepareStackTrace = originalPrepare;
  };
}

/**
 * One-shot stack trace probe.
 *
 * Creates an Error and analyzes its stack trace for automation signatures.
 * Useful for periodic checks from a content script or interceptor.
 *
 * Note: This only detects automation IF the calling code itself was
 * evaluated via CDP. When called from a content script's own execution
 * context, the stack trace will show the extension URL, not CDP patterns.
 * The primary use case is calling this from within intercepted API calls
 * (window.open, form.submit, etc.) where the call may originate from
 * CDP-evaluated code.
 */
export function probeStackTrace(): StackTraceDetectionResult {
  try {
    const err = new Error('__abg_stack_probe__');
    return analyzeStackTrace(err.stack ?? '');
  } catch {
    return {
      detected: false,
      method: 'framework-fingerprint',
      confidence: 'low',
      frameworkType: 'unknown',
      detail: 'Stack trace probe failed.',
      signals: {},
    };
  }
}
