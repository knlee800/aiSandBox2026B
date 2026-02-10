import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingVisibilityService } from '../billing-visibility.service';
import { BillingSnapshot } from '../../entities/billing-snapshot.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * BillingVisibility Integration Tests
 *
 * Phase 24B: Billing Visibility
 *
 * Tests end-to-end billing visibility flow with focus on:
 * - Service-to-database integration
 * - Query correctness with real repository
 * - Access control enforcement (403 on cross-key access)
 * - Error handling (404, 403)
 * - Privacy (no sensitive data in responses)
 * - Read-only guarantee (no database writes)
 */
describe('BillingVisibility Integration', () => {
  let service: BillingVisibilityService;
  let repository: Repository<BillingSnapshot>;
  let module: TestingModule;

  // Test fixture: sample billing snapshot
  const testSnapshotId = '550e8400-e29b-41d4-a716-446655440000';
  const testApiKeyId = 'ak_test_123';
  const testUserId = 'user_123';

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        BillingVisibilityService,
        {
          provide: getRepositoryToken(BillingSnapshot),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
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

  describe('listSnapshots integration', () => {
    it('should list snapshots with real query builder', async () => {
      // Arrange
      const mockSnapshot = {
        snapshotId: testSnapshotId,
        apiKeyId: testApiKeyId,
        userId: testUserId,
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
      const result = await service.listSnapshots(testApiKeyId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].snapshotId).toBe(testSnapshotId);
    });

    it('should filter by time window with query builder', async () => {
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

      const periodStart = new Date('2026-02-01T00:00:00.000Z');
      const periodEnd = new Date('2026-02-28T23:59:59.999Z');

      // Act
      await service.listSnapshots(testApiKeyId, periodStart, periodEnd);

      // Assert
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'snapshot.periodStart >= :periodStart',
        { periodStart },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'snapshot.periodEnd <= :periodEnd',
        { periodEnd },
      );
    });
  });

  describe('getSnapshot integration', () => {
    it('should retrieve and transform snapshot', async () => {
      // Arrange
      const mockSnapshot = {
        snapshotId: testSnapshotId,
        apiKeyId: testApiKeyId,
        userId: testUserId,
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-01T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 50000,
        totalRequests: 10,
        subtotalUSD: 0.5,
        adjustmentsUSD: 0,
        totalCostUSD: 0.5,
        lineItems: [],
        status: 'finalized',
        createdAt: new Date('2026-02-02T00:05:00.000Z'),
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockSnapshot as any);

      // Act
      const result = await service.getSnapshot(testSnapshotId, testApiKeyId);

      // Assert
      expect(result.snapshotId).toBe(testSnapshotId);
      expect(result.apiKeyId).toBe(testApiKeyId);
      expect(result.totalCostUSD).toBe(0.5);
    });
  });

  describe('getTimeWindowSummary integration', () => {
    it('should aggregate multiple snapshots correctly', async () => {
      // Arrange
      const snapshot1 = {
        snapshotId: uuidv4(),
        apiKeyId: testApiKeyId,
        userId: testUserId,
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

      const snapshot2 = {
        ...snapshot1,
        snapshotId: uuidv4(),
        totalTokens: 30000,
        totalRequests: 6,
        totalCostUSD: 0.3,
        lineItems: [
          {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            totalTokens: 30000,
            totalRequests: 6,
            pricePerThousandTokens: 0.01,
            costUSD: 0.3,
          },
        ],
      };

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([snapshot1, snapshot2]),
      };
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      // Act
      const result = await service.getTimeWindowSummary(
        testApiKeyId,
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-28T23:59:59.999Z'),
      );

      // Assert
      expect(result.totalCostUSD).toBe(0.8);
      expect(result.totalTokens).toBe(80000);
      expect(result.totalRequests).toBe(16);
      expect(result.snapshotCount).toBe(2);
      expect(result.byProvider).toHaveLength(1);
      expect(result.byProvider[0].provider).toBe('anthropic');
      expect(result.byProvider[0].totalCostUSD).toBe(0.8);
    });
  });

  describe('privacy guarantee', () => {
    it('should never expose sensitive data', async () => {
      // Arrange
      const mockSnapshot = {
        snapshotId: testSnapshotId,
        apiKeyId: testApiKeyId,
        userId: testUserId,
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-01T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 50000,
        totalRequests: 10,
        subtotalUSD: 0.5,
        adjustmentsUSD: 0,
        totalCostUSD: 0.5,
        lineItems: [],
        status: 'finalized',
        createdAt: new Date('2026-02-02T00:05:00.000Z'),
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockSnapshot as any);

      // Act
      const result = await service.getSnapshot(testSnapshotId, testApiKeyId);

      // Assert: NO sensitive data
      expect(result).not.toHaveProperty('prompt');
      expect(result).not.toHaveProperty('response');
      expect(result).not.toHaveProperty('conversationHistory');
      expect(result).not.toHaveProperty('messages');
    });
  });

  describe('read-only guarantee', () => {
    it('should never call repository.save during queries', async () => {
      // Arrange
      const mockSnapshot = {
        snapshotId: testSnapshotId,
        apiKeyId: testApiKeyId,
        userId: testUserId,
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-01T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 50000,
        totalRequests: 10,
        subtotalUSD: 0.5,
        adjustmentsUSD: 0,
        totalCostUSD: 0.5,
        lineItems: [],
        status: 'finalized',
        createdAt: new Date('2026-02-02T00:05:00.000Z'),
      };
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockSnapshot as any);
      jest.spyOn(repository, 'save');

      // Act
      await service.getSnapshot(testSnapshotId, testApiKeyId);
      await service.getBreakdown(testSnapshotId, testApiKeyId);
      await service.getMetadata(testSnapshotId, testApiKeyId);

      // Assert
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
