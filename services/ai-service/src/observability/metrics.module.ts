import { Module } from '@nestjs/common';
import { PrometheusMetricsController } from './metrics.controller';

/**
 * Phase-52A: Observability module.
 *
 * Provides Prometheus metrics foundation.
 * No execution instrumentation in this stage.
 */
@Module({
  controllers: [PrometheusMetricsController],
})
export class ObservabilityModule {}
