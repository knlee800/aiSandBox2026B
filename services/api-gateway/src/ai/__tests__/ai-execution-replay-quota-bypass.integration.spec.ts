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
 * AIExecutionController Replay Quota Bypass Integration Tests
 *
 * PHASE-43B-2-HOTFIX against current 202 queued / completed-replay 200 contract.
 * First POST writes a pending intent and invokes TokenQuotaGuard. After the
 * hermetic row is completed, replay returns HTTP 200 and does not re-invoke quota.
 */
describe('AIExecutionController - Replay Quota Bypass (Integration)', () => {
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

  async function completeExecution(
    executionId: string,
    result: { output: string; tokensUsed: number; model: string },
  ): Promise<void> {
    await usageLedgerService.updateExecutionResult({
      executionId,
      model: result.model,
      tokensUsed: result.tokensUsed,
      executionDurationMs: 25,
      executionStatus: 'completed',
      output: result.output,
    });
  }

  describe('HOTFIX: Replay Bypasses Quota Guards', () => {
    it('should return 200 with persisted body on replay AND NOT invoke TokenQuotaGuard', async () => {
      const persisted = {
        output: 'Original AI response',
        tokensUsed: 150,
        model: 'stub',
      };

      const requestBody = {
        sessionId: VALID_SESSION_UUID,
        conversationId: '22222222-2222-4222-a222-222222222222',
        userId: 'user-1',
        prompt: 'Test replay quota bypass',
        provider: 'stub' as const,
      };

      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-quota-bypass-001')
        .send(requestBody);

      expect(firstResponse.status).toBe(HttpStatus.ACCEPTED);
      expect(firstResponse.body.status).toBe('queued');
      expect(tokenQuotaGuardSpy).toHaveBeenCalledTimes(1);

      await completeExecution(firstResponse.body.executionId, persisted);

      const completedRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', executionStatus: 'completed' },
      });
      expect(completedRecords.length).toBe(1);

      tokenQuotaGuardSpy.mockClear();

      const secondResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-quota-bypass-001')
        .send(requestBody);

      expect(secondResponse.status).toBe(HttpStatus.OK);
      expect(secondResponse.body.output).toBe(persisted.output);
      expect(secondResponse.body.tokensUsed).toBe(persisted.tokensUsed);
      expect(secondResponse.body.model).toBe(persisted.model);

      expect(tokenQuotaGuardSpy).not.toHaveBeenCalled();

      const allRecords = await usageRecordRepository.find({
        where: { userId: 'user-1' },
      });
      expect(allRecords.length).toBe(1);
    });

    it('should succeed on replay even if quota is exceeded after first execution', async () => {
      const persisted = {
        output: 'AI response',
        tokensUsed: 200,
        model: 'stub',
      };

      const requestBody = {
        sessionId: VALID_SESSION_UUID,
        conversationId: '33333333-3333-4333-a333-333333333333',
        userId: 'user-1',
        prompt: 'Test quota exceeded replay',
        provider: 'stub' as const,
      };

      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-quota-exceeded-001')
        .send(requestBody);

      expect(firstResponse.status).toBe(HttpStatus.ACCEPTED);
      expect(firstResponse.body.status).toBe('queued');

      await completeExecution(firstResponse.body.executionId, persisted);

      tokenQuotaGuardSpy.mockClear();
      tokenQuotaGuardSpy.mockResolvedValue(false);

      const secondResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-quota-exceeded-001')
        .send(requestBody);

      expect(secondResponse.status).toBe(HttpStatus.OK);
      expect(secondResponse.body.tokensUsed).toBe(200);
      expect(tokenQuotaGuardSpy).not.toHaveBeenCalled();

      const allRecords = await usageRecordRepository.find({
        where: { userId: 'user-1' },
      });
      expect(allRecords.length).toBe(1);
    });

    it('should maintain DB row count of 1 for (user_id, request_id) on replay', async () => {
      const persisted = {
        output: 'Test response',
        tokensUsed: 100,
        model: 'stub',
      };

      const requestBody = {
        sessionId: VALID_SESSION_UUID,
        conversationId: '44444444-4444-4444-a444-444444444444',
        userId: 'user-1',
        prompt: 'Test DB row count',
        provider: 'stub' as const,
      };

      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-db-count-001')
        .send(requestBody);

      expect(firstResponse.status).toBe(HttpStatus.ACCEPTED);

      let records = await usageRecordRepository.find({
        where: { userId: 'user-1', requestId: 'test-db-count-001' },
      });
      expect(records.length).toBe(1);

      await completeExecution(firstResponse.body.executionId, persisted);

      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-db-count-001')
        .send(requestBody);

      records = await usageRecordRepository.find({
        where: { userId: 'user-1', requestId: 'test-db-count-001' },
      });
      expect(records.length).toBe(1);

      await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-db-count-001')
        .send(requestBody);

      records = await usageRecordRepository.find({
        where: { userId: 'user-1', requestId: 'test-db-count-001' },
      });
      expect(records.length).toBe(1);
    });

    it('should invoke TokenQuotaGuard on first request but NOT on replay', async () => {
      const persisted = {
        output: 'Test',
        tokensUsed: 50,
        model: 'stub',
      };

      const requestBody = {
        sessionId: VALID_SESSION_UUID,
        conversationId: '55555555-5555-4555-a555-555555555555',
        userId: 'user-1',
        prompt: 'Test guard invocation',
        provider: 'stub' as const,
      };

      tokenQuotaGuardSpy.mockClear();

      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-guard-invoke-001')
        .send(requestBody);

      expect(firstResponse.status).toBe(HttpStatus.ACCEPTED);
      expect(tokenQuotaGuardSpy).toHaveBeenCalledTimes(1);

      await completeExecution(firstResponse.body.executionId, persisted);

      tokenQuotaGuardSpy.mockClear();

      const replayResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-guard-invoke-001')
        .send(requestBody);

      expect(replayResponse.status).toBe(HttpStatus.OK);
      expect(tokenQuotaGuardSpy).not.toHaveBeenCalled();
    });
  });

  describe('Invariant Verification', () => {
    it('should preserve all idempotency invariants after hotfix', async () => {
      const persisted = {
        output: 'Test invariants',
        tokensUsed: 100,
        model: 'stub',
      };

      const requestBody = {
        sessionId: VALID_SESSION_UUID,
        conversationId: '66666666-6666-4666-a666-666666666666',
        userId: 'user-1',
        prompt: 'Test invariants',
        provider: 'stub' as const,
      };

      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-invariants-001')
        .send(requestBody);

      expect(firstResponse.status).toBe(HttpStatus.ACCEPTED);

      await completeExecution(firstResponse.body.executionId, persisted);

      const records = await usageRecordRepository.find({
        where: { userId: 'user-1', requestId: 'test-invariants-001' },
      });
      expect(records.length).toBe(1);
      expect(records[0].executionStatus).toBe('completed');
      expect(records[0].tokensUsed).toBe(100);

      const secondResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-invariants-001')
        .send(requestBody);

      expect(secondResponse.status).toBe(HttpStatus.OK);
      expect(secondResponse.body.tokensUsed).toBe(100);
      expect(secondResponse.body.model).toBe('stub');

      const allRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', requestId: 'test-invariants-001' },
      });
      expect(allRecords.length).toBe(1);

      expect(queueService.enqueueExecution).toHaveBeenCalledTimes(1);
    });
  });
});
