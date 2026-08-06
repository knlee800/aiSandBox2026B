import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AIExecutionController } from './ai-execution.controller';
import { AIExecutionRequest } from '../clients/ai-service-http.client';
import { ApiKeyIdentity } from '../auth/api-key.config';
import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { AuthorizationGuard } from '../auth/authorization.guard';
import { QuotaGuard } from '../quota/quota.guard';
import { TokenQuotaGuard } from '../quota/token-quota.guard';
import { CreditBalanceGuard } from '../billing/credit-balance.guard';
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
  let mockUsageLedgerService: Record<string, jest.Mock>;
  let mockQueueService: Record<string, jest.Mock>;

  const VALID_SESSION_UUID = '11111111-1111-4111-a111-111111111111';

  beforeEach(async () => {
    mockUsageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      reuseExecutionIntent: jest.fn().mockResolvedValue('execution-id'),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
      updateExecutionResult: jest.fn().mockResolvedValue(undefined),
    };

    mockQueueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };

    const mockGuard = {
      canActivate: jest.fn(() => true),
    };

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
        { provide: SessionService, useValue: { getSessionById: jest.fn().mockImplementation((id: string) => Promise.resolve({ userId: 'verified-user', projectId: null })) } },
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
      .overrideGuard(CreditBalanceGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AIExecutionController>(AIExecutionController);
  });

  describe('POST /api/ai/execute', () => {
    it('should replace untrusted userId with verified identity and enqueue with correct metadata', async () => {
      const request: AIExecutionRequest = {
        sessionId: VALID_SESSION_UUID,
        conversationId: 'conv-456',
        userId: 'untrusted-user',
        prompt: 'Hello AI',
        provider: 'stub',
        metadata: { source: 'test' },
      };

      const identity: ApiKeyIdentity = {
        userId: 'verified-user',
        apiKeyId: 'key-123',
        scopes: ['ai:execute'],
      };

      const result = await controller.execute(request, identity);

      expect(result).toHaveProperty('executionId');
      expect(result.status).toBe('queued');
      expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

      const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
      expect(payload.userId).toBe('verified-user');
      expect(payload.apiKeyId).toBe('key-123');

      expect(mockUsageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
      const intentDto = mockUsageLedgerService.writeExecutionIntent.mock.calls[0][0];
      expect(intentDto.userId).toBe('verified-user');
      expect(intentDto.metadata?.apiKeyId).toBe('key-123');
      expect(intentDto.metadata?.source).toBe('test');
    });

    it('should propagate exceptions from queue service unchanged', async () => {
      const request: AIExecutionRequest = {
        sessionId: VALID_SESSION_UUID,
        conversationId: 'conv-456',
        userId: 'untrusted-user',
        prompt: 'Hello AI',
        provider: 'stub',
      };

      const identity: ApiKeyIdentity = {
        userId: 'verified-user',
        apiKeyId: 'key-123',
        scopes: ['ai:execute'],
      };

      const queueError = new Error('Queue unavailable');
      mockQueueService.enqueueExecution.mockRejectedValue(queueError);

      await expect(controller.execute(request, identity)).rejects.toThrow('Queue unavailable');
      expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    });

    it('should not retry on failure', async () => {
      const request: AIExecutionRequest = {
        sessionId: VALID_SESSION_UUID,
        conversationId: 'conv-456',
        userId: 'untrusted-user',
        prompt: 'Hello AI',
        provider: 'stub',
      };

      const identity: ApiKeyIdentity = {
        userId: 'verified-user',
        apiKeyId: 'key-123',
        scopes: ['ai:execute'],
      };

      const error = new Error('Network timeout');
      mockQueueService.enqueueExecution.mockRejectedValue(error);

      await expect(controller.execute(request, identity)).rejects.toThrow('Network timeout');
      expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    });

    it('should replace userId and inject apiKeyId into metadata', async () => {
      const request: AIExecutionRequest = {
        sessionId: VALID_SESSION_UUID,
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
        userId: 'verified-user',
        apiKeyId: 'key-999',
        scopes: ['ai:execute'],
      };

      await controller.execute(request, identity);

      const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
      expect(payload.userId).toBe('verified-user');
      expect(payload.prompt).toBe('Complex prompt with special chars: !@#$%');

      const intentDto = mockUsageLedgerService.writeExecutionIntent.mock.calls[0][0];
      expect(intentDto.userId).toBe('verified-user');
      expect(intentDto.metadata?.nested).toEqual({ data: 'value' });
      expect(intentDto.metadata?.array).toEqual([1, 2, 3]);
      expect(intentDto.metadata?.apiKeyId).toBe('key-999');
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
    harnessEntitled: true,
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
      .overrideGuard(CreditBalanceGuard).useValue(mockGuard)
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
    harnessEntitled: true,
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
      .overrideGuard(CreditBalanceGuard).useValue(mockGuard)
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
    harnessEntitled: true,
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
      .overrideGuard(CreditBalanceGuard).useValue(mockGuard)
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

/**
 * AGENT-PLATFORM-06: Upstream identity propagation tests
 *
 * Verifies that POST /api/ai/execute forwards optional identity fields
 * (agentRole, builderProfileId, collaborationRunId, referralTraceId)
 * into the BullMQ job payload and usage intent metadata, and that
 * requests without identity fields remain backward compatible.
 */
describe('AIExecutionController — upstream identity propagation (AGENT-PLATFORM-06)', () => {
  let controller: AIExecutionController;
  let mockUsageLedgerService: Record<string, jest.Mock>;
  let mockQueueService: Record<string, jest.Mock>;

  const VALID_SESSION_UUID = '35d53116-6723-4571-af12-ac256977c007';

  const defaultIdentity: ApiKeyIdentity = {
    userId: 'user-uuid-06',
    apiKeyId: 'key-uuid-06',
    scopes: ['ai:execute'],
    harnessEntitled: true,
  };

  function makeRequest(overrides?: Partial<AIExecutionRequest>): AIExecutionRequest {
    return {
      sessionId: VALID_SESSION_UUID,
      conversationId: 'conv-06',
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
      .overrideGuard(CreditBalanceGuard).useValue(mockGuard)
      .compile();

    controller = module.get<AIExecutionController>(AIExecutionController);
  });

  it('Test A: identity fields forwarded to enqueueExecution payload', async () => {
    const result = await controller.execute(
      makeRequest({
        agentRole: 'builder',
        builderProfileId: 'builder-default',
        collaborationRunId: 'collab-run-001',
        referralTraceId: 'ref-trace-001',
      }),
      defaultIdentity,
    );

    expect(result.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.agentRole).toBe('builder');
    expect(payload.builderProfileId).toBe('builder-default');
    expect(payload.collaborationRunId).toBe('collab-run-001');
    expect(payload.referralTraceId).toBe('ref-trace-001');
  });

  it('Test B: identity fields included in writeExecutionIntent call', async () => {
    await controller.execute(
      makeRequest({
        agentRole: 'reviewer',
        builderProfileId: 'reviewer-profile-001',
      }),
      defaultIdentity,
    );

    expect(mockUsageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
    const intentDto = mockUsageLedgerService.writeExecutionIntent.mock.calls[0][0];
    expect(intentDto.agentRole).toBe('reviewer');
    expect(intentDto.builderProfileId).toBe('reviewer-profile-001');
  });

  it('Test C: request without identity fields still succeeds (backward compatible)', async () => {
    const result = await controller.execute(makeRequest(), defaultIdentity);

    expect(result.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload).not.toHaveProperty('agentRole');
    expect(payload).not.toHaveProperty('builderProfileId');
    expect(payload).not.toHaveProperty('collaborationRunId');
    expect(payload).not.toHaveProperty('referralTraceId');
  });

  it('Test D: partial identity fields forwarded (only agentRole set)', async () => {
    await controller.execute(
      makeRequest({ agentRole: 'builder' }),
      defaultIdentity,
    );

    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.agentRole).toBe('builder');
    expect(payload).not.toHaveProperty('builderProfileId');
    expect(payload).not.toHaveProperty('collaborationRunId');
    expect(payload).not.toHaveProperty('referralTraceId');
  });

  it('Test E: identity fields propagated through writeExecutionIntent DTO (all four)', async () => {
    await controller.execute(
      makeRequest({
        agentRole: 'builder',
        builderProfileId: 'bp-1',
        collaborationRunId: 'cr-1',
        referralTraceId: 'rt-1',
      }),
      defaultIdentity,
    );

    const intentDto = mockUsageLedgerService.writeExecutionIntent.mock.calls[0][0];
    expect(intentDto.agentRole).toBe('builder');
    expect(intentDto.builderProfileId).toBe('bp-1');
    expect(intentDto.collaborationRunId).toBe('cr-1');
    expect(intentDto.referralTraceId).toBe('rt-1');
  });
});

/**
 * AGENT-HARNESS-05C7: Harness identity entitlement gate tests
 *
 * Verifies that harnessVersion='v1' requires explicit identity.harnessEntitled === true.
 * Plain execution (no harnessVersion) must remain unchanged for non-entitled identities.
 */
describe('AIExecutionController — harness identity entitlement gate (AGENT-HARNESS-05C7)', () => {
  let controller: AIExecutionController;
  let mockSessionService: Record<string, jest.Mock>;
  let mockUsageLedgerService: Record<string, jest.Mock>;
  let mockQueueService: Record<string, jest.Mock>;
  let mockUserAiInstructionsService: Record<string, jest.Mock>;
  let mockProjectAiContextService: Record<string, jest.Mock>;

  const ownerUserId = '6a3fe737-0945-44f4-a95f-f1ac3a3e4f6c';
  const otherUserId = '0ff778c3-f5a1-4b06-b367-38c9a6fd8e2c';
  const sessionId = '35d53116-6723-4571-af12-ac256977c007';

  const harnessEntitledIdentity: ApiKeyIdentity = {
    userId: ownerUserId,
    apiKeyId: 'key-harness-entitled-001',
    scopes: ['ai:execute'],
    harnessEntitled: true,
  };

  const browserSessionIdentity: ApiKeyIdentity = {
    userId: ownerUserId,
    apiKeyId: 'browser-session',
    scopes: ['ai:execute'],
  };

  function makeRequest(overrides?: Partial<AIExecutionRequest>): AIExecutionRequest {
    return {
      sessionId,
      conversationId: 'conv-05c7',
      userId: 'ignored',
      prompt: 'Hello from 05C7',
      provider: 'stub',
      ...overrides,
    };
  }

  function expectNoForbiddenPathSideEffects(): void {
    expect(mockSessionService.getSessionById).not.toHaveBeenCalled();
    expect(mockUserAiInstructionsService.getByUserId).not.toHaveBeenCalled();
    expect(mockProjectAiContextService.getByProjectId).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.reuseExecutionIntent).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
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
        {
          provide: GlobalSafetyLimitService,
          useValue: { checkAndRecord: jest.fn(), recordExecutionCost: jest.fn() },
        },
        { provide: QueueService, useValue: mockQueueService },
        {
          provide: ExecutionResultService,
          useValue: { getExecution: jest.fn(), requestCancel: jest.fn() },
        },
        {
          provide: ExecutionStreamService,
          useValue: { subscribe: jest.fn(), unsubscribe: jest.fn() },
        },
        { provide: UserAiInstructionsService, useValue: mockUserAiInstructionsService },
        { provide: ProjectAiContextService, useValue: mockProjectAiContextService },
        { provide: SessionService, useValue: mockSessionService },
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
      .overrideGuard(CreditBalanceGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AIExecutionController>(AIExecutionController);
  });

  it('Test A: non-entitled browser-session, no harnessVersion -> succeeds and queues', async () => {
    const result = await controller.execute(makeRequest(), browserSessionIdentity);

    expect(result).toHaveProperty('executionId');
    expect(result.status).toBe('queued');
    expect(mockSessionService.getSessionById).toHaveBeenCalledTimes(2);
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
  });

  it("Test B: non-entitled browser-session, harnessVersion 'v1' -> ForbiddenException before side effects", async () => {
    await expect(
      controller.execute(
        makeRequest({ harnessVersion: 'v1' }),
        browserSessionIdentity,
      ),
    ).rejects.toThrow(ForbiddenException);

    expectNoForbiddenPathSideEffects();
  });

  it("Test C: isInternal true but not harnessEntitled, harnessVersion 'v1' -> ForbiddenException", async () => {
    const internalNotEntitledIdentity: ApiKeyIdentity = {
      userId: ownerUserId,
      apiKeyId: 'internal-no-harness-001',
      scopes: ['ai:execute'],
      isInternal: true,
    };

    await expect(
      controller.execute(
        makeRequest({ harnessVersion: 'v1' }),
        internalNotEntitledIdentity,
      ),
    ).rejects.toThrow(ForbiddenException);

    expectNoForbiddenPathSideEffects();
  });

  it("Test D: scopes ['ai:execute'] but not harnessEntitled, harnessVersion 'v1' -> ForbiddenException", async () => {
    const executeScopeOnlyIdentity: ApiKeyIdentity = {
      userId: ownerUserId,
      apiKeyId: 'key-execute-only-001',
      scopes: ['ai:execute'],
    };

    await expect(
      controller.execute(
        makeRequest({ harnessVersion: 'v1' }),
        executeScopeOnlyIdentity,
      ),
    ).rejects.toThrow(ForbiddenException);

    expectNoForbiddenPathSideEffects();
  });

  it("Test E: harnessEntitled true, harnessVersion 'v1' -> accepted, queued, harnessVersion forwarded", async () => {
    const result = await controller.execute(
      makeRequest({ harnessVersion: 'v1' }),
      harnessEntitledIdentity,
    );

    expect(result).toHaveProperty('executionId');
    expect(result.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.harnessVersion).toBe('v1');
  });

  it('Test F: harnessEntitled true, no harnessVersion -> succeeds, payload omits harnessVersion', async () => {
    const result = await controller.execute(makeRequest(), harnessEntitledIdentity);

    expect(result).toHaveProperty('executionId');
    expect(result.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload).not.toHaveProperty('harnessVersion');
  });

  it("Test G: invalid harnessVersion 'v2' -> BadRequestException before entitlement/session lookup", async () => {
    await expect(
      controller.execute(
        makeRequest({ harnessVersion: 'v2' as any }),
        browserSessionIdentity,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.execute(
        makeRequest({ harnessVersion: 'v2' as any }),
        browserSessionIdentity,
      ),
    ).rejects.toThrow("harnessVersion must be 'v1' when provided");

    expect(mockSessionService.getSessionById).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.reuseExecutionIntent).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
  });

  it("Test H: session ownership mismatch + harnessEntitled true + harnessVersion 'v1' -> NotFoundException", async () => {
    mockSessionService.getSessionById.mockResolvedValue({ userId: otherUserId, projectId: null });

    await expect(
      controller.execute(
        makeRequest({ harnessVersion: 'v1' }),
        harnessEntitledIdentity,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(mockSessionService.getSessionById).toHaveBeenCalledTimes(1);
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
  });

  it('Test I: forbidden error message is exactly "Forbidden" and does not leak gate internals', async () => {
    const error = await controller
      .execute(
        makeRequest({ harnessVersion: 'v1' }),
        browserSessionIdentity,
      )
      .catch((e) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.message).toBe('Forbidden');
    expect(error.message).not.toMatch(/harness|entitlement|scope|config|gate/i);
  });

  it('Test J: existing 05B9, 05C2, 05C5 focused behaviors remain compatible', async () => {
    await expect(
      controller.execute(
        makeRequest({ sessionId: 'not-a-uuid', harnessVersion: 'v1' }),
        harnessEntitledIdentity,
      ),
    ).rejects.toThrow('sessionId must be a valid UUID');
    expect(mockSessionService.getSessionById).not.toHaveBeenCalled();

    mockUsageLedgerService.writeExecutionIntent.mockClear();
    mockQueueService.enqueueExecution.mockClear();

    const harnessResult = await controller.execute(
      makeRequest({ harnessVersion: 'v1' }),
      harnessEntitledIdentity,
    );
    expect(harnessResult.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    mockQueueService.enqueueExecution.mockClear();
    mockUsageLedgerService.writeExecutionIntent.mockClear();
    mockSessionService.getSessionById.mockResolvedValue({ userId: otherUserId, projectId: null });

    await expect(
      controller.execute(
        makeRequest({ harnessVersion: 'v1' }),
        harnessEntitledIdentity,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });
});

describe('AIExecutionController provider/model catalogue validation (FR-04B Step 2a)', () => {
  let controller: AIExecutionController;
  let mockUsageLedgerService: Record<string, jest.Mock>;
  let mockQueueService: Record<string, jest.Mock>;
  let originalAnthropicModel: string | undefined;

  const VALID_SESSION_UUID = '35d53116-6723-4571-af12-ac256977c007';
  const identity: ApiKeyIdentity = {
    userId: 'provider-validation-user',
    apiKeyId: 'provider-validation-key',
    scopes: ['ai:execute'],
    harnessEntitled: true,
  };

  function makeRequest(overrides?: Partial<AIExecutionRequest>): AIExecutionRequest {
    return {
      sessionId: VALID_SESSION_UUID,
      conversationId: 'conv-provider-validation',
      userId: 'ignored',
      prompt: 'Provider/model validation',
      provider: 'xai',
      ...overrides,
    };
  }

  beforeEach(async () => {
    originalAnthropicModel = process.env.ANTHROPIC_MODEL;
    delete process.env.AI_PROVIDER;
    delete process.env.ANTHROPIC_MODEL;

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
        { provide: SessionService, useValue: { getSessionById: jest.fn().mockResolvedValue({ userId: identity.userId, projectId: null }) } },
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard).useValue(mockGuard)
      .overrideGuard(AuthorizationGuard).useValue(mockGuard)
      .overrideGuard(QuotaGuard).useValue(mockGuard)
      .overrideGuard(TokenQuotaGuard).useValue(mockGuard)
      .overrideGuard(CreditBalanceGuard).useValue(mockGuard)
      .compile();

    controller = module.get<AIExecutionController>(AIExecutionController);
  });

  afterEach(() => {
    if (originalAnthropicModel === undefined) {
      delete process.env.ANTHROPIC_MODEL;
    } else {
      process.env.ANTHROPIC_MODEL = originalAnthropicModel;
    }
  });

  it('resolves omitted xAI model to grok-4.5 before enqueue', async () => {
    await controller.execute(
      makeRequest({
        provider: 'xai',
        model: undefined,
      }),
      identity,
    );

    expect(mockQueueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'xai',
        model: 'grok-4.5',
      }),
    );
  });

  it('accepts xAI grok-4.20', async () => {
    await controller.execute(
      makeRequest({
        provider: 'xai',
        model: 'grok-4.20',
      }),
      identity,
    );

    expect(mockQueueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'xai',
        model: 'grok-4.20',
      }),
    );
  });

  it('rejects xAI grok-3 before ledger and queue', async () => {
    await expect(
      controller.execute(
        makeRequest({
          provider: 'xai',
          model: 'grok-3',
        }),
        identity,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('rejects cross-provider model mismatch before queue submission', async () => {
    await expect(
      controller.execute(
        makeRequest({
          provider: 'xai',
          model: 'gpt-4o',
        }),
        identity,
      ),
    ).rejects.toThrow('Model "gpt-4o" is not valid for provider "xai".');

    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('rejects unknown model IDs before queue submission', async () => {
    await expect(
      controller.execute(
        makeRequest({
          provider: 'deepseek',
          model: 'unknown-model-id',
        }),
        identity,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('fails Anthropic requests when ANTHROPIC_MODEL is missing', async () => {
    await expect(
      controller.execute(
        makeRequest({
          provider: 'anthropic',
          model: undefined,
        }),
        identity,
      ),
    ).rejects.toThrow(
      'ANTHROPIC_MODEL environment variable is required when provider is "anthropic"',
    );

    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });
});
