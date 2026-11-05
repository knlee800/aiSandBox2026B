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
  // Same distance under the cap that 95000 and 93000 had under the old 100000 limit.
  // The 8000-token estimate still pushes both over QuotaConfig.MAX_TOKENS_PER_24H.
  const usageOverTokenQuota = QuotaConfig.MAX_TOKENS_PER_24H - 5000;
  const usageUnderUntilEstimate = QuotaConfig.MAX_TOKENS_PER_24H - 7000;
  const noPlanIdentity = {
    role: 'user',
    plan_override: null,
    daily_token_limit_override: null,
    plan_id: null,
  };

  function primeQueries(options: {
    usage?: number;
    identity?: Record<string, unknown> | null;
    oldest?: Date;
  }): void {
    const identity =
      options.identity === undefined ? noPlanIdentity : options.identity;
    const chain = mockQueryRunner.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(identity === null ? [] : [identity]);
    if (options.usage !== undefined) {
      chain.mockResolvedValueOnce([{ total: options.usage }]);
    }
    if (options.oldest) {
      chain.mockResolvedValueOnce([{ timestamp: options.oldest }]);
    }
  }

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
      primeQueries({ usage: 50000 });

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
      primeQueries({ usage: 50000 });

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
      primeQueries({ usage: 50000 });

      const result = await tokenQuotaGuard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should deny request when quota would be exceeded', async () => {
      primeQueries({
        usage: usageOverTokenQuota,
        oldest: new Date('2026-02-23T12:00:00Z'),
      });

      await expect(tokenQuotaGuard.canActivate(mockContext)).rejects.toThrow(
        HttpException,
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should query rolling 24h window', async () => {
      primeQueries({ usage: 50000 });

      await tokenQuotaGuard.canActivate(mockContext);

      const sumQuery = mockQueryRunner.query.mock.calls.find((call) =>
        String(call[0]).includes('SUM(tokens_used)'),
      );
      if (!sumQuery) {
        throw new Error('missing usage sum query');
      }
      expect(sumQuery[0]).toContain('SUM(tokens_used)');
      expect(sumQuery[0]).toContain('timestamp >');
      expect(sumQuery[1][0]).toBe(testUserId);
      expect(sumQuery[1][1]).toBeInstanceOf(Date);
    });

    it('should include estimated tokens in quota check', async () => {
      primeQueries({
        usage: usageUnderUntilEstimate,
        oldest: new Date('2026-02-23T12:00:00Z'),
      });

      await expect(tokenQuotaGuard.canActivate(mockContext)).rejects.toThrow(
        HttpException,
      );

      // Quota check should consider usage + the 8000-token estimate, which exceeds the cap.
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('Error Response Structure', () => {
    it('should return HTTP 429 (not 403) when quota exceeded', async () => {
      primeQueries({
        usage: usageOverTokenQuota,
        oldest: new Date('2026-02-23T12:00:00Z'),
      });

      try {
        await tokenQuotaGuard.canActivate(mockContext);
        fail('Should have thrown HttpException');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS); // 429
      }
    });

    it('should return quota 429 with details.quota_type field', async () => {
      primeQueries({
        usage: usageOverTokenQuota,
        oldest: new Date('2026-02-23T12:00:00Z'),
      });

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
        expect(response.details.used).toBe(usageOverTokenQuota);
        expect(response.details.estimated_tokens).toBe(8000);
        expect(response.details.reset_at).toBeDefined();
      }
    });

    it('should calculate reset_at as oldest usage + 24h', async () => {
      const oldestTimestamp = new Date('2026-02-23T12:00:00.000Z');
      const expectedResetAt = new Date(
        oldestTimestamp.getTime() + 24 * 60 * 60 * 1000,
      ).toISOString();

      primeQueries({ usage: usageOverTokenQuota, oldest: oldestTimestamp });

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
      primeQueries({ usage: 50000 });

      await tokenQuotaGuard.canActivate(mockContext);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should rollback transaction when quota exceeded', async () => {
      primeQueries({
        usage: usageOverTokenQuota,
        oldest: new Date('2026-02-23T12:00:00Z'),
      });

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
      primeQueries({
        usage: usageOverTokenQuota,
        oldest: new Date('2026-02-23T12:00:00Z'),
      });

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
      primeQueries({ usage: 50000 });

      await tokenQuotaGuard.canActivate(mockContext);

      // Estimation should be conservative (8000 tokens default)
      // This is tested indirectly via quota enforcement logic
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should pass prompt to estimation function', async () => {
      const longPrompt = 'x'.repeat(10000); // 10K characters
      mockRequest.body.prompt = longPrompt;

      primeQueries({ usage: 50000 });

      await tokenQuotaGuard.canActivate(mockContext);

      // Estimation should consider prompt length
      // (tested via QuotaConfig.estimateTokens)
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('ACCESS-01D plan limits and estimates', () => {
    const plans = [
      ['free', 100000],
      ['starter', 500000],
      ['pro', 1000000],
      ['team', 2000000],
    ] as const;

    async function expectLimit(
      limit: number,
      estimatedTokens: number,
    ): Promise<void> {
      try {
        await tokenQuotaGuard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error) {
        const response = (error as HttpException).getResponse() as {
          details: { limit: number; estimated_tokens: number; quota_type: string };
        };
        expect(response.details.quota_type).toBe('max_tokens_per_24h');
        expect(response.details.limit).toBe(limit);
        expect(response.details.estimated_tokens).toBe(estimatedTokens);
      }
    }

    it.each(plans)(
      'enforces the %s dailyTokenLimit',
      async (planId, limit) => {
        primeQueries({
          usage: limit - 5000,
          identity: {
            role: 'user',
            plan_override: null,
            daily_token_limit_override: null,
            plan_id: planId,
          },
          oldest: new Date('2026-02-23T12:00:00Z'),
        });

        await expectLimit(limit, 8000);
      },
    );

    it('allows a team plan past the fallback cap', async () => {
      primeQueries({
        usage: 1500000,
        identity: {
          role: 'user',
          plan_override: null,
          daily_token_limit_override: null,
          plan_id: 'team',
        },
      });

      await expect(tokenQuotaGuard.canActivate(mockContext)).resolves.toBe(true);
    });

    it('uses plan_override ahead of credit_balances.plan_id', async () => {
      primeQueries({
        usage: 495000,
        identity: {
          role: 'user',
          plan_override: 'starter',
          daily_token_limit_override: null,
          plan_id: 'team',
        },
        oldest: new Date('2026-02-23T12:00:00Z'),
      });

      await expectLimit(500000, 8000);
    });

    it('uses daily_token_limit_override ahead of the plan', async () => {
      primeQueries({
        usage: 1100000,
        identity: {
          role: 'user',
          plan_override: 'free',
          daily_token_limit_override: 1200000,
          plan_id: 'free',
        },
      });

      await expect(tokenQuotaGuard.canActivate(mockContext)).resolves.toBe(true);

      primeQueries({
        usage: 1195000,
        identity: {
          role: 'user',
          plan_override: 'team',
          daily_token_limit_override: 1200000,
          plan_id: 'pro',
        },
        oldest: new Date('2026-02-23T12:00:00Z'),
      });

      await expectLimit(1200000, 8000);
    });

    it('falls back to MAX_TOKENS_PER_24H when no known plan resolves', async () => {
      primeQueries({
        usage: usageOverTokenQuota,
        identity: {
          role: 'user',
          plan_override: 'enterprise',
          daily_token_limit_override: null,
          plan_id: 'no-such-plan',
        },
        oldest: new Date('2026-02-23T12:00:00Z'),
      });

      await expectLimit(QuotaConfig.MAX_TOKENS_PER_24H, 8000);
    });

    it('uses credit_balances.plan_id when plan_override is unknown', async () => {
      primeQueries({
        usage: 495000,
        identity: {
          role: 'user',
          plan_override: 'enterprise',
          daily_token_limit_override: null,
          plan_id: 'starter',
        },
        oldest: new Date('2026-02-23T12:00:00Z'),
      });

      await expectLimit(500000, 8000);
    });

    it('checks a non-uuid user id with no matching rows against MAX_TOKENS_PER_24H', async () => {
      mockRequest.apiKeyIdentity.userId = 'test-user';
      primeQueries({
        usage: usageOverTokenQuota,
        identity: null,
        oldest: new Date('2026-02-23T12:00:00Z'),
      });

      try {
        await tokenQuotaGuard.canActivate(mockContext);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
        const response = (error as HttpException).getResponse() as {
          details: { limit: number };
        };
        expect(response.details.limit).toBe(QuotaConfig.MAX_TOKENS_PER_24H);
      }

      const accessSql = String(mockQueryRunner.query.mock.calls[1][0]);
      expect(accessSql).toContain('u.id::text = $1');
      expect(accessSql).toContain('e.user_id::text = $1');
      expect(accessSql).toContain('b.owner_id = $1');
      expect(accessSql).not.toContain('::uuid');
      expect(mockQueryRunner.query.mock.calls[1][1]).toEqual(['test-user']);
    });

    it('treats a missing access row as the MAX_TOKENS_PER_24H fallback', async () => {
      primeQueries({
        usage: usageOverTokenQuota,
        identity: null,
        oldest: new Date('2026-02-23T12:00:00Z'),
      });

      await expectLimit(QuotaConfig.MAX_TOKENS_PER_24H, 8000);
    });

    it('lets an admin skip the token check', async () => {
      primeQueries({
        identity: {
          role: 'admin',
          plan_override: null,
          daily_token_limit_override: null,
          plan_id: 'free',
        },
      });

      await expect(tokenQuotaGuard.canActivate(mockContext)).resolves.toBe(true);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(
        mockQueryRunner.query.mock.calls.some((call) =>
          String(call[0]).includes('SUM(tokens_used)'),
        ),
      ).toBe(false);
    });

    it('estimates an Agent run at 60000 tokens', async () => {
      mockRequest.body.harnessVersion = 'v1';
      primeQueries({
        usage: QuotaConfig.MAX_TOKENS_PER_24H - 10000,
        oldest: new Date('2026-02-23T12:00:00Z'),
      });

      await expectLimit(QuotaConfig.MAX_TOKENS_PER_24H, 60000);
    });

    it('keeps the normal estimate when harnessVersion is absent', async () => {
      primeQueries({ usage: QuotaConfig.MAX_TOKENS_PER_24H - 10000 });

      await expect(tokenQuotaGuard.canActivate(mockContext)).resolves.toBe(true);
    });

    it('uses 60000 for harnessVersion even when the prompt is long', async () => {
      mockRequest.body = {
        harnessVersion: 'v1',
        prompt: 'x'.repeat(40000),
      };
      primeQueries({
        usage: 0,
        identity: {
          role: 'user',
          plan_override: null,
          daily_token_limit_override: 50000,
          plan_id: 'team',
        },
        oldest: new Date('2026-02-23T12:00:00Z'),
      });

      await expectLimit(50000, 60000);
    });

    it('reads role, entitlements and the balance plan inside the transaction', async () => {
      primeQueries({ usage: 50000 });
      await tokenQuotaGuard.canActivate(mockContext);

      const accessCall = mockQueryRunner.query.mock.calls[1];
      expect(String(accessCall[0])).toContain('JOIN users u');
      expect(String(accessCall[0])).toContain('user_entitlements');
      expect(String(accessCall[0])).toContain('plan_override');
      expect(String(accessCall[0])).toContain('daily_token_limit_override');
      expect(String(accessCall[0])).toContain('credit_balances');
      expect(String(accessCall[0])).not.toContain('SUM(tokens_used)');
      expect(accessCall[1]).toEqual([testUserId]);
      expect(String(mockQueryRunner.query.mock.calls[0][0])).toContain(
        'pg_advisory_xact_lock',
      );
    });
  });
});
