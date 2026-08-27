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
 * AIExecutionController Two-Phase Execution Integration Tests
 *
 * Current contract (Phase 44.4D): intent is written BEFORE queue enqueue.
 * POST /ai/execute returns 202 ACCEPTED with status 'queued'. Worker completion
 * is simulated via UsageLedgerService.updateExecutionResult against the hermetic
 * relational store.
 */
describe('AIExecutionController - Two-Phase Execution (Integration)', () => {
  let app: INestApplication;
  let fixture: HermeticUsageRecordFixture;
  let usageRecordRepository: Repository<UsageRecord>;
  let usageLedgerService: UsageLedgerService;
  let queueService: { enqueueExecution: jest.Mock };

  const VALID_SESSION_UUID = '11111111-1111-4111-a111-111111111111';
  const VALID_CONVERSATION_ID = '22222222-2222-4222-a222-222222222222';

  const mockIdentity = {
    apiKeyId: 'test-key-1',
    userId: 'user-1',
    scopes: ['ai:execute'],
  };

  const passthroughGuard = { canActivate: jest.fn(() => true) };

  const executeBody = (overrides: Record<string, unknown> = {}) => ({
    sessionId: VALID_SESSION_UUID,
    conversationId: VALID_CONVERSATION_ID,
    userId: 'user-1',
    prompt: 'Test prompt',
    provider: 'stub' as const,
    ...overrides,
  });

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
      .useValue(passthroughGuard)
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
  });

  describe('Two-Phase Execution Record', () => {
    it('should write execution intent BEFORE queue enqueue (status: pending)', async () => {
      queueService.enqueueExecution.mockImplementation(async () => {
        const pendingDuringEnqueue = await usageRecordRepository.find({
          where: { userId: 'user-1', executionStatus: 'pending' },
        });
        expect(pendingDuringEnqueue.length).toBe(1);
        expect(pendingDuringEnqueue[0].executionStatus).toBe('pending');
        expect(pendingDuringEnqueue[0].model).toBeNull();
        expect(pendingDuringEnqueue[0].tokensUsed).toBeNull();
        expect(pendingDuringEnqueue[0].executionDurationMs).toBeNull();
      });

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-two-phase-001')
        .send(executeBody());

      expect(response.status).toBe(HttpStatus.ACCEPTED);
      expect(response.body.status).toBe('queued');
      expect(response.body.executionId).toBeDefined();
      expect(queueService.enqueueExecution).toHaveBeenCalledTimes(1);

      const pendingRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', executionStatus: 'pending' },
      });
      expect(pendingRecords.length).toBe(1);
      expect(pendingRecords[0].executionStatus).toBe('pending');
      expect(pendingRecords[0].model).toBeNull();
      expect(pendingRecords[0].tokensUsed).toBeNull();
      expect(pendingRecords[0].executionDurationMs).toBeNull();
    });

    it('should return 409 Conflict when retrying with same Idempotency-Key while execution is pending', async () => {
      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-conflict-001')
        .send(executeBody());

      expect(firstResponse.status).toBe(HttpStatus.ACCEPTED);
      expect(firstResponse.body.status).toBe('queued');

      const secondResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-conflict-001')
        .send(executeBody());

      expect(secondResponse.status).toBe(HttpStatus.CONFLICT);
      expect(secondResponse.body.message).toBe('Execution in progress');
      expect(secondResponse.body.details.status).toBe('pending');
    });

    it('should return cached result when retrying with same Idempotency-Key after execution completes', async () => {
      const firstResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-replay-001')
        .send(executeBody());

      expect(firstResponse.status).toBe(HttpStatus.ACCEPTED);
      expect(firstResponse.body.status).toBe('queued');

      await usageLedgerService.updateExecutionResult({
        executionId: firstResponse.body.executionId,
        model: 'stub',
        tokensUsed: 100,
        executionDurationMs: 25,
        executionStatus: 'completed',
        output: 'Original response',
      });

      const completedRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', executionStatus: 'completed' },
      });
      expect(completedRecords.length).toBe(1);

      const secondResponse = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-replay-001')
        .send(executeBody());

      expect(secondResponse.status).toBe(HttpStatus.OK);
      expect(secondResponse.body.output).toBe('Original response');
      expect(secondResponse.body.tokensUsed).toBe(100);
      expect(secondResponse.body.model).toBe('stub');

      const allRecords = await usageRecordRepository.find({
        where: { userId: 'user-1' },
      });
      expect(allRecords.length).toBe(1);
      expect(queueService.enqueueExecution).toHaveBeenCalledTimes(1);
    });

    it('should leave pending record when queue enqueue fails', async () => {
      queueService.enqueueExecution.mockRejectedValue(new Error('Queue unavailable'));

      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-failure-001')
        .send(executeBody());

      expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);

      const pendingRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', executionStatus: 'pending' },
      });

      expect(pendingRecords.length).toBe(1);
      expect(pendingRecords[0].executionStatus).toBe('pending');
      expect(pendingRecords[0].model).toBeNull();
      expect(pendingRecords[0].tokensUsed).toBeNull();

      const completedRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', executionStatus: 'completed' },
      });
      expect(completedRecords.length).toBe(0);
    });
  });

  describe('Financial Integrity', () => {
    it('should keep pending intent visible after successful queueing without worker completion', async () => {
      const response = await request(app.getHttpServer())
        .post('/ai/execute')
        .set('Authorization', 'Bearer test-key-1')
        .set('Idempotency-Key', 'test-network-failure-001')
        .send(executeBody());

      expect(response.status).toBe(HttpStatus.ACCEPTED);
      expect(response.body.status).toBe('queued');
      expect(queueService.enqueueExecution).toHaveBeenCalledTimes(1);

      const pendingRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', executionStatus: 'pending' },
      });

      expect(pendingRecords.length).toBe(1);
      expect(pendingRecords[0].executionStatus).toBe('pending');
      expect(pendingRecords[0].requestId).toBe('test-network-failure-001');

      const completedRecords = await usageRecordRepository.find({
        where: { userId: 'user-1', executionStatus: 'completed' },
      });
      expect(completedRecords.length).toBe(0);
    });
  });
});
