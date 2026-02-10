import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageRecord } from '../entities/usage-record.entity';
import { UsageLedgerService } from './usage-ledger.service';

/**
 * UsageLedgerModule
 *
 * Phase 22B: Usage Ledger Module
 *
 * Provides usage ledger write functionality:
 * - UsageRecord entity (TypeORM)
 * - UsageLedgerService (write service)
 *
 * Exports:
 * - UsageLedgerService: For use in AIExecutionController
 *
 * IMPORTANT:
 * - Write-only module (no read/query services in Phase 22B)
 * - No billing, analytics, or aggregation logic
 * - Records written synchronously after successful execution
 */
@Module({
  imports: [TypeOrmModule.forFeature([UsageRecord])],
  providers: [UsageLedgerService],
  exports: [UsageLedgerService],
})
export class UsageLedgerModule {}
