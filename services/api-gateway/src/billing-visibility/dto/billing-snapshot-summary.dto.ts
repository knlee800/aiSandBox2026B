/**
 * BillingSnapshotSummary
 *
 * Phase 24B: Billing Visibility
 *
 * High-level overview of a single billing snapshot.
 * Used for list views, cost timelines, and quick summaries.
 *
 * IMPORTANT:
 * - Read-only projection (derived from BillingSnapshot entity)
 * - No sensitive data (no prompts, responses, or conversation history)
 * - Identity-scoped (users see only their own snapshots)
 */
export class BillingSnapshotSummary {
  /** Unique snapshot identifier (UUID) */
  snapshotId: string;

  /** API key identifier (who this snapshot is for) */
  apiKeyId: string;

  /** User associated with API key */
  userId: string;

  /** Period start (UTC, inclusive) */
  periodStart: Date;

  /** Period end (UTC, inclusive) */
  periodEnd: Date;

  /** Period type (daily, monthly, custom) */
  periodType: string;

  /** Pricing version used (e.g., "2026-02-v1") */
  pricingVersion: string;

  /** Snapshot status (draft, finalized) */
  status: string;

  /** Sum of all tokens across line items */
  totalTokens: number;

  /** Sum of all requests across line items */
  totalRequests: number;

  /** Final total cost (USD, 3 decimals) */
  totalCostUSD: number;

  /** When snapshot was created */
  createdAt: Date;
}
