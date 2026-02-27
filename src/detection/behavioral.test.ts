import { describe, it, expect } from 'vitest';
import {
  analyzeMouseBehavior,
  analyzeKeyboardBehavior,
  analyzeClickPrecision,
  aggregateBehavioralAnalysis,
} from './behavioral';

function makeMouseEvents(count: number, opts?: { synthetic?: boolean; integerOnly?: boolean; uniformTiming?: boolean }) {
  const events = [];
  for (let i = 0; i < count; i++) {
    events.push({
      type: i % 5 === 4 ? 'click' : 'mousemove',
      clientX: opts?.integerOnly ? 100 + i : 100.5 + i * 1.3,
      clientY: opts?.integerOnly ? 200 + i : 200.7 + i * 0.8,
      timestamp: opts?.uniformTiming ? i * 50 : i * 50 + Math.random() * 40,
      isTrusted: !opts?.synthetic,
    });
  }
  return events;
}

function makeKeyEvents(count: number, opts?: { synthetic?: boolean; uniformTiming?: boolean }) {
  const events = [];
  const keys = 'abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < count; i++) {
    events.push({
      type: i % 2 === 0 ? 'keydown' : 'keyup',
      key: keys[i % keys.length],
      timestamp: opts?.uniformTiming ? i * 50 : i * 50 + Math.random() * 30,
      isTrusted: !opts?.synthetic,
    });
  }
  return events;
}

describe('analyzeMouseBehavior', () => {
  it('returns not detected for insufficient events', () => {
    const events = makeMouseEvents(5);
    const result = analyzeMouseBehavior(events);
    expect(result.detected).toBe(false);
    expect(result.detail).toContain('Insufficient');
  });

  it('detects automation with synthetic events', () => {
    const events = makeMouseEvents(30, { synthetic: true });
    const result = analyzeMouseBehavior(events);
    expect(result.detected).toBe(true);
    expect(result.metrics.syntheticEventRatio).toBeGreaterThan(0.5);
  });

  it('detects automation with integer-only coordinates', () => {
    const events = makeMouseEvents(30, { integerOnly: true });
    const result = analyzeMouseBehavior(events);
    expect(result.metrics.integerCoordinateRatio).toBe(1);
  });

  it('reports human-like behavior for natural events', () => {
    const events = makeMouseEvents(30);
    const result = analyzeMouseBehavior(events);
    // Natural events have sub-pixel coordinates and variable timing
    expect(result.metrics.syntheticEventRatio).toBe(0);
  });
});

describe('analyzeKeyboardBehavior', () => {
  it('returns not detected for insufficient events', () => {
    const events = makeKeyEvents(5);
    const result = analyzeKeyboardBehavior(events);
    expect(result.detected).toBe(false);
  });

  it('detects synthetic keyboard events', () => {
    const events = makeKeyEvents(30, { synthetic: true });
    const result = analyzeKeyboardBehavior(events);
    expect(result.detected).toBe(true);
  });

  it('reports human-like typing for trusted events', () => {
    const events = makeKeyEvents(30);
    const result = analyzeKeyboardBehavior(events);
    expect(result.metrics.syntheticEventRatio).toBe(0);
  });
});

describe('analyzeClickPrecision', () => {
  it('returns not detected for too few clicks', () => {
    const clicks = [
      { clientX: 100, clientY: 100, targetRect: { x: 90, y: 90, width: 20, height: 20 }, timestamp: 0 },
    ];
    const result = analyzeClickPrecision(clicks);
    expect(result.detected).toBe(false);
  });

  it('detects automation with perfect centering', () => {
    const clicks = [];
    for (let i = 0; i < 10; i++) {
      clicks.push({
        clientX: 100, // exact center
        clientY: 100, // exact center
        targetRect: { x: 90, y: 90, width: 20, height: 20 },
        timestamp: i * 100,
      });
    }
    const result = analyzeClickPrecision(clicks);
    expect(result.detected).toBe(true);
    expect(result.detail).toContain('uniform');
  });

  it('reports human-like for varied click positions', () => {
    const clicks = [];
    for (let i = 0; i < 10; i++) {
      clicks.push({
        clientX: 100 + (Math.random() - 0.5) * 10,
        clientY: 100 + (Math.random() - 0.5) * 10,
        targetRect: { x: 90, y: 90, width: 20, height: 20 },
        timestamp: i * 100,
      });
    }
    const result = analyzeClickPrecision(clicks);
    expect(result.detected).toBe(false);
  });
});

describe('aggregateBehavioralAnalysis', () => {
  it('returns not detected with no data', () => {
    const result = aggregateBehavioralAnalysis(null, null, null);
    expect(result.detected).toBe(false);
  });

  it('upgrades confidence when multiple signals detect', () => {
    const mouse = analyzeMouseBehavior(makeMouseEvents(30, { synthetic: true }));
    const keyboard = analyzeKeyboardBehavior(makeKeyEvents(30, { synthetic: true }));
    const result = aggregateBehavioralAnalysis(mouse, keyboard, null);
    if (mouse.detected && keyboard.detected) {
      expect(['high', 'confirmed']).toContain(result.confidence);
    }
  });

  it('uses individual confidence for single signal', () => {
    const mouse = analyzeMouseBehavior(makeMouseEvents(30, { synthetic: true }));
    const result = aggregateBehavioralAnalysis(mouse, null, null);
    expect(result.detected).toBe(mouse.detected);
  });
});
