/**
 * Registry contribution client.
 * Sends anonymized detection data to the OpenA2A trust registry.
 * Handles consent management, anonymization, batching, and offline queuing.
 */

import type { ContributeEvent, ContributeConsent, ContributeQueue } from './types';
import { DEFAULT_CONSENT, DEFAULT_QUEUE } from './types';

const CONSENT_KEY = 'contributeConsent';
const QUEUE_KEY = 'contributeQueue';
const REGISTRY_CONTRIBUTE_URL = 'https://api.oa2a.org/api/v1/contribute';
const FLUSH_THRESHOLD = 10; // Flush after 10 events

/** Get the current consent state. */
export async function getConsent(): Promise<ContributeConsent> {
  try {
    const result = await chrome.storage.local.get(CONSENT_KEY);
    return { ...DEFAULT_CONSENT, ...(result[CONSENT_KEY] ?? {}) } as ContributeConsent;
  } catch {
    return { ...DEFAULT_CONSENT } as ContributeConsent;
  }
}

/** Save consent state. */
export async function saveConsent(consent: ContributeConsent): Promise<void> {
  await chrome.storage.local.set({ [CONSENT_KEY]: consent });
}

/** Enable contributions (user opted in). */
export async function enableContributions(): Promise<void> {
  const consent = await getConsent();
  consent.enabled = true;
  consent.grantedAt = new Date().toISOString();
  await saveConsent(consent);
}

/** Disable contributions (user opted out). */
export async function disableContributions(): Promise<void> {
  const consent = await getConsent();
  consent.enabled = false;
  await saveConsent(consent);
  // Clear the queue when disabling
  await saveQueue({ events: [], lastFlushedAt: null, totalFlushes: 0, totalContributed: 0 });
}

/** Record a detection for consent tip tracking. Returns true if the tip should now be shown. */
export async function recordDetection(): Promise<boolean> {
  const consent = await getConsent();
  consent.detectionsSinceInstall++;
  if (!consent.firstDetectionAt) {
    consent.firstDetectionAt = new Date().toISOString();
  }
  await saveConsent(consent);
  return shouldShowTip(consent);
}

/** Check if the delayed consent tip should be shown. */
export function shouldShowTip(consent: ContributeConsent): boolean {
  if (consent.enabled) return false; // Already opted in
  if (consent.tipDismissed) return false; // Already dismissed

  // Show after 5th detection
  if (consent.detectionsSinceInstall >= 5) return true;

  // Show after 3 days of use
  if (consent.firstDetectionAt) {
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(consent.firstDetectionAt).getTime();
    if (elapsed >= threeDaysMs) return true;
  }

  return false;
}

/** Dismiss the consent tip (user clicked dismiss, not enable). */
export async function dismissTip(): Promise<void> {
  const consent = await getConsent();
  consent.tipShown = true;
  consent.tipDismissed = true;
  await saveConsent(consent);
}

/** Get the event queue. */
export async function getQueue(): Promise<ContributeQueue> {
  try {
    const result = await chrome.storage.local.get(QUEUE_KEY);
    const stored = (result[QUEUE_KEY] ?? {}) as Partial<ContributeQueue>;
    return {
      events: stored.events ? [...stored.events] : [],
      lastFlushedAt: stored.lastFlushedAt ?? DEFAULT_QUEUE.lastFlushedAt,
      totalFlushes: stored.totalFlushes ?? DEFAULT_QUEUE.totalFlushes,
      totalContributed: stored.totalContributed ?? DEFAULT_QUEUE.totalContributed,
    };
  } catch {
    return { events: [], lastFlushedAt: null, totalFlushes: 0, totalContributed: 0 };
  }
}

/** Save the event queue. */
async function saveQueue(queue: ContributeQueue): Promise<void> {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

/**
 * Queue a contribution event. If the queue reaches the flush threshold,
 * automatically flush to the registry.
 */
export async function queueEvent(event: ContributeEvent): Promise<void> {
  const consent = await getConsent();
  if (!consent.enabled) return; // Do not queue if not opted in

  const queue = await getQueue();
  queue.events.push(event);
  await saveQueue(queue);

  // Auto-flush if threshold reached
  if (queue.events.length >= FLUSH_THRESHOLD) {
    await flushQueue();
  }
}

/**
 * Flush the event queue to the Registry.
 * Sends batched events and clears the queue on success.
 * Silently fails on network error (events stay queued for retry).
 */
export async function flushQueue(accessToken?: string | null): Promise<{ sent: number; success: boolean }> {
  const queue = await getQueue();
  if (queue.events.length === 0) {
    return { sent: 0, success: true };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(REGISTRY_CONTRIBUTE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tool: 'aibrowserguard',
        version: chrome.runtime.getManifest?.()?.version ?? '0.0.0',
        events: queue.events,
      }),
    });

    if (response.ok) {
      const sentCount = queue.events.length;
      queue.totalContributed += sentCount;
      queue.totalFlushes++;
      queue.lastFlushedAt = new Date().toISOString();
      queue.events = []; // Clear sent events
      await saveQueue(queue);
      return { sent: sentCount, success: true };
    }

    // Non-2xx response -- keep events queued for retry
    return { sent: 0, success: false };
  } catch {
    // Network error -- keep events queued for retry
    return { sent: 0, success: false };
  }
}

/**
 * Get contribution statistics for display in the popup.
 */
export async function getContributeStats(): Promise<{
  totalContributed: number;
  queuedCount: number;
  lastFlushedAt: string | null;
  enabled: boolean;
}> {
  const [consent, queue] = await Promise.all([getConsent(), getQueue()]);
  return {
    totalContributed: queue.totalContributed,
    queuedCount: queue.events.length,
    lastFlushedAt: queue.lastFlushedAt,
    enabled: consent.enabled,
  };
}
