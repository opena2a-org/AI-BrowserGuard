import { describe, it, expect } from 'vitest';
import {
  clearAutomationFlags,
  terminateCdpConnections,
  createInitialKillSwitchState,
  executeContentKillSwitch,
  registerCleanup,
} from './index';

describe('createInitialKillSwitchState', () => {
  it('returns inactive state', () => {
    const state = createInitialKillSwitchState();
    expect(state.isActive).toBe(false);
    expect(state.lastEvent).toBeNull();
    expect(state.lastActivatedAt).toBeNull();
  });
});

describe('clearAutomationFlags', () => {
  it('returns list of cleared flags (empty when none present)', () => {
    const cleared = clearAutomationFlags();
    // In test environment, no automation flags exist
    expect(Array.isArray(cleared)).toBe(true);
  });
});

describe('terminateCdpConnections', () => {
  it('returns boolean indicating success', () => {
    const result = terminateCdpConnections();
    expect(typeof result).toBe('boolean');
  });
});

describe('registerCleanup / executeContentKillSwitch', () => {
  it('executes registered cleanups', () => {
    let cleanupCalled = false;
    registerCleanup(() => { cleanupCalled = true; });
    const result = executeContentKillSwitch();
    expect(cleanupCalled).toBe(true);
    expect(result.listenersRemoved).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.bindingsCleared)).toBe(true);
  });
});

describe('alerts/notification', () => {
  it('meetsSeverityThreshold works correctly', async () => {
    const { meetsSeverityThreshold } = await import('../alerts/notification');
    expect(meetsSeverityThreshold('critical', 'low')).toBe(true);
    expect(meetsSeverityThreshold('critical', 'critical')).toBe(true);
    expect(meetsSeverityThreshold('low', 'high')).toBe(false);
    expect(meetsSeverityThreshold('medium', 'medium')).toBe(true);
    expect(meetsSeverityThreshold('low', 'medium')).toBe(false);
  });

  it('severityToPriority maps correctly', async () => {
    const { severityToPriority } = await import('../alerts/notification');
    expect(severityToPriority('critical')).toBe(2);
    expect(severityToPriority('high')).toBe(1);
    expect(severityToPriority('medium')).toBe(0);
    expect(severityToPriority('low')).toBe(0);
  });
});
