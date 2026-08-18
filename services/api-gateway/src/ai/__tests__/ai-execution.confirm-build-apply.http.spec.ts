import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AIExecutionController } from '../ai-execution.controller';
import { InternalAccountingController } from '../internal-accounting.controller';
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

describe('AIExecutionController HTTP public confirm-build-apply (PRIVATE-BETA-BLOCKER-03J)', () => {
  let app: INestApplication;
  let usageLedgerService: {
    writeExecutionIntent: jest.Mock;
    triggerBuildApplyDeduction: jest.Mock;
  };
  let executionResultService: {
    getExecution: jest.Mock;
    requestCancel: jest.Mock;
  };
  let authService: {
    validateSessionToken: jest.Mock;
  };

  const originalInternalServiceKey = process.env.INTERNAL_SERVICE_KEY;
  const internalKey = '03j-test-internal-key';
  const ownerUserId = 'user-owner';
  const otherUserId = 'user-other';
  const executionId = 'exec-public-confirm-1';
  const publicConfirmPath = `/api/ai/executions/${executionId}/confirm-build-apply`;
  const internalConfirmPath = `/api/internal/executions/${executionId}/confirm-build-apply`;
  const qualifyingBody = {
    applyStatus: 'applied',
    totalActions: 1,
    successCount: 1,
  };

  function ownedExecution(overrides: Record<string, unknown> = {}) {
    return {
      execution_id: executionId,
      user_id: ownerUserId,
      execution_status: 'completed',
      provider: 'xai',
      model: 'grok-4.5',
      tokens_used: 1148,
      metadata: {},
      ...overrides,
    };
  }

  beforeEach(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;

    usageLedgerService = {
      writeExecutionIntent: jest.fn(),
      triggerBuildApplyDeduction: jest.fn().mockResolvedValue({
        triggered: true,
        reason: 'completed',
      }),
    };
    executionResultService = {
      getExecution: jest.fn().mockResolvedValue(ownedExecution()),
      requestCancel: jest.fn().mockResolvedValue(true),
    };
    authService = {
      validateSessionToken: jest.fn().mockImplementation(async (token: string) => {
        if (token === 'owner-session') {
          return { id: ownerUserId };
        }
        if (token === 'other-session') {
          return { id: otherUserId };
        }
        return null;
      }),
    };

    const unusedExecuteGuard = { canActivate: () => true };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIExecutionController, InternalAccountingController],
      providers: [
        SessionOrApiKeyAuthGuard,
        { provide: ApiKeyAuthGuard, useValue: { canActivate: jest.fn() } },
        { provide: AuthService, useValue: authService },
        { provide: UsageLedgerService, useValue: usageLedgerService },
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

  it('maps POST /api/ai/executions/:executionId/confirm-build-apply on the public authenticated route', async () => {
    const response = await request(app.getHttpServer())
      .post(publicConfirmPath)
      .set('Cookie', 'aisandbox_session=owner-session')
      .send(qualifyingBody)
      .expect(200);

    expect(response.body).toEqual({
      executionId,
      triggered: true,
      reason: 'completed',
    });
    expect(usageLedgerService.triggerBuildApplyDeduction).toHaveBeenCalledTimes(1);
    expect(usageLedgerService.triggerBuildApplyDeduction).toHaveBeenCalledWith(
      executionId,
      expect.objectContaining(qualifyingBody),
    );
  });

  it('rejects unauthenticated public confirmation without deducting', async () => {
    await request(app.getHttpServer())
      .post(publicConfirmPath)
      .send(qualifyingBody)
      .expect(401);

    expect(executionResultService.getExecution).not.toHaveBeenCalled();
    expect(usageLedgerService.triggerBuildApplyDeduction).not.toHaveBeenCalled();
  });

  it('rejects an invalid session cookie without deducting', async () => {
    await request(app.getHttpServer())
      .post(publicConfirmPath)
      .set('Cookie', 'aisandbox_session=expired-session')
      .send(qualifyingBody)
      .expect(401);

    expect(usageLedgerService.triggerBuildApplyDeduction).not.toHaveBeenCalled();
  });

  it('does not treat INTERNAL_SERVICE_KEY as public confirmation authentication', async () => {
    await request(app.getHttpServer())
      .post(publicConfirmPath)
      .set('X-Internal-Service-Key', internalKey)
      .send(qualifyingBody)
      .expect(401);

    expect(usageLedgerService.triggerBuildApplyDeduction).not.toHaveBeenCalled();
  });

  it('lets an authenticated owner confirm without an internal service key', async () => {
    const response = await request(app.getHttpServer())
      .post(publicConfirmPath)
      .set('Cookie', 'aisandbox_session=owner-session')
      .send(qualifyingBody)
      .expect(200);

    expect(response.body.triggered).toBe(true);
    expect(usageLedgerService.triggerBuildApplyDeduction).toHaveBeenCalledTimes(1);
  });

  it('rejects another user with the same not-found convention and does not deduct', async () => {
    const response = await request(app.getHttpServer())
      .post(publicConfirmPath)
      .set('Cookie', 'aisandbox_session=other-session')
      .send(qualifyingBody)
      .expect(404);

    expect(response.body.message).toBe('Execution not found');
    expect(executionResultService.getExecution).toHaveBeenCalledWith(executionId);
    expect(usageLedgerService.triggerBuildApplyDeduction).not.toHaveBeenCalled();
  });

  it('rejects a nonexistent execution without deducting', async () => {
    executionResultService.getExecution.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post(publicConfirmPath)
      .set('Cookie', 'aisandbox_session=owner-session')
      .send(qualifyingBody)
      .expect(404);

    expect(response.body.message).toBe('Execution not found');
    expect(usageLedgerService.triggerBuildApplyDeduction).not.toHaveBeenCalled();
  });

  it('forwards applyStatus != applied to existing deferred deduction without charging', async () => {
    usageLedgerService.triggerBuildApplyDeduction.mockResolvedValue({
      triggered: false,
      reason: 'apply_status_not_applied',
    });

    const response = await request(app.getHttpServer())
      .post(publicConfirmPath)
      .set('Cookie', 'aisandbox_session=owner-session')
      .send({ applyStatus: 'skipped', totalActions: 1, successCount: 0 })
      .expect(200);

    expect(response.body).toEqual({
      executionId,
      triggered: false,
      reason: 'apply_status_not_applied',
    });
    expect(usageLedgerService.triggerBuildApplyDeduction).toHaveBeenCalledTimes(1);
  });

  it('forwards zero-action confirmation to existing deferred deduction without charging', async () => {
    usageLedgerService.triggerBuildApplyDeduction.mockResolvedValue({
      triggered: false,
      reason: 'zero_file_actions',
    });

    const response = await request(app.getHttpServer())
      .post(publicConfirmPath)
      .set('Cookie', 'aisandbox_session=owner-session')
      .send({ applyStatus: 'applied', totalActions: 0, successCount: 0 })
      .expect(200);

    expect(response.body.triggered).toBe(false);
    expect(response.body.reason).toBe('zero_file_actions');
  });

  it('forwards a success-count mismatch to existing deferred deduction without charging', async () => {
    usageLedgerService.triggerBuildApplyDeduction.mockResolvedValue({
      triggered: false,
      reason: 'partial_apply',
    });

    const response = await request(app.getHttpServer())
      .post(publicConfirmPath)
      .set('Cookie', 'aisandbox_session=owner-session')
      .send({ applyStatus: 'applied', totalActions: 2, successCount: 1 })
      .expect(200);

    expect(response.body.triggered).toBe(false);
    expect(response.body.reason).toBe('partial_apply');
  });

  it('reaches existing deferred deduction once for a qualifying confirmation', async () => {
    await request(app.getHttpServer())
      .post(publicConfirmPath)
      .set('Cookie', 'aisandbox_session=owner-session')
      .send(qualifyingBody)
      .expect(200);

    expect(usageLedgerService.triggerBuildApplyDeduction).toHaveBeenCalledTimes(1);
    expect(usageLedgerService.triggerBuildApplyDeduction).toHaveBeenCalledWith(
      executionId,
      expect.objectContaining(qualifyingBody),
    );
  });

  it('keeps duplicate public confirmation idempotent and does not invent a second deduction path', async () => {
    usageLedgerService.triggerBuildApplyDeduction
      .mockResolvedValueOnce({ triggered: true, reason: 'completed' })
      .mockResolvedValueOnce({ triggered: true, reason: 'completed' });

    const first = await request(app.getHttpServer())
      .post(publicConfirmPath)
      .set('Cookie', 'aisandbox_session=owner-session')
      .send(qualifyingBody)
      .expect(200);
    const second = await request(app.getHttpServer())
      .post(publicConfirmPath)
      .set('Cookie', 'aisandbox_session=owner-session')
      .send(qualifyingBody)
      .expect(200);

    expect(first.body.triggered).toBe(true);
    expect(second.body.triggered).toBe(true);
    expect(usageLedgerService.triggerBuildApplyDeduction).toHaveBeenCalledTimes(2);
    expect(usageLedgerService.triggerBuildApplyDeduction.mock.calls[0][0]).toBe(executionId);
    expect(usageLedgerService.triggerBuildApplyDeduction.mock.calls[1][0]).toBe(executionId);
  });

  it('keeps existing public GET /api/ai/executions/:executionId registered', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/ai/executions/${executionId}`)
      .set('Cookie', 'aisandbox_session=owner-session')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        executionId,
        status: 'completed',
      }),
    );
    expect(usageLedgerService.triggerBuildApplyDeduction).not.toHaveBeenCalled();
  });

  it('keeps existing public POST /api/ai/executions/:executionId/cancel registered', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/ai/executions/${executionId}/cancel`)
      .set('Cookie', 'aisandbox_session=owner-session')
      .expect(201);

    expect(response.body).toEqual({
      executionId,
      status: 'cancel_requested',
    });
    expect(executionResultService.requestCancel).toHaveBeenCalledWith(executionId);
    expect(usageLedgerService.triggerBuildApplyDeduction).not.toHaveBeenCalled();
  });

  it('keeps the internal confirm-build-apply route INTERNAL_SERVICE_KEY protected', async () => {
    await request(app.getHttpServer())
      .post(internalConfirmPath)
      .send(qualifyingBody)
      .expect(401);

    const allowed = await request(app.getHttpServer())
      .post(internalConfirmPath)
      .set('X-Internal-Service-Key', internalKey)
      .send(qualifyingBody)
      .expect(200);

    expect(allowed.body).toEqual({
      executionId,
      triggered: true,
      reason: 'completed',
    });
  });

  it('does not introduce Stripe, payment, retry, or checkpoint behavior on the public confirm route', () => {
    const fs = require('fs');
    const path = require('path');
    const controllerSource = fs.readFileSync(
      path.join(__dirname, '..', 'ai-execution.controller.ts'),
      'utf-8',
    );
    const methodStart = controllerSource.indexOf(
      "@Post('executions/:executionId/confirm-build-apply')",
    );
    const streamStart = controllerSource.indexOf("@Sse('executions/:executionId/stream')");

    expect(methodStart).toBeGreaterThan(-1);
    expect(streamStart).toBeGreaterThan(methodStart);

    const confirmMethod = controllerSource.slice(methodStart, streamStart);
    expect(confirmMethod).toContain('SessionOrApiKeyAuthGuard');
    expect(confirmMethod).toContain('ConfirmBuildApplyDto');
    expect(confirmMethod).toContain('triggerBuildApplyDeduction');
    expect(confirmMethod).not.toMatch(/INTERNAL_SERVICE_KEY/);
    expect(confirmMethod).not.toMatch(/X-Internal-Service-Key/);
    expect(confirmMethod).not.toMatch(/stripe/i);
    expect(confirmMethod).not.toMatch(/payment/i);
    expect(confirmMethod).not.toMatch(/checkpoint/i);
    expect(confirmMethod).not.toMatch(/retry/i);
    expect(confirmMethod).not.toMatch(/setTimeout/);
  });
});
