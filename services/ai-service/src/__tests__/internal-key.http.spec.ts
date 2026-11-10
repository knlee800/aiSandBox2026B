import { INestApplication, Type, ValidationPipe } from '@nestjs/common';
import { MODULE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { AppModule } from '../app.module';
import { AIExecutionController } from '../ai-execution/ai-execution.controller';
import { AIExecutionService } from '../ai-execution/ai-execution.service';
import { ConversationsController } from '../conversations/conversations.controller';
import { ConversationsService } from '../conversations/conversations.service';
import { INTERNAL_KEY_EXEMPT } from '../guards/internal-key-exempt.decorator';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';
import { QueueController } from '../internal/queue.controller';
import { MetricsController } from '../metrics/metrics.controller';
import { PrometheusMetricsController } from '../observability/metrics.controller';
import { QuotaService } from '../quota/quota.service';
import { WorkerProcessor } from '../worker/worker.processor';

/**
 * AI-SERVICE-AUTH-01: HTTP tests over a real Nest app on a random loopback
 * port, using Node's built-in fetch (no supertest).
 */

const internalKey = 'ai-service-auth-01-http-key';
const wrongKey = 'ai-service-auth-01-http-kez';

type RouteCase = {
  name: string;
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  mock: () => jest.Mock;
};

describe('ai-service internal key over HTTP (AI-SERVICE-AUTH-01)', () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  let app: INestApplication;
  let baseUrl: string;

  const aiExecutionService = { execute: jest.fn() };
  const conversationsService = {
    getConversation: jest.fn(),
    getMessages: jest.fn(),
    clearConversation: jest.fn(),
    getTokenUsage: jest.fn(),
  };
  const quotaService = { getQuotaStatus: jest.fn() };
  const worker = { getMetrics: jest.fn() };
  const queue = { getJobCounts: jest.fn() };

  const guardedRoutes: RouteCase[] = [
    {
      name: 'POST /api/execute',
      method: 'POST',
      path: '/api/execute',
      body: { sessionId: 's1', conversationId: 'c1', userId: 'u1', prompt: 'hi' },
      mock: () => aiExecutionService.execute,
    },
    {
      name: 'GET /api/conversations/:sessionId',
      method: 'GET',
      path: '/api/conversations/s1',
      mock: () => conversationsService.getConversation,
    },
    {
      name: 'GET /api/conversations/:sessionId/messages',
      method: 'GET',
      path: '/api/conversations/s1/messages',
      mock: () => conversationsService.getMessages,
    },
    {
      name: 'GET /api/conversations/:sessionId/usage',
      method: 'GET',
      path: '/api/conversations/s1/usage',
      mock: () => conversationsService.getTokenUsage,
    },
    {
      name: 'GET /api/conversations/:sessionId/quota-status',
      method: 'GET',
      path: '/api/conversations/s1/quota-status',
      mock: () => quotaService.getQuotaStatus,
    },
    {
      name: 'DELETE /api/conversations/:sessionId',
      method: 'DELETE',
      path: '/api/conversations/s1',
      mock: () => conversationsService.clearConversation,
    },
    {
      name: 'GET /api/internal/metrics',
      method: 'GET',
      path: '/api/internal/metrics',
      mock: () => worker.getMetrics,
    },
    {
      name: 'GET /api/internal/queue/stats',
      method: 'GET',
      path: '/api/internal/queue/stats',
      mock: () => queue.getJobCounts,
    },
  ];

  function send(route: { method: string; path: string; body?: unknown }, key?: string) {
    const headers: Record<string, string> = {};
    if (route.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (key !== undefined) {
      headers['x-internal-service-key'] = key;
    }
    return fetch(`${baseUrl}${route.path}`, {
      method: route.method,
      headers,
      body: route.body === undefined ? undefined : JSON.stringify(route.body),
    });
  }

  function resetMocks() {
    jest.clearAllMocks();
    aiExecutionService.execute.mockResolvedValue({ output: 'ok', tokensUsed: 1, model: 'stub' });
    conversationsService.getConversation.mockResolvedValue({ id: 'c1' });
    conversationsService.getMessages.mockResolvedValue([]);
    conversationsService.clearConversation.mockResolvedValue({ cleared: true });
    conversationsService.getTokenUsage.mockResolvedValue({ total: 0 });
    quotaService.getQuotaStatus.mockResolvedValue({ ok: true });
    worker.getMetrics.mockReturnValue({ jobs: 0 });
    queue.getJobCounts.mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    });
  }

  beforeAll(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;

    const moduleRef = await Test.createTestingModule({
      controllers: [
        AIExecutionController,
        ConversationsController,
        MetricsController,
        QueueController,
        PrometheusMetricsController,
      ],
      providers: [
        { provide: AIExecutionService, useValue: aiExecutionService },
        { provide: ConversationsService, useValue: conversationsService },
        { provide: QuotaService, useValue: quotaService },
        { provide: WorkerProcessor, useValue: worker },
        { provide: 'AI_EXECUTION_QUEUE', useValue: queue },
        // Same registration as AppModule.
        { provide: APP_GUARD, useClass: InternalServiceAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    // Same pipe and prefix as main.ts.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api', { exclude: ['metrics'] });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app?.close();
    if (originalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
    }
  });

  beforeEach(() => resetMocks());

  describe.each(guardedRoutes)('$name', (route) => {
    it('returns 401 without the key and never calls the service', async () => {
      const response = await send(route);
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ statusCode: 401, message: 'Unauthorized' });
      expect(route.mock()).not.toHaveBeenCalled();
    });

    it('returns 401 with a wrong key and never calls the service', async () => {
      const response = await send(route, wrongKey);
      expect(response.status).toBe(401);
      expect(route.mock()).not.toHaveBeenCalled();
    });

    it('returns 401 with an empty key and never calls the service', async () => {
      const response = await send(route, '');
      expect(response.status).toBe(401);
      expect(route.mock()).not.toHaveBeenCalled();
    });

    it('reaches its handler with the right key', async () => {
      const response = await send(route, internalKey);
      expect(response.status).toBeLessThan(300);
      await response.text();
      expect(route.mock()).toHaveBeenCalledTimes(1);
    });
  });

  it('refuses a header sent twice', async () => {
    const headers = new Headers();
    headers.append('x-internal-service-key', internalKey);
    headers.append('x-internal-service-key', internalKey);
    const response = await fetch(`${baseUrl}/api/internal/queue/stats`, { headers });
    expect(response.status).toBe(401);
    expect(queue.getJobCounts).not.toHaveBeenCalled();
  });

  it.each([
    ['POST', '/API/EXECUTE'],
    ['POST', '/Api/Execute'],
    ['POST', '/api/execute/'],
    ['GET', '/API/INTERNAL/QUEUE/STATS'],
    ['GET', '/api/Conversations/s1'],
    ['DELETE', '/API/CONVERSATIONS/s1'],
  ])('%s %s never reaches a handler without the key', async (method, path) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({ prompt: 'hi' }) : undefined,
    });
    expect([401, 404]).toContain(response.status);
    expect(aiExecutionService.execute).not.toHaveBeenCalled();
    expect(queue.getJobCounts).not.toHaveBeenCalled();
    expect(conversationsService.getConversation).not.toHaveBeenCalled();
    expect(conversationsService.clearConversation).not.toHaveBeenCalled();
  });

  it('GET /api/conversations (health) is open without the key', async () => {
    const response = await fetch(`${baseUrl}/api/conversations`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', service: 'conversations' });
  });

  it('CM-CLEANUP-01: POST /api/messages/chat (legacy chat path, removed) is route-not-found with the key', async () => {
    const response = await send(
      {
        method: 'POST',
        path: '/api/messages/chat',
        body: { sessionId: 's1', userId: 'u1', message: 'hi', provider: 'stub' },
      },
      internalKey,
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      statusCode: 404,
      message: 'Cannot POST /api/messages/chat',
    });
    expect(aiExecutionService.execute).not.toHaveBeenCalled();
  });

  it('GET /metrics is open without the key', async () => {
    const response = await fetch(`${baseUrl}/metrics`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
  });

  it('the open routes stay open with a wrong key', async () => {
    expect((await fetch(`${baseUrl}/api/conversations`, {
      headers: { 'x-internal-service-key': wrongKey },
    })).status).toBe(200);
    expect((await fetch(`${baseUrl}/metrics`, {
      headers: { 'x-internal-service-key': wrongKey },
    })).status).toBe(200);
  });
});

