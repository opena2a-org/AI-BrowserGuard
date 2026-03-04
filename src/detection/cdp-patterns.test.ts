import { describe, it, expect, afterEach } from 'vitest';
import {
  detectCdpConnection,
  detectPlaywrightBindings,
  detectPuppeteerBindings,
} from './cdp-patterns';

const win = window as unknown as Record<string, unknown>;

function cleanCdpKeys(): void {
  const keys = Object.getOwnPropertyNames(window);
  for (const key of keys) {
    if (
      key.startsWith('__cdp_') ||
      key.startsWith('__chromium_') ||
      key.startsWith('__playwright') ||
      key.startsWith('__puppeteer') ||
      key.startsWith('__pw_') ||
      key.startsWith('puppeteer_')
    ) {
      delete win[key];
    }
  }
  delete win['DevToolsAPI'];
  delete win['playwright'];
  delete win['puppeteer'];
}

describe('detectCdpConnection', () => {
  afterEach(cleanCdpKeys);

  it('returns not detected when no markers are present', () => {
    cleanCdpKeys();
    const result = detectCdpConnection();
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.method).toBe('cdp-connection');
  });

  it('detects __cdp_ prefixed window properties', () => {
    win.__cdp_binding_test = 'value';
    const result = detectCdpConnection();
    expect(result.detected).toBe(true);
    expect(result.signals['__cdp_binding_test']).toBe(true);
  });

  it('detects __chromium_ prefixed window properties', () => {
    win.__chromium_debug = true;
    const result = detectCdpConnection();
    expect(result.detected).toBe(true);
    expect(result.signals['__chromium_debug']).toBe(true);
  });

  it('detects __playwright_evaluation_script__ marker', () => {
    win.__playwright_evaluation_script__ = true;
    const result = detectCdpConnection();
    expect(result.detected).toBe(true);
    expect(result.signals['__playwright_evaluation_script__']).toBe(true);
  });

  it('detects __puppeteer_evaluation_script__ marker', () => {
    win.__puppeteer_evaluation_script__ = true;
    const result = detectCdpConnection();
    expect(result.detected).toBe(true);
    expect(result.signals['__puppeteer_evaluation_script__']).toBe(true);
  });

  it('detects __playwright global', () => {
    win.__playwright = {};
    const result = detectCdpConnection();
    expect(result.detected).toBe(true);
  });

  it('detects __puppeteer global', () => {
    win.__puppeteer = {};
    const result = detectCdpConnection();
    expect(result.detected).toBe(true);
  });

  it('detects DevToolsAPI presence', () => {
    win.DevToolsAPI = {};
    const result = detectCdpConnection();
    expect(result.detected).toBe(true);
    expect(result.signals.devToolsAPI).toBe(true);
  });

  it('returns high confidence for a single marker', () => {
    win.__cdp_single = true;
    const result = detectCdpConnection();
    expect(result.confidence).toBe('high');
  });

  it('returns confirmed confidence for two or more markers', () => {
    win.__cdp_one = true;
    win.__cdp_two = true;
    const result = detectCdpConnection();
    expect(result.confidence).toBe('confirmed');
  });

  it('includes found marker names in detail string', () => {
    win.__playwright = {};
    const result = detectCdpConnection();
    expect(result.detail).toContain('__playwright');
  });

  it('includes no-detection detail when clean', () => {
    cleanCdpKeys();
    const result = detectCdpConnection();
    expect(result.detail).toContain('No CDP');
  });
});

describe('detectPlaywrightBindings', () => {
  afterEach(cleanCdpKeys);

  it('returns not detected on clean window', () => {
    cleanCdpKeys();
    const result = detectPlaywrightBindings();
    expect(result.detected).toBe(false);
    expect(result.method).toBe('framework-fingerprint');
  });

  it('detects __pw_ prefixed keys', () => {
    win.__pw_guid = 'abc123';
    const result = detectPlaywrightBindings();
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe('confirmed');
    expect(result.signals['__pw_guid']).toBe(true);
  });

  it('detects __playwright prefixed keys', () => {
    win.__playwright_clock = {};
    const result = detectPlaywrightBindings();
    expect(result.detected).toBe(true);
  });

  it('detects __playwright_evaluation_script__ specifically', () => {
    win.__playwright_evaluation_script__ = true;
    const result = detectPlaywrightBindings();
    expect(result.detected).toBe(true);
  });

  it('includes found markers in detail string', () => {
    win.__pw_test = true;
    const result = detectPlaywrightBindings();
    expect(result.detail).toContain('__pw_test');
  });
});

describe('detectPuppeteerBindings', () => {
  afterEach(cleanCdpKeys);

  it('returns not detected on clean window', () => {
    cleanCdpKeys();
    const result = detectPuppeteerBindings();
    expect(result.detected).toBe(false);
    expect(result.method).toBe('framework-fingerprint');
  });

  it('detects __puppeteer prefixed keys', () => {
    win.__puppeteer_evaluation_script__ = true;
    const result = detectPuppeteerBindings();
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe('confirmed');
  });

  it('detects puppeteer_ prefixed keys', () => {
    win.puppeteer_page = {};
    const result = detectPuppeteerBindings();
    expect(result.detected).toBe(true);
  });

  it('detects puppeteer global', () => {
    win.puppeteer = {};
    const result = detectPuppeteerBindings();
    expect(result.detected).toBe(true);
  });

  it('includes found markers in detail string', () => {
    win.__puppeteer_evaluation_script__ = true;
    const result = detectPuppeteerBindings();
    expect(result.detail).toContain('__puppeteer');
  });
});
