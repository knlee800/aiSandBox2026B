import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InternalServiceAuthGuard } from '../../guards/internal-service-auth.guard';

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

describe('InternalServiceAuthGuard events protection', () => {
  const originalInternalServiceKey = process.env.INTERNAL_SERVICE_KEY;

  afterEach(() => {
    process.env.INTERNAL_SERVICE_KEY = originalInternalServiceKey;
    jest.restoreAllMocks();
  });

  it('rejects /api/events/file-changed without X-Internal-Service-Key', () => {
    process.env.INTERNAL_SERVICE_KEY = 'test-key';
    const guard = new InternalServiceAuthGuard();
    const context = createMockContext({
      path: '/api/events/file-changed',
      headers: {},
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('allows /api/events/file-changed with valid X-Internal-Service-Key', () => {
    process.env.INTERNAL_SERVICE_KEY = 'test-key';
    const guard = new InternalServiceAuthGuard();
    const context = createMockContext({
      path: '/api/events/file-changed',
      headers: { 'x-internal-service-key': 'test-key' },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('keeps /api/internal/* protection behavior', () => {
    process.env.INTERNAL_SERVICE_KEY = 'test-key';
    const guard = new InternalServiceAuthGuard();
    const context = createMockContext({
      path: '/api/internal/sessions/session-1/start',
      headers: { 'x-internal-service-key': 'test-key' },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('bypasses unrelated public routes', () => {
    process.env.INTERNAL_SERVICE_KEY = 'test-key';
    const guard = new InternalServiceAuthGuard();
    const context = createMockContext({
      path: '/api/auth/login',
      headers: {},
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it.each(['/api/events/checkpoint-created', '/api/events/token-updated'])(
    'rejects %s without X-Internal-Service-Key',
    (path) => {
      process.env.INTERNAL_SERVICE_KEY = 'test-key';
      const guard = new InternalServiceAuthGuard();
      const context = createMockContext({
        path,
        headers: {},
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    },
  );

  it.each(['/api/events/checkpoint-created', '/api/events/token-updated'])(
    'allows %s with valid X-Internal-Service-Key',
    (path) => {
      process.env.INTERNAL_SERVICE_KEY = 'test-key';
      const guard = new InternalServiceAuthGuard();
      const context = createMockContext({
        path,
        headers: { 'x-internal-service-key': 'test-key' },
      });

      expect(guard.canActivate(context)).toBe(true);
    },
  );

  it('rejects /api/events/file-changed when the internal key does not match', () => {
    process.env.INTERNAL_SERVICE_KEY = 'test-key';
    const guard = new InternalServiceAuthGuard();
    const context = createMockContext({
      path: '/api/events/file-changed',
      headers: { 'x-internal-service-key': 'wrong-key' },
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
