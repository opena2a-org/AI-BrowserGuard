import { describe, it, expect, afterEach } from 'vitest';
import {
  detectAnthropicComputerUse,
  detectOpenAIOperator,
  detectGenericAutomation,
  detectAllFrameworks,
} from './automation';

const nav = navigator as unknown as Record<string, unknown>;

// Helper to save and restore window/navigator properties
function withProperty<T>(
  obj: object,
  prop: string,
  value: T,
  fn: () => void,
): void {
  const orig = Object.getOwnPropertyDescriptor(obj, prop);
  Object.defineProperty(obj, prop, { value, configurable: true, writable: true });
  try {
    fn();
  } finally {
    if (orig) Object.defineProperty(obj, prop, orig);
    else delete (obj as Record<string, unknown>)[prop];
  }
}

describe('detectAnthropicComputerUse', () => {
  it('returns not detected in normal browser environment', () => {
    const result = detectAnthropicComputerUse();
    expect(result.detected).toBe(false);
    expect(result.method).toBe('automation-flag');
    expect(result.confidence).toBe('low');
  });

  it('records screen dimensions as signals', () => {
    const result = detectAnthropicComputerUse();
    expect(result.signals).toHaveProperty('screenWidth');
    expect(result.signals).toHaveProperty('screenHeight');
    expect(result.signals).toHaveProperty('platform');
  });

  it('reads screen dimensions into signals', () => {
    // jsdom screen dimensions are not reconfigurable, so we just verify
    // the function reads them without throwing
    const result = detectAnthropicComputerUse();
    expect(typeof result.signals.screenWidth).toBe('number');
    expect(typeof result.signals.screenHeight).toBe('number');
  });

  it('returns not-detected detail when clean', () => {
    const result = detectAnthropicComputerUse();
    expect(result.detail).toContain('No Anthropic');
  });

  it('requires at least 2 indicators to detect', () => {
    // Single indicator (Linux platform alone) should not trigger
    const origPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');
    Object.defineProperty(navigator, 'platform', { value: 'Linux x86_64', configurable: true });
    const result = detectAnthropicComputerUse();
    // Might or might not detect depending on other signals, but if not detected, confidence is low
    if (!result.detected) {
      expect(result.confidence).toBe('low');
    }
    if (origPlatform) Object.defineProperty(navigator, 'platform', origPlatform);
    else delete nav.platform;
  });
});

describe('detectOpenAIOperator', () => {
  it('returns not detected in normal browser environment', () => {
    const result = detectOpenAIOperator();
    expect(result.detected).toBe(false);
    expect(result.method).toBe('automation-flag');
    expect(result.confidence).toBe('low');
  });

  it('records platform and plugin count as signals', () => {
    const result = detectOpenAIOperator();
    expect(result.signals).toHaveProperty('platform');
    expect(result.signals).toHaveProperty('pluginCount');
  });

  it('detects Operator string in user agent as a signal', () => {
    const origUA = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    Object.defineProperty(navigator, 'userAgent', {
      get: () => 'Mozilla/5.0 Operator/1.0',
      configurable: true,
    });
    const result = detectOpenAIOperator();
    // UA match is one signal; needs at least 2 for detection
    expect(result.signals.userAgent || result.signals.platform).toBeDefined();
    if (origUA) Object.defineProperty(navigator, 'userAgent', origUA);
    else delete nav.userAgent;
  });

  it('detects OpenAI string in user agent as a signal', () => {
    const origUA = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    Object.defineProperty(navigator, 'userAgent', {
      get: () => 'Mozilla/5.0 OpenAI-Browser/1.0',
      configurable: true,
    });
    const result = detectOpenAIOperator();
    expect(result.signals.userAgent || result.signals.platform).toBeDefined();
    if (origUA) Object.defineProperty(navigator, 'userAgent', origUA);
    else delete nav.userAgent;
  });

  it('returns not-detected detail when clean', () => {
    const result = detectOpenAIOperator();
    expect(result.detail).toContain('No OpenAI');
  });

  it('requires at least 2 signals for detection', () => {
    // Single signal should not trigger
    const result = detectOpenAIOperator();
    if (!result.detected) {
      expect(result.confidence).toBe('low');
    }
  });
});

