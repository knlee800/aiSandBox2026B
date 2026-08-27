import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { APP_FILTER } from '@nestjs/core';
import { Repository } from 'typeorm';
import request from 'supertest';
import { AIExecutionController } from '../ai-execution.controller';
import { UsageLedgerService } from '../../usage-ledger/usage-ledger.service';
import { UsageRecord } from '../../entities/usage-record.entity';
import { SessionOrApiKeyAuthGuard } from '../../auth/session-or-api-key.guard';
import { AuthorizationGuard } from '../../auth/authorization.guard';
import { QuotaGuard } from '../../quota/quota.guard';
import { TokenQuotaGuard } from '../../quota/token-quota.guard';
import { ExecutionSafetyGuard } from '../../safety/execution-safety.guard';
import { GlobalSafetyLimitService } from '../../safety/global-safety-limit.service';
import { LaunchGuard } from '../../launch/launch.guard';
import { AbortGuard } from '../../abort/abort.guard';
import { RateLimitGuard } from '../../guards/rate-limit.guard';
import { IdempotencyGuard } from '../idempotency.guard';
import { CreditBalanceGuard } from '../../billing/credit-balance.guard';
import { QueueService } from '../../queue/queue.service';
import { ExecutionResultService } from '../execution-result.service';
import { ExecutionStreamService } from '../../streaming/execution-stream.service';
import { UserAiInstructionsService } from '../../user-ai-instructions/user-ai-instructions.service';
import { ProjectAiContextService } from '../../project-ai-context/project-ai-context.service';
import { SessionService } from '../../sessions/session.service';
import { IdempotentReplayExceptionFilter } from '../../filters/idempotent-replay-exception.filter';
import {
  createHermeticUsageRecordFixture,
  HermeticUsageRecordFixture,
} from './hermetic-usage-record-fixture';

/**
 * AIExecutionController Deterministic Replay Integration Tests
 *
 * PHASE-43B-3 against current 202 queued / completed-replay 200 contract.
 * Completed rows are seeded via the real UsageLedgerService against the
 * hermetic relational store so JSON metadata round-trip is real.
 */
