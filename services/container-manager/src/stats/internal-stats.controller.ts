import { Controller, Get, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';

/**
 * InternalStatsController
 * 
 * PHASE-41A: Internal stats endpoint for api-gateway
 * Provides minimal container runtime statistics
 * 
 * Endpoint: GET /api/internal/stats
 * 
 * Returns:
 * - dockerConnectivity: Docker daemon connectivity status
 * - runningContainerCount: Number of running Docker containers
 * - timestamp: Current timestamp (ISO 8601)
 */
@Controller('internal/stats')
@UseGuards(InternalServiceAuthGuard)
export class InternalStatsController {
  constructor(private readonly statsService: StatsService) {}

  /**
   * Get container runtime statistics
   * Internal endpoint called by api-gateway for metrics
   */
  @Get()
  async getStats() {
    return await this.statsService.getStats();
  }
}
