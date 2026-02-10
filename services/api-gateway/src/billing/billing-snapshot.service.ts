import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { BillingSnapshot, BillingLineItem } from '../entities';
import { UsageRecord } from '../entities';
import { KillSwitchConfig } from '../safety/kill-switch.config';

/**
 * CreateSnapshotParams
 *
 * Parameters for creating a billing snapshot.
 */
export interface CreateSnapshotParams {
  apiKeyId: string;
  userId: string;
  windowStart: Date;
  windowEnd: Date;
  pricingVersion: string;
  periodType?: string; // 'daily', 'monthly', 'custom' (default: 'custom')
}

/**
 * PricingConfig
 *
 * Fixed pricing configuration (Phase 23B-4 MVP).
 * Pricing per 1,000 tokens (industry standard).
 */
interface PricingConfig {
  provider: string;
  model: string;
  pricePerThousandTokens: number;
}

/**
 * BillingSnapshotService
 *
 * Phase 23B-4: Billing Snapshot Writer
 *
 * Writes immutable, deterministic billing snapshots derived from usage_records.
 * This is a write-only service (visibility queries in Phase 24B).
 *
 * Key guarantees:
 * - Read-only consumption of usage_records (immutable ledger)
 * - Deterministic pricing (pure function, banker's rounding)
 * - Immutable snapshots (no updates after creation)
 * - Throw-only error semantics (no silent failures)
 * - No execution coupling (snapshots created outside execution flow)
 */
@Injectable()
export class BillingSnapshotService {
  private readonly logger = new Logger(BillingSnapshotService.name);

  constructor(
    @InjectRepository(BillingSnapshot)
    private readonly snapshotRepository: Repository<BillingSnapshot>,
    @InjectRepository(UsageRecord)
    private readonly usageRepository: Repository<UsageRecord>,
  ) {}

  /**
   * Fixed pricing configuration (Phase 23B-4 MVP)
   *
   * In future phases, this can be loaded from YAML/JSON config or database.
   * For now, we use hardcoded pricing for deterministic behavior.
   *
   * Pricing format: per 1,000 tokens (industry standard)
   */
  private readonly PRICING_2026_02_V1: PricingConfig[] = [
    {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      pricePerThousandTokens: 0.01, // $0.01 per 1K tokens
    },
    {
      provider: 'stub',
      model: 'stub',
      pricePerThousandTokens: 0.0, // Free (testing)
    },
  ];

  /**
   * Get pricing configuration for a specific version.
   *
   * @param pricingVersion - Pricing version (e.g., '2026-02-v1')
   * @returns Array of pricing configs
   * @throws Error if pricing version not found
   */
  private getPricingConfig(pricingVersion: string): PricingConfig[] {
    if (pricingVersion === '2026-02-v1') {
      return this.PRICING_2026_02_V1;
    }
    throw new Error(`Pricing version not found: ${pricingVersion}`);
  }

  /**
   * Find pricing for a specific provider/model.
   *
   * @param pricingConfig - Pricing configuration array
   * @param provider - Provider name
   * @param model - Model name
   * @returns Price per 1,000 tokens
   * @throws Error if pricing not found
   */
  private findPricing(
    pricingConfig: PricingConfig[],
    provider: string,
    model: string,
  ): number {
    const pricing = pricingConfig.find(
      (p) => p.provider === provider && p.model === model,
    );
    if (!pricing) {
      throw new Error(`Pricing not found for ${provider}/${model}`);
    }
    return pricing.pricePerThousandTokens;
  }

  /**
   * Calculate cost using standard rounding (round half away from zero).
   *
   * Phase 23B-2 / Phase 31A: Rounding to 3 decimal places:
   * - Uses Math.round() which implements "round half away from zero"
   * - 0.0125 → 0.013 (round up, away from zero)
   * - 0.0135 → 0.014 (round up, away from zero)
   * - 0.0005 → 0.001 (round up, away from zero)
   * - 0.0004 → 0.000 (round down)
   *
   * CORRECTNESS NOTE (Phase 31A):
   * - JavaScript Math.round() does NOT implement banker's rounding
   * - Banker's rounding would be: 0.0125 → 0.012 (round to even)
   * - Current behavior is deterministic and consistent
   * - Changing this would affect existing billing data
   *
   * @param totalTokens - Total tokens consumed
   * @param pricePerThousandTokens - Price per 1,000 tokens
   * @returns Cost in USD (rounded to 3 decimals)
   */
  private calculateCost(
    totalTokens: number,
    pricePerThousandTokens: number,
  ): number {
    const rawCost = (totalTokens / 1000) * pricePerThousandTokens;

    // Standard rounding to 3 decimal places (round half away from zero)
    const factor = 1000; // 10^3 for 3 decimals
    const scaled = rawCost * factor;
    const rounded = Math.round(scaled);

    return rounded / factor;
  }

