import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AIExecutionController } from '../../ai/ai-execution.controller';
import { AIServiceHttpClient } from '../../clients/ai-service-http.client';
import { UsageLedgerService } from '../../usage-ledger/usage-ledger.service';
import { GlobalSafetyLimitService } from './global-safety-limit.service';
import { ExecutionSafetyGuard } from './execution-safety.guard';
import { KillSwitchConfig } from './kill-switch.config';
import { ApiKeyAuthGuard } from '../../auth/api-key-auth.guard';
import { AuthorizationGuard } from '../../auth/authorization.guard';
import { QuotaGuard } from '../../quota/quota.guard';

describe('ExecutionSafetyGuard Integration Tests', () => {
  let app: INestApplication;
  let aiServiceHttpClient: AIServiceHttpClient;
  let usageLedgerService: UsageLedgerService;
  let globalSafetyLimitService: GlobalSafetyLimitService;

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
          },
        },
        GlobalSafetyLimitService,
        ExecutionSafetyGuard,
      ],
    })
      .overrideGuard(ApiKeyAuthGuard)
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          request.user = mockIdentity;
          return true;
        },
      })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(QuotaGuard)
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
    await app.close();
  });

  describe('Successful execution (switches enabled)', () => {
    it('should allow execution when all checks pass', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.OK);

      expect(response.body).toEqual(mockAIResponse);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should invoke ai-service when all checks pass', async () => {
      await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          userId: mockIdentity.userId, // Verified identity
        }),
      );
    });

    it('should record usage when execution succeeds', async () => {
      await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        });

      expect(usageLedgerService.writeRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKeyId: mockIdentity.apiKeyId,
          userId: mockIdentity.userId,
          tokensUsed: mockAIResponse.tokensUsed,
        }),
      );
    });

    it('should record execution cost when execution succeeds', async () => {
      const recordCostSpy = jest.spyOn(
        globalSafetyLimitService,
        'recordExecutionCost',
      );

      await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        });

      // Should record cost: (100 tokens / 1000) * $0.01 = $0.001
      expect(recordCostSpy).toHaveBeenCalledWith(0.001);
    });
  });

  describe('Global kill switch enforcement', () => {
    it('should return 503 when global execution disabled', async () => {
      jest
        .spyOn(KillSwitchConfig, 'GLOBAL_EXECUTION_ENABLED', 'get')
        .mockReturnValue(false);

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
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
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      expect(usageLedgerService.writeRecord).not.toHaveBeenCalled();
    });
  });

  describe('Provider kill switch enforcement', () => {
    it('should return 503 when provider disabled', async () => {
      jest
        .spyOn(KillSwitchConfig, 'isProviderEnabled')
        .mockReturnValue(false);

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
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

  describe('Max tokens enforcement', () => {
    it('should return 400 when max_tokens exceeds limit', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/execute')
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
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 100000, // Exactly at limit
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.OK);

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('Global rate limit enforcement', () => {
    it('should return 429 when global rate limit exceeded', async () => {
      // Fill up global rate limit (10,000 executions/min)
      for (let i = 0; i < 10000; i++) {
        globalSafetyLimitService.recordExecution('anthropic');
      }

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
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
        globalSafetyLimitService.recordExecution('anthropic');
      }

      await request(app.getHttpServer())
        .post('/ai/execute')
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
      // Fill up anthropic rate limit (1,000 executions/min)
      for (let i = 0; i < 1000; i++) {
        globalSafetyLimitService.recordExecution('anthropic');
      }

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
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
        globalSafetyLimitService.recordExecution('anthropic');
      }

      await request(app.getHttpServer())
        .post('/ai/execute')
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
      // Fill up anthropic rate limit (1,000/min)
      for (let i = 0; i < 1000; i++) {
        globalSafetyLimitService.recordExecution('anthropic');
      }

      // Anthropic should be blocked
      await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.TOO_MANY_REQUESTS);

      // But OpenAI should still work (5,000/min limit)
      await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'openai',
          model: 'gpt-4',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.OK);
    });
  });

  describe('Daily spend limit enforcement', () => {
    it('should return 503 when hard daily spend limit exceeded', async () => {
      // Hit hard daily spend limit ($20,000)
      globalSafetyLimitService.recordExecutionCost(20000);

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      expect(response.body.message).toContain('Daily spend');
    });

    it('should NOT invoke ai-service when daily spend limit exceeded', async () => {
      globalSafetyLimitService.recordExecutionCost(20000);

      await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.SERVICE_UNAVAILABLE);

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should allow execution within soft daily spend limit', async () => {
      // Record $5,000 (under $10,000 soft limit)
      globalSafetyLimitService.recordExecutionCost(5000);

      await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.OK);

      expect(mockExecute).toHaveBeenCalledTimes(1);
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
        globalSafetyLimitService.recordExecution('anthropic');
      }

      await request(app.getHttpServer())
        .post('/ai/execute')
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

    it('should return 503 for daily spend limit exceeded', async () => {
      globalSafetyLimitService.recordExecutionCost(20000);

      await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        })
        .expect(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });

  describe('No behavior change when switches enabled', () => {
    it('should execute normally with all switches enabled', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test prompt' }],
        })
        .expect(HttpStatus.OK);

      // Should get normal response
      expect(response.body).toEqual(mockAIResponse);

      // Should invoke ai-service
      expect(mockExecute).toHaveBeenCalledTimes(1);

      // Should record usage
      expect(usageLedgerService.writeRecord).toHaveBeenCalledTimes(1);
    });

    it('should not modify request when safety checks pass', async () => {
      await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Test' }],
        });

      const callArgs = mockExecute.mock.calls[0][0];

      // Request should be passed through unchanged (except userId injection)
      expect(callArgs.provider).toBe('anthropic');
      expect(callArgs.model).toBe('claude-3-5-sonnet-20241022');
      expect(callArgs.max_tokens).toBe(1000);
      expect(callArgs.messages).toEqual([{ role: 'user', content: 'Test' }]);
    });

    it('should not log prompts or responses', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const consoleInfoSpy = jest.spyOn(console, 'info');

      await request(app.getHttpServer())
        .post('/ai/execute')
        .send({
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [
            { role: 'user', content: 'SENSITIVE_PROMPT_CONTENT_SECRET' },
          ],
        });

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
