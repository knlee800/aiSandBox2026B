import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { ChatMessageController } from '../chat-messages/chat-message.controller';
import { ChatMessageService } from '../chat-messages/chat-message.service';
import { ChatMessageRole } from '../entities/chat-message-role.enum';
import { InternalCollaborationController } from '../orchestration/internal-collaboration.controller';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { InternalWorkspaceFilesController } from '../sessions/internal-workspace-files.controller';
import { SessionService } from '../sessions/session.service';
import { SnapshotPersistenceService } from '../snapshots/snapshot-persistence.service';
import { RuntimeController } from '../runtime/runtime.controller';
import { RuntimeService } from '../runtime/runtime.service';
import { TokenUsageController } from '../token-usage/token-usage.controller';
import { TokenUsageService } from '../token-usage/token-usage.service';
import { InternalServiceAuthGuard } from './internal-service-auth.guard';

describe('InternalServiceAuthGuard HTTP prefix protection (AUTH-GUARD-01)', () => {
  let app: INestApplication;
  let containerManager: { readSessionFile: jest.Mock };
  let sessionService: { getSessionById: jest.Mock };
  let snapshotPersistence: { saveSnapshot: jest.Mock };
  let chatMessageService: { addMessageBySession: jest.Mock };
  let tokenUsageService: { recordTokenUsage: jest.Mock };
  let runtimeService: { getMetrics: jest.Mock };
  let orchestrationService: {
    createCollaborationRun: jest.Mock;
    createPendingReferral: jest.Mock;
    createAndStartReferral: jest.Mock;
    approveReferral: jest.Mock;
    rejectReferral: jest.Mock;
    getCollaborationRunWithReferrals: jest.Mock;
  };

  const originalInternalServiceKey = process.env.INTERNAL_SERVICE_KEY;
  const internalKey = 'auth-guard-01-test-key';
  const wrongKey = 'auth-guard-01-wrong-key';

  const workspaceReadPath = '/api/internal/workspace/s1/read?path=a';
  const chatPath = '/api/chat-messages/add-by-session';
  const tokenPath = '/api/token-usage/record';
  const runtimePath = '/api/runtime/metrics';

  const chatBody = {
    sessionId: 'session-1',
    role: ChatMessageRole.USER,
    content: 'hello',
    tokensUsed: 3,
  };
  const tokenBody = {
    sessionId: 'session-1',
    model: 'test-model',
    inputTokens: 1,
    outputTokens: 2,
  };
  const metricsBody = {
    activeSessionCount: 0,
    runningContainerCount: 0,
  };

  beforeEach(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;

    containerManager = {
      readSessionFile: jest.fn().mockResolvedValue({ path: 'a', content: 'ok' }),
    };
    sessionService = {
      getSessionById: jest.fn(),
    };
    snapshotPersistence = {
      saveSnapshot: jest.fn(),
    };
    chatMessageService = {
      addMessageBySession: jest.fn().mockResolvedValue({ id: 'message-1' }),
    };
    tokenUsageService = {
      recordTokenUsage: jest.fn().mockResolvedValue(undefined),
    };
    runtimeService = {
      getMetrics: jest.fn().mockResolvedValue(metricsBody),
    };
    orchestrationService = {
      createCollaborationRun: jest.fn(),
      createPendingReferral: jest.fn(),
      createAndStartReferral: jest.fn(),
      approveReferral: jest.fn(),
      rejectReferral: jest.fn(),
      getCollaborationRunWithReferrals: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        InternalWorkspaceFilesController,
        InternalCollaborationController,
        ChatMessageController,
        TokenUsageController,
        RuntimeController,
      ],
      providers: [
        { provide: APP_GUARD, useClass: InternalServiceAuthGuard },
        { provide: ContainerManagerHttpClient, useValue: containerManager },
        { provide: SessionService, useValue: sessionService },
        { provide: SnapshotPersistenceService, useValue: snapshotPersistence },
        { provide: ChatMessageService, useValue: chatMessageService },
        { provide: TokenUsageService, useValue: tokenUsageService },
        { provide: RuntimeService, useValue: runtimeService },
        { provide: OrchestrationService, useValue: orchestrationService },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    if (originalInternalServiceKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalInternalServiceKey;
    }
    if (app) {
      await app.close();
    }
    jest.clearAllMocks();
  });

  function send(
    method: 'get' | 'post',
    path: string,
    body?: Record<string, unknown>,
    key?: string,
  ) {
    const http = request(app.getHttpServer());
    const req = method === 'get' ? http.get(path) : http.post(path);
    if (key !== undefined) {
      req.set('X-Internal-Service-Key', key);
    }
    if (body !== undefined) {
      req.send(body);
    }
    return req;
  }

  it('refuses workspace reads with no key for any letter case and does not call the client', async () => {
    const paths = [
      workspaceReadPath,
      '/API/INTERNAL/workspace/s1/read?path=a',
      '/api/Internal/workspace/s1/read?path=a',
    ];

    for (const path of paths) {
      await send('get', path).expect(401);
    }

    expect(containerManager.readSessionFile).not.toHaveBeenCalled();
  });

  it('refuses collaboration routes with no key for any letter case and does not call the coordinator', async () => {
    const paths = [
      '/api/internal/collaboration/runs',
      '/API/INTERNAL/collaboration/runs',
      '/api/Internal/collaboration/runs',
    ];

    for (const path of paths) {
      await send('post', path, { userId: 'user-01' }).expect(401);
    }

    await send('get', '/API/INTERNAL/collaboration/runs/run-1').expect(401);
    await send('post', '/api/Internal/collaboration/runs/run-1/referrals', {
      prompt: 'review',
    }).expect(401);
    await send(
      'post',
      '/api/Internal/collaboration/runs/run-1/referrals/ref-1/approve',
      { decidedBy: 'keith' },
    ).expect(401);
    await send(
      'post',
      '/API/INTERNAL/collaboration/runs/run-1/referrals/ref-1/reject',
      { decidedBy: 'keith', reason: 'no' },
    ).expect(401);
    await send(
      'post',
      '/api/INTERNAL/collaboration/runs/RUN-1/referrals/REF-1/approve',
      { decidedBy: 'keith' },
    ).expect(401);

    expect(orchestrationService.createCollaborationRun).not.toHaveBeenCalled();
    expect(orchestrationService.createPendingReferral).not.toHaveBeenCalled();
    expect(orchestrationService.createAndStartReferral).not.toHaveBeenCalled();
    expect(orchestrationService.approveReferral).not.toHaveBeenCalled();
    expect(orchestrationService.rejectReferral).not.toHaveBeenCalled();
    expect(orchestrationService.getCollaborationRunWithReferrals).not.toHaveBeenCalled();
  });

  it('refuses save-project-snapshot with no key and does not save', async () => {
    await send('post', '/api/internal/workspace/s1/save-project-snapshot').expect(401);

    expect(snapshotPersistence.saveSnapshot).not.toHaveBeenCalled();
    expect(sessionService.getSessionById).not.toHaveBeenCalled();
  });

  it('allows the lowercase workspace read with the correct key', async () => {
    const response = await send('get', workspaceReadPath, undefined, internalKey).expect(200);

    expect(response.body).toEqual({ path: 'a', content: 'ok' });
    expect(containerManager.readSessionFile).toHaveBeenCalledTimes(1);
    expect(containerManager.readSessionFile).toHaveBeenCalledWith('s1', 'a');
  });

  it('refuses chat, token-usage, and runtime routes without a key, with a wrong key, and in a changed-case form', async () => {
    const cases: Array<{
      method: 'get' | 'post';
      path: string;
      changedCasePath: string;
      body?: Record<string, unknown>;
      mock: jest.Mock;
    }> = [
      {
        method: 'post',
        path: chatPath,
        changedCasePath: '/API/CHAT-MESSAGES/add-by-session',
        body: chatBody,
        mock: chatMessageService.addMessageBySession,
      },
      {
        method: 'post',
        path: tokenPath,
        changedCasePath: '/api/Token-Usage/record',
        body: tokenBody,
        mock: tokenUsageService.recordTokenUsage,
      },
      {
        method: 'get',
        path: runtimePath,
        changedCasePath: '/API/RUNTIME/metrics',
        mock: runtimeService.getMetrics,
      },
    ];

    for (const entry of cases) {
      await send(entry.method, entry.path, entry.body).expect(401);
      await send(entry.method, entry.path, entry.body, wrongKey).expect(401);
      await send(entry.method, entry.changedCasePath, entry.body).expect(401);
      expect(entry.mock).not.toHaveBeenCalled();
    }
  });

  it('does not treat /api/collaboration as an internal route', async () => {
    const response = await send('post', '/api/collaboration/runs', {
      sessionId: 'session-1',
      task: 'look at the project',
    });

    expect(response.status).not.toBe(401);
    expect(orchestrationService.createCollaborationRun).not.toHaveBeenCalled();
    expect(orchestrationService.createPendingReferral).not.toHaveBeenCalled();
  });

  it('reaches chat, token-usage, and runtime handlers with the correct key', async () => {
    const chatResponse = await send('post', chatPath, chatBody, internalKey).expect(201);
    expect(chatResponse.body).toEqual({ id: 'message-1' });
    expect(chatMessageService.addMessageBySession).toHaveBeenCalledTimes(1);
    expect(chatMessageService.addMessageBySession).toHaveBeenCalledWith({
      sessionId: 'session-1',
      role: ChatMessageRole.USER,
      content: 'hello',
      tokensUsed: 3,
    });

    await send('post', tokenPath, tokenBody, internalKey).expect(201);
    expect(tokenUsageService.recordTokenUsage).toHaveBeenCalledTimes(1);
    expect(tokenUsageService.recordTokenUsage).toHaveBeenCalledWith({
      sessionId: 'session-1',
      chatMessageId: undefined,
      model: 'test-model',
      inputTokens: 1,
      outputTokens: 2,
    });

    const runtimeResponse = await send('get', runtimePath, undefined, internalKey).expect(200);
    expect(runtimeResponse.body).toEqual(metricsBody);
    expect(runtimeService.getMetrics).toHaveBeenCalledTimes(1);
  });
});
