import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupRegistryTrust, clearRegistryCache, getRegistryCacheSize } from './client';

// Mock global fetch
const mockFetch = vi.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

beforeEach(() => {
  clearRegistryCache();
  mockFetch.mockReset();
});

describe('lookupRegistryTrust', () => {
  it('returns registry result for a registered agent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        classification: 'trusted',
        trustScore: 0.92,
        displayName: 'Official Playwright',
      }),
    });

    const result = await lookupRegistryTrust('playwright', {
      baseUrl: 'https://registry.test',
    });

    expect(result).not.toBeNull();
    expect(result!.classification).toBe('trusted');
    expect(result!.trustScore).toBe(0.92);
    expect(result!.registered).toBe(true);
    expect(result!.displayName).toBe('Official Playwright');
  });

  it('returns unknown classification for 404 (unregistered agent)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await lookupRegistryTrust('custom-agent', {
      baseUrl: 'https://registry.test',
    });

    expect(result).not.toBeNull();
    expect(result!.classification).toBe('unknown');
    expect(result!.trustScore).toBe(0.3);
    expect(result!.registered).toBe(false);
    expect(result!.displayName).toBeNull();
  });

  it('returns null on server error (non-404)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await lookupRegistryTrust('playwright');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await lookupRegistryTrust('playwright');
    expect(result).toBeNull();
  });

  it('caches results by agent type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        classification: 'known',
        displayName: 'Test Agent',
      }),
    });

    await lookupRegistryTrust('playwright');
    await lookupRegistryTrust('playwright');

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(getRegistryCacheSize()).toBe(1);
  });

  it('uses default trust score when classification is present but score is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        classification: 'untrusted',
      }),
    });

    const result = await lookupRegistryTrust('malicious-bot');
    expect(result).not.toBeNull();
    expect(result!.trustScore).toBe(0.1); // untrusted default
  });

  it('maps classification strings to correct scores', async () => {
    const cases: Array<{ classification: string; expectedScore: number }> = [
      { classification: 'trusted', expectedScore: 0.9 },
      { classification: 'known', expectedScore: 0.6 },
      { classification: 'unknown', expectedScore: 0.3 },
      { classification: 'untrusted', expectedScore: 0.1 },
    ];

    for (const { classification, expectedScore } of cases) {
      clearRegistryCache();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ classification }),
      });

      const result = await lookupRegistryTrust('test-agent');
      expect(result).not.toBeNull();
      expect(result!.trustScore).toBe(expectedScore);
    }
  });

  it('handles unrecognized classification as unknown', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        classification: 'INVALID_VALUE',
      }),
    });

    const result = await lookupRegistryTrust('test-agent');
    expect(result).not.toBeNull();
    expect(result!.classification).toBe('unknown');
    expect(result!.trustScore).toBe(0.3);
  });

  it('clears cache correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ classification: 'known' }),
    });

    await lookupRegistryTrust('playwright');
    expect(getRegistryCacheSize()).toBe(1);

    clearRegistryCache();
    expect(getRegistryCacheSize()).toBe(0);

    await lookupRegistryTrust('playwright');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
