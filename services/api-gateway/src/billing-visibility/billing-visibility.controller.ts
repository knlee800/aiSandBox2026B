import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { BillingVisibilityService } from './billing-visibility.service';
import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { AuthorizationGuard } from '../auth/authorization.guard';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import { ApiKeyIdentity } from '../auth/api-key.config';
import {
  BillingSnapshotSummary,
  CostBreakdown,
  TimeWindowCostSummary,
  SnapshotMetadata,
} from './dto';

/**
 * BillingVisibilityController
 *
 * Phase 24B: Billing Visibility (Read-Only)
 *
 * Exposes GET-only endpoints under /api/billing/* for querying
 * immutable billing snapshots (Phase 23).
 *
 * LOCKED INVARIANTS:
 * - Read-only (NO POST/PUT/DELETE endpoints)
 * - Authentication required (ApiKeyAuthGuard)
 * - Authorization enforced (users see only their own snapshots)
 * - NO billing calculations (Phase 23 responsibility)
 * - NO snapshot creation (Phase 23 responsibility)
 * - Privacy preserved (NO prompt/response content)
 * - Execution isolation (visibility failures NEVER affect execution)
 *
 * Routes: /api/billing/* (global prefix 'api' applied in main.ts)
 */
@Controller('billing')
@UseGuards(ApiKeyAuthGuard, AuthorizationGuard)
export class BillingVisibilityController {
  constructor(
    private readonly billingVisibilityService: BillingVisibilityService,
  ) {}

  /**
   * List billing snapshots
   *
   * GET /api/billing/snapshots?periodStart=2026-02-01&periodEnd=2026-02-28
   *
   * Query Parameters:
   * - periodStart (optional): Filter snapshots with periodStart >= start
   * - periodEnd (optional): Filter snapshots with periodEnd <= end
   *
   * Returns array of BillingSnapshotSummary (empty if no snapshots found)
   * Ordered by periodStart DESC (most recent first)
   * Filtered by authenticated user's apiKeyId (no cross-key access)
   *
   * @param identity - Authenticated user identity
   * @param periodStart - Optional time window start (ISO 8601 date string)
   * @param periodEnd - Optional time window end (ISO 8601 date string)
   * @returns BillingSnapshotSummary[]
   */
  @Get('snapshots')
  @HttpCode(HttpStatus.OK)
  async listSnapshots(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
  ): Promise<{ snapshots: BillingSnapshotSummary[] }> {
    // Parse optional date parameters
    const parsedPeriodStart = periodStart ? new Date(periodStart) : undefined;
    const parsedPeriodEnd = periodEnd ? new Date(periodEnd) : undefined;

    // Validate date parsing
    if (periodStart && isNaN(parsedPeriodStart.getTime())) {
      throw new BadRequestException('Invalid periodStart date format');
    }
    if (periodEnd && isNaN(parsedPeriodEnd.getTime())) {
      throw new BadRequestException('Invalid periodEnd date format');
    }

    const snapshots = await this.billingVisibilityService.listSnapshots(
      identity.apiKeyId,
      parsedPeriodStart,
      parsedPeriodEnd,
    );

    return { snapshots };
  }

  /**
   * Get single billing snapshot
   *
   * GET /api/billing/snapshots/:snapshotId
   *
   * Returns BillingSnapshotSummary for single snapshot
   * Throws 404 if snapshotId not found
   * Throws 403 if apiKeyId doesn't match authenticated user
   *
   * @param snapshotId - UUID of snapshot
   * @param identity - Authenticated user identity
   * @returns BillingSnapshotSummary
   */
  @Get('snapshots/:snapshotId')
  @HttpCode(HttpStatus.OK)
  async getSnapshot(
    @Param('snapshotId', ParseUUIDPipe) snapshotId: string,
    @AuthenticatedUser() identity: ApiKeyIdentity,
  ): Promise<BillingSnapshotSummary> {
    return this.billingVisibilityService.getSnapshot(
      snapshotId,
      identity.apiKeyId,
    );
  }

  /**
   * Get cost breakdown for snapshot
   *
   * GET /api/billing/snapshots/:snapshotId/breakdown
   *
   * Returns CostBreakdown with line items (by provider/model) and summary
   * Line items ordered by costUSD DESC (most expensive first)
   * Throws 404 if snapshotId not found
   * Throws 403 if apiKeyId doesn't match authenticated user
   *
   * @param snapshotId - UUID of snapshot
   * @param identity - Authenticated user identity
   * @returns CostBreakdown
   */
  @Get('snapshots/:snapshotId/breakdown')
  @HttpCode(HttpStatus.OK)
  async getBreakdown(
    @Param('snapshotId', ParseUUIDPipe) snapshotId: string,
    @AuthenticatedUser() identity: ApiKeyIdentity,
  ): Promise<CostBreakdown> {
    return this.billingVisibilityService.getBreakdown(
      snapshotId,
      identity.apiKeyId,
    );
  }

  /**
   * Get time window cost summary
   *
   * GET /api/billing/summary?periodStart=2026-02-01&periodEnd=2026-02-28
   *
   * Query Parameters:
   * - periodStart (required): Window start (UTC, inclusive)
   * - periodEnd (required): Window end (UTC, inclusive)
   *
   * Returns TimeWindowCostSummary with aggregated costs across all snapshots
   * in time window. Zero totals if no snapshots found (not an error).
   * Filtered by authenticated user's apiKeyId.
   *
   * @param identity - Authenticated user identity
   * @param periodStart - Window start (ISO 8601 date string, required)
   * @param periodEnd - Window end (ISO 8601 date string, required)
   * @returns TimeWindowCostSummary
   */
  @Get('summary')
  @HttpCode(HttpStatus.OK)
  async getSummary(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ): Promise<TimeWindowCostSummary> {
    // Validate required parameters
    if (!periodStart || !periodEnd) {
      throw new BadRequestException(
        'periodStart and periodEnd are required',
      );
    }

    // Parse dates
    const parsedPeriodStart = new Date(periodStart);
    const parsedPeriodEnd = new Date(periodEnd);

    // Validate date parsing
    if (isNaN(parsedPeriodStart.getTime())) {
      throw new BadRequestException('Invalid periodStart date format');
    }
    if (isNaN(parsedPeriodEnd.getTime())) {
      throw new BadRequestException('Invalid periodEnd date format');
    }

    return this.billingVisibilityService.getTimeWindowSummary(
      identity.apiKeyId,
      parsedPeriodStart,
      parsedPeriodEnd,
    );
  }

  /**
   * Get snapshot metadata
   *
   * GET /api/billing/snapshots/:snapshotId/metadata
   *
   * Returns SnapshotMetadata (audit trail info, no cost data)
   * Throws 404 if snapshotId not found
   * Throws 403 if apiKeyId doesn't match authenticated user
   *
   * @param snapshotId - UUID of snapshot
   * @param identity - Authenticated user identity
   * @returns SnapshotMetadata
   */
  @Get('snapshots/:snapshotId/metadata')
  @HttpCode(HttpStatus.OK)
  async getMetadata(
    @Param('snapshotId', ParseUUIDPipe) snapshotId: string,
    @AuthenticatedUser() identity: ApiKeyIdentity,
  ): Promise<SnapshotMetadata> {
    return this.billingVisibilityService.getMetadata(
      snapshotId,
      identity.apiKeyId,
    );
  }
}
