import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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

/**
 * AGENT-HARNESS-05C2: harnessVersion API-to-queue wiring tests
 *
 * Verifies that POST /api/ai/execute validates the optional harnessVersion
 * field (allow-list: undefined | 'v1') and forwards it into the BullMQ job
 * payload when provided.
 */
describe('AIExecutionController — harnessVersion wiring (AGENT-HARNESS-05C2)', () => {
  let controller: AIExecutionController;
  let mockUsageLedgerService: Record<string, jest.Mock>;
  let mockQueueService: Record<string, jest.Mock>;

  const VALID_SESSION_UUID = '35d53116-6723-4571-af12-ac256977c007';

  const defaultIdentity: ApiKeyIdentity = {
    userId: 'user-uuid-001',
    apiKeyId: 'key-uuid-001',
    scopes: ['ai:execute'],
  };

  function makeRequest(overrides?: Partial<AIExecutionRequest>): AIExecutionRequest {
    return {
      sessionId: VALID_SESSION_UUID,
      conversationId: 'conv-001',
      userId: 'ignored',
      prompt: 'Hello',
      provider: 'stub',
      ...overrides,
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

  it('Test A: harnessVersion undefined — proceeds and payload omits harnessVersion', async () => {
    const result = await controller.execute(makeRequest(), defaultIdentity);

    expect(result).toHaveProperty('executionId');
    expect(result.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload).not.toHaveProperty('harnessVersion');
  });

  it("Test B: harnessVersion 'v1' — accepted and forwarded in queue payload", async () => {
    const result = await controller.execute(
      makeRequest({ harnessVersion: 'v1' }),
      defaultIdentity,
    );

    expect(result).toHaveProperty('executionId');
    expect(result.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.harnessVersion).toBe('v1');
  });

  it("Test C: harnessVersion 'v2' — rejected with BadRequestException", async () => {
    await expect(
      controller.execute(
        makeRequest({ harnessVersion: 'v2' as any }),
        defaultIdentity,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.execute(
        makeRequest({ harnessVersion: 'v2' as any }),
        defaultIdentity,
      ),
    ).rejects.toThrow("harnessVersion must be 'v1' when provided");

    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('Test D: harnessVersion non-string (number) — rejected with BadRequestException', async () => {
    await expect(
      controller.execute(
        makeRequest({ harnessVersion: 123 as any }),
        defaultIdentity,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.execute(
        makeRequest({ harnessVersion: 123 as any }),
        defaultIdentity,
      ),
    ).rejects.toThrow("harnessVersion must be 'v1' when provided");

    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('Test E: invalid sessionId still rejected before harnessVersion check (05B9 intact)', async () => {
    await expect(
      controller.execute(
        makeRequest({ sessionId: 'not-a-uuid', harnessVersion: 'v1' }),
        defaultIdentity,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.execute(
        makeRequest({ sessionId: 'not-a-uuid', harnessVersion: 'v1' }),
        defaultIdentity,
      ),
    ).rejects.toThrow('sessionId must be a valid UUID');

    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });
});

/**
 * AGENT-HARNESS-05C5: Session ownership enforcement tests
 *
 * Verifies that POST /api/ai/execute enforces session ownership
 * after UUID and harnessVersion validation. Cross-user and missing
 * sessions must both return HTTP 404 with an identical message,
 * and no controller-level side effects (enrichment, ledger, queue)
 * may occur for rejected requests.
 */
describe('AIExecutionController — session ownership enforcement (AGENT-HARNESS-05C5)', () => {
  let controller: AIExecutionController;
  let mockSessionService: Record<string, jest.Mock>;
  let mockUsageLedgerService: Record<string, jest.Mock>;
  let mockQueueService: Record<string, jest.Mock>;
  let mockUserAiInstructionsService: Record<string, jest.Mock>;
  let mockProjectAiContextService: Record<string, jest.Mock>;

  const ownerUserId = '38b2bb95-9126-498a-a29f-86c2d335bed6';
  const otherUserId = '1eb05cfa-af67-428a-bbec-a0ef0163b539';
  const sessionId = '35d53116-6723-4571-af12-ac256977c007';

  const ownerIdentity: ApiKeyIdentity = {
    userId: ownerUserId,
    apiKeyId: 'key-owner-001',
    scopes: ['ai:execute'],
  };

  function makeRequest(overrides?: Partial<AIExecutionRequest>): AIExecutionRequest {
    return {
      sessionId,
      conversationId: 'conv-05c5',
      userId: 'ignored',
      prompt: 'Hello',
      provider: 'stub',
      ...overrides,
    };
  }

  beforeEach(async () => {
    mockSessionService = {
      getSessionById: jest.fn().mockResolvedValue({ userId: ownerUserId, projectId: null }),
    };

    mockUsageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      reuseExecutionIntent: jest.fn().mockResolvedValue('exec-id'),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
      updateExecutionResult: jest.fn().mockResolvedValue(undefined),
    };

    mockQueueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };

    mockUserAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue(null),
    };

    mockProjectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue(null),
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
        { provide: UserAiInstructionsService, useValue: mockUserAiInstructionsService },
        { provide: ProjectAiContextService, useValue: mockProjectAiContextService },
        { provide: SessionService, useValue: mockSessionService },
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard).useValue(mockGuard)
      .overrideGuard(AuthorizationGuard).useValue(mockGuard)
      .overrideGuard(QuotaGuard).useValue(mockGuard)
      .overrideGuard(TokenQuotaGuard).useValue(mockGuard)
      .compile();

    controller = module.get<AIExecutionController>(AIExecutionController);
  });

  it('Test A: invalid sessionId throws BadRequestException before session lookup', async () => {
    await expect(
      controller.execute(makeRequest({ sessionId: 'not-a-uuid' }), ownerIdentity),
    ).rejects.toThrow(BadRequestException);

    expect(mockSessionService.getSessionById).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.reuseExecutionIntent).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('Test B: invalid harnessVersion throws BadRequestException before session lookup', async () => {
    await expect(
      controller.execute(makeRequest({ harnessVersion: 'v2' as any }), ownerIdentity),
    ).rejects.toThrow(BadRequestException);

    expect(mockSessionService.getSessionById).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('Test C: missing session propagates NotFoundException unchanged', async () => {
    mockSessionService.getSessionById.mockRejectedValue(
      new NotFoundException(`Session with ID ${sessionId} not found`),
    );

    await expect(
      controller.execute(makeRequest(), ownerIdentity),
    ).rejects.toThrow(NotFoundException);

    await expect(
      controller.execute(makeRequest(), ownerIdentity),
    ).rejects.toThrow(`Session with ID ${sessionId} not found`);

    expect(mockUserAiInstructionsService.getByUserId).not.toHaveBeenCalled();
    expect(mockProjectAiContextService.getByProjectId).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('Test D: cross-user session throws NotFoundException without leaking otherUserId', async () => {
    mockSessionService.getSessionById.mockResolvedValue({ userId: otherUserId, projectId: null });

    const error = await controller.execute(makeRequest(), ownerIdentity).catch((e) => e);

    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.message).toBe(`Session with ID ${sessionId} not found`);
    expect(error.message).not.toContain(otherUserId);

    expect(mockUserAiInstructionsService.getByUserId).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.reuseExecutionIntent).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('Test E: matching owner, plain execution proceeds with ledger and queue', async () => {
    const result = await controller.execute(makeRequest(), ownerIdentity);

    expect(result).toHaveProperty('executionId');
    expect(result.status).toBe('queued');
    expect(mockUsageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload).not.toHaveProperty('harnessVersion');
  });

  it('Test F: matching owner, harnessVersion v1 proceeds and forwards harnessVersion', async () => {
    const result = await controller.execute(
      makeRequest({ harnessVersion: 'v1' }),
      ownerIdentity,
    );

    expect(result).toHaveProperty('executionId');
    expect(result.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.harnessVersion).toBe('v1');
  });

  it('Test G: cross-user harnessVersion v1 throws NotFoundException', async () => {
    mockSessionService.getSessionById.mockResolvedValue({ userId: otherUserId, projectId: null });

    await expect(
      controller.execute(makeRequest({ harnessVersion: 'v1' }), ownerIdentity),
    ).rejects.toThrow(NotFoundException);

    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('Test H: session-cookie identity — matching userId succeeds, different userId fails, isInternal does not bypass', async () => {
    const browserIdentity: ApiKeyIdentity = {
      userId: ownerUserId,
      apiKeyId: 'browser-session',
      scopes: ['ai:execute'],
      isInternal: true,
    };

    const result = await controller.execute(makeRequest(), browserIdentity);
    expect(result.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    mockQueueService.enqueueExecution.mockClear();
    mockUsageLedgerService.writeExecutionIntent.mockClear();
    mockSessionService.getSessionById.mockResolvedValue({ userId: otherUserId, projectId: null });

    const browserIdentityOther: ApiKeyIdentity = {
      userId: otherUserId,
      apiKeyId: 'browser-session',
      scopes: ['ai:execute'],
      isInternal: true,
    };

    await expect(
      controller.execute(makeRequest(), { ...browserIdentityOther, userId: ownerUserId }),
    ).rejects.toThrow(NotFoundException);

    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('Test I: API-key identity — matching UUID succeeds, different UUID fails, isInternal does not bypass', async () => {
    mockSessionService.getSessionById.mockResolvedValue({ userId: ownerUserId, projectId: null });

    const apiKeyIdentity: ApiKeyIdentity = {
      userId: ownerUserId,
      apiKeyId: 'ak-real-key-001',
      scopes: ['ai:execute'],
      isInternal: true,
    };

    const result = await controller.execute(makeRequest(), apiKeyIdentity);
    expect(result.status).toBe('queued');

    mockQueueService.enqueueExecution.mockClear();
    mockUsageLedgerService.writeExecutionIntent.mockClear();
    mockSessionService.getSessionById.mockResolvedValue({ userId: otherUserId, projectId: null });

    await expect(
      controller.execute(makeRequest(), apiKeyIdentity),
    ).rejects.toThrow(NotFoundException);

    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('Test J: missing and mismatched responses are equivalent (HTTP 404, same message)', async () => {
    const missingError = new NotFoundException(`Session with ID ${sessionId} not found`);
    mockSessionService.getSessionById.mockRejectedValue(missingError);

    const missingCaught = await controller.execute(makeRequest(), ownerIdentity).catch((e) => e);

    mockSessionService.getSessionById.mockResolvedValue({ userId: otherUserId, projectId: null });

    const mismatchCaught = await controller.execute(makeRequest(), ownerIdentity).catch((e) => e);

    expect(missingCaught.getStatus()).toBe(404);
    expect(mismatchCaught.getStatus()).toBe(404);
    expect(missingCaught.message).toBe(mismatchCaught.message);
    expect(missingCaught.message).toBe(`Session with ID ${sessionId} not found`);
  });
});
