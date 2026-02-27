/**
 * Delegation wizard UI logic.
 *
 * Manages the 3-preset delegation wizard that appears in the popup.
 * Users select a preset, optionally configure site patterns and time
 * bounds, then activate the delegation.
 */

import type { DelegationPreset, DelegationRule, SitePattern, TimeBound } from '../types/delegation';

/**
 * Wizard step in the delegation flow.
 * The wizard progresses linearly: preset -> sites -> time -> confirm.
 */
export type WizardStep = 'preset' | 'sites' | 'time' | 'confirm';

/**
 * State of the delegation wizard.
 */
export interface WizardState {
  /** Current step in the wizard. */
  currentStep: WizardStep;

  /** Selected preset (set in step 1). */
  selectedPreset: DelegationPreset | null;

  /** Site patterns configured by the user (step 2, limited preset only). */
  sitePatterns: SitePattern[];

  /** Selected time duration in minutes (step 3, limited preset only). */
  durationMinutes: number | null;

  /** Optional label for the delegation rule. */
  label: string;

  /** Validation errors for the current step. */
  errors: string[];
}

/**
 * Available time duration options for the limited preset.
 */
export const TIME_DURATION_OPTIONS = [
  { label: '15 minutes', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '4 hours', minutes: 240 },
] as const;

/**
 * Create the initial wizard state.
 *
 * @returns A fresh wizard state at the preset selection step.
 */
export function createInitialWizardState(): WizardState {
  return {
    currentStep: 'preset',
    selectedPreset: null,
    sitePatterns: [],
    durationMinutes: null,
    label: '',
    errors: [],
  };
}

/**
 * Select a delegation preset and determine the next step.
 *
 * - readOnly: Skip to confirm (no additional configuration needed).
 * - limited: Go to sites step.
 * - fullAccess: Skip to confirm.
 *
 * @param state - Current wizard state.
 * @param preset - The selected preset.
 * @returns Updated wizard state with the next step.
 *
 * TODO: Set selectedPreset.
 * Determine next step based on preset.
 * Clear any previous errors.
 */
export function selectPreset(state: WizardState, preset: DelegationPreset): WizardState {
  // TODO: Update state with selected preset and determine next step.
  throw new Error('Not implemented');
}

/**
 * Add a site pattern to the wizard configuration.
 *
 * @param state - Current wizard state.
 * @param pattern - The site pattern to add.
 * @returns Updated wizard state with the new pattern.
 *
 * TODO: Validate the pattern is a valid glob.
 * Check for duplicate patterns.
 * Add to sitePatterns array.
 */
export function addSitePattern(state: WizardState, pattern: SitePattern): WizardState {
  // TODO: Validate and add site pattern.
  throw new Error('Not implemented');
}

/**
 * Remove a site pattern from the wizard configuration.
 *
 * @param state - Current wizard state.
 * @param index - Index of the pattern to remove.
 * @returns Updated wizard state without the removed pattern.
 */
export function removeSitePattern(state: WizardState, index: number): WizardState {
  // TODO: Remove pattern at index and return updated state.
  throw new Error('Not implemented');
}

/**
 * Set the time duration for the limited preset.
 *
 * @param state - Current wizard state.
 * @param minutes - Duration in minutes (15, 60, or 240).
 * @returns Updated wizard state.
 */
export function setDuration(state: WizardState, minutes: number): WizardState {
  // TODO: Validate minutes is one of the allowed options, set durationMinutes.
  throw new Error('Not implemented');
}

/**
 * Advance to the next wizard step.
 *
 * @param state - Current wizard state.
 * @returns Updated wizard state at the next step.
 *
 * TODO: Validate current step inputs before advancing.
 * For sites step: require at least one pattern for limited preset.
 * For time step: require a duration selection for limited preset.
 * Set errors if validation fails.
 */
export function nextStep(state: WizardState): WizardState {
  // TODO: Validate current step and advance if valid.
  throw new Error('Not implemented');
}

/**
 * Go back to the previous wizard step.
 *
 * @param state - Current wizard state.
 * @returns Updated wizard state at the previous step.
 */
export function previousStep(state: WizardState): WizardState {
  // TODO: Navigate back to the previous step, preserving entered data.
  throw new Error('Not implemented');
}

/**
 * Finalize the wizard and create a delegation rule.
 *
 * @param state - The completed wizard state.
 * @returns The delegation rule created from the wizard inputs, or null if invalid.
 *
 * TODO: Validate all wizard state is complete.
 * Call createRuleFromPreset from rules.ts with the wizard configuration.
 * Return the created rule.
 */
export function finalizeWizard(state: WizardState): DelegationRule | null {
  // TODO: Validate state and create delegation rule.
  throw new Error('Not implemented');
}

/**
 * Render the wizard UI into a container element.
 *
 * This is a vanilla DOM rendering function (no framework).
 * It creates the appropriate form elements for the current step.
 *
 * @param container - The DOM element to render into.
 * @param state - The current wizard state.
 * @param onStateChange - Callback when the state changes.
 *
 * TODO: Clear container.
 * Based on state.currentStep, render the appropriate UI:
 * - preset: 3 cards for readOnly/limited/fullAccess with descriptions.
 * - sites: Input field + pattern list + add/remove buttons.
 * - time: 3 duration option buttons.
 * - confirm: Summary of selected configuration + activate button.
 * Wire up event listeners to call state mutation functions.
 * Call onStateChange with updated state after each user action.
 */
export function renderWizard(
  container: HTMLElement,
  state: WizardState,
  onStateChange: (newState: WizardState) => void
): void {
  // TODO: Render wizard UI based on current step.
}
