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

/** Every route in the service as it is served (method + full path). */
const EXPECTED_INVENTORY = [
  'POST /api/sessions',
  'POST /api/sessions/:id/start',
  'GET /api/sessions/:id',
  'GET /api/sessions/user/:userId',
  'POST /api/sessions/:id/stop',
  'DELETE /api/sessions/:id',
  'GET /api/sessions',
  'POST /api/internal/sessions/:id/start',
  'DELETE /api/internal/sessions/:id/container',
  'POST /api/internal/sessions/:id/exec',
  'GET /api/internal/sessions/:id/files',
  'POST /api/internal/sessions/:id/files',
  'DELETE /api/internal/sessions/:id/files',
  'POST /api/internal/sessions/:id/files/search',
  'GET /api/internal/sessions/:id/dirs',
  'GET /api/internal/sessions/:id/stat',
  'POST /api/internal/sessions/:id/browser-smoke',
  'POST /api/internal/sessions/:id/previews',
  'ALL /api/internal-previews/proxy/:sessionId/*',
  'GET /api/previews/:sessionId/health',
  'ALL /api/previews/:sessionId/*',
  'GET /api/files/:sessionId/list',
  'POST /api/files/:sessionId/read',
  'POST /api/files/:sessionId/write',
  'DELETE /api/files/:sessionId/delete',
  'POST /api/files/:sessionId/mkdir',
  'POST /api/files/:sessionId/search',
  'POST /api/git/:sessionId/init',
  'POST /api/git/:sessionId/commit',
  'GET /api/git/:sessionId/history',
  'POST /api/git/:sessionId/revert',
  'GET /api/git/:sessionId/checkpoints',
  'GET /api/git/:sessionId/diff/:commitHash',
  'POST /api/internal/checkpoint-history/:sessionId/save',
  'POST /api/internal/checkpoint-history/:sessionId/restore',
  'GET /api/internal/git/:sessionId/worktree-diff/:commitHash',
  'POST /api/executor/:sessionId/execute',
  'GET /api/executor/commands',
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

  it('serves exactly the expected 64 routes (63 guarded + GET /api/health)', () => {
    const actual = routes.map(routeKey);
    // One line per route, so the real serving paths (F2) show in the test log.
    console.info(`CM-AUTH-01 route inventory (${actual.length}):\n${actual.join('\n')}`);
    expect(actual.sort()).toEqual([...EXPECTED_INVENTORY].sort());
    expect(routes).toHaveLength(64);
    expect(guardedRoutes).toHaveLength(63);
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
  const originalAccessControl = process.env.ENABLE_PREVIEW_ACCESS_CONTROL;
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
    delete process.env.ENABLE_PREVIEW_ACCESS_CONTROL;

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
    if (originalAccessControl === undefined) {
      delete process.env.ENABLE_PREVIEW_ACCESS_CONTROL;
    } else {
      process.env.ENABLE_PREVIEW_ACCESS_CONTROL = originalAccessControl;
    }
  });

  beforeEach(() => {
    for (const mock of mocks.values()) {
      for (const fn of Object.values(mock)) {
        fn.mockReset();
      }
    }
  });

  it('mounts every AppModule controller (17) with mocked services', () => {
    expect(controllers).toHaveLength(17);
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
      // Two handlers validate their input before calling a service; send one
      // valid request to each.
      const validSamples: Record<string, [string, string, unknown]> = {
        InternalCheckpointHistoryController: [
          'POST',
          '/api/internal/checkpoint-history/11111111-1111-4111-8111-111111111111/save',
          { projectId: '22222222-2222-4222-8222-222222222222' },
        ],
        InternalPreviewsController: ['POST', '/api/internal/sessions/p1/previews', { port: 3000 }],
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
    ['GET', '/API/EXECUTOR/COMMANDS'],
    ['GET', '/Api/Executor/Commands'],
    ['GET', '/api/executor/commands/'],
    ['GET', '/api/files/p1/list/'],
    ['GET', '/API/FILES/p1/LIST'],
    ['GET', '/api/internal/stats/'],
    ['GET', '/API/INTERNAL/STATS'],
    ['GET', '/api/sessions/'],
    ['GET', '/API/SESSIONS'],
    ['GET', '/api/preview/p1/status/'],
    ['GET', '/API/PREVIEW/p1/PROXY'],
    ['POST', '/API/EXECUTOR/p1/EXECUTE'],
    ['POST', '/api/internal/sessions/p1/exec/'],
    ['GET', '/api//executor/commands'],
    ['GET', '/api/executor/%63ommands'],
  ])('%s %s (case and slash variants) never reaches a handler without the key', async (method, path) => {
    const response = await send(method, path);
    expect([403, 404]).toContain(response.status);
    expect(allCalls()).toBe(0);
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
