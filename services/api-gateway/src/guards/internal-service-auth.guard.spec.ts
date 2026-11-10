import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InternalServiceAuthGuard, internalKeyMatches } from './internal-service-auth.guard';
// The real module object (not an import-star copy), so jest can spy on it.
import crypto = require('crypto');

type MockRequest = {
  path: string;
  headers: Record<string, string | undefined>;
};

function createMockContext(request: MockRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

const testKey = 'auth-guard-01-test-key';
const wrongKey = 'auth-guard-01-wrong-key';

const protectedPaths = [
  '/api/internal/workspace/s1/read',
  '/api/events/file-changed',
  '/api/chat-messages/add-by-session',
  '/api/token-usage/record',
  '/api/runtime/metrics',
];

const caseVariants = [
  '/API/INTERNAL/workspace/s1/read',
  '/api/Internal/workspace/s1/read',
  '/API/EVENTS/file-changed',
  '/api/Events/file-changed',
  '/API/CHAT-MESSAGES/add-by-session',
  '/api/Chat-Messages/add-by-session',
  '/API/TOKEN-USAGE/record',
  '/api/Token-Usage/record',
  '/API/RUNTIME/metrics',
  '/api/Runtime/metrics',
];

const publicPaths = ['/api/auth/login', '/api/projects'];

const lookalikePaths = [
  '/api/internalx/a',
  '/api/runtimes/a',
  '/api/eventsx/a',
  '/api/chat-messagesx/a',
  '/api/token-usagex/a',
];

describe('InternalServiceAuthGuard', () => {
  const originalInternalServiceKey = process.env.INTERNAL_SERVICE_KEY;

  beforeEach(() => {
    process.env.INTERNAL_SERVICE_KEY = testKey;
  });

  afterEach(() => {
    if (originalInternalServiceKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalInternalServiceKey;
    }
    jest.restoreAllMocks();
  });

  it.each(protectedPaths)('refuses %s when the key is missing', (path) => {
    const guard = new InternalServiceAuthGuard();
    const context = createMockContext({ path, headers: {} });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it.each(protectedPaths)('refuses %s when the key is wrong', (path) => {
    const guard = new InternalServiceAuthGuard();
    const context = createMockContext({
      path,
      headers: { 'x-internal-service-key': wrongKey },
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it.each(protectedPaths)('accepts %s when the key is correct', (path) => {
    const guard = new InternalServiceAuthGuard();
    const context = createMockContext({
      path,
      headers: { 'x-internal-service-key': testKey },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it.each(caseVariants)(
    'refuses %s without a key',
    (path) => {
      const guard = new InternalServiceAuthGuard();
      const context = createMockContext({ path, headers: {} });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    },
  );

  it.each(caseVariants)('accepts %s when the key is correct', (path) => {
    const guard = new InternalServiceAuthGuard();
    const context = createMockContext({
      path,
      headers: { 'x-internal-service-key': testKey },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it.each(publicPaths)('allows %s without a key', (path) => {
    const guard = new InternalServiceAuthGuard();
    const context = createMockContext({ path, headers: {} });

    expect(guard.canActivate(context)).toBe(true);
  });

  it.each(lookalikePaths)('allows lookalike %s without a key', (path) => {
    const guard = new InternalServiceAuthGuard();
    const context = createMockContext({ path, headers: {} });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('refuses protected paths when INTERNAL_SERVICE_KEY is unset', () => {
    delete process.env.INTERNAL_SERVICE_KEY;
    const guard = new InternalServiceAuthGuard();
    const paths = [
      ...protectedPaths,
      '/API/INTERNAL/workspace/s1/read',
      '/api/Chat-Messages/add-by-session',
    ];

    for (const path of paths) {
      const context = createMockContext({ path, headers: {} });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    }
  });
});

describe('internalKeyMatches (AI-SERVICE-AUTH-01 D5)', () => {
  const sameLengthWrongKey = 'auth-guard-01-test-kez';
  const longerKey = 'auth-guard-01-test-key-longer';

  afterEach(() => jest.restoreAllMocks());

  it('is true for the equal key', () => {
    expect(internalKeyMatches(testKey, testKey)).toBe(true);
  });

  it('is false for a same-length wrong key', () => {
    expect(sameLengthWrongKey.length).toBe(testKey.length);
    expect(internalKeyMatches(sameLengthWrongKey, testKey)).toBe(false);
  });

  it('is false for a different length', () => {
    expect(internalKeyMatches(longerKey, testKey)).toBe(false);
    expect(internalKeyMatches(wrongKey, testKey)).toBe(false);
    expect(internalKeyMatches(testKey.slice(0, -1), testKey)).toBe(false);
  });

  it('is false for empty, undefined, null, numbers and arrays', () => {
    expect(internalKeyMatches('', testKey)).toBe(false);
    expect(internalKeyMatches(testKey, '')).toBe(false);
    expect(internalKeyMatches('', '')).toBe(false);
    expect(internalKeyMatches(undefined, testKey)).toBe(false);
    expect(internalKeyMatches(testKey, undefined)).toBe(false);
    expect(internalKeyMatches(null, testKey)).toBe(false);
    expect(internalKeyMatches(123, '123')).toBe(false);
    expect(internalKeyMatches([testKey], testKey)).toBe(false);
    expect(internalKeyMatches([testKey, testKey], testKey)).toBe(false);
  });

  it('calls crypto.timingSafeEqual when the lengths are equal', () => {
    const spy = jest.spyOn(crypto, 'timingSafeEqual');
    expect(internalKeyMatches(sameLengthWrongKey, testKey)).toBe(false);
    expect(internalKeyMatches(testKey, testKey)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does not call crypto.timingSafeEqual when the lengths differ', () => {
    const spy = jest.spyOn(crypto, 'timingSafeEqual');
    expect(internalKeyMatches(longerKey, testKey)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('InternalServiceAuthGuard constant-time compare (AI-SERVICE-AUTH-01 D5)', () => {
  const originalInternalServiceKey = process.env.INTERNAL_SERVICE_KEY;
  const path = '/api/internal/workspace/s1/read';

  beforeEach(() => {
    process.env.INTERNAL_SERVICE_KEY = testKey;
  });

  afterEach(() => {
    if (originalInternalServiceKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalInternalServiceKey;
    }
    jest.restoreAllMocks();
  });

  function withHeader(value: unknown): ExecutionContext {
    return createMockContext({
      path,
      headers: { 'x-internal-service-key': value } as MockRequest['headers'],
    });
  }

  it('refuses a same-length wrong key', () => {
    const guard = new InternalServiceAuthGuard();
    expect(() => guard.canActivate(withHeader('auth-guard-01-test-kez'))).toThrow(
      UnauthorizedException,
    );
  });

  it('refuses a key of the wrong length', () => {
    const guard = new InternalServiceAuthGuard();
    expect(() => guard.canActivate(withHeader(`${testKey}x`))).toThrow(UnauthorizedException);
  });

  it('refuses a header sent twice, as an array or joined by Node', () => {
    const guard = new InternalServiceAuthGuard();
    expect(() => guard.canActivate(withHeader([testKey, testKey]))).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(withHeader(`${testKey}, ${testKey}`))).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts the right key through crypto.timingSafeEqual', () => {
    const spy = jest.spyOn(crypto, 'timingSafeEqual');
    const guard = new InternalServiceAuthGuard();
    expect(guard.canActivate(withHeader(testKey))).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('no longer warns that internal endpoints are unprotected when the key is unset', () => {
    delete process.env.INTERNAL_SERVICE_KEY;
    const source = require('fs').readFileSync(
      require('path').join(__dirname, 'internal-service-auth.guard.ts'),
      'utf8',
    );
    expect(source).not.toContain('UNPROTECTED');
    expect(source).toContain('internalKeyMatches(providedKey, this.internalServiceKey)');
    expect(source).not.toMatch(/providedKey !== this\.internalServiceKey/);
  });
});
