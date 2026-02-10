import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingSnapshot } from '../entities/billing-snapshot.entity';
import {
  BillingSnapshotSummary,
  CostBreakdown,
  TimeWindowCostSummary,
  SnapshotMetadata,
  CostLineItem,
  CostSummary,
  ProviderCostSummary,
} from './dto';

/**
 * BillingVisibilityService
 *
 * Phase 24B: Billing Visibility (Read-Only)
 *
 * Provides read-only access to billing snapshots for cost transparency,
 * debugging, and future UI dashboards.
 *
 * LOCKED INVARIANTS:
 * - Read-only (NO writes to billing_snapshots or usage_records)
 * - Access control (users see only their own snapshots)
 * - Throw-only errors (NO partial responses)
 * - Privacy preserved (NO prompt/response content)
 * - Execution isolation (visibility failures NEVER affect execution)
 *
 * IMPORTANT:
 * - This service does NOT calculate costs (Phase 23 responsibility)
 * - This service does NOT create snapshots (Phase 23 responsibility)
 * - This service does NOT modify snapshots (immutable after creation)
 * - This service queries committed snapshots only
 */
@Injectable()
export class BillingVisibilityService {
  constructor(
    @InjectRepository(BillingSnapshot)
    private readonly billingSnapshotRepository: Repository<BillingSnapshot>,
  ) {}

  /**
   * List snapshots for apiKeyId with optional time window filter
   *
   * @param apiKeyId - Filter by API key
   * @param periodStart - Optional: Filter snapshots with periodStart >= start
   * @param periodEnd - Optional: Filter snapshots with periodEnd <= end
   * @returns Array of BillingSnapshotSummary (empty if no snapshots found)
   *
   * Semantics:
   * - Ordered by periodStart DESC (most recent first)
   * - Empty array if no snapshots found (not an error)
   * - Filtered by caller's apiKeyId (no cross-key access)
   */
  async listSnapshots(
    apiKeyId: string,
    periodStart?: Date,
    periodEnd?: Date,
  ): Promise<BillingSnapshotSummary[]> {
    const queryBuilder = this.billingSnapshotRepository
      .createQueryBuilder('snapshot')
      .where('snapshot.apiKeyId = :apiKeyId', { apiKeyId });

    if (periodStart) {
      queryBuilder.andWhere('snapshot.periodStart >= :periodStart', {
        periodStart,
      });
    }

    if (periodEnd) {
      queryBuilder.andWhere('snapshot.periodEnd <= :periodEnd', { periodEnd });
    }

    const snapshots = await queryBuilder
      .orderBy('snapshot.periodStart', 'DESC')
      .getMany();

    return snapshots.map((snapshot) => this.toSnapshotSummary(snapshot));
  }

  /**
   * Get single snapshot by ID (with access control)
   *
   * @param snapshotId - UUID of snapshot
   * @param apiKeyId - Caller's API key (for access control)
   * @returns BillingSnapshotSummary
   * @throws NotFoundException if snapshotId not found
   * @throws ForbiddenException if apiKeyId doesn't match caller
   *
   * Semantics:
   * - 404 if snapshotId not found
   * - 403 if snapshotId exists but apiKeyId doesn't match caller
   * - Strong consistency (reads committed data)
   */
  async getSnapshot(
    snapshotId: string,
    apiKeyId: string,
  ): Promise<BillingSnapshotSummary> {
    const snapshot = await this.billingSnapshotRepository.findOne({
      where: { snapshotId },
    });

    if (!snapshot) {
      throw new NotFoundException(
        `Billing snapshot not found: ${snapshotId}`,
      );
    }

    // Access control: users can only see their own snapshots
    if (snapshot.apiKeyId !== apiKeyId) {
      throw new ForbiddenException(
        'Unauthorized access to billing snapshot',
      );
    }

    return this.toSnapshotSummary(snapshot);
  }

  /**
   * Get cost breakdown for snapshot
   *
   * @param snapshotId - UUID of snapshot
   * @param apiKeyId - Caller's API key (for access control)
   * @returns CostBreakdown with line items and summary
   * @throws NotFoundException if snapshotId not found
   * @throws ForbiddenException if apiKeyId doesn't match caller
   *
   * Semantics:
   * - Line items ordered by costUSD DESC (most expensive first)
   * - 404 if snapshotId not found
   * - 403 if apiKeyId doesn't match caller
   */
  async getBreakdown(
    snapshotId: string,
    apiKeyId: string,
  ): Promise<CostBreakdown> {
    const snapshot = await this.billingSnapshotRepository.findOne({
      where: { snapshotId },
    });

    if (!snapshot) {
      throw new NotFoundException(
        `Billing snapshot not found: ${snapshotId}`,
      );
    }

    // Access control: users can only see their own snapshots
    if (snapshot.apiKeyId !== apiKeyId) {
      throw new ForbiddenException(
        'Unauthorized access to billing snapshot',
      );
    }

    // Sort line items by cost DESC (most expensive first)
    const sortedLineItems = [...snapshot.lineItems].sort(
      (a, b) => b.costUSD - a.costUSD,
    );

    const breakdown: CostBreakdown = {
      snapshotId: snapshot.snapshotId,
      lineItems: sortedLineItems as CostLineItem[],
      summary: {
        totalTokens: snapshot.totalTokens,
        totalRequests: snapshot.totalRequests,
        subtotal: Number(snapshot.subtotalUSD),
        adjustments: Number(snapshot.adjustmentsUSD),
        total: Number(snapshot.totalCostUSD),
      },
    };

    return breakdown;
  }

