import { Controller, Get, HttpStatus, HttpException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EnvironmentValidator } from '../startup/environment.validator';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { GlobalSafetyLimits } from '../safety/global-safety-limits.config';

/**
 * Health Controller
 *
 * Phase 27B: Enhanced with readiness checks for deployment verification
 */

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
      version: '0.1.0',
    };
  }

  @Get('db')
  async checkDatabase() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          database: 'disconnected',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Readiness check for deployment verification
   *
   * Phase 27B: Verifies all startup checks passed
   *
   * Returns 200 if service ready to serve traffic
   * Returns 503 if service not ready
   */
  @Get('ready')
  async checkReadiness() {
    try {
      // Check 1: Environment validated
      const environment = EnvironmentValidator.validateEnvironment();

      // Check 2: Database connected
      await this.dataSource.query('SELECT 1');

      // Check 3: Kill switches loaded
      const killSwitches = KillSwitchConfig.getKillSwitchStates();

      // Check 4: Safety limits loaded
      const safetyLimits = GlobalSafetyLimits.getSafetyLimitValues();

      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        environment,
        checks: {
          environment: 'validated',
          database: 'connected',
          killSwitches: 'loaded',
          safetyLimits: 'loaded',
        },
        killSwitches: {
          total: Object.keys(killSwitches).length,
          enabled: Object.values(killSwitches).filter((v) => v === true).length,
        },
        safetyLimits: {
          total: Object.keys(safetyLimits).length,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'not_ready',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
