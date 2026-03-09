import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingSnapshot } from '../entities/billing-snapshot.entity';
import { UsageRecord } from '../entities';
import { BillingVisibilityService } from './billing-visibility.service';
import { BillingVisibilityController } from './billing-visibility.controller';
import { EfficiencySummaryService } from './efficiency-summary.service';
import { AuthModule } from '../auth/auth.module';

/**
 * BillingVisibilityModule
 *
 * Phase 24B: Billing Visibility (Read-Only)
 * Phase 59B: Cost Monitoring & Resource Efficiency
 *
 * Provides read-only access to billing snapshots and efficiency metrics.
 *
 * LOCKED INVARIANTS:
 * - Read-only (NO writes to billing_snapshots or usage_records)
 * - Authentication required (ApiKeyAuthGuard)
 * - Authorization enforced (users see only their own data)
 * - Privacy preserved (NO prompt/response content)
 * - Execution isolation (visibility failures NEVER affect execution)
 *
 * Exposes:
 * - GET /api/billing/snapshots, /snapshots/:id, /snapshots/:id/breakdown
 * - GET /api/billing/summary, /snapshots/:id/metadata
 * - GET /api/billing/efficiency-summary (Phase 59B)
 * - GET /api/billing/provider-trends (Phase 59B)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([BillingSnapshot, UsageRecord]),
    AuthModule,
  ],
  providers: [BillingVisibilityService, EfficiencySummaryService],
  controllers: [BillingVisibilityController],
  exports: [BillingVisibilityService, EfficiencySummaryService],
})
export class BillingVisibilityModule {}
