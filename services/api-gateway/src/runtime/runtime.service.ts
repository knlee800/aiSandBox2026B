import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SessionStatus } from '../entities/session-status.enum';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';

/**
 * RuntimeService
 * 
 * PHASE-41A: Runtime metrics and observability
 * Provides diagnostic visibility into session and container runtime state
 * 
 * Scope:
 * - Session statistics (active, terminated counts)
 * - Container statistics (running count via Docker connectivity)
 * - Health diagnostics (database + Docker connectivity)
 * 
 * Non-Goals:
 * - No external monitoring systems
 * - No background workers
 * - No performance optimization
 */
@Injectable()
export class RuntimeService {
  private startTime: Date;

  constructor(
    private readonly dataSource: DataSource,
    private readonly containerManagerClient: ContainerManagerHttpClient,
  ) {
    this.startTime = new Date();
  }

  /**
   * Get runtime metrics for diagnostic visibility
   * Returns deterministic JSON with session and container statistics
   */
  async getMetrics(): Promise<RuntimeMetrics> {
    // Query session statistics from database
    const sessionStats = await this.getSessionStatistics();

    // Check database connectivity
    const dbConnectivity = await this.checkDatabaseConnectivity();

    // Calculate service uptime
    const uptimeSeconds = Math.floor(
      (Date.now() - this.startTime.getTime()) / 1000,
    );

    // Get Docker connectivity and container count from container-manager
    const containerStats = await this.getContainerStats();
    const dockerConnectivity = containerStats.dockerConnectivity;
    const runningContainerCount = containerStats.runningContainerCount;

    return {
      activeSessionCount: sessionStats.activeCount,
      runningContainerCount,
      terminatedSessionCount: sessionStats.terminatedCount,
      terminationReasons: sessionStats.terminationReasons,
      serviceUptimeSeconds: uptimeSeconds,
      dockerConnectivity,
      databaseConnectivity: dbConnectivity,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get session statistics from database
   * Counts active sessions and terminated sessions grouped by reason
   */
  private async getSessionStatistics(): Promise<{
    activeCount: number;
    terminatedCount: number;
    terminationReasons: Array<{ reason: string; count: number }>;
  }> {
    try {
      // Count active sessions (ACTIVE or PENDING status)
      const activeCountResult = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM sessions 
         WHERE status IN ($1, $2) AND terminated_at IS NULL`,
        [SessionStatus.ACTIVE, SessionStatus.PENDING],
      );
      const activeCount = parseInt(activeCountResult[0]?.count || '0', 10);

      // Count terminated sessions
      const terminatedCountResult = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM sessions WHERE terminated_at IS NOT NULL`,
      );
      const terminatedCount = parseInt(
        terminatedCountResult[0]?.count || '0',
        10,
      );

      // Get termination reasons breakdown
      const terminationReasonsResult = await this.dataSource.query(
        `SELECT termination_reason as reason, COUNT(*) as count 
         FROM sessions 
         WHERE terminated_at IS NOT NULL AND termination_reason IS NOT NULL
         GROUP BY termination_reason
         ORDER BY count DESC`,
      );

      const terminationReasons = terminationReasonsResult.map((row: any) => ({
        reason: row.reason,
        count: parseInt(row.count, 10),
      }));

      return {
        activeCount,
        terminatedCount,
        terminationReasons,
      };
    } catch (error) {
      // If query fails, return zeros
      console.error('Failed to get session statistics:', error);
      return {
        activeCount: 0,
        terminatedCount: 0,
        terminationReasons: [],
      };
    }
  }

  /**
   * Check database connectivity
   * Returns true if database is reachable, false otherwise
   */
  private async checkDatabaseConnectivity(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get container statistics from container-manager
   * Returns Docker connectivity and running container count
   */
  private async getContainerStats(): Promise<{
    dockerConnectivity: boolean;
    runningContainerCount: number;
  }> {
    try {
      const stats = await this.containerManagerClient.getContainerStats();
      return {
        dockerConnectivity: stats.dockerConnectivity,
        runningContainerCount: stats.runningContainerCount,
      };
    } catch (error) {
      // If container-manager is unreachable, return safe defaults
      console.error('Failed to get container stats:', error);
      return {
        dockerConnectivity: false,
        runningContainerCount: 0,
      };
    }
  }
}

/**
 * RuntimeMetrics interface
 * Deterministic JSON structure for runtime metrics endpoint
 */
export interface RuntimeMetrics {
  activeSessionCount: number;
  runningContainerCount: number;
  terminatedSessionCount: number;
  terminationReasons: Array<{ reason: string; count: number }>;
  serviceUptimeSeconds: number;
  dockerConnectivity: boolean;
  databaseConnectivity: boolean;
  timestamp: string;
}
