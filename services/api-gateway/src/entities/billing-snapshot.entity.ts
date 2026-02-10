import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

/**
 * BillingLineItem
 *
 * Cost breakdown for a single provider/model within a billing snapshot.
 */
export interface BillingLineItem {
  provider: string;
  model: string;
  totalTokens: number;
  totalRequests: number;
  pricePerThousandTokens: number;
  costUSD: number;
}

/**
 * BillingSnapshot Entity
 *
 * Phase 23B-4: Billing Snapshot Writer
 *
 * Immutable point-in-time billing record derived from usage_records.
 * Snapshots are deterministically reproducible from usage + pricing version.
 *
 * IMPORTANT:
 * - Immutable after creation (no updates except status: draft → finalized)
 * - Point-in-time capture (does not update with new usage)
 * - Deterministically reproducible from usage_records + pricing version
 * - Write-only (Phase 23B-4), read-only visibility (Phase 24B)
 */
@Entity('billing_snapshots')
@Index('idx_billing_snapshots_api_key_period', [
  'apiKeyId',
  'periodStart',
  'periodEnd',
])
@Index('idx_billing_snapshots_user', ['userId'])
@Index('idx_billing_snapshots_created_at', ['createdAt'])
@Index('idx_billing_snapshots_unique_window', [
  'apiKeyId',
  'periodStart',
  'periodEnd',
  'pricingVersion',
])
export class BillingSnapshot {
  /**
   * Unique snapshot identifier (UUID v4)
   * Primary key - ensures exactly one record per snapshot
   */
  @PrimaryColumn({ type: 'uuid', name: 'snapshot_id' })
  snapshotId: string;

  /**
   * API key identifier (NOT the key value)
   * Who this snapshot is for (billing recipient)
   * Source: UsageRecord.apiKeyId
   */
  @Column({ type: 'varchar', length: 50, name: 'api_key_id' })
  apiKeyId: string;

  /**
   * User associated with API key
   * Source: UsageRecord.userId
   */
  @Column({ type: 'varchar', length: 50, name: 'user_id' })
  userId: string;

  /**
   * Period start (UTC, inclusive)
   * Billing window start boundary
   */
  @Column({ type: 'timestamp', name: 'period_start' })
  periodStart: Date;

  /**
   * Period end (UTC, inclusive)
   * Billing window end boundary
   */
  @Column({ type: 'timestamp', name: 'period_end' })
  periodEnd: Date;

  /**
   * Period type
   * Examples: 'daily', 'monthly', 'custom'
   */
  @Column({ type: 'varchar', length: 20, name: 'period_type' })
  periodType: string;

  /**
   * Pricing version used for this snapshot
   * Examples: '2026-02-v1', '2026-03-v2'
   * Enables deterministic reproduction and audit trail
   */
  @Column({ type: 'varchar', length: 50, name: 'pricing_version' })
  pricingVersion: string;

  /**
   * Total tokens across all line items
   * Sum of all lineItems[].totalTokens
   */
  @Column({ type: 'integer', name: 'total_tokens', default: 0 })
  totalTokens: number;

  /**
   * Total requests across all line items
   * Sum of all lineItems[].totalRequests
   */
  @Column({ type: 'integer', name: 'total_requests', default: 0 })
  totalRequests: number;

  /**
   * Subtotal cost (USD, 3 decimals)
   * Sum of all lineItems[].costUSD
   */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 3,
    name: 'subtotal_usd',
    default: 0,
  })
  subtotalUSD: number;

  /**
   * Adjustments (discounts, credits - Phase 24+)
   * Always 0 in Phase 23B-4
   */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 3,
    name: 'adjustments_usd',
    default: 0,
  })
  adjustmentsUSD: number;

  /**
   * Final total cost (USD, 3 decimals)
   * totalCostUSD = subtotalUSD + adjustmentsUSD
   */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 3,
    name: 'total_cost_usd',
    default: 0,
  })
  totalCostUSD: number;

  /**
   * Breakdown by provider/model (JSONB array)
   * Each item: { provider, model, totalTokens, totalRequests, pricePerThousandTokens, costUSD }
   */
  @Column({ type: 'jsonb', name: 'line_items', default: [] })
  lineItems: BillingLineItem[];

  /**
   * Snapshot status
   * Values: 'draft', 'finalized'
   * Transition: draft → finalized (one-way, irreversible)
   */
  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: string;

  /**
   * When snapshot was created (immutable)
   * Point-in-time capture timestamp
   */
  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
