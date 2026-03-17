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
  it('returns registry result for a verified package (trustLevel 4)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{
        trustLevel: 4,
        displayName: 'Official Playwright',
        name: 'playwright',
      }]),
    });

    const result = await lookupRegistryTrust('playwright', {
      baseUrl: 'https://registry.test',
    });

    expect(result).not.toBeNull();
    expect(result!.classification).toBe('trusted');
    expect(result!.trustScore).toBe(0.9);
    expect(result!.registered).toBe(true);
    expect(result!.displayName).toBe('Official Playwright');
    // Verify correct API path
    expect(mockFetch.mock.calls[0][0]).toContain('/api/v1/registry/search?q=playwright');
  });

  it('returns known classification for scanned package (trustLevel 3)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{
        trustLevel: 3,
        displayName: 'Scanned Agent',
        name: 'scanned-agent',
      }]),
    });

    const result = await lookupRegistryTrust('scanned-agent');
    expect(result).not.toBeNull();
    expect(result!.classification).toBe('known');
    expect(result!.trustScore).toBe(0.6);
    expect(result!.registered).toBe(true);
  });

  it('returns known classification for listed package (trustLevel 2)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{
        trustLevel: 2,
        name: 'listed-agent',
      }]),
    });

    const result = await lookupRegistryTrust('listed-agent');
    expect(result).not.toBeNull();
    expect(result!.classification).toBe('known');
    expect(result!.trustScore).toBe(0.6);
  });

  it('returns untrusted classification for blocked package (trustLevel 0)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{
        trustLevel: 0,
        name: 'blocked-agent',
      }]),
    });

    const result = await lookupRegistryTrust('blocked-agent');
    expect(result).not.toBeNull();
    expect(result!.classification).toBe('untrusted');
    expect(result!.trustScore).toBe(0.1);
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

  it('returns unknown for empty search results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });

    const result = await lookupRegistryTrust('nonexistent-agent');
    expect(result).not.toBeNull();
    expect(result!.classification).toBe('unknown');
    expect(result!.registered).toBe(false);
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
      json: () => Promise.resolve([{
        trustLevel: 3,
        displayName: 'Test Agent',
        name: 'playwright',
      }]),
    });

    await lookupRegistryTrust('playwright');
    await lookupRegistryTrust('playwright');

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(getRegistryCacheSize()).toBe(1);
  });

  it('maps all trustLevel values correctly', async () => {
    const cases: Array<{ trustLevel: number; expectedClassification: string; expectedScore: number }> = [
      { trustLevel: 0, expectedClassification: 'untrusted', expectedScore: 0.1 },
      { trustLevel: 1, expectedClassification: 'untrusted', expectedScore: 0.1 },
      { trustLevel: 2, expectedClassification: 'known', expectedScore: 0.6 },
      { trustLevel: 3, expectedClassification: 'known', expectedScore: 0.6 },
      { trustLevel: 4, expectedClassification: 'trusted', expectedScore: 0.9 },
    ];

    for (const { trustLevel, expectedClassification, expectedScore } of cases) {
      clearRegistryCache();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ trustLevel, name: 'test' }]),
      });

      const result = await lookupRegistryTrust('test-agent');
      expect(result).not.toBeNull();
      expect(result!.classification).toBe(expectedClassification);
      expect(result!.trustScore).toBe(expectedScore);
    }
  });

  it('handles single object response (non-array)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        trustLevel: 4,
        displayName: 'Direct Lookup',
        name: 'test-agent',
      }),
    });

    const result = await lookupRegistryTrust('test-agent');
    expect(result).not.toBeNull();
    expect(result!.classification).toBe('trusted');
    expect(result!.displayName).toBe('Direct Lookup');
  });

  it('falls back to name when displayName is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{
        trustLevel: 3,
        name: 'my-agent',
      }]),
    });

    const result = await lookupRegistryTrust('my-agent');
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe('my-agent');
  });

  it('clears cache correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ trustLevel: 3, name: 'playwright' }]),
    });

    await lookupRegistryTrust('playwright');
    expect(getRegistryCacheSize()).toBe(1);

    clearRegistryCache();
    expect(getRegistryCacheSize()).toBe(0);

    await lookupRegistryTrust('playwright');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
