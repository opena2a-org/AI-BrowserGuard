/**
 * Behavioral heuristics for automation detection.
 *
 * Analyzes user interaction patterns to distinguish human input from
 * programmatic automation.
 */

import type { DetectionMethod, DetectionConfidence } from '../types/agent';

export interface BehavioralDetectionResult {
  detected: boolean;
  method: DetectionMethod;
  confidence: DetectionConfidence;
  detail: string;
  metrics: BehavioralMetrics;
}

export interface BehavioralMetrics {
  averageMouseInterval: number;
  mouseIntervalStdDev: number;
  integerCoordinateRatio: number;
  averageKeyInterval: number;
  keyIntervalStdDev: number;
  syntheticEventRatio: number;
  clicksWithoutMovement: number;
  totalEventsAnalyzed: number;
}

const BEHAVIORAL_THRESHOLDS = {
  mouseIntervalStdDevMin: 15,
  integerCoordinateRatioMax: 0.95,
  keyIntervalStdDevMin: 20,
  syntheticEventRatioMax: 0.5,
  minimumEventsRequired: 20,
} as const;

function computeStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function emptyMetrics(): BehavioralMetrics {
  return {
    averageMouseInterval: 0,
    mouseIntervalStdDev: 0,
    integerCoordinateRatio: 0,
    averageKeyInterval: 0,
    keyIntervalStdDev: 0,
    syntheticEventRatio: 0,
    clicksWithoutMovement: 0,
    totalEventsAnalyzed: 0,
  };
}

/**
 * Analyze mouse movement and click patterns for automation signals.
 */
export function analyzeMouseBehavior(
  events: Array<{
    type: string;
    clientX: number;
    clientY: number;
    timestamp: number;
    isTrusted: boolean;
  }>
): BehavioralDetectionResult {
  const metrics = emptyMetrics();
  metrics.totalEventsAnalyzed = events.length;

  if (events.length < BEHAVIORAL_THRESHOLDS.minimumEventsRequired) {
    return {
      detected: false,
      method: 'behavioral-timing',
      confidence: 'low',
      detail: `Insufficient mouse events for analysis (${events.length}/${BEHAVIORAL_THRESHOLDS.minimumEventsRequired}).`,
      metrics,
    };
  }

  // Compute inter-event intervals
  const intervals: number[] = [];
  for (let i = 1; i < events.length; i++) {
    intervals.push(events[i].timestamp - events[i - 1].timestamp);
  }
  metrics.averageMouseInterval = computeMean(intervals);
  metrics.mouseIntervalStdDev = computeStdDev(intervals);

  // Compute integer coordinate ratio
  let integerCount = 0;
  for (const e of events) {
    if (e.clientX === Math.floor(e.clientX) && e.clientY === Math.floor(e.clientY)) {
      integerCount++;
    }
  }
  metrics.integerCoordinateRatio = integerCount / events.length;

  // Count synthetic events
  const syntheticCount = events.filter((e) => !e.isTrusted).length;
  metrics.syntheticEventRatio = syntheticCount / events.length;

  // Count clicks without preceding movement
  let clicksWithoutMovement = 0;
  for (let i = 0; i < events.length; i++) {
    if (events[i].type === 'click') {
      const hasPrecedingMove = i > 0 && events[i - 1].type === 'mousemove';
      if (!hasPrecedingMove) clicksWithoutMovement++;
    }
  }
  metrics.clicksWithoutMovement = clicksWithoutMovement;

  // Evaluate against thresholds
  const anomalies: string[] = [];
  if (metrics.mouseIntervalStdDev < BEHAVIORAL_THRESHOLDS.mouseIntervalStdDevMin) {
    anomalies.push('uniform mouse timing');
  }
  if (metrics.integerCoordinateRatio > BEHAVIORAL_THRESHOLDS.integerCoordinateRatioMax) {
    anomalies.push('integer-only coordinates');
  }
  if (metrics.syntheticEventRatio > BEHAVIORAL_THRESHOLDS.syntheticEventRatioMax) {
    anomalies.push('high synthetic event ratio');
  }

  const detected = anomalies.length > 0;
  let confidence: DetectionConfidence = 'low';
  if (anomalies.length >= 3) confidence = 'high';
  else if (anomalies.length >= 2) confidence = 'medium';
  else if (anomalies.length === 1) confidence = 'low';

  return {
    detected,
    method: 'behavioral-timing',
    confidence,
    detail: detected
      ? `Mouse behavioral anomalies: ${anomalies.join(', ')}.`
      : 'Mouse behavior appears human.',
    metrics,
  };
}

/**
 * Analyze keyboard input patterns for automation signals.
 */
