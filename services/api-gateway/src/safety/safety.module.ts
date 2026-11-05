import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditDeductionRecord } from '../entities/credit-deduction-record.entity';
import { GlobalSafetyLimitService } from './global-safety-limit.service';
import { DailyCreditCapService } from './daily-credit-cap.service';
import { ExecutionSafetyGuard } from './execution-safety.guard';
import { AuditLogService } from './audit-log.service';

/**
 * Safety Module
 *
 * Provides production readiness controls:
 * - Kill switches (centralized emergency controls)
 * - Global safety limits (platform-wide caps)
 * - Daily credit caps counted from the credit ledger
 * - Execution safety guard (pre-execution enforcement)
 * - Audit logging (operational actions)
 *
 * Phase 26B: Production Readiness
 */

@Module({
  imports: [TypeOrmModule.forFeature([CreditDeductionRecord])],
  providers: [
    GlobalSafetyLimitService,
    DailyCreditCapService,
    ExecutionSafetyGuard,
    AuditLogService,
  ],
  exports: [
    GlobalSafetyLimitService,
    DailyCreditCapService,
    ExecutionSafetyGuard,
    AuditLogService,
  ],
})
export class SafetyModule {}
