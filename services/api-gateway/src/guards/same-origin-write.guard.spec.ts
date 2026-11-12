import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CROSS_ORIGIN_REFUSED_MESSAGE,
  SAME_ORIGIN_WRITE_EXEMPT_PATH,
  SameOriginWriteGuard,
} from './same-origin-write.guard';

type FakeRequest = {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
};

function contextFor(req: FakeRequest, type: 'http' | 'ws' | 'rpc' = 'http'): ExecutionContext {
  return {
    getType: () => type,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext;
}

function makeRequest(input: {
  method?: string;
  path?: string;
  origin?: string;
  sessionCookie?: boolean;
  rawCookieOnly?: boolean;
  authorization?: string;
  internalKey?: string;
}): FakeRequest {
  const headers: FakeRequest['headers'] = {};
  if (input.origin !== undefined) {
    headers.origin = input.origin;
  }
  if (input.authorization !== undefined) {
    headers.authorization = input.authorization;
  }
  if (input.internalKey !== undefined) {
    headers['x-internal-service-key'] = input.internalKey;
  }
  const req: FakeRequest = {
    method: input.method ?? 'POST',
    path: input.path ?? '/api/sessions',
    headers,
    cookies: {},
  };
  if (input.sessionCookie) {
    headers.cookie = 'aisandbox_csrf=c; aisandbox_session=token-value';
    if (!input.rawCookieOnly) {
      req.cookies = { aisandbox_csrf: 'c', aisandbox_session: 'token-value' };
    } else {
      delete req.cookies;
    }
  }
  return req;
}

const APP_ORIGIN = 'https://staging.ainow.biz';
const PREVIEW_ORIGIN = 'https://preview.staging.ainow.biz';
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

describe('SameOriginWriteGuard (CSRF-AUDIT-01)', () => {
  const originalAppBaseUrl = process.env.APP_BASE_URL;
  let guard: SameOriginWriteGuard;

  beforeEach(() => {
    process.env.APP_BASE_URL = APP_ORIGIN;
    guard = new SameOriginWriteGuard();
  });

  afterEach(() => {
    if (originalAppBaseUrl === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = originalAppBaseUrl;
    }
  });

  function allows(req: FakeRequest): boolean {
    return guard.canActivate(contextFor(req));
  }

  function expectRefused(req: FakeRequest): void {
    let thrown: unknown;
    try {
      guard.canActivate(contextFor(req));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ForbiddenException);
    expect((thrown as ForbiddenException).getStatus()).toBe(403);
    expect((thrown as ForbiddenException).message).toBe(CROSS_ORIGIN_REFUSED_MESSAGE);
  }

  // Test 1
  it('allows a POST whose Origin is the app origin, with or without the session cookie', () => {
    expect(allows(makeRequest({ origin: APP_ORIGIN }))).toBe(true);
    expect(allows(makeRequest({ origin: APP_ORIGIN, sessionCookie: true }))).toBe(true);
  });

  it('compares origins, not URLs: APP_BASE_URL with a path still matches its origin', () => {
    process.env.APP_BASE_URL = 'https://staging.ainow.biz/en/app';
    expect(allows(makeRequest({ origin: APP_ORIGIN, sessionCookie: true }))).toBe(true);
  });

  // Test 2
  it('refuses a POST from the preview origin, with and without the session cookie', () => {
    expectRefused(makeRequest({ origin: PREVIEW_ORIGIN }));
    expectRefused(makeRequest({ origin: PREVIEW_ORIGIN, sessionCookie: true }));
  });

  it('refuses other near-miss origins (scheme, port, other host)', () => {
    for (const origin of [
      'http://staging.ainow.biz',
      'https://staging.ainow.biz:8443',
      'https://evil.example',
      'https://staging.ainow.biz.evil.example',
    ]) {
      expectRefused(makeRequest({ origin, sessionCookie: true }));
    }
  });

  // Test 3
  it('refuses Origin: null, an empty Origin and a garbled Origin', () => {
    expectRefused(makeRequest({ origin: 'null', sessionCookie: true }));
    expectRefused(makeRequest({ origin: 'null' }));
    expectRefused(makeRequest({ origin: '' }));
    expectRefused(makeRequest({ origin: `${APP_ORIGIN}, ${PREVIEW_ORIGIN}` }));
  });

  it('refuses an Origin header that arrives as an array', () => {
    const req = makeRequest({ sessionCookie: true });
    req.headers.origin = [APP_ORIGIN, APP_ORIGIN];
    expectRefused(req);
  });

  // Test 4
  it('refuses a POST with the session cookie and no Origin; allows it without the cookie', () => {
    expectRefused(makeRequest({ sessionCookie: true }));
    expect(allows(makeRequest({}))).toBe(true);
  });

  it('sees the session cookie in the raw Cookie header when cookies were not parsed', () => {
    expectRefused(makeRequest({ sessionCookie: true, rawCookieOnly: true }));
  });

  it('does not treat a cookie whose name only contains aisandbox_session as the session cookie', () => {
    const req = makeRequest({});
    req.headers.cookie = 'x_aisandbox_session=1; aisandbox_csrf=c';
    req.cookies = { x_aisandbox_session: '1', aisandbox_csrf: 'c' };
    expect(allows(req)).toBe(true);
  });

  // Test 5
  it.each(WRITE_METHODS)('%s follows the same rule as POST', (method) => {
    expect(allows(makeRequest({ method, origin: APP_ORIGIN, sessionCookie: true }))).toBe(true);
    expectRefused(makeRequest({ method, origin: PREVIEW_ORIGIN }));
    expectRefused(makeRequest({ method, origin: PREVIEW_ORIGIN, sessionCookie: true }));
    expectRefused(makeRequest({ method, origin: 'null' }));
    expectRefused(makeRequest({ method, sessionCookie: true }));
    expect(allows(makeRequest({ method }))).toBe(true);
  });

  it('treats a lower-case method the same way', () => {
    expectRefused(makeRequest({ method: 'post', origin: PREVIEW_ORIGIN }));
  });

  // Test 6
  it.each(['GET', 'HEAD', 'OPTIONS'])(
    '%s with a foreign Origin and the session cookie is allowed (the guard does not look)',
    (method) => {
      expect(allows(makeRequest({ method, origin: PREVIEW_ORIGIN, sessionCookie: true }))).toBe(
        true,
      );
      expect(allows(makeRequest({ method, origin: 'null', sessionCookie: true }))).toBe(true);
      expect(allows(makeRequest({ method, sessionCookie: true }))).toBe(true);
    },
  );

  // Test 7
  it('fails closed when APP_BASE_URL is unset, blank or not a URL', () => {
    for (const value of [undefined, '', '   ', 'not a url']) {
      if (value === undefined) {
        delete process.env.APP_BASE_URL;
      } else {
        process.env.APP_BASE_URL = value;
      }
      expectRefused(makeRequest({ origin: APP_ORIGIN }));
      expectRefused(makeRequest({ origin: APP_ORIGIN, sessionCookie: true }));
      expectRefused(makeRequest({ origin: 'null' }));
    }
  });

  // Test 8
  it('allows the Apple sign-in callback from Apple, with or without cookies', () => {
    expect(SAME_ORIGIN_WRITE_EXEMPT_PATH).toBe('/api/auth/apple/callback');
    expect(
      allows(
        makeRequest({ path: '/api/auth/apple/callback', origin: 'https://appleid.apple.com' }),
      ),
    ).toBe(true);
    expect(
      allows(
        makeRequest({
          path: '/api/auth/apple/callback',
          origin: 'https://appleid.apple.com',
          sessionCookie: true,
        }),
      ),
    ).toBe(true);
  });

  it('does not exempt near-miss Apple callback paths', () => {
    for (const path of [
      '/api/auth/apple/callbackx',
      '/api/auth/apple/callback/x',
      '/api/auth/apple/callback/',
      '/API/auth/apple/callback',
      '/api/auth/Apple/callback',
      '/api/auth/apple',
      '/auth/apple/callback',
    ]) {
      expectRefused(makeRequest({ path, origin: 'https://appleid.apple.com' }));
    }
  });

  // Test 9
  it('lets an internal-prefix POST with the key and no Origin through to the internal key guard', () => {
    expect(
      allows(
        makeRequest({
          path: '/api/internal/executions/e1/confirm-build-apply',
          internalKey: 'k',
        }),
      ),
    ).toBe(true);
  });

  it('lets a bearer POST without Origin or cookie through to the route guard', () => {
    expect(
      allows(makeRequest({ path: '/api/ai/execute', authorization: 'Bearer sk_test' })),
    ).toBe(true);
  });

  it('does not exempt a bearer header that comes with the session cookie and no Origin', () => {
    expectRefused(
      makeRequest({
        path: '/api/ai/execute',
        authorization: 'Bearer sk_test',
        sessionCookie: true,
      }),
    );
  });

  it('does not act on non-HTTP contexts', () => {
    const req = makeRequest({ origin: PREVIEW_ORIGIN, sessionCookie: true });
    expect(guard.canActivate(contextFor(req, 'ws'))).toBe(true);
  });

  it('never logs: the guard source has no logger or console use', () => {
    const source = readFileSync(join(__dirname, 'same-origin-write.guard.ts'), 'utf8');
    expect(source).not.toMatch(/\bLogger\b/);
    expect(source).not.toMatch(/console\./);
    expect(source).toContain('resolveHttpCorsOrigin');
  });
});

// Test 11
describe('app.module.ts registers SameOriginWriteGuard as a global guard', () => {
  it('provides it as APP_GUARD beside InternalServiceAuthGuard', () => {
    const source = readFileSync(join(__dirname, '..', 'app.module.ts'), 'utf8');
    expect(source).toContain(
      "import { SameOriginWriteGuard } from './guards/same-origin-write.guard';",
    );
    expect(source).toMatch(
      /provide:\s*APP_GUARD,\s*useClass:\s*InternalServiceAuthGuard,/,
    );
    expect(source).toMatch(/provide:\s*APP_GUARD,\s*useClass:\s*SameOriginWriteGuard,/);
  });
});

// COOKIE-PREFIX-01 test 6: rule 3 for either session cookie name, exact name.
describe('SameOriginWriteGuard rule 3 with either session cookie name (COOKIE-PREFIX-01)', () => {
  const ENV_NAMES = ['APP_BASE_URL', 'NODE_ENV'] as const;
  const saved: Record<string, string | undefined> = {};
  const guard = new SameOriginWriteGuard();

  beforeEach(() => {
    for (const name of ENV_NAMES) saved[name] = process.env[name];
    process.env.APP_BASE_URL = APP_ORIGIN;
  });

  afterEach(() => {
    for (const name of ENV_NAMES) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  function noOrigin(cookies: Record<string, string> | undefined, header?: string): FakeRequest {
    const req: FakeRequest = { method: 'POST', path: '/api/sessions', headers: {} };
    if (cookies) req.cookies = cookies;
    if (header !== undefined) req.headers.cookie = header;
    return req;
  }

  function refused(req: FakeRequest): boolean {
    try {
      guard.canActivate(contextFor(req));
      return false;
    } catch (error) {
      return error instanceof ForbiddenException;
    }
  }

  it.each([
    ['secure mode', 'https://staging.ainow.biz', 'test'],
    ['local http', 'http://localhost:3000', 'development'],
  ])('in %s refuses a write without Origin when either name is present', (_label, base, nodeEnv) => {
    process.env.APP_BASE_URL = base;
    process.env.NODE_ENV = nodeEnv;
    for (const name of ['aisandbox_session', '__Host-aisandbox_session']) {
      // parsed cookies
      expect(refused(noOrigin({ [name]: 't' }))).toBe(true);
      // raw header only, any position, spaces around the name
      expect(refused(noOrigin(undefined, `${name}=t`))).toBe(true);
      expect(refused(noOrigin(undefined, `a=1;  ${name} =t; b=2`))).toBe(true);
      // empty value still counts as a session cookie being sent
      expect(refused(noOrigin(undefined, `${name}=`))).toBe(true);
    }
  });

  it('does not treat names that only contain or extend the session name as the session cookie', () => {
    for (const name of [
      'x__Host-aisandbox_session',
      '__Host-aisandbox_session2',
      '__host-aisandbox_session',
      '__Secure-aisandbox_session',
      'aisandbox_sessionx',
    ]) {
      expect(refused(noOrigin({ [name]: 't' }, `${name}=t`))).toBe(false);
    }
    // a value that contains the name is not a name
    expect(refused(noOrigin(undefined, 'other=__Host-aisandbox_session=t'))).toBe(false);
  });
});
