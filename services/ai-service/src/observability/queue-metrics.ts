import { Gauge, Histogram } from 'prom-client';
import { getMetricsRegistry } from './metrics.registry';

/**
 * Phase-52D: Queue observability metrics.
 *
 * Passive instrumentation only. Metrics failures must never affect execution.
 * All calls are wrapped in try/catch.
 */

const LAG_BUCKETS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60];

let gaugesInitialized = false;
let histogramInitialized = false;
let gaugeWaiting: Gauge<string>;
let gaugeActive: Gauge<string>;
let gaugeCompleted: Gauge<string>;
let gaugeFailed: Gauge<string>;
let histogramLag: Histogram<string>;

function ensureGauges(): void {
  if (gaugesInitialized) return;
  const registry = getMetricsRegistry();
  gaugeWaiting = new Gauge({
    name: 'aisandbox_queue_waiting_jobs',
    help: 'Number of jobs waiting in the queue',
    registers: [registry],
  });
  gaugeActive = new Gauge({
    name: 'aisandbox_queue_active_jobs',
    help: 'Number of jobs currently being processed',
    registers: [registry],
  });
  gaugeCompleted = new Gauge({
    name: 'aisandbox_queue_completed_jobs',
    help: 'Number of completed jobs in the queue',
    registers: [registry],
  });
  gaugeFailed = new Gauge({
    name: 'aisandbox_queue_failed_jobs',
    help: 'Number of failed jobs in the queue',
    registers: [registry],
  });
  gaugesInitialized = true;
}

function ensureHistogram(): void {
  if (histogramInitialized) return;
  const registry = getMetricsRegistry();
  histogramLag = new Histogram({
    name: 'aisandbox_queue_lag_seconds',
    help: 'Time from job enqueue to worker claim in seconds',
    buckets: LAG_BUCKETS,
    registers: [registry],
  });
  histogramInitialized = true;
}

export interface QueueDepthCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

/**
 * Update queue depth gauges from getJobCounts() result.
 */
export function updateQueueDepth(counts: QueueDepthCounts): void {
  try {
    ensureGauges();
    gaugeWaiting.set(counts.waiting ?? 0);
    gaugeActive.set(counts.active ?? 0);
    gaugeCompleted.set(counts.completed ?? 0);
    gaugeFailed.set(counts.failed ?? 0);
  } catch {
    /* Metrics failures must never affect execution */
  }
}

/**
 * Record queue lag when worker claims a job (enqueue time → start time).
 */
export function observeQueueLag(seconds: number): void {
  try {
    ensureHistogram();
    histogramLag.observe(seconds);
  } catch {
    /* Metrics failures must never affect execution */
  }
}
