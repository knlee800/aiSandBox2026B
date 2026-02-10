/**
 * Billing Visibility Module
 *
 * Phase 24B: Billing Visibility (Read-Only)
 *
 * Provides read-only access to billing snapshots for cost transparency,
 * debugging, and future UI dashboards.
 *
 * LOCKED INVARIANTS:
 * - Read-only (NO writes to billing_snapshots or usage_records)
 * - Authentication required (ApiKeyAuthGuard)
 * - Authorization enforced (users see only their own snapshots)
 * - Privacy preserved (NO prompt/response content)
 * - Execution isolation (visibility failures NEVER affect execution)
 *
 * Exports:
 * - BillingVisibilityModule (NestJS module)
 * - BillingVisibilityService (query service)
 * - BillingVisibilityController (REST endpoints)
 * - DTOs (read models)
 */

export { BillingVisibilityModule } from './billing-visibility.module';
export { BillingVisibilityService } from './billing-visibility.service';
export { BillingVisibilityController } from './billing-visibility.controller';
export * from './dto';
