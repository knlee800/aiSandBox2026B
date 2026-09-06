import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
  AIExecutionController,
  sortKeysRecursive,
  computePayloadDigest,
  buildHarnessEntitlementClaimString,
  signHarnessEntitlementClaim,
} from './ai-execution.controller';
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
import { UserAgentService } from '../user-agent/user-agent.service';

const EXEC_01C5B1_TEST_HMAC_SECRET = 'test-hmac-secret-do-not-use-in-production-01c5b';
let previousHarnessEntitlementHmacSecret: string | undefined;

beforeEach(() => {
  previousHarnessEntitlementHmacSecret = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
  process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = EXEC_01C5B1_TEST_HMAC_SECRET;
});

afterEach(() => {
  if (previousHarnessEntitlementHmacSecret === undefined) {
    delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
  } else {
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = previousHarnessEntitlementHmacSecret;
  }
});

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

  it('rejects xAI grok-4.20 before ledger and queue without substituting grok-4.5', async () => {
    await expect(
      controller.execute(
        makeRequest({
          provider: 'xai',
          model: 'grok-4.20',
        }),
        identity,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
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

describe('AIExecutionController executionIntent propagation (BUILDER-INTENT-01)', () => {
  let controller: AIExecutionController;
  let mockUsageLedgerService: Record<string, jest.Mock>;
  let mockQueueService: Record<string, jest.Mock>;

  const VALID_SESSION_UUID = '35d53116-6723-4571-af12-ac256977c007';
  const identity: ApiKeyIdentity = {
    userId: 'intent-user',
    apiKeyId: 'intent-key',
    scopes: ['ai:execute'],
    harnessEntitled: true,
  };

  function makeRequest(overrides?: Partial<AIExecutionRequest>): AIExecutionRequest {
    return {
      sessionId: VALID_SESSION_UUID,
      conversationId: 'conv-intent',
      userId: 'ignored',
      prompt: 'Intent test prompt',
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
        {
          provide: UserAiInstructionsService,
          useValue: { getByUserId: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: ProjectAiContextService,
          useValue: { getByProjectId: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: SessionService,
          useValue: {
            getSessionById: jest
              .fn()
              .mockResolvedValue({ userId: identity.userId, projectId: null }),
          },
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
      .overrideGuard(CreditBalanceGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AIExecutionController>(AIExecutionController);
  });

  it('explicit conversation intent propagates into queue payload', async () => {
    const result = await controller.execute(
      makeRequest({ executionIntent: 'conversation' }),
      identity,
    );

    expect(result.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        executionIntent: 'conversation',
      }),
    );
  });

  it('explicit workspace_mutation intent propagates into queue payload', async () => {
    const result = await controller.execute(
      makeRequest({ executionIntent: 'workspace_mutation' }),
      identity,
    );

    expect(result.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        executionIntent: 'workspace_mutation',
      }),
    );
  });

  it('omitted intent defaults to workspace_mutation for backward compatibility', async () => {
    const result = await controller.execute(makeRequest(), identity);

    expect(result.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        executionIntent: 'workspace_mutation',
      }),
    );
  });

  it('invalid intent is rejected with BadRequestException before side effects', async () => {
    await expect(
      controller.execute(
        makeRequest({ executionIntent: 'invalid-intent' as any }),
        identity,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  });
});

/**
 * AGENT-PLATFORM-CREATE-01D: persisted user-agent identity binding
 * AGENT-PLATFORM-EXEC-01A: same identity may participate in workspace_mutation
 *
 * Additive optional agentId on POST /api/ai/execute. Owner-scoped lookup
 * before ledger/enqueue. Supported intents: conversation and workspace_mutation.
 * Identity block composed onto existing globalInstructions. Trace agentId
 * lives in usage_records.metadata JSONB. EXEC-01C4: entitled conversation
 * Harness may include owner-validated agentId; mutation + harness stays 400.
 */
describe('AIExecutionController — persisted user-agent identity (AGENT-PLATFORM-CREATE-01D / EXEC-01A)', () => {
  let controller: AIExecutionController;
  let mockUsageLedgerService: Record<string, jest.Mock>;
  let mockQueueService: Record<string, jest.Mock>;
  let mockUserAgentService: Record<string, jest.Mock>;
  let mockUserAiInstructionsService: Record<string, jest.Mock>;

  const VALID_SESSION_UUID = '35d53116-6723-4571-af12-ac256977c007';
  const OWNER_USER_ID = '6a3fe737-0945-44f4-a95f-f1ac3a3e4f6c';
  const OWNED_AGENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const FROZEN_IDENTITY_BLOCK = [
    'Active agent identity:',
    'Name: Research Analyst',
    'Role: Analyst',
    'Description: Helps review research notes.',
  ].join('\n');

  const ownerIdentity: ApiKeyIdentity = {
    userId: OWNER_USER_ID,
    apiKeyId: 'key-create-01d',
    scopes: ['ai:execute'],
    harnessEntitled: true,
  };

  const ownedAgent = {
    id: OWNED_AGENT_ID,
    userId: OWNER_USER_ID,
    name: 'Research Analyst',
    role: 'Analyst',
    description: 'Helps review research notes.',
  };

  function makeRequest(overrides?: Partial<AIExecutionRequest>): AIExecutionRequest {
    return {
      sessionId: VALID_SESSION_UUID,
      conversationId: 'conv-create-01d',
      userId: 'untrusted-client-user',
      prompt: 'Ask as my persisted agent.',
      provider: 'stub',
      ...overrides,
    };
  }

  function expectNoLedgerOrEnqueue(): void {
    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.reuseExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  }

  async function compileController(options?: {
    omitUserAgentService?: boolean;
  }): Promise<void> {
    mockUsageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      reuseExecutionIntent: jest.fn().mockResolvedValue('exec-reuse-01d'),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
      updateExecutionResult: jest.fn().mockResolvedValue(undefined),
    };
    mockQueueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    mockUserAgentService = {
      findOneByIdAndUserId: jest.fn().mockResolvedValue(ownedAgent),
    };
    mockUserAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue(null),
    };

    const mockGuard = { canActivate: jest.fn(() => true) };
    const providers: any[] = [
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
      {
        provide: ProjectAiContextService,
        useValue: { getByProjectId: jest.fn().mockResolvedValue(null) },
      },
      {
        provide: SessionService,
        useValue: {
          getSessionById: jest
            .fn()
            .mockResolvedValue({ userId: OWNER_USER_ID, projectId: null }),
        },
      },
    ];
    if (!options?.omitUserAgentService) {
      providers.push({
        provide: UserAgentService,
        useValue: mockUserAgentService,
      });
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIExecutionController],
      providers,
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
  }

  beforeEach(async () => {
    await compileController();
  });

  it('1. valid owner Ask binds identity into globalInstructions and metadata then enqueues', async () => {
    mockUserAiInstructionsService.getByUserId.mockResolvedValue(
      'Always be concise.',
    );

    const result = await controller.execute(
      makeRequest({
        agentId: OWNED_AGENT_ID,
        executionIntent: 'conversation',
      }),
      ownerIdentity,
    );

    expect(result.status).toBe('queued');
    expect(result).toHaveProperty('executionId');
    expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledTimes(1);
    expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledWith(
      OWNED_AGENT_ID,
      OWNER_USER_ID,
    );
    expect(mockUsageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.executionIntent).toBe('conversation');
    expect(payload.globalInstructions).toBe(
      `${FROZEN_IDENTITY_BLOCK}\n\nAlways be concise.`,
    );
    expect(payload.agentId).toBe(OWNED_AGENT_ID);
    expect(payload).not.toHaveProperty('harnessVersion');
    expect(payload).not.toHaveProperty('agentRole');
    expect(payload).not.toHaveProperty('builderProfileId');

    const intentDto = mockUsageLedgerService.writeExecutionIntent.mock.calls[0][0];
    expect(intentDto.metadata?.agentId).toBe(OWNED_AGENT_ID);
    expect(intentDto.agentRole).toBeUndefined();
    expect(intentDto.builderProfileId).toBeUndefined();
  });

  it('2. nonexistent agent returns 404 Not Found with no ledger write or enqueue', async () => {
    mockUserAgentService.findOneByIdAndUserId.mockResolvedValue(null);

    await expect(
      controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'conversation',
        }),
        ownerIdentity,
      ),
    ).rejects.toThrow('Not Found');

    const error = await controller
      .execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'conversation',
        }),
        ownerIdentity,
      )
      .catch((e) => e);
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.getStatus()).toBe(404);
    expect(error).not.toBeInstanceOf(ForbiddenException);
    expectNoLedgerOrEnqueue();
  });

  it('3. cross-user agent lookup uses authenticated userId and returns 404', async () => {
    mockUserAgentService.findOneByIdAndUserId.mockResolvedValue(null);

    await expect(
      controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'conversation',
          userId: 'attacker-user-id',
        }),
        ownerIdentity,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledWith(
      OWNED_AGENT_ID,
      OWNER_USER_ID,
    );
    expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalledWith(
      OWNED_AGENT_ID,
      'attacker-user-id',
    );
    expectNoLedgerOrEnqueue();
  });

  it('4. soft-deleted agent (owner-scoped lookup null) returns 404 with no enqueue', async () => {
    mockUserAgentService.findOneByIdAndUserId.mockResolvedValue(null);

    const error = await controller
      .execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'conversation',
        }),
        ownerIdentity,
      )
      .catch((e) => e);

    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.message).toBe('Not Found');
    expect(error.getStatus()).toBe(404);
    expectNoLedgerOrEnqueue();
  });

  it('5. Ask without agentId leaves Builder Ask unchanged and skips owner lookup', async () => {
    const result = await controller.execute(
      makeRequest({ executionIntent: 'conversation' }),
      ownerIdentity,
    );

    expect(result.status).toBe('queued');
    expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.executionIntent).toBe('conversation');
    expect(payload.globalInstructions).toBeUndefined();
    expect(payload).not.toHaveProperty('harnessVersion');

    const intentDto = mockUsageLedgerService.writeExecutionIntent.mock.calls[0][0];
    expect(intentDto.metadata).not.toHaveProperty('agentId');
  });

  it('6. Build without agentId leaves Builder Build unchanged and skips owner lookup', async () => {
    const omitted = await controller.execute(makeRequest(), ownerIdentity);
    expect(omitted.status).toBe('queued');
    expect(mockQueueService.enqueueExecution.mock.calls[0][0].executionIntent).toBe(
      'workspace_mutation',
    );

    mockQueueService.enqueueExecution.mockClear();
    mockUsageLedgerService.writeExecutionIntent.mockClear();
    mockUserAgentService.findOneByIdAndUserId.mockClear();

    const explicit = await controller.execute(
      makeRequest({ executionIntent: 'workspace_mutation' }),
      ownerIdentity,
    );
    expect(explicit.status).toBe('queued');
    expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution.mock.calls[0][0].executionIntent).toBe(
      'workspace_mutation',
    );

    const intentDto = mockUsageLedgerService.writeExecutionIntent.mock.calls[0][0];
    expect(intentDto.metadata).not.toHaveProperty('agentId');
  });

  it('7. AGENT-PLATFORM-EXEC-01A: agentId + workspace_mutation is accepted on the existing Build path with identity preserved', async () => {
    mockUserAiInstructionsService.getByUserId.mockResolvedValue(
      'Always be concise.',
    );

    const result = await controller.execute(
      makeRequest({
        agentId: OWNED_AGENT_ID,
        executionIntent: 'workspace_mutation',
      }),
      ownerIdentity,
    );

    expect(result.status).toBe('queued');
    expect(result).toHaveProperty('executionId');
    expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledTimes(1);
    expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledWith(
      OWNED_AGENT_ID,
      OWNER_USER_ID,
    );
    expect(mockUsageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.executionIntent).toBe('workspace_mutation');
    expect(payload.globalInstructions).toBe(
      `${FROZEN_IDENTITY_BLOCK}\n\nAlways be concise.`,
    );
    expect(payload).not.toHaveProperty('harnessVersion');
    expect(payload.agentId).toBe(OWNED_AGENT_ID);

    const intentDto = mockUsageLedgerService.writeExecutionIntent.mock.calls[0][0];
    expect(intentDto.metadata?.agentId).toBe(OWNED_AGENT_ID);

    mockQueueService.enqueueExecution.mockClear();
    mockUsageLedgerService.writeExecutionIntent.mockClear();
    mockUserAgentService.findOneByIdAndUserId.mockClear();

    const omitted = await controller.execute(
      makeRequest({ agentId: OWNED_AGENT_ID }),
      ownerIdentity,
    );
    expect(omitted.status).toBe('queued');
    expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledWith(
      OWNED_AGENT_ID,
      OWNER_USER_ID,
    );
    expect(mockQueueService.enqueueExecution.mock.calls[0][0].executionIntent).toBe(
      'workspace_mutation',
    );
    expect(
      mockUsageLedgerService.writeExecutionIntent.mock.calls[0][0].metadata?.agentId,
    ).toBe(OWNED_AGENT_ID);
  });

  it('8. agentId + harnessVersion + workspace_mutation remains HTTP 400 and does not enqueue', async () => {
    await expect(
      controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'workspace_mutation',
          harnessVersion: 'v1',
        }),
        ownerIdentity,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'workspace_mutation',
          harnessVersion: 'v1',
        }),
        ownerIdentity,
      ),
    ).rejects.toThrow('agentId is not supported when harnessVersion is provided');

    expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalled();
    expectNoLedgerOrEnqueue();
  });

  it('9. empty, whitespace, and non-string agentId are HTTP 400 with no owner lookup', async () => {
    await expect(
      controller.execute(
        makeRequest({
          agentId: '',
          executionIntent: 'conversation',
        }),
        ownerIdentity,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.execute(
        makeRequest({
          agentId: '   ',
          executionIntent: 'conversation',
        }),
        ownerIdentity,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.execute(
        {
          ...makeRequest({ executionIntent: 'conversation' }),
          agentId: 12345,
        } as any,
        ownerIdentity,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalled();
    expectNoLedgerOrEnqueue();
  });

  it('10. existing Ask accounting and AGENT-PLATFORM-06 identity fields remain unchanged', async () => {
    const result = await controller.execute(
      makeRequest({
        agentId: OWNED_AGENT_ID,
        executionIntent: 'conversation',
        agentRole: 'builder',
        builderProfileId: 'builder-default',
        collaborationRunId: 'collab-run-01d',
        referralTraceId: 'ref-trace-01d',
      }),
      ownerIdentity,
    );

    expect(result.status).toBe('queued');
    expect(mockUsageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.agentRole).toBe('builder');
    expect(payload.builderProfileId).toBe('builder-default');
    expect(payload.collaborationRunId).toBe('collab-run-01d');
    expect(payload.referralTraceId).toBe('ref-trace-01d');
    expect(payload.agentRole).not.toBe(ownedAgent.role);
    expect(payload.builderProfileId).not.toBe(OWNED_AGENT_ID);
    expect(payload.agentId).toBe(OWNED_AGENT_ID);

    const intentDto = mockUsageLedgerService.writeExecutionIntent.mock.calls[0][0];
    expect(intentDto.agentRole).toBe('builder');
    expect(intentDto.builderProfileId).toBe('builder-default');
    expect(intentDto.collaborationRunId).toBe('collab-run-01d');
    expect(intentDto.referralTraceId).toBe('ref-trace-01d');
    expect(intentDto.metadata?.agentId).toBe(OWNED_AGENT_ID);
  });

  it('authorized Ask reuse path also stores agentId in metadata', async () => {
    mockUsageLedgerService.findByRequestId.mockResolvedValue({
      executionStatus: 'timeout',
    });

    const result = await controller.execute(
      makeRequest({
        agentId: OWNED_AGENT_ID,
        executionIntent: 'conversation',
      }),
      ownerIdentity,
      'retry-key-01d',
    );

    expect(result.status).toBe('queued');
    expect(mockUsageLedgerService.reuseExecutionIntent).toHaveBeenCalledTimes(1);
    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

    const reuseDto = mockUsageLedgerService.reuseExecutionIntent.mock.calls[0][0];
    expect(reuseDto.metadata?.agentId).toBe(OWNED_AGENT_ID);
    expect(mockQueueService.enqueueExecution.mock.calls[0][0].agentId).toBe(
      OWNED_AGENT_ID,
    );
  });

  describe('optional UserAgentService fail-closed', () => {
    beforeEach(async () => {
      await compileController({ omitUserAgentService: true });
    });

    it('11a. agentId present without UserAgentService is a server failure with no enqueue', async () => {
      await expect(
        controller.execute(
          makeRequest({
            agentId: OWNED_AGENT_ID,
            executionIntent: 'conversation',
          }),
          ownerIdentity,
        ),
      ).rejects.toThrow(InternalServerErrorException);

      await expect(
        controller.execute(
          makeRequest({
            agentId: OWNED_AGENT_ID,
            executionIntent: 'conversation',
          }),
          ownerIdentity,
        ),
      ).rejects.toThrow('User-agent identity resolution is unavailable');

      expectNoLedgerOrEnqueue();
    });

    it('11b. agentId absent without UserAgentService still runs existing Builder Ask', async () => {
      const result = await controller.execute(
        makeRequest({ executionIntent: 'conversation' }),
        ownerIdentity,
      );

      expect(result.status).toBe('queued');
      expect(mockUsageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
      expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
      expect(
        mockQueueService.enqueueExecution.mock.calls[0][0].executionIntent,
      ).toBe('conversation');
      expect(
        mockQueueService.enqueueExecution.mock.calls[0][0].globalInstructions,
      ).toBeUndefined();
    });
  });

  describe('AGENT-PLATFORM-EXEC-01C4 bound Harness combination and queue agentId', () => {
    const CANONICAL_PERSISTED_AGENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const unentitledIdentity: ApiKeyIdentity = {
      userId: OWNER_USER_ID,
      apiKeyId: 'browser-session',
      scopes: ['ai:execute'],
    };

    it('1. entitled owner conversation + agentId + harnessVersion v1 is accepted and enqueues canonical agentId', async () => {
      mockUserAiInstructionsService.getByUserId.mockResolvedValue(
        'Always be concise.',
      );

      const result = await controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'conversation',
          harnessVersion: 'v1',
        }),
        ownerIdentity,
      );

      expect(result.status).toBe('queued');
      expect(result).toHaveProperty('executionId');
      expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledTimes(1);
      expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledWith(
        OWNED_AGENT_ID,
        OWNER_USER_ID,
      );
      expect(mockUsageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
      expect(mockUsageLedgerService.reuseExecutionIntent).not.toHaveBeenCalled();
      expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

      const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
      expect(payload.agentId).toBe(OWNED_AGENT_ID);
      expect(payload.harnessVersion).toBe('v1');
      expect(payload.executionIntent).toBe('conversation');
      expect(payload.globalInstructions).toBe(
        `${FROZEN_IDENTITY_BLOCK}\n\nAlways be concise.`,
      );
      expect(payload.userId).toBe(OWNER_USER_ID);

      const intentDto = mockUsageLedgerService.writeExecutionIntent.mock.calls[0][0];
      expect(intentDto.metadata?.agentId).toBe(OWNED_AGENT_ID);
    });

    it('2. whitespace-surrounded agentId is trimmed for lookup and queue uses canonical persisted id', async () => {
      const requestedAgentId = OWNED_AGENT_ID;
      mockUserAgentService.findOneByIdAndUserId.mockResolvedValue({
        ...ownedAgent,
        id: CANONICAL_PERSISTED_AGENT_ID,
      });

      const result = await controller.execute(
        makeRequest({
          agentId: `  ${requestedAgentId}  `,
          executionIntent: 'conversation',
          harnessVersion: 'v1',
        }),
        ownerIdentity,
      );

      expect(result.status).toBe('queued');
      expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledTimes(1);
      expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledWith(
        requestedAgentId,
        OWNER_USER_ID,
      );
      expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalledWith(
        `  ${requestedAgentId}  `,
        OWNER_USER_ID,
      );

      const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
      expect(payload.agentId).toBe(CANONICAL_PERSISTED_AGENT_ID);
      expect(payload.agentId).not.toBe(`  ${requestedAgentId}  `);
      expect(payload.harnessVersion).toBe('v1');

      const intentDto = mockUsageLedgerService.writeExecutionIntent.mock.calls[0][0];
      expect(intentDto.metadata?.agentId).toBe(CANONICAL_PERSISTED_AGENT_ID);
    });

    it('3. same combination without Harness entitlement is 403 before lookup, ledger, or enqueue', async () => {
      await expect(
        controller.execute(
          makeRequest({
            agentId: OWNED_AGENT_ID,
            executionIntent: 'conversation',
            harnessVersion: 'v1',
          }),
          unentitledIdentity,
        ),
      ).rejects.toThrow(ForbiddenException);

      const error = await controller
        .execute(
          makeRequest({
            agentId: OWNED_AGENT_ID,
            executionIntent: 'conversation',
            harnessVersion: 'v1',
          }),
          unentitledIdentity,
        )
        .catch((e) => e);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getStatus()).toBe(403);
      expect(error.message).toBe('Forbidden');
      expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalled();
      expectNoLedgerOrEnqueue();
    });

    it('4. missing, cross-user, or soft-deleted persisted agent is 404 with no ledger or enqueue', async () => {
      mockUserAgentService.findOneByIdAndUserId.mockResolvedValue(null);

      const missingError = await controller
        .execute(
          makeRequest({
            agentId: OWNED_AGENT_ID,
            executionIntent: 'conversation',
            harnessVersion: 'v1',
          }),
          ownerIdentity,
        )
        .catch((e) => e);
      expect(missingError).toBeInstanceOf(NotFoundException);
      expect(missingError.getStatus()).toBe(404);
      expect(missingError).not.toBeInstanceOf(ForbiddenException);

      mockUserAgentService.findOneByIdAndUserId.mockClear();
      mockUserAgentService.findOneByIdAndUserId.mockResolvedValue(null);

      await expect(
        controller.execute(
          makeRequest({
            agentId: OWNED_AGENT_ID,
            executionIntent: 'conversation',
            harnessVersion: 'v1',
            userId: 'attacker-user-id',
          }),
          ownerIdentity,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledWith(
        OWNED_AGENT_ID,
        OWNER_USER_ID,
      );
      expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalledWith(
        OWNED_AGENT_ID,
        'attacker-user-id',
      );

      mockUserAgentService.findOneByIdAndUserId.mockClear();
      mockUserAgentService.findOneByIdAndUserId.mockResolvedValue(null);

      const softDeletedError = await controller
        .execute(
          makeRequest({
            agentId: OWNED_AGENT_ID,
            executionIntent: 'conversation',
            harnessVersion: 'v1',
          }),
          ownerIdentity,
        )
        .catch((e) => e);
      expect(softDeletedError).toBeInstanceOf(NotFoundException);
      expect(softDeletedError.getStatus()).toBe(404);

      expectNoLedgerOrEnqueue();
    });

    it('5. workspace_mutation + agentId + harnessVersion is HTTP 400 before ledger or enqueue', async () => {
      await expect(
        controller.execute(
          makeRequest({
            agentId: OWNED_AGENT_ID,
            executionIntent: 'workspace_mutation',
            harnessVersion: 'v1',
          }),
          ownerIdentity,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.execute(
          makeRequest({
            agentId: OWNED_AGENT_ID,
            executionIntent: 'workspace_mutation',
            harnessVersion: 'v1',
          }),
          ownerIdentity,
        ),
      ).rejects.toThrow('agentId is not supported when harnessVersion is provided');

      expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalled();
      expectNoLedgerOrEnqueue();
    });

    it('6. omitted executionIntent + agentId + harnessVersion defaults to mutation and is HTTP 400', async () => {
      await expect(
        controller.execute(
          makeRequest({
            agentId: OWNED_AGENT_ID,
            harnessVersion: 'v1',
          }),
          ownerIdentity,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.execute(
          makeRequest({
            agentId: OWNED_AGENT_ID,
            harnessVersion: 'v1',
          }),
          ownerIdentity,
        ),
      ).rejects.toThrow('agentId is not supported when harnessVersion is provided');

      expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalled();
      expectNoLedgerOrEnqueue();
    });

    it('7. bound conversation without Harness remains accepted and enqueues canonical agentId only', async () => {
      const result = await controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'conversation',
        }),
        ownerIdentity,
      );

      expect(result.status).toBe('queued');
      expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledTimes(1);
      const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
      expect(payload.agentId).toBe(OWNED_AGENT_ID);
      expect(payload).not.toHaveProperty('harnessVersion');
      expect(payload.executionIntent).toBe('conversation');
    });

    it('8. bound Build without Harness remains accepted and enqueues canonical agentId only', async () => {
      const result = await controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'workspace_mutation',
        }),
        ownerIdentity,
      );

      expect(result.status).toBe('queued');
      expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledTimes(1);
      const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
      expect(payload.agentId).toBe(OWNED_AGENT_ID);
      expect(payload).not.toHaveProperty('harnessVersion');
      expect(payload.executionIntent).toBe('workspace_mutation');
    });

    it('9. ordinary request without agentId does not enqueue an agentId property', async () => {
      const result = await controller.execute(
        makeRequest({ executionIntent: 'conversation' }),
        ownerIdentity,
      );

      expect(result.status).toBe('queued');
      expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalled();
      const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
      expect(payload).not.toHaveProperty('agentId');
    });

    it('10. unbound entitled Harness without agentId remains unchanged', async () => {
      const result = await controller.execute(
        makeRequest({
          executionIntent: 'conversation',
          harnessVersion: 'v1',
        }),
        ownerIdentity,
      );

      expect(result.status).toBe('queued');
      expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalled();
      expect(mockUsageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
      expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

      const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
      expect(payload.harnessVersion).toBe('v1');
      expect(payload.executionIntent).toBe('conversation');
      expect(payload).not.toHaveProperty('agentId');
    });

    it('11. idempotent reuse with a persisted agent preserves canonical agentId in metadata and queue', async () => {
      mockUsageLedgerService.findByRequestId.mockResolvedValue({
        executionStatus: 'failed',
      });

      const result = await controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'conversation',
          harnessVersion: 'v1',
        }),
        ownerIdentity,
        'retry-key-01c4',
      );

      expect(result.status).toBe('queued');
      expect(mockUsageLedgerService.reuseExecutionIntent).toHaveBeenCalledTimes(1);
      expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
      expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);

      const reuseDto = mockUsageLedgerService.reuseExecutionIntent.mock.calls[0][0];
      expect(reuseDto.metadata?.agentId).toBe(OWNED_AGENT_ID);
      const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
      expect(payload.agentId).toBe(OWNED_AGENT_ID);
      expect(payload.harnessVersion).toBe('v1');
    });
  });
});

