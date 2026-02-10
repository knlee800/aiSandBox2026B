import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingVisibilityService } from '../billing-visibility.service';
import { BillingSnapshot } from '../../entities/billing-snapshot.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * Phase 30B: Runtime Validation Tests
 *
 * Validates billing & usage visibility APIs against REAL runtime data patterns
 * from Phase 29B (real xAI execution).
 *
 * These tests simulate the exact data structure that would be created by:
 * 1. Real AI execution (Phase 29B)
 * 2. Usage ledger recording (Phase 22B)
 * 3. Billing snapshot generation (Phase 23B-4)
 *
 * Focus:
 * - Data correctness with real provider data (xAI, not stub)
 * - Proper aggregation and filtering
 * - Authorization enforcement
 * - Read-only guarantees
 * - Privacy guarantees
 */
describe('BillingVisibility Phase 30B Runtime Validation', () => {
  let service: BillingVisibilityService;
  let repository: Repository<BillingSnapshot>;
  let module: TestingModule;

  // Test fixture: Real Phase 29B execution data
  const realApiKeyId = 'key-test'; // From Phase 29B
  const realUserId = 'test-user'; // From Phase 29B
  const realProvider = 'xai'; // Phase 29B uses xAI
  const realModel = 'grok-3'; // Actual model from xAI response

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

  describe('Real xAI execution data (Phase 29B)', () => {
    it('should correctly display xAI execution costs', async () => {
      // Arrange: Simulate real xAI execution snapshot
      const realSnapshot = {
        snapshotId: uuidv4(),
        apiKeyId: realApiKeyId,
        userId: realUserId,
        periodStart: new Date('2026-02-09T00:00:00.000Z'),
        periodEnd: new Date('2026-02-09T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 142, // Real token count from xAI
        totalRequests: 3, // 3 real executions
        subtotalUSD: 0.00142, // $0.01 per 1000 tokens
        adjustmentsUSD: 0,
        totalCostUSD: 0.00142,
        lineItems: [
          {
            provider: 'xai',
            model: 'grok-3',
            totalTokens: 142,
            totalRequests: 3,
            pricePerThousandTokens: 0.01,
            costUSD: 0.00142,
          },
        ],
        status: 'finalized',
        createdAt: new Date('2026-02-09T12:00:00.000Z'),
      };

      jest.spyOn(repository, 'findOne').mockResolvedValue(realSnapshot as any);

      // Act
      const result = await service.getSnapshot(
        realSnapshot.snapshotId,
        realApiKeyId,
      );

      // Assert: Verify real xAI data is correctly projected
      expect(result.snapshotId).toBe(realSnapshot.snapshotId);
      expect(result.apiKeyId).toBe(realApiKeyId);
      expect(result.userId).toBe(realUserId);
      expect(result.totalTokens).toBe(142);
      expect(result.totalRequests).toBe(3);
      expect(result.totalCostUSD).toBe(0.00142);
      expect(result.status).toBe('finalized');
    });

    it('should correctly break down xAI costs by model', async () => {
      // Arrange: Real xAI snapshot with breakdown
      const realSnapshot = {
        snapshotId: uuidv4(),
        apiKeyId: realApiKeyId,
        userId: realUserId,
        periodStart: new Date('2026-02-09T00:00:00.000Z'),
        periodEnd: new Date('2026-02-09T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 142,
        totalRequests: 3,
        subtotalUSD: 0.00142,
        adjustmentsUSD: 0,
        totalCostUSD: 0.00142,
        lineItems: [
          {
            provider: 'xai',
            model: 'grok-3',
            totalTokens: 142,
            totalRequests: 3,
            pricePerThousandTokens: 0.01,
            costUSD: 0.00142,
          },
        ],
        status: 'finalized',
        createdAt: new Date('2026-02-09T12:00:00.000Z'),
      };

      jest.spyOn(repository, 'findOne').mockResolvedValue(realSnapshot as any);

      // Act
      const result = await service.getBreakdown(
        realSnapshot.snapshotId,
        realApiKeyId,
      );

      // Assert: Verify breakdown structure
      expect(result.snapshotId).toBe(realSnapshot.snapshotId);
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].provider).toBe('xai');
      expect(result.lineItems[0].model).toBe('grok-3');
      expect(result.lineItems[0].totalTokens).toBe(142);
      expect(result.lineItems[0].totalRequests).toBe(3);
      expect(result.lineItems[0].costUSD).toBe(0.00142);
      expect(result.summary.totalTokens).toBe(142);
      expect(result.summary.totalRequests).toBe(3);
      expect(result.summary.total).toBe(0.00142);
    });

    it('should aggregate multiple xAI executions correctly', async () => {
      // Arrange: Multiple snapshots from Phase 29B testing
      const snapshot1 = {
        snapshotId: uuidv4(),
        apiKeyId: realApiKeyId,
        userId: realUserId,
        periodStart: new Date('2026-02-09T00:00:00.000Z'),
        periodEnd: new Date('2026-02-09T11:59:59.999Z'),
        periodType: 'custom',
        pricingVersion: '2026-02-v1',
        totalTokens: 42,
        totalRequests: 1,
        subtotalUSD: 0.00042,
        adjustmentsUSD: 0,
        totalCostUSD: 0.00042,
        lineItems: [
          {
            provider: 'xai',
            model: 'grok-3',
            totalTokens: 42,
            totalRequests: 1,
            pricePerThousandTokens: 0.01,
            costUSD: 0.00042,
          },
        ],
        status: 'finalized',
        createdAt: new Date('2026-02-09T12:00:00.000Z'),
      };

      const snapshot2 = {
        snapshotId: uuidv4(),
        apiKeyId: realApiKeyId,
        userId: realUserId,
        periodStart: new Date('2026-02-09T12:00:00.000Z'),
        periodEnd: new Date('2026-02-09T23:59:59.999Z'),
        periodType: 'custom',
        pricingVersion: '2026-02-v1',
        totalTokens: 100,
        totalRequests: 2,
        subtotalUSD: 0.001,
        adjustmentsUSD: 0,
        totalCostUSD: 0.001,
        lineItems: [
          {
            provider: 'xai',
            model: 'grok-3',
            totalTokens: 100,
            totalRequests: 2,
            pricePerThousandTokens: 0.01,
            costUSD: 0.001,
          },
        ],
        status: 'finalized',
        createdAt: new Date('2026-02-09T18:00:00.000Z'),
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
        realApiKeyId,
        new Date('2026-02-09T00:00:00.000Z'),
        new Date('2026-02-09T23:59:59.999Z'),
      );

      // Assert: Verify aggregation
      expect(result.totalTokens).toBe(142); // 42 + 100
      expect(result.totalRequests).toBe(3); // 1 + 2
      expect(result.totalCostUSD).toBe(0.00142); // 0.00042 + 0.001
      expect(result.snapshotCount).toBe(2);
      expect(result.byProvider).toHaveLength(1);
      expect(result.byProvider[0].provider).toBe('xai');
      expect(result.byProvider[0].totalTokens).toBe(142);
      expect(result.byProvider[0].totalRequests).toBe(3);
      expect(result.byProvider[0].totalCostUSD).toBe(0.00142);
    });
  });

  describe('Mixed provider data (Phase 29A stub + Phase 29B xAI)', () => {
    it('should correctly aggregate stub and xAI costs separately', async () => {
      // Arrange: Mixed snapshots (stub from Phase 29A, xAI from Phase 29B)
      const stubSnapshot = {
        snapshotId: uuidv4(),
        apiKeyId: realApiKeyId,
        userId: realUserId,
        periodStart: new Date('2026-02-08T00:00:00.000Z'),
        periodEnd: new Date('2026-02-08T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 42,
        totalRequests: 1,
        subtotalUSD: 0, // Stub has zero cost
        adjustmentsUSD: 0,
        totalCostUSD: 0,
        lineItems: [
          {
            provider: 'stub',
            model: 'stub-model-v1',
            totalTokens: 42,
            totalRequests: 1,
            pricePerThousandTokens: 0,
            costUSD: 0,
          },
        ],
        status: 'finalized',
        createdAt: new Date('2026-02-08T12:00:00.000Z'),
      };

      const xaiSnapshot = {
        snapshotId: uuidv4(),
        apiKeyId: realApiKeyId,
        userId: realUserId,
        periodStart: new Date('2026-02-09T00:00:00.000Z'),
        periodEnd: new Date('2026-02-09T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 142,
        totalRequests: 3,
        subtotalUSD: 0.00142,
        adjustmentsUSD: 0,
        totalCostUSD: 0.00142,
        lineItems: [
          {
            provider: 'xai',
            model: 'grok-3',
            totalTokens: 142,
            totalRequests: 3,
            pricePerThousandTokens: 0.01,
            costUSD: 0.00142,
          },
        ],
        status: 'finalized',
        createdAt: new Date('2026-02-09T12:00:00.000Z'),
      };

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([stubSnapshot, xaiSnapshot]),
      };
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      // Act
      const result = await service.getTimeWindowSummary(
        realApiKeyId,
        new Date('2026-02-08T00:00:00.000Z'),
        new Date('2026-02-09T23:59:59.999Z'),
      );

      // Assert: Verify separate provider aggregation
      expect(result.totalTokens).toBe(184); // 42 + 142
      expect(result.totalRequests).toBe(4); // 1 + 3
      expect(result.totalCostUSD).toBe(0.00142); // 0 + 0.00142
      expect(result.snapshotCount).toBe(2);
      expect(result.byProvider).toHaveLength(2);

      const stubProvider = result.byProvider.find((p) => p.provider === 'stub');
      const xaiProvider = result.byProvider.find((p) => p.provider === 'xai');

      expect(stubProvider).toBeDefined();
      expect(stubProvider!.totalTokens).toBe(42);
      expect(stubProvider!.totalRequests).toBe(1);
      expect(stubProvider!.totalCostUSD).toBe(0);

      expect(xaiProvider).toBeDefined();
      expect(xaiProvider!.totalTokens).toBe(142);
      expect(xaiProvider!.totalRequests).toBe(3);
      expect(xaiProvider!.totalCostUSD).toBe(0.00142);
    });
  });

  describe('Authorization with real API keys (Phase 20A)', () => {
    it('should enforce access control for key-test', async () => {
      // Arrange: Snapshot for key-test
      const snapshot = {
        snapshotId: uuidv4(),
        apiKeyId: 'key-test',
        userId: 'test-user',
        periodStart: new Date('2026-02-09T00:00:00.000Z'),
        periodEnd: new Date('2026-02-09T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 142,
        totalRequests: 3,
        subtotalUSD: 0.00142,
        adjustmentsUSD: 0,
        totalCostUSD: 0.00142,
        lineItems: [],
        status: 'finalized',
        createdAt: new Date('2026-02-09T12:00:00.000Z'),
      };

      jest.spyOn(repository, 'findOne').mockResolvedValue(snapshot as any);

      // Act & Assert: key-test can access its own snapshot
      const result = await service.getSnapshot(snapshot.snapshotId, 'key-test');
      expect(result.apiKeyId).toBe('key-test');

      // Act & Assert: key-1 cannot access key-test's snapshot
      await expect(
        service.getSnapshot(snapshot.snapshotId, 'key-1'),
      ).rejects.toThrow('Unauthorized access to billing snapshot');
    });

    it('should filter snapshots by API key correctly', async () => {
      // Arrange: Multiple API keys
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
      await service.listSnapshots('key-test');

      // Assert: Query filters by apiKeyId
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'snapshot.apiKeyId = :apiKeyId',
        { apiKeyId: 'key-test' },
      );
    });
  });

  describe('Privacy guarantees (Phase 15B)', () => {
    it('should never expose prompt or response content', async () => {
      // Arrange: Real snapshot (no sensitive data in entity)
      const snapshot = {
        snapshotId: uuidv4(),
        apiKeyId: realApiKeyId,
        userId: realUserId,
        periodStart: new Date('2026-02-09T00:00:00.000Z'),
        periodEnd: new Date('2026-02-09T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 142,
        totalRequests: 3,
        subtotalUSD: 0.00142,
        adjustmentsUSD: 0,
        totalCostUSD: 0.00142,
        lineItems: [
          {
            provider: 'xai',
            model: 'grok-3',
            totalTokens: 142,
            totalRequests: 3,
            pricePerThousandTokens: 0.01,
            costUSD: 0.00142,
          },
        ],
        status: 'finalized',
        createdAt: new Date('2026-02-09T12:00:00.000Z'),
      };

      jest.spyOn(repository, 'findOne').mockResolvedValue(snapshot as any);

      // Act
      const summary = await service.getSnapshot(snapshot.snapshotId, realApiKeyId);
      const breakdown = await service.getBreakdown(snapshot.snapshotId, realApiKeyId);
      const metadata = await service.getMetadata(snapshot.snapshotId, realApiKeyId);

      // Assert: NO sensitive data in any response
      expect(summary).not.toHaveProperty('prompt');
      expect(summary).not.toHaveProperty('response');
      expect(summary).not.toHaveProperty('output');
      expect(summary).not.toHaveProperty('conversationHistory');

      expect(breakdown).not.toHaveProperty('prompt');
      expect(breakdown).not.toHaveProperty('response');
      expect(breakdown).not.toHaveProperty('output');

      expect(metadata).not.toHaveProperty('prompt');
      expect(metadata).not.toHaveProperty('response');
      expect(metadata).not.toHaveProperty('output');
    });
  });

  describe('Read-only guarantees (Phase 24B)', () => {
    it('should never trigger writes during read operations', async () => {
      // Arrange
      const snapshot = {
        snapshotId: uuidv4(),
        apiKeyId: realApiKeyId,
        userId: realUserId,
        periodStart: new Date('2026-02-09T00:00:00.000Z'),
        periodEnd: new Date('2026-02-09T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 142,
        totalRequests: 3,
        subtotalUSD: 0.00142,
        adjustmentsUSD: 0,
        totalCostUSD: 0.00142,
        lineItems: [],
        status: 'finalized',
        createdAt: new Date('2026-02-09T12:00:00.000Z'),
      };

      jest.spyOn(repository, 'findOne').mockResolvedValue(snapshot as any);
      const saveSpy = jest.spyOn(repository, 'save');

      // Act: Call all read methods
      await service.getSnapshot(snapshot.snapshotId, realApiKeyId);
      await service.getBreakdown(snapshot.snapshotId, realApiKeyId);
      await service.getMetadata(snapshot.snapshotId, realApiKeyId);

      // Assert: NO write methods called
      expect(saveSpy).not.toHaveBeenCalled();
    });
  });

  describe('Decimal precision (Phase 23B-4)', () => {
    it('should handle decimal costs correctly', async () => {
      // Arrange: Small costs with 3 decimal places
      const snapshot = {
        snapshotId: uuidv4(),
        apiKeyId: realApiKeyId,
        userId: realUserId,
        periodStart: new Date('2026-02-09T00:00:00.000Z'),
        periodEnd: new Date('2026-02-09T23:59:59.999Z'),
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 142,
        totalRequests: 3,
        subtotalUSD: 0.00142, // 3 decimal places
        adjustmentsUSD: 0,
        totalCostUSD: 0.00142,
        lineItems: [
          {
            provider: 'xai',
            model: 'grok-3',
            totalTokens: 142,
            totalRequests: 3,
            pricePerThousandTokens: 0.01,
            costUSD: 0.00142,
          },
        ],
        status: 'finalized',
        createdAt: new Date('2026-02-09T12:00:00.000Z'),
      };

      jest.spyOn(repository, 'findOne').mockResolvedValue(snapshot as any);

      // Act
      const result = await service.getSnapshot(snapshot.snapshotId, realApiKeyId);

      // Assert: Decimal precision preserved
      expect(result.totalCostUSD).toBe(0.00142);
      expect(typeof result.totalCostUSD).toBe('number');
    });
  });
});
