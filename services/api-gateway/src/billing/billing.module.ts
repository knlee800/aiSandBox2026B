import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingSnapshot, UsageRecord } from '../entities';
import { BillingSnapshotService } from './billing-snapshot.service';

/**
 * BillingModule
 *
 * Phase 23B-4: Billing Snapshot Writer
 *
 * Provides write-only billing snapshot creation service.
 * Visibility queries (read-only) are in Phase 24B.
 */
@Module({
  imports: [TypeOrmModule.forFeature([BillingSnapshot, UsageRecord])],
  providers: [BillingSnapshotService],
  exports: [BillingSnapshotService],
})
export class BillingModule {}
