import { Injectable } from '@nestjs/common';
import { DockerRuntimeService } from '../docker/docker-runtime.service';

/**
 * StatsService
 * 
 * PHASE-41A: Container runtime statistics
 * Provides minimal stats for api-gateway metrics endpoint
 * 
 * Scope:
 * - Docker connectivity check
 * - Running container count
 * 
 * Non-Goals:
 * - No external monitoring systems
 * - No background workers
 * - No performance optimization
 */
@Injectable()
export class StatsService {
  constructor(private readonly dockerRuntimeService: DockerRuntimeService) {}

  /**
   * Get container runtime statistics
   * Returns Docker connectivity status and running container count
   */
  async getStats(): Promise<ContainerStats> {
    try {
      // Check Docker connectivity by pinging Docker daemon
      const dockerConnectivity = await this.checkDockerConnectivity();

      // Get running container count
      const runningContainerCount = dockerConnectivity
        ? await this.getRunningContainerCount()
        : 0;

      return {
        dockerConnectivity,
        runningContainerCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // If any error occurs, return safe defaults
      return {
        dockerConnectivity: false,
        runningContainerCount: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check Docker daemon connectivity
   * Returns true if Docker is reachable, false otherwise
   */
  private async checkDockerConnectivity(): Promise<boolean> {
    try {
      await this.dockerRuntimeService.pingDocker();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get count of running containers
   * Returns number of containers in running state
   */
  private async getRunningContainerCount(): Promise<number> {
    try {
      const containers =
        await this.dockerRuntimeService.listRunningContainers();
      return containers.length;
    } catch (error) {
      return 0;
    }
  }
}

/**
 * ContainerStats interface
 * Deterministic JSON structure for container statistics
 */
export interface ContainerStats {
  dockerConnectivity: boolean;
  runningContainerCount: number;
  timestamp: string;
}
