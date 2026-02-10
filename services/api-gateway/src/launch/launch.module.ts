import { Module } from '@nestjs/common';
import { LaunchGuard } from './launch.guard';

/**
 * Launch Module
 *
 * Phase 28B-1: Launch Readiness Implementation
 *
 * Provides launch state enforcement components.
 * LaunchGuard enforces launch state restrictions on AI execution.
 *
 * Configuration initialized during startup (ConfigurationValidator).
 */
@Module({
  providers: [LaunchGuard],
  exports: [LaunchGuard],
})
export class LaunchModule {}
