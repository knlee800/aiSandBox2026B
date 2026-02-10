/**
 * CostLineItem
 *
 * Cost breakdown for a single provider/model within a snapshot.
 */
export interface CostLineItem {
  /** Provider name (e.g., 'anthropic') */
  provider: string;

  /** Model name (e.g., 'claude-3-5-sonnet-20241022') */
  model: string;

  /** Tokens used for this provider/model */
  totalTokens: number;

  /** Requests for this provider/model */
  totalRequests: number;

  /** Pricing rate applied (USD per 1K tokens) */
  pricePerThousandTokens: number;

  /** Cost for this line item (USD, 3 decimals) */
  costUSD: number;
}

/**
 * CostSummary
 *
 * Aggregated totals across all line items.
 */
export interface CostSummary {
  /** Sum across all line items */
  totalTokens: number;

  /** Sum across all line items */
  totalRequests: number;

  /** Sum of line item costs (USD) */
  subtotal: number;

  /** Discounts, credits (always 0 in Phase 24A) */
  adjustments: number;

  /** Final total (subtotal + adjustments) */
  total: number;
}

/**
 * CostBreakdown
 *
 * Phase 24B: Billing Visibility
 *
 * Detailed cost breakdown by provider/model within a single snapshot.
 * Used for drill-down views, pie charts, and pricing verification.
 *
 * IMPORTANT:
 * - Read-only projection (derived from BillingSnapshot.lineItems)
 * - Line items ordered by costUSD DESC (most expensive first)
 * - No billing calculations (costs already computed in Phase 23)
 */
export class CostBreakdown {
  /** Which snapshot this breakdown is for */
  snapshotId: string;

  /** Breakdown by provider/model */
  lineItems: CostLineItem[];

  /** Aggregated totals */
  summary: CostSummary;
}
