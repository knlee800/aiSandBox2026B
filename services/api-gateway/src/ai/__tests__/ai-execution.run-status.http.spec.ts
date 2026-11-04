import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AIExecutionController } from '../ai-execution.controller';
import { UsageLedgerService } from '../../usage-ledger/usage-ledger.service';
import { ExecutionResultService } from '../execution-result.service';
import { ExecutionStreamService } from '../../streaming/execution-stream.service';
import { GlobalSafetyLimitService } from '../../safety/global-safety-limit.service';
import { QueueService } from '../../queue/queue.service';
import { UserAiInstructionsService } from '../../user-ai-instructions/user-ai-instructions.service';
import { ProjectAiContextService } from '../../project-ai-context/project-ai-context.service';
import { SessionService } from '../../sessions/session.service';
import { SessionOrApiKeyAuthGuard } from '../../auth/session-or-api-key.guard';
import { ApiKeyAuthGuard } from '../../auth/api-key-auth.guard';
import { AuthService } from '../../auth/auth.service';
import { AuthorizationGuard } from '../../auth/authorization.guard';
import { InternalServiceAuthGuard } from '../../guards/internal-service-auth.guard';
import { ExecutionSafetyGuard } from '../../safety/execution-safety.guard';
import { LaunchGuard } from '../../launch/launch.guard';
import { AbortGuard } from '../../abort/abort.guard';
import { IdempotencyGuard } from '../idempotency.guard';
import { CreditBalanceGuard } from '../../billing/credit-balance.guard';
import { QuotaGuard } from '../../quota/quota.guard';
import { TokenQuotaGuard } from '../../quota/token-quota.guard';
import { RateLimitGuard } from '../../guards/rate-limit.guard';