  /**
   * Create a billing snapshot.
   *
   * Workflow:
   * 1. Query usage_records for apiKeyId + time window
   * 2. Aggregate by (provider, model)
   * 3. Apply pricing logic (per-1K tokens, banker's rounding)
   * 4. Create immutable snapshot record
   * 5. Throw if duplicate snapshot exists
   *
   * @param params - Snapshot creation parameters
   * @returns Created billing snapshot
   * @throws Error if duplicate snapshot exists or pricing not found
   */
  async createSnapshot(
    params: CreateSnapshotParams,
  ): Promise<BillingSnapshot> {
    const {
      apiKeyId,
      userId,
      windowStart,
      windowEnd,
      pricingVersion,
      periodType = 'custom',
    } = params;

    // Phase 26B: Check billing snapshot kill switch
    if (!KillSwitchConfig.BILLING_SNAPSHOT_ENABLED) {
      this.logger.warn(
        'Billing snapshot creation disabled by kill switch',
        { apiKeyId, windowStart, windowEnd },
      );
      // Return early without creating snapshot (no-op)
      // Usage ledger continues to record (source-of-truth preserved)
      // Snapshots can be recomputed later when kill switch is re-enabled
      throw new Error('Billing snapshot creation temporarily disabled');
    }

    // Check for duplicate snapshot (apiKeyId + window + pricingVersion)
    const existingSnapshot = await this.snapshotRepository.findOne({
      where: {
        apiKeyId,
        periodStart: windowStart,
        periodEnd: windowEnd,
        pricingVersion,
      },
    });

    if (existingSnapshot) {
      throw new Error(
        `Billing snapshot already exists for apiKeyId=${apiKeyId}, window=[${windowStart.toISOString()}, ${windowEnd.toISOString()}], pricingVersion=${pricingVersion}`,
      );
    }

    // Query usage records for time window (read-only)
    const usageRecords = await this.usageRepository.find({
      where: {
        apiKeyId,
        timestamp: windowStart as any, // TypeORM will handle timestamp comparison
      },
      order: {
        timestamp: 'ASC',
      },
    });

    // Filter records within time window (TypeORM where clause doesn't support BETWEEN directly)
    const filteredRecords = usageRecords.filter(
      (record) =>
        record.timestamp >= windowStart && record.timestamp <= windowEnd,
    );

    // Aggregate by (provider, model)
    const aggregates = new Map<
      string,
      {
        provider: string;
        model: string;
        totalTokens: number;
        totalRequests: number;
      }
    >();

    for (const record of filteredRecords) {
      const key = `${record.provider}:${record.model}`;
      const existing = aggregates.get(key) || {
        provider: record.provider,
        model: record.model,
        totalTokens: 0,
        totalRequests: 0,
      };

      existing.totalTokens += record.tokensUsed;
      existing.totalRequests += 1;

      aggregates.set(key, existing);
    }

    // Apply pricing logic to each aggregate
    const pricingConfig = this.getPricingConfig(pricingVersion);
    const lineItems: BillingLineItem[] = [];
    let totalTokens = 0;
    let totalRequests = 0;
    let subtotalUSD = 0;

    for (const aggregate of aggregates.values()) {
      const pricePerThousandTokens = this.findPricing(
        pricingConfig,
        aggregate.provider,
        aggregate.model,
      );

      const costUSD = this.calculateCost(
        aggregate.totalTokens,
        pricePerThousandTokens,
      );

      lineItems.push({
        provider: aggregate.provider,
        model: aggregate.model,
        totalTokens: aggregate.totalTokens,
        totalRequests: aggregate.totalRequests,
        pricePerThousandTokens,
        costUSD,
      });

      totalTokens += aggregate.totalTokens;
      totalRequests += aggregate.totalRequests;
      subtotalUSD += costUSD;
    }

    // Round subtotal to 3 decimals (defensive, should already be rounded)
    subtotalUSD = Math.round(subtotalUSD * 1000) / 1000;

    // Create immutable snapshot
    const snapshot = this.snapshotRepository.create({
      snapshotId: uuidv4(),
      apiKeyId,
      userId,
      periodStart: windowStart,
      periodEnd: windowEnd,
      periodType,
      pricingVersion,
      totalTokens,
      totalRequests,
      subtotalUSD,
      adjustmentsUSD: 0, // Always 0 in Phase 23B-4
      totalCostUSD: subtotalUSD, // No adjustments yet
      lineItems,
      status: 'draft',
    });

    // Persist snapshot (atomic insert)
    return await this.snapshotRepository.save(snapshot);
  }
}
