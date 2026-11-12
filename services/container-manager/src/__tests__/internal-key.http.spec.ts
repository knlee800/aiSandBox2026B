import 'reflect-metadata';
import {
  INestApplication,
  Module,
  Provider,
  RequestMethod,
  Type,
  ValidationPipe,
} from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { request as httpRequest } from 'http';
import { AddressInfo } from 'net';

// Services are never constructed here (every provider is a mock), but their
// modules are imported through AppModule. Keep the native SQLite binding out.
jest.mock('better-sqlite3', () => jest.fn());

import { AppModule } from '../app.module';
import { HealthController } from '../health/health.controller';
import { INTERNAL_KEY_EXEMPT } from '../guards/internal-key-exempt.decorator';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';

/**
 * CM-AUTH-01: route inventory and HTTP tests over a real Nest app on a random
 * loopback port, using Node's built-in fetch (no supertest, no
 * @nestjs/testing: neither is declared by container-manager).
 *
 * Every controller reachable from AppModule is mounted with mocked services,
 * the global InternalServiceAuthGuard, the 'api' prefix and the same
 * ValidationPipe as main.ts.
 */

const internalKey = 'cm-auth-01-http-key';
const wrongKey = 'cm-auth-01-http-kez';

type Route = {
  controller: Type<unknown>;
  handler: string;
  method: string;
  /** Full serving path as Nest registers it, with the global prefix. */
  path: string;
};

const METHOD_NAMES: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.ALL]: 'ALL',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
};

function collectControllers(
  mod: unknown,
  seen = new Set<unknown>(),
  out: Type<unknown>[] = [],
): Type<unknown>[] {
  if (!mod || seen.has(mod)) {
    return out;
  }
  seen.add(mod);
  const target = (mod as { module?: unknown }).module ?? mod;
  const dynamicControllers = ((mod as { controllers?: Type<unknown>[] }).controllers ?? []) as Type<unknown>[];
  const controllers = [
    ...((Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, target as object) ?? []) as Type<unknown>[]),
    ...dynamicControllers,
  ];
  for (const controller of controllers) {
    if (!out.includes(controller)) {
      out.push(controller);
    }
  }
  const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, target as object) ?? []) as unknown[];
  for (const imported of imports) {
    collectControllers(imported, seen, out);
  }
  return out;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function handlerNames(controller: Type<unknown>): string[] {
  return Object.getOwnPropertyNames(controller.prototype).filter((name) => {
    if (name === 'constructor') {
      return false;
    }
    const descriptor = Object.getOwnPropertyDescriptor(controller.prototype, name);
    return typeof descriptor?.value === 'function';
  });
}

function collectRoutes(controllers: Type<unknown>[]): Route[] {
  const routes: Route[] = [];
  for (const controller of controllers) {
    const base = trimSlashes(String(Reflect.getMetadata(PATH_METADATA, controller) ?? ''));
    for (const handler of handlerNames(controller)) {
      const fn = controller.prototype[handler];
      const routePath = Reflect.getMetadata(PATH_METADATA, fn);
      if (routePath === undefined) {
        continue;
      }
      const method = METHOD_NAMES[Reflect.getMetadata(METHOD_METADATA, fn) as number];
      const path = '/' + ['api', base, trimSlashes(String(routePath))].filter(Boolean).join('/');
      routes.push({ controller, handler, method, path });
    }
  }
  return routes;
}

/** A concrete request path for a route pattern. */
function concretePath(pattern: string): string {
  return pattern
    .replace(/:[A-Za-z]+/g, 'p1')
    .replace(/\/\*$/, '/x')
    .replace(/\*$/, '');
}

function methodsFor(route: Route): string[] {
  return route.method === 'ALL' ? ['GET', 'POST'] : [route.method];
}

/**
 * Every route in the service as it is served (method + full path).
 * CM-CLEANUP-01 removed six uncalled routes: ALL /api/previews/:sessionId/*,
 * GET /api/previews/:sessionId/health, ALL /api/internal-previews/proxy/:sessionId/*,
 * POST /api/executor/:sessionId/execute, GET /api/executor/commands and
 * GET /api/sessions (a second health reply).
 * CM-SYMLINK-01 removed the six uncalled host-side /api/files/:sessionId/*
 * routes (list, read, write, delete, mkdir, search), which followed symlinks.
 * CM-GIT-HOST-01 removed POST /api/sessions (create), POST /api/git/:sessionId/init
 * and GET /api/git/:sessionId/history: uncalled, and they ran git on the host.
 * BROWSER-SMOKE-02 removed POST /api/internal/sessions/:id/previews (the
 * internal preview port register route): uncalled, as the preview service
 * fills the registry itself.
 * CM-CLEANUP-02 removed DELETE /api/internal/sessions/:id/container (the
 * internal container removal route): uncalled, as stop and delete remove the
 * container themselves.
 */