describe('AIExecutionController — AGENT-PLATFORM-EXEC-01C5 browser-session entitlement contract', () => {
  let controller: AIExecutionController;
  let mockSessionService: Record<string, jest.Mock>;
  let mockUsageLedgerService: Record<string, jest.Mock>;
  let mockQueueService: Record<string, jest.Mock>;
  let mockUserAgentService: Record<string, jest.Mock>;

  const VALID_SESSION_UUID = '35d53116-6723-4571-af12-ac256977c007';
  const OWNER_USER_ID = '6a3fe737-0945-44f4-a95f-f1ac3a3e4f6c';
  const OTHER_USER_ID = '0ff778c3-f5a1-4b06-b367-38c9a6fd8e2c';
  const OWNED_AGENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const entitledBrowserIdentity: ApiKeyIdentity = {
    userId: OWNER_USER_ID,
    apiKeyId: 'browser-session',
    scopes: ['ai:execute'],
    isInternal: true,
    harnessEntitled: true,
  };

  const unentitledBrowserIdentity: ApiKeyIdentity = {
    userId: OWNER_USER_ID,
    apiKeyId: 'browser-session',
    scopes: ['ai:execute'],
    isInternal: true,
  };

  const ownedAgent = {
    id: OWNED_AGENT_ID,
    userId: OWNER_USER_ID,
    name: 'Research Analyst',
    role: 'Analyst',
    description: 'Helps review research notes.',
  };

  function makeRequest(overrides?: Partial<AIExecutionRequest>): AIExecutionRequest {
    return {
      sessionId: VALID_SESSION_UUID,
      conversationId: 'conv-exec-01c5',
      userId: 'untrusted-client-user',
      prompt: 'Ask via entitled browser session.',
      provider: 'stub',
      ...overrides,
    };
  }

  function expectNoLookupLedgerOrEnqueue(): void {
    expect(mockSessionService.getSessionById).not.toHaveBeenCalled();
    expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.reuseExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  }

  function expectNoLedgerOrEnqueue(): void {
    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.reuseExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
  }

  beforeEach(async () => {
    mockSessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: OWNER_USER_ID,
        projectId: null,
      }),
    };
    mockUsageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      reuseExecutionIntent: jest.fn().mockResolvedValue('exec-01c5'),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
      updateExecutionResult: jest.fn().mockResolvedValue(undefined),
    };
    mockQueueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    mockUserAgentService = {
      findOneByIdAndUserId: jest.fn().mockResolvedValue(ownedAgent),
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
        {
          provide: UserAiInstructionsService,
          useValue: { getByUserId: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: ProjectAiContextService,
          useValue: { getByProjectId: jest.fn().mockResolvedValue(null) },
        },
        { provide: SessionService, useValue: mockSessionService },
        { provide: UserAgentService, useValue: mockUserAgentService },
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

  it('entitled browser-session identity can use conversation + agentId + harnessVersion v1', async () => {
    const result = await controller.execute(
      makeRequest({
        agentId: OWNED_AGENT_ID,
        executionIntent: 'conversation',
        harnessVersion: 'v1',
      }),
      entitledBrowserIdentity,
    );

    expect(result.status).toBe('queued');
    expect(result).toHaveProperty('executionId');
    expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledWith(
      OWNED_AGENT_ID,
      OWNER_USER_ID,
    );
    expect(mockUsageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.harnessVersion).toBe('v1');
    expect(payload.agentId).toBe(OWNED_AGENT_ID);
    expect(payload.executionIntent).toBe('conversation');
    expect(payload.userId).toBe(OWNER_USER_ID);
    expect(entitledBrowserIdentity.apiKeyId).toBe('browser-session');
  });

  it('unentitled browser-session identity is 403 before session lookup, agent lookup, ledger, or enqueue', async () => {
    await expect(
      controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'conversation',
          harnessVersion: 'v1',
        }),
        unentitledBrowserIdentity,
      ),
    ).rejects.toThrow(ForbiddenException);

    expectNoLookupLedgerOrEnqueue();
  });

  it('isInternal true without harnessEntitled remains 403 before side effects', async () => {
    const internalOnly: ApiKeyIdentity = {
      userId: OWNER_USER_ID,
      apiKeyId: 'browser-session',
      scopes: ['ai:execute'],
      isInternal: true,
    };

    await expect(
      controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'conversation',
          harnessVersion: 'v1',
        }),
        internalOnly,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(internalOnly).not.toHaveProperty('harnessEntitled');
    expectNoLookupLedgerOrEnqueue();
  });

  it('workspace_mutation + agentId + harnessVersion remains rejected for an entitled browser session', async () => {
    await expect(
      controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'workspace_mutation',
          harnessVersion: 'v1',
        }),
        entitledBrowserIdentity,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'workspace_mutation',
          harnessVersion: 'v1',
        }),
        entitledBrowserIdentity,
      ),
    ).rejects.toThrow('agentId is not supported when harnessVersion is provided');

    expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalled();
    expectNoLedgerOrEnqueue();
  });

  it('omitted intent + agentId + harnessVersion still defaults to mutation and is rejected', async () => {
    await expect(
      controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          harnessVersion: 'v1',
        }),
        entitledBrowserIdentity,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalled();
    expectNoLedgerOrEnqueue();
  });

  it('successful browser entitlement does not bypass session ownership', async () => {
    mockSessionService.getSessionById.mockResolvedValue({
      userId: OTHER_USER_ID,
      projectId: null,
    });

    await expect(
      controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'conversation',
          harnessVersion: 'v1',
        }),
        entitledBrowserIdentity,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(mockSessionService.getSessionById).toHaveBeenCalledTimes(1);
    expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalled();
    expectNoLedgerOrEnqueue();
  });

  it('successful browser entitlement does not bypass persisted-agent ownership', async () => {
    mockUserAgentService.findOneByIdAndUserId.mockResolvedValue(null);

    await expect(
      controller.execute(
        makeRequest({
          agentId: OWNED_AGENT_ID,
          executionIntent: 'conversation',
          harnessVersion: 'v1',
          userId: 'attacker-user-id',
        }),
        entitledBrowserIdentity,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(mockUserAgentService.findOneByIdAndUserId).toHaveBeenCalledWith(
      OWNED_AGENT_ID,
      OWNER_USER_ID,
    );
    expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalledWith(
      OWNED_AGENT_ID,
      'attacker-user-id',
    );
    expectNoLedgerOrEnqueue();
  });

  it('no-harnessVersion execution remains unaffected for an unentitled browser session', async () => {
    const result = await controller.execute(
      makeRequest({
        agentId: OWNED_AGENT_ID,
        executionIntent: 'conversation',
      }),
      unentitledBrowserIdentity,
    );

    expect(result.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload).not.toHaveProperty('harnessVersion');
    expect(payload.agentId).toBe(OWNED_AGENT_ID);
    expect(unentitledBrowserIdentity).not.toHaveProperty('harnessEntitled');
  });
});

