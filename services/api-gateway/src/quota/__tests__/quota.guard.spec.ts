import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { QuotaGuard } from '../quota.guard';
import { QuotaService } from '../quota.service';
import { QuotaConfig } from '../quota.config';
import { ApiKeyIdentity } from '../../auth/api-key.config';

describe('QuotaGuard', () => {
  let quotaGuard: QuotaGuard;
  let quotaService: QuotaService;
  let mockExecutionContext: ExecutionContext;
  let mockRequest: any;

  beforeEach(() => {
    const mockSessionRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const mockUsageRecordRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    quotaService = new QuotaService(mockSessionRepository as any, mockUsageRecordRepository as any);
    quotaGuard = new QuotaGuard(quotaService);

    // Mock request object
    mockRequest = {
      apiKeyIdentity: {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'],
      } as ApiKeyIdentity,
    };

    // Mock execution context
    mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    // Clear quota state before each test
    quotaService.clearAll();
  });

  describe('canActivate', () => {
    it('should allow request when quotas are available', () => {
      const result = quotaGuard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should throw 429 when request count quota exceeded', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);

      // Fill up request quota
      for (let i = 0; i < limits.requestsPerMinute; i++) {
        quotaService.recordRequest(apiKeyId);
      }

      // Next request should fail
      expect(() => quotaGuard.canActivate(mockExecutionContext)).toThrow(
        new HttpException('Quota exceeded', HttpStatus.TOO_MANY_REQUESTS),
      );
    });

    it('should throw 429 when token usage quota exceeded', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);

      // Fill up token quota (leave just enough for one more estimate)
      const estimatedTokens = QuotaConfig.estimateTokens();
      quotaService.recordTokens(apiKeyId, limits.tokensPerDay - estimatedTokens + 1);

      // Next request should fail (would exceed quota)
      expect(() => quotaGuard.canActivate(mockExecutionContext)).toThrow(
        new HttpException('Quota exceeded', HttpStatus.TOO_MANY_REQUESTS),
      );
    });

    it('should record request and token usage on success', () => {
      const apiKeyId = 'key-test';

      // Initial usage should be zero
      expect(quotaService.getCurrentUsage(apiKeyId).requests).toBe(0);
      expect(quotaService.getCurrentUsage(apiKeyId).tokens).toBe(0);

      // Allow request
      quotaGuard.canActivate(mockExecutionContext);

      // Usage should be recorded
      const usage = quotaService.getCurrentUsage(apiKeyId);
      expect(usage.requests).toBe(1);
      expect(usage.tokens).toBe(QuotaConfig.estimateTokens());
    });

    it('should throw 500 when identity is missing', () => {
      // Remove identity from request
      mockRequest.apiKeyIdentity = undefined;

      expect(() => quotaGuard.canActivate(mockExecutionContext)).toThrow(
        new HttpException(
          'Quota check failed: missing identity',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });

    it('should throw 500 when apiKeyId is missing', () => {
      // Remove apiKeyId from identity
      mockRequest.apiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: undefined,
        scopes: ['ai:execute'],
      };

      expect(() => quotaGuard.canActivate(mockExecutionContext)).toThrow(
        new HttpException(
          'Quota check failed: missing identity',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });

    it('should enforce quotas independently per apiKeyId', () => {
      const apiKeyId1 = 'key-1';
      const apiKeyId2 = 'key-2';
      const limits1 = QuotaConfig.getQuotaLimits(apiKeyId1);

      // Fill up quota for key-1
      for (let i = 0; i < limits1.requestsPerMinute; i++) {
        quotaService.recordRequest(apiKeyId1);
      }

      // key-1 should be blocked
      mockRequest.apiKeyIdentity.apiKeyId = apiKeyId1;
      expect(() => quotaGuard.canActivate(mockExecutionContext)).toThrow(
        HttpException,
      );

      // key-2 should still work
      mockRequest.apiKeyIdentity.apiKeyId = apiKeyId2;
      expect(() => quotaGuard.canActivate(mockExecutionContext)).not.toThrow();
    });

    it('should check request quota before token quota', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);

      // Fill up request quota only
      for (let i = 0; i < limits.requestsPerMinute; i++) {
        quotaService.recordRequest(apiKeyId);
      }

      // Should fail on request quota (before checking token quota)
      expect(() => quotaGuard.canActivate(mockExecutionContext)).toThrow(
        new HttpException('Quota exceeded', HttpStatus.TOO_MANY_REQUESTS),
      );

      // Token quota should not have been checked/recorded
      expect(quotaService.getCurrentUsage(apiKeyId).tokens).toBe(0);
    });

    it('should not record usage when request quota exceeded', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);

      // Fill up request quota
      for (let i = 0; i < limits.requestsPerMinute; i++) {
        quotaService.recordRequest(apiKeyId);
      }

      const beforeTokens = quotaService.getCurrentUsage(apiKeyId).tokens;

      // Try to execute (should fail)
      try {
        quotaGuard.canActivate(mockExecutionContext);
      } catch (e) {
        // Expected to throw
      }

      // Token usage should not have increased
      expect(quotaService.getCurrentUsage(apiKeyId).tokens).toBe(beforeTokens);
    });

    it('should not record usage when token quota exceeded', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);

      // Fill up token quota (leave just enough to fail next request)
      const estimatedTokens = QuotaConfig.estimateTokens();
      quotaService.recordTokens(apiKeyId, limits.tokensPerDay - estimatedTokens + 1);

      const beforeRequests = quotaService.getCurrentUsage(apiKeyId).requests;
      const beforeTokens = quotaService.getCurrentUsage(apiKeyId).tokens;

      // Try to execute (should fail)
      try {
        quotaGuard.canActivate(mockExecutionContext);
      } catch (e) {
        // Expected to throw
      }

      // Usage should not have increased
      expect(quotaService.getCurrentUsage(apiKeyId).requests).toBe(beforeRequests);
      expect(quotaService.getCurrentUsage(apiKeyId).tokens).toBe(beforeTokens);
    });
  });

  describe('deterministic behavior', () => {
    it('should produce same result for same quota state', () => {
      mockRequest.apiKeyIdentity.apiKeyId = 'key-1';
      const limits = QuotaConfig.getQuotaLimits('key-1');
      const estimatedTokens = QuotaConfig.estimateTokens();

      // First execution should always succeed on an empty quota window.
      expect(quotaGuard.canActivate(mockExecutionContext)).toBe(true);

      // Deterministically consume remaining quota until the next call exceeds.
      while (
        quotaService.getCurrentUsage('key-1').tokens + estimatedTokens <=
        limits.tokensPerDay
      ) {
        expect(quotaGuard.canActivate(mockExecutionContext)).toBe(true);
      }

      expect(() => quotaGuard.canActivate(mockExecutionContext))
        .toThrow(HttpException);
    });

    it('should consistently enforce quota limits', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);

      // Fill quota to exactly at limit
      for (let i = 0; i < limits.requestsPerMinute; i++) {
        quotaService.recordRequest(apiKeyId);
      }

      // All subsequent checks should fail consistently
      for (let i = 0; i < 5; i++) {
        expect(() => quotaGuard.canActivate(mockExecutionContext)).toThrow(
          HttpException,
        );
      }
    });
  });

  describe('error messages', () => {
    it('should throw generic error message without sensitive details', () => {
      const apiKeyId = 'key-test';
      const limits = QuotaConfig.getQuotaLimits(apiKeyId);

      // Fill up request quota
      for (let i = 0; i < limits.requestsPerMinute; i++) {
        quotaService.recordRequest(apiKeyId);
      }

      try {
        quotaGuard.canActivate(mockExecutionContext);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toBe('Quota exceeded');
        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        // Error should not contain apiKeyId or quota details
        expect(error.message).not.toContain('key-test');
        expect(error.message).not.toContain(limits.requestsPerMinute.toString());
      }
    });
  });
});
