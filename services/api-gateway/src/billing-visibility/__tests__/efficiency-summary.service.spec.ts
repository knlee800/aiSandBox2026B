import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EfficiencySummaryService } from '../efficiency-summary.service';
import { UsageRecord } from '../../entities';

/**
 * Phase 59B: EfficiencySummaryService unit tests
 *
 * Validates:
 * - Successful read path
 * - Correct aggregation shape
 * - Bounded/provider-safe output
 * - No mutation (repository.save/update never called)
 */
describe('EfficiencySummaryService', () => {
  let service: EfficiencySummaryService;
  let usageRepo: Repository<UsageRecord>;

  const periodStart = new Date('2026-02-01T00:00:00.000Z');
  const periodEnd = new Date('2026-02-28T23:59:59.999Z');

  const mockCompletedRecords: Partial<UsageRecord>[] = [
    {
      executionId: 'e1',
      apiKeyId: 'ak_test',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      tokensUsed: 10000,
      executionStatus: 'completed',
      timestamp: new Date('2026-02-15T10:00:00.000Z'),
    },
    {
      executionId: 'e2',
      apiKeyId: 'ak_test',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      tokensUsed: 5000,
      executionStatus: 'completed',
      timestamp: new Date('2026-02-15T11:00:00.000Z'),
    },
    {
      executionId: 'e3',
      apiKeyId: 'ak_test',
      provider: 'stub',
      model: 'stub',
      tokensUsed: 100,
      executionStatus: 'completed',
      timestamp: new Date('2026-02-16T09:00:00.000Z'),
    },
  ];

  const mockWithFailed: Partial<UsageRecord>[] = [
    ...mockCompletedRecords,
    {
      executionId: 'e4',
      apiKeyId: 'ak_test',
      provider: 'anthropic',
      model: null,
      tokensUsed: null,
      executionStatus: 'failed',
      timestamp: new Date('2026-02-16T12:00:00.000Z'),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EfficiencySummaryService,
        {
          provide: getRepositoryToken(UsageRecord),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EfficiencySummaryService>(EfficiencySummaryService);
    usageRepo = module.get<Repository<UsageRecord>>(
      getRepositoryToken(UsageRecord),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEfficiencySummary', () => {
    it('should return correct aggregation shape for mixed-provider data', async () => {
      jest.spyOn(usageRepo, 'find').mockResolvedValue(mockCompletedRecords as UsageRecord[]);

      const result = await service.getEfficiencySummary(
        'ak_test',
        periodStart,
        periodEnd,
      );

      expect(result).toMatchObject({
        apiKeyId: 'ak_test',
        periodStart,
        periodEnd,
        totalExecutions: 3,
        completedExecutions: 3,
        failedExecutions: 0,
        totalTokens: 15100,
      });
      expect(result.byProvider).toHaveLength(2);
      expect(result.byProvider.map((p) => p.provider)).toContain('anthropic');
      expect(result.byProvider.map((p) => p.provider)).toContain('stub');
      expect(result.avgTokensPerExecution).toBeCloseTo(15100 / 3);
      expect(result.costPerThousandTokens).toBeGreaterThanOrEqual(0);
    });

    it('should include failed count and exclude failed from token/cost totals', async () => {
      jest.spyOn(usageRepo, 'find').mockResolvedValue(mockWithFailed as UsageRecord[]);

      const result = await service.getEfficiencySummary(
        'ak_test',
        periodStart,
        periodEnd,
      );

      expect(result.totalExecutions).toBe(4);
      expect(result.completedExecutions).toBe(3);
      expect(result.failedExecutions).toBe(1);
      expect(result.totalTokens).toBe(15100);
    });

    it('should return zeros when no records', async () => {
      jest.spyOn(usageRepo, 'find').mockResolvedValue([]);

      const result = await service.getEfficiencySummary(
        'ak_test',
        periodStart,
        periodEnd,
      );

      expect(result.totalExecutions).toBe(0);
      expect(result.completedExecutions).toBe(0);
      expect(result.failedExecutions).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.totalCostUSD).toBe(0);
      expect(result.avgTokensPerExecution).toBe(0);
      expect(result.avgCostPerExecution).toBe(0);
      expect(result.costPerThousandTokens).toBe(0);
      expect(result.byProvider).toEqual([]);
    });

    it('should not call save or update (read-only)', async () => {
      jest.spyOn(usageRepo, 'find').mockResolvedValue(mockCompletedRecords as UsageRecord[]);

      await service.getEfficiencySummary('ak_test', periodStart, periodEnd);

      expect(usageRepo.save).not.toHaveBeenCalled();
      expect(usageRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('getProviderTrends', () => {
    it('should return byDay with correct shape', async () => {
      jest.spyOn(usageRepo, 'find').mockResolvedValue(mockCompletedRecords as UsageRecord[]);

      const result = await service.getProviderTrends(
        'ak_test',
        periodStart,
        periodEnd,
      );

      expect(result).toMatchObject({
        apiKeyId: 'ak_test',
        periodStart,
        periodEnd,
        granularity: 'daily',
      });
      expect(Array.isArray(result.byDay)).toBe(true);
      expect(result.byDay.length).toBeGreaterThan(0);
      for (const day of result.byDay) {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('byProvider');
        expect(typeof day.date).toBe('string');
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it('should not call save or update (read-only)', async () => {
      jest.spyOn(usageRepo, 'find').mockResolvedValue(mockCompletedRecords as UsageRecord[]);

      await service.getProviderTrends('ak_test', periodStart, periodEnd);

      expect(usageRepo.save).not.toHaveBeenCalled();
      expect(usageRepo.update).not.toHaveBeenCalled();
    });
  });
});
