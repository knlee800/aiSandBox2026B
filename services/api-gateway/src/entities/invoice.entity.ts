import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

/**
 * InvoiceLineItem
 *
 * Cost breakdown for a single provider/model within an invoice.
 * Copied verbatim from BillingSnapshot.lineItems
 */
export interface InvoiceLineItem {
  provider: string;
  model: string;
  totalTokens: number;
  totalRequests: number;
  pricePerThousandTokens: number;
  amountUSD: number;
}

/**
 * Invoice Entity
 *
 * Phase 25B-1: Invoice Persistence Infrastructure
 *
 * Immutable invoice record derived from BillingSnapshot (Phase 23).
 * Invoices are write-once, derived data only.
 *
 * IMPORTANT:
 * - Immutable after creation (no updates, no deletes)
 * - Derived from BillingSnapshot (one-to-one mapping)
 * - No billing calculations (values copied from snapshot)
 * - No payment logic (Phase 25B-2+)
 * - Status is 'draft' ONLY in Phase 25B-1
 */
@Entity('invoices')
@Index('idx_invoices_api_key_period', ['apiKeyId', 'periodStart', 'periodEnd'])
@Index('idx_invoices_user', ['userId'])
@Index('idx_invoices_created_at', ['createdAt'])
export class Invoice {
  /**
   * Unique invoice identifier (UUID v4)
   * Primary key - ensures exactly one record per invoice
   */
  @PrimaryColumn({ type: 'uuid', name: 'invoice_id' })
  invoiceId: string;

  /**
   * Billing snapshot identifier (UUID v4)
   * Foreign key to billing_snapshots.snapshot_id
   * UNIQUE constraint enforces one-to-one mapping
   */
  @Column({ type: 'uuid', name: 'snapshot_id', unique: true })
  @Index('idx_invoices_snapshot_id', { unique: true })
  snapshotId: string;

  /**
   * API key identifier (NOT the key value)
   * Who this invoice is for (billing recipient)
   * Copied from BillingSnapshot.apiKeyId
   */
  @Column({ type: 'varchar', length: 50, name: 'api_key_id' })
  apiKeyId: string;

  /**
   * User associated with API key
   * Copied from BillingSnapshot.userId
   */
  @Column({ type: 'varchar', length: 50, name: 'user_id' })
  userId: string;

  /**
   * Period start (UTC, inclusive)
   * Billing window start boundary
   * Copied from BillingSnapshot.periodStart
   */
  @Column({ type: 'timestamp', name: 'period_start' })
  periodStart: Date;

  /**
   * Period end (UTC, inclusive)
   * Billing window end boundary
   * Copied from BillingSnapshot.periodEnd
   */
  @Column({ type: 'timestamp', name: 'period_end' })
  periodEnd: Date;

  /**
   * Pricing version used for this invoice
   * Examples: '2026-02-v1', '2026-03-v2'
   * Copied from BillingSnapshot.pricingVersion
   */
  @Column({ type: 'varchar', length: 50, name: 'pricing_version' })
  pricingVersion: string;

  /**
   * Subtotal cost (USD, 3 decimals)
   * Copied from BillingSnapshot.subtotalUSD
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
   * Adjustments (discounts, credits)
   * Copied from BillingSnapshot.adjustmentsUSD
   * Always 0 in Phase 25B-1
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
   * Copied from BillingSnapshot.totalCostUSD
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
   * Currency code
   * Always 'USD' in Phase 25B-1
   */
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  /**
   * Line items breakdown (JSONB array)
   * Each item: { provider, model, totalTokens, totalRequests, pricePerThousandTokens, amountUSD }
   * Copied from BillingSnapshot.lineItems
   */
  @Column({ type: 'jsonb', name: 'line_items', default: [] })
  lineItems: InvoiceLineItem[];

  /**
   * Invoice status
   * Phase 25B-1: 'draft' ONLY (no payment logic)
   * Future phases: 'draft', 'finalized', 'pending_payment', 'paid', 'failed', 'written_off'
   */
  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: string;

  /**
   * When invoice was created (immutable)
   * Automatically set on creation
   */
  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