describe('AIExecutionController HTTP run status (RUN-STATUS-01)', () => {
  let app: INestApplication;
  let executionResultService: {
    getExecution: jest.Mock;
    requestCancel: jest.Mock;
    listRunsForUser: jest.Mock;
  };
  let authService: {
    validateSessionToken: jest.Mock;
  };

  const originalInternalServiceKey = process.env.INTERNAL_SERVICE_KEY;
  const internalKey = 'run-status-http-test-key';
  const ownerUserId = 'user-owner';
  const foreignSessionId = '35d53116-6723-4571-af12-ac256977c007';
  const executionId = 'exec-public-1';
  const listedFields = [
    'agentId',
    'builderProfileId',
    'collaborationRunId',
    'durationMs',
    'executionId',
    'mode',
    'model',
    'provider',
    'sessionId',
    'startedAt',
    'status',
    'tokensUsed',
  ];

  function authedGet(path: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Cookie', 'aisandbox_session=owner-session');
  }

  beforeEach(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;

    executionResultService = {
      getExecution: jest.fn().mockResolvedValue({
        execution_id: executionId,
        user_id: ownerUserId,
        execution_status: 'running',
        provider: 'stub',
        model: 'stub-model',
        tokens_used: 4,
        metadata: {},
      }),
      requestCancel: jest.fn().mockResolvedValue(true),
      listRunsForUser: jest.fn().mockResolvedValue([]),
    };
    authService = {
      validateSessionToken: jest.fn().mockImplementation(async (token: string) => {
        if (token === 'owner-session') {
          return { id: ownerUserId };
        }
        if (token === 'missing-user') {
          return { id: undefined };
        }
        return null;
      }),
    };

    const unusedExecuteGuard = { canActivate: () => true };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIExecutionController],
      providers: [
        SessionOrApiKeyAuthGuard,
        { provide: ApiKeyAuthGuard, useValue: { canActivate: jest.fn() } },
        { provide: AuthService, useValue: authService },
        { provide: UsageLedgerService, useValue: { writeExecutionIntent: jest.fn() } },
        { provide: ExecutionResultService, useValue: executionResultService },
        { provide: ExecutionStreamService, useValue: { subscribe: jest.fn(), unsubscribe: jest.fn() } },
        { provide: GlobalSafetyLimitService, useValue: { checkAndRecord: jest.fn(), recordExecutionCost: jest.fn() } },
        { provide: QueueService, useValue: { enqueueExecution: jest.fn() } },
        { provide: UserAiInstructionsService, useValue: { getByUserId: jest.fn().mockResolvedValue(null) } },
        { provide: ProjectAiContextService, useValue: { getByProjectId: jest.fn().mockResolvedValue(null) } },
        { provide: SessionService, useValue: { getSessionById: jest.fn() } },
        { provide: APP_GUARD, useClass: InternalServiceAuthGuard },
      ],
    })
      .overrideGuard(AuthorizationGuard)
      .useValue(unusedExecuteGuard)
      .overrideGuard(ExecutionSafetyGuard)
      .useValue(unusedExecuteGuard)
      .overrideGuard(LaunchGuard)
      .useValue(unusedExecuteGuard)
      .overrideGuard(AbortGuard)
      .useValue(unusedExecuteGuard)
      .overrideGuard(IdempotencyGuard)
      .useValue(unusedExecuteGuard)
      .overrideGuard(CreditBalanceGuard)
      .useValue(unusedExecuteGuard)
      .overrideGuard(QuotaGuard)
      .useValue(unusedExecuteGuard)
      .overrideGuard(TokenQuotaGuard)
      .useValue(unusedExecuteGuard)
      .overrideGuard(RateLimitGuard)
      .useValue(unusedExecuteGuard)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    process.env.INTERNAL_SERVICE_KEY = originalInternalServiceKey;
    if (app) {
      await app.close();
    }
    jest.clearAllMocks();
  });

  it('maps active rows to the listed fields and defaults limit to 20', async () => {
    executionResultService.listRunsForUser.mockResolvedValue([
      {
        execution_id: 'exec-ask',
        session_id: foreignSessionId,
        execution_status: 'pending',
        provider: 'stub',
        model: 'stub-model',
        tokens_used: 12,
        execution_duration_ms: 340,
        timestamp: new Date('2026-11-02T07:01:02.000Z'),
        runMode: 'ask',
        agentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        collaborationRunId: 'collab-run-001',
        builderProfileId: 'builder-reviewer',
      },
      {
        execution_id: 'exec-build',
        session_id: foreignSessionId,
        execution_status: 'running',
        provider: 'stub',
        model: 'stub-model',
        tokens_used: 0,
        execution_duration_ms: 0,
        timestamp: '2026-11-01 03:04:05.000',
        runMode: 'build',
        agentId: '',
      },
      {
        execution_id: 'exec-agent',
        session_id: foreignSessionId,
        execution_status: 'completed',
        provider: 'stub',
        model: 'stub-model',
        tokens_used: '15',
        execution_duration_ms: null,
        timestamp: null,
        runMode: 'agent',
        agentId: null,
      },
      {
        execution_id: 'exec-cancel',
        session_id: null,
        execution_status: 'cancel_requested',
        provider: null,
        model: null,
        tokens_used: null,
        execution_duration_ms: null,
        timestamp: null,
        runMode: null,
        agentId: null,
        collaborationRunId: null,
        builderProfileId: null,
      },
      {
        execution_id: 'exec-failed',
        session_id: null,
        execution_status: 'failed',
        provider: null,
        model: null,
        tokens_used: null,
        execution_duration_ms: null,
        timestamp: '2026-11-02T08:00:00.000Z',
        runMode: 'other',
        agentId: null,
      },
      {
        execution_id: 'exec-timeout',
        session_id: null,
        execution_status: 'timeout',
        provider: null,
        model: null,
        tokens_used: null,
        execution_duration_ms: null,
        timestamp: null,
        runMode: 'Ask',
        agentId: null,
      },
      {
        execution_id: 'exec-cancelled',
        session_id: null,
        execution_status: 'cancelled',
        provider: null,
        model: null,
        tokens_used: null,
        execution_duration_ms: null,
        timestamp: null,
        runMode: '',
        agentId: null,
      },
      {
        execution_id: 'exec-unknown-status',
        session_id: null,
        execution_status: 'not-a-status',
        provider: null,
        model: null,
        tokens_used: null,
        execution_duration_ms: null,
        timestamp: null,
        runMode: undefined,
        agentId: null,
      },
    ]);

    const response = await authedGet('/api/ai/executions')
      .query({ state: 'active' })
      .expect(200);

    expect(executionResultService.listRunsForUser).toHaveBeenCalledTimes(1);
    expect(executionResultService.listRunsForUser).toHaveBeenCalledWith({
      userId: ownerUserId,
      state: 'active',
      limit: 20,
    });
    expect(response.body).toEqual({
      runs: [
        {
          executionId: 'exec-ask',
          status: 'queued',
          sessionId: foreignSessionId,
          provider: 'stub',
          model: 'stub-model',
          tokensUsed: 12,
          startedAt: '2026-11-02T07:01:02.000Z',
          durationMs: 340,
          mode: 'ask',
          agentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          collaborationRunId: 'collab-run-001',
          builderProfileId: 'builder-reviewer',
        },
        {
          executionId: 'exec-build',
          status: 'running',
          sessionId: foreignSessionId,
          provider: 'stub',
          model: 'stub-model',
          tokensUsed: 0,
          startedAt: '2026-11-01T03:04:05.000Z',
          durationMs: 0,
          mode: 'build',
          agentId: '',
          collaborationRunId: null,
          builderProfileId: null,
        },
        {
          executionId: 'exec-agent',
          status: 'completed',
          sessionId: foreignSessionId,
          provider: 'stub',
          model: 'stub-model',
          tokensUsed: 15,
          startedAt: null,
          durationMs: null,
          mode: 'agent',
          agentId: null,
          collaborationRunId: null,
          builderProfileId: null,
        },
        {
          executionId: 'exec-cancel',
          status: 'cancelled',
          sessionId: null,
          provider: null,
          model: null,
          tokensUsed: null,
          startedAt: null,
          durationMs: null,
          mode: 'unknown',
          agentId: null,
          collaborationRunId: null,
          builderProfileId: null,
        },
        {
          executionId: 'exec-failed',
          status: 'failed',
          sessionId: null,
          provider: null,
          model: null,
          tokensUsed: null,
          startedAt: '2026-11-02T08:00:00.000Z',
          durationMs: null,
          mode: 'unknown',
          agentId: null,
          collaborationRunId: null,
          builderProfileId: null,
        },
        {
          executionId: 'exec-timeout',
          status: 'timeout',
          sessionId: null,
          provider: null,
          model: null,
          tokensUsed: null,
          startedAt: null,
          durationMs: null,
          mode: 'unknown',
          agentId: null,
          collaborationRunId: null,
          builderProfileId: null,
        },
        {
          executionId: 'exec-cancelled',
          status: 'cancelled',
          sessionId: null,
          provider: null,
          model: null,
          tokensUsed: null,
          startedAt: null,
          durationMs: null,
          mode: 'unknown',
          agentId: null,
          collaborationRunId: null,
          builderProfileId: null,
        },
        {
          executionId: 'exec-unknown-status',
          status: 'queued',
          sessionId: null,
          provider: null,
          model: null,
          tokensUsed: null,
          startedAt: null,
          durationMs: null,
          mode: 'unknown',
          agentId: null,
          collaborationRunId: null,
          builderProfileId: null,
        },
      ],
    });

    for (const run of response.body.runs) {
      expect(Object.keys(run).sort()).toEqual(listedFields);
    }
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('metadata');
    expect(serialized).not.toContain('prompt');
    expect(serialized).not.toContain('output');
    expect(serialized).not.toContain('user_id');
  });

  it('calls recent with the caller user id, the supplied sessionId, and a limit of 1', async () => {
    executionResultService.listRunsForUser.mockResolvedValue([
      {
        execution_id: 'exec-recent',
        session_id: foreignSessionId,
        execution_status: 'completed',
        provider: null,
        model: null,
        tokens_used: null,
        execution_duration_ms: null,
        timestamp: null,
        runMode: 'ask',
        agentId: null,
      },
    ]);

    const response = await authedGet('/api/ai/executions')
      .query({
        state: 'recent',
        sessionId: foreignSessionId,
        limit: '1',
        userId: 'attacker-user',
      })
      .expect(200);

    expect(executionResultService.listRunsForUser).toHaveBeenCalledWith({
      userId: ownerUserId,
      state: 'recent',
      sessionId: foreignSessionId,
      limit: 1,
    });
    expect(executionResultService.listRunsForUser.mock.calls[0][0].userId).not.toBe(
      'attacker-user',
    );
    expect(response.body.runs).toEqual([
      {
        executionId: 'exec-recent',
        status: 'completed',
        sessionId: foreignSessionId,
        provider: null,
        model: null,
        tokensUsed: null,
        startedAt: null,
        durationMs: null,
        mode: 'ask',
        agentId: null,
        collaborationRunId: null,
        builderProfileId: null,
      },
    ]);
  });

  it('caps limit above 50 at 50 and still uses the caller user id', async () => {
    await authedGet('/api/ai/executions')
      .query({
        state: 'recent',
        sessionId: foreignSessionId,
        limit: '80',
        userId: 'attacker-user',
      })
      .expect(200);

    expect(executionResultService.listRunsForUser).toHaveBeenCalledWith({
      userId: ownerUserId,
      state: 'recent',
      sessionId: foreignSessionId,
      limit: 50,
    });
  });

  it('keeps an exact limit of 50', async () => {
    await authedGet('/api/ai/executions')
      .query({ state: 'active', limit: '50' })
      .expect(200);

    expect(executionResultService.listRunsForUser).toHaveBeenCalledWith({
      userId: ownerUserId,
      state: 'active',
      limit: 50,
    });
  });

  it.each(['', 'queued', 'ACTIVE', 'recent '])(
    'returns 400 for state %p',
    async (state) => {
      const response = await authedGet('/api/ai/executions')
        .query({ state })
        .expect(400);

      expect(response.body.message).toBe("state must be 'active' or 'recent'");
      expect(executionResultService.listRunsForUser).not.toHaveBeenCalled();
    },
  );

  it('returns 400 when state is omitted', async () => {
    const response = await authedGet('/api/ai/executions').expect(400);

    expect(response.body.message).toBe("state must be 'active' or 'recent'");
    expect(executionResultService.listRunsForUser).not.toHaveBeenCalled();
  });

  it.each(['not-a-uuid', '123', ''])(
    'returns 400 for sessionId %p',
    async (sessionId) => {
      const response = await authedGet('/api/ai/executions')
        .query({ state: 'active', sessionId })
        .expect(400);

      expect(response.body.message).toBe('sessionId must be a valid UUID');
      expect(executionResultService.listRunsForUser).not.toHaveBeenCalled();
    },
  );

  it.each(['0', '-1', '1.5', '20abc', '01', ''])(
    'returns 400 for limit %p',
    async (limit) => {
      const response = await authedGet('/api/ai/executions')
        .query({ state: 'recent', limit })
        .expect(400);

      expect(response.body.message).toBe(
        'limit must be a whole number from 1 upward',
      );
      expect(executionResultService.listRunsForUser).not.toHaveBeenCalled();
    },
  );

  it('returns 404 when the authenticated identity has no userId', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/ai/executions')
      .query({ state: 'active' })
      .set('Cookie', 'aisandbox_session=missing-user')
      .expect(404);

    expect(response.body.message).toBe('Execution not found');
    expect(executionResultService.listRunsForUser).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing userId before validating a bad state', async () => {
    await request(app.getHttpServer())
      .get('/api/ai/executions')
      .query({ state: 'nope' })
      .set('Cookie', 'aisandbox_session=missing-user')
      .expect(404);

    expect(executionResultService.listRunsForUser).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated list request', async () => {
    await request(app.getHttpServer())
      .get('/api/ai/executions')
      .query({ state: 'active' })
      .expect(401);

    expect(executionResultService.listRunsForUser).not.toHaveBeenCalled();
  });

  it('still resolves GET executions/:executionId', async () => {
    const running = await authedGet(`/api/ai/executions/${executionId}`).expect(200);

    expect(running.body).toEqual({
      executionId,
      status: 'running',
      provider: 'stub',
      model: 'stub-model',
    });
    expect(executionResultService.getExecution).toHaveBeenCalledWith(executionId);
    expect(executionResultService.listRunsForUser).not.toHaveBeenCalled();

    executionResultService.getExecution.mockResolvedValue({
      execution_id: executionId,
      user_id: ownerUserId,
      execution_status: 'cancel_requested',
      provider: 'stub',
      model: 'stub-model',
      metadata: { prompt: 'hidden', output: 'hidden' },
    });

    const cancelled = await authedGet(`/api/ai/executions/${executionId}`).expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect(cancelled.body).not.toHaveProperty('output');
    expect(cancelled.body).not.toHaveProperty('prompt');

    executionResultService.getExecution.mockResolvedValue({
      execution_id: executionId,
      user_id: ownerUserId,
      execution_status: 'not-a-status',
      provider: 'stub',
      model: 'stub-model',
      metadata: {},
    });

    const unknownStatus = await authedGet(`/api/ai/executions/${executionId}`).expect(200);
    expect(unknownStatus.body).toEqual({
      executionId,
      status: 'queued',
      provider: 'stub',
      model: 'stub-model',
    });
  });
});