/**
 * AGENT-PLATFORM-EXEC-01C5B1 Cycle A — canonicalization pipeline and golden vector.
 * Expected digest/signature are hardcoded frozen constants, not derived from production.
 */
describe('AIExecutionController — AGENT-PLATFORM-EXEC-01C5B1 canonicalization and golden vector', () => {
  const GOLDEN_SECRET = 'test-hmac-secret-do-not-use-in-production-01c5b';
  const GOLDEN_ISSUED_AT = '2026-09-05T12:00:00.000Z';
  const GOLDEN_INSERTION_ORDER_JSON =
    '{"executionId":"exec-golden-01","userId":"user-golden-01","apiKeyId":"apikey-golden-01","sessionId":"session-golden-01","conversationId":"conv-golden-01","provider":"anthropic","adapter":"anthropic","prompt":"Hello, world.","submittedAt":"2026-09-05T12:00:00.000Z","harnessVersion":"v1"}';
  const GOLDEN_CANONICAL_JSON =
    '{"adapter":"anthropic","apiKeyId":"apikey-golden-01","conversationId":"conv-golden-01","executionId":"exec-golden-01","harnessVersion":"v1","prompt":"Hello, world.","provider":"anthropic","sessionId":"session-golden-01","submittedAt":"2026-09-05T12:00:00.000Z","userId":"user-golden-01"}';
  const GOLDEN_PAYLOAD_DIGEST =
    '8b58d2d281263357f70c8a489e3bbf4e32e0facfb5db0e83cd522b62e007188a';
  const GOLDEN_CLAIM_STRING =
    'v=1|executionId=exec-golden-01|userId=user-golden-01|apiKeyId=apikey-golden-01|harnessVersion=v1|issuedAt=2026-09-05T12:00:00.000Z|payloadDigest=8b58d2d281263357f70c8a489e3bbf4e32e0facfb5db0e83cd522b62e007188a';
  const GOLDEN_SIGNATURE =
    'd247e17634be269b0bbef1eb843a65bf299935ea840853900fe5dda3d8ef11b5';

  function makeGoldenPayload(): Record<string, unknown> {
    return {
      executionId: 'exec-golden-01',
      userId: 'user-golden-01',
      apiKeyId: 'apikey-golden-01',
      sessionId: 'session-golden-01',
      conversationId: 'conv-golden-01',
      provider: 'anthropic',
      adapter: 'anthropic',
      prompt: 'Hello, world.',
      submittedAt: GOLDEN_ISSUED_AT,
      harnessVersion: 'v1',
    };
  }

  it('recursively sorts object keys using Object.keys().sort()', () => {
    const sorted = sortKeysRecursive({
      z: { b: 1, a: 2 },
      m: 3,
    });
    expect(JSON.stringify(sorted)).toBe('{"m":3,"z":{"a":2,"b":1}}');
  });

  it('preserves array element order while sorting nested object keys', () => {
    const sorted = sortKeysRecursive({
      items: [
        { b: 1, a: 2 },
        { d: 4, c: 3 },
      ],
    });
    expect(JSON.stringify(sorted)).toBe('{"items":[{"a":2,"b":1},{"c":3,"d":4}]}');
  });

  it('applies BullMQ-equivalent JSON.stringify/JSON.parse normalization before sorting', () => {
    const payload = {
      b: 2,
      a: 1,
      skip: undefined,
    };
    const roundTripped = JSON.parse(JSON.stringify(payload));
    expect(Object.prototype.hasOwnProperty.call(roundTripped, 'skip')).toBe(false);
    const canonicalJson = JSON.stringify(sortKeysRecursive(roundTripped));
    expect(canonicalJson).toBe('{"a":1,"b":2}');
  });

  it('omits undefined object properties from canonical JSON', () => {
    const result = computePayloadDigest({
      a: 1,
      b: undefined,
      c: 2,
    } as Record<string, unknown>);
    expect(result.canonicalJson).toBe('{"a":1,"c":2}');
  });

  it('normalizes undefined array elements to null', () => {
    const result = computePayloadDigest({
      items: [1, undefined, 3],
    } as Record<string, unknown>);
    expect(result.canonicalJson).toBe('{"items":[1,null,3]}');
  });

  it('fails closed on cyclic input', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(() => computePayloadDigest(cyclic)).toThrow();
  });

  it('fails closed on BigInt input', () => {
    expect(() =>
      computePayloadDigest({ n: BigInt(1) } as unknown as Record<string, unknown>),
    ).toThrow();
  });

  it('matches frozen golden insertion-order JSON, canonical JSON, and SHA-256 digest byte-for-byte', () => {
    const payload = makeGoldenPayload();
    expect(JSON.stringify(payload)).toBe(GOLDEN_INSERTION_ORDER_JSON);
    const result = computePayloadDigest(payload);
    expect(result.canonicalJson).toBe(GOLDEN_CANONICAL_JSON);
    expect(Buffer.from(result.canonicalJson, 'utf8').equals(Buffer.from(GOLDEN_CANONICAL_JSON, 'utf8'))).toBe(
      true,
    );
    expect(result.payloadDigest).toBe(GOLDEN_PAYLOAD_DIGEST);
  });

  it('builds the exact frozen canonical claim string', () => {
    const claim = buildHarnessEntitlementClaimString({
      executionId: 'exec-golden-01',
      userId: 'user-golden-01',
      apiKeyId: 'apikey-golden-01',
      issuedAt: GOLDEN_ISSUED_AT,
      payloadDigest: GOLDEN_PAYLOAD_DIGEST,
    });
    expect(claim).toBe(GOLDEN_CLAIM_STRING);
    expect(claim.endsWith('|')).toBe(false);
  });

  it('produces the exact frozen HMAC-SHA256 signature', () => {
    const signature = signHarnessEntitlementClaim(GOLDEN_CLAIM_STRING, GOLDEN_SECRET);
    expect(signature).toBe(GOLDEN_SIGNATURE);
    expect(signature).toBe(signature.toLowerCase());
  });

  describe('own special keys remain digest-covered', () => {
    function parseOwnKeyObject(json: string): Record<string, unknown> {
      return JSON.parse(json) as Record<string, unknown>;
    }

    function hasOwn(obj: object, key: string): boolean {
      return Object.prototype.hasOwnProperty.call(obj, key);
    }

    function prototypeIsUnmutated(obj: object): boolean {
      const proto = Object.getPrototypeOf(obj);
      return proto === Object.prototype || proto === null;
    }

    it('preserves an own __proto__ object value in canonical JSON', () => {
      const input = parseOwnKeyObject('{"z":1,"__proto__":{"polluted":true},"a":2}');
      expect(hasOwn(input, '__proto__')).toBe(true);

      const sorted = sortKeysRecursive(input) as object;
      expect(hasOwn(sorted, '__proto__')).toBe(true);
      expect(JSON.stringify(sorted)).toBe('{"__proto__":{"polluted":true},"a":2,"z":1}');

      const result = computePayloadDigest(input);
      expect(result.canonicalJson).toBe('{"__proto__":{"polluted":true},"a":2,"z":1}');
      const parsedCanonical = JSON.parse(result.canonicalJson) as object;
      expect(hasOwn(parsedCanonical, '__proto__')).toBe(true);
    });

    it('preserves an own __proto__ string value in canonical JSON', () => {
      const input = parseOwnKeyObject('{"a":1,"__proto__":"evil-string"}');
      expect(hasOwn(input, '__proto__')).toBe(true);

      const sorted = sortKeysRecursive(input) as object;
      expect(hasOwn(sorted, '__proto__')).toBe(true);
      expect(JSON.stringify(sorted)).toBe('{"__proto__":"evil-string","a":1}');

      const result = computePayloadDigest(input);
      expect(result.canonicalJson).toBe('{"__proto__":"evil-string","a":1}');
      const parsedCanonical = JSON.parse(result.canonicalJson) as object;
      expect(hasOwn(parsedCanonical, '__proto__')).toBe(true);
    });

    it('changes payloadDigest when only the own __proto__ value changes', () => {
      const left = parseOwnKeyObject('{"a":1,"__proto__":{"x":"one"}}');
      const right = parseOwnKeyObject('{"a":1,"__proto__":{"x":"two"}}');
      const leftDigest = computePayloadDigest(left);
      const rightDigest = computePayloadDigest(right);
      expect(leftDigest.canonicalJson).not.toBe(rightDigest.canonicalJson);
      expect(leftDigest.payloadDigest).not.toBe(rightDigest.payloadDigest);
      expect(leftDigest.canonicalJson).toContain('"__proto__"');
      expect(rightDigest.canonicalJson).toContain('"__proto__"');
    });

    it('does not mutate the canonicalized object prototype via inherited __proto__ setter', () => {
      const input = parseOwnKeyObject('{"__proto__":{"polluted":true},"a":1}');
      const sorted = sortKeysRecursive(input) as object;
      expect(prototypeIsUnmutated(sorted)).toBe(true);
      expect(hasOwn(sorted, '__proto__')).toBe(true);
      const proto = Object.getPrototypeOf(sorted);
      if (proto !== null) {
        expect(hasOwn(proto, 'polluted')).toBe(false);
      }
    });

    it('preserves an own constructor property and covers it in payloadDigest', () => {
      const left = parseOwnKeyObject('{"k":1,"constructor":{"x":"one"}}');
      const right = parseOwnKeyObject('{"k":1,"constructor":{"x":"two"}}');
      const sorted = sortKeysRecursive(left) as object;
      expect(hasOwn(sorted, 'constructor')).toBe(true);
      expect(JSON.stringify(sorted)).toBe('{"constructor":{"x":"one"},"k":1}');

      const leftDigest = computePayloadDigest(left);
      const rightDigest = computePayloadDigest(right);
      expect(leftDigest.canonicalJson).toBe('{"constructor":{"x":"one"},"k":1}');
      expect(hasOwn(JSON.parse(leftDigest.canonicalJson) as object, 'constructor')).toBe(true);
      expect(leftDigest.payloadDigest).not.toBe(rightDigest.payloadDigest);
    });

    it('preserves an own prototype property and covers it in payloadDigest', () => {
      const left = parseOwnKeyObject('{"k":1,"prototype":{"x":"one"}}');
      const right = parseOwnKeyObject('{"k":1,"prototype":{"x":"two"}}');
      const sorted = sortKeysRecursive(left) as object;
      expect(hasOwn(sorted, 'prototype')).toBe(true);
      expect(JSON.stringify(sorted)).toBe('{"k":1,"prototype":{"x":"one"}}');

      const leftDigest = computePayloadDigest(left);
      const rightDigest = computePayloadDigest(right);
      expect(leftDigest.canonicalJson).toBe('{"k":1,"prototype":{"x":"one"}}');
      expect(hasOwn(JSON.parse(leftDigest.canonicalJson) as object, 'prototype')).toBe(true);
      expect(leftDigest.payloadDigest).not.toBe(rightDigest.payloadDigest);
    });

    it('preserves nested own __proto__ properties recursively', () => {
      const input = parseOwnKeyObject(
        '{"z":1,"inner":{"__proto__":{"nested":true},"b":2},"a":3}',
      );
      const sorted = sortKeysRecursive(input) as Record<string, unknown>;
      const inner = sorted.inner as object;
      expect(hasOwn(inner, '__proto__')).toBe(true);
      expect(prototypeIsUnmutated(inner)).toBe(true);
      expect(JSON.stringify(sorted)).toBe(
        '{"a":3,"inner":{"__proto__":{"nested":true},"b":2},"z":1}',
      );

      const result = computePayloadDigest(input);
      expect(result.canonicalJson).toBe(
        '{"a":3,"inner":{"__proto__":{"nested":true},"b":2},"z":1}',
      );
      const parsedInner = (JSON.parse(result.canonicalJson) as { inner: object }).inner;
      expect(hasOwn(parsedInner, '__proto__')).toBe(true);
    });

    it('keeps frozen golden canonical JSON, digest, claim, and HMAC unchanged', () => {
      const payload = makeGoldenPayload();
      expect(JSON.stringify(payload)).toBe(GOLDEN_INSERTION_ORDER_JSON);
      const result = computePayloadDigest(payload);
      expect(result.canonicalJson).toBe(GOLDEN_CANONICAL_JSON);
      expect(
        Buffer.from(result.canonicalJson, 'utf8').equals(Buffer.from(GOLDEN_CANONICAL_JSON, 'utf8')),
      ).toBe(true);
      expect(result.payloadDigest).toBe(GOLDEN_PAYLOAD_DIGEST);
      const claim = buildHarnessEntitlementClaimString({
        executionId: 'exec-golden-01',
        userId: 'user-golden-01',
        apiKeyId: 'apikey-golden-01',
        issuedAt: GOLDEN_ISSUED_AT,
        payloadDigest: GOLDEN_PAYLOAD_DIGEST,
      });
      expect(claim).toBe(GOLDEN_CLAIM_STRING);
      expect(signHarnessEntitlementClaim(claim, GOLDEN_SECRET)).toBe(GOLDEN_SIGNATURE);
    });
  });
});

