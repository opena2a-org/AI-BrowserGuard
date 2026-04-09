/**
 * Privacy-preserving network activity interceptor.
 *
 * Wraps window.fetch and XMLHttpRequest in the MAIN world content script
 * to track network requests without requiring the webRequest permission.
 * This keeps the extension Chrome Web Store compliant.
 *
 * Distinguishes agent-initiated requests from user-initiated ones using
 * stack trace heuristics (automation framework signatures in the call stack).
 */

/**
 * A single observed network request event.
 */
export interface NetworkEvent {
  /** Target URL of the request. */
  url: string;
  /** HTTP method (GET, POST, etc.). */
  method: string;
  /** ISO 8601 timestamp when the request was initiated. */
  timestamp: string;
  /** Approximate request body size in bytes (0 if no body). */
  dataSize: number;
  /** Whether the request was likely initiated by an agent or user. */
  initiator: 'agent' | 'user' | 'unknown';
}

/** Known automation framework patterns in call stacks. */
const AGENT_STACK_PATTERNS = [
  /UtilityScript/,
  /__puppeteer_evaluation_script__/,
  /pptr:/,
  /ExecutionContext\._evaluateInternal/,
  /callFunction\b/,
  /Runtime\.evaluate/,
  /Runtime\.callFunctionOn/,
];

/**
 * Determine whether the current call stack suggests agent initiation.
 */
function detectAgentInitiation(): 'agent' | 'user' | 'unknown' {
  try {
    const stack = new Error('__network_probe__').stack ?? '';
    for (const pattern of AGENT_STACK_PATTERNS) {
      if (pattern.test(stack)) {
        return 'agent';
      }
    }
    return 'user';
  } catch {
    return 'unknown';
  }
}

/**
 * Estimate the byte size of a request body.
 */
function estimateBodySize(body: unknown): number {
  if (body === null || body === undefined) return 0;
  if (typeof body === 'string') return body.length;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (body instanceof Blob) return body.size;
  if (body instanceof FormData) {
    // Rough estimate for FormData
    let size = 0;
    body.forEach((value) => {
      if (typeof value === 'string') {
        size += value.length;
      } else if (value instanceof Blob) {
        size += value.size;
      }
    });
    return size;
  }
  if (typeof body === 'object') {
    try {
      return JSON.stringify(body).length;
    } catch {
      return 0;
    }
  }
  return 0;
}

export type NetworkEventCallback = (event: NetworkEvent) => void;

/**
 * Install network interception on the current page.
 *
 * Wraps window.fetch and XMLHttpRequest.prototype.open/send to
 * observe outgoing requests. Calls the provided callback for each
 * network event detected.
 *
 * Returns a cleanup function that restores original implementations.
 */
export function installNetworkInterceptor(
  callback: NetworkEventCallback
): () => void {
  const cleanups: Array<() => void> = [];

  // --- Intercept fetch ---
  const originalFetch = window.fetch.bind(window);

  const wrappedFetch: typeof window.fetch = function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const initiator = detectAgentInitiation();

    let url: string;
    let method = 'GET';

    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input instanceof Request) {
      url = input.url;
      method = input.method;
    } else {
      url = String(input);
    }

    if (init?.method) {
      method = init.method;
    }

    const dataSize = estimateBodySize(init?.body ?? null);

    const event: NetworkEvent = {
      url,
      method: method.toUpperCase(),
      timestamp: new Date().toISOString(),
      dataSize,
      initiator,
    };

    try {
      callback(event);
    } catch {
      // Never let callback errors affect the actual request
    }

    return originalFetch(input, init);
  };

  window.fetch = wrappedFetch;
  cleanups.push(() => {
    window.fetch = originalFetch;
  });

  // --- Intercept XMLHttpRequest ---
  // We only wrap `open` to capture method/URL metadata and attach a passive
  // `loadstart` event listener. We do NOT wrap `send` — wrapping send puts
  // our code in the call chain, so any CSP violations on the page's own
  // requests get attributed to our extension in chrome://extensions.
  const originalXHROpen = XMLHttpRequest.prototype.open;

  // Track method and URL per XHR instance using a WeakMap
  const xhrMeta = new WeakMap<XMLHttpRequest, { method: string; url: string }>();

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ): void {
    const meta = {
      method: method.toUpperCase(),
      url: typeof url === 'string' ? url : url.toString(),
    };
    xhrMeta.set(this, meta);

    // Observe the request passively via loadstart — fires when send() is
    // called but without us being in the send() call chain.
    this.addEventListener('loadstart', () => {
      const initiator = detectAgentInitiation();
      const event: NetworkEvent = {
        url: meta.url,
        method: meta.method,
        timestamp: new Date().toISOString(),
        dataSize: 0, // body size not available from loadstart
        initiator,
      };
      try {
        callback(event);
      } catch {
        // Never let callback errors affect the actual request
      }
    }, { once: true });

    return (originalXHROpen as Function).apply(this, [method, url, ...rest]);
  };

  cleanups.push(() => {
    XMLHttpRequest.prototype.open = originalXHROpen;
  });

  return () => {
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch {
        // Ignore cleanup errors
      }
    }
  };
}
