/**
 * OpenA2A Registry trust check client.
 *
 * Queries the public registry at registry.opena2a.org to determine
 * whether an agent type is registered and its trust classification.
 * Results are cached with a 5-minute TTL.
 */

export type TrustClassification = 'trusted' | 'known' | 'unknown' | 'untrusted';

export interface RegistryResult {
  /** Trust classification from the registry. */
  classification: TrustClassification;
  /** Numeric trust score between 0.0 and 1.0. */
  trustScore: number;
  /** Whether the agent type exists in the registry. */
  registered: boolean;
  /** Optional display name from the registry. */
  displayName: string | null;
}

interface CacheEntry {
  result: RegistryResult;
  expiresAt: number;
}

const DEFAULT_REGISTRY_BASE_URL = 'https://registry.opena2a.org';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const cache = new Map<string, CacheEntry>();

/**
 * Map a classification string to a numeric trust score.
 */
function classificationToScore(classification: TrustClassification): number {
  switch (classification) {
    case 'trusted': return 0.9;
    case 'known': return 0.6;
    case 'unknown': return 0.3;
    case 'untrusted': return 0.1;
  }
}

/**
 * Parse a classification string from the API response.
 */
function parseClassification(value: unknown): TrustClassification {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'trusted' || lower === 'known' || lower === 'unknown' || lower === 'untrusted') {
      return lower;
    }
  }
  return 'unknown';
}

/**
 * Query the registry for trust information about an agent type.
 *
 * Returns null on any failure so callers can degrade gracefully.
 */
export async function lookupRegistryTrust(
  agentType: string,
  options?: { baseUrl?: string; cacheTtlMs?: number }
): Promise<RegistryResult | null> {
  const baseUrl = options?.baseUrl ?? DEFAULT_REGISTRY_BASE_URL;
  const ttl = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  // Check cache
  const cached = cache.get(agentType);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    const url = `${baseUrl}/api/agents/${encodeURIComponent(agentType)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 404) {
      // Agent type not registered
      const result: RegistryResult = {
        classification: 'unknown',
        trustScore: 0.3,
        registered: false,
        displayName: null,
      };
      cache.set(agentType, { result, expiresAt: Date.now() + ttl });
      return result;
    }

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      classification?: string;
      trustScore?: number;
      displayName?: string;
    };

    const classification = parseClassification(data.classification);
    const result: RegistryResult = {
      classification,
      trustScore: typeof data.trustScore === 'number' ? data.trustScore : classificationToScore(classification),
      registered: true,
      displayName: typeof data.displayName === 'string' ? data.displayName : null,
    };

    cache.set(agentType, { result, expiresAt: Date.now() + ttl });
    return result;
  } catch {
    return null;
  }
}

/**
 * Clear the registry lookup cache.
 */
export function clearRegistryCache(): void {
  cache.clear();
}

/**
 * Get the current cache size (for testing/debugging).
 */
export function getRegistryCacheSize(): number {
  return cache.size;
}
