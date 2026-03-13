import { describe, it, expect, afterEach } from 'vitest';
import {
  detectAnthropicComputerUse,
  detectOpenAIOperator,
  detectGenericAutomation,
  detectAllFrameworks,
} from './automation';

const win = window as unknown as Record<string, unknown>;
const nav = navigator as unknown as Record<string, unknown>;

function cleanFrameworkGlobals(): void {
  const toDelete = [
    '__anthropic_computer_use__',
    '__computer_use__',
    '__anthropic_tool__',
    '__openai_operator__',
    '__operator_runtime__',
    '__openai_browser_tool__',
  ];
  for (const key of toDelete) {
    delete win[key];
  }
}

describe('detectAnthropicComputerUse', () => {
  afterEach(cleanFrameworkGlobals);

  it('returns not detected on clean window', () => {
    cleanFrameworkGlobals();
    const result = detectAnthropicComputerUse();
    expect(result.detected).toBe(false);
    expect(result.frameworkType).toBe('anthropic-computer-use');
    expect(result.method).toBe('framework-fingerprint');
    expect(result.confidence).toBe('low');
  });

  it('detects __anthropic_computer_use__ global', () => {
    win.__anthropic_computer_use__ = { version: '1.0' };
    const result = detectAnthropicComputerUse();
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.signals['__anthropic_computer_use__']).toBe(true);
  });

  it('detects __computer_use__ global', () => {
    win.__computer_use__ = true;
    const result = detectAnthropicComputerUse();
    expect(result.detected).toBe(true);
  });

  it('detects __anthropic_tool__ global', () => {
    win.__anthropic_tool__ = {};
    const result = detectAnthropicComputerUse();
    expect(result.detected).toBe(true);
  });

  it('returns framework type and method', () => {
    win.__anthropic_computer_use__ = true;
    const result = detectAnthropicComputerUse();
    expect(result.frameworkType).toBe('anthropic-computer-use');
    expect(result.method).toBe('framework-fingerprint');
  });

  it('includes found marker in detail string', () => {
    win.__anthropic_computer_use__ = true;
    const result = detectAnthropicComputerUse();
    expect(result.detail).toContain('__anthropic_computer_use__');
  });

  it('returns not-detected detail when clean', () => {
    cleanFrameworkGlobals();
    const result = detectAnthropicComputerUse();
    expect(result.detail).toContain('No Anthropic');
  });
});

describe('detectOpenAIOperator', () => {
  afterEach(cleanFrameworkGlobals);

  it('returns not detected on clean window', () => {
    cleanFrameworkGlobals();
    const result = detectOpenAIOperator();
    expect(result.detected).toBe(false);
    expect(result.frameworkType).toBe('openai-operator');
    expect(result.method).toBe('framework-fingerprint');
  });

  it('detects __openai_operator__ global', () => {
    win.__openai_operator__ = true;
    const result = detectOpenAIOperator();
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.signals['__openai_operator__']).toBe(true);
  });

  it('detects __operator_runtime__ global', () => {
    win.__operator_runtime__ = {};
    const result = detectOpenAIOperator();
    expect(result.detected).toBe(true);
  });

  it('detects __openai_browser_tool__ global', () => {
    win.__openai_browser_tool__ = {};
    const result = detectOpenAIOperator();
    expect(result.detected).toBe(true);
  });

  it('detects Operator string in user agent', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    Object.defineProperty(navigator, 'userAgent', {
      get: () => 'Mozilla/5.0 Operator/1.0',
      configurable: true,
    });
    const result = detectOpenAIOperator();
    expect(result.detected).toBe(true);
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'userAgent', originalDescriptor);
    } else {
      delete nav['userAgent'];
    }
  });

  it('detects OpenAI string in user agent', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    Object.defineProperty(navigator, 'userAgent', {
      get: () => 'Mozilla/5.0 OpenAI-Browser/1.0',
      configurable: true,
    });
    const result = detectOpenAIOperator();
    expect(result.detected).toBe(true);
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'userAgent', originalDescriptor);
    } else {
      delete nav['userAgent'];
    }
  });

  it('returns not-detected detail when clean', () => {
    cleanFrameworkGlobals();
    const result = detectOpenAIOperator();
    expect(result.detail).toContain('No OpenAI');
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
  afterEach(cleanFrameworkGlobals);

  it('only returns results where detected is true', () => {
    cleanFrameworkGlobals();
    const results = detectAllFrameworks();
    for (const r of results) {
      expect(r.detected).toBe(true);
    }
  });

  it('includes Anthropic Computer Use when global is set', () => {
    win.__anthropic_computer_use__ = true;
    const results = detectAllFrameworks();
    const anthropic = results.find((r) => r.frameworkType === 'anthropic-computer-use');
    expect(anthropic).toBeDefined();
    expect(anthropic?.detected).toBe(true);
  });

  it('includes OpenAI Operator when global is set', () => {
    win.__openai_operator__ = true;
    const results = detectAllFrameworks();
    const operator = results.find((r) => r.frameworkType === 'openai-operator');
    expect(operator).toBeDefined();
    expect(operator?.detected).toBe(true);
  });

  it('does not include Anthropic or OpenAI when not set', () => {
    cleanFrameworkGlobals();
    const results = detectAllFrameworks();
    expect(results.find((r) => r.frameworkType === 'anthropic-computer-use')).toBeUndefined();
    expect(results.find((r) => r.frameworkType === 'openai-operator')).toBeUndefined();
  });

  it('returns an array', () => {
    const results = detectAllFrameworks();
    expect(Array.isArray(results)).toBe(true);
  });
});
