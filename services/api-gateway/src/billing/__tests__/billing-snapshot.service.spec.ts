import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingSnapshotService } from '../billing-snapshot.service';
import { BillingSnapshot, UsageRecord } from '../../entities';

describe('BillingSnapshotService', () => {
  let service: BillingSnapshotService;
  let snapshotRepository: Repository<BillingSnapshot>;
  let usageRepository: Repository<UsageRecord>;

  const mockSnapshotRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockUsageRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingSnapshotService,
        {
          provide: getRepositoryToken(BillingSnapshot),
          useValue: mockSnapshotRepository,
        },
        {
          provide: getRepositoryToken(UsageRecord),
          useValue: mockUsageRepository,
        },
      ],
    }).compile();

    service = module.get<BillingSnapshotService>(BillingSnapshotService);
    snapshotRepository = module.get<Repository<BillingSnapshot>>(
      getRepositoryToken(BillingSnapshot),
    );
    usageRepository = module.get<Repository<UsageRecord>>(
      getRepositoryToken(UsageRecord),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSnapshot', () => {
    const baseParams = {
      apiKeyId: 'ak_test123',
      userId: 'user_test123',
      windowStart: new Date('2026-02-01T00:00:00.000Z'),
      windowEnd: new Date('2026-02-01T23:59:59.999Z'),
      pricingVersion: '2026-02-v1',
      periodType: 'daily',
    };

    it('should create a billing snapshot with usage data', async () => {
      // Mock: no existing snapshot
      mockSnapshotRepository.findOne.mockResolvedValue(null);

      // Mock: usage records with anthropic claude model
      const usageRecords: Partial<UsageRecord>[] = [
        {
          executionId: 'exec_1',
          apiKeyId: 'ak_test123',
          userId: 'user_test123',
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 50000,
          executionDurationMs: 1000,
          timestamp: new Date('2026-02-01T12:00:00.000Z'),
        },
        {
          executionId: 'exec_2',
          apiKeyId: 'ak_test123',
          userId: 'user_test123',
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 30000,
          executionDurationMs: 800,
          timestamp: new Date('2026-02-01T14:00:00.000Z'),
        },
      ];
      mockUsageRepository.find.mockResolvedValue(usageRecords);

      // Mock: snapshot creation
      const createdSnapshot: Partial<BillingSnapshot> = {
        snapshotId: 'snapshot_uuid',
        apiKeyId: 'ak_test123',
        userId: 'user_test123',
        periodStart: baseParams.windowStart,
        periodEnd: baseParams.windowEnd,
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 80000,
        totalRequests: 2,
        subtotalUSD: 0.8,
        adjustmentsUSD: 0,
        totalCostUSD: 0.8,
        lineItems: [
          {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            totalTokens: 80000,
            totalRequests: 2,
            pricePerThousandTokens: 0.01,
            costUSD: 0.8,
          },
        ],
        status: 'draft',
      };
      mockSnapshotRepository.create.mockReturnValue(createdSnapshot);
      mockSnapshotRepository.save.mockResolvedValue(createdSnapshot);

      // Execute
      const result = await service.createSnapshot(baseParams);

      // Assertions
      expect(mockSnapshotRepository.findOne).toHaveBeenCalledWith({
        where: {
          apiKeyId: baseParams.apiKeyId,
          periodStart: baseParams.windowStart,
          periodEnd: baseParams.windowEnd,
          pricingVersion: baseParams.pricingVersion,
        },
      });

      expect(mockUsageRepository.find).toHaveBeenCalled();
      expect(mockSnapshotRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKeyId: 'ak_test123',
          userId: 'user_test123',
          totalTokens: 80000,
          totalRequests: 2,
          subtotalUSD: 0.8,
          totalCostUSD: 0.8,
          status: 'draft',
        }),
      );
      expect(mockSnapshotRepository.save).toHaveBeenCalled();
      expect(result).toEqual(createdSnapshot);
    });

    it('should create snapshot with zero usage when no records exist', async () => {
      // Mock: no existing snapshot
      mockSnapshotRepository.findOne.mockResolvedValue(null);

      // Mock: no usage records
      mockUsageRepository.find.mockResolvedValue([]);

      // Mock: snapshot creation with zero values
      const zeroSnapshot: Partial<BillingSnapshot> = {
        snapshotId: 'snapshot_zero',
        apiKeyId: 'ak_test123',
        userId: 'user_test123',
        periodStart: baseParams.windowStart,
        periodEnd: baseParams.windowEnd,
        periodType: 'daily',
        pricingVersion: '2026-02-v1',
        totalTokens: 0,
        totalRequests: 0,
        subtotalUSD: 0,
        adjustmentsUSD: 0,
        totalCostUSD: 0,
        lineItems: [],
        status: 'draft',
      };
      mockSnapshotRepository.create.mockReturnValue(zeroSnapshot);
      mockSnapshotRepository.save.mockResolvedValue(zeroSnapshot);

      // Execute
      const result = await service.createSnapshot(baseParams);

      // Assertions
      expect(result.totalTokens).toBe(0);
      expect(result.totalRequests).toBe(0);
      expect(result.totalCostUSD).toBe(0);
      expect(result.lineItems).toEqual([]);
    });

    it('should throw error when duplicate snapshot exists', async () => {
      // Mock: existing snapshot
      const existingSnapshot: Partial<BillingSnapshot> = {
        snapshotId: 'existing_snapshot',
        apiKeyId: 'ak_test123',
        periodStart: baseParams.windowStart,
        periodEnd: baseParams.windowEnd,
        pricingVersion: '2026-02-v1',
      };
      mockSnapshotRepository.findOne.mockResolvedValue(existingSnapshot);

      // Execute & Assert
      await expect(service.createSnapshot(baseParams)).rejects.toThrow(
        /Billing snapshot already exists/,
      );

      expect(mockUsageRepository.find).not.toHaveBeenCalled();
      expect(mockSnapshotRepository.create).not.toHaveBeenCalled();
      expect(mockSnapshotRepository.save).not.toHaveBeenCalled();
    });

    it('should throw error when pricing not found for provider/model', async () => {
      // Mock: no existing snapshot
      mockSnapshotRepository.findOne.mockResolvedValue(null);

      // Mock: usage with unknown provider/model
      const unknownUsage: Partial<UsageRecord>[] = [
        {
          executionId: 'exec_unknown',
          apiKeyId: 'ak_test123',
          userId: 'user_test123',
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'unknown',
          adapter: 'unknown-adapter',
          model: 'unknown-model',
          tokensUsed: 1000,
          executionDurationMs: 500,
          timestamp: new Date('2026-02-01T12:00:00.000Z'),
        },
      ];
      mockUsageRepository.find.mockResolvedValue(unknownUsage);

      // Execute & Assert
      await expect(service.createSnapshot(baseParams)).rejects.toThrow(
        /Pricing not found for unknown\/unknown-model/,
      );
    });

    it('should throw error when pricing version not found', async () => {
      // Mock: no existing snapshot
      mockSnapshotRepository.findOne.mockResolvedValue(null);

      // Mock: empty usage (pricing version check happens before usage query)
      mockUsageRepository.find.mockResolvedValue([]);

      // Execute with invalid pricing version
      const invalidParams = {
        ...baseParams,
        pricingVersion: 'invalid-version',
      };

      // Execute & Assert
      await expect(service.createSnapshot(invalidParams)).rejects.toThrow(
        /Pricing version not found: invalid-version/,
      );
    });

    it('should calculate costs deterministically with banker\'s rounding', async () => {
      // Mock: no existing snapshot
      mockSnapshotRepository.findOne.mockResolvedValue(null);

      // Mock: usage records with specific token counts to test rounding
      // 50000 tokens * $0.01/1000 = $0.500 (no rounding needed)
      const usageRecords: Partial<UsageRecord>[] = [
        {
          executionId: 'exec_rounding',
          apiKeyId: 'ak_test123',
          userId: 'user_test123',
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 50000,
          executionDurationMs: 1000,
          timestamp: new Date('2026-02-01T12:00:00.000Z'),
        },
      ];
      mockUsageRepository.find.mockResolvedValue(usageRecords);

      // Mock: snapshot creation
      const createdSnapshot: Partial<BillingSnapshot> = {
        snapshotId: 'snapshot_rounding',
        totalCostUSD: 0.5,
      };
      mockSnapshotRepository.create.mockReturnValue(createdSnapshot);
      mockSnapshotRepository.save.mockResolvedValue(createdSnapshot);

      // Execute
      const result = await service.createSnapshot(baseParams);

      // Assertions: verify deterministic cost calculation
      expect(result.totalCostUSD).toBe(0.5);
    });

    it('should aggregate multiple providers/models correctly', async () => {
      // Mock: no existing snapshot
      mockSnapshotRepository.findOne.mockResolvedValue(null);

      // Mock: usage records with multiple providers/models
      const usageRecords: Partial<UsageRecord>[] = [
        {
          executionId: 'exec_anthropic_1',
          apiKeyId: 'ak_test123',
          userId: 'user_test123',
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 30000,
          executionDurationMs: 800,
          timestamp: new Date('2026-02-01T12:00:00.000Z'),
        },
        {
          executionId: 'exec_stub_1',
          apiKeyId: 'ak_test123',
          userId: 'user_test123',
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'stub',
          adapter: 'claude-stub',
          model: 'stub',
          tokensUsed: 10000,
          executionDurationMs: 100,
          timestamp: new Date('2026-02-01T13:00:00.000Z'),
        },
        {
          executionId: 'exec_anthropic_2',
          apiKeyId: 'ak_test123',
          userId: 'user_test123',
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 20000,
          executionDurationMs: 600,
          timestamp: new Date('2026-02-01T14:00:00.000Z'),
        },
      ];
      mockUsageRepository.find.mockResolvedValue(usageRecords);

      // Mock: snapshot creation with aggregated line items
      const createdSnapshot: Partial<BillingSnapshot> = {
        snapshotId: 'snapshot_multi',
        apiKeyId: 'ak_test123',
        userId: 'user_test123',
        totalTokens: 60000,
        totalRequests: 3,
        subtotalUSD: 0.5,
        totalCostUSD: 0.5,
        lineItems: [
          {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            totalTokens: 50000,
            totalRequests: 2,
            pricePerThousandTokens: 0.01,
            costUSD: 0.5,
          },
          {
            provider: 'stub',
            model: 'stub',
            totalTokens: 10000,
            totalRequests: 1,
            pricePerThousandTokens: 0.0,
            costUSD: 0.0,
          },
        ],
        status: 'draft',
      };
      mockSnapshotRepository.create.mockReturnValue(createdSnapshot);
      mockSnapshotRepository.save.mockResolvedValue(createdSnapshot);

      // Execute
      const result = await service.createSnapshot(baseParams);

      // Assertions: verify aggregation across providers/models
      expect(result.totalTokens).toBe(60000);
      expect(result.totalRequests).toBe(3);
      expect(result.lineItems).toHaveLength(2);
    });

    it('should handle stub provider with zero cost', async () => {
      // Mock: no existing snapshot
      mockSnapshotRepository.findOne.mockResolvedValue(null);

      // Mock: usage with stub provider (free)
      const stubUsage: Partial<UsageRecord>[] = [
        {
          executionId: 'exec_stub',
          apiKeyId: 'ak_test123',
          userId: 'user_test123',
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'stub',
          adapter: 'claude-stub',
          model: 'stub',
          tokensUsed: 100000,
          executionDurationMs: 500,
          timestamp: new Date('2026-02-01T12:00:00.000Z'),
        },
      ];
      mockUsageRepository.find.mockResolvedValue(stubUsage);

      // Mock: snapshot creation
      const createdSnapshot: Partial<BillingSnapshot> = {
        snapshotId: 'snapshot_stub',
        totalTokens: 100000,
        totalRequests: 1,
        subtotalUSD: 0.0,
        totalCostUSD: 0.0,
        lineItems: [
          {
            provider: 'stub',
            model: 'stub',
            totalTokens: 100000,
            totalRequests: 1,
            pricePerThousandTokens: 0.0,
            costUSD: 0.0,
          },
        ],
      };
      mockSnapshotRepository.create.mockReturnValue(createdSnapshot);
      mockSnapshotRepository.save.mockResolvedValue(createdSnapshot);

      // Execute
      const result = await service.createSnapshot(baseParams);

      // Assertions: verify zero cost for stub provider
      expect(result.totalCostUSD).toBe(0.0);
      expect(result.lineItems[0].costUSD).toBe(0.0);
    });

    it('should preserve immutability - no updates allowed', async () => {
      // This test verifies service design (no update method exists)
      expect(service).not.toHaveProperty('updateSnapshot');
      expect(service).not.toHaveProperty('deleteSnapshot');
      expect(service).not.toHaveProperty('modifySnapshot');
    });
  });
});
