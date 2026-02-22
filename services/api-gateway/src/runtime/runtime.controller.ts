import { Controller, Get } from '@nestjs/common';
import { RuntimeService } from './runtime.service';

/**
 * RuntimeController
 * 
 * PHASE-41A: Runtime metrics endpoint
 * Provides diagnostic visibility into session and container runtime state
 * 
 * Endpoint: GET /api/runtime/metrics
 * 
 * Returns:
 * - activeSessionCount: Number of active sessions (ACTIVE or PENDING)
 * - runningContainerCount: Number of running Docker containers
 * - terminatedSessionCount: Number of terminated sessions
 * - terminationReasons: Breakdown of termination reasons
 * - serviceUptimeSeconds: Service uptime in seconds
 * - dockerConnectivity: Docker daemon connectivity status
 * - databaseConnectivity: Database connectivity status
 * - timestamp: Current timestamp (ISO 8601)
 */
@Controller('runtime')
export class RuntimeController {
  constructor(private readonly runtimeService: RuntimeService) {}

  /**
   * Get runtime metrics
   * Returns deterministic JSON with session and container statistics
   */
  @Get('metrics')
  async getMetrics() {
    return await this.runtimeService.getMetrics();
  }
}
