import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InternalServiceAuthGuard } from './internal-service-auth.guard';

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