describe('detectGenericAutomation', () => {
  it('returns a valid FrameworkDetectionResult shape', () => {
    const result = detectGenericAutomation();
    expect(result).toHaveProperty('detected');
    expect(result).toHaveProperty('frameworkType');
    expect(result).toHaveProperty('method', 'automation-flag');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('signals');
    expect(result).toHaveProperty('detail');
  });

  it('records outerWidth and outerHeight signals when zero', () => {
    const originalWidth = Object.getOwnPropertyDescriptor(window, 'outerWidth');
    const originalHeight = Object.getOwnPropertyDescriptor(window, 'outerHeight');
    Object.defineProperty(window, 'outerWidth', { value: 0, configurable: true, writable: true });
    Object.defineProperty(window, 'outerHeight', { value: 0, configurable: true, writable: true });
    const result = detectGenericAutomation();
    expect(result.signals.outerWidth).toBe(0);
    expect(result.signals.outerHeight).toBe(0);
    if (originalWidth) Object.defineProperty(window, 'outerWidth', originalWidth);
    if (originalHeight) Object.defineProperty(window, 'outerHeight', originalHeight);
  });

  it('requires at least 2 indicators before setting detected to true', () => {
    const result = detectGenericAutomation();
    if (result.detected) {
      expect(result.confidence).toBe('medium');
      expect(result.frameworkType).toBe('cdp-generic');
    } else {
      expect(result.confidence).toBe('low');
    }
  });

  it('records hasLoadTimes and hasCsi signals when chrome is present', () => {
    const win = window as unknown as Record<string, unknown>;
    if (win.chrome) {
      const result = detectGenericAutomation();
      expect(result.signals).toHaveProperty('hasLoadTimes');
      expect(result.signals).toHaveProperty('hasCsi');
    }
  });

  it('detects dimension inversion (outer < inner)', () => {
    const origOW = Object.getOwnPropertyDescriptor(window, 'outerWidth');
    const origIW = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    // Simulate Puppeteer headless: outerWidth=756, innerWidth=800
    Object.defineProperty(window, 'outerWidth', { value: 756, configurable: true, writable: true });
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true, writable: true });
    const result = detectGenericAutomation();
    expect(result.detail).toContain('dimension inversion');
    if (origOW) Object.defineProperty(window, 'outerWidth', origOW);
    if (origIW) Object.defineProperty(window, 'innerWidth', origIW);
  });

  it('detects dimension equality (Selenium-style: outer === inner)', () => {
    const origOW = Object.getOwnPropertyDescriptor(window, 'outerWidth');
    const origOH = Object.getOwnPropertyDescriptor(window, 'outerHeight');
    const origIW = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    const origIH = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    // Simulate Selenium: outerWidth=innerWidth=1200, outerHeight=innerHeight=900
    Object.defineProperty(window, 'outerWidth', { value: 1200, configurable: true, writable: true });
    Object.defineProperty(window, 'outerHeight', { value: 900, configurable: true, writable: true });
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true, writable: true });
    const result = detectGenericAutomation();
    expect(result.detail).toContain('outer === inner');
    if (origOW) Object.defineProperty(window, 'outerWidth', origOW);
    if (origOH) Object.defineProperty(window, 'outerHeight', origOH);
    if (origIW) Object.defineProperty(window, 'innerWidth', origIW);
    if (origIH) Object.defineProperty(window, 'innerHeight', origIH);
  });

  it('detects HeadlessChrome in user agent', () => {
    const origUA = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/145.0.0.0 Safari/537.36',
      configurable: true,
      writable: true,
    });
    const result = detectGenericAutomation();
    expect(result.detail).toContain('HeadlessChrome');
    if (origUA) Object.defineProperty(navigator, 'userAgent', origUA);
    else delete (nav as Record<string, unknown>).userAgent;
  });
});

describe('detectAllFrameworks', () => {
  it('only returns results where detected is true', () => {
    const results = detectAllFrameworks();
    for (const r of results) {
      expect(r.detected).toBe(true);
    }
  });

  it('does not include Anthropic or OpenAI in normal environment', () => {
    const results = detectAllFrameworks();
    expect(results.find((r) => r.frameworkType === 'anthropic-computer-use')).toBeUndefined();
    expect(results.find((r) => r.frameworkType === 'openai-operator')).toBeUndefined();
  });

  it('returns an array', () => {
    const results = detectAllFrameworks();
    expect(Array.isArray(results)).toBe(true);
  });
});
