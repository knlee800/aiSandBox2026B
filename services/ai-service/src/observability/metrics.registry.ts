import { Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Phase-52A: Prometheus metrics registry.
 *
 * Singleton registry for ai-service observability.
 * Safe for reuse by future stages.
 * Enables default Node.js metrics (CPU, memory, event loop, etc.).
 */
let registryInstance: Registry | null = null;

export function getMetricsRegistry(): Registry {
  if (!registryInstance) {
    registryInstance = new Registry();
    collectDefaultMetrics({ register: registryInstance });
  }
  return registryInstance;
}
