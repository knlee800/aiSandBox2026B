import { Counter } from 'prom-client';
import { getMetricsRegistry } from './metrics.registry';

/**
 * Phase-52E: Worker observability Prometheus counters.
 *
 * Passive instrumentation only. Metrics failures must never affect execution.
 * All inc() calls are wrapped in try/catch.
 */

let countersInitialized = false;
let counterClaim: Counter<string>;
let counterStuckRecovered: Counter<string>;

function ensureCounters(): void {
  if (countersInitialized) return;
  const registry = getMetricsRegistry();
  counterClaim = new Counter({
    name: 'aisandbox_worker_claim_total',
    help: 'Total number of executions successfully claimed by a worker',
    registers: [registry],
  });
  counterStuckRecovered = new Counter({
    name: 'aisandbox_worker_stuck_recovered_total',
    help: 'Total number of stuck executions recovered by watchdog or stalled recovery',
    registers: [registry],
  });
  countersInitialized = true;
}

export function incrementWorkerClaim(): void {
  try {
    ensureCounters();
    counterClaim.inc();
  } catch {
    /* Metrics failures must never affect execution */
  }
}

export function incrementStuckRecovered(): void {
  try {
    ensureCounters();
    counterStuckRecovered.inc();
  } catch {
    /* Metrics failures must never affect execution */
  }
}
