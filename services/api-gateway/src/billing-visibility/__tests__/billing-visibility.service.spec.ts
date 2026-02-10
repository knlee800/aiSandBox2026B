import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { BillingVisibilityService } from '../billing-visibility.service';
import { BillingSnapshot } from '../../entities/billing-snapshot.entity';

/**
 * BillingVisibilityService Unit Tests
 *
 * Phase 24B: Billing Visibility
 *
 * Tests read-only billing visibility service with focus on:
 * - Snapshot retrieval (list, get single)
 * - Cost breakdown correctness
 * - Time window aggregation
 * - Access control enforcement (403 on apiKeyId mismatch)
 * - Error handling (404 on missing snapshot)
 * - No-write guarantee (no save/update calls)
 */
describe('BillingVisibilityService', () => {
  let service: BillingVisibilityService;
  let repository: Repository<BillingSnapshot>;

  // Test fixture: sample billing snapshot
  const mockSnapshot: BillingSnapshot = {
    snapshotId: '550e8400-e29b-41d4-a716-446655440000',
    apiKeyId: 'ak_test_123',
    userId: 'user_123',
    periodStart: new Date('2026-02-01T00:00:00.000Z'),
    periodEnd: new Date('2026-02-01T23:59:59.999Z'),
    periodType: 'daily',
    pricingVersion: '2026-02-v1',
    totalTokens: 50000,
    totalRequests: 10,
    subtotalUSD: 0.5,
    adjustmentsUSD: 0,
    totalCostUSD: 0.5,
    lineItems: [
      {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        totalTokens: 50000,
        totalRequests: 10,
        pricePerThousandTokens: 0.01,
        costUSD: 0.5,
      },
    ],
    status: 'finalized',
    createdAt: new Date('2026-02-02T00:05:00.000Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingVisibilityService,
        {
          provide: getRepositoryToken(BillingSnapshot),
          useValue: {
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BillingVisibilityService>(BillingVisibilityService);
    repository = module.get<Repository<BillingSnapshot>>(
      getRepositoryToken(BillingSnapshot),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listSnapshots', () => {
    it('should list snapshots for apiKeyId', async () => {
      // Arrange
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSnapshot]),
      };
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      // Act
      const result = await service.listSnapshots('ak_test_123');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].snapshotId).toBe(mockSnapshot.snapshotId);
      expect(result[0].apiKeyId).toBe('ak_test_123');
      expect(result[0].totalCostUSD).toBe(0.5);
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'snapshot.apiKeyId = :apiKeyId',
        { apiKeyId: 'ak_test_123' },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'snapshot.periodStart',
        'DESC',
      );
    });

    it('should filter snapshots by time window', async () => {
      // Arrange
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSnapshot]),
      };
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      const periodStart = new Date('2026-02-01T00:00:00.000Z');
      const periodEnd = new Date('2026-02-28T23:59:59.999Z');

      // Act
      const result = await service.listSnapshots(
        'ak_test_123',
        periodStart,
        periodEnd,
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'snapshot.periodStart >= :periodStart',
        { periodStart },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'snapshot.periodEnd <= :periodEnd',
        { periodEnd },
      );
    });

    it('should return empty array if no snapshots found', async () => {
      // Arrange
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      // Act
      const result = await service.listSnapshots('ak_nonexistent');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getSnapshot', () => {
    it('should get single snapshot by ID with access control', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockSnapshot);

      // Act
      const result = await service.getSnapshot(
        mockSnapshot.snapshotId,
        'ak_test_123',
      );

      // Assert
      expect(result.snapshotId).toBe(mockSnapshot.snapshotId);
      expect(result.apiKeyId).toBe('ak_test_123');
      expect(result.totalCostUSD).toBe(0.5);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { snapshotId: mockSnapshot.snapshotId },
      });
    });

    it('should throw NotFoundException if snapshot not found', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getSnapshot('nonexistent-id', 'ak_test_123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException on apiKeyId mismatch', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockSnapshot);

      // Act & Assert
      await expect(
        service.getSnapshot(mockSnapshot.snapshotId, 'ak_different'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getBreakdown', () => {
    it('should get cost breakdown with line items sorted by cost DESC', async () => {
      // Arrange
      const multiProviderSnapshot = {
        ...mockSnapshot,
        lineItems: [
          {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            totalTokens: 30000,
            totalRequests: 6,
            pricePerThousandTokens: 0.01,
            costUSD: 0.3,
          },
          {
            provider: 'stub',
            model: 'stub',
            totalTokens: 20000,
            totalRequests: 4,
            pricePerThousandTokens: 0.0,
            costUSD: 0.0,
          },
        ],
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(multiProviderSnapshot);

      // Act
      const result = await service.getBreakdown(
        mockSnapshot.snapshotId,
        'ak_test_123',
      );

      // Assert
      expect(result.snapshotId).toBe(mockSnapshot.snapshotId);
      expect(result.lineItems).toHaveLength(2);
      // Most expensive first
      expect(result.lineItems[0].costUSD).toBe(0.3);
      expect(result.lineItems[0].provider).toBe('anthropic');
      expect(result.lineItems[1].costUSD).toBe(0.0);
      expect(result.lineItems[1].provider).toBe('stub');
      expect(result.summary.totalTokens).toBe(50000);
      expect(result.summary.total).toBe(0.5);
    });

    it('should throw NotFoundException if snapshot not found', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getBreakdown('nonexistent-id', 'ak_test_123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException on apiKeyId mismatch', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockSnapshot);

      // Act & Assert
      await expect(
        service.getBreakdown(mockSnapshot.snapshotId, 'ak_different'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getTimeWindowSummary', () => {
    it('should aggregate costs across multiple snapshots', async () => {
      // Arrange
      const snapshot1 = { ...mockSnapshot, totalCostUSD: 0.5, totalTokens: 50000 };
      const snapshot2 = {
        ...mockSnapshot,
        snapshotId: 'different-id',
        totalCostUSD: 1.5,
        totalTokens: 150000,
        totalRequests: 30,
      };
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([snapshot1, snapshot2]),
      };
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      const periodStart = new Date('2026-02-01T00:00:00.000Z');
      const periodEnd = new Date('2026-02-28T23:59:59.999Z');

      // Act
      const result = await service.getTimeWindowSummary(
        'ak_test_123',
        periodStart,
        periodEnd,
      );

      // Assert
      expect(result.apiKeyId).toBe('ak_test_123');
      expect(result.totalCostUSD).toBe(2.0);
      expect(result.totalTokens).toBe(200000);
      expect(result.totalRequests).toBe(40);
      expect(result.snapshotCount).toBe(2);
      expect(result.byProvider).toHaveLength(1);
      expect(result.byProvider[0].provider).toBe('anthropic');
    });

    it('should return zero totals if no snapshots found', async () => {
      // Arrange
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      const periodStart = new Date('2026-02-01T00:00:00.000Z');
      const periodEnd = new Date('2026-02-28T23:59:59.999Z');

      // Act
      const result = await service.getTimeWindowSummary(
        'ak_test_123',
        periodStart,
        periodEnd,
      );

      // Assert
      expect(result.totalCostUSD).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.totalRequests).toBe(0);
      expect(result.snapshotCount).toBe(0);
      expect(result.byProvider).toEqual([]);
    });

    it('should aggregate multiple providers correctly', async () => {
      // Arrange
      const snapshot = {
        ...mockSnapshot,
        lineItems: [
          {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            totalTokens: 30000,
            totalRequests: 6,
            pricePerThousandTokens: 0.01,
            costUSD: 0.3,
          },
          {
            provider: 'openai',
            model: 'gpt-4',
            totalTokens: 20000,
            totalRequests: 4,
            pricePerThousandTokens: 0.02,
            costUSD: 0.4,
          },
        ],
      };
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([snapshot]),
      };
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      const periodStart = new Date('2026-02-01T00:00:00.000Z');
      const periodEnd = new Date('2026-02-28T23:59:59.999Z');

      // Act
      const result = await service.getTimeWindowSummary(
        'ak_test_123',
        periodStart,
        periodEnd,
      );

      // Assert
      expect(result.byProvider).toHaveLength(2);
      const anthropic = result.byProvider.find((p) => p.provider === 'anthropic');
      const openai = result.byProvider.find((p) => p.provider === 'openai');
      expect(anthropic?.totalCostUSD).toBe(0.3);
      expect(anthropic?.totalTokens).toBe(30000);
      expect(openai?.totalCostUSD).toBe(0.4);
      expect(openai?.totalTokens).toBe(20000);
    });
  });

  describe('getMetadata', () => {
    it('should get snapshot metadata without cost data', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockSnapshot);

      // Act
      const result = await service.getMetadata(
        mockSnapshot.snapshotId,
        'ak_test_123',
      );

      // Assert
      expect(result.snapshotId).toBe(mockSnapshot.snapshotId);
      expect(result.apiKeyId).toBe('ak_test_123');
      expect(result.pricingVersion).toBe('2026-02-v1');
      expect(result.status).toBe('finalized');
      expect(result.usageRecordCount).toBe(10); // Sum of totalRequests
      // Cost data NOT included
      expect(result).not.toHaveProperty('totalCostUSD');
    });

    it('should throw NotFoundException if snapshot not found', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getMetadata('nonexistent-id', 'ak_test_123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException on apiKeyId mismatch', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockSnapshot);

      // Act & Assert
      await expect(
        service.getMetadata(mockSnapshot.snapshotId, 'ak_different'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('no-write guarantee', () => {
    it('should never call repository.save', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockSnapshot);
      jest.spyOn(repository, 'save');

      // Act
      await service.getSnapshot(mockSnapshot.snapshotId, 'ak_test_123');

      // Assert
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should never call repository.update', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockSnapshot);
      jest.spyOn(repository, 'update');

      // Act
      await service.getSnapshot(mockSnapshot.snapshotId, 'ak_test_123');

      // Assert
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should never call repository.delete', async () => {
      // Arrange
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockSnapshot);
      jest.spyOn(repository, 'delete');

      // Act
      await service.getSnapshot(mockSnapshot.snapshotId, 'ak_test_123');

      // Assert
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
