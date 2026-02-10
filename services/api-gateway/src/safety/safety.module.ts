import { Module } from '@nestjs/common';
import { GlobalSafetyLimitService } from './global-safety-limit.service';
import { ExecutionSafetyGuard } from './execution-safety.guard';
import { AuditLogService } from './audit-log.service';

/**
 * Safety Module
 *
 * Provides production readiness controls:
 * - Kill switches (centralized emergency controls)
 * - Global safety limits (platform-wide caps)
 * - Execution safety guard (pre-execution enforcement)
 * - Audit logging (operational actions)
 *
 * Phase 26B: Production Readiness
 */

@Module({
  providers: [
    GlobalSafetyLimitService,
    ExecutionSafetyGuard,
    AuditLogService,
  ],
  exports: [
    GlobalSafetyLimitService,
    ExecutionSafetyGuard,
    AuditLogService,
  ],
})
export class SafetyModule {}
