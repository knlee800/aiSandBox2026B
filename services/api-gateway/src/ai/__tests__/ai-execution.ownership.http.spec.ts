import { INestApplication, ValidationPipe } from '@nestjs/common';
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
import { ExecutionSafetyGuard } from '../../safety/execution-safety.guard';
import { LaunchGuard } from '../../launch/launch.guard';
import { AbortGuard } from '../../abort/abort.guard';
import { IdempotencyGuard } from '../idempotency.guard';
import { CreditBalanceGuard } from '../../billing/credit-balance.guard';
import { QuotaGuard } from '../../quota/quota.guard';
import { TokenQuotaGuard } from '../../quota/token-quota.guard';
import { RateLimitGuard } from '../../guards/rate-limit.guard';

describe('AIExecutionController HTTP execution ownership (AUTH-OWNER-01)', () => {
  let app: INestApplication;
  let executionResultService: {
    getExecution: jest.Mock;
    requestCancel: jest.Mock;
  };
  let executionStreamService: {
    subscribe: jest.Mock;
    unsubscribe: jest.Mock;
  };

  const ownerUserId = 'user-owner';
  const otherUserId = 'user-other';
  const executionId = 'exec-owner-1';
  const cancelPath = `/api/ai/executions/${executionId}/cancel`;
  const streamPath = `/api/ai/executions/${executionId}/stream`;

  function ownedExecution(overrides: Record<string, unknown> = {}) {
    return {
      execution_id: executionId,
      user_id: ownerUserId,
      execution_status: 'running',
      provider: 'xai',
      model: 'grok-4.5',
      tokens_used: null,
      metadata: {},
      ...overrides,
    };
  }

  beforeEach(async () => {
    executionResultService = {
      getExecution: jest.fn().mockResolvedValue(ownedExecution()),
      requestCancel: jest.fn().mockResolvedValue(true),
    };
    executionStreamService = {
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
    };

    const unusedExecuteGuard = { canActivate: () => true };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIExecutionController],
      providers: [
        SessionOrApiKeyAuthGuard,
        { provide: ApiKeyAuthGuard, useValue: { canActivate: jest.fn() } },
        {
          provide: AuthService,
          useValue: {
            validateSessionToken: jest.fn().mockImplementation(async (token: string) => {
              if (token === 'owner-session') {
                return { id: ownerUserId };
              }
              if (token === 'other-session') {
                return { id: otherUserId };
              }
              return null;
            }),
          },
        },
        { provide: UsageLedgerService, useValue: { writeExecutionIntent: jest.fn() } },
        { provide: ExecutionResultService, useValue: executionResultService },
        { provide: ExecutionStreamService, useValue: executionStreamService },
        { provide: GlobalSafetyLimitService, useValue: { checkAndRecord: jest.fn() } },
        { provide: QueueService, useValue: { enqueueExecution: jest.fn() } },
        { provide: UserAiInstructionsService, useValue: { getByUserId: jest.fn() } },
        { provide: ProjectAiContextService, useValue: { getByProjectId: jest.fn() } },
        { provide: SessionService, useValue: { getSessionById: jest.fn() } },
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
    if (app) {
      await app.close();
    }
    jest.clearAllMocks();
  });

  it('returns 404 for another user cancelling and does not request cancellation', async () => {
    const response = await request(app.getHttpServer())
      .post(cancelPath)
      .set('Cookie', 'aisandbox_session=other-session')
      .expect(404);

    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body.message).toBe('Execution not found');
    expect(executionResultService.getExecution).toHaveBeenCalledWith(executionId);
    expect(executionResultService.requestCancel).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown execution cancel and does not request cancellation', async () => {
    executionResultService.getExecution.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post(cancelPath)
      .set('Cookie', 'aisandbox_session=owner-session')
      .expect(404);

    expect(response.body.message).toBe('Execution not found');
    expect(executionResultService.requestCancel).not.toHaveBeenCalled();
  });

  it('lets the owner request cancellation', async () => {
    const response = await request(app.getHttpServer())
      .post(cancelPath)
      .set('Cookie', 'aisandbox_session=owner-session')
      .expect(201);

    expect(response.body).toEqual({
      executionId,
      status: 'cancel_requested',
    });
    expect(executionResultService.getExecution.mock.invocationCallOrder[0]).toBeLessThan(
      executionResultService.requestCancel.mock.invocationCallOrder[0],
    );
    expect(executionResultService.requestCancel).toHaveBeenCalledWith(executionId);
  });

  it('returns 409 when the owner cannot cancel', async () => {
    executionResultService.requestCancel.mockResolvedValue(false);

    const response = await request(app.getHttpServer())
      .post(cancelPath)
      .set('Cookie', 'aisandbox_session=owner-session')
      .expect(409);

    expect(response.body.message).toBe('Execution cannot be cancelled');
    expect(executionResultService.requestCancel).toHaveBeenCalledWith(executionId);
  });

  it('returns a plain 404 for another user streaming and does not subscribe', async () => {
    const response = await request(app.getHttpServer())
      .get(streamPath)
      .set('Cookie', 'aisandbox_session=other-session')
      .expect(404)
      .expect('Content-Type', /json/);

    expect(response.headers['content-type']).not.toContain('text/event-stream');
    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        message: 'Execution not found',
      }),
    );
    expect(executionStreamService.subscribe).not.toHaveBeenCalled();
  });

  it('returns a plain 404 for an unknown execution stream and does not subscribe', async () => {
    executionResultService.getExecution.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get(streamPath)
      .set('Cookie', 'aisandbox_session=owner-session')
      .expect(404)
      .expect('Content-Type', /json/);

    expect(response.headers['content-type']).not.toContain('text/event-stream');
    expect(response.body.message).toBe('Execution not found');
    expect(executionStreamService.subscribe).not.toHaveBeenCalled();
  });

  it('streams tokens to the owner and unsubscribes the same callback when the connection closes', async () => {
    let captured: ((token: string) => void) | undefined;
    executionStreamService.subscribe.mockImplementation(
      async (_id: string, onMessage: (token: string) => void) => {
        captured = onMessage;
      },
    );

    let statusCode = 0;
    let contentType = '';
    let streamed = '';
    const body = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `timed out waiting for the owner stream: ${JSON.stringify(streamed)} unsubscribeCalls=${executionStreamService.unsubscribe.mock.calls.length}`,
          ),
        );
      }, 3000);
      let closed = false;

      const pending = request(app.getHttpServer())
        .get(streamPath)
        .set('Cookie', 'aisandbox_session=owner-session')
        .parse((res, callback) => {
          statusCode = res.statusCode ?? 0;
          contentType = String(res.headers['content-type'] ?? '');
          res.on('data', (chunk: Buffer) => {
            streamed += chunk.toString('utf8');
            if (!closed && streamed.includes('owner-token')) {
              closed = true;
              (res as unknown as { destroy: () => void }).destroy();
              callback(null, streamed);
            }
          });
          res.on('error', () => {
            // Destroying the response after the token closes the server stream.
          });
          setImmediate(() => {
            if (!captured) {
              clearTimeout(timeout);
              reject(new Error('subscribe was not called before the stream opened'));
              return;
            }
            captured('owner-token');
          });
        });

      pending.on('error', () => {
        // The close after a delivered token surfaces as an abort.
      });
      pending.end((error) => {
        if (!streamed.includes('owner-token')) {
          clearTimeout(timeout);
          reject(error ?? new Error(`stream ended without the owner token: ${JSON.stringify(streamed)}`));
          return;
        }
        const started = Date.now();
        const waitForUnsubscribe = () => {
          if (executionStreamService.unsubscribe.mock.calls.length >= 1) {
            clearTimeout(timeout);
            resolve(streamed);
            return;
          }
          if (Date.now() - started > 1000) {
            clearTimeout(timeout);
            reject(new Error(`unsubscribe was not called after close: ${error ? error.message : 'no end error'}`));
            return;
          }
          setTimeout(waitForUnsubscribe, 10);
        };
        waitForUnsubscribe();
      });
    });

    expect(statusCode).toBe(200);
    expect(contentType).toContain('text/event-stream');
    expect(body).toContain('owner-token');
    expect(executionStreamService.subscribe).toHaveBeenCalledTimes(1);
    expect(captured).toEqual(expect.any(Function));
    expect(executionStreamService.unsubscribe).toHaveBeenCalledTimes(1);
    expect(executionStreamService.unsubscribe).toHaveBeenCalledWith(executionId, captured);
  });
});
