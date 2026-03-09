import { ProviderCostSummary } from './time-window-cost-summary.dto';

/**
 * ProviderTrendsDay
 *
 * Phase 59B: Cost Monitoring & Resource Efficiency
 *
 * Provider cost breakdown for a single day.
 */
export interface ProviderTrendsDay {
  /** Date (UTC, ISO date string YYYY-MM-DD) */
  date: string;

  /** Cost breakdown by provider */
  byProvider: ProviderCostSummary[];
}

/**
 * ProviderTrendsResponse
 *
 * Phase 59B: Cost Monitoring & Resource Efficiency
 *
 * Time-series view of provider costs (daily granularity).
 * Read-only projection from usage_records or billing_snapshots.
 */
export interface ProviderTrendsResponse {
  /** Whose costs are summarized */
  apiKeyId: string;

  /** Time window start (UTC, inclusive) */
  periodStart: Date;

  /** Time window end (UTC, inclusive) */
  periodEnd: Date;

  /** Granularity (e.g., 'daily') */
  granularity: string;

  /** Cost by day */
  byDay: ProviderTrendsDay[];
}
