/**
 * OpenA2A Registry trust check client.
 *
 * Queries the public registry at registry.opena2a.org to determine
 * whether an agent type is registered and its trust classification.
 * Results are cached with a 5-minute TTL.
 *
 * Uses GET /api/v1/registry/packages/by-name/:type/:name which
 * returns a RegistryPackage object. The trust information is in
 * the trustLevel field (integer 0-4):
 *   0 = blocked, 1 = warning, 2 = listed, 3 = scanned, 4 = verified
 *
 * The search endpoint GET /api/v1/registry/search?q=:name is used
 * as a fallback when the package type is not known.
 */

export type TrustClassification = 'trusted' | 'known' | 'unknown' | 'untrusted';

export interface RegistryResult {
  /** Trust classification derived from the registry trustLevel. */
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
 * Map a registry trustLevel integer (0-4) to a TrustClassification.
 *
 * Registry trust levels:
 *   0 = blocked  -> untrusted
 *   1 = warning  -> untrusted
 *   2 = listed   -> known
 *   3 = scanned  -> known
 *   4 = verified -> trusted
 */
function trustLevelToClassification(trustLevel: number): TrustClassification {
  if (trustLevel >= 4) return 'trusted';
  if (trustLevel >= 2) return 'known';
  if (trustLevel >= 0) return 'untrusted';
  return 'unknown';
}

/**
 * Map a TrustClassification to a numeric trust score.
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
 * Parse a classification string from a response (for forward compatibility).
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
 * Calls GET /api/v1/registry/search?q=:agentType to find the package
 * by name. The response is an array of RegistryPackage objects. If
 * found, the trustLevel field (int 0-4) is mapped to a classification.
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
    const url = `${baseUrl}/api/v1/registry/search?q=${encodeURIComponent(agentType)}`;
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

    // Registry response: RegistryPackage object or array from search
    // RegistryPackage has: trustLevel (int 0-4), displayName (string), name (string)
    const data = await response.json() as
      | { trustLevel?: number; displayName?: string; name?: string }
      | Array<{ trustLevel?: number; displayName?: string; name?: string }>;

    // Search may return an array; use the first match
    const pkg = Array.isArray(data) ? data[0] : data;

    if (!pkg) {
      const result: RegistryResult = {
        classification: 'unknown',
        trustScore: 0.3,
        registered: false,
        displayName: null,
      };
      cache.set(agentType, { result, expiresAt: Date.now() + ttl });
      return result;
    }

    const classification = typeof pkg.trustLevel === 'number'
      ? trustLevelToClassification(pkg.trustLevel)
      : 'unknown';

    const result: RegistryResult = {
      classification,
      trustScore: classificationToScore(classification),
      registered: true,
      displayName: typeof pkg.displayName === 'string' ? pkg.displayName
        : typeof pkg.name === 'string' ? pkg.name
        : null,
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
