/**
 * Phase 31A: Billing Visibility Aggregation Correctness Tests
 *
 * SCOPE: Validate mathematical correctness of time window aggregations
 * - Multi-snapshot aggregation accuracy
 * - Provider-level aggregation correctness
 * - Time window boundary handling in aggregations
 * - Determinism of aggregated results
 *
 * LOCKED INVARIANTS:
 * - Read-only validation (no writes)
 * - No schema changes
 * - Tests must be deterministic
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingVisibilityService } from '../billing-visibility.service';
import { BillingSnapshot } from '../../entities/billing-snapshot.entity';

describe('Phase 31A: Billing Visibility Aggregation Correctness', () => {
  let service: BillingVisibilityService;
  let snapshotRepository: Repository<BillingSnapshot>;

  const mockSnapshotRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingVisibilityService,
        {
          provide: getRepositoryToken(BillingSnapshot),
          useValue: mockSnapshotRepository,
        },
      ],
    }).compile();

    service = module.get<BillingVisibilityService>(BillingVisibilityService);
    snapshotRepository = module.get<Repository<BillingSnapshot>>(
      getRepositoryToken(BillingSnapshot),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('31A-5: Time Window Aggregation Correctness', () => {
    it('should aggregate costs correctly across multiple snapshots', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            snapshotId: 'snap_1',
            apiKeyId: 'ak_test',
            totalCostUSD: '1.500',
            totalTokens: 150000,
            totalRequests: 10,
            lineItems: [
              {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                totalTokens: 150000,
                totalRequests: 10,
                pricePerThousandTokens: 0.01,
                costUSD: 1.5,
              },
            ],
          },
          {
            snapshotId: 'snap_2',
            apiKeyId: 'ak_test',
            totalCostUSD: '2.250',
            totalTokens: 225000,
            totalRequests: 15,
            lineItems: [
              {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                totalTokens: 225000,
                totalRequests: 15,
                pricePerThousandTokens: 0.01,
                costUSD: 2.25,
              },
            ],
          },
        ]),
      };

      mockSnapshotRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getTimeWindowSummary(
        'ak_test',
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-28T23:59:59.999Z'),
      );

      expect(result.totalCostUSD).toBe(3.75); // 1.5 + 2.25
      expect(result.totalTokens).toBe(375000); // 150000 + 225000
      expect(result.totalRequests).toBe(25); // 10 + 15
      expect(result.snapshotCount).toBe(2);
    });

    it('should aggregate provider costs correctly across snapshots', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            snapshotId: 'snap_1',
            apiKeyId: 'ak_test',
            totalCostUSD: '1.0',
            totalTokens: 100000,
            totalRequests: 5,
            lineItems: [
              {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                totalTokens: 100000,
                totalRequests: 5,
                pricePerThousandTokens: 0.01,
                costUSD: 1.0,
              },
            ],
          },
          {
            snapshotId: 'snap_2',
            apiKeyId: 'ak_test',
            totalCostUSD: '1.5',
            totalTokens: 150000,
            totalRequests: 10,
            lineItems: [
              {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                totalTokens: 100000,
                totalRequests: 5,
                pricePerThousandTokens: 0.01,
                costUSD: 1.0,
              },
              {
                provider: 'stub',
                model: 'stub',
                totalTokens: 50000,
                totalRequests: 5,
                pricePerThousandTokens: 0.0,
                costUSD: 0.0,
              },
            ],
          },
        ]),
      };

      mockSnapshotRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getTimeWindowSummary(
        'ak_test',
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-28T23:59:59.999Z'),
      );

      expect(result.totalCostUSD).toBe(2.5);
      expect(result.byProvider).toHaveLength(2);

      const anthropicSummary = result.byProvider.find((p) => p.provider === 'anthropic');
      expect(anthropicSummary).toBeDefined();
      expect(anthropicSummary!.totalCostUSD).toBe(2.0); // 1.0 + 1.0
      expect(anthropicSummary!.totalTokens).toBe(200000); // 100000 + 100000
      expect(anthropicSummary!.totalRequests).toBe(10); // 5 + 5

      const stubSummary = result.byProvider.find((p) => p.provider === 'stub');
      expect(stubSummary).toBeDefined();
      expect(stubSummary!.totalCostUSD).toBe(0.0);
      expect(stubSummary!.totalTokens).toBe(50000);
      expect(stubSummary!.totalRequests).toBe(5);
    });

    it('should handle empty time windows (no snapshots)', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockSnapshotRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getTimeWindowSummary(
        'ak_test',
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-28T23:59:59.999Z'),
      );

      expect(result.totalCostUSD).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.totalRequests).toBe(0);
      expect(result.snapshotCount).toBe(0);
      expect(result.byProvider).toEqual([]);
    });

    it('should not double-count costs across snapshots', async () => {
      // Verify each snapshot counted exactly once
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            snapshotId: 'snap_unique_1',
            apiKeyId: 'ak_test',
            totalCostUSD: '0.500',
            totalTokens: 50000,
            totalRequests: 5,
            lineItems: [
              {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                totalTokens: 50000,
                totalRequests: 5,
                pricePerThousandTokens: 0.01,
                costUSD: 0.5,
              },
            ],
          },
          {
            snapshotId: 'snap_unique_2',
            apiKeyId: 'ak_test',
            totalCostUSD: '0.500',
            totalTokens: 50000,
            totalRequests: 5,
            lineItems: [
              {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                totalTokens: 50000,
                totalRequests: 5,
                pricePerThousandTokens: 0.01,
                costUSD: 0.5,
              },
            ],
          },
        ]),
      };

      mockSnapshotRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getTimeWindowSummary(
        'ak_test',
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-28T23:59:59.999Z'),
      );

      expect(result.totalCostUSD).toBe(1.0); // Not 2.0 (double-counted)
      expect(result.totalTokens).toBe(100000);
      expect(result.snapshotCount).toBe(2);
    });

    it('should handle large-volume aggregation without drift', async () => {
      // Test: Aggregate 100 snapshots
      const snapshots = Array.from({ length: 100 }, (_, i) => ({
        snapshotId: `snap_volume_${i}`,
        apiKeyId: 'ak_test',
        totalCostUSD: '0.123', // Each snapshot: $0.123
        totalTokens: 12300,
        totalRequests: 10,
        lineItems: [
          {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            totalTokens: 12300,
            totalRequests: 10,
            pricePerThousandTokens: 0.01,
            costUSD: 0.123,
          },
        ],
      }));

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(snapshots),
      };

      mockSnapshotRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getTimeWindowSummary(
        'ak_test',
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-28T23:59:59.999Z'),
      );

      // 100 * 0.123 = 12.3
      expect(result.totalCostUSD).toBeCloseTo(12.3, 2);
      expect(result.totalTokens).toBe(1230000); // 100 * 12300
      expect(result.totalRequests).toBe(1000); // 100 * 10
      expect(result.snapshotCount).toBe(100);
    });

    it('should aggregate decimal costs without floating-point drift', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            snapshotId: 'snap_decimal_1',
            apiKeyId: 'ak_test',
            totalCostUSD: '0.001',
            totalTokens: 100,
            totalRequests: 1,
            lineItems: [
              {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                totalTokens: 100,
                totalRequests: 1,
                pricePerThousandTokens: 0.01,
                costUSD: 0.001,
              },
            ],
          },
          {
            snapshotId: 'snap_decimal_2',
            apiKeyId: 'ak_test',
            totalCostUSD: '0.002',
            totalTokens: 200,
            totalRequests: 1,
            lineItems: [
              {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                totalTokens: 200,
                totalRequests: 1,
                pricePerThousandTokens: 0.01,
                costUSD: 0.002,
              },
            ],
          },
          {
            snapshotId: 'snap_decimal_3',
            apiKeyId: 'ak_test',
            totalCostUSD: '0.003',
            totalTokens: 300,
            totalRequests: 1,
            lineItems: [
              {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                totalTokens: 300,
                totalRequests: 1,
                pricePerThousandTokens: 0.01,
                costUSD: 0.003,
              },
            ],
          },
        ]),
      };

      mockSnapshotRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getTimeWindowSummary(
        'ak_test',
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-28T23:59:59.999Z'),
      );

      // 0.001 + 0.002 + 0.003 = 0.006
      expect(result.totalCostUSD).toBe(0.006);
      expect(result.totalTokens).toBe(600);
    });
  });

  describe('31A-6: Aggregation Determinism', () => {
    it('should produce identical results for repeated aggregations', async () => {
      const snapshots = [
        {
          snapshotId: 'snap_determ_1',
          apiKeyId: 'ak_test',
          totalCostUSD: '1.234',
          totalTokens: 123400,
          totalRequests: 100,
          lineItems: [
            {
              provider: 'anthropic',
              model: 'claude-3-5-sonnet-20241022',
              totalTokens: 123400,
              totalRequests: 100,
              pricePerThousandTokens: 0.01,
              costUSD: 1.234,
            },
          ],
        },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(snapshots),
      };

      mockSnapshotRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Execute twice
      const result1 = await service.getTimeWindowSummary(
        'ak_test',
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-28T23:59:59.999Z'),
      );

      jest.clearAllMocks();
      mockSnapshotRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result2 = await service.getTimeWindowSummary(
        'ak_test',
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-28T23:59:59.999Z'),
      );

      // Results should be identical
      expect(result1.totalCostUSD).toBe(result2.totalCostUSD);
      expect(result1.totalTokens).toBe(result2.totalTokens);
      expect(result1.totalRequests).toBe(result2.totalRequests);
      expect(result1.byProvider.length).toBe(result2.byProvider.length);
    });

    it('should be order-independent for snapshot aggregation', async () => {
      const snapshot1 = {
        snapshotId: 'snap_order_1',
        apiKeyId: 'ak_test',
        totalCostUSD: '1.000',
        totalTokens: 100000,
        totalRequests: 10,
        lineItems: [
          {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            totalTokens: 100000,
            totalRequests: 10,
            pricePerThousandTokens: 0.01,
            costUSD: 1.0,
          },
        ],
      };

      const snapshot2 = {
        snapshotId: 'snap_order_2',
        apiKeyId: 'ak_test',
        totalCostUSD: '2.000',
        totalTokens: 200000,
        totalRequests: 20,
        lineItems: [
          {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            totalTokens: 200000,
            totalRequests: 20,
            pricePerThousandTokens: 0.01,
            costUSD: 2.0,
          },
        ],
      };

      // Test with order A, B
      const mockQueryBuilderAB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([snapshot1, snapshot2]),
      };
      mockSnapshotRepository.createQueryBuilder.mockReturnValue(mockQueryBuilderAB);

      const resultAB = await service.getTimeWindowSummary(
        'ak_test',
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-28T23:59:59.999Z'),
      );

      // Test with order B, A
      jest.clearAllMocks();
      const mockQueryBuilderBA = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([snapshot2, snapshot1]),
      };
      mockSnapshotRepository.createQueryBuilder.mockReturnValue(mockQueryBuilderBA);

      const resultBA = await service.getTimeWindowSummary(
        'ak_test',
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-28T23:59:59.999Z'),
      );

      // Results should be identical regardless of order
      expect(resultAB.totalCostUSD).toBe(resultBA.totalCostUSD);
      expect(resultAB.totalTokens).toBe(resultBA.totalTokens);
      expect(resultAB.totalRequests).toBe(resultBA.totalRequests);
    });

    it('should handle mixed-precision decimal aggregation correctly', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            snapshotId: 'snap_mixed_1',
            apiKeyId: 'ak_test',
            totalCostUSD: '0.111',
            totalTokens: 11100,
            totalRequests: 10,
            lineItems: [
              {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                totalTokens: 11100,
                totalRequests: 10,
                pricePerThousandTokens: 0.01,
                costUSD: 0.111,
              },
            ],
          },
          {
            snapshotId: 'snap_mixed_2',
            apiKeyId: 'ak_test',
            totalCostUSD: '0.222',
            totalTokens: 22200,
            totalRequests: 20,
            lineItems: [
              {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                totalTokens: 22200,
                totalRequests: 20,
                pricePerThousandTokens: 0.01,
                costUSD: 0.222,
              },
            ],
          },
          {
            snapshotId: 'snap_mixed_3',
            apiKeyId: 'ak_test',
            totalCostUSD: '0.333',
            totalTokens: 33300,
            totalRequests: 30,
            lineItems: [
              {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                totalTokens: 33300,
                totalRequests: 30,
                pricePerThousandTokens: 0.01,
                costUSD: 0.333,
              },
            ],
          },
        ]),
      };

      mockSnapshotRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getTimeWindowSummary(
        'ak_test',
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-28T23:59:59.999Z'),
      );

      // 0.111 + 0.222 + 0.333 = 0.666
      expect(result.totalCostUSD).toBeCloseTo(0.666, 3);
      expect(result.totalTokens).toBe(66600);
      expect(result.totalRequests).toBe(60);
    });
  });
});
