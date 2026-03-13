import { describe, it, expect } from 'vitest';
import { analyzeStackTrace, probeStackTrace } from './stack-trace';

describe('analyzeStackTrace', () => {
  it('detects Playwright UtilityScript.evaluate pattern', () => {
    const stack = [
      'Error: stack-trace-test',
      '    at eval (eval at evaluate (:301:30), <anonymous>:9:11)',
      '    at UtilityScript.evaluate (<anonymous>:303:16)',
      '    at UtilityScript.<anonymous> (<anonymous>:1:44)',
    ].join('\n');

    const result = analyzeStackTrace(stack);
    expect(result.detected).toBe(true);
    expect(result.frameworkType).toBe('playwright');
    expect(result.confidence).toBe('confirmed');
    expect(result.detail).toContain('Playwright');
  });

  it('detects Playwright UtilityScript anonymous pattern', () => {
    const stack = [
      'Error: test',
      '    at Object.evaluate (<anonymous>:5:3)',
      '    at UtilityScript.<anonymous> (<anonymous>:1:44)',
    ].join('\n');

    const result = analyzeStackTrace(stack);
    expect(result.detected).toBe(true);
    expect(result.frameworkType).toBe('playwright');
    expect(result.confidence).toBe('confirmed');
  });

  it('detects Puppeteer evaluation script pattern', () => {
    const stack = [
      'Error: test',
      '    at eval (__puppeteer_evaluation_script__:1:1)',
      '    at ExecutionContext._evaluateInternal (pptr:internal:1:1)',
    ].join('\n');

    const result = analyzeStackTrace(stack);
    expect(result.detected).toBe(true);
    expect(result.frameworkType).toBe('puppeteer');
    expect(result.confidence).toBe('confirmed');
  });

  it('detects Puppeteer pptr: protocol in stack', () => {
    const stack = [
      'Error: test',
      '    at pptr:evaluate:1:1',
    ].join('\n');

    const result = analyzeStackTrace(stack);
    expect(result.detected).toBe(true);
    expect(result.frameworkType).toBe('puppeteer');
    expect(result.confidence).toBe('confirmed');
  });

  it('detects generic CDP Runtime.evaluate pattern', () => {
    const stack = [
      'Error: test',
      '    at eval (eval at evaluate (:301:30), <anonymous>:1:1)',
    ].join('\n');

    const result = analyzeStackTrace(stack);
    expect(result.detected).toBe(true);
    expect(result.frameworkType).toBe('cdp-generic');
    expect(result.confidence).toBe('high');
  });

  it('returns not detected for normal browser stack trace', () => {
    const stack = [
      'Error: test',
      '    at Object.myFunction (https://example.com/script.js:10:5)',
      '    at HTMLButtonElement.onclick (https://example.com/page.html:20:3)',
    ].join('\n');

    const result = analyzeStackTrace(stack);
    expect(result.detected).toBe(false);
    expect(result.frameworkType).toBe('unknown');
  });

  it('returns not detected for extension content script stack', () => {
    const stack = [
      'Error: test',
      '    at detectWebDriverFlag (chrome-extension://abc123/content/detector.js:45:12)',
      '    at runDetectionSweep (chrome-extension://abc123/content/detector.js:60:20)',
    ].join('\n');

    const result = analyzeStackTrace(stack);
    expect(result.detected).toBe(false);
  });

  it('returns not detected for empty stack', () => {
    const result = analyzeStackTrace('');
    expect(result.detected).toBe(false);
  });

  it('detects Selenium callFunction pattern', () => {
    // Real stack from Selenium 4.41 + ChromeDriver 146 + Chrome 145
    const stack = [
      'Error: test',
      '    at eval (eval at callFunction (unknown:1:33), <anonymous>:1:15)',
      '    at callFunction (unknown:1:33)',
    ].join('\n');

    const result = analyzeStackTrace(stack);
    expect(result.detected).toBe(true);
    expect(result.frameworkType).toBe('selenium');
    expect(result.confidence).toBe('high');
    expect(result.detail).toContain('Selenium');
  });

  it('detects Selenium executeScript pattern', () => {
    const stack = [
      'Error: test',
      '    at executeScript (eval at callFunction (unknown:1:33), <anonymous>:3:10)',
    ].join('\n');

    const result = analyzeStackTrace(stack);
    expect(result.detected).toBe(true);
    expect(result.frameworkType).toBe('selenium');
  });

  it('detects multiple patterns and uses highest confidence', () => {
    const stack = [
      'Error: test',
      '    at eval (eval at evaluate (<anonymous>:301:30), <anonymous>:9:11)',
      '    at UtilityScript.evaluate (<anonymous>:303:16)',
    ].join('\n');

    const result = analyzeStackTrace(stack);
    expect(result.detected).toBe(true);
    // UtilityScript is 'confirmed', eval at evaluate is 'high'
    // Should return 'confirmed' as it's the highest
    expect(result.confidence).toBe('confirmed');
    expect(result.frameworkType).toBe('playwright');
  });
});

describe('probeStackTrace', () => {
  it('returns not detected in normal execution context', () => {
    const result = probeStackTrace();
    // In vitest, we are NOT running via CDP, so this should not detect anything
    expect(result.detected).toBe(false);
  });
});
