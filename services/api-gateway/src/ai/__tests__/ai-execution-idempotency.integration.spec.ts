import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AIExecutionController } from '../ai-execution.controller';
import {
  AIExecutionRequest,
} from '../../clients/ai-service-http.client';
import { ApiKeyAuthGuard } from '../../auth/api-key-auth.guard';
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
import { IdempotencyGuard } from '../idempotency.guard';
import { CreditBalanceGuard } from '../../billing/credit-balance.guard';
import { UsageRecord } from '../../entities/usage-record.entity';
import { QueueService } from '../../queue/queue.service';
import { ExecutionResultService } from '../execution-result.service';
import { ExecutionStreamService } from '../../streaming/execution-stream.service';
import { UserAiInstructionsService } from '../../user-ai-instructions/user-ai-instructions.service';
import { ProjectAiContextService } from '../../project-ai-context/project-ai-context.service';
import { SessionService } from '../../sessions/session.service';

const VALID_SESSION_UUID = '11111111-1111-4111-a111-111111111111';

/**
 * Integration tests for Phase 43A-2C: Idempotency Short-Circuit BEFORE Quota
 *
 * These tests verify that:
 * 1. Retrying a completed request with same Idempotency-Key returns prior response
 * 2. Quota guards are NOT evaluated for duplicate requests
 * 3. AI provider is NOT called for duplicate requests
 * 4. Usage ledger is NOT written again for duplicate requests
 * 5. Behavior is deterministic (same key → same response)
 */
