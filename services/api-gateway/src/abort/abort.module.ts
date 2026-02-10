import { Module } from '@nestjs/common';
import { AbortGuard } from './abort.guard';

/**
 * Abort Module
 *
 * Phase 28B-2: Abort & Rollback Controls
 *
 * Provides abort mode enforcement components.
 * AbortGuard enforces abort mode restrictions on AI execution.
 *
 * Configuration initialized during startup (ConfigurationValidator).
 */
@Module({
  providers: [AbortGuard],
  exports: [AbortGuard],
})
export class AbortModule {}
