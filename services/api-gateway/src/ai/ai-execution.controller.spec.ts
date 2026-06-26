import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AIExecutionController } from './ai-execution.controller';
import { AIServiceHttpClient, AIExecutionRequest, AIExecutionResult } from '../clients/ai-service-http.client';
import { ApiKeyIdentity } from '../auth/api-key.config';
import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { AuthorizationGuard } from '../auth/authorization.guard';
import { QuotaGuard } from '../quota/quota.guard';
import { TokenQuotaGuard } from '../quota/token-quota.guard';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { GlobalSafetyLimitService } from '../safety/global-safety-limit.service';
import { QueueService } from '../queue/queue.service';
import { ExecutionResultService } from './execution-result.service';
import { ExecutionStreamService } from '../streaming/execution-stream.service';
import { UserAiInstructionsService } from '../user-ai-instructions/user-ai-instructions.service';
import { ProjectAiContextService } from '../project-ai-context/project-ai-context.service';
import { SessionService } from '../sessions/session.service';

describe('AIExecutionController (Phase 18A + Phase 20A + Phase 20B + Phase 21B + Phase 22B)', () => {
  let controller: AIExecutionController;
  let httpClient: jest.Mocked<AIServiceHttpClient>;
  let usageLedgerService: jest.Mocked<UsageLedgerService>;

  beforeEach(async () => {
    // Create mock HTTP client
    const mockHttpClient = {
      execute: jest.fn(),
    };

    // Create mock usage ledger service
    const mockUsageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      reuseExecutionIntent: jest.fn().mockResolvedValue('execution-id'),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
      updateExecutionResult: jest.fn().mockResolvedValue(undefined),
    };

    // Create mock global safety limit service
    const mockGlobalSafetyLimitService = {
      checkAndRecord: jest.fn().mockResolvedValue(undefined),
      recordExecutionCost: jest.fn().mockResolvedValue(undefined),
    };

    // Mock guards (not testing guard logic here)
    const mockGuard = {
      canActivate: jest.fn(() => true),
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
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(AuthorizationGuard)
      .useValue(mockGuard)
      .overrideGuard(QuotaGuard)
      .useValue(mockGuard)
      .overrideGuard(TokenQuotaGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AIExecutionController>(AIExecutionController);
    httpClient = module.get(AIServiceHttpClient);
    usageLedgerService = module.get(UsageLedgerService);
  });

  describe('POST /api/ai/execute', () => {
    it('should forward request to ai-service with verified userId and return result on success', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'untrusted-user', // Will be replaced
        prompt: 'Hello AI',
        provider: 'stub',
        metadata: { source: 'test' },
      };

      const identity: ApiKeyIdentity = {
        userId: 'verified-user',
        apiKeyId: 'key-123',
        scopes: ['ai:execute'], // Phase 20B
      };

      const expectedResult: AIExecutionResult = {
        output: 'Hello human',
        tokensUsed: 42,
        model: 'claude-3-5-sonnet-20241022',
      };

      httpClient.execute.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.execute(request, identity);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(httpClient.execute).toHaveBeenCalledTimes(1);

      // Verify userId was replaced
      const calledRequest = httpClient.execute.mock.calls[0][0];
      expect(calledRequest.userId).toBe('verified-user'); // NOT 'untrusted-user'
      expect(calledRequest.metadata?.apiKeyId).toBe('key-123');
      expect(calledRequest.metadata?.source).toBe('test');
    });

    it('should propagate exceptions from ai-service unchanged', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'untrusted-user',
        prompt: 'Hello AI',
        provider: 'stub',
      };

      const identity: ApiKeyIdentity = {
        userId: 'verified-user',
        apiKeyId: 'key-123',
        scopes: ['ai:execute'], // Phase 20B
      };

      const aiServiceError = new Error('AI provider unavailable');
      (aiServiceError as any).status = 503;

      httpClient.execute.mockRejectedValue(aiServiceError);

      // Act & Assert
      await expect(controller.execute(request, identity)).rejects.toThrow('AI provider unavailable');
      expect(httpClient.execute).toHaveBeenCalledTimes(1);
    });

    it('should not retry on failure', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'untrusted-user',
        prompt: 'Hello AI',
        provider: 'stub',
      };

      const identity: ApiKeyIdentity = {
        userId: 'verified-user',
        apiKeyId: 'key-123',
        scopes: ['ai:execute'], // Phase 20B
      };

      const error = new Error('Network timeout');
      httpClient.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.execute(request, identity)).rejects.toThrow('Network timeout');

      // Verify no retry logic - only called once
      expect(httpClient.execute).toHaveBeenCalledTimes(1);
    });

    it('should replace userId and inject apiKeyId into metadata', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-999',
        conversationId: 'conv-888',
        userId: 'untrusted-user-777',
        prompt: 'Complex prompt with special chars: !@#$%',
        provider: 'stub',
        metadata: {
          nested: { data: 'value' },
          array: [1, 2, 3],
        },
      };

      const identity: ApiKeyIdentity = {
        userId: 'verified-user-999',
        apiKeyId: 'key-999',
        scopes: ['ai:execute'], // Phase 20B
      };

      const result: AIExecutionResult = {
        output: 'Response',
        tokensUsed: 100,
        model: 'gpt-4',
      };

      httpClient.execute.mockResolvedValue(result);

      // Act
      await controller.execute(request, identity);

      // Assert - userId replaced, metadata preserved and extended
      const calledRequest = httpClient.execute.mock.calls[0][0];
      expect(calledRequest.userId).toBe('verified-user-999'); // REPLACED
      expect(calledRequest.prompt).toBe('Complex prompt with special chars: !@#$%');
      expect(calledRequest.metadata?.nested).toEqual({ data: 'value' });
      expect(calledRequest.metadata?.array).toEqual([1, 2, 3]);
      expect(calledRequest.metadata?.apiKeyId).toBe('key-999'); // INJECTED
    });
  });
});

