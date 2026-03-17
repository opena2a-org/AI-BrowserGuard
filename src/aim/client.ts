/**
 * AIM (Agent Identity Management) API client.
 *
 * Performs lightweight lookups against an AIM server to retrieve
 * trust scores and labels for detected agents. Results are cached
 * in memory with a configurable TTL (default 5 minutes).
 */

export interface AIMResult {
  /** Trust score between 0.0 and 1.0. */
  trustScore: number;
  /** Human-readable label for the agent. */
  label: string;
  /** Whether the agent is registered in AIM. */
  registered: boolean;
}

interface CacheEntry {
  result: AIMResult;
  expiresAt: number;
}

const DEFAULT_AIM_BASE_URL = 'https://aim.opena2a.org';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const cache = new Map<string, CacheEntry>();

/**
 * Build a cache key from agent type and origin.
 */
function cacheKey(agentType: string, origin: string): string {
  return `${agentType}:${origin}`;
}

/**
 * Look up an agent's identity and trust score from AIM.
 *
 * Returns null on any failure (network error, timeout, non-200 response)
 * so callers can fall back gracefully.
 */
export async function lookupAgentIdentity(
  agentType: string,
  origin: string,
  options?: { baseUrl?: string; cacheTtlMs?: number }
): Promise<AIMResult | null> {
  const baseUrl = options?.baseUrl ?? DEFAULT_AIM_BASE_URL;
  const ttl = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  const key = cacheKey(agentType, origin);

  // Check cache
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    const url = `${baseUrl}/api/agents/lookup?type=${encodeURIComponent(agentType)}&origin=${encodeURIComponent(origin)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      trustScore?: number;
      label?: string;
      registered?: boolean;
    };

    const result: AIMResult = {
      trustScore: typeof data.trustScore === 'number' ? data.trustScore : 0,
      label: typeof data.label === 'string' ? data.label : agentType,
      registered: typeof data.registered === 'boolean' ? data.registered : false,
    };

    // Store in cache
    cache.set(key, {
      result,
      expiresAt: Date.now() + ttl,
    });

    return result;
  } catch {
    // Network error, timeout, or parse failure
    return null;
  }
}

/**
 * Clear the AIM lookup cache.
 * Useful for testing or when settings change.
 */
export function clearAIMCache(): void {
  cache.clear();
}

/**
 * Get the current cache size (for testing/debugging).
 */
export function getAIMCacheSize(): number {
  return cache.size;
}
