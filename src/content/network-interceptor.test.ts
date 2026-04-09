import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installNetworkInterceptor } from './network-interceptor';
import type { NetworkEvent } from './network-interceptor';

// We need to mock window.fetch and XMLHttpRequest since we're in Node
let originalFetch: typeof globalThis.fetch;
let originalXHRProto: {
  open: typeof XMLHttpRequest.prototype.open;
};

// Create a minimal XHR mock for Node environment
function createMockXHR(): typeof XMLHttpRequest {
  function MockXHR(this: Record<string, unknown>) {
    this._listeners = new Map<string, Array<{ fn: Function; once: boolean }>>();
  }
  MockXHR.prototype.open = vi.fn();
  MockXHR.prototype.send = vi.fn(function (this: Record<string, unknown>) {
    // Fire loadstart listeners synchronously for test convenience
    const listeners = (this._listeners as Map<string, Array<{ fn: Function; once: boolean }>>)?.get('loadstart') ?? [];
    for (const { fn } of listeners) {
      fn();
    }
  });
  MockXHR.prototype.addEventListener = vi.fn(function (this: Record<string, unknown>, type: string, fn: Function, opts?: { once?: boolean }) {
    const map = this._listeners as Map<string, Array<{ fn: Function; once: boolean }>>;
    if (!map.has(type)) map.set(type, []);
    map.get(type)!.push({ fn, once: opts?.once ?? false });
  });
  return MockXHR as unknown as typeof XMLHttpRequest;
}

beforeEach(() => {
  // Set up fetch mock
  originalFetch = vi.fn(() =>
    Promise.resolve(new Response('ok'))
  ) as unknown as typeof globalThis.fetch;
  (globalThis as Record<string, unknown>).fetch = originalFetch;

  // Set up XHR mock
  if (typeof XMLHttpRequest === 'undefined') {
    (globalThis as Record<string, unknown>).XMLHttpRequest = createMockXHR();
  }
  originalXHRProto = {
    open: XMLHttpRequest.prototype.open,
  };
});

describe('installNetworkInterceptor', () => {
  it('intercepts fetch calls and reports events', async () => {
    const events: NetworkEvent[] = [];
    const cleanup = installNetworkInterceptor((event) => {
      events.push(event);
    });

    try {
      await window.fetch('https://api.example.com/data', { method: 'POST', body: '{"key":"value"}' });

      expect(events).toHaveLength(1);
      expect(events[0].url).toBe('https://api.example.com/data');
      expect(events[0].method).toBe('POST');
      expect(events[0].dataSize).toBeGreaterThan(0);
      expect(events[0].timestamp).toBeTruthy();
      expect(['agent', 'user', 'unknown']).toContain(events[0].initiator);
    } finally {
      cleanup();
    }
  });

  it('intercepts fetch with URL object', async () => {
    const events: NetworkEvent[] = [];
    const cleanup = installNetworkInterceptor((event) => {
      events.push(event);
    });

    try {
      await window.fetch(new URL('https://api.example.com/test'));

      expect(events).toHaveLength(1);
      expect(events[0].url).toBe('https://api.example.com/test');
      expect(events[0].method).toBe('GET');
    } finally {
      cleanup();
    }
  });

  it('restores original fetch on cleanup', async () => {
    const events: NetworkEvent[] = [];
    const cleanup = installNetworkInterceptor((event) => {
      events.push(event);
    });

    // While interceptor is active, events should be captured
    await window.fetch('https://example.com/test1');
    expect(events).toHaveLength(1);

    cleanup();

    // After cleanup, no more events should be captured
    const countBefore = events.length;
    await window.fetch('https://example.com/test2');
    expect(events).toHaveLength(countBefore); // no new events
  });

  it('restores original XHR methods on cleanup', () => {
    const callback = vi.fn();
    const cleanup = installNetworkInterceptor(callback);

    // XHR open should be wrapped (send is no longer wrapped — observed passively)
    expect(XMLHttpRequest.prototype.open).not.toBe(originalXHRProto.open);

    cleanup();

    // XHR should be restored
    expect(XMLHttpRequest.prototype.open).toBe(originalXHRProto.open);
  });

  it('handles fetch with no body (GET request)', async () => {
    const events: NetworkEvent[] = [];
    const cleanup = installNetworkInterceptor((event) => {
      events.push(event);
    });

    try {
      await window.fetch('https://api.example.com/data');

      expect(events).toHaveLength(1);
      expect(events[0].method).toBe('GET');
      expect(events[0].dataSize).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('does not break fetch on callback error', async () => {
    const cleanup = installNetworkInterceptor(() => {
      throw new Error('Callback error');
    });

    try {
      // Should not throw despite callback error
      const response = await window.fetch('https://api.example.com/data');
      expect(response).toBeTruthy();
    } finally {
      cleanup();
    }
  });

  it('intercepts XHR open and send', () => {
    const events: NetworkEvent[] = [];
    const cleanup = installNetworkInterceptor((event) => {
      events.push(event);
    });

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://api.example.com/xhr-test');
      xhr.send();

      expect(events).toHaveLength(1);
      expect(events[0].url).toBe('https://api.example.com/xhr-test');
      expect(events[0].method).toBe('GET');
    } finally {
      cleanup();
    }
  });

  it('tracks POST method for XHR via passive observation', () => {
    const events: NetworkEvent[] = [];
    const cleanup = installNetworkInterceptor((event) => {
      events.push(event);
    });

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://api.example.com/submit');
      xhr.send('body content here');

      expect(events).toHaveLength(1);
      expect(events[0].method).toBe('POST');
      // Body size is not available from passive loadstart observation
      expect(events[0].dataSize).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('handles string input to fetch', async () => {
    const events: NetworkEvent[] = [];
    const cleanup = installNetworkInterceptor((event) => {
      events.push(event);
    });

    try {
      await window.fetch('https://example.com/page');
      expect(events[0].url).toBe('https://example.com/page');
    } finally {
      cleanup();
    }
  });
});
