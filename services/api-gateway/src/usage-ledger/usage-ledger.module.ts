import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageRecord } from '../entities/usage-record.entity';
import { UsageLedgerService } from './usage-ledger.service';
import { OrphanReconciliationWorker } from './orphan-reconciliation.worker';
import { CreditDeductionModule } from '../billing/credit-deduction';

/**
 * UsageLedgerModule
 *
 * Phase 22B: Usage Ledger Module
 * Phase 43C-2: Orphan Reconciliation Worker
 * BILLING-READY-02B: Credit Deduction Gateway wiring
 *
 * Provides usage ledger write functionality:
 * - UsageRecord entity (TypeORM)
 * - UsageLedgerService (write service)
 * - OrphanReconciliationWorker (background cleanup)
 * - CreditDeductionGateway (injected via CreditDeductionModule)
 *
 * Exports:
 * - UsageLedgerService: For use in AIExecutionController
 *
 * IMPORTANT:
 * - Write-only module (no read/query services in Phase 22B)
 * - No billing, analytics, or aggregation logic
 * - Records written synchronously after successful execution
 * - OrphanReconciliationWorker runs in background (Phase 43C-2)
 * - CreditDeductionGateway bound to NoOp by default (BILLING-READY-02B)
 */
@Module({
  imports: [TypeOrmModule.forFeature([UsageRecord]), CreditDeductionModule],
  providers: [UsageLedgerService, OrphanReconciliationWorker],
  exports: [UsageLedgerService],
})
export class UsageLedgerModule {}
