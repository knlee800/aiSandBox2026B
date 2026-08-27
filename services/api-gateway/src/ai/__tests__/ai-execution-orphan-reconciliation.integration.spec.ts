/**
 * Integration Tests: Orphan Execution Reconciliation
 *
 * PHASE-43B-4: Orphan Execution Cleanup & Reconciliation
 * PHASE-43B-4 HOTFIX: Reuse Execution Row on Retry After Timeout
 *
 * Current contract: young pending → 409; old pending is transitioned to
 * timeout by IdempotencyGuard; retry reuses the row and returns 202 queued.
 * Completed replay is seeded via UsageLedgerService.updateExecutionResult.
 */

jest.mock('axios', () => {
  const post = jest.fn(() => {
    throw new Error('Unexpected outbound HTTP call in orphan reconciliation test');
  });
  const get = jest.fn(() => {
    throw new Error('Unexpected outbound HTTP call in orphan reconciliation test');
  });
  const mockAxiosInstance = { post, get, put: post, delete: post, patch: post };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockAxiosInstance),
      isAxiosError: jest.fn(() => false),
    },
    create: jest.fn(() => mockAxiosInstance),
    isAxiosError: jest.fn(() => false),
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { APP_FILTER } from '@nestjs/core';
import { Repository } from 'typeorm';
import request from 'supertest';
import { UsageRecord } from '../../entities/usage-record.entity';
import { AIExecutionController } from '../ai-execution.controller';
import { IdempotencyGuard } from '../idempotency.guard';
import { UsageLedgerService } from '../../usage-ledger/usage-ledger.service';
import { SessionOrApiKeyAuthGuard } from '../../auth/session-or-api-key.guard';
import { AuthorizationGuard } from '../../auth/authorization.guard';
import { ExecutionSafetyGuard } from '../../safety/execution-safety.guard';
import { LaunchGuard } from '../../launch/launch.guard';
import { AbortGuard } from '../../abort/abort.guard';
import { QuotaGuard } from '../../quota/quota.guard';
import { TokenQuotaGuard } from '../../quota/token-quota.guard';
import { RateLimitGuard } from '../../guards/rate-limit.guard';
import { CreditBalanceGuard } from '../../billing/credit-balance.guard';
import { GlobalSafetyLimitService } from '../../safety/global-safety-limit.service';
import { IdempotentReplayExceptionFilter } from '../../filters/idempotent-replay-exception.filter';
import { QueueService } from '../../queue/queue.service';
import { ExecutionResultService } from '../execution-result.service';
import { ExecutionStreamService } from '../../streaming/execution-stream.service';
import { UserAiInstructionsService } from '../../user-ai-instructions/user-ai-instructions.service';
import { ProjectAiContextService } from '../../project-ai-context/project-ai-context.service';
import { SessionService } from '../../sessions/session.service';
import {
  createHermeticUsageRecordFixture,
  HermeticUsageRecordFixture,
} from './hermetic-usage-record-fixture';

