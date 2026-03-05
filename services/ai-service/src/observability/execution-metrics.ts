import { Counter, Histogram } from 'prom-client';
import { getMetricsRegistry } from './metrics.registry';

/**
 * Phase-52B: Execution lifecycle Prometheus counters.
 * Phase-52C: Latency histograms.
 *
 * Passive instrumentation only. Metrics failures must never affect execution.
 * All inc() and observe() calls are wrapped in try/catch.
 */

const LATENCY_BUCKETS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60];

let countersInitialized = false;
let histogramsInitialized = false;
let counterStarted: Counter<string>;
let counterCompleted: Counter<string>;
let counterFailed: Counter<string>;
let counterCancelled: Counter<string>;

function ensureCounters(): void {
  if (countersInitialized) return;
  const registry = getMetricsRegistry();
  counterStarted = new Counter({
    name: 'aisandbox_execution_started_total',
    help: 'Total number of executions that started processing',
    registers: [registry],
  });
  counterCompleted = new Counter({
    name: 'aisandbox_execution_completed_total',
    help: 'Total number of executions that completed successfully',
    registers: [registry],
  });
  counterFailed = new Counter({
    name: 'aisandbox_execution_failed_total',
    help: 'Total number of executions that failed (including timeout and stuck)',
    registers: [registry],
  });
  counterCancelled = new Counter({
    name: 'aisandbox_execution_cancelled_total',
    help: 'Total number of executions that were cancelled',
    registers: [registry],
  });
  countersInitialized = true;
}

let histogramExecutionLatency: Histogram<string>;
let histogramProviderLatency: Histogram<string>;

function ensureHistograms(): void {
  if (histogramsInitialized) return;
  const registry = getMetricsRegistry();
  histogramExecutionLatency = new Histogram({
    name: 'aisandbox_execution_latency_seconds',
    help: 'Total execution runtime in seconds',
    buckets: LATENCY_BUCKETS,
    registers: [registry],
  });
  histogramProviderLatency = new Histogram({
    name: 'aisandbox_provider_latency_seconds',
    help: 'AI provider call duration in seconds',
    buckets: LATENCY_BUCKETS,
    registers: [registry],
  });
  histogramsInitialized = true;
}

export function observeExecutionLatency(seconds: number): void {
  try {
    ensureHistograms();
    histogramExecutionLatency.observe(seconds);
  } catch {
    /* Metrics failures must never affect execution */
  }
}

export function observeProviderLatency(seconds: number): void {
  try {
    ensureHistograms();
    histogramProviderLatency.observe(seconds);
  } catch {
    /* Metrics failures must never affect execution */
  }
}

export function incExecutionStarted(): void {
  try {
    ensureCounters();
    counterStarted.inc();
  } catch {
    /* Metrics failures must never affect execution */
  }
}

export function incExecutionCompleted(): void {
  try {
    ensureCounters();
    counterCompleted.inc();
  } catch {
    /* Metrics failures must never affect execution */
  }
}

export function incExecutionFailed(): void {
  try {
    ensureCounters();
    counterFailed.inc();
  } catch {
    /* Metrics failures must never affect execution */
  }
}

export function incExecutionCancelled(): void {
  try {
    ensureCounters();
    counterCancelled.inc();
  } catch {
    /* Metrics failures must never affect execution */
  }
}
