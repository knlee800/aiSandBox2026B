import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { UsageRecord } from '../entities';
import {
  EfficiencySummary,
  ProviderEfficiencySummary,
  ProviderTrendsResponse,
  ProviderTrendsDay,
  ProviderCostSummary,
} from './dto';

/**
 * Pricing config for cost calculation (Phase 59B).
 * MUST match BillingSnapshotService PRICING_2026_02_V1 for determinism.
 * Unknown provider/model uses 0 cost (no throw).
 */
const PRICING_2026_02_V1: Array<{
  provider: string;
  model: string;
  pricePerThousandTokens: number;
}> = [
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', pricePerThousandTokens: 0.01 },
  { provider: 'stub', model: 'stub', pricePerThousandTokens: 0 },
];

/**
 * EfficiencySummaryService
 *
 * Phase 59B: Cost Monitoring & Resource Efficiency
 *
 * Read-only service for efficiency and provider cost visibility.
 * Queries usage_records only. No writes. No execution coupling.
 */
@Injectable()
export class EfficiencySummaryService {
  constructor(
    @InjectRepository(UsageRecord)
    private readonly usageRepository: Repository<UsageRecord>,
  ) {}

  /**
   * Get efficiency summary for time window.
   * Aggregates usage_records by apiKeyId, applies pricing for cost.
   */
  async getEfficiencySummary(
    apiKeyId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<EfficiencySummary> {
    const records = await this.usageRepository.find({
      where: {
        apiKeyId,
        timestamp: Between(periodStart, periodEnd),
      },
      order: { timestamp: 'ASC' },
    });

    const completed = records.filter((r) => r.executionStatus === 'completed');
    const failed = records.filter((r) => r.executionStatus === 'failed');

    let totalTokens = 0;
    let totalCostUSD = 0;
    const providerMap = new Map<
      string,
      { tokens: number; cost: number; requests: number }
    >();

    for (const r of completed) {
      const tokens = r.tokensUsed ?? 0;
      const cost = this.calcCost(r.provider, r.model ?? 'stub', tokens);
      totalTokens += tokens;
      totalCostUSD += cost;

      const existing = providerMap.get(r.provider) ?? {
        tokens: 0,
        cost: 0,
        requests: 0,
      };
      existing.tokens += tokens;
      existing.cost += cost;
      existing.requests += 1;
      providerMap.set(r.provider, existing);
    }

    const byProvider: ProviderEfficiencySummary[] = Array.from(
      providerMap.entries(),
    ).map(([provider, data]) => ({
      provider,
      totalCostUSD: this.round3(data.cost),
      totalTokens: data.tokens,
      totalRequests: data.requests,
      avgTokensPerRequest:
        data.requests > 0 ? data.tokens / data.requests : 0,
      costPerThousandTokens:
        data.tokens > 0
          ? this.round3((data.cost / data.tokens) * 1000)
          : 0,
    }));

    return {
      apiKeyId,
      periodStart,
      periodEnd,
      totalExecutions: records.length,
      completedExecutions: completed.length,
      failedExecutions: failed.length,
      totalTokens,
      totalCostUSD: this.round3(totalCostUSD),
      avgTokensPerExecution:
        completed.length > 0 ? totalTokens / completed.length : 0,
      avgCostPerExecution:
        completed.length > 0 ? totalCostUSD / completed.length : 0,
      costPerThousandTokens:
        totalTokens > 0 ? this.round3((totalCostUSD / totalTokens) * 1000) : 0,
      byProvider: byProvider.sort((a, b) => b.totalCostUSD - a.totalCostUSD),
    };
  }

  /**
   * Get provider cost trends by day.
   * Aggregates usage_records by day, then by provider.
   */
  async getProviderTrends(
    apiKeyId: string,
    periodStart: Date,
    periodEnd: Date,
    granularity: 'daily' = 'daily',
  ): Promise<ProviderTrendsResponse> {
    const records = await this.usageRepository.find({
      where: {
        apiKeyId,
        timestamp: Between(periodStart, periodEnd),
      },
      order: { timestamp: 'ASC' },
    });

    const dayMap = new Map<
      string,
      Map<string, { tokens: number; cost: number; requests: number }>
    >();

    for (const r of records) {
      if (r.executionStatus !== 'completed') continue;
      const tokens = r.tokensUsed ?? 0;
      const cost = this.calcCost(r.provider, r.model ?? 'stub', tokens);
      const dateKey = this.toDateKey(r.timestamp);

      let dayData = dayMap.get(dateKey);
      if (!dayData) {
        dayData = new Map();
        dayMap.set(dateKey, dayData);
      }

      const prov = dayData.get(r.provider) ?? {
        tokens: 0,
        cost: 0,
        requests: 0,
      };
      prov.tokens += tokens;
      prov.cost += cost;
      prov.requests += 1;
      dayData.set(r.provider, prov);
    }

    const sortedDates = Array.from(dayMap.keys()).sort();
    const byDay: ProviderTrendsDay[] = sortedDates.map((dateKey) => {
      const provMap = dayMap.get(dateKey)!;
      const byProvider: ProviderCostSummary[] = Array.from(
        provMap.entries(),
      ).map(([provider, data]) => ({
        provider,
        totalCostUSD: this.round3(data.cost),
        totalTokens: data.tokens,
        totalRequests: data.requests,
      }));
      return { date: dateKey, byProvider };
    });

    return {
      apiKeyId,
      periodStart,
      periodEnd,
      granularity,
      byDay,
    };
  }

  private calcCost(provider: string, model: string, tokens: number): number {
    const p = PRICING_2026_02_V1.find(
      (x) => x.provider === provider && x.model === model,
    );
    const rate = p?.pricePerThousandTokens ?? 0;
    return (tokens / 1000) * rate;
  }

  private round3(n: number): number {
    return Math.round(n * 1000) / 1000;
  }

  private toDateKey(d: Date): string {
    const dt = typeof d === 'string' ? new Date(d) : d;
    return dt.toISOString().slice(0, 10);
  }
}
