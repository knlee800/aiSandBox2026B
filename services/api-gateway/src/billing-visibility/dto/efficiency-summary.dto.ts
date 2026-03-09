/**
 * ProviderEfficiencySummary
 *
 * Phase 59B: Cost Monitoring & Resource Efficiency
 *
 * Efficiency metrics for a single provider within a time window.
 */
export interface ProviderEfficiencySummary {
  /** Provider name (e.g., 'anthropic') */
  provider: string;

  /** Sum of costs for this provider */
  totalCostUSD: number;

  /** Sum of tokens for this provider */
  totalTokens: number;

  /** Sum of requests for this provider */
  totalRequests: number;

  /** Average tokens per request */
  avgTokensPerRequest: number;

  /** Cost per 1,000 tokens */
  costPerThousandTokens: number;
}

/**
 * EfficiencySummary
 *
 * Phase 59B: Cost Monitoring & Resource Efficiency
 *
 * High-level efficiency metrics for a time window.
 * Read-only projection derived from usage_records.
 */
export interface EfficiencySummary {
  /** Whose usage is summarized */
  apiKeyId: string;

  /** Time window start (UTC, inclusive) */
  periodStart: Date;

  /** Time window end (UTC, inclusive) */
  periodEnd: Date;

  /** Total execution records in window */
  totalExecutions: number;

  /** Completed executions (execution_status='completed') */
  completedExecutions: number;

  /** Failed executions (execution_status='failed') */
  failedExecutions: number;

  /** Sum of tokens from completed executions */
  totalTokens: number;

  /** Sum of cost from completed executions (USD) */
  totalCostUSD: number;

  /** totalTokens / completedExecutions (0 if none) */
  avgTokensPerExecution: number;

  /** totalCostUSD / completedExecutions (0 if none) */
  avgCostPerExecution: number;

  /** totalCostUSD / (totalTokens/1000) (0 if no tokens) */
  costPerThousandTokens: number;

  /** Breakdown by provider */
  byProvider: ProviderEfficiencySummary[];
}
