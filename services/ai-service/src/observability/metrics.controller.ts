import { Controller, Get, Header } from '@nestjs/common';
import { getMetricsRegistry } from './metrics.registry';

const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

/**
 * Phase-52A: Prometheus metrics endpoint.
 *
 * GET /metrics — returns Prometheus text exposition format.
 * Non-blocking: failures never affect execution logic.
 */
@Controller()
export class PrometheusMetricsController {
  @Get('metrics')
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