  /**
   * Get aggregated costs for time window
   *
   * @param apiKeyId - Filter by API key
   * @param periodStart - Window start (UTC, inclusive)
   * @param periodEnd - Window end (UTC, inclusive)
   * @returns TimeWindowCostSummary with aggregated costs
   *
   * Semantics:
   * - Aggregates all snapshots in time window
   * - Zero totals if no snapshots found (not an error)
   * - Window boundaries are inclusive
   * - Filtered by caller's apiKeyId
   */
  async getTimeWindowSummary(
    apiKeyId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<TimeWindowCostSummary> {
    const snapshots = await this.billingSnapshotRepository
      .createQueryBuilder('snapshot')
      .where('snapshot.apiKeyId = :apiKeyId', { apiKeyId })
      .andWhere('snapshot.periodStart >= :periodStart', { periodStart })
      .andWhere('snapshot.periodEnd <= :periodEnd', { periodEnd })
      .getMany();

    // Aggregate totals
    let totalCostUSD = 0;
    let totalTokens = 0;
    let totalRequests = 0;
    const providerMap = new Map<string, ProviderCostSummary>();

    for (const snapshot of snapshots) {
      totalCostUSD += Number(snapshot.totalCostUSD);
      totalTokens += snapshot.totalTokens;
      totalRequests += snapshot.totalRequests;

      // Aggregate by provider
      for (const lineItem of snapshot.lineItems) {
        const existing = providerMap.get(lineItem.provider);
        if (existing) {
          existing.totalCostUSD += lineItem.costUSD;
          existing.totalTokens += lineItem.totalTokens;
          existing.totalRequests += lineItem.totalRequests;
        } else {
          providerMap.set(lineItem.provider, {
            provider: lineItem.provider,
            totalCostUSD: lineItem.costUSD,
            totalTokens: lineItem.totalTokens,
            totalRequests: lineItem.totalRequests,
          });
        }
      }
    }

    const byProvider = Array.from(providerMap.values());

    return {
      apiKeyId,
      periodStart,
      periodEnd,
      totalCostUSD,
      totalTokens,
      totalRequests,
      snapshotCount: snapshots.length,
      byProvider,
    };
  }

  /**
   * Get snapshot metadata (audit trail)
   *
   * @param snapshotId - UUID of snapshot
   * @param apiKeyId - Caller's API key (for access control)
   * @returns SnapshotMetadata (no cost data, metadata only)
   * @throws NotFoundException if snapshotId not found
   * @throws ForbiddenException if apiKeyId doesn't match caller
   *
   * Semantics:
   * - Returns metadata only (no cost data)
   * - 404 if snapshotId not found
   * - 403 if apiKeyId doesn't match caller
   */
  async getMetadata(
    snapshotId: string,
    apiKeyId: string,
  ): Promise<SnapshotMetadata> {
    const snapshot = await this.billingSnapshotRepository.findOne({
      where: { snapshotId },
    });

    if (!snapshot) {
      throw new NotFoundException(
        `Billing snapshot not found: ${snapshotId}`,
      );
    }

    // Access control: users can only see their own snapshots
    if (snapshot.apiKeyId !== apiKeyId) {
      throw new ForbiddenException(
        'Unauthorized access to billing snapshot',
      );
    }

    // Calculate usage record count from line items
    const usageRecordCount = snapshot.lineItems.reduce(
      (sum, item) => sum + item.totalRequests,
      0,
    );

    return {
      snapshotId: snapshot.snapshotId,
      apiKeyId: snapshot.apiKeyId,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      periodType: snapshot.periodType,
      pricingVersion: snapshot.pricingVersion,
      status: snapshot.status,
      createdAt: snapshot.createdAt,
      usageRecordCount,
    };
  }

  /**
   * Transform BillingSnapshot entity to BillingSnapshotSummary DTO
   * (Internal helper method)
   */
  private toSnapshotSummary(snapshot: BillingSnapshot): BillingSnapshotSummary {
    return {
      snapshotId: snapshot.snapshotId,
      apiKeyId: snapshot.apiKeyId,
      userId: snapshot.userId,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      periodType: snapshot.periodType,
      pricingVersion: snapshot.pricingVersion,
      status: snapshot.status,
      totalTokens: snapshot.totalTokens,
      totalRequests: snapshot.totalRequests,
      totalCostUSD: Number(snapshot.totalCostUSD),
      createdAt: snapshot.createdAt,
    };
  }
}