describe('AI Execution - Orphan Reconciliation (Integration)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let fixture: HermeticUsageRecordFixture;
  let usageRecordRepository: Repository<UsageRecord>;
  let usageLedgerService: UsageLedgerService;
  let queueService: { enqueueExecution: jest.Mock };

  const TEST_API_KEY = 'test-key-1';
  const TEST_USER_ID = 'user-1';
  const TEST_SESSION_ID = '11111111-1111-4111-a111-111111111111';
  const TEST_CONVERSATION_ID = '22222222-2222-4222-a222-222222222222';

  const mockIdentity = {
    userId: TEST_USER_ID,
    apiKeyId: TEST_API_KEY,
    scopes: ['ai:execute'],
  };

  const mockPassthroughGuard = { canActivate: jest.fn(() => true) };

  const executeBody = (prompt: string) => ({
    sessionId: TEST_SESSION_ID,
    conversationId: TEST_CONVERSATION_ID,
    userId: TEST_USER_ID,
    prompt,
    provider: 'stub' as const,
  });

  async function insertPending(params: {
    executionId: string;
    requestId: string;
    timestamp: Date;
  }): Promise<void> {
    await usageRecordRepository.insert({
      executionId: params.executionId,
      apiKeyId: TEST_API_KEY,
      userId: TEST_USER_ID,
      sessionId: TEST_SESSION_ID,
      conversationId: TEST_CONVERSATION_ID,
      provider: 'stub',
      adapter: 'stub',
      requestId: params.requestId,
      executionStatus: 'pending',
      timestamp: params.timestamp,
    });
  }

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

  beforeAll(async () => {
    fixture = await createHermeticUsageRecordFixture();
    usageRecordRepository = fixture.repository as Repository<UsageRecord>;

    queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };

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
              userId: TEST_USER_ID,
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
          const req = context.switchToHttp().getRequest();
          req.apiKeyIdentity = mockIdentity;
          return true;
        }),
      })
      .overrideGuard(AuthorizationGuard)
      .useValue(mockPassthroughGuard)
      .overrideGuard(ExecutionSafetyGuard)
      .useValue(mockPassthroughGuard)
      .overrideGuard(LaunchGuard)
      .useValue(mockPassthroughGuard)
      .overrideGuard(AbortGuard)
      .useValue(mockPassthroughGuard)
      .overrideGuard(CreditBalanceGuard)
      .useValue(mockPassthroughGuard)
      .overrideGuard(QuotaGuard)
      .useValue(mockPassthroughGuard)
      .overrideGuard(TokenQuotaGuard)
      .useValue(mockPassthroughGuard)
      .overrideGuard(RateLimitGuard)
      .useValue(mockPassthroughGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new IdempotentReplayExceptionFilter());
    await app.init();

    usageLedgerService = moduleFixture.get(UsageLedgerService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (fixture) {
      await fixture.destroy();
    }
  });

  beforeEach(async () => {
    await fixture.clear();
    queueService.enqueueExecution.mockReset();
    queueService.enqueueExecution.mockResolvedValue(undefined);
  });

  describe('Test 1: Orphan detection - pending < 5min → 409 Conflict', () => {
    it('should return 409 Conflict for pending execution younger than 5 minutes', async () => {
      const idempotencyKey = 'test-orphan-young-001';

      await insertPending({
        executionId: '11111111-1111-4111-a111-111111111111',
        requestId: idempotencyKey,
        timestamp: new Date(),
      });

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(executeBody('Test orphan detection'));

      expect(response.status).toBe(HttpStatus.CONFLICT);
      expect(response.body.message).toBe('Execution in progress');
      expect(response.body.details.status).toBe('pending');
      expect(response.body.details.age).toBeLessThan(60);

      const record = await usageRecordRepository.findOne({
        where: { requestId: idempotencyKey },
      });
      expect(record).not.toBeNull();
      expect(record!.executionStatus).toBe('pending');
    });
  });

  describe('Test 2: Orphan transition - pending > 5min → transition to timeout, allow retry', () => {
    it('should transition orphaned pending execution to timeout and allow retry', async () => {
      const idempotencyKey = 'test-orphan-old-001';
      const orphanExecutionId = '22222222-2222-4222-a222-222222222222';

      await insertPending({
        executionId: orphanExecutionId,
        requestId: idempotencyKey,
        timestamp: new Date(Date.now() - 6 * 60 * 1000),
      });

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(executeBody('Test orphan transition'));

      expect(response.status).toBe(HttpStatus.ACCEPTED);
      expect(response.body.status).toBe('queued');
      expect(response.body.executionId).toBeDefined();
      expect(response.body.executionId).not.toBe(orphanExecutionId);

      const oldRecord = await usageRecordRepository.findOne({
        where: { executionId: orphanExecutionId },
      });
      expect(oldRecord).toBeNull();

      const records = await usageRecordRepository.find({
        where: { requestId: idempotencyKey },
        order: { timestamp: 'DESC' },
      });
      expect(records.length).toBe(1);
      expect(records[0].executionStatus).toBe('pending');
      expect(records[0].executionId).not.toBe(orphanExecutionId);
    });
  });

  describe('Test 3: Retry after orphan - Retry with same request_id → new execution succeeds', () => {
    it('should allow retry with same request_id after orphan transition', async () => {
      const idempotencyKey = 'test-orphan-retry-001';
      const orphanExecutionId = '33333333-3333-4333-a333-333333333333';
      const persisted = {
        output: 'stub-response',
        tokensUsed: 10,
        model: 'stub',
      };

      await insertPending({
        executionId: orphanExecutionId,
        requestId: idempotencyKey,
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
      });

      const response1 = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(executeBody('Test retry after orphan'));

      expect(response1.status).toBe(HttpStatus.ACCEPTED);
      expect(response1.body.status).toBe('queued');

      await completeExecution(response1.body.executionId, persisted);

      const response2 = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(executeBody('Test retry after orphan'));

      expect(response2.status).toBe(HttpStatus.OK);
      expect(response2.body.output).toBe(persisted.output);
      expect(response2.body.tokensUsed).toBe(persisted.tokensUsed);
    });
  });

  describe('Test 4: No double billing - DB row count after orphan transition + retry', () => {
    it('should not create duplicate ledger rows after orphan transition and retry', async () => {
      const idempotencyKey = 'test-orphan-no-double-billing-001';
      const orphanExecutionId = '44444444-4444-4444-a444-444444444444';

      await insertPending({
        executionId: orphanExecutionId,
        requestId: idempotencyKey,
        timestamp: new Date(Date.now() - 7 * 60 * 1000),
      });

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(executeBody('Test no double billing'));

      expect(response.status).toBe(HttpStatus.ACCEPTED);

      const allRecords = await usageRecordRepository.find();
      expect(allRecords.length).toBe(1);
      expect(allRecords[0].requestId).toBe(idempotencyKey);
      expect(allRecords[0].executionStatus).toBe('pending');
      expect(allRecords[0].executionId).not.toBe(orphanExecutionId);

      const timeoutRecords = allRecords.filter(
        (r) => r.executionStatus === 'timeout',
      );
      expect(timeoutRecords.length).toBe(0);
    });
  });

  describe('Test 5: Quota bypass preserved - Replay of completed still bypasses quota', () => {
    it('should bypass quota guards on replay after orphan transition', async () => {
      const idempotencyKey = 'test-orphan-quota-bypass-001';
      const orphanExecutionId = '55555555-5555-4555-a555-555555555555';
      const persisted = {
        output: 'stub-response',
        tokensUsed: 10,
        model: 'stub',
      };

      await insertPending({
        executionId: orphanExecutionId,
        requestId: idempotencyKey,
        timestamp: new Date(Date.now() - 8 * 60 * 1000),
      });

      const response1 = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(executeBody('Test quota bypass'));

      expect(response1.status).toBe(HttpStatus.ACCEPTED);

      await completeExecution(response1.body.executionId, persisted);

      const response2 = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(executeBody('Test quota bypass'));

      expect(response2.status).toBe(HttpStatus.OK);
      expect(response2.body.output).toBe(persisted.output);
      expect(response2.body.tokensUsed).toBe(persisted.tokensUsed);

      const allRecords = await usageRecordRepository.find({
        where: { requestId: idempotencyKey },
      });
      expect(allRecords.length).toBe(1);
    });
  });

  describe('Test 6: Multiple retries - Multiple retries with same request_id → deterministic outcome', () => {
    it('should produce deterministic outcome on multiple retries after orphan transition', async () => {
      const idempotencyKey = 'test-orphan-deterministic-001';
      const orphanExecutionId = '66666666-6666-4666-a666-666666666666';
      const persisted = {
        output: 'stub-response',
        tokensUsed: 10,
        model: 'stub',
      };

      await insertPending({
        executionId: orphanExecutionId,
        requestId: idempotencyKey,
        timestamp: new Date(Date.now() - 9 * 60 * 1000),
      });

      const response1 = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(executeBody('Test deterministic outcome'));

      expect(response1.status).toBe(HttpStatus.ACCEPTED);

      await completeExecution(response1.body.executionId, persisted);

      const response2 = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(executeBody('Test deterministic outcome'));

      expect(response2.status).toBe(HttpStatus.OK);

      const response3 = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', `Bearer ${TEST_API_KEY}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(executeBody('Test deterministic outcome'));

      expect(response3.status).toBe(HttpStatus.OK);

      expect(response2.body.output).toBe(persisted.output);
      expect(response2.body.tokensUsed).toBe(persisted.tokensUsed);
      expect(response2.body.model).toBe(persisted.model);

      expect(response3.body.output).toBe(response2.body.output);
      expect(response3.body.tokensUsed).toBe(response2.body.tokensUsed);
      expect(response3.body.model).toBe(response2.body.model);
    });
  });
});