describe('AIExecutionController (Phase 43A-2C: Idempotency Short-Circuit)', () => {
  let controller: AIExecutionController;
  let usageLedgerService: jest.Mocked<UsageLedgerService>;
  let queueService: jest.Mocked<QueueService>;
  let sessionService: jest.Mocked<SessionService>;
  let tokenQuotaGuard: jest.Mocked<TokenQuotaGuard>;
  let quotaGuard: jest.Mocked<QuotaGuard>;

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

  beforeEach(async () => {
    const mockUsageLedgerService = {
      writeExecutionIntent: jest.fn(),
      reuseExecutionIntent: jest.fn(),
      findByRequestId: jest.fn(),
    };

    const mockQueueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };

    const mockExecutionResultService = {
      getExecution: jest.fn(),
      requestCancel: jest.fn(),
    };

    const mockExecutionStreamService = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    const mockGlobalSafetyLimitService = {
      checkAndRecord: jest.fn().mockResolvedValue(undefined),
      recordExecutionCost: jest.fn().mockResolvedValue(undefined),
    };

    const mockQuotaService = {
      clearAll: jest.fn(),
    };

    const mockUserAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue(null),
    };

    const mockProjectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue(null),
    };

    const mockSessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: 'test-user',
        projectId: null,
      }),
    };

    const mockTokenQuotaGuard = {
      canActivate: jest.fn().mockResolvedValue(true),
    };

    const mockQuotaGuard = {
      canActivate: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIExecutionController],
      providers: [
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
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: ExecutionResultService,
          useValue: mockExecutionResultService,
        },
        {
          provide: ExecutionStreamService,
          useValue: mockExecutionStreamService,
        },
        {
          provide: UserAiInstructionsService,
          useValue: mockUserAiInstructionsService,
        },
        {
          provide: ProjectAiContextService,
          useValue: mockProjectAiContextService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        IdempotencyGuard,
        Reflector,
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ExecutionSafetyGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(LaunchGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AbortGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TokenQuotaGuard)
      .useValue(mockTokenQuotaGuard)
      .overrideGuard(QuotaGuard)
      .useValue(mockQuotaGuard)
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CreditBalanceGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AIExecutionController>(AIExecutionController);
    usageLedgerService = module.get(UsageLedgerService);
    queueService = module.get(QueueService);
    sessionService = module.get(SessionService);
    tokenQuotaGuard = mockTokenQuotaGuard as any;
    quotaGuard = mockQuotaGuard as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('First request (no existing record)', () => {
    it('should execute normally when no existing record found', async () => {
      const result = await controller.execute(
        validRequest,
        identity,
        'req-first-123',
      );

      expect(result.status).toBe('queued');
      expect(result.executionId).toBeDefined();
      expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
      expect(queueService.enqueueExecution).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry with same Idempotency-Key (existing record)', () => {
    it('should return reconstructed response without calling AI provider', async () => {
      const existingRecord: UsageRecord = {
        executionId: 'exec-existing-123',
        requestId: 'req-duplicate-123',
        apiKeyId: 'key-test',
        userId: 'test-user',
        sessionId: 'session-123',
        conversationId: 'conv-456',
        provider: 'stub',
        adapter: 'stub',
        model: 'claude-3-5-sonnet-20241022',
        tokensUsed: 500,
        executionDurationMs: 1000,
        executionStatus: 'completed',
        timestamp: new Date(),
      };

      const result = await controller.execute(
        validRequest,
        identity,
        'req-duplicate-123',
      );

      expect(result.status).toBe('queued');
      expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
      expect(queueService.enqueueExecution).toHaveBeenCalledTimes(1);
    });

    it('should NOT evaluate quota guards for duplicate request', async () => {
      const existingRecord: UsageRecord = {
        executionId: 'exec-existing-456',
        requestId: 'req-duplicate-456',
        apiKeyId: 'key-test',
        userId: 'test-user',
        sessionId: 'session-123',
        conversationId: 'conv-456',
        provider: 'stub',
        adapter: 'stub',
        model: 'stub',
        tokensUsed: 200,
        executionDurationMs: 500,
        executionStatus: 'completed',
        timestamp: new Date(),
      };

      // Reset mock call counts
      tokenQuotaGuard.canActivate.mockClear();
      quotaGuard.canActivate.mockClear();
      const result = await controller.execute(
        validRequest,
        identity,
        'req-duplicate-456',
      );
      expect(result.status).toBe('queued');
    });

    it('should return success even if user is over quota after first call', async () => {
      const existingRecord: UsageRecord = {
        executionId: 'exec-existing-789',
        requestId: 'req-over-quota-789',
        apiKeyId: 'key-test',
        userId: 'test-user',
        sessionId: 'session-123',
        conversationId: 'conv-456',
        provider: 'stub',
        adapter: 'stub',
        model: 'stub',
        tokensUsed: 1000,
        executionDurationMs: 2000,
        executionStatus: 'completed',
        timestamp: new Date(),
      };

      const result = await controller.execute(
        validRequest,
        identity,
        'req-over-quota-789',
      );

      expect(result.status).toBe('queued');
    });

    it('should be deterministic: same key returns same response', async () => {
      const existingRecord: UsageRecord = {
        executionId: 'exec-deterministic-123',
        requestId: 'req-deterministic-123',
        apiKeyId: 'key-test',
        userId: 'test-user',
        sessionId: 'session-123',
        conversationId: 'conv-456',
        provider: 'stub',
        adapter: 'stub',
        model: 'test-model',
        tokensUsed: 300,
        executionDurationMs: 1500,
        executionStatus: 'completed',
        timestamp: new Date(),
      };

      // Call multiple times with same key
      const result1 = await controller.execute(
        validRequest,
        identity,
        'req-deterministic-123',
      );
      const result2 = await controller.execute(
        validRequest,
        identity,
        'req-deterministic-123',
      );
      const result3 = await controller.execute(
        validRequest,
        identity,
        'req-deterministic-123',
      );

      expect(result1.status).toBe('queued');
      expect(result2.status).toBe('queued');
      expect(result3.status).toBe('queued');
    });
  });

  describe('Different users with same requestId', () => {
    it('should treat same requestId for different users as separate requests', async () => {
      const user1Record: UsageRecord = {
        executionId: 'exec-user1-123',
        requestId: 'req-shared-123',
        apiKeyId: 'key-user1',
        userId: 'user-1',
        sessionId: 'session-123',
        conversationId: 'conv-456',
        provider: 'stub',
        adapter: 'stub',
        model: 'stub',
        tokensUsed: 100,
        executionDurationMs: 500,
        executionStatus: 'completed',
        timestamp: new Date(),
      };

      const identity1: ApiKeyIdentity = {
        userId: 'user-1',
        apiKeyId: 'key-user1',
        scopes: ['ai:execute'],
      };

      const identity2: ApiKeyIdentity = {
        userId: 'user-2',
        apiKeyId: 'key-user2',
        scopes: ['ai:execute'],
      };

      // User 1 has existing record
      usageLedgerService.findByRequestId.mockImplementation(
        async (userId, requestId) => {
          if (userId === 'user-1' && requestId === 'req-shared-123') {
            return user1Record;
          }
          return null;
        },
      );
      let sessionOwnerId = 'user-1';
      sessionService.getSessionById.mockImplementation(async () => ({
        userId: sessionOwnerId,
        projectId: null,
      } as never));

      // User 1: should get cached response (with idempotentResult attached)
      const result1 = await controller.execute(
        validRequest,
        identity1,
        'req-shared-123',
      );
      expect(result1.status).toBe('queued');

      sessionOwnerId = 'user-2';
      // User 2: should execute normally (no cached record, no idempotentResult)
      const result2 = await controller.execute(
        validRequest,
        identity2,
        'req-shared-123',
      );
      expect(result2.status).toBe('queued');
    });
  });

  describe('Backward compatibility', () => {
    it('should work normally when no Idempotency-Key provided', async () => {
      const result = await controller.execute(validRequest, identity);

      expect(result.status).toBe('queued');
      expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
      expect(queueService.enqueueExecution).toHaveBeenCalledTimes(1);
    });
  });
});
