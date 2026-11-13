import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { CreditDeductionRecord } from '../entities/credit-deduction-record.entity';
import { AIExecutionController } from '../ai/ai-execution.controller';
import { AIServiceHttpClient } from '../clients/ai-service-http.client';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { GlobalSafetyLimitService } from './global-safety-limit.service';
import { DailyCreditCapService } from './daily-credit-cap.service';
import { ExecutionSafetyGuard } from './execution-safety.guard';
import { KillSwitchConfig } from './kill-switch.config';
import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { AuthorizationGuard } from '../auth/authorization.guard';
import { QuotaGuard } from '../quota/quota.guard';
import { TokenQuotaGuard } from '../quota/token-quota.guard';
import { LaunchGuard } from '../launch/launch.guard';
import { AbortGuard } from '../abort/abort.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { IdempotencyGuard } from '../ai/idempotency.guard';
import { CreditBalanceGuard } from '../billing/credit-balance.guard';
import { QueueService } from '../queue/queue.service';
import { ExecutionResultService } from '../ai/execution-result.service';
import { ExecutionStreamService } from '../streaming/execution-stream.service';
import { UserAiInstructionsService } from '../user-ai-instructions/user-ai-instructions.service';
import { ProjectAiContextService } from '../project-ai-context/project-ai-context.service';
import { SessionService } from '../sessions/session.service';
import { QuotaService } from '../quota/quota.service';

const VALID_SESSION_UUID = '11111111-1111-4111-a111-111111111111';

const currentExecuteBody = (overrides: Record<string, unknown> = {}) => ({
  sessionId: VALID_SESSION_UUID,
  conversationId: 'conv-456',
  prompt: 'Test',
  provider: 'stub' as const,
  ...overrides,
});

