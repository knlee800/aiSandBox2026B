import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingSnapshot } from '../entities/billing-snapshot.entity';
import { BillingVisibilityService } from './billing-visibility.service';
import { BillingVisibilityController } from './billing-visibility.controller';

/**
 * BillingVisibilityModule
 *
 * Phase 24B: Billing Visibility (Read-Only)
 *
 * Provides read-only access to billing snapshots via REST API.
 * Enables cost transparency, debugging, and future UI dashboards.
 *
 * LOCKED INVARIANTS:
 * - Read-only (NO writes to billing_snapshots or usage_records)
 * - Authentication required (ApiKeyAuthGuard)
 * - Authorization enforced (users see only their own snapshots)
 * - Privacy preserved (NO prompt/response content)
 * - Execution isolation (visibility failures NEVER affect execution)
 *
 * Exports:
 * - BillingVisibilityService (for potential internal use)
 *
 * Exposes:
 * - GET /api/billing/snapshots (list snapshots)
 * - GET /api/billing/snapshots/:snapshotId (get single snapshot)
 * - GET /api/billing/snapshots/:snapshotId/breakdown (get cost breakdown)
 * - GET /api/billing/summary (get time window summary)
 * - GET /api/billing/snapshots/:snapshotId/metadata (get metadata)
 */
@Module({
  imports: [TypeOrmModule.forFeature([BillingSnapshot])],
  providers: [BillingVisibilityService],
  controllers: [BillingVisibilityController],
  exports: [BillingVisibilityService],
})
export class BillingVisibilityModule {}
