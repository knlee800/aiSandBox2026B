import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PreviewController } from '../preview.controller';
import { PreviewOwnershipGuard } from '../preview-ownership.guard';
import { SessionCookieGuard } from '../../auth/session-cookie.guard';

type SessionServiceMock = {
  getSessionById: jest.Mock;
};

function createExecutionContext(
  path: string,
  userId?: string,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        path,
        user: userId ? { userId } : undefined,
      }),
    }),
  } as ExecutionContext;
}

describe('PreviewOwnershipGuard', () => {
  let sessionService: SessionServiceMock;
  let guard: PreviewOwnershipGuard;

  beforeEach(() => {
    sessionService = {
      getSessionById: jest.fn(),
    };
    guard = new PreviewOwnershipGuard(sessionService as never);
  });

  it('includes SessionCookieGuard and PreviewOwnershipGuard on PreviewController metadata', () => {
    const guards = Reflect.getMetadata('__guards__', PreviewController) || [];

    expect(guards).toContain(SessionCookieGuard);
    expect(guards).toContain(PreviewOwnershipGuard);
  });

  it('keeps guard order with SessionCookieGuard before PreviewOwnershipGuard', () => {
    const guards = Reflect.getMetadata('__guards__', PreviewController) || [];
    const sessionCookieGuardIndex = guards.indexOf(SessionCookieGuard);
    const previewOwnershipGuardIndex = guards.indexOf(PreviewOwnershipGuard);

    expect(sessionCookieGuardIndex).toBeGreaterThanOrEqual(0);
    expect(previewOwnershipGuardIndex).toBeGreaterThanOrEqual(0);
    expect(sessionCookieGuardIndex).toBeLessThan(previewOwnershipGuardIndex);
  });

  it('returns true when session owner matches authenticated user', async () => {
    sessionService.getSessionById.mockResolvedValue({ userId: 'user-1' });
    const context = createExecutionContext('/api/preview/session-123/status', 'user-1');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('throws ForbiddenException when session owner does not match authenticated user', async () => {
    sessionService.getSessionById.mockResolvedValue({ userId: 'user-2' });
    const context = createExecutionContext('/api/preview/session-123/status', 'user-1');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException when session lookup fails', async () => {
    sessionService.getSessionById.mockRejectedValue(new Error('Session not found'));
    const context = createExecutionContext('/api/preview/session-123/status', 'user-1');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException when request has no authenticated user', async () => {
    const context = createExecutionContext('/api/preview/session-123/status');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessionService.getSessionById).not.toHaveBeenCalled();
  });

  it.each(['/api/preview', '/api/preview/'])(
    'throws ForbiddenException for malformed path: %s',
    async (path) => {
      const context = createExecutionContext(path, 'user-1');

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
      expect(sessionService.getSessionById).not.toHaveBeenCalled();
    },
  );

  it('extracts sessionId from proxy path and uses it for lookup', async () => {
    sessionService.getSessionById.mockResolvedValue({ userId: 'user-1' });
    const context = createExecutionContext(
      '/api/preview/session-123/proxy/assets/main.js',
      'user-1',
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(sessionService.getSessionById).toHaveBeenCalledWith('session-123');
  });
});