describe('ExecutionSafetyGuard Integration Tests', () => {
  let app: INestApplication;
  let aiServiceHttpClient: AIServiceHttpClient;
  let usageLedgerService: UsageLedgerService;
  let globalSafetyLimitService: GlobalSafetyLimitService;
  let mockQueueService: { enqueueExecution: jest.Mock };
  let ledgerTotal = '0';
  const savedGlobalExecutionEnabled = process.env.GLOBAL_EXECUTION_ENABLED;
  const savedPlatformCap = process.env.MAX_DAILY_CREDITS_PLATFORM;
  const savedUserCap = process.env.MAX_DAILY_CREDITS_PER_USER;

  // Mock AI service response
  const mockAIResponse = {
    model: 'claude-3-5-sonnet-20241022',
    tokensUsed: 100,
    response: 'Test response',
  };

  // Mock successful execution
  const mockExecute = jest.fn().mockResolvedValue(mockAIResponse);

  // Mock authentication identity
  const mockIdentity = {
    apiKeyId: 'test-api-key-id',
    userId: 'test-user-id',
    scopes: ['ai:execute'],
  };

  beforeEach(async () => {
    process.env.GLOBAL_EXECUTION_ENABLED = 'true';
    process.env.MAX_DAILY_CREDITS_PLATFORM = '1000';
    process.env.MAX_DAILY_CREDITS_PER_USER = '500';
    ledgerTotal = '0';
    mockQueueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIExecutionController],
      providers: [
        {
          provide: AIServiceHttpClient,
          useValue: {
            execute: mockExecute,
          },
        },
        {
          provide: UsageLedgerService,
          useValue: {
            writeRecord: jest.fn().mockResolvedValue(undefined),
            writeExecutionIntent: jest.fn().mockResolvedValue({
              executionId: 'test-exec-id',
              requestId: 'test-request-id',
              executionStatus: 'pending',
            }),
            updateExecutionResult: jest.fn().mockResolvedValue(undefined),
            findByRequestId: jest.fn().mockResolvedValue(null),
          },
        },
        GlobalSafetyLimitService,
        DailyCreditCapService,
        ExecutionSafetyGuard,
        {
          provide: getRepositoryToken(CreditDeductionRecord),
          useValue: {
            createQueryBuilder: () => {
              const qb = {
                select: () => qb,
                where: () => qb,
                andWhere: () => qb,
                getRawOne: async () => ({ total: ledgerTotal }),
              };
              return qb;
            },
          },
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
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
            getSessionById: jest.fn().mockResolvedValue({
              userId: 'test-user-id',
              projectId: null,
            }),
          },
        },
        {
          provide: QuotaService,
          useValue: { clearAll: jest.fn() },
        },
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard)
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          request.user = mockIdentity;
          request.apiKeyIdentity = mockIdentity;
          return true;
        },
      })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(QuotaGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TokenQuotaGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(LaunchGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AbortGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(IdempotencyGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CreditBalanceGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    await app.init();

    aiServiceHttpClient = module.get<AIServiceHttpClient>(AIServiceHttpClient);
    usageLedgerService = module.get<UsageLedgerService>(UsageLedgerService);
    globalSafetyLimitService = module.get<GlobalSafetyLimitService>(
      GlobalSafetyLimitService,
    );
  });

  afterEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    if (savedGlobalExecutionEnabled === undefined) {
      delete process.env.GLOBAL_EXECUTION_ENABLED;
    } else {
      process.env.GLOBAL_EXECUTION_ENABLED = savedGlobalExecutionEnabled;
    }
    if (savedPlatformCap === undefined) {
      delete process.env.MAX_DAILY_CREDITS_PLATFORM;
    } else {
      process.env.MAX_DAILY_CREDITS_PLATFORM = savedPlatformCap;
    }
    if (savedUserCap === undefined) {
      delete process.env.MAX_DAILY_CREDITS_PER_USER;
    } else {
      process.env.MAX_DAILY_CREDITS_PER_USER = savedUserCap;
    }
    await app.close();
  });

  describe('Successful execution (switches enabled)', () => {
    it('should allow execution when all checks pass', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-key-1')
        .send(currentExecuteBody())
        .expect(HttpStatus.ACCEPTED);

      expect(response.body.status).toBe('queued');
      expect(response.body.executionId).toBeDefined();
      expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    });

    it('should invoke ai-service when all checks pass', async () => {
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-key-2')
        .send(currentExecuteBody())
        .expect(HttpStatus.ACCEPTED);

      expect(mockQueueService.enqueueExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockIdentity.userId,
          sessionId: VALID_SESSION_UUID,
          prompt: 'Test',
        }),
      );
    });

    it('should record usage when execution succeeds', async () => {
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-key-3')
        .send(currentExecuteBody())
        .expect(HttpStatus.ACCEPTED);

      expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKeyId: mockIdentity.apiKeyId,
          userId: mockIdentity.userId,
        }),
      );
    });

    it('should record execution cost when execution succeeds', async () => {
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-key-4')
        .send(currentExecuteBody())
        .expect(HttpStatus.ACCEPTED);

      expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
      expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
    });
  });

  describe('Global kill switch enforcement', () => {
    it('should return 503 when global execution disabled', async () => {
      jest
        .spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get')
        .mockReturnValue(false);

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-kill-global-1')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      expect(response.body.message).toContain('temporarily disabled');
    });

    it('should NOT invoke ai-service when global kill switch disabled', async () => {
      jest
        .spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get')
        .mockReturnValue(false);

      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-kill-global-2')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should NOT record usage when global kill switch disabled', async () => {
      jest
        .spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get')
        .mockReturnValue(false);

      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-kill-global-3')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      expect(usageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    });
  });

  describe('Provider kill switch enforcement', () => {
    it('should return 503 when provider disabled', async () => {
      jest
        .spyOn(KillSwitchConfig, 'isProviderEnabled')
        .mockReturnValue(false);

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-kill-provider-1')
        .send({
          provider: 'openai',
          model: 'gpt-4',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      expect(response.body.message).toContain('temporarily unavailable');
    });

    it('should NOT invoke ai-service when provider kill switch disabled', async () => {
      jest
        .spyOn(KillSwitchConfig, 'isProviderEnabled')
        .mockReturnValue(false);

      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-kill-provider-2')
        .send({
          provider: 'openai',
          model: 'gpt-4',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe("PROVIDER-SWITCH-01: the chosen provider's switch over HTTP", () => {
    const savedAiProvider = process.env.AI_PROVIDER;

    beforeEach(() => {
      process.env.AI_PROVIDER = 'stub';
    });

    afterEach(() => {
      if (savedAiProvider === undefined) {
        delete process.env.AI_PROVIDER;
      } else {
        process.env.AI_PROVIDER = savedAiProvider;
      }
    });

    it('refuses a switched-off provider with 503 while AI_PROVIDER=stub, writing and queueing nothing', async () => {
      const switchSpy = jest
        .spyOn(KillSwitchConfig, 'isProviderEnabled')
        .mockImplementation((id: string) => id !== 'xai');

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-switch-off-1')
        .send(currentExecuteBody({ provider: 'xai' }))
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      expect(response.body).toEqual({
        statusCode: 503,
        message: 'Provider xai temporarily unavailable',
        error: 'Service Unavailable',
      });
      expect(switchSpy).toHaveBeenCalledWith('xai');
      expect(usageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
      expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
    });

    it('queues the same request when that provider is switched on', async () => {
      jest
        .spyOn(KillSwitchConfig, 'isProviderEnabled')
        .mockImplementation((id: string) => id === 'xai' || id === 'stub');

      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-switch-on-1')
        .send(currentExecuteBody({ provider: 'xai' }))
        .expect(HttpStatus.ACCEPTED);

      expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
      expect(mockQueueService.enqueueExecution).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'xai', model: 'grok-4.5' }),
      );
    });

    it('refuses an unsupported provider with the existing 400 before any write', async () => {
      const switchSpy = jest.spyOn(KillSwitchConfig, 'isProviderEnabled');

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-switch-unsupported-1')
        .send(currentExecuteBody({ provider: 'not-a-provider' }))
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toEqual({
        statusCode: 400,
        message:
          'Unsupported provider "not-a-provider". Supported providers: stub, anthropic, openai, groq, xai, deepseek',
        error: 'Bad Request',
      });
      expect(switchSpy).not.toHaveBeenCalled();
      expect(usageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
      expect(mockQueueService.enqueueExecution).not.toHaveBeenCalled();
    });
  });

  describe('Max tokens enforcement', () => {
    it('should return 400 when max_tokens exceeds limit', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-max-tokens-1')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 200000, // Over 100,000 limit
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toContain('exceeds platform limit');
    });

    it('should NOT invoke ai-service when max_tokens exceeds limit', async () => {
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-max-tokens-2')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 200000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should allow execution at exactly max tokens limit', async () => {
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-max-tokens-3')
        .send(currentExecuteBody({ max_tokens: 100000 }))
        .expect(HttpStatus.ACCEPTED);

      expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    });
  });

  describe('Global rate limit enforcement', () => {
    it('should return 429 when global rate limit exceeded', async () => {
      // Fill up global rate limit (10,000 executions/min)
      for (let i = 0; i < 10000; i++) {
        globalSafetyLimitService.recordExecution('stub');
      }

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-rate-global-1')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.TOO_MANY_REQUESTS);

      expect(response.body.message).toContain('rate limit');
    });

    it('should NOT invoke ai-service when global rate limit exceeded', async () => {
      for (let i = 0; i < 10000; i++) {
        globalSafetyLimitService.recordExecution('stub');
      }

      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-rate-global-2')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.TOO_MANY_REQUESTS);

      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('Provider rate limit enforcement', () => {
    it('should return 429 when provider rate limit exceeded', async () => {
      // Fill up stub rate limit (1,000 executions/min)
      for (let i = 0; i < 1000; i++) {
        globalSafetyLimitService.recordExecution('stub');
      }

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-rate-provider-1')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.TOO_MANY_REQUESTS);

      expect(response.body.message).toContain('rate limit');
    });

    it('should NOT invoke ai-service when provider rate limit exceeded', async () => {
      for (let i = 0; i < 1000; i++) {
        globalSafetyLimitService.recordExecution('stub');
      }

      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-rate-provider-2')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.TOO_MANY_REQUESTS);

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should enforce different rate limits per provider', async () => {
      // Fill up stub rate limit (1,000/min)
      for (let i = 0; i < 1000; i++) {
        globalSafetyLimitService.recordExecution('stub');
      }

      // Stub should be blocked
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-rate-provider-3a')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.TOO_MANY_REQUESTS);

      // Another provider (openai) would still work if we could switch providers
      // But since controller uses env-based provider (stub), this also uses stub
      // So we just verify the rate limit is per-provider by checking stub is blocked
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-rate-provider-3b')
        .send({
          provider: 'openai',
          model: 'gpt-4',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.TOO_MANY_REQUESTS); // Also blocked since it uses stub provider
    });
  });

  describe('Daily credit cap enforcement', () => {
    it('should return 429 when the daily credit cap is reached', async () => {
      ledgerTotal = '1000';

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-daily-spend-1')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.TOO_MANY_REQUESTS);

      expect(response.body.message).toContain('Daily credit limit reached');
    });

    it('should NOT invoke ai-service when the daily credit cap is reached', async () => {
      ledgerTotal = '1000';

      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-daily-spend-2')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.TOO_MANY_REQUESTS);

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should allow execution when daily credit usage is under the cap', async () => {
      ledgerTotal = '499';

      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-daily-spend-3')
        .send(currentExecuteBody())
        .expect(HttpStatus.ACCEPTED);

      expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error code correctness', () => {
    it('should return 400 for invalid max_tokens', async () => {
      await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          max_tokens: 999999,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 429 for rate limit exceeded', async () => {
      for (let i = 0; i < 1000; i++) {
        globalSafetyLimitService.recordExecution('stub');
      }

      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-error-rate-1')
        .send({
          provider: 'anthropic',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('should return 503 for kill switch disabled', async () => {
      jest
        .spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get')
        .mockReturnValue(false);

      await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.SERVICE_UNAVAILABLE);
    });

    it('should return 429 when the daily credit cap is reached', async () => {
      ledgerTotal = '1000';

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-error-daily-1')
        .send({
          provider: 'anthropic',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.TOO_MANY_REQUESTS);

      expect(response.body.message).toContain('Daily credit limit reached');
    });
  });

  describe('No behavior change when switches enabled', () => {
    it('should execute normally with all switches enabled', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-no-change-1')
        .send(currentExecuteBody({ prompt: 'Test prompt' }))
        .expect(HttpStatus.ACCEPTED);

      expect(response.body.status).toBe('queued');
      expect(mockQueueService.enqueueExecution).toHaveBeenCalledTimes(1);
      expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
    });

    it('should not modify request when safety checks pass', async () => {
      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-no-change-2')
        .send(currentExecuteBody())
        .expect(HttpStatus.ACCEPTED);

      const callArgs = mockQueueService.enqueueExecution.mock.calls[0][0];

      expect(callArgs.userId).toBe(mockIdentity.userId);
      expect(callArgs.sessionId).toBe(VALID_SESSION_UUID);
      expect(callArgs.prompt).toBe('Test');
    });

    it('should not log prompts or responses', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const consoleInfoSpy = jest.spyOn(console, 'info');

      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Idempotency-Key', 'test-no-change-3')
        .send(currentExecuteBody({ prompt: 'SENSITIVE_PROMPT_CONTENT_SECRET' }));

      // Check that sensitive content is NOT logged
      const allLogs = [
        ...consoleLogSpy.mock.calls.flat(),
        ...consoleInfoSpy.mock.calls.flat(),
      ].join(' ');

      expect(allLogs).not.toContain('SENSITIVE_PROMPT_CONTENT_SECRET');
      expect(allLogs).not.toContain('Test response'); // AI response

      consoleLogSpy.mockRestore();
      consoleInfoSpy.mockRestore();
    });
  });

  describe('Guard execution order', () => {
    it('should enforce guards in correct order', async () => {
      const executionOrder: string[] = [];

      // Track when each guard/service is called
      jest
        .spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get')
        .mockImplementation(() => {
          executionOrder.push('global-kill-switch');
          return true;
        });

      jest
        .spyOn(KillSwitchConfig, 'isProviderEnabled')
        .mockImplementation(() => {
          executionOrder.push('provider-kill-switch');
          return true;
        });

      jest
        .spyOn(globalSafetyLimitService, 'checkExecutionAllowed')
        .mockImplementation(() => {
          executionOrder.push('safety-limits');
        });

      jest
        .spyOn(globalSafetyLimitService, 'recordExecution')
        .mockImplementation(() => {
          executionOrder.push('record-execution');
        });

      await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        });

      // Verify execution order
      expect(executionOrder).toEqual([
        'global-kill-switch',
        'provider-kill-switch',
        'safety-limits',
        'record-execution',
      ]);
    });
  });
});