describe('AIExecutionController - Deterministic Replay (Integration)', () => {
  let app: INestApplication;
  let fixture: HermeticUsageRecordFixture;
  let usageRecordRepository: Repository<UsageRecord>;
  let usageLedgerService: UsageLedgerService;
  let queueService: { enqueueExecution: jest.Mock };
  let tokenQuotaGuardSpy: jest.Mock;

  const VALID_SESSION_UUID = '11111111-1111-4111-a111-111111111111';

  const mockIdentity = {
    apiKeyId: 'test-key-1',
    userId: 'user-1',
    scopes: ['ai:execute'],
  };

  const passthroughGuard = { canActivate: jest.fn(() => true) };

  beforeAll(async () => {
    fixture = await createHermeticUsageRecordFixture();
    usageRecordRepository = fixture.repository as Repository<UsageRecord>;

    queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };

    tokenQuotaGuardSpy = jest.fn().mockResolvedValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AIExecutionController],
      providers: [
        UsageLedgerService,
        IdempotencyGuard,
        GlobalSafetyLimitService,
        {
          provide: getRepositoryToken(UsageRecord),
          useValue: usageRecordRepository,
        },
        {
          provide: QueueService,
          useValue: queueService,
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
              userId: 'user-1',
              projectId: null,
            }),
          },
        },
        {
          provide: APP_FILTER,
          useClass: IdempotentReplayExceptionFilter,
        },
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard)
      .useValue({
        canActivate: jest.fn((context) => {
          const request = context.switchToHttp().getRequest();
          request.apiKeyIdentity = mockIdentity;
          return true;
        }),
      })
      .overrideGuard(AuthorizationGuard)
      .useValue(passthroughGuard)
      .overrideGuard(ExecutionSafetyGuard)
      .useValue(passthroughGuard)
      .overrideGuard(LaunchGuard)
      .useValue(passthroughGuard)
      .overrideGuard(AbortGuard)
      .useValue(passthroughGuard)
      .overrideGuard(CreditBalanceGuard)
      .useValue(passthroughGuard)
      .overrideGuard(QuotaGuard)
      .useValue(passthroughGuard)
      .overrideGuard(TokenQuotaGuard)
      .useValue({ canActivate: tokenQuotaGuardSpy })
      .overrideGuard(RateLimitGuard)
      .useValue(passthroughGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new IdempotentReplayExceptionFilter());
    await app.init();

    usageLedgerService = moduleFixture.get(UsageLedgerService);
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (fixture) {
      await fixture.destroy();
    }
  }, 10000);

  beforeEach(async () => {
    await fixture.clear();
    queueService.enqueueExecution.mockReset();
    queueService.enqueueExecution.mockResolvedValue(undefined);
    tokenQuotaGuardSpy.mockReset();
    tokenQuotaGuardSpy.mockResolvedValue(true);
  });

  async function queueThenComplete(
    idempotencyKey: string,
    requestBody: Record<string, unknown>,
    result: { output: string; tokensUsed: number; model: string },
  ): Promise<{ executionId: string }> {
    const firstResponse = await request(app.getHttpServer())
      .post('/ai/execute')
      .set('Authorization', 'Bearer test-key-1')
      .set('Idempotency-Key', idempotencyKey)
      .send(requestBody);

    expect(firstResponse.status).toBe(HttpStatus.ACCEPTED);
    expect(firstResponse.body.status).toBe('queued');

    await usageLedgerService.updateExecutionResult({
      executionId: firstResponse.body.executionId,
      model: result.model,
      tokensUsed: result.tokensUsed,
      executionDurationMs: 25,
      executionStatus: 'completed',
      output: result.output,
    });

    return { executionId: firstResponse.body.executionId };
  }

  describe('PHASE-43B-3: Deterministic Replay Body Persistence', () => {
    it('should return EXACT original output on replay (deep equality)', async () => {
      const originalOutput =
        'This is the original AI response with unique content: ' + Math.random();
      const persisted = {
        output: originalOutput,
        tokensUsed: 150,
        model: 'stub-model-v1',
      };

      const requestBody = {
        sessionId: VALID_SESSION_UUID,
        conversationId: '22222222-2222-4222-a222-222222222222',
        userId: 'user-1',
        prompt: 'Test deterministic replay',
        provider: 'stub' as const,
      };

      await queueThenComplete('test-deterministic-001', requestBody, persisted);

      const replayResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-deterministic-001')
        .send(requestBody);

      expect(replayResponse.status).toBe(HttpStatus.OK);
      expect(replayResponse.body.output).toBe(originalOutput);
      expect(replayResponse.body.tokensUsed).toBe(150);
      expect(replayResponse.body.model).toBe('stub-model-v1');

      const secondReplay = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-deterministic-001')
        .send(requestBody);

      expect(secondReplay.status).toBe(HttpStatus.OK);
      expect(secondReplay.body).toEqual(replayResponse.body);

      const allRecords = await usageRecordRepository.find({
        where: { userId: 'user-1' },
      });
      expect(allRecords.length).toBe(1);
    });

    it('should store aiExecutionResult in metadata JSON', async () => {
      const testOutput = 'Test output for metadata verification';
      const persisted = {
        output: testOutput,
        tokensUsed: 200,
        model: 'test-model',
      };

      const requestBody = {
        sessionId: VALID_SESSION_UUID,
        conversationId: '33333333-3333-4333-a333-333333333333',
        userId: 'user-1',
        prompt: 'Test metadata storage',
        provider: 'stub' as const,
      };

      await queueThenComplete('test-metadata-001', requestBody, persisted);

      const records = await usageRecordRepository.find({
        where: { userId: 'user-1', requestId: 'test-metadata-001' },
      });

      expect(records.length).toBe(1);
      expect(records[0].metadata).toBeDefined();
      expect(records[0].metadata!.aiExecutionResult).toBeDefined();
      const stored = records[0].metadata!.aiExecutionResult as {
        output: string;
        tokensUsed: number;
        model: string;
      };
      expect(stored.output).toBe(testOutput);
      expect(stored.tokensUsed).toBe(200);
      expect(stored.model).toBe('test-model');
    });

    it('should handle multiple replays with exact same output', async () => {
      const uniqueOutput = 'Unique output: ' + Date.now();
      const persisted = {
        output: uniqueOutput,
        tokensUsed: 100,
        model: 'stub',
      };

      const requestBody = {
        sessionId: VALID_SESSION_UUID,
        conversationId: '44444444-4444-4444-a444-444444444444',
        userId: 'user-1',
        prompt: 'Test multiple replays',
        provider: 'stub' as const,
      };

      await queueThenComplete('test-multi-replay-001', requestBody, persisted);

      const firstReplay = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-multi-replay-001')
        .send(requestBody);

      expect(firstReplay.status).toBe(HttpStatus.OK);
      expect(firstReplay.body.output).toBe(uniqueOutput);

      const secondReplay = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-multi-replay-001')
        .send(requestBody);

      expect(secondReplay.body.output).toBe(uniqueOutput);

      const thirdReplay = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-multi-replay-001')
        .send(requestBody);

      expect(thirdReplay.body.output).toBe(uniqueOutput);
      expect(secondReplay.body).toEqual(firstReplay.body);
      expect(thirdReplay.body).toEqual(firstReplay.body);

      const allRecords = await usageRecordRepository.find({
        where: { userId: 'user-1' },
      });
      expect(allRecords.length).toBe(1);
    });

    it('should preserve quota bypass behavior with deterministic replay', async () => {
      const testOutput = 'Test quota bypass with deterministic replay';
      const persisted = {
        output: testOutput,
        tokensUsed: 250,
        model: 'stub',
      };

      const requestBody = {
        sessionId: VALID_SESSION_UUID,
        conversationId: '55555555-5555-4555-a555-555555555555',
        userId: 'user-1',
        prompt: 'Test quota bypass',
        provider: 'stub' as const,
      };

      tokenQuotaGuardSpy.mockClear();

      await queueThenComplete('test-quota-bypass-det-001', requestBody, persisted);

      expect(tokenQuotaGuardSpy).toHaveBeenCalledTimes(1);

      tokenQuotaGuardSpy.mockClear();

      const replayResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-quota-bypass-det-001')
        .send(requestBody);

      expect(replayResponse.status).toBe(HttpStatus.OK);
      expect(replayResponse.body.output).toBe(testOutput);
      expect(tokenQuotaGuardSpy).not.toHaveBeenCalled();
    });

    it('should handle long output text correctly', async () => {
      const longOutput = 'A'.repeat(10000);
      const persisted = {
        output: longOutput,
        tokensUsed: 500,
        model: 'stub',
      };

      const requestBody = {
        sessionId: VALID_SESSION_UUID,
        conversationId: '66666666-6666-4666-a666-666666666666',
        userId: 'user-1',
        prompt: 'Test long output',
        provider: 'stub' as const,
      };

      await queueThenComplete('test-long-output-001', requestBody, persisted);

      const replayResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-long-output-001')
        .send(requestBody);

      expect(replayResponse.status).toBe(HttpStatus.OK);
      expect(replayResponse.body.output).toBe(longOutput);
      expect(replayResponse.body.output.length).toBe(10000);

      const secondReplay = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-long-output-001')
        .send(requestBody);

      expect(secondReplay.body.output).toBe(longOutput);
      expect(secondReplay.body).toEqual(replayResponse.body);
    });

    it('should handle special characters in output correctly', async () => {
      const specialOutput = 'Test with special chars: \n\t\r"\'\\{}[]<>!@#$%^&*()';
      const persisted = {
        output: specialOutput,
        tokensUsed: 50,
        model: 'stub',
      };

      const requestBody = {
        sessionId: VALID_SESSION_UUID,
        conversationId: '77777777-7777-4777-a777-777777777777',
        userId: 'user-1',
        prompt: 'Test special characters',
        provider: 'stub' as const,
      };

      await queueThenComplete('test-special-chars-001', requestBody, persisted);

      const replayResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-special-chars-001')
        .send(requestBody);

      expect(replayResponse.status).toBe(HttpStatus.OK);
      expect(replayResponse.body.output).toBe(specialOutput);

      const secondReplay = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-special-chars-001')
        .send(requestBody);

      expect(secondReplay.body.output).toBe(specialOutput);
      expect(secondReplay.body).toEqual(replayResponse.body);
    });
  });

  describe('Backward Compatibility', () => {
    it('should fallback to placeholder for records without metadata.aiExecutionResult', async () => {
      const record = usageRecordRepository.create({
        executionId: '88888888-8888-4888-a888-888888888888',
        apiKeyId: 'test-key-1',
        userId: 'user-1',
        sessionId: '77777777-7777-4777-a777-777777777777',
        conversationId: '88888888-8888-4888-a888-888888888888',
        provider: 'stub',
        adapter: 'stub',
        model: 'old-model',
        tokensUsed: 100,
        executionDurationMs: 1000,
        executionStatus: 'completed',
        requestId: 'test-backward-compat-001',
        metadata: {},
      });

      await usageRecordRepository.save(record);

      const replayResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-backward-compat-001')
        .send({
          sessionId: VALID_SESSION_UUID,
          conversationId: '88888888-8888-4888-a888-888888888888',
          userId: 'user-1',
          prompt: 'Test backward compatibility',
          provider: 'stub',
        });

      expect(replayResponse.status).toBe(HttpStatus.OK);
      expect(replayResponse.body.output).toBe(
        '[Duplicate request - original response not stored]',
      );
      expect(replayResponse.body.tokensUsed).toBe(100);
      expect(replayResponse.body.model).toBe('old-model');
    });
  });
});