export function analyzeKeyboardBehavior(
  events: Array<{
    type: string;
    key: string;
    timestamp: number;
    isTrusted: boolean;
  }>
): BehavioralDetectionResult {
  const metrics = emptyMetrics();
  metrics.totalEventsAnalyzed = events.length;

  if (events.length < BEHAVIORAL_THRESHOLDS.minimumEventsRequired) {
    return {
      detected: false,
      method: 'behavioral-typing',
      confidence: 'low',
      detail: `Insufficient keyboard events for analysis (${events.length}/${BEHAVIORAL_THRESHOLDS.minimumEventsRequired}).`,
      metrics,
    };
  }

  // Compute inter-key intervals for keydown events
  const keydowns = events.filter((e) => e.type === 'keydown');
  const intervals: number[] = [];
  for (let i = 1; i < keydowns.length; i++) {
    intervals.push(keydowns[i].timestamp - keydowns[i - 1].timestamp);
  }
  metrics.averageKeyInterval = computeMean(intervals);
  metrics.keyIntervalStdDev = computeStdDev(intervals);

  // Count synthetic events
  const syntheticCount = events.filter((e) => !e.isTrusted).length;
  metrics.syntheticEventRatio = syntheticCount / events.length;

  const anomalies: string[] = [];
  if (metrics.keyIntervalStdDev < BEHAVIORAL_THRESHOLDS.keyIntervalStdDevMin && keydowns.length > 5) {
    anomalies.push('uniform key timing');
  }
  if (metrics.syntheticEventRatio > BEHAVIORAL_THRESHOLDS.syntheticEventRatioMax) {
    anomalies.push('high synthetic event ratio');
  }
  // Unrealistic speed: average interval < 30ms
  if (metrics.averageKeyInterval > 0 && metrics.averageKeyInterval < 30 && keydowns.length > 5) {
    anomalies.push('superhuman typing speed');
  }

  const detected = anomalies.length > 0;
  let confidence: DetectionConfidence = 'low';
  if (anomalies.length >= 2) confidence = 'medium';
  if (metrics.syntheticEventRatio > 0.8) confidence = 'high';

  return {
    detected,
    method: 'behavioral-typing',
    confidence,
    detail: detected
      ? `Keyboard behavioral anomalies: ${anomalies.join(', ')}.`
      : 'Keyboard behavior appears human.',
    metrics,
  };
}

/**
 * Analyze click targeting precision.
 */
export function analyzeClickPrecision(
  clicks: Array<{
    clientX: number;
    clientY: number;
    targetRect: { x: number; y: number; width: number; height: number };
    timestamp: number;
  }>
): BehavioralDetectionResult {
  const metrics = emptyMetrics();
  metrics.totalEventsAnalyzed = clicks.length;

  if (clicks.length < 5) {
    return {
      detected: false,
      method: 'behavioral-precision',
      confidence: 'low',
      detail: `Insufficient click data for precision analysis (${clicks.length}/5).`,
      metrics,
    };
  }

  // Compute offset from center for each click
  const offsets: number[] = [];
  for (const click of clicks) {
    const centerX = click.targetRect.x + click.targetRect.width / 2;
    const centerY = click.targetRect.y + click.targetRect.height / 2;
    const offset = Math.sqrt(
      (click.clientX - centerX) ** 2 + (click.clientY - centerY) ** 2
    );
    offsets.push(offset);
  }

  const stdDev = computeStdDev(offsets);
  const meanOffset = computeMean(offsets);

  // Automation: very low offset variation with near-perfect centering
  const detected = stdDev < 2 && meanOffset < 3;
  const confidence: DetectionConfidence = detected ? 'medium' : 'low';

  return {
    detected,
    method: 'behavioral-precision',
    confidence,
    detail: detected
      ? `Click precision is suspiciously uniform (std dev: ${stdDev.toFixed(1)}px, mean offset: ${meanOffset.toFixed(1)}px).`
      : `Click precision appears human (std dev: ${stdDev.toFixed(1)}px).`,
    metrics,
  };
}

/**
 * Aggregate all behavioral analysis results into a single verdict.
 */
export function aggregateBehavioralAnalysis(
  mouseResult: BehavioralDetectionResult | null,
  keyboardResult: BehavioralDetectionResult | null,
  clickResult: BehavioralDetectionResult | null
): BehavioralDetectionResult {
  const results = [mouseResult, keyboardResult, clickResult].filter(
    (r): r is BehavioralDetectionResult => r !== null
  );

  if (results.length === 0) {
    return {
      detected: false,
      method: 'behavioral-timing',
      confidence: 'low',
      detail: 'No behavioral data available for analysis.',
      metrics: emptyMetrics(),
    };
  }

  const detectedCount = results.filter((r) => r.detected).length;
  const detected = detectedCount > 0;

  // Determine overall confidence based on how many signals agree
  const confidenceOrder: DetectionConfidence[] = ['low', 'medium', 'high', 'confirmed'];
  let confidence: DetectionConfidence = 'low';
  if (detectedCount >= 3) {
    confidence = 'confirmed';
  } else if (detectedCount >= 2) {
    confidence = 'high';
  } else if (detectedCount === 1) {
    // Use the individual result's confidence
    const detectedResult = results.find((r) => r.detected);
    confidence = detectedResult?.confidence ?? 'low';
  }

  // Merge metrics from the most informative result
  const bestResult = results.reduce((best, r) => {
    const bestIdx = confidenceOrder.indexOf(best.confidence);
    const rIdx = confidenceOrder.indexOf(r.confidence);
    return rIdx > bestIdx ? r : best;
  });

  const details = results
    .filter((r) => r.detected)
    .map((r) => r.detail)
    .join(' ');

  return {
    detected,
    method: bestResult.method,
    confidence,
    detail: detected ? details : 'Behavioral analysis indicates human interaction.',
    metrics: bestResult.metrics,
  };
}
