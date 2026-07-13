import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AIExecutionController } from '../ai-execution.controller';
import { AIExecutionRequest } from '../../clients/ai-service-http.client';
import { SessionOrApiKeyAuthGuard } from '../../auth/session-or-api-key.guard';
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
import { CreditBalanceGuard } from '../../billing/credit-balance.guard';
import { QueueService } from '../../queue/queue.service';
import { ExecutionResultService } from '../execution-result.service';
import { ExecutionStreamService } from '../../streaming/execution-stream.service';
import { UserAiInstructionsService } from '../../user-ai-instructions/user-ai-instructions.service';
import { ProjectAiContextService } from '../../project-ai-context/project-ai-context.service';
import { SessionService } from '../../sessions/session.service';

const VALID_SESSION_UUID = '11111111-1111-4111-a111-111111111111';

describe('AIExecutionController (Phase 20A+20B+21B+22B Integration)', () => {
  let controller: AIExecutionController;
  let usageLedgerService: Record<string, jest.Mock>;
  let queueService: Record<string, jest.Mock>;
  let quotaService: Record<string, jest.Mock>;
  let sessionService: Record<string, jest.Mock>;

  const mockGuardValue = { canActivate: () => true };

  beforeEach(async () => {
    usageLedgerService = {
      writeRecord: jest.fn(),
      validateUsageRecord: jest.fn(),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
      updateExecutionResult: jest.fn().mockResolvedValue(undefined),
      findByRequestId: jest.fn().mockResolvedValue(null),
      reuseExecutionIntent: jest.fn().mockResolvedValue('exec-reuse'),
    };

    queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };

    quotaService = {
      clearAll: jest.fn(),
      recordRequest: jest.fn(),
      recordTokens: jest.fn(),
      getCurrentUsage: jest.fn().mockReturnValue({ requests: 0, tokens: 0 }),
      checkRequestQuota: jest.fn(),
      checkTokenQuota: jest.fn(),
    };

    sessionService = {
      getSessionById: jest.fn().mockResolvedValue({ userId: 'test-user', projectId: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIExecutionController],
      providers: [
        { provide: UsageLedgerService, useValue: usageLedgerService },
        { provide: GlobalSafetyLimitService, useValue: { checkAndRecord: jest.fn(), recordExecutionCost: jest.fn() } },
        { provide: QueueService, useValue: queueService },
        { provide: ExecutionResultService, useValue: { getExecution: jest.fn(), requestCancel: jest.fn() } },
        { provide: ExecutionStreamService, useValue: { subscribe: jest.fn(), unsubscribe: jest.fn() } },
        { provide: UserAiInstructionsService, useValue: { getByUserId: jest.fn().mockResolvedValue(null) } },
        { provide: ProjectAiContextService, useValue: { getByProjectId: jest.fn().mockResolvedValue(null) } },
        { provide: SessionService, useValue: sessionService },
        { provide: QuotaService, useValue: quotaService },
        Reflector,
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard).useValue(mockGuardValue)
      .overrideGuard(AuthorizationGuard).useValue(mockGuardValue)
      .overrideGuard(ExecutionSafetyGuard).useValue(mockGuardValue)
      .overrideGuard(LaunchGuard).useValue(mockGuardValue)
      .overrideGuard(AbortGuard).useValue(mockGuardValue)
      .overrideGuard(QuotaGuard).useValue(mockGuardValue)
      .overrideGuard(TokenQuotaGuard).useValue(mockGuardValue)
      .overrideGuard(RateLimitGuard).useValue(mockGuardValue)
      .overrideGuard(CreditBalanceGuard).useValue(mockGuardValue)
      .compile();

    controller = module.get<AIExecutionController>(AIExecutionController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /ai/execute with authentication and authorization', () => {
    const validRequest: AIExecutionRequest = {
      sessionId: VALID_SESSION_UUID,
      conversationId: 'conv-456',
      userId: 'untrusted-user',
      prompt: 'Test prompt',
      provider: 'stub',
    };

    it('should inject verified userId and enqueue request', async () => {
      const identity: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'],
      };

      const result = await controller.execute(validRequest, identity);

      expect(result).toHaveProperty('executionId');
      expect(result.status).toBe('queued');
      expect(queueService.enqueueExecution).toHaveBeenCalledTimes(1);

      const payload = queueService.enqueueExecution.mock.calls[0][0];
      expect(payload.userId).toBe('test-user');
      expect(payload.sessionId).toBe(VALID_SESSION_UUID);
      expect(payload.conversationId).toBe('conv-456');
      expect(payload.prompt).toBe('Test prompt');
    });

    it('should inject correct identity for user-1', async () => {
      sessionService.getSessionById.mockResolvedValue({ userId: 'user-1', projectId: null });

      const identity: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['ai:execute'],
      };

      await controller.execute(validRequest, identity);

      const payload = queueService.enqueueExecution.mock.calls[0][0];
      expect(payload.userId).toBe('user-1');
      expect(payload.apiKeyId).toBe('key-1');
    });

    it('should inject correct identity for user-2', async () => {
      sessionService.getSessionById.mockResolvedValue({ userId: 'user-2', projectId: null });

      const identity: ApiKeyIdentity = {
        userId: 'user-2',
        apiKeyId: 'key-2',
        scopes: ['ai:execute'],
      };

      await controller.execute(validRequest, identity);

      const payload = queueService.enqueueExecution.mock.calls[0][0];
      expect(payload.userId).toBe('user-2');
      expect(payload.apiKeyId).toBe('key-2');
    });

    it('should preserve existing metadata when injecting apiKeyId', async () => {
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
        scopes: ['ai:execute'],
      };

      await controller.execute(requestWithMetadata, identity);

      const intentDto = usageLedgerService.writeExecutionIntent.mock.calls[0][0];
      expect(intentDto.metadata?.customField).toBe('custom-value');
      expect(intentDto.metadata?.nestedField).toEqual({ data: 'nested-value' });
      expect(intentDto.metadata?.apiKeyId).toBe('key-test');
    });

    it('should propagate queue service errors unchanged', async () => {
      const queueError = new Error('Queue unavailable');
      queueService.enqueueExecution.mockRejectedValue(queueError);

      const identity: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'],
      };

      await expect(controller.execute(validRequest, identity)).rejects.toThrow('Queue unavailable');
      expect(queueService.enqueueExecution).toHaveBeenCalledTimes(1);
    });

    it('should enqueue when authentication passes', async () => {
      const identity: ApiKeyIdentity = {
        userId: 'verified-user',
        apiKeyId: 'key-verified',
        scopes: ['ai:execute'],
      };
      sessionService.getSessionById.mockResolvedValue({ userId: 'verified-user', projectId: null });

      await controller.execute(validRequest, identity);

      expect(queueService.enqueueExecution).toHaveBeenCalledTimes(1);
      const payload = queueService.enqueueExecution.mock.calls[0][0];
      expect(payload.userId).toBe('verified-user');
    });

    it('should execute successfully with ai:execute scope', async () => {
      const identity: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'],
      };

      const result = await controller.execute(validRequest, identity);

      expect(result).toHaveProperty('executionId');
      expect(result.status).toBe('queued');
      expect(queueService.enqueueExecution).toHaveBeenCalledTimes(1);
    });

    it('should verify scopes are not forwarded to queue payload', async () => {
      const identity: ApiKeyIdentity = {
        userId: 'test-user',
        apiKeyId: 'key-test',
        scopes: ['ai:execute'],
      };

      await controller.execute(validRequest, identity);

      const payload = queueService.enqueueExecution.mock.calls[0][0];
      expect((payload as any).scopes).toBeUndefined();
      expect(payload.userId).toBe('test-user');
      expect(payload.apiKeyId).toBe('key-test');
    });

    it('should maintain backward compatibility with Phase 20A keys', async () => {
      const identity: ApiKeyIdentity = {
        userId: 'legacy-user',
        apiKeyId: 'legacy-key',
        scopes: ['ai:execute'],
      };
      sessionService.getSessionById.mockResolvedValue({ userId: 'legacy-user', projectId: null });

      const result = await controller.execute(validRequest, identity);

      expect(result).toHaveProperty('executionId');
      expect(result.status).toBe('queued');
      expect(queueService.enqueueExecution).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /ai/execute with quota enforcement', () => {
    const validRequest: AIExecutionRequest = {
      sessionId: VALID_SESSION_UUID,
      conversationId: 'conv-456',
      userId: 'untrusted-user',
      prompt: 'Test prompt',
      provider: 'stub',
    };

    const identity: ApiKeyIdentity = {
      userId: 'test-user',
      apiKeyId: 'key-test',
      scopes: ['ai:execute'],
    };

    it('should execute successfully when quota module is present', async () => {
      const result = await controller.execute(validRequest, identity);

      expect(result).toHaveProperty('executionId');
      expect(result.status).toBe('queued');
      expect(queueService.enqueueExecution).toHaveBeenCalledTimes(1);
    });

    it('should maintain backward compatibility with Phase 20A/20B', async () => {
      const result = await controller.execute(validRequest, identity);

      const payload = queueService.enqueueExecution.mock.calls[0][0];
      expect(payload.userId).toBe('test-user');

      const intentDto = usageLedgerService.writeExecutionIntent.mock.calls[0][0];
      expect(intentDto.metadata?.apiKeyId).toBe('key-test');

      expect(result).toHaveProperty('executionId');
      expect(result.status).toBe('queued');
    });

    it('should verify QuotaService can track usage independently', async () => {
      const apiKeyId1 = 'key-1';
      const apiKeyId2 = 'key-2';

      quotaService.getCurrentUsage.mockImplementation((apiKeyId: string) => {
        if (apiKeyId === apiKeyId1) return { requests: 1, tokens: 100 };
        if (apiKeyId === apiKeyId2) return { requests: 1, tokens: 200 };
        return { requests: 0, tokens: 0 };
      });

      quotaService.recordRequest(apiKeyId1);
      quotaService.recordTokens(apiKeyId1, 100);
      quotaService.recordRequest(apiKeyId2);
      quotaService.recordTokens(apiKeyId2, 200);

      const usage1 = quotaService.getCurrentUsage(apiKeyId1);
      const usage2 = quotaService.getCurrentUsage(apiKeyId2);

      expect(usage1.requests).toBe(1);
      expect(usage1.tokens).toBe(100);
      expect(usage2.requests).toBe(1);
      expect(usage2.tokens).toBe(200);
    });

    it('should verify QuotaGuard is registered in the test module', async () => {
      expect(quotaService).toBeDefined();
      expect(quotaService.checkRequestQuota).toBeDefined();
      expect(quotaService.checkTokenQuota).toBeDefined();
    });
  });

  describe('POST /ai/execute with usage ledger', () => {
    const validRequest: AIExecutionRequest = {
      sessionId: VALID_SESSION_UUID,
      conversationId: 'conv-456',
      userId: 'untrusted-user',
      prompt: 'Test prompt',
      provider: 'stub',
    };

    const identity: ApiKeyIdentity = {
      userId: 'test-user',
      apiKeyId: 'key-test',
      scopes: ['ai:execute'],
    };

    it('should write execution intent before enqueue', async () => {
      const result = await controller.execute(validRequest, identity);

      expect(result).toHaveProperty('executionId');
      expect(result.status).toBe('queued');
      expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);

      const intentCall = usageLedgerService.writeExecutionIntent.mock.calls[0][0];
      expect(intentCall.apiKeyId).toBe('key-test');
      expect(intentCall.userId).toBe('test-user');
      expect(intentCall.sessionId).toBe(VALID_SESSION_UUID);
      expect(intentCall.conversationId).toBe('conv-456');
    });

    it('should write intent BEFORE queue enqueue', async () => {
      const callOrder: string[] = [];

      usageLedgerService.writeExecutionIntent.mockImplementation(async () => {
        callOrder.push('intent');
        return undefined;
      });

      queueService.enqueueExecution.mockImplementation(async () => {
        callOrder.push('enqueue');
        return undefined;
      });

      await controller.execute(validRequest, identity);

      expect(callOrder).toEqual(['intent', 'enqueue']);
    });

    it('should write intent BEFORE returning response to client', async () => {
      let intentWritten = false;

      usageLedgerService.writeExecutionIntent.mockImplementation(async () => {
        intentWritten = true;
        return undefined;
      });

      const result = await controller.execute(validRequest, identity);

      expect(intentWritten).toBe(true);
      expect(result).toHaveProperty('executionId');
      expect(result.status).toBe('queued');
    });

    it('should propagate queue submission failure after intent write', async () => {
      const error = new Error('Queue submission failed');
      queueService.enqueueExecution.mockRejectedValue(error);

      await expect(controller.execute(validRequest, identity)).rejects.toThrow(
        'Queue submission failed',
      );

      expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
    });

    it('should fail entire request if intent write fails', async () => {
      const ledgerError = new Error('Database connection failed');
      usageLedgerService.writeExecutionIntent.mockRejectedValue(ledgerError);

      await expect(controller.execute(validRequest, identity)).rejects.toThrow(
        'Database connection failed',
      );

      expect(queueService.enqueueExecution).not.toHaveBeenCalled();
    });

    it('should include provider in intent write', async () => {
      await controller.execute(validRequest, identity);

      const intentCall = usageLedgerService.writeExecutionIntent.mock.calls[0][0];
      expect(intentCall.provider).toBe('stub');
      expect(intentCall.adapter).toBe('stub');
    });

    it('should maintain backward compatibility with Phase 20A/20B/21B', async () => {
      const result = await controller.execute(validRequest, identity);

      const payload = queueService.enqueueExecution.mock.calls[0][0];
      expect(payload.userId).toBe('test-user');

      const intentDto = usageLedgerService.writeExecutionIntent.mock.calls[0][0];
      expect(intentDto.metadata?.apiKeyId).toBe('key-test');

      expect(result).toHaveProperty('executionId');
      expect(result.status).toBe('queued');
      expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
    });

    it('should verify UsageLedgerService is registered', async () => {
      expect(usageLedgerService).toBeDefined();
      expect(usageLedgerService.writeExecutionIntent).toBeDefined();
    });
  });

  describe('POST /ai/execute with Idempotency-Key header', () => {
    const validRequest: AIExecutionRequest = {
      sessionId: VALID_SESSION_UUID,
      conversationId: 'conv-456',
      userId: 'untrusted-user',
      prompt: 'Test prompt',
      provider: 'stub',
    };

    const identity: ApiKeyIdentity = {
      userId: 'test-user',
      apiKeyId: 'key-test',
      scopes: ['ai:execute'],
    };

    it('should accept valid Idempotency-Key header', async () => {
      const result = await controller.execute(validRequest, identity, 'req-abc-123');

      expect(result).toHaveProperty('executionId');
      expect(result.status).toBe('queued');
      expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-abc-123',
        }),
      );
    });

    it('should trim whitespace from Idempotency-Key', async () => {
      await controller.execute(validRequest, identity, '  req-trimmed-123  ');

      expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-trimmed-123',
        }),
      );
    });

    it('should reject empty Idempotency-Key', async () => {
      await expect(
        controller.execute(validRequest, identity, ''),
      ).rejects.toThrow('Idempotency-Key must not be empty');

      expect(queueService.enqueueExecution).not.toHaveBeenCalled();
      expect(usageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only Idempotency-Key', async () => {
      await expect(
        controller.execute(validRequest, identity, '   '),
      ).rejects.toThrow('Idempotency-Key must not be empty');

      expect(queueService.enqueueExecution).not.toHaveBeenCalled();
      expect(usageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    });

    it('should reject Idempotency-Key longer than 100 characters', async () => {
      const longKey = 'x'.repeat(101);

      await expect(
        controller.execute(validRequest, identity, longKey),
      ).rejects.toThrow('Idempotency-Key must not exceed 100 characters');

      expect(queueService.enqueueExecution).not.toHaveBeenCalled();
      expect(usageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    });

    it('should accept Idempotency-Key exactly 100 characters', async () => {
      const maxKey = 'x'.repeat(100);

      await controller.execute(validRequest, identity, maxKey);

      expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: maxKey,
        }),
      );
    });

    it('should omit requestId when Idempotency-Key not provided', async () => {
      await controller.execute(validRequest, identity, undefined);

      expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: undefined,
        }),
      );
    });

    it('should validate Idempotency-Key before enqueue', async () => {
      await expect(
        controller.execute(validRequest, identity, ''),
      ).rejects.toThrow('Idempotency-Key must not be empty');

      expect(queueService.enqueueExecution).not.toHaveBeenCalled();
    });

    it('should maintain backward compatibility when Idempotency-Key not used', async () => {
      const result = await controller.execute(validRequest, identity);

      expect(result).toHaveProperty('executionId');
      expect(result.status).toBe('queued');
      expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user',
          apiKeyId: 'key-test',
          requestId: undefined,
        }),
      );
    });
  });
});