const EXPECTED_INVENTORY = [
  'POST /api/sessions/:id/start',
  'GET /api/sessions/:id',
  'GET /api/sessions/user/:userId',
  'POST /api/sessions/:id/stop',
  'DELETE /api/sessions/:id',
  'POST /api/internal/sessions/:id/start',
  'POST /api/internal/sessions/:id/exec',
  'GET /api/internal/sessions/:id/files',
  'POST /api/internal/sessions/:id/files',
  'DELETE /api/internal/sessions/:id/files',
  'POST /api/internal/sessions/:id/files/search',
  'GET /api/internal/sessions/:id/dirs',
  'GET /api/internal/sessions/:id/stat',
  'POST /api/internal/sessions/:id/browser-smoke',
  'POST /api/git/:sessionId/commit',
  'POST /api/git/:sessionId/revert',
  'GET /api/git/:sessionId/checkpoints',
  'GET /api/git/:sessionId/diff/:commitHash',
  'POST /api/internal/checkpoint-history/:sessionId/save',
  'POST /api/internal/checkpoint-history/:sessionId/restore',
  'GET /api/internal/git/:sessionId/worktree-diff/:commitHash',
  'POST /api/preview/:sessionId/start',
  'POST /api/preview/:sessionId/stop',
  'DELETE /api/preview/:sessionId/stop',
  'GET /api/preview/:sessionId/status',
  'GET /api/preview/:sessionId/proxy*',
  // F2 (fixed by CM-PREFIX-01): these four controllers now declare 'internal/...' under the global
  // prefix 'api' and serve at /api/internal/...
  'GET /api/internal/usage-aggregations/tokens/session/:sessionId',
  'GET /api/internal/usage-aggregations/tokens/user/:userId',
  'GET /api/internal/usage-aggregations/tokens/user/:userId/by-provider',
  'GET /api/internal/usage-aggregations/governance-events/by-reason',
  'GET /api/internal/usage-aggregations/governance-events/by-user',
  'GET /api/internal/usage-aggregations/sessions/terminations',
  'GET /api/internal/usage-aggregations/user/:userId/summary',
  'GET /api/internal/quota-evaluations/user/:userId',
  'GET /api/internal/quota-evaluations/user/:userId/current-month',
  'GET /api/internal/quota-evaluations/user/:userId/detailed',
  'GET /api/internal/quota-evaluations/user/:userId/exceeded',
  'GET /api/internal/quota-evaluations/user/:userId/approaching-limit',
  'GET /api/internal/quota-evaluations/limits/:userId',
  'GET /api/internal/quota-visibility/user/:userId',
  'GET /api/internal/quota-visibility/user/:userId/limits',
  'GET /api/internal/quota-visibility/user/:userId/status',
  'GET /api/internal/billing-export/user/:userId/usage',
  'GET /api/internal/billing-export/user/:userId/monthly',
  'GET /api/internal/billing-export/limits',
  'GET /api/internal/stats',
  'GET /api/health',
];

const controllers = collectControllers(AppModule);
const routes = collectRoutes(controllers);
const routeKey = (route: Route) => `${route.method} ${route.path}`;
const guardedRoutes = routes.filter((route) => route.controller !== HealthController);

describe('container-manager route inventory (CM-AUTH-01)', () => {
  it('registers InternalServiceAuthGuard as the global APP_GUARD in AppModule', () => {
    const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) ?? []) as unknown[];
    expect(providers).toContainEqual({ provide: APP_GUARD, useClass: InternalServiceAuthGuard });
  });

  it('serves exactly the expected 47 routes (46 guarded + GET /api/health)', () => {
    const actual = routes.map(routeKey);
    // One line per route, so the real serving paths (F2) show in the test log.
    console.info(`CM-AUTH-01 route inventory (${actual.length}):\n${actual.join('\n')}`);
    expect(actual.sort()).toEqual([...EXPECTED_INVENTORY].sort());
    expect(routes).toHaveLength(47);
    expect(guardedRoutes).toHaveLength(46);
  });

  it('marks exactly one handler exempt: HealthController.getHealth', () => {
    const exempt = routes.filter(
      (route) =>
        Reflect.getMetadata(INTERNAL_KEY_EXEMPT, route.controller.prototype[route.handler]) === true,
    );
    expect(exempt.map((route) => `${route.controller.name}.${route.handler}`)).toEqual([
      'HealthController.getHealth',
    ]);
    expect(exempt.map(routeKey)).toEqual(['GET /api/health']);
  });

  it('marks no controller class exempt (a class mark would open nothing anyway)', () => {
    for (const controller of controllers) {
      expect(Reflect.getMetadata(INTERNAL_KEY_EXEMPT, controller)).toBeUndefined();
    }
  });
});

