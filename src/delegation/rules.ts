/**
 * Delegation rule engine.
 *
 * Evaluates delegation rules to determine what actions an agent is
 * permitted to perform. Supports site patterns, action restrictions,
 * and time bounds.
 */

import type {
  DelegationRule,
  DelegationPreset,
  DelegationScope,
  DelegationToken,
  SitePattern,
  ActionRestriction,
  TimeBound,
} from '../types/delegation';
import type { AgentCapability } from '../types/agent';

/**
 * Create a delegation rule from a preset.
 *
 * Preset definitions:
 *
 * readOnly:
 *   - Allowed actions: navigate, read-dom
 *   - Blocked actions: all others
 *   - Site patterns: all allowed (no restrictions)
 *   - Time bound: none (persistent until manually revoked)
 *
 * limited:
 *   - Allowed actions: navigate, read-dom, click, type-text
 *   - Blocked actions: submit-form, download-file, open-tab, close-tab, execute-script, modify-dom
 *   - Site patterns: user-specified allowlist (must be provided)
 *   - Time bound: user-specified (15min, 1hr, or 4hr)
 *
 * fullAccess:
 *   - Allowed actions: all
 *   - Blocked actions: none
 *   - Site patterns: all allowed
 *   - Time bound: none
 *   - Note: all actions are still logged and boundary alerts still fire
 *
 * @param preset - The preset to create a rule from.
 * @param options - Additional configuration for the rule.
 * @returns A fully populated DelegationRule.
 *
 * TODO: Generate UUID for rule ID.
 * Build DelegationScope based on preset.
 * If preset is "limited", require sitePatterns and timeBound in options.
 * Set createdAt to current ISO 8601 timestamp.
 * Set isActive to true.
 */
export function createRuleFromPreset(
  preset: DelegationPreset,
  options?: {
    sitePatterns?: SitePattern[];
    durationMinutes?: number;
    label?: string;
  }
): DelegationRule {
  // TODO: Build delegation rule based on preset + options.
  throw new Error('Not implemented');
}

/**
 * Evaluate whether an action is allowed under a delegation rule.
 *
 * Evaluation logic:
 * 1. Check if rule is active. If not, deny.
 * 2. Check time bound. If expired, deny and mark rule as inactive.
 * 3. Check URL against site patterns (first match wins, blocklist takes priority).
 * 4. Check action capability against action restrictions.
 * 5. If all checks pass, allow.
 *
 * @param rule - The delegation rule to evaluate.
 * @param action - The action being attempted.
 * @param url - The URL where the action is being attempted.
 * @returns Whether the action is allowed and the reason.
 *
 * TODO: Implement the evaluation chain described above.
 * Return both the boolean result and a human-readable reason.
 */
export function evaluateRule(
  rule: DelegationRule,
  action: AgentCapability,
  url: string
): { allowed: boolean; reason: string } {
  // TODO: Evaluate rule against action and URL.
  throw new Error('Not implemented');
}

/**
 * Check if a URL matches any site pattern in the scope.
 *
 * Pattern matching rules:
 * - Patterns are evaluated in order; first match wins.
 * - If a "block" pattern matches first, the URL is blocked.
 * - If an "allow" pattern matches first, the URL is allowed.
 * - If no pattern matches, the default depends on the preset:
 *   - readOnly/fullAccess: default allow (no restrictions).
 *   - limited: default block (allowlist-based).
 *
 * @param url - The URL to check.
 * @param patterns - The site patterns to evaluate.
 * @param defaultAction - What to do if no pattern matches.
 * @returns Whether the URL is allowed and which pattern matched.
 */
export function evaluateSitePatterns(
  url: string,
  patterns: SitePattern[],
  defaultAction: 'allow' | 'block'
): { allowed: boolean; matchedPattern: SitePattern | null } {
  // TODO: Iterate patterns, match URL, return first match.
  throw new Error('Not implemented');
}

/**
 * Check if an action is allowed by the action restriction list.
 *
 * @param action - The capability to check.
 * @param restrictions - The action restriction list from the delegation scope.
 * @returns Whether the action is allowed.
 */
export function evaluateActionRestrictions(
  action: AgentCapability,
  restrictions: ActionRestriction[]
): { allowed: boolean; matchedRestriction: ActionRestriction | null } {
  // TODO: Find the restriction matching the action, return its allow/block status.
  throw new Error('Not implemented');
}

/**
 * Check if a time bound has expired.
 *
 * @param timeBound - The time bound to check, or null for no limit.
 * @returns Whether the time bound has expired.
 */
export function isTimeBoundExpired(timeBound: TimeBound | null): boolean {
  // TODO: If null, return false (no expiry). Otherwise compare expiresAt to now.
  throw new Error('Not implemented');
}

/**
 * Issue a delegation token for an agent session.
 *
 * Tokens encode the delegation scope and can be revoked independently.
 * In the free tier, tokens are local-only (not cryptographically signed).
 *
 * @param ruleId - The delegation rule this token is issued under.
 * @param agentId - The agent this token is issued to.
 * @param scope - The delegation scope.
 * @param expiresAt - When the token expires (ISO 8601).
 * @returns A new delegation token.
 *
 * TODO: Generate UUID for tokenId.
 * Set issuedAt to current time.
 * Copy scope from rule.
 * Leave signature and issuer undefined (free tier).
 */
export function issueToken(
  ruleId: string,
  agentId: string,
  scope: DelegationScope,
  expiresAt: string
): DelegationToken {
  // TODO: Create and return a delegation token.
  throw new Error('Not implemented');
}

/**
 * Revoke a delegation token.
 *
 * @param token - The token to revoke.
 * @returns The revoked token with revoked=true.
 */
export function revokeToken(token: DelegationToken): DelegationToken {
  // TODO: Set token.revoked = true and return.
  throw new Error('Not implemented');
}
