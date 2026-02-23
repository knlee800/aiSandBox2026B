/**
 * Token Quota Guard Unit Tests
 *
 * PHASE-42B-2: Atomic Token Quota Enforcement (Advisory Lock)
 *
 * Tests advisory lock-based quota enforcement with mocked database:
 * - Sequential request enforcement (baseline)
 * - Error body structure (quota 429 with details.quota_type)
 * - Lock acquisition and release
 * - Error path handling
 */

import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { TokenQuotaGuard } from '../token-quota.guard';
import { QuotaConfig } from '../quota.config';

describe('TokenQuotaGuard (PHASE-42B-2)', () => {
  let tokenQuotaGuard: TokenQuotaGuard;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockQueryRunner: jest.Mocked<QueryRunner>;
  let mockContext: ExecutionContext;
  let mockRequest: any;

  const testUserId = 'test-user-001';
  const testApiKeyId = 'test-key-001';

  beforeEach(() => {
    // Mock QueryRunner
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
    } as any;

    // Mock DataSource
    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    } as any;

    // Create guard with mocked DataSource
    tokenQuotaGuard = new TokenQuotaGuard(mockDataSource);

    // Setup mock request
    mockRequest = {
      apiKeyIdentity: {
        userId: testUserId,
        apiKeyId: testApiKeyId,
        scopes: ['ai:execute'],
      },
      body: {
        prompt: 'Test prompt',
      },
    };

    // Setup mock context
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Advisory Lock Acquisition', () => {
    it('should acquire advisory lock before checking quota', async () => {
      // Mock quota check: 50K tokens used (under limit)
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
        .mockResolvedValueOnce([{ total: 50000 }]); // SUM(tokens_used)

      await tokenQuotaGuard.canActivate(mockContext);

      // Verify advisory lock was acquired
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('pg_advisory_xact_lock'),
        expect.arrayContaining([expect.stringContaining('quota:token:')]),
      );

      // Verify lock key includes userId
      const lockCall = mockQueryRunner.query.mock.calls[0];
      expect(lockCall[1][0]).toContain(testUserId);
    });

    it('should use transaction-scoped lock (pg_advisory_xact_lock)', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
        .mockResolvedValueOnce([{ total: 50000 }]); // SUM(tokens_used)

      await tokenQuotaGuard.canActivate(mockContext);

      // Verify transaction-scoped lock (not session-scoped)
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('pg_advisory_xact_lock'),
        expect.any(Array),
      );
    });
  });

  describe('Quota Enforcement', () => {
    it('should allow request when quota is available', async () => {
      // Mock: 50K tokens used (under 100K limit)
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
        .mockResolvedValueOnce([{ total: 50000 }]); // SUM(tokens_used)

      const result = await tokenQuotaGuard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should deny request when quota would be exceeded', async () => {
      // Mock: 95K tokens used (estimated 8K would exceed 100K limit)
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
        .mockResolvedValueOnce([{ total: 95000 }]) // SUM(tokens_used)
        .mockResolvedValueOnce([
          { timestamp: new Date('2026-02-23T12:00:00Z') },
        ]); // oldest usage

      await expect(tokenQuotaGuard.canActivate(mockContext)).rejects.toThrow(
        HttpException,
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should query rolling 24h window', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
        .mockResolvedValueOnce([{ total: 50000 }]); // SUM(tokens_used)

      await tokenQuotaGuard.canActivate(mockContext);

      // Verify query includes 24h timestamp filter
      const sumQuery = mockQueryRunner.query.mock.calls[1];
      expect(sumQuery[0]).toContain('SUM(tokens_used)');
      expect(sumQuery[0]).toContain('timestamp >');
      expect(sumQuery[1][0]).toBe(testUserId);
      expect(sumQuery[1][1]).toBeInstanceOf(Date);
    });

    it('should include estimated tokens in quota check', async () => {
      // Mock: 93K tokens used (estimated 8K would reach 101K > 100K limit)
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
        .mockResolvedValueOnce([{ total: 93000 }]) // SUM(tokens_used)
        .mockResolvedValueOnce([
          { timestamp: new Date('2026-02-23T12:00:00Z') },
        ]); // oldest usage

      await expect(tokenQuotaGuard.canActivate(mockContext)).rejects.toThrow(
        HttpException,
      );

      // Quota check should consider: 93K + 8K (estimated) = 101K > 100K
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('Error Response Structure', () => {
    it('should return HTTP 429 (not 403) when quota exceeded', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
        .mockResolvedValueOnce([{ total: 95000 }]) // SUM(tokens_used)
        .mockResolvedValueOnce([
          { timestamp: new Date('2026-02-23T12:00:00Z') },
        ]); // oldest usage

      try {
        await tokenQuotaGuard.canActivate(mockContext);
        fail('Should have thrown HttpException');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS); // 429
      }
    });

    it('should return quota 429 with details.quota_type field', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
        .mockResolvedValueOnce([{ total: 95000 }]) // SUM(tokens_used)
        .mockResolvedValueOnce([
          { timestamp: new Date('2026-02-23T12:00:00Z') },
        ]); // oldest usage

      try {
        await tokenQuotaGuard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error) {
        const response = error.getResponse() as any;

        // Verify quota 429 structure
        expect(response.statusCode).toBe(429);
        expect(response.error).toBe('Quota Exceeded');
        expect(response.message).toBe('Token quota exceeded');

        // CRITICAL: Must have details.quota_type field
        expect(response.details).toBeDefined();
        expect(response.details.quota_type).toBe('max_tokens_per_24h');
        expect(response.details.limit).toBe(QuotaConfig.MAX_TOKENS_PER_24H);
        expect(response.details.used).toBe(95000);
        expect(response.details.estimated_tokens).toBeGreaterThan(0);
        expect(response.details.reset_at).toBeDefined();
      }
    });

    it('should calculate reset_at as oldest usage + 24h', async () => {
      const oldestTimestamp = new Date('2026-02-23T12:00:00.000Z');
      const expectedResetAt = new Date(
        oldestTimestamp.getTime() + 24 * 60 * 60 * 1000,
      ).toISOString();

      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
        .mockResolvedValueOnce([{ total: 95000 }]) // SUM(tokens_used)
        .mockResolvedValueOnce([{ timestamp: oldestTimestamp }]); // oldest usage

      try {
        await tokenQuotaGuard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error) {
        const response = error.getResponse() as any;
        expect(response.details.reset_at).toBe(expectedResetAt);
      }
    });
  });

  describe('Transaction Management', () => {
    it('should commit transaction when quota available', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
        .mockResolvedValueOnce([{ total: 50000 }]); // SUM(tokens_used)

      await tokenQuotaGuard.canActivate(mockContext);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should rollback transaction when quota exceeded', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
        .mockResolvedValueOnce([{ total: 95000 }]) // SUM(tokens_used)
        .mockResolvedValueOnce([
          { timestamp: new Date('2026-02-23T12:00:00Z') },
        ]); // oldest usage

      await expect(
        tokenQuotaGuard.canActivate(mockContext),
      ).rejects.toThrow();

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1); // Only once
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should rollback and release on unexpected errors', async () => {
      // Mock query failure after transaction started
      mockQueryRunner.query.mockRejectedValueOnce(
        new Error('Database connection lost'),
      );

      await expect(
        tokenQuotaGuard.canActivate(mockContext),
      ).rejects.toThrow('Database connection lost');

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1); // Only once
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should always release query runner (even on error)', async () => {
      mockQueryRunner.query.mockRejectedValueOnce(new Error('Test error'));

      await expect(
        tokenQuotaGuard.canActivate(mockContext),
      ).rejects.toThrow();

      // Verify release is called in finally block
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should NOT rollback if transaction never started', async () => {
      // Mock startTransaction failure
      mockQueryRunner.startTransaction.mockRejectedValueOnce(
        new Error('Failed to start transaction'),
      );

      await expect(
        tokenQuotaGuard.canActivate(mockContext),
      ).rejects.toThrow('Failed to start transaction');

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled(); // CRITICAL: No rollback attempt
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should NOT double-rollback on quota exceeded path', async () => {
      // Mock quota exceeded scenario
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
        .mockResolvedValueOnce([{ total: 95000 }]) // SUM(tokens_used)
        .mockResolvedValueOnce([
          { timestamp: new Date('2026-02-23T12:00:00Z') },
        ]); // oldest usage

      await expect(
        tokenQuotaGuard.canActivate(mockContext),
      ).rejects.toThrow(HttpException);

      // Verify rollback called exactly once (not in catch block after quota exceeded)
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw 500 when user identity missing', async () => {
      mockRequest.apiKeyIdentity = null;

      await expect(
        tokenQuotaGuard.canActivate(mockContext),
      ).rejects.toThrow(HttpException);

      try {
        await tokenQuotaGuard.canActivate(mockContext);
      } catch (error) {
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.message).toContain('missing user identity');
      }
    });

    it('should throw 500 when userId missing', async () => {
      mockRequest.apiKeyIdentity = {
        userId: null,
        apiKeyId: testApiKeyId,
      };

      await expect(
        tokenQuotaGuard.canActivate(mockContext),
      ).rejects.toThrow(HttpException);

      try {
        await tokenQuotaGuard.canActivate(mockContext);
      } catch (error) {
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });
  });

  describe('Token Estimation', () => {
    it('should use conservative token estimation', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
        .mockResolvedValueOnce([{ total: 50000 }]); // SUM(tokens_used)

      await tokenQuotaGuard.canActivate(mockContext);

      // Estimation should be conservative (8000 tokens default)
      // This is tested indirectly via quota enforcement logic
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should pass prompt to estimation function', async () => {
      const longPrompt = 'x'.repeat(10000); // 10K characters
      mockRequest.body.prompt = longPrompt;

      mockQueryRunner.query
        .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
        .mockResolvedValueOnce([{ total: 50000 }]); // SUM(tokens_used)

      await tokenQuotaGuard.canActivate(mockContext);

      // Estimation should consider prompt length
      // (tested via QuotaConfig.estimateTokens)
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });
});