/**
 * AGENT-HARNESS-05B9: sessionId UUID validation tests
 *
 * Verifies that POST /api/ai/execute rejects non-UUID sessionId values
 * with HTTP 400 before any ledger write or queue enqueue occurs.
 */
describe('AIExecutionController — sessionId UUID validation (AGENT-HARNESS-05B9)', () => {
  let controller: AIExecutionController;
  let mockUsageLedgerService: Record<string, jest.Mock>;
  let mockQueueService: Record<string, jest.Mock>;

  const VALID_SESSION_UUID = '35d53116-6723-4571-af12-ac256977c007';

  const defaultIdentity: ApiKeyIdentity = {
    userId: 'user-uuid-001',
    apiKeyId: 'key-uuid-001',
    scopes: ['ai:execute'],
  };

  function makeRequest(sessionId: string): AIExecutionRequest {
    return {
      sessionId,
      conversationId: 'conv-001',
      userId: 'ignored',
      prompt: 'Hello',
      provider: 'stub',
    };
  }

  beforeEach(async () => {
    mockUsageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      reuseExecutionIntent: jest.fn().mockResolvedValue('exec-id'),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
      updateExecutionResult: jest.fn().mockResolvedValue(undefined),
    };

    mockQueueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };

    const mockGuard = { canActivate: jest.fn(() => true) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIExecutionController],
      providers: [
        { provide: UsageLedgerService, useValue: mockUsageLedgerService },
        { provide: GlobalSafetyLimitService, useValue: { checkAndRecord: jest.fn(), recordExecutionCost: jest.fn() } },
        { provide: QueueService, useValue: mockQueueService },
        { provide: ExecutionResultService, useValue: { getExecution: jest.fn(), requestCancel: jest.fn() } },
        { provide: ExecutionStreamService, useValue: { subscribe: jest.fn(), unsubscribe: jest.fn() } },
        { provide: UserAiInstructionsService, useValue: { getByUserId: jest.fn().mockResolvedValue(null) } },
        { provide: ProjectAiContextService, useValue: { getByProjectId: jest.fn().mockResolvedValue(null) } },
        { provide: SessionService, useValue: { getSessionById: jest.fn().mockResolvedValue({ userId: defaultIdentity.userId, projectId: null }) } },
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard).useValue(mockGuard)
      .overrideGuard(AuthorizationGuard).useValue(mockGuard)
      .overrideGuard(QuotaGuard).useValue(mockGuard)
      .overrideGuard(TokenQuotaGuard).useValue(mockGuard)
      .compile();

    controller = module.get<AIExecutionController>(AIExecutionController);
  });

  it('Test A: invalid sessionId returns BadRequestException (HTTP 400)', async () => {
    await expect(
      controller.execute(makeRequest('not-a-uuid'), defaultIdentity),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.execute(makeRequest('not-a-uuid'), defaultIdentity),
    ).rejects.toThrow('sessionId must be a valid UUID');
  });

  it('Test B: invalid sessionId does not call writeExecutionIntent', async () => {
    try {
      await controller.execute(makeRequest('05b7-xai-test'), defaultIdentity);
    } catch {
      // expected
    }
    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.reuseExecutionIntent).not.toHaveBeenCalled();
  });

  it('Test C: invalid sessionId does not call enqueueExecution', async () => {
    try {
      await controller.execute(makeRequest('plainstring'), defaultIdentity);
    } catch {
      // expected
    }
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('Test D: valid UUID sessionId proceeds normally', async () => {
    const result = await controller.execute(
      makeRequest(VALID_SESSION_UUID),
      defaultIdentity,
    );

    expect(result).toHaveProperty('executionId');
    expect(result.status).toBe('queued');
    expect(mockUsageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
  });
});
