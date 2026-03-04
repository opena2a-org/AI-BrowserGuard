import { describe, it, expect, afterEach } from 'vitest';
import {
  detectWebDriverFlag,
  detectNavigatorAnomalies,
  detectSeleniumMarkers,
} from './webdriver';

const win = window as unknown as Record<string, unknown>;
const nav = navigator as unknown as Record<string, unknown>;

function cleanSeleniumMarkers(): void {
  const seleniumGlobals = [
    'callSelenium', '_selenium', 'callPhantom', '__nightmare', '_Selenium_IDE_Recorder',
  ];
  for (const g of seleniumGlobals) {
    delete win[g];
  }
  const windowKeys = Object.getOwnPropertyNames(window);
  for (const key of windowKeys) {
    if (key.startsWith('cdc_') || key.startsWith('$chrome_asyncScriptInfo')) {
      delete win[key];
    }
  }
}

describe('detectWebDriverFlag', () => {
  it('returns a valid WebDriverDetectionResult shape', () => {
    const result = detectWebDriverFlag();
    expect(result).toHaveProperty('detected');
    expect(result).toHaveProperty('method', 'webdriver-flag');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('detail');
    expect(result).toHaveProperty('signals');
  });

  it('includes webdriverValue and descriptor info in signals', () => {
    const result = detectWebDriverFlag();
    expect(result.signals).toHaveProperty('webdriverValue');
    expect(result.signals).toHaveProperty('hasOwnDescriptor');
  });

  it('detects when navigator.webdriver is true with high confidence', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'webdriver');
    Object.defineProperty(navigator, 'webdriver', {
      get: () => true,
      configurable: true,
    });
    const result = detectWebDriverFlag();
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.detail).toContain('true');
    // Restore
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'webdriver', originalDescriptor);
    } else {
      delete nav['webdriver'];
    }
  });

  it('returns not detected when webdriver property is absent', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'webdriver');
    delete nav['webdriver'];
    const result = detectWebDriverFlag();
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe('low');
    // Restore
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'webdriver', originalDescriptor);
    }
  });

  it('detects tampered webdriver flag (overridden to false) as medium confidence', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'webdriver');
    Object.defineProperty(navigator, 'webdriver', {
      value: false,
      configurable: true,
      writable: false,
    });
    const result = detectWebDriverFlag();
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe('medium');
    // Restore
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'webdriver', originalDescriptor);
    } else {
      delete nav['webdriver'];
    }
  });
});

describe('detectNavigatorAnomalies', () => {
  it('returns a valid WebDriverDetectionResult shape', () => {
    const result = detectNavigatorAnomalies();
    expect(result).toHaveProperty('detected');
    expect(result).toHaveProperty('method', 'automation-flag');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('detail');
    expect(result).toHaveProperty('signals');
  });

  it('records plugins length in signals', () => {
    const result = detectNavigatorAnomalies();
    expect(result.signals).toHaveProperty('pluginsLength');
  });

  it('records languages in signals', () => {
    const result = detectNavigatorAnomalies();
    expect(result.signals).toHaveProperty('languages');
  });

  it('records notification permission in signals', () => {
    const result = detectNavigatorAnomalies();
    expect(result.signals).toHaveProperty('notificationPermission');
  });

  it('detects when plugins are empty', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'plugins');
    Object.defineProperty(navigator, 'plugins', {
      get: () => ({ length: 0 }),
      configurable: true,
    });
    const result = detectNavigatorAnomalies();
    expect(result.detected).toBe(true);
    expect(result.signals.pluginsLength).toBe(0);
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'plugins', originalDescriptor);
    }
  });

  it('detects when languages are empty', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'languages');
    Object.defineProperty(navigator, 'languages', {
      get: () => [],
      configurable: true,
    });
    const result = detectNavigatorAnomalies();
    expect(result.detected).toBe(true);
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'languages', originalDescriptor);
    }
  });

  it('returns medium confidence when anomalies detected', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'plugins');
    Object.defineProperty(navigator, 'plugins', {
      get: () => ({ length: 0 }),
      configurable: true,
    });
    const result = detectNavigatorAnomalies();
    if (result.detected) {
      expect(result.confidence).toBe('medium');
    }
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'plugins', originalDescriptor);
    }
  });
});

describe('detectSeleniumMarkers', () => {
  afterEach(cleanSeleniumMarkers);

  it('returns not detected on clean window', () => {
    cleanSeleniumMarkers();
    const result = detectSeleniumMarkers();
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.method).toBe('framework-fingerprint');
  });

  it('detects callSelenium global', () => {
    win.callSelenium = () => { /* */ };
    const result = detectSeleniumMarkers();
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe('confirmed');
    expect(result.signals['callSelenium']).toBe(true);
  });

  it('detects _selenium global', () => {
    win._selenium = {};
    const result = detectSeleniumMarkers();
    expect(result.detected).toBe(true);
  });

  it('detects __nightmare global', () => {
    win.__nightmare = {};
    const result = detectSeleniumMarkers();
    expect(result.detected).toBe(true);
  });

  it('detects _Selenium_IDE_Recorder global', () => {
    win._Selenium_IDE_Recorder = {};
    const result = detectSeleniumMarkers();
    expect(result.detected).toBe(true);
  });

  it('detects callPhantom global (PhantomJS)', () => {
    win.callPhantom = () => { /* */ };
    const result = detectSeleniumMarkers();
    expect(result.detected).toBe(true);
  });

  it('detects cdc_ prefixed window keys (ChromeDriver)', () => {
    win.cdc_adoQpoasnfa76pfcZLmcfl_Array = [];
    const result = detectSeleniumMarkers();
    expect(result.detected).toBe(true);
    delete win.cdc_adoQpoasnfa76pfcZLmcfl_Array;
  });

  it('includes marker names in detail string', () => {
    win.callSelenium = () => { /* */ };
    const result = detectSeleniumMarkers();
    expect(result.detail).toContain('callSelenium');
  });

  it('returns not-detected detail when clean', () => {
    cleanSeleniumMarkers();
    const result = detectSeleniumMarkers();
    expect(result.detail).toContain('No Selenium');
  });
});
