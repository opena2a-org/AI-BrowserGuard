import { describe, it, expect } from 'vitest';
import {
  createInitialWizardState,
  selectPreset,
  addSitePattern,
  removeSitePattern,
  setDuration,
  nextStep,
  previousStep,
  finalizeWizard,
} from './wizard';

describe('createInitialWizardState', () => {
  it('starts at preset step with empty state', () => {
    const state = createInitialWizardState();
    expect(state.currentStep).toBe('preset');
    expect(state.selectedPreset).toBeNull();
    expect(state.sitePatterns).toEqual([]);
    expect(state.durationMinutes).toBeNull();
    expect(state.errors).toEqual([]);
  });
});

describe('selectPreset', () => {
  it('readOnly goes directly to confirm', () => {
    const state = selectPreset(createInitialWizardState(), 'readOnly');
    expect(state.selectedPreset).toBe('readOnly');
    expect(state.currentStep).toBe('confirm');
  });

  it('limited goes to sites step', () => {
    const state = selectPreset(createInitialWizardState(), 'limited');
    expect(state.selectedPreset).toBe('limited');
    expect(state.currentStep).toBe('sites');
  });

  it('fullAccess goes directly to confirm', () => {
    const state = selectPreset(createInitialWizardState(), 'fullAccess');
    expect(state.selectedPreset).toBe('fullAccess');
    expect(state.currentStep).toBe('confirm');
  });
});

describe('addSitePattern', () => {
  it('adds a valid pattern', () => {
    let state = selectPreset(createInitialWizardState(), 'limited');
    state = addSitePattern(state, { pattern: '*.example.com', action: 'allow' });
    expect(state.sitePatterns).toHaveLength(1);
    expect(state.errors).toEqual([]);
  });

  it('rejects empty patterns', () => {
    let state = selectPreset(createInitialWizardState(), 'limited');
    state = addSitePattern(state, { pattern: '  ', action: 'allow' });
    expect(state.sitePatterns).toHaveLength(0);
    expect(state.errors.length).toBeGreaterThan(0);
  });

  it('rejects duplicate patterns', () => {
    let state = selectPreset(createInitialWizardState(), 'limited');
    state = addSitePattern(state, { pattern: '*.example.com', action: 'allow' });
    state = addSitePattern(state, { pattern: '*.example.com', action: 'allow' });
    expect(state.sitePatterns).toHaveLength(1);
    expect(state.errors[0]).toContain('already exists');
  });
});

describe('removeSitePattern', () => {
  it('removes pattern by index', () => {
    let state = selectPreset(createInitialWizardState(), 'limited');
    state = addSitePattern(state, { pattern: '*.a.com', action: 'allow' });
    state = addSitePattern(state, { pattern: '*.b.com', action: 'allow' });
    state = removeSitePattern(state, 0);
    expect(state.sitePatterns).toHaveLength(1);
    expect(state.sitePatterns[0].pattern).toBe('*.b.com');
  });
});

describe('setDuration', () => {
  it('accepts valid durations', () => {
    let state = createInitialWizardState();
    state = setDuration(state, 15);
    expect(state.durationMinutes).toBe(15);
    expect(state.errors).toEqual([]);
  });

  it('rejects invalid durations', () => {
    let state = createInitialWizardState();
    state = setDuration(state, 30); // not a valid option
    expect(state.errors.length).toBeGreaterThan(0);
  });
});

describe('nextStep', () => {
  it('errors when no preset selected', () => {
    const state = nextStep(createInitialWizardState());
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.currentStep).toBe('preset');
  });

  it('errors when sites step has no patterns', () => {
    let state = selectPreset(createInitialWizardState(), 'limited');
    state = nextStep(state);
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.currentStep).toBe('sites');
  });

  it('advances from sites to time when patterns exist', () => {
    let state = selectPreset(createInitialWizardState(), 'limited');
    state = addSitePattern(state, { pattern: '*.example.com', action: 'allow' });
    state = nextStep(state);
    expect(state.currentStep).toBe('time');
    expect(state.errors).toEqual([]);
  });

  it('errors when time step has no duration', () => {
    let state = selectPreset(createInitialWizardState(), 'limited');
    state = addSitePattern(state, { pattern: '*.example.com', action: 'allow' });
    state = nextStep(state); // sites -> time
    state = nextStep(state); // time -> should error
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.currentStep).toBe('time');
  });
});

describe('previousStep', () => {
  it('goes from confirm to preset for readOnly', () => {
    let state = selectPreset(createInitialWizardState(), 'readOnly');
    state = previousStep(state);
    expect(state.currentStep).toBe('preset');
  });

  it('goes from sites to preset for limited', () => {
    let state = selectPreset(createInitialWizardState(), 'limited');
    expect(state.currentStep).toBe('sites');
    state = previousStep(state);
    // sites -> preset (index 0, so just stays at preset since no step before)
    expect(state.currentStep).toBe('preset');
  });

  it('preserves entered data when going back', () => {
    let state = selectPreset(createInitialWizardState(), 'limited');
    state = addSitePattern(state, { pattern: '*.example.com', action: 'allow' });
    state = nextStep(state); // sites -> time
    state = previousStep(state); // time -> sites
    expect(state.sitePatterns).toHaveLength(1);
  });
});

describe('finalizeWizard', () => {
  it('creates a rule for readOnly preset', () => {
    const state = selectPreset(createInitialWizardState(), 'readOnly');
    const rule = finalizeWizard(state);
    expect(rule).not.toBeNull();
    expect(rule!.preset).toBe('readOnly');
    expect(rule!.isActive).toBe(true);
  });

  it('creates a rule for limited preset with all config', () => {
    let state = selectPreset(createInitialWizardState(), 'limited');
    state = addSitePattern(state, { pattern: '*.example.com', action: 'allow' });
    state = setDuration(state, 60);
    const rule = finalizeWizard(state);
    expect(rule).not.toBeNull();
    expect(rule!.preset).toBe('limited');
    expect(rule!.scope.sitePatterns).toHaveLength(1);
    expect(rule!.scope.timeBound!.durationMinutes).toBe(60);
  });

  it('returns null when limited preset has no patterns', () => {
    const state = selectPreset(createInitialWizardState(), 'limited');
    const rule = finalizeWizard(state);
    expect(rule).toBeNull();
  });

  it('returns null when no preset selected', () => {
    const rule = finalizeWizard(createInitialWizardState());
    expect(rule).toBeNull();
  });
});
