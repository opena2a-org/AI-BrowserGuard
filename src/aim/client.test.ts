import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupAgentIdentity, clearAIMCache, getAIMCacheSize } from './client';

// Mock global fetch
const mockFetch = vi.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

beforeEach(() => {
  clearAIMCache();
  mockFetch.mockReset();
});

describe('lookupAgentIdentity', () => {
  it('returns AIM result on successful lookup', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        trustScore: 0.85,
        label: 'Verified Playwright',
        registered: true,
      }),
    });

    const result = await lookupAgentIdentity('playwright', 'https://example.com', {
      baseUrl: 'https://aim.test',
    });

    expect(result).not.toBeNull();
    expect(result!.trustScore).toBe(0.85);
    expect(result!.label).toBe('Verified Playwright');
    expect(result!.registered).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][0]).toContain('aim.test');
  });

  it('returns null on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await lookupAgentIdentity('playwright', 'https://example.com');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await lookupAgentIdentity('playwright', 'https://example.com');
    expect(result).toBeNull();
  });

  it('caches results for the same agent+origin', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        trustScore: 0.9,
        label: 'Test',
        registered: true,
      }),
    });

    const result1 = await lookupAgentIdentity('playwright', 'https://example.com');
    const result2 = await lookupAgentIdentity('playwright', 'https://example.com');

    expect(result1).toEqual(result2);
    expect(mockFetch).toHaveBeenCalledOnce(); // Only one fetch, second was cached
    expect(getAIMCacheSize()).toBe(1);
  });

  it('uses different cache keys for different agents', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        trustScore: 0.5,
        label: 'Agent',
        registered: true,
      }),
    });

    await lookupAgentIdentity('playwright', 'https://a.com');
    await lookupAgentIdentity('puppeteer', 'https://a.com');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(getAIMCacheSize()).toBe(2);
  });

  it('handles malformed response data gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        // Missing expected fields
        unexpected: 'data',
      }),
    });

    const result = await lookupAgentIdentity('selenium', 'https://example.com');
    expect(result).not.toBeNull();
    expect(result!.trustScore).toBe(0);
    expect(result!.label).toBe('selenium');
    expect(result!.registered).toBe(false);
  });

  it('clears cache when clearAIMCache is called', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        trustScore: 0.5,
        label: 'Test',
        registered: true,
      }),
    });

    await lookupAgentIdentity('playwright', 'https://example.com');
    expect(getAIMCacheSize()).toBe(1);

    clearAIMCache();
    expect(getAIMCacheSize()).toBe(0);
  });

  it('re-fetches after cache is cleared', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        trustScore: 0.5,
        label: 'Test',
        registered: true,
      }),
    });

    await lookupAgentIdentity('playwright', 'https://example.com');
    clearAIMCache();
    await lookupAgentIdentity('playwright', 'https://example.com');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