describe('ai-service route inventory (AI-SERVICE-AUTH-01)', () => {
  type Route = { route: string; exempt: boolean };

  function moduleClass(entry: unknown): unknown {
    if (entry && typeof entry === 'object' && 'forwardRef' in entry) {
      return (entry as { forwardRef: () => unknown }).forwardRef();
    }
    return entry;
  }

  function collectControllers(): Set<Type<unknown>> {
    const seen = new Set<unknown>();
    const controllers = new Set<Type<unknown>>();
    const visit = (raw: unknown) => {
      const entry = moduleClass(raw);
      if (!entry || seen.has(entry)) {
        return;
      }
      seen.add(entry);
      const dynamic =
        typeof entry === 'object' && 'module' in (entry as object)
          ? (entry as { module: unknown; imports?: unknown[]; controllers?: Type<unknown>[] })
          : undefined;
      const target = dynamic ? dynamic.module : entry;
      const fromMeta = (key: string): unknown[] =>
        typeof target === 'function' ? (Reflect.getMetadata(key, target) ?? []) : [];
      for (const controller of [
        ...fromMeta(MODULE_METADATA.CONTROLLERS),
        ...(dynamic?.controllers ?? []),
      ]) {
        controllers.add(controller as Type<unknown>);
      }
      for (const child of [...fromMeta(MODULE_METADATA.IMPORTS), ...(dynamic?.imports ?? [])]) {
        visit(child);
      }
    };
    visit(AppModule);
    return controllers;
  }

  const methodNames: Record<number, string> = {
    0: 'GET',
    1: 'POST',
    2: 'PUT',
    3: 'DELETE',
    4: 'PATCH',
    5: 'ALL',
    6: 'OPTIONS',
    7: 'HEAD',
  };

  function joinPath(prefix: string, controllerPath: string, handlerPath: string): string {
    const parts = [prefix, controllerPath, handlerPath]
      .map((part) => part.replace(/^\/+|\/+$/g, ''))
      .filter((part) => part.length > 0);
    return `/${parts.join('/')}`;
  }

  function inventory(): Route[] {
    const routes: Route[] = [];
    for (const controller of collectControllers()) {
      expect(Reflect.getMetadata(INTERNAL_KEY_EXEMPT, controller)).toBeUndefined();
      const controllerPath = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
      const proto = controller.prototype;
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === 'constructor') continue;
        const handler = proto[name];
        if (typeof handler !== 'function') continue;
        const handlerPath = Reflect.getMetadata(PATH_METADATA, handler);
        const method = Reflect.getMetadata(METHOD_METADATA, handler);
        if (handlerPath === undefined || method === undefined) continue;
        const prefix = controller === PrometheusMetricsController ? '' : 'api';
        routes.push({
          route: `${methodNames[method]} ${joinPath(prefix, controllerPath, String(handlerPath))}`,
          exempt: Reflect.getMetadata(INTERNAL_KEY_EXEMPT, handler) === true,
        });
      }
    }
    return routes.sort((a, b) => a.route.localeCompare(b.route));
  }

  it('registers InternalServiceAuthGuard as the global APP_GUARD in AppModule', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) as unknown[];
    expect(providers).toContainEqual({ provide: APP_GUARD, useClass: InternalServiceAuthGuard });
  });

  it('opens exactly the two exempt handlers', () => {
    expect(
      inventory()
        .filter((r) => r.exempt)
        .map((r) => r.route),
    ).toEqual(['GET /api/conversations', 'GET /metrics']);
  });

  it('guards every other route in AppModule', () => {
    expect(
      inventory()
        .filter((r) => !r.exempt)
        .map((r) => r.route),
    ).toEqual(
      [
        'DELETE /api/conversations/:sessionId',
        'GET /api/conversations/:sessionId',
        'GET /api/conversations/:sessionId/messages',
        'GET /api/conversations/:sessionId/quota-status',
        'GET /api/conversations/:sessionId/usage',
        'GET /api/internal/metrics',
        'GET /api/internal/queue/stats',
        'POST /api/execute',
      ].sort((a, b) => a.localeCompare(b)),
    );
  });
});