describe('container-manager internal key over HTTP (CM-AUTH-01)', () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  let app: INestApplication;
  let baseUrl: string;

  /** One mock object per injected service class, a jest.fn per method. */
  const mocks = new Map<unknown, Record<string, jest.Mock>>();
  const controllerDeps = new Map<Type<unknown>, unknown[]>();

  function buildMock(token: Type<unknown>): Record<string, jest.Mock> {
    const mock: Record<string, jest.Mock> = {};
    let proto = token.prototype;
    while (proto && proto !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, name);
        if (name !== 'constructor' && typeof descriptor?.value === 'function' && !mock[name]) {
          mock[name] = jest.fn();
        }
      }
      proto = Object.getPrototypeOf(proto);
    }
    return mock;
  }

  function callCount(tokens: Iterable<unknown>): number {
    let total = 0;
    for (const token of tokens) {
      for (const fn of Object.values(mocks.get(token) ?? {})) {
        total += fn.mock.calls.length;
      }
    }
    return total;
  }

  function allCalls(): number {
    return callCount(mocks.keys());
  }

  type Reply = { status: number; text: string };

  async function send(
    method: string,
    path: string,
    key?: string,
    body: unknown = {},
  ): Promise<Reply> {
    const headers: Record<string, string> = {};
    const hasBody = method !== 'GET' && method !== 'HEAD';
    if (hasBody) {
      headers['content-type'] = 'application/json';
    }
    if (key !== undefined) {
      headers['x-internal-service-key'] = key;
    }
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
    // Always consume the body so no connection is left open.
    return { status: response.status, text: await response.text() };
  }

  /** Express's own 404: no route matched the method and path. */
  function isRouteNotFound(reply: Reply): boolean {
    return reply.status === 404 && /Cannot (GET|POST|PUT|PATCH|DELETE|HEAD)/.test(reply.text);
  }

  beforeAll(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;

    const appModuleGuards = (
      (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) ?? []) as Provider[]
    ).filter((provider) => (provider as { provide?: unknown })?.provide === APP_GUARD);
    expect(appModuleGuards).toHaveLength(1);

    for (const controller of controllers) {
      const deps = (Reflect.getMetadata('design:paramtypes', controller) ?? []) as Type<unknown>[];
      for (const dep of deps) {
        expect(typeof dep).toBe('function');
        expect(dep).not.toBe(Object);
        if (!mocks.has(dep)) {
          mocks.set(dep, buildMock(dep));
        }
      }
      controllerDeps.set(controller, deps);
    }

    @Module({
      controllers,
      providers: [
        ...[...mocks.entries()].map(([token, value]) => ({
          provide: token as Type<unknown>,
          useValue: value,
        })),
        // The global guard exactly as AppModule registers it.
        ...appModuleGuards,
      ],
    })
    class InternalKeyHttpTestModule {}

    app = await NestFactory.create(InternalKeyHttpTestModule, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
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

  beforeEach(() => {
    for (const mock of mocks.values()) {
      for (const fn of Object.values(mock)) {
        fn.mockReset();
      }
    }
  });

  it('mounts every AppModule controller (12) with mocked services', () => {
    expect(controllers).toHaveLength(12);
    expect(mocks.size).toBeGreaterThan(0);
  });

  it('GET /api/health answers 200 with no key', async () => {
    const response = await send('GET', '/api/health');
    expect(response.status).toBe(200);
    const body = JSON.parse(response.text);
    expect(body).toMatchObject({ status: 'ok', service: 'container-manager' });
  });

  it('GET /api/health answers 200 with a wrong key too (exempt by handler)', async () => {
    const response = await send('GET', '/api/health', wrongKey);
    expect(response.status).toBe(200);
  });

  describe.each(guardedRoutes.map((route) => [routeKey(route), route] as const))(
    '%s',
    (_name, route) => {
      const path = concretePath(route.path);

      it.each(methodsFor(route))('%s answers 403 with no key and calls no service', async (method) => {
        const response = await send(method, path);
        expect(response.status).toBe(403);
        expect(allCalls()).toBe(0);
      });

      it.each(methodsFor(route))('%s answers 403 with a wrong key and calls no service', async (method) => {
        const response = await send(method, path, wrongKey);
        expect(response.status).toBe(403);
        expect(allCalls()).toBe(0);
      });

      it.each(methodsFor(route))('%s passes the guard with the right key', async (method) => {
        const response = await send(method, path, internalKey);
        expect(response.status).not.toBe(403);
        expect(isRouteNotFound(response)).toBe(false);
      });
    },
  );

  it.each(controllers.filter((controller) => controller !== HealthController).map((c) => [c.name, c] as const))(
    '%s: the right key reaches its handlers (a service mock is called)',
    async (_name, controller) => {
      for (const route of guardedRoutes.filter((r) => r.controller === controller)) {
        for (const method of methodsFor(route)) {
          await send(method, concretePath(route.path), internalKey);
        }
      }
      // One handler validates its input before calling a service; send it a
      // valid request (BROWSER-SMOKE-02 removed the other, the preview port
      // register route).
      const validSamples: Record<string, [string, string, unknown]> = {
        InternalCheckpointHistoryController: [
          'POST',
          '/api/internal/checkpoint-history/11111111-1111-4111-8111-111111111111/save',
          { projectId: '22222222-2222-4222-8222-222222222222' },
        ],
      };
      const sample = validSamples[controller.name];
      if (sample) {
        const [method, path, body] = sample;
        const reply = await send(method, path, internalKey, body);
        expect(reply.status).not.toBe(403);
      }
      expect(callCount(controllerDeps.get(controller) ?? [])).toBeGreaterThan(0);
    },
  );

  it.each([
    ['GET', '/API/GIT/p1/CHECKPOINTS'],
    ['GET', '/Api/Git/p1/Checkpoints'],
    ['GET', '/api/git/p1/checkpoints/'],
    ['GET', '/api/files/p1/list/'],
    ['GET', '/API/FILES/p1/LIST'],
    ['GET', '/api/internal/stats/'],
    ['GET', '/API/INTERNAL/STATS'],
    ['GET', '/api/sessions/p1/'],
    ['GET', '/API/SESSIONS/p1'],
    ['GET', '/api/preview/p1/status/'],
    ['GET', '/API/PREVIEW/p1/PROXY'],
    ['POST', '/API/INTERNAL/SESSIONS/p1/EXEC'],
    ['POST', '/api/internal/sessions/p1/exec/'],
    ['GET', '/api//git/p1/checkpoints'],
    ['GET', '/api/git/p1/%63heckpoints'],
  ])('%s %s (case and slash variants) never reaches a handler without the key', async (method, path) => {
    const response = await send(method, path);
    expect([403, 404]).toContain(response.status);
    expect(allCalls()).toBe(0);
  });

  it.each([
    ['GET', '/api/previews/p1/health'],
    ['GET', '/api/previews/p1/x'],
    ['POST', '/api/previews/p1/x'],
    ['GET', '/api/internal-previews/proxy/p1/x'],
    ['POST', '/api/internal-previews/proxy/p1/x'],
    ['POST', '/api/executor/p1/execute'],
    ['GET', '/api/executor/commands'],
    ['GET', '/api/sessions'],
  ])('CM-CLEANUP-01: removed route %s %s is not found even with the key', async (method, path) => {
    const response = await send(method, path, internalKey);
    expect(isRouteNotFound(response)).toBe(true);
    expect(allCalls()).toBe(0);
  });

  it.each([
    ['GET', '/api/files/p1/list', undefined],
    ['POST', '/api/files/p1/read', { path: 'root/etc/passwd' }],
    ['POST', '/api/files/p1/write', { path: 'root/tmp/x', content: 'x' }],
    ['DELETE', '/api/files/p1/delete', { path: 'root/tmp/x' }],
    ['POST', '/api/files/p1/mkdir', { path: 'root/tmp/d' }],
    ['POST', '/api/files/p1/search', { query: 'x' }],
  ])('CM-SYMLINK-01: removed host-side route %s %s is not found even with the key', async (method, path, body) => {
    const response = await send(method, path, internalKey, body ?? {});
    expect(isRouteNotFound(response)).toBe(true);
    expect(allCalls()).toBe(0);
  });

  it('CM-SYMLINK-01: no remaining controller serves under /api/files', () => {
    expect(routes.filter((route) => route.path.startsWith('/api/files'))).toEqual([]);
  });

  it.each([
    ['POST', '/api/sessions', { userId: 'u1' }],
    ['POST', '/api/git/p1/init', { userId: 'u1' }],
    ['GET', '/api/git/p1/history', undefined],
    ['GET', '/api/git/p1/history?limit=5', undefined],
  ])('CM-GIT-HOST-01: removed host-side git route %s %s is not found even with the key', async (method, path, body) => {
    const response = await send(method, path, internalKey, body ?? {});
    expect(isRouteNotFound(response)).toBe(true);
    expect(allCalls()).toBe(0);
  });

  it.each([
    ['POST', '/api/internal/sessions/p1/previews', { port: 3000 }],
    ['POST', '/api/internal/sessions/3f2a8c1e-0b4d-4c5e-9f6a-7b8c9d0e1f2a/previews', { port: 3001 }],
  ])('BROWSER-SMOKE-02: removed route %s %s is not found even with the key', async (method, path, body) => {
    const response = await send(method, path, internalKey, body);
    expect(isRouteNotFound(response)).toBe(true);
    expect(allCalls()).toBe(0);
  });

  it('BROWSER-SMOKE-02: the removed preview register route answers 404 without the key too', async () => {
    // The global guard runs only for a matched route, so an unmatched path is
    // Express's 404 with or without the key.
    const response = await send('POST', '/api/internal/sessions/p1/previews', undefined, { port: 3000 });
    expect(isRouteNotFound(response)).toBe(true);
    expect(allCalls()).toBe(0);
  });

  it('BROWSER-SMOKE-02: no remaining route registers a preview port', () => {
    expect(routes.filter((route) => /\/previews$/.test(route.path))).toEqual([]);
    expect(controllers.map((controller) => controller.name)).not.toContain('InternalPreviewsController');
  });

  it.each([
    ['DELETE', '/api/internal/sessions/p1/container'],
    ['DELETE', '/api/internal/sessions/3f2a8c1e-0b4d-4c5e-9f6a-7b8c9d0e1f2a/container'],
  ])('CM-CLEANUP-02: removed route %s %s is not found even with the key', async (method, path) => {
    const response = await send(method, path, internalKey);
    expect(isRouteNotFound(response)).toBe(true);
    expect(allCalls()).toBe(0);
  });

  it.each([
    ['DELETE', '/api/internal/sessions/p1/container'],
    ['DELETE', '/api/internal/sessions/3f2a8c1e-0b4d-4c5e-9f6a-7b8c9d0e1f2a/container'],
  ])('CM-CLEANUP-02: the removed container route %s %s answers 404 without the key too', async (method, path) => {
    // The global guard runs only for a matched route, so an unmatched path is
    // Express's 404 with or without the key.
    const response = await send(method, path);
    expect(isRouteNotFound(response)).toBe(true);
    expect(allCalls()).toBe(0);
  });

  it('CM-CLEANUP-02: no remaining route ends in /container', () => {
    expect(routes.filter((route) => /\/container$/.test(route.path))).toEqual([]);
    expect(guardedRoutes.map((route) => route.handler)).not.toContain('removeContainer');
  });

  it('CM-GIT-HOST-01: no remaining route is a git init or history route, or a bare session create', () => {
    const keys = routes.map(routeKey);
    expect(keys.filter((key) => /^POST \/api\/sessions$/.test(key))).toEqual([]);
    expect(keys.filter((key) => /\/git\/[^/]+\/(init|history)$/.test(key))).toEqual([]);
  });

  describe('CM-SYMLINK-01: session id checked at the controller layer', () => {
    const SESSION_PARAM = /:(id|sessionId)(?=\/|\*|$)/;
    const sessionRoutes = guardedRoutes.filter((route) => SESSION_PARAM.test(route.path));

    /**
     * Sent raw with node:http, not fetch: the WHATWG URL parser fetch uses
     * would collapse a `%2E%2E` segment before it left the client.
     * Express decodes each to `..`, `a/b`, `a\b` and `a<NUL>b`.
     */
    const BAD_IDS = ['%2E%2E', '..', 'a%2Fb', 'a%5Cb', 'a%00b'];

    function pathWithSessionId(pattern: string, id: string): string {
      return concretePath(pattern.replace(SESSION_PARAM, id));
    }

    async function sendRaw(method: string, path: string, key?: string): Promise<Reply> {
      const url = new URL(baseUrl);
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (key !== undefined) {
        headers['x-internal-service-key'] = key;
      }
      const body = method === 'GET' || method === 'HEAD' ? undefined : '{}';
      if (body !== undefined) {
        // Node sends no length for a DELETE body unless told, and the server
        // would then read the body as a second, malformed request.
        headers['content-length'] = String(Buffer.byteLength(body));
      }
      return new Promise<Reply>((resolve, reject) => {
        const req = httpRequest(
          { host: url.hostname, port: url.port, method, path, headers, timeout: 5000 },
          (res) => {
            let text = '';
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => (text += chunk));
            res.on('end', () => resolve({ status: res.statusCode ?? 0, text }));
          },
        );
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', reject);
        req.end(body);
      });
    }

    it('covers every remaining route with a session id parameter (26)', () => {
      expect(sessionRoutes.map(routeKey).sort()).toEqual(
        EXPECTED_INVENTORY.filter((key) => SESSION_PARAM.test(key)).sort(),
      );
      expect(sessionRoutes).toHaveLength(26);
    });

    describe.each(sessionRoutes.map((route) => [routeKey(route), route] as const))('%s', (_name, route) => {
      it.each(methodsFor(route))(
        '%s refuses a session id that is not one path segment with 400 and calls no service',
        async (method) => {
          for (const id of BAD_IDS) {
            const path = pathWithSessionId(route.path, id);
            const reply = await sendRaw(method, path, internalKey);
            expect({ path, status: reply.status }).toEqual({ path, status: 400 });
            expect(JSON.parse(reply.text).message).toBe('Invalid session id');
            expect(allCalls()).toBe(0);
          }
        },
      );

      it.each(methodsFor(route))('%s still answers 403 first for a bad id without the key', async (method) => {
        const reply = await sendRaw(method, pathWithSessionId(route.path, '%2E%2E'), undefined);
        expect(reply.status).toBe(403);
        expect(allCalls()).toBe(0);
      });

      it.each(methodsFor(route))('%s accepts a UUID and a base36 id', async (method) => {
        for (const id of ['3f2a8c1e-0b4d-4c5e-9f6a-7b8c9d0e1f2a', 'lq3k9z0abc123']) {
          const reply = await sendRaw(method, pathWithSessionId(route.path, id), internalKey);
          expect(reply.status).not.toBe(403);
          expect(isRouteNotFound(reply)).toBe(false);
          if (reply.status === 400) {
            expect(reply.text).not.toContain('Invalid session id');
          }
        }
      });
    });
  });

  const GATEWAY_CALLED_PATHS = [
    // services/api-gateway/src/clients/container-manager-http.client.ts:272
    '/api/internal/billing-export/user/u1/usage',
    // services/api-gateway/src/admin/admin.service.ts:77
    '/api/internal/quota-visibility/user/u1',
    // same controllers, no gateway caller today
    '/api/internal/billing-export/limits',
    '/api/internal/billing-export/user/u1/monthly',
    '/api/internal/quota-visibility/user/u1/limits',
    '/api/internal/quota-visibility/user/u1/status',
    '/api/internal/quota-evaluations/user/u1',
    '/api/internal/quota-evaluations/limits/u1',
    '/api/internal/usage-aggregations/tokens/user/u1',
    '/api/internal/usage-aggregations/user/u1/summary',
  ];

  it('CM-PREFIX-01: every gateway-called path resolves to a real handler with the key and needs the key', async () => {
    for (const path of GATEWAY_CALLED_PATHS) {
      const refused = await send('GET', path);
      expect(refused.status).toBe(403);
      const allowed = await send('GET', path, internalKey);
      expect(allowed.status).not.toBe(403);
      expect(isRouteNotFound(allowed)).toBe(false);
    }
  });

  it('CM-PREFIX-01: the old /api/api/internal/... paths now return 404', async () => {
    for (const path of GATEWAY_CALLED_PATHS.map((p) => p.replace('/api/internal/', '/api/api/internal/'))) {
      const response = await send('GET', path, internalKey);
      expect(isRouteNotFound(response)).toBe(true);
    }
  });
});
