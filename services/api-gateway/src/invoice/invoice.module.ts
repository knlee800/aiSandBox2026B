import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../entities/invoice.entity';
import { BillingSnapshot } from '../entities/billing-snapshot.entity';
import { InvoiceService } from './invoice.service';

/**
 * InvoiceModule
 *
 * Phase 25B-1: Invoice Persistence Infrastructure
 *
 * Provides invoice creation from billing snapshots (write-once, derived data only).
 *
 * LOCKED INVARIANTS:
 * - No controllers (internal-only, no API endpoints in Phase 25B-1)
 * - No exports to execution flow (execution remains payment-unaware)
 * - No payment logic (Phase 25B-2+)
 * - No retries, no async jobs, no scheduling
 *
 * Exports:
 * - InvoiceService (for future internal use in Phase 25B-2+)
 *
 * Dependencies:
 * - Invoice entity (TypeORM)
 * - BillingSnapshot entity (read-only access)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, BillingSnapshot]),
  ],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
