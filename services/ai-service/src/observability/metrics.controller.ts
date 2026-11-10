import { Controller, Get, Header } from '@nestjs/common';
import { getMetricsRegistry } from './metrics.registry';
import { InternalKeyExempt } from '../guards/internal-key-exempt.decorator';

const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

/**
 * Phase-52A: Prometheus metrics endpoint.
 *
 * GET /metrics — returns Prometheus text exposition format.
 * Non-blocking: failures never affect execution logic.
 * AI-SERVICE-AUTH-01: open without the internal key (aggregate counters,
 * loopback-only bind; the watchdog and Prometheus send no key).
 */
@Controller()
export class PrometheusMetricsController {
  @Get('metrics')
  @InternalKeyExempt()
  @Header('Content-Type', PROMETHEUS_CONTENT_TYPE)
  async getMetrics(): Promise<string> {
    try {
      const registry = getMetricsRegistry();
      return await registry.metrics();
    } catch {
      // Metrics failures must never affect the service.
      return '';
    }
  }
}
