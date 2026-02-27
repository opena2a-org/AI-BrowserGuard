import { describe, it, expect } from 'vitest';
import { checkBoundary, matchSitePattern, isDelegationExpired } from './monitor';
import { createRuleFromPreset } from '../delegation/rules';

describe('checkBoundary', () => {
  it('blocks when no rule is active (fail-closed)', () => {
    const result = checkBoundary('click', 'https://example.com', null);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('No active delegation');
  });

  it('blocks when rule is inactive', () => {
    const rule = createRuleFromPreset('fullAccess');
    rule.isActive = false;
    const result = checkBoundary('click', 'https://example.com', rule);
    expect(result.allowed).toBe(false);
  });

  it('allows permitted actions under active rule', () => {
    const rule = createRuleFromPreset('fullAccess');
    const result = checkBoundary('click', 'https://example.com', rule);
    expect(result.allowed).toBe(true);
  });

  it('blocks disallowed actions under readOnly', () => {
    const rule = createRuleFromPreset('readOnly');
    const result = checkBoundary('submit-form', 'https://example.com', rule);
    expect(result.allowed).toBe(false);
  });

  it('allows navigate under readOnly', () => {
    const rule = createRuleFromPreset('readOnly');
    const result = checkBoundary('navigate', 'https://example.com', rule);
    expect(result.allowed).toBe(true);
  });

  it('blocks expired delegations', () => {
    const rule = createRuleFromPreset('limited', {
      sitePatterns: [{ pattern: '*.example.com', action: 'allow' }],
      durationMinutes: 1,
    });
    rule.scope.timeBound!.expiresAt = new Date(Date.now() - 60000).toISOString();
    const result = checkBoundary('click', 'https://example.com', rule);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('expired');
  });
});

describe('matchSitePattern', () => {
  it('matches wildcard subdomain', () => {
    expect(matchSitePattern('https://sub.example.com/page', '*.example.com')).toBe(true);
  });

  it('does not match different domain', () => {
    expect(matchSitePattern('https://other.com', '*.example.com')).toBe(false);
  });

  it('matches exact hostname', () => {
    expect(matchSitePattern('https://example.com/path', 'example.com')).toBe(true);
  });

  it('handles invalid URLs gracefully', () => {
    expect(matchSitePattern('not-a-url', '*.example.com')).toBe(false);
  });
});

describe('isDelegationExpired', () => {
  it('returns false when no time bound', () => {
    const rule = createRuleFromPreset('readOnly');
    expect(isDelegationExpired(rule)).toBe(false);
  });

  it('returns false for future expiry', () => {
    const rule = createRuleFromPreset('limited', { durationMinutes: 60 });
    expect(isDelegationExpired(rule)).toBe(false);
  });

  it('returns true for past expiry', () => {
    const rule = createRuleFromPreset('limited', { durationMinutes: 1 });
    rule.scope.timeBound!.expiresAt = new Date(Date.now() - 1000).toISOString();
    expect(isDelegationExpired(rule)).toBe(true);
  });
});
