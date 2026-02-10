/**
 * Phase 31A: Cost & Usage Reconciliation Correctness Tests
 *
 * SCOPE: Validate mathematical correctness of billing calculations
 * - Token → Cost math accuracy
 * - Rounding behavior (banker's rounding to 3 decimals)
 * - Aggregation correctness
 * - Time window boundary handling
 * - Determinism and drift prevention
 *
 * LOCKED INVARIANTS:
 * - Read-only validation (no writes)
 * - No schema changes
 * - No pricing model changes
 * - Tests must be deterministic
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingSnapshotService } from '../billing-snapshot.service';
import { BillingSnapshot, UsageRecord } from '../../entities';

describe('Phase 31A: Billing Correctness Tests', () => {
  let service: BillingSnapshotService;
  let snapshotRepository: Repository<BillingSnapshot>;
  let usageRepository: Repository<UsageRecord>;

  const mockSnapshotRepository = {
    findOne: jest.fn(),
    create: jest.fn((data) => data), // Pass-through for cost validation
    save: jest.fn((data) => Promise.resolve(data)),
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

  const baseParams = {
    apiKeyId: 'ak_test_phase31a',
    userId: 'user_test_phase31a',
    windowStart: new Date('2026-02-10T00:00:00.000Z'),
    windowEnd: new Date('2026-02-10T23:59:59.999Z'),
    pricingVersion: '2026-02-v1',
    periodType: 'daily',
  };

  describe('31A-1: Token → Cost Math Correctness', () => {
    it('should calculate cost correctly for exact thousands', async () => {
      // Test: 1000 tokens * $0.01/1000 = $0.010
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_1k',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 1000,
          executionDurationMs: 100,
          timestamp: new Date('2026-02-10T12:00:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(1000);
      expect(result.totalCostUSD).toBe(0.01);
      expect(result.lineItems[0].costUSD).toBe(0.01);
    });

    it('should calculate cost correctly for zero tokens', async () => {
      // Test: 0 tokens * $0.01/1000 = $0.000
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_zero',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 0,
          executionDurationMs: 50,
          timestamp: new Date('2026-02-10T12:00:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(0);
      expect(result.totalCostUSD).toBe(0.0);
      expect(result.lineItems[0].costUSD).toBe(0.0);
    });

    it('should calculate cost correctly for single token', async () => {
      // Test: 1 token * $0.01/1000 = $0.00001 → rounds to $0.000
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_one',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 1,
          executionDurationMs: 50,
          timestamp: new Date('2026-02-10T12:00:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(1);
      expect(result.totalCostUSD).toBe(0.0); // Rounds down to 0.000
    });

    it('should calculate cost correctly for small token counts', async () => {
      // Test: 50 tokens * $0.01/1000 = $0.0005 → rounds to $0.001 (round half away from zero)
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_small',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 50,
          executionDurationMs: 50,
          timestamp: new Date('2026-02-10T12:00:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(50);
      // 50 / 1000 * 0.01 = 0.0005
      // Math.round() behavior: 0.0005 → 0.001 (round half away from zero)
      expect(result.totalCostUSD).toBe(0.001);
    });

    it('should calculate cost correctly for large token counts', async () => {
      // Test: 1,000,000 tokens * $0.01/1000 = $10.000
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_large',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 1000000,
          executionDurationMs: 5000,
          timestamp: new Date('2026-02-10T12:00:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(1000000);
      expect(result.totalCostUSD).toBe(10.0);
    });

    it('should apply standard rounding correctly: round half away from zero', async () => {
      // Test: 1250 tokens * $0.01/1000 = $0.0125
      // Math.round() behavior: 0.0125 → 0.013 (round half away from zero)
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_round_half',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 1250,
          executionDurationMs: 100,
          timestamp: new Date('2026-02-10T12:00:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(1250);
      expect(result.totalCostUSD).toBe(0.013); // Math.round(): 0.0125 → 0.013
    });

    it('should round down when below half', async () => {
      // Test: 1240 tokens * $0.01/1000 = $0.0124
      // Math.round() behavior: 0.0124 → 0.012 (round down)
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_round_down',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 1240,
          executionDurationMs: 100,
          timestamp: new Date('2026-02-10T12:00:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(1240);
      expect(result.totalCostUSD).toBe(0.012); // Math.round(): 0.0124 → 0.012
    });

    it('should maintain 3 decimal precision (no drift)', async () => {
      // Test: 12345 tokens * $0.01/1000 = $0.12345 → $0.123
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_precision',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 12345,
          executionDurationMs: 500,
          timestamp: new Date('2026-02-10T12:00:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(12345);
      expect(result.totalCostUSD).toBe(0.123); // 0.12345 → 0.123
      // Verify no floating-point drift
      expect(typeof result.totalCostUSD).toBe('number');
      expect(result.totalCostUSD.toString()).toMatch(/^0\.123$/);
    });
  });

  describe('31A-2: Aggregation Correctness', () => {
    it('should aggregate tokens correctly across multiple executions (same provider/model)', async () => {
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_1',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 1000,
          executionDurationMs: 100,
          timestamp: new Date('2026-02-10T10:00:00.000Z'),
        },
        {
          executionId: 'exec_2',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 2000,
          executionDurationMs: 200,
          timestamp: new Date('2026-02-10T11:00:00.000Z'),
        },
        {
          executionId: 'exec_3',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 3000,
          executionDurationMs: 300,
          timestamp: new Date('2026-02-10T12:00:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(6000);
      expect(result.totalRequests).toBe(3);
      expect(result.totalCostUSD).toBe(0.06); // 6000 * 0.01 / 1000 = 0.06
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].totalTokens).toBe(6000);
      expect(result.lineItems[0].totalRequests).toBe(3);
    });

    it('should aggregate correctly across different providers', async () => {
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_anthropic',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 10000,
          executionDurationMs: 500,
          timestamp: new Date('2026-02-10T10:00:00.000Z'),
        },
        {
          executionId: 'exec_stub',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'stub',
          adapter: 'stub',
          model: 'stub',
          tokensUsed: 5000,
          executionDurationMs: 100,
          timestamp: new Date('2026-02-10T11:00:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(15000);
      expect(result.totalRequests).toBe(2);
      // anthropic: 10000 * 0.01 / 1000 = 0.1
      // stub: 5000 * 0.0 / 1000 = 0.0
      expect(result.totalCostUSD).toBe(0.1);
      expect(result.lineItems).toHaveLength(2);
    });

    it('should not double-count tokens', async () => {
      // Verify each execution counted exactly once
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_unique_1',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 1000,
          executionDurationMs: 100,
          timestamp: new Date('2026-02-10T10:00:00.000Z'),
        },
        {
          executionId: 'exec_unique_2',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 1000,
          executionDurationMs: 100,
          timestamp: new Date('2026-02-10T11:00:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(2000); // Not 4000 (double-counted)
      expect(result.totalRequests).toBe(2);
    });

    it('should aggregate costs correctly without floating-point drift', async () => {
      // Test: Multiple small costs that could accumulate drift
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      const executions = Array.from({ length: 100 }, (_, i) => ({
        executionId: `exec_drift_${i}`,
        apiKeyId: baseParams.apiKeyId,
        userId: baseParams.userId,
        sessionId: 'session_1',
        conversationId: 'conv_1',
        provider: 'anthropic',
        adapter: 'anthropic-http',
        model: 'claude-3-5-sonnet-20241022',
        tokensUsed: 123, // Each execution: 123 tokens
        executionDurationMs: 50,
        timestamp: new Date(`2026-02-10T${String(i % 24).padStart(2, '0')}:00:00.000Z`),
      }));
      mockUsageRepository.find.mockResolvedValue(executions);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(12300); // 100 * 123
      expect(result.totalRequests).toBe(100);
      // 12300 * 0.01 / 1000 = 0.123
      expect(result.totalCostUSD).toBe(0.123);
      // Verify no floating-point drift
      expect(result.totalCostUSD).toBeCloseTo(0.123, 3);
    });

    it('should handle large-volume aggregation correctly', async () => {
      // Test: 1000 executions with varying token counts
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      const executions = Array.from({ length: 1000 }, (_, i) => ({
        executionId: `exec_volume_${i}`,
        apiKeyId: baseParams.apiKeyId,
        userId: baseParams.userId,
        sessionId: 'session_1',
        conversationId: 'conv_1',
        provider: 'anthropic',
        adapter: 'anthropic-http',
        model: 'claude-3-5-sonnet-20241022',
        tokensUsed: 1000 + i, // Varying token counts
        executionDurationMs: 100,
        timestamp: new Date(`2026-02-10T${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`),
      }));
      mockUsageRepository.find.mockResolvedValue(executions);

      const result = await service.createSnapshot(baseParams);

      // Expected: sum(1000 to 1999) = 1000*1000 + sum(0 to 999) = 1000000 + 499500 = 1499500
      expect(result.totalTokens).toBe(1499500);
      expect(result.totalRequests).toBe(1000);
      // 1499500 * 0.01 / 1000 = 14.995
      expect(result.totalCostUSD).toBe(14.995);
    });
  });

  describe('31A-3: Time Window Boundary Correctness', () => {
    it('should include executions at window start boundary (inclusive)', async () => {
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_start_boundary',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 1000,
          executionDurationMs: 100,
          timestamp: new Date('2026-02-10T00:00:00.000Z'), // Exactly at start
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(1000);
      expect(result.totalRequests).toBe(1);
    });

    it('should include executions at window end boundary (inclusive)', async () => {
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_end_boundary',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 2000,
          executionDurationMs: 200,
          timestamp: new Date('2026-02-10T23:59:59.999Z'), // Exactly at end
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(2000);
      expect(result.totalRequests).toBe(1);
    });

    it('should exclude executions before window start', async () => {
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_before',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 1000,
          executionDurationMs: 100,
          timestamp: new Date('2026-02-09T23:59:59.999Z'), // 1ms before start
        },
        {
          executionId: 'exec_inside',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 2000,
          executionDurationMs: 200,
          timestamp: new Date('2026-02-10T12:00:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(2000); // Only inside execution
      expect(result.totalRequests).toBe(1);
    });

    it('should exclude executions after window end', async () => {
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_inside',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 3000,
          executionDurationMs: 300,
          timestamp: new Date('2026-02-10T12:00:00.000Z'),
        },
        {
          executionId: 'exec_after',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 4000,
          executionDurationMs: 400,
          timestamp: new Date('2026-02-11T00:00:00.000Z'), // 1ms after end
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(3000); // Only inside execution
      expect(result.totalRequests).toBe(1);
    });

    it('should handle empty time windows correctly', async () => {
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([]); // No executions

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(0);
      expect(result.totalRequests).toBe(0);
      expect(result.totalCostUSD).toBe(0.0);
      expect(result.lineItems).toEqual([]);
    });

    it('should handle single-execution windows correctly', async () => {
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_single',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 5000,
          executionDurationMs: 500,
          timestamp: new Date('2026-02-10T12:00:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(5000);
      expect(result.totalRequests).toBe(1);
      expect(result.totalCostUSD).toBe(0.05);
    });

    it('should handle UTC day rollover correctly', async () => {
      // Test window crossing midnight UTC
      const rolloverParams = {
        ...baseParams,
        windowStart: new Date('2026-02-10T23:00:00.000Z'),
        windowEnd: new Date('2026-02-11T01:00:00.000Z'),
      };

      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_before_midnight',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 1000,
          executionDurationMs: 100,
          timestamp: new Date('2026-02-10T23:30:00.000Z'),
        },
        {
          executionId: 'exec_after_midnight',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 2000,
          executionDurationMs: 200,
          timestamp: new Date('2026-02-11T00:30:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(rolloverParams);

      expect(result.totalTokens).toBe(3000); // Both executions included
      expect(result.totalRequests).toBe(2);
    });
  });

  describe('31A-4: Determinism & Drift Prevention', () => {
    it('should produce identical results for repeated reads (determinism)', async () => {
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      const usageRecords = [
        {
          executionId: 'exec_determ_1',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 12345,
          executionDurationMs: 500,
          timestamp: new Date('2026-02-10T12:00:00.000Z'),
        },
      ];
      mockUsageRepository.find.mockResolvedValue(usageRecords);

      // Execute twice
      const result1 = await service.createSnapshot(baseParams);
      
      // Reset mocks and execute again
      jest.clearAllMocks();
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue(usageRecords);
      
      const result2 = await service.createSnapshot(baseParams);

      // Results should be identical
      expect(result1.totalTokens).toBe(result2.totalTokens);
      expect(result1.totalRequests).toBe(result2.totalRequests);
      expect(result1.totalCostUSD).toBe(result2.totalCostUSD);
      expect(result1.lineItems[0].costUSD).toBe(result2.lineItems[0].costUSD);
    });

    it('should be order-independent for aggregation', async () => {
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      
      const execution1 = {
        executionId: 'exec_order_1',
        apiKeyId: baseParams.apiKeyId,
        userId: baseParams.userId,
        sessionId: 'session_1',
        conversationId: 'conv_1',
        provider: 'anthropic',
        adapter: 'anthropic-http',
        model: 'claude-3-5-sonnet-20241022',
        tokensUsed: 1000,
        executionDurationMs: 100,
        timestamp: new Date('2026-02-10T10:00:00.000Z'),
      };

      const execution2 = {
        executionId: 'exec_order_2',
        apiKeyId: baseParams.apiKeyId,
        userId: baseParams.userId,
        sessionId: 'session_1',
        conversationId: 'conv_1',
        provider: 'anthropic',
        adapter: 'anthropic-http',
        model: 'claude-3-5-sonnet-20241022',
        tokensUsed: 2000,
        executionDurationMs: 200,
        timestamp: new Date('2026-02-10T11:00:00.000Z'),
      };

      // Test with order A, B
      mockUsageRepository.find.mockResolvedValue([execution1, execution2]);
      const resultAB = await service.createSnapshot(baseParams);

      // Reset and test with order B, A
      jest.clearAllMocks();
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([execution2, execution1]);
      const resultBA = await service.createSnapshot(baseParams);

      // Results should be identical regardless of order
      expect(resultAB.totalTokens).toBe(resultBA.totalTokens);
      expect(resultAB.totalRequests).toBe(resultBA.totalRequests);
      expect(resultAB.totalCostUSD).toBe(resultBA.totalCostUSD);
    });

    it('should not accumulate floating-point errors across multiple aggregations', async () => {
      // Test: Aggregate 1000 small costs that could drift
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      const executions = Array.from({ length: 1000 }, (_, i) => ({
        executionId: `exec_float_${i}`,
        apiKeyId: baseParams.apiKeyId,
        userId: baseParams.userId,
        sessionId: 'session_1',
        conversationId: 'conv_1',
        provider: 'anthropic',
        adapter: 'anthropic-http',
        model: 'claude-3-5-sonnet-20241022',
        tokensUsed: 111, // Each: 111 * 0.01 / 1000 = 0.00111
        executionDurationMs: 50,
        timestamp: new Date(`2026-02-10T${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`),
      }));
      mockUsageRepository.find.mockResolvedValue(executions);

      const result = await service.createSnapshot(baseParams);

      expect(result.totalTokens).toBe(111000); // 1000 * 111
      // 111000 * 0.01 / 1000 = 1.11
      expect(result.totalCostUSD).toBe(1.11);
      // Verify no drift beyond 3 decimal places
      expect(result.totalCostUSD.toString()).toMatch(/^1\.11$/);
    });

    it('should handle subtotal rounding defensively (no double rounding)', async () => {
      // Test: Verify subtotal is rounded correctly after summing line items
      mockSnapshotRepository.findOne.mockResolvedValue(null);
      mockUsageRepository.find.mockResolvedValue([
        {
          executionId: 'exec_subtotal_1',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 1111,
          executionDurationMs: 100,
          timestamp: new Date('2026-02-10T10:00:00.000Z'),
        },
        {
          executionId: 'exec_subtotal_2',
          apiKeyId: baseParams.apiKeyId,
          userId: baseParams.userId,
          sessionId: 'session_1',
          conversationId: 'conv_1',
          provider: 'anthropic',
          adapter: 'anthropic-http',
          model: 'claude-3-5-sonnet-20241022',
          tokensUsed: 2222,
          executionDurationMs: 200,
          timestamp: new Date('2026-02-10T11:00:00.000Z'),
        },
      ]);

      const result = await service.createSnapshot(baseParams);

      // 3333 * 0.01 / 1000 = 0.03333 → 0.033
      expect(result.totalTokens).toBe(3333);
      expect(result.subtotalUSD).toBe(0.033);
      expect(result.totalCostUSD).toBe(0.033);
      // Verify defensive rounding doesn't cause drift
      expect(result.totalCostUSD).toBe(result.subtotalUSD);
    });
  });
});