describe('AIExecutionController — AGENT-PLATFORM-EXEC-01C5B1 proof production', () => {
  let controller: AIExecutionController;
  let mockUsageLedgerService: Record<string, jest.Mock>;
  let mockQueueService: Record<string, jest.Mock>;
  let mockSessionService: Record<string, jest.Mock>;
  let mockUserAiInstructionsService: Record<string, jest.Mock>;
  let mockProjectAiContextService: Record<string, jest.Mock>;
  let mockUserAgentService: Record<string, jest.Mock>;

  const VALID_SESSION_UUID = '35d53116-6723-4571-af12-ac256977c007';
  const VERIFIED_USER_ID = 'verified-user-01c5b1';
  const API_KEY_ID = 'apikey-01c5b1';

  const entitledApiKeyIdentity: ApiKeyIdentity = {
    userId: VERIFIED_USER_ID,
    apiKeyId: API_KEY_ID,
    scopes: ['ai:execute', 'ai:harness'],
    harnessEntitled: true,
  };

  const entitledBrowserIdentity: ApiKeyIdentity = {
    userId: VERIFIED_USER_ID,
    apiKeyId: 'browser-session',
    scopes: ['ai:execute'],
    isInternal: true,
    harnessEntitled: true,
  };

  const unentitledIdentity: ApiKeyIdentity = {
    userId: VERIFIED_USER_ID,
    apiKeyId: API_KEY_ID,
    scopes: ['ai:execute'],
  };

  function makeRequest(overrides?: Partial<AIExecutionRequest>): AIExecutionRequest {
    return {
      sessionId: VALID_SESSION_UUID,
      conversationId: 'conv-01c5b1',
      userId: 'untrusted-client-user',
      prompt: 'Hello from EXEC-01C5B1',
      provider: 'stub',
      ...overrides,
    };
  }

  function independentCompletePayloadDigest(enqueued: Record<string, unknown>): string {
    const withoutProof = { ...enqueued };
    delete withoutProof.harnessEntitlementProof;
    const jsonStr = JSON.stringify(withoutProof);
    const parsed = JSON.parse(jsonStr);
    const sortKeys = (value: unknown): unknown => {
      if (value === null || typeof value !== 'object') {
        return value;
      }
      if (Array.isArray(value)) {
        return value.map(sortKeys);
      }
      const obj = value as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(obj).sort()) {
        sorted[key] = sortKeys(obj[key]);
      }
      return sorted;
    };
    const canonicalJson = JSON.stringify(sortKeys(parsed));
    return createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
  }

  function expectSafeMissingSecretFailure(error: unknown): void {
    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect((error as InternalServerErrorException).getStatus()).toBe(500);
    expect((error as InternalServerErrorException).message).toBe(
      'Harness entitlement proof could not be produced',
    );
    const serialized = JSON.stringify({
      message: (error as Error).message,
      response: (error as InternalServerErrorException).getResponse(),
      stack: (error as Error).stack,
    });
    expect(serialized).not.toMatch(/HARNESS_ENTITLEMENT_HMAC_SECRET/i);
    expect(serialized).not.toContain(EXEC_01C5B1_TEST_HMAC_SECRET);
    expect(serialized).not.toMatch(/test-hmac-secret/i);
  }

  function expectNoHarnessExecutionSideEffects(): void {
    expect(mockUsageLedgerService.findByRequestId).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(mockUsageLedgerService.reuseExecutionIntent).not.toHaveBeenCalled();
    expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
    expect(mockSessionService.getSessionById).not.toHaveBeenCalled();
    expect(mockUserAiInstructionsService.getByUserId).not.toHaveBeenCalled();
    expect(mockProjectAiContextService.getByProjectId).not.toHaveBeenCalled();
    expect(mockUserAgentService.findOneByIdAndUserId).not.toHaveBeenCalled();
  }

  function expectNoIntentWrittenLog(logSpy: jest.SpyInstance): void {
    const logged = logSpy.mock.calls
      .flat()
      .map((entry) => String(entry))
      .join('\n');
    expect(logged).not.toMatch(/execution\.intent_written/);
    expect(logged).not.toContain(EXEC_01C5B1_TEST_HMAC_SECRET);
    expect(logged).not.toMatch(/HARNESS_ENTITLEMENT_HMAC_SECRET/i);
  }

  function expectProofShape(proof: Record<string, unknown>): void {
    expect(Object.keys(proof).sort()).toEqual(
      [
        'apiKeyId',
        'executionId',
        'harnessVersion',
        'issuedAt',
        'payloadDigest',
        'signature',
        'userId',
        'version',
      ].sort(),
    );
    expect(proof.version).toBe(1);
    expect(typeof proof.version).toBe('number');
    expect(proof.harnessVersion).toBe('v1');
    expect(proof.issuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(proof.payloadDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(proof.signature).toMatch(/^[0-9a-f]{64}$/);
  }

  beforeEach(async () => {
    mockUsageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      reuseExecutionIntent: jest.fn().mockResolvedValue('reused-exec-01c5b1'),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
      updateExecutionResult: jest.fn().mockResolvedValue(undefined),
    };

    mockQueueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };

    mockSessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: VERIFIED_USER_ID,
        projectId: null,
      }),
    };

    mockUserAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue(null),
    };

    mockProjectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue(null),
    };

    mockUserAgentService = {
      findOneByIdAndUserId: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: UserAiInstructionsService,
          useValue: mockUserAiInstructionsService,
        },
        {
          provide: ProjectAiContextService,
          useValue: mockProjectAiContextService,
        },
        { provide: SessionService, useValue: mockSessionService },
        { provide: UserAgentService, useValue: mockUserAgentService },
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

  it('enqueues a proof for an entitled API-key Harness request', async () => {
    const result = await controller.execute(
      makeRequest({ harnessVersion: 'v1' }),
      entitledApiKeyIdentity,
    );

    expect(result.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.harnessVersion).toBe('v1');
    expectProofShape(payload.harnessEntitlementProof);
    expect(payload.harnessEntitlementProof.apiKeyId).toBe(API_KEY_ID);
  });

  it('enqueues a proof for an entitled browser-session Harness request', async () => {
    const result = await controller.execute(
      makeRequest({ harnessVersion: 'v1' }),
      entitledBrowserIdentity,
    );

    expect(result.status).toBe('queued');
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expectProofShape(payload.harnessEntitlementProof);
    expect(payload.harnessEntitlementProof.apiKeyId).toBe('browser-session');
    expect(payload.harnessEntitlementProof.userId).toBe(VERIFIED_USER_ID);
  });

  it('binds proof executionId to the actual enqueued executionId', async () => {
    const result = await controller.execute(
      makeRequest({ harnessVersion: 'v1' }),
      entitledApiKeyIdentity,
    );
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.harnessEntitlementProof.executionId).toBe(payload.executionId);
    expect(payload.harnessEntitlementProof.executionId).toBe(result.executionId);
  });

  it('binds proof userId from authenticated identity, not request body', async () => {
    await controller.execute(
      makeRequest({ harnessVersion: 'v1', userId: 'attacker-forged-user' }),
      entitledApiKeyIdentity,
    );
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.userId).toBe(VERIFIED_USER_ID);
    expect(payload.harnessEntitlementProof.userId).toBe(VERIFIED_USER_ID);
    expect(payload.harnessEntitlementProof.userId).not.toBe('attacker-forged-user');
  });

  it('binds proof apiKeyId from authenticated identity', async () => {
    await controller.execute(
      makeRequest({
        harnessVersion: 'v1',
        metadata: { apiKeyId: 'forged-key-from-body' },
      }),
      entitledApiKeyIdentity,
    );
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.apiKeyId).toBe(API_KEY_ID);
    expect(payload.harnessEntitlementProof.apiKeyId).toBe(API_KEY_ID);
    expect(payload.harnessEntitlementProof.apiKeyId).not.toBe('forged-key-from-body');
  });

  it('sets version to numeric literal 1 and harnessVersion to literal v1', async () => {
    await controller.execute(
      makeRequest({ harnessVersion: 'v1' }),
      entitledApiKeyIdentity,
    );
    const proof = mockQueueService.enqueueExecution.mock.calls[0][0].harnessEntitlementProof;
    expect(proof.version).toBe(1);
    expect(proof.harnessVersion).toBe('v1');
  });

  it('sets issuedAt to the enqueue submittedAt timestamp', async () => {
    await controller.execute(
      makeRequest({ harnessVersion: 'v1' }),
      entitledApiKeyIdentity,
    );
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.harnessEntitlementProof.issuedAt).toBe(payload.submittedAt);
    expect(payload.harnessEntitlementProof.issuedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it('covers the complete payload excluding only the proof in payloadDigest', async () => {
    await controller.execute(
      makeRequest({
        harnessVersion: 'v1',
        agentRole: 'builder',
        builderProfileId: 'bp-01c5b1',
      }),
      entitledApiKeyIdentity,
    );
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0] as Record<string, unknown>;
    const proof = payload.harnessEntitlementProof as Record<string, unknown>;
    expect(payload.agentRole).toBe('builder');
    expect(payload.builderProfileId).toBe('bp-01c5b1');
    expect(independentCompletePayloadDigest(payload)).toBe(proof.payloadDigest);
  });

  it('ignores and replaces a client-supplied harnessEntitlementProof', async () => {
    const clientProof = {
      version: 1,
      executionId: 'forged-exec',
      userId: 'forged-user',
      apiKeyId: 'forged-key',
      harnessVersion: 'v1',
      issuedAt: '2000-01-01T00:00:00.000Z',
      payloadDigest: '0'.repeat(64),
      signature: 'a'.repeat(64),
    };
    const request = {
      ...makeRequest({ harnessVersion: 'v1' }),
      harnessEntitlementProof: clientProof,
    } as AIExecutionRequest;

    await controller.execute(request, entitledApiKeyIdentity);

    expect(
      (request as unknown as { harnessEntitlementProof: unknown }).harnessEntitlementProof,
    ).toEqual(clientProof);
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload.harnessEntitlementProof).not.toEqual(clientProof);
    expect(payload.harnessEntitlementProof.executionId).toBe(payload.executionId);
    expect(payload.harnessEntitlementProof.userId).toBe(VERIFIED_USER_ID);
    expect(payload.harnessEntitlementProof.signature).not.toBe(clientProof.signature);
  });

  it('omits proof from ordinary non-Harness jobs', async () => {
    const result = await controller.execute(makeRequest(), entitledApiKeyIdentity);
    expect(result.status).toBe('queued');
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload).not.toHaveProperty('harnessVersion');
    expect(payload).not.toHaveProperty('harnessEntitlementProof');
  });

  it('allows ordinary non-Harness jobs without the signing secret', async () => {
    delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
    const result = await controller.execute(makeRequest(), entitledApiKeyIdentity);
    expect(result.status).toBe('queued');
    expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    expect(mockUsageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
    const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(payload).not.toHaveProperty('harnessVersion');
    expect(payload).not.toHaveProperty('harnessEntitlementProof');
  });

  it('keeps unentitled Harness requests at 403 with no enqueue', async () => {
    const error = await controller
      .execute(makeRequest({ harnessVersion: 'v1' }), unentitledIdentity)
      .catch((err) => err);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.message).toBe('Forbidden');
    expect(String(error.message)).not.toMatch(
      /HARNESS_ENTITLEMENT_HMAC_SECRET|secret|hmac|test-hmac-secret/i,
    );
    expectNoHarnessExecutionSideEffects();
  });

  it('keeps unentitled Harness requests at 403 when the signing secret is missing', async () => {
    delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
    const error = await controller
      .execute(makeRequest({ harnessVersion: 'v1' }), unentitledIdentity)
      .catch((err) => err);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.getStatus()).toBe(403);
    expect(error.message).toBe('Forbidden');
    expect(String(error.message)).not.toMatch(
      /HARNESS_ENTITLEMENT_HMAC_SECRET|secret|hmac|test-hmac-secret/i,
    );
    expectNoHarnessExecutionSideEffects();
  });

  it('rejects invalid harnessVersion with 400 before inspecting the signing secret', async () => {
    delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
    const error = await controller
      .execute(
        makeRequest({
          harnessVersion: 'v2' as AIExecutionRequest['harnessVersion'],
        }),
        entitledApiKeyIdentity,
      )
      .catch((err) => err);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe("harnessVersion must be 'v1' when provided");
    expect(String(error.message)).not.toMatch(
      /HARNESS_ENTITLEMENT_HMAC_SECRET|secret|hmac|test-hmac-secret/i,
    );
    expectNoHarnessExecutionSideEffects();
  });

  it('fails closed with 500 and no execution side effects when the signing secret is missing', async () => {
    delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    try {
      const error = await controller
        .execute(makeRequest({ harnessVersion: 'v1' }), entitledApiKeyIdentity)
        .catch((err) => err);
      expectSafeMissingSecretFailure(error);
      expectNoHarnessExecutionSideEffects();
      expectNoIntentWrittenLog(logSpy);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('fails closed with 500 and no execution side effects when the signing secret is empty', async () => {
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = '';
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    try {
      const error = await controller
        .execute(makeRequest({ harnessVersion: 'v1' }), entitledApiKeyIdentity)
        .catch((err) => err);
      expectSafeMissingSecretFailure(error);
      expectNoHarnessExecutionSideEffects();
      expectNoIntentWrittenLog(logSpy);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('fails closed with 500 and no execution side effects when the signing secret is whitespace-only', async () => {
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = '   \t  ';
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    try {
      const error = await controller
        .execute(makeRequest({ harnessVersion: 'v1' }), entitledApiKeyIdentity)
        .catch((err) => err);
      expectSafeMissingSecretFailure(error);
      expectNoHarnessExecutionSideEffects();
      expectNoIntentWrittenLog(logSpy);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('does not look up or reuse an existing execution when the signing secret is missing on an idempotent request', async () => {
    delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
    mockUsageLedgerService.findByRequestId.mockResolvedValue({
      executionStatus: 'timeout',
    });
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    try {
      const error = await controller
        .execute(
          makeRequest({ harnessVersion: 'v1' }),
          entitledApiKeyIdentity,
          'retry-missing-secret-01c5b1',
        )
        .catch((err) => err);
      expectSafeMissingSecretFailure(error);
      expectNoHarnessExecutionSideEffects();
      expect(mockUsageLedgerService.findByRequestId).not.toHaveBeenCalled();
      expect(mockUsageLedgerService.reuseExecutionIntent).not.toHaveBeenCalled();
      expectNoIntentWrittenLog(logSpy);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('signs the reused canonical executionId on timeout/failed idempotent reuse', async () => {
    mockUsageLedgerService.findByRequestId.mockResolvedValue({
      executionStatus: 'timeout',
    });

    const timeoutResult = await controller.execute(
      makeRequest({ harnessVersion: 'v1' }),
      entitledApiKeyIdentity,
      'retry-timeout-01c5b1',
    );
    expect(timeoutResult.executionId).toBe('reused-exec-01c5b1');
    expect(mockUsageLedgerService.reuseExecutionIntent).toHaveBeenCalledTimes(1);
    const timeoutPayload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(timeoutPayload.executionId).toBe('reused-exec-01c5b1');
    expect(timeoutPayload.harnessEntitlementProof.executionId).toBe('reused-exec-01c5b1');

    mockQueueService.enqueueExecution.mockClear();
    mockUsageLedgerService.reuseExecutionIntent.mockClear();
    mockUsageLedgerService.writeExecutionIntent.mockClear();
    mockUsageLedgerService.findByRequestId.mockResolvedValue({
      executionStatus: 'failed',
    });
    mockUsageLedgerService.reuseExecutionIntent.mockResolvedValue('reused-failed-01c5b1');

    const failedResult = await controller.execute(
      makeRequest({ harnessVersion: 'v1' }),
      entitledApiKeyIdentity,
      'retry-failed-01c5b1',
    );
    expect(failedResult.executionId).toBe('reused-failed-01c5b1');
    const failedPayload = mockQueueService.enqueueExecution.mock.calls[0][0];
    expect(failedPayload.harnessEntitlementProof.executionId).toBe('reused-failed-01c5b1');
    expect(mockUsageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
  });

  it('does not log the secret, signature, or full proof during proof generation', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    try {
      await controller.execute(
        makeRequest({ harnessVersion: 'v1' }),
        entitledApiKeyIdentity,
      );
      const payload = mockQueueService.enqueueExecution.mock.calls[0][0];
      const proof = payload.harnessEntitlementProof;
      const logged = [
        ...logSpy.mock.calls,
        ...debugSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ]
        .flat()
        .map((entry) => String(entry))
        .join('\n');

      expect(logged).not.toContain(EXEC_01C5B1_TEST_HMAC_SECRET);
      expect(logged).not.toContain(proof.signature);
      expect(logged).not.toContain(JSON.stringify(proof));
      expect(logged).not.toMatch(/HARNESS_ENTITLEMENT_HMAC_SECRET=/);
    } finally {
      logSpy.mockRestore();
      debugSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
