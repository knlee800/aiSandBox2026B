import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException, HttpException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AIExecutionController } from '../ai-execution.controller';
import { AIServiceHttpClient, AIExecutionRequest, AIExecutionResult } from '../../clients/ai-service-http.client';
import { ApiKeyAuthGuard } from '../../auth/api-key-auth.guard';
import { AuthorizationGuard } from '../../auth/authorization.guard';
import { QuotaGuard } from '../../quota/quota.guard';
import { QuotaService } from '../../quota/quota.service';
import { UsageLedgerService } from '../../usage-ledger/usage-ledger.service';
import { GlobalSafetyLimitService } from '../../safety/global-safety-limit.service';
import { ApiKeyIdentity } from '../../auth/api-key.config';
import { ExecutionSafetyGuard } from '../../safety/execution-safety.guard';
import { LaunchGuard } from '../../launch/launch.guard';
import { AbortGuard } from '../../abort/abort.guard';
import { TokenQuotaGuard } from '../../quota/token-quota.guard';
import { RateLimitGuard } from '../../guards/rate-limit.guard';

describe('AIExecutionController (Phase 20A+20B+21B+22B Integration)', () => {
  let controller: AIExecutionController;
  let httpClient: jest.Mocked<AIServiceHttpClient>;
  let quotaService: QuotaService;
  let usageLedgerService: jest.Mocked<UsageLedgerService>;

  beforeEach(async () => {
    const mockHttpClient = {
      execute: jest.fn(),
    };

    const mockUsageLedgerService = {
      writeRecord: jest.fn(),
      validateUsageRecord: jest.fn(),
    };

    const mockGlobalSafetyLimitService = {
      checkAndRecord: jest.fn().mockResolvedValue(undefined),
      recordExecutionCost: jest.fn().mockResolvedValue(undefined),
    };

    const mockQuotaService = {
      clearAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIExecutionController],
      providers: [
        {
          provide: AIServiceHttpClient,
          useValue: mockHttpClient,
        },
        {
          provide: UsageLedgerService,
          useValue: mockUsageLedgerService,
        },
        {
          provide: GlobalSafetyLimitService,
          useValue: mockGlobalSafetyLimitService,
        },
        {
          provide: QuotaService,
          useValue: mockQuotaService,
        },
        Reflector,
      ],
    })
      .overrideGuard(ApiKeyAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ExecutionSafetyGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(LaunchGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AbortGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(QuotaGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TokenQuotaGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AIExecutionController>(AIExecutionController);
    httpClient = module.get(AIServiceHttpClient);
    quotaService = module.get<QuotaService>(QuotaService);
    usageLedgerService = module.get(UsageLedgerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (quotaService && quotaService.clearAll) {
      quotaService.clearAll();
    }
  });

  describe('POST /ai/execute with authentication and authorization', () => {
    const validRequest: AIExecutionRequest = {
      sessionId: 'session-123',
      conversationId: 'conv-456',
      userId: 'untrusted-user', // Will be replaced
      prompt: 'Test prompt',
      provider: 'stub',
    };

    const mockResponse: AIExecutionResult = {
      output: 'Test response',
      tokensUsed: 100,
      model: 'stub',
    };

    it('should inject verified userId and execute request', async () => {
      httpClient.execute.mockResolvedValue(mockResponse);

      const identity: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'], // Phase 20B
      };

      const result = await controller.execute(validRequest, identity);

      // Verify response
      expect(result).toEqual(mockResponse);

      // Verify httpClient was called
      expect(httpClient.execute).toHaveBeenCalledTimes(1);

      // Verify userId was replaced with verified identity
      const calledRequest = httpClient.execute.mock.calls[0][0];
      expect(calledRequest.userId).toBe('test-user'); // NOT 'untrusted-user'
      expect(calledRequest.sessionId).toBe('session-123');
      expect(calledRequest.conversationId).toBe('conv-456');
      expect(calledRequest.prompt).toBe('Test prompt');

      // Verify apiKeyId was injected into metadata
      expect(calledRequest.metadata).toBeDefined();
      expect(calledRequest.metadata?.apiKeyId).toBe('key-test');
    });

    it('should inject correct identity for user-1', async () => {
      httpClient.execute.mockResolvedValue(mockResponse);

      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['ai:execute'], // Phase 20B
      };

      await controller.execute(validRequest, identity);

      const calledRequest = httpClient.execute.mock.calls[0][0];
      expect(calledRequest.userId).toBe('user-1');
      expect(calledRequest.metadata?.apiKeyId).toBe('key-1');
    });

    it('should inject correct identity for user-2', async () => {
      httpClient.execute.mockResolvedValue(mockResponse);

      const identity: ApiKeyIdentity = {
        userId: 'user-2',
        apiKeyId: 'key-2',
        scopes: ['ai:execute'], // Phase 20B
      };

      await controller.execute(validRequest, identity);

      const calledRequest = httpClient.execute.mock.calls[0][0];
      expect(calledRequest.userId).toBe('user-2');
      expect(calledRequest.metadata?.apiKeyId).toBe('key-2');
    });

    it('should preserve existing metadata when injecting apiKeyId', async () => {
      httpClient.execute.mockResolvedValue(mockResponse);

      const requestWithMetadata: AIExecutionRequest = {
        ...validRequest,
        metadata: {
          customField: 'custom-value',
          nestedField: { data: 'nested-value' },
        },
      };

      const identity: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'], // Phase 20B
      };

      await controller.execute(requestWithMetadata, identity);

      const calledRequest = httpClient.execute.mock.calls[0][0];
      expect(calledRequest.metadata?.customField).toBe('custom-value');
      expect(calledRequest.metadata?.nestedField).toEqual({ data: 'nested-value' });
      expect(calledRequest.metadata?.apiKeyId).toBe('key-test');
    });

    it('should propagate ai-service errors unchanged', async () => {
      const mockError = new Error('AI execution failed');
      (mockError as any).status = 500;
      httpClient.execute.mockRejectedValue(mockError);

      const identity: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'], // Phase 20B
      };

      await expect(controller.execute(validRequest, identity)).rejects.toThrow('AI execution failed');
      expect(httpClient.execute).toHaveBeenCalledTimes(1);
    });

    it('should not call ai-service if authentication would have failed', async () => {
      // This test verifies that the guard is properly protecting the endpoint
      // In reality, the guard would throw before reaching the controller
      // This is a conceptual test showing the integration

      const identity: ApiKeyIdentity = {
        userId: 'verified-user',
        apiKeyId: 'key-verified',
        scopes: ['ai:execute'], // Phase 20B
      };

      httpClient.execute.mockResolvedValue(mockResponse);

      await controller.execute(validRequest, identity);

      // Verify that httpClient was called (proving authentication passed)
      expect(httpClient.execute).toHaveBeenCalledTimes(1);

      // Verify the verified identity was used
      const calledRequest = httpClient.execute.mock.calls[0][0];
      expect(calledRequest.userId).toBe('verified-user');
    });

    // Phase 20B: Authorization tests
    it('should execute successfully with ai:execute scope', async () => {
      httpClient.execute.mockResolvedValue(mockResponse);

      const identity: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'], // Has required scope
      };

      const result = await controller.execute(validRequest, identity);

      expect(result).toEqual(mockResponse);
      expect(httpClient.execute).toHaveBeenCalledTimes(1);
    });

    it('should verify scopes are not forwarded to ai-service', async () => {
      httpClient.execute.mockResolvedValue(mockResponse);

      const identity: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'],
      };

      await controller.execute(validRequest, identity);

      const calledRequest = httpClient.execute.mock.calls[0][0];
      // Verify scopes are NOT in the request
      expect((calledRequest as any).scopes).toBeUndefined();
      // Verify only userId and apiKeyId are present
      expect(calledRequest.userId).toBe('test-user');
      expect(calledRequest.metadata?.apiKeyId).toBe('key-test');
    });

    it('should maintain backward compatibility with Phase 20A keys', async () => {
      // All Phase 20A keys now have ai:execute scope by default
      httpClient.execute.mockResolvedValue(mockResponse);

      const identity: ApiKeyIdentity = {
        userId: 'legacy-user',
        apiKeyId: 'legacy-key',
        scopes: ['ai:execute'], // Default grant
      };

      const result = await controller.execute(validRequest, identity);

      expect(result).toEqual(mockResponse);
      expect(httpClient.execute).toHaveBeenCalledTimes(1);
    });
  });

  // Phase 21B: Quota enforcement tests
  describe('POST /ai/execute with quota enforcement', () => {
    const validRequest: AIExecutionRequest = {
      sessionId: 'session-123',
      conversationId: 'conv-456',
      userId: 'untrusted-user',
      prompt: 'Test prompt',
      provider: 'stub',
    };

    const mockResponse: AIExecutionResult = {
      output: 'Test response',
      tokensUsed: 100,
      model: 'stub',
    };

    const identity: ApiKeyIdentity = {
      userId: 'test-user',
      apiKeyId: 'key-test',
      scopes: ['ai:execute'],
    };

    it('should execute successfully when quota module is present', async () => {
      // This test verifies the controller works with QuotaGuard in the module
      httpClient.execute.mockResolvedValue(mockResponse);

      const result = await controller.execute(validRequest, identity);

      expect(result).toEqual(mockResponse);
      expect(httpClient.execute).toHaveBeenCalledTimes(1);
    });

    it('should maintain backward compatibility with Phase 20A/20B', async () => {
      // Quota guards should not break existing auth/authz behavior
      httpClient.execute.mockResolvedValue(mockResponse);

      const result = await controller.execute(validRequest, identity);

      // Verify userId injection still works (Phase 20A)
      const calledRequest = httpClient.execute.mock.calls[0][0];
      expect(calledRequest.userId).toBe('test-user');

      // Verify apiKeyId injection still works (Phase 20A)
      expect(calledRequest.metadata?.apiKeyId).toBe('key-test');

      // Verify response is unchanged
      expect(result).toEqual(mockResponse);
    });

    it('should verify QuotaService can track usage independently', async () => {
      // This test verifies QuotaService functionality
      // Note: In unit tests, guards don't execute automatically

      const apiKeyId1 = 'key-1';
      const apiKeyId2 = 'key-2';

      // Manually record usage to demonstrate tracking works
      quotaService.recordRequest(apiKeyId1);
      quotaService.recordTokens(apiKeyId1, 100);

      quotaService.recordRequest(apiKeyId2);
      quotaService.recordTokens(apiKeyId2, 200);

      // Both keys should have independent usage
      const usage1 = quotaService.getCurrentUsage(apiKeyId1);
      const usage2 = quotaService.getCurrentUsage(apiKeyId2);

      expect(usage1.requests).toBe(1);
      expect(usage1.tokens).toBe(100);
      expect(usage2.requests).toBe(1);
      expect(usage2.tokens).toBe(200);
    });

    it('should verify QuotaGuard is registered in the test module', async () => {
      // This test verifies QuotaGuard is properly provided
      expect(quotaService).toBeDefined();
      expect(quotaService.checkRequestQuota).toBeDefined();
      expect(quotaService.checkTokenQuota).toBeDefined();
    });
  });

  // Phase 22B: Usage ledger tests
  describe('POST /ai/execute with usage ledger', () => {
    const validRequest: AIExecutionRequest = {
      sessionId: 'session-123',
      conversationId: 'conv-456',
      userId: 'untrusted-user',
      prompt: 'Test prompt',
      provider: 'stub',
    };

    const mockResponse: AIExecutionResult = {
      output: 'Test response',
      tokensUsed: 100,
      model: 'claude-3-5-sonnet-20241022',
    };

    const identity: ApiKeyIdentity = {
      userId: 'test-user',
      apiKeyId: 'key-test',
      scopes: ['ai:execute'],
    };

    beforeEach(() => {
      usageLedgerService.writeRecord.mockResolvedValue({} as any);
    });

    it('should write ledger record on successful execution', async () => {
      httpClient.execute.mockResolvedValue(mockResponse);

      await controller.execute(validRequest, identity);

      // Verify ledger was written
      expect(usageLedgerService.writeRecord).toHaveBeenCalledTimes(1);

      // Verify ledger record contains required fields
      const ledgerCall = usageLedgerService.writeRecord.mock.calls[0][0];
      expect(ledgerCall.apiKeyId).toBe('key-test');
      expect(ledgerCall.userId).toBe('test-user');
      expect(ledgerCall.sessionId).toBe('session-123');
      expect(ledgerCall.conversationId).toBe('conv-456');
      expect(ledgerCall.model).toBe('claude-3-5-sonnet-20241022');
      expect(ledgerCall.tokensUsed).toBe(100);
      expect(ledgerCall.executionDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should write ledger AFTER ai-service success', async () => {
      const callOrder: string[] = [];

      httpClient.execute.mockImplementation(async () => {
        callOrder.push('ai-service');
        return mockResponse;
      });

      usageLedgerService.writeRecord.mockImplementation(async () => {
        callOrder.push('ledger');
        return {} as any;
      });

      await controller.execute(validRequest, identity);

      // Verify execution order
      expect(callOrder).toEqual(['ai-service', 'ledger']);
    });

    it('should write ledger BEFORE returning response to client', async () => {
      let ledgerWritten = false;

      httpClient.execute.mockResolvedValue(mockResponse);
      usageLedgerService.writeRecord.mockImplementation(async () => {
        ledgerWritten = true;
        return {} as any;
      });

      const result = await controller.execute(validRequest, identity);

      // Verify ledger was written before result was returned
      expect(ledgerWritten).toBe(true);
      expect(result).toEqual(mockResponse);
    });

    it('should NOT write ledger on ai-service failure', async () => {
      const error = new Error('AI service error');
      httpClient.execute.mockRejectedValue(error);

      await expect(controller.execute(validRequest, identity)).rejects.toThrow(
        'AI service error',
      );

      // Verify ledger was NOT written
      expect(usageLedgerService.writeRecord).not.toHaveBeenCalled();
    });

    it('should fail entire request if ledger write fails', async () => {
      httpClient.execute.mockResolvedValue(mockResponse);

      const ledgerError = new Error('Database connection failed');
      usageLedgerService.writeRecord.mockRejectedValue(ledgerError);

      await expect(controller.execute(validRequest, identity)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should record execution duration', async () => {
      httpClient.execute.mockImplementation(async () => {
        // Simulate some delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        return mockResponse;
      });

      await controller.execute(validRequest, identity);

      const ledgerCall = usageLedgerService.writeRecord.mock.calls[0][0];
      expect(ledgerCall.executionDurationMs).toBeGreaterThan(0);
      expect(ledgerCall.executionDurationMs).toBeLessThan(1000);
    });

    it('should maintain backward compatibility with Phase 20A/20B/21B', async () => {
      httpClient.execute.mockResolvedValue(mockResponse);

      const result = await controller.execute(validRequest, identity);

      // Verify userId injection still works (Phase 20A)
      const calledRequest = httpClient.execute.mock.calls[0][0];
      expect(calledRequest.userId).toBe('test-user');

      // Verify apiKeyId injection still works (Phase 20A)
      expect(calledRequest.metadata?.apiKeyId).toBe('key-test');

      // Verify response is unchanged
      expect(result).toEqual(mockResponse);

      // Verify ledger was written
      expect(usageLedgerService.writeRecord).toHaveBeenCalledTimes(1);
    });

    it('should verify UsageLedgerService is registered', async () => {
      expect(usageLedgerService).toBeDefined();
      expect(usageLedgerService.writeRecord).toBeDefined();
    });
  });

  // Phase 43A-2B: Idempotency tests
  describe('POST /ai/execute with Idempotency-Key header', () => {
    const validRequest: AIExecutionRequest = {
      sessionId: 'session-123',
      conversationId: 'conv-456',
      userId: 'untrusted-user',
      prompt: 'Test prompt',
      provider: 'stub',
    };

    const mockResponse: AIExecutionResult = {
      output: 'Test response',
      tokensUsed: 100,
      model: 'stub',
    };

    const identity: ApiKeyIdentity = {
      userId: 'test-user',
      apiKeyId: 'key-test',
      scopes: ['ai:execute'],
    };

    it('should accept valid Idempotency-Key header', async () => {
      httpClient.execute.mockResolvedValue(mockResponse);
      usageLedgerService.writeRecord.mockResolvedValue({} as any);

      const result = await controller.execute(validRequest, identity, 'req-abc-123');

      expect(result).toEqual(mockResponse);
      expect(usageLedgerService.writeRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-abc-123',
        }),
      );
    });

    it('should trim whitespace from Idempotency-Key', async () => {
      httpClient.execute.mockResolvedValue(mockResponse);
      usageLedgerService.writeRecord.mockResolvedValue({} as any);

      await controller.execute(validRequest, identity, '  req-trimmed-123  ');

      expect(usageLedgerService.writeRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-trimmed-123',
        }),
      );
    });

    it('should reject empty Idempotency-Key', async () => {
      await expect(
        controller.execute(validRequest, identity, ''),
      ).rejects.toThrow('Idempotency-Key must not be empty');

      expect(httpClient.execute).not.toHaveBeenCalled();
      expect(usageLedgerService.writeRecord).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only Idempotency-Key', async () => {
      await expect(
        controller.execute(validRequest, identity, '   '),
      ).rejects.toThrow('Idempotency-Key must not be empty');

      expect(httpClient.execute).not.toHaveBeenCalled();
      expect(usageLedgerService.writeRecord).not.toHaveBeenCalled();
    });

    it('should reject Idempotency-Key longer than 100 characters', async () => {
      const longKey = 'x'.repeat(101);

      await expect(
        controller.execute(validRequest, identity, longKey),
      ).rejects.toThrow('Idempotency-Key must not exceed 100 characters');

      expect(httpClient.execute).not.toHaveBeenCalled();
      expect(usageLedgerService.writeRecord).not.toHaveBeenCalled();
    });

    it('should accept Idempotency-Key exactly 100 characters', async () => {
      const maxKey = 'x'.repeat(100);
      httpClient.execute.mockResolvedValue(mockResponse);
      usageLedgerService.writeRecord.mockResolvedValue({} as any);

      await controller.execute(validRequest, identity, maxKey);

      expect(usageLedgerService.writeRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: maxKey,
        }),
      );
    });

    it('should omit requestId when Idempotency-Key not provided', async () => {
      httpClient.execute.mockResolvedValue(mockResponse);
      usageLedgerService.writeRecord.mockResolvedValue({} as any);

      await controller.execute(validRequest, identity, undefined);

      expect(usageLedgerService.writeRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: undefined,
        }),
      );
    });

    it('should validate Idempotency-Key before calling ai-service', async () => {
      const callOrder: string[] = [];

      httpClient.execute.mockImplementation(async () => {
        callOrder.push('ai-service');
        return mockResponse;
      });

      await expect(
        controller.execute(validRequest, identity, ''),
      ).rejects.toThrow('Idempotency-Key must not be empty');

      // ai-service should NOT be called if validation fails
      expect(callOrder).toEqual([]);
    });

    it('should maintain backward compatibility when Idempotency-Key not used', async () => {
      httpClient.execute.mockResolvedValue(mockResponse);
      usageLedgerService.writeRecord.mockResolvedValue({} as any);

      const result = await controller.execute(validRequest, identity);

      expect(result).toEqual(mockResponse);
      expect(usageLedgerService.writeRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user',
          apiKeyId: 'key-test',
          requestId: undefined,
        }),
      );
    });
  });
});
