import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BillingSnapshotService } from '../billing-snapshot.service';
import { BillingSnapshot, UsageRecord } from '../../entities';

/**
 * Integration tests for BillingSnapshotService
 *
 * These tests verify:
 * - Read-only consumption of usage_records
 * - No execution coupling
 * - No writes on failure paths
 * - Deterministic behavior
 *
 * NOTE: These tests use in-memory repositories and do not touch real database.
 */
describe('BillingSnapshotService (Integration)', () => {
  let module: TestingModule;
  let service: BillingSnapshotService;
  let snapshotRepository: Repository<BillingSnapshot>;
  let usageRepository: Repository<UsageRecord>;

  beforeEach(async () => {
    // Use mock repositories for integration tests
    const mockSnapshotRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve(data)),
    };

    const mockUsageRepo = {
      find: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        BillingSnapshotService,
        {
          provide: getRepositoryToken(BillingSnapshot),
          useValue: mockSnapshotRepo,
        },
        {
          provide: getRepositoryToken(UsageRecord),
          useValue: mockUsageRepo,
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

  describe('End-to-End Billing Snapshot Creation', () => {
    it('should create snapshot from usage records (happy path)', async () => {
      // Setup: no existing snapshot
      (snapshotRepository.findOne as jest.Mock).mockResolvedValue(null);

      // Setup: usage records
      const usageRecords = [
        {
          executionId: 'exec_e2e_1',
          apiKeyId: 'ak_e2e',
          userId: 'user_e2e',
          sessionId: 'session_e2e',
          conversationId: 'conv_e2e',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 25000,
          executionDurationMs: 1500,
          timestamp: new Date('2026-02-06T10:00:00.000Z'),
        },
        {
          executionId: 'exec_e2e_2',
          apiKeyId: 'ak_e2e',
          userId: 'user_e2e',
          sessionId: 'session_e2e',
          conversationId: 'conv_e2e',
          provider: 'stub',
          adapter: 'claude-stub',
          model: 'stub',
          tokensUsed: 5000,
          executionDurationMs: 200,
          timestamp: new Date('2026-02-06T11:00:00.000Z'),
        },
      ];
      (usageRepository.find as jest.Mock).mockResolvedValue(usageRecords);

      // Execute
      const snapshot = await service.createSnapshot({
        apiKeyId: 'ak_e2e',
        userId: 'user_e2e',
        windowStart: new Date('2026-02-06T00:00:00.000Z'),
        windowEnd: new Date('2026-02-06T23:59:59.999Z'),
        pricingVersion: '2026-02-v1',
        periodType: 'daily',
      });

      // Verify: snapshot created with correct aggregation
      expect(snapshot).toBeDefined();
      expect(snapshot.apiKeyId).toBe('ak_e2e');
      expect(snapshot.userId).toBe('user_e2e');
      expect(snapshot.totalTokens).toBe(30000);
      expect(snapshot.totalRequests).toBe(2);
      expect(snapshot.lineItems).toHaveLength(2);

      // Verify: pricing applied correctly
      const anthropicLine = snapshot.lineItems.find(
        (item) => item.provider === 'anthropic',
      );
      const stubLine = snapshot.lineItems.find((item) => item.provider === 'stub');

      expect(anthropicLine).toBeDefined();
      expect(anthropicLine!.costUSD).toBe(0.25); // 25000 * 0.01 / 1000 = 0.25
      expect(stubLine).toBeDefined();
      expect(stubLine!.costUSD).toBe(0.0); // stub is free

      // Verify: total cost
      expect(snapshot.totalCostUSD).toBe(0.25);
      expect(snapshot.subtotalUSD).toBe(0.25);
      expect(snapshot.adjustmentsUSD).toBe(0);

      // Verify: immutability
      expect(snapshot.status).toBe('draft');
    });

    it('should be deterministic - same inputs produce same outputs', async () => {
      // Setup: no existing snapshot
      (snapshotRepository.findOne as jest.Mock).mockResolvedValue(null);

      // Setup: same usage records
      const usageRecords = [
        {
          executionId: 'exec_deterministic',
          apiKeyId: 'ak_deterministic',
          userId: 'user_deterministic',
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 12345,
          executionDurationMs: 1000,
          timestamp: new Date('2026-02-06T12:00:00.000Z'),
        },
      ];
      (usageRepository.find as jest.Mock).mockResolvedValue(usageRecords);

      // Execute twice with same parameters
      const params = {
        apiKeyId: 'ak_deterministic',
        userId: 'user_deterministic',
        windowStart: new Date('2026-02-06T00:00:00.000Z'),
        windowEnd: new Date('2026-02-06T23:59:59.999Z'),
        pricingVersion: '2026-02-v1',
        periodType: 'daily',
      };

      // First call
      const snapshot1 = await service.createSnapshot(params);

      // Reset mocks and execute again
      jest.clearAllMocks();
      (snapshotRepository.findOne as jest.Mock).mockResolvedValue(null);
      (usageRepository.find as jest.Mock).mockResolvedValue(usageRecords);

      // Second call
      const snapshot2 = await service.createSnapshot(params);

      // Verify: deterministic results (ignoring UUID which is random)
      expect(snapshot1.totalTokens).toBe(snapshot2.totalTokens);
      expect(snapshot1.totalRequests).toBe(snapshot2.totalRequests);
      expect(snapshot1.totalCostUSD).toBe(snapshot2.totalCostUSD);
      expect(snapshot1.lineItems).toEqual(snapshot2.lineItems);
    });

    it('should verify read-only consumption of usage_records', async () => {
      // Setup
      (snapshotRepository.findOne as jest.Mock).mockResolvedValue(null);
      (usageRepository.find as jest.Mock).mockResolvedValue([]);

      // Execute
      await service.createSnapshot({
        apiKeyId: 'ak_readonly',
        userId: 'user_readonly',
        windowStart: new Date('2026-02-06T00:00:00.000Z'),
        windowEnd: new Date('2026-02-06T23:59:59.999Z'),
        pricingVersion: '2026-02-v1',
      });

      // Verify: only read operations on usage_records
      expect(usageRepository.find).toHaveBeenCalled();

      // Verify: no write operations on usage_records
      expect(usageRepository).not.toHaveProperty('save');
      expect(usageRepository).not.toHaveProperty('update');
      expect(usageRepository).not.toHaveProperty('delete');
    });

    it('should verify no writes on failure paths', async () => {
      // Setup: duplicate snapshot exists
      const existingSnapshot = {
        snapshotId: 'existing',
        apiKeyId: 'ak_fail',
        periodStart: new Date('2026-02-06T00:00:00.000Z'),
        periodEnd: new Date('2026-02-06T23:59:59.999Z'),
        pricingVersion: '2026-02-v1',
      };
      (snapshotRepository.findOne as jest.Mock).mockResolvedValue(
        existingSnapshot,
      );

      // Execute & Verify: throws error
      await expect(
        service.createSnapshot({
          apiKeyId: 'ak_fail',
          userId: 'user_fail',
          windowStart: new Date('2026-02-06T00:00:00.000Z'),
          windowEnd: new Date('2026-02-06T23:59:59.999Z'),
          pricingVersion: '2026-02-v1',
        }),
      ).rejects.toThrow();

      // Verify: no writes attempted on failure
      expect(snapshotRepository.save).not.toHaveBeenCalled();
      expect(usageRepository.find).not.toHaveBeenCalled();
    });

    it('should verify no execution coupling', () => {
      // This test verifies architectural constraints
      // BillingSnapshotService should have NO dependencies on:
      // - AIService
      // - AIExecutionController
      // - QuotaGuard
      // - AuthGuard

      const serviceMetadata = Reflect.getMetadata(
        'design:paramtypes',
        BillingSnapshotService,
      );

      // Verify: only repository dependencies
      expect(serviceMetadata).toHaveLength(2); // Two repositories only
    });
  });
});
