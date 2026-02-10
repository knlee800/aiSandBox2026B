/**
 * ProviderCostSummary
 *
 * Cost summary for a single provider.
 */
export interface ProviderCostSummary {
  /** Provider name (e.g., 'anthropic') */
  provider: string;

  /** Sum of costs for this provider */
  totalCostUSD: number;

  /** Sum of tokens for this provider */
  totalTokens: number;

  /** Sum of requests for this provider */
  totalRequests: number;
}

/**
 * TimeWindowCostSummary
 *
 * Phase 24B: Billing Visibility
 *
 * Aggregated costs across multiple snapshots in a time window.
 * Used for monthly invoices, cost trends, budget tracking.
 *
 * IMPORTANT:
 * - Read-only aggregation (derived from multiple BillingSnapshots)
 * - Zero totals if no snapshots found (not an error)
 * - Window boundaries are inclusive
 * - No billing calculations (costs already computed in Phase 23)
 */
export class TimeWindowCostSummary {
  /** Whose costs are summarized */
  apiKeyId: string;

  /** Time window start (UTC, inclusive) */
  periodStart: Date;

  /** Time window end (UTC, inclusive) */
  periodEnd: Date;

  /** Sum of all snapshot totals in window */
  totalCostUSD: number;

  /** Sum of all tokens in window */
  totalTokens: number;

  /** Sum of all requests in window */
  totalRequests: number;

  /** How many snapshots included */
  snapshotCount: number;

  /** Breakdown by provider */
  byProvider: ProviderCostSummary[];
}
