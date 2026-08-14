import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GoneException } from '@nestjs/common';

const mockPrepare = jest.fn();

jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    exec: jest.fn(),
    prepare: mockPrepare,
  }));
});

jest.mock('fs', () => ({
  ...jest.requireActual<typeof import('fs')>('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn<any>().mockResolvedValue(undefined),
}));

import { SessionsService } from './sessions.service';

describe('SessionsService.startSessionContainer (AGENT-HARNESS-05B5A)', () => {
  let service: SessionsService;
  let mockCreateContainer: jest.Mock<any>;
  let mockStartContainer: jest.Mock<any>;
  let mockReadFileFromContainer: jest.Mock<any>;
  let mockNotifySessionStarted: jest.Mock<any>;
  let mockHasUserExceededQuota: jest.Mock<any>;
  let mockSelectSessionGet: jest.Mock<any>;
  let mockInsertSessionRun: jest.Mock<any>;
  let mockAssertSessionGet: jest.Mock<any>;
  let mockLifetimeSessionGet: jest.Mock<any>;
  let mockQuotaSessionGet: jest.Mock<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    globalThis.fetch = jest.fn<any>().mockResolvedValue(undefined) as any;

    mockCreateContainer = jest.fn<any>().mockResolvedValue('container-abc');
    mockStartContainer = jest.fn<any>().mockResolvedValue(undefined);
    mockReadFileFromContainer = jest.fn<any>().mockResolvedValue('file-content');
    mockNotifySessionStarted = jest.fn<any>().mockResolvedValue(undefined);
    mockHasUserExceededQuota = jest.fn<any>().mockReturnValue(false);
    mockSelectSessionGet = jest.fn<any>().mockReturnValue(undefined);
    mockInsertSessionRun = jest.fn<any>().mockReturnValue(undefined);
    mockAssertSessionGet = jest.fn<any>().mockReturnValue({
      terminated_at: null,
      termination_reason: null,
    });
    mockLifetimeSessionGet = jest.fn<any>().mockReturnValue({
      created_at: new Date().toISOString(),
      terminated_at: null,
      user_id: 'internal-session-default',
    });
    mockQuotaSessionGet = jest.fn<any>().mockReturnValue({
      user_id: 'internal-session-default',
    });

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT id FROM sessions WHERE id = ?')) {
        return {
          get: mockSelectSessionGet,
          run: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
      }

      if (sql.includes('INSERT INTO sessions (id, user_id, status, git_initialized')) {
        return {
          get: jest.fn(),
          run: mockInsertSessionRun,
          all: jest.fn().mockReturnValue([]),
        };
      }

      if (sql.includes('SELECT terminated_at, termination_reason FROM sessions WHERE id = ?')) {
        return {
          get: mockAssertSessionGet,
          run: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
      }

      if (sql.includes('SELECT created_at, terminated_at, user_id FROM sessions WHERE id = ?')) {
        return {
          get: mockLifetimeSessionGet,
          run: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
      }

      if (sql.includes('SELECT user_id FROM sessions WHERE id = ?')) {
        return {
          get: mockQuotaSessionGet,
          run: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
      }

      return {
        get: jest.fn(),
        run: jest.fn(),
        all: jest.fn().mockReturnValue([]),
      };
    });

    const dockerRuntimeService = {
      createContainer: mockCreateContainer,
      startContainer: mockStartContainer,
      readFileFromContainer: mockReadFileFromContainer,
    };

    const apiGatewayClient = {
      notifySessionStarted: mockNotifySessionStarted,
    };

    const governanceConfig = {
      sessionMaxLifetimeMs: 60 * 60 * 1000,
      sessionIdleTimeoutMs: 30 * 60 * 1000,
      maxConcurrentExecsPerSession: 3,
    };

    const governanceEventsService = {
      logTerminationEvent: jest.fn<any>(),
    };

    const quotaEvaluationService = {
      hasUserExceededQuota: mockHasUserExceededQuota,
    };

    service = new SessionsService(
      {} as any,
      apiGatewayClient as any,
      dockerRuntimeService as any,
      governanceConfig as any,
      {} as any,
      governanceEventsService as any,
      quotaEvaluationService as any,
    );
  });

  it('creates a local session row when internal start omits userId', async () => {
    await service.startSessionContainer('sess-internal');

    expect(mockSelectSessionGet).toHaveBeenCalledWith('sess-internal');
    expect(mockInsertSessionRun).toHaveBeenCalledWith('sess-internal', null);
  });

  it('falls back to internal owner id when sessions.user_id is NOT NULL', async () => {
    mockInsertSessionRun.mockImplementation((sessionId: string, owner: string | null) => {
      if (owner === null) {
        throw new Error('NOT NULL constraint failed: sessions.user_id');
      }
      return { changes: 1, sessionId };
    });

    await service.startSessionContainer('sess-not-null');

    expect(mockInsertSessionRun).toHaveBeenNthCalledWith(1, 'sess-not-null', null);
    expect(mockInsertSessionRun).toHaveBeenNthCalledWith(
      2,
      'sess-not-null',
      'internal-session-sess-not-null',
    );
  });

  it('preserves existing userId insert behavior when row is missing', async () => {
    await service.startSessionContainer('sess-user', 'user-1');

    expect(mockInsertSessionRun).toHaveBeenCalledWith('sess-user', 'user-1');
  });

  it('does not insert a duplicate row when session already exists', async () => {
    mockSelectSessionGet.mockReturnValue({ id: 'sess-existing' });

    await service.startSessionContainer('sess-existing');

    expect(mockInsertSessionRun).not.toHaveBeenCalled();
  });

  it('allows downstream file read guard path after internal start without userId', async () => {
    mockLifetimeSessionGet.mockReturnValue({
      created_at: new Date().toISOString(),
      terminated_at: null,
      user_id: 'internal-session-sess-read',
    });
    mockQuotaSessionGet.mockReturnValue({ user_id: 'internal-session-sess-read' });

    await service.startSessionContainer('sess-read');
    const content = await service.readFileFromContainer('sess-read', 'README.md');

    expect(content).toBe('file-content');
    expect(mockReadFileFromContainer).toHaveBeenCalledWith('sess-read', 'README.md');
  });

  it('passes no browser-capable option when called without options', async () => {
    await service.startSessionContainer('sess-1');

    expect(mockCreateContainer).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateContainer.mock.calls[0];
    expect(callArgs[0]).toBe('sess-1');
    expect(callArgs[2]).toBeUndefined();
  });

  it('passes no browser-capable option when called with userId only', async () => {
    await service.startSessionContainer('sess-2', 'user-1');

    expect(mockCreateContainer).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateContainer.mock.calls[0];
    expect(callArgs[0]).toBe('sess-2');
    expect(callArgs[2]).toBeUndefined();
  });

  it('passes { browserCapable: true } when options.browserCapable is true', async () => {
    await service.startSessionContainer('sess-3', 'user-1', { browserCapable: true });

    expect(mockCreateContainer).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateContainer.mock.calls[0];
    expect(callArgs[0]).toBe('sess-3');
    expect(callArgs[2]).toEqual({ browserCapable: true });
  });

  it('passes undefined when options.browserCapable is false', async () => {
    await service.startSessionContainer('sess-4', 'user-1', { browserCapable: false });

    expect(mockCreateContainer).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateContainer.mock.calls[0];
    expect(callArgs[0]).toBe('sess-4');
    expect(callArgs[2]).toBeUndefined();
  });

  it('passes undefined when options is empty object', async () => {
    await service.startSessionContainer('sess-5', undefined, {});

    expect(mockCreateContainer).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateContainer.mock.calls[0];
    expect(callArgs[0]).toBe('sess-5');
    expect(callArgs[2]).toBeUndefined();
  });

  it('still calls startContainer after createContainer', async () => {
    await service.startSessionContainer('sess-6', undefined, { browserCapable: true });

    expect(mockStartContainer).toHaveBeenCalledWith('container-abc');
  });
});

describe('SessionsService idle-timeout response semantics (PRIVATE-BETA-BLOCKER-03E-A)', () => {
  const idleTimeoutMs = 30 * 60 * 1000;
  const maxLifetimeMs = 60 * 60 * 1000;

  let service: SessionsService;
  let mockWriteFileToContainer: jest.Mock<any>;
  let mockReadFileFromContainer: jest.Mock<any>;
  let mockFindContainerBySessionId: jest.Mock<any>;
  let mockStopContainer: jest.Mock<any>;
  let mockRemoveContainer: jest.Mock<any>;
  let mockTerminateSessionRun: jest.Mock<any>;
  let mockAssertSessionGet: jest.Mock<any>;
  let mockLifetimeSessionGet: jest.Mock<any>;
  let mockQuotaSessionGet: jest.Mock<any>;
  let mockLogTerminationEvent: jest.Mock<any>;
  let mockNotifySessionStopped: jest.Mock<any>;
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
  let resolveHungCleanup: (() => void) | undefined;
  let resolveHungNotification: (() => void) | undefined;

  function expireIdle(sessionId: string): void {
    (service as unknown as { lastActivity: Map<string, number> }).lastActivity.set(
      sessionId,
      Date.now() - idleTimeoutMs - 1000,
    );
  }

  function markFresh(sessionId: string): void {
    (service as unknown as { lastActivity: Map<string, number> }).lastActivity.set(
      sessionId,
      Date.now(),
    );
  }

  async function flushScheduledCleanup(): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve));
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    jest.clearAllMocks();
    resolveHungCleanup = undefined;

    mockWriteFileToContainer = jest.fn<any>().mockResolvedValue(undefined);
    mockReadFileFromContainer = jest.fn<any>().mockResolvedValue('file-content');
    mockStopContainer = jest.fn<any>().mockResolvedValue(undefined);
    mockRemoveContainer = jest.fn<any>().mockResolvedValue(undefined);
    mockFindContainerBySessionId = jest.fn<any>().mockResolvedValue({
      id: 'container-expired',
      inspect: jest.fn<any>().mockResolvedValue({ State: { Running: true } }),
    });
    mockTerminateSessionRun = jest.fn<any>().mockReturnValue({ changes: 1 });
    mockAssertSessionGet = jest.fn<any>().mockReturnValue({
      terminated_at: null,
      termination_reason: null,
    });
    mockLifetimeSessionGet = jest.fn<any>().mockReturnValue({
      created_at: new Date().toISOString(),
      terminated_at: null,
      user_id: 'user-1',
    });
    mockQuotaSessionGet = jest.fn<any>().mockReturnValue({
      user_id: 'user-1',
    });
    mockLogTerminationEvent = jest.fn<any>();
    mockNotifySessionStopped = jest.fn<any>().mockResolvedValue(undefined);

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT terminated_at, termination_reason FROM sessions WHERE id = ?')) {
        return {
          get: mockAssertSessionGet,
          run: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
      }

      if (sql.includes('SELECT created_at, terminated_at, user_id FROM sessions WHERE id = ?')) {
        return {
          get: mockLifetimeSessionGet,
          run: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
      }

      if (sql.includes('SET terminated_at') && sql.includes('terminated_at IS NULL')) {
        return {
          get: jest.fn(),
          run: mockTerminateSessionRun,
          all: jest.fn().mockReturnValue([]),
        };
      }

      if (sql.includes('SELECT user_id FROM sessions WHERE id = ?')) {
        return {
          get: mockQuotaSessionGet,
          run: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
      }

      return {
        get: jest.fn(),
        run: jest.fn(),
        all: jest.fn().mockReturnValue([]),
      };
    });

    const dockerRuntimeService = {
      createContainer: jest.fn<any>(),
      startContainer: jest.fn<any>(),
      writeFileToContainer: mockWriteFileToContainer,
      readFileFromContainer: mockReadFileFromContainer,
      findContainerBySessionId: mockFindContainerBySessionId,
      stopContainer: mockStopContainer,
      removeContainer: mockRemoveContainer,
    };

    service = new SessionsService(
      {} as any,
      {
        notifySessionStarted: jest.fn<any>(),
        notifySessionStopped: mockNotifySessionStopped,
      } as any,
      dockerRuntimeService as any,
      {
        sessionMaxLifetimeMs: maxLifetimeMs,
        sessionIdleTimeoutMs: idleTimeoutMs,
        maxConcurrentExecsPerSession: 3,
      } as any,
      {} as any,
      { logTerminationEvent: mockLogTerminationEvent } as any,
      { hasUserExceededQuota: jest.fn<any>().mockReturnValue(false) } as any,
    );

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    resolveHungCleanup?.();
    resolveHungCleanup = undefined;
    resolveHungNotification?.();
    resolveHungNotification = undefined;
    consoleErrorSpy.mockRestore();
  });

  it('returns 410 with idle_timeout and skips Docker write for an expired session', async () => {
    const sessionId = 'sess-idle-expired';
    expireIdle(sessionId);

    let caught: unknown;
    try {
      await service.writeFileToContainer(sessionId, 'builder-intent-validation.txt', 'ok');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(GoneException);
    const gone = caught as GoneException;
    expect(gone.getStatus()).toBe(410);
    expect(gone.getResponse()).toEqual({
      statusCode: 410,
      message: `Session ${sessionId} expired due to inactivity (reason: idle_timeout)`,
      error: 'Gone',
    });
    expect(mockTerminateSessionRun).toHaveBeenCalledWith('idle_timeout', sessionId);
    expect(mockLogTerminationEvent).toHaveBeenCalledWith(
      sessionId,
      'user-1',
      'idle_timeout',
      expect.any(String),
    );
    expect(
      (service as unknown as { lastActivity: Map<string, number> }).lastActivity.has(sessionId),
    ).toBe(false);
    expect(mockWriteFileToContainer).not.toHaveBeenCalled();
  });

  it('returns 410 without waiting for slow container stop', async () => {
    const sessionId = 'sess-idle-nonblocking';
    expireIdle(sessionId);

    mockStopContainer.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveHungCleanup = resolve;
        }),
    );

    const outcome = await Promise.race([
      service
        .writeFileToContainer(sessionId, 'file.txt', 'x')
        .then(() => ({ type: 'ok' as const }))
        .catch((error) => ({ type: 'error' as const, error })),
      new Promise<{ type: 'timeout' }>((resolve) =>
        setTimeout(() => resolve({ type: 'timeout' }), 100),
      ),
    ]);

    expect(outcome.type).toBe('error');
    if (outcome.type !== 'error') {
      throw new Error('expected GoneException before cleanup completed');
    }
    expect(outcome.error).toBeInstanceOf(GoneException);
    expect((outcome.error as GoneException).getStatus()).toBe(410);
    expect(mockWriteFileToContainer).not.toHaveBeenCalled();
    expect(mockStopContainer).not.toHaveBeenCalled();

    await flushScheduledCleanup();
    expect(mockStopContainer).toHaveBeenCalled();
    expect(mockRemoveContainer).not.toHaveBeenCalled();
  });

  it('isolates asynchronous cleanup failure from the 410 caller result', async () => {
    const sessionId = 'sess-idle-cleanup-fail';
    expireIdle(sessionId);
    mockFindContainerBySessionId.mockRejectedValue(
      new Error(`Failed to find container for session ${sessionId}`),
    );

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    try {
      await expect(
        service.writeFileToContainer(sessionId, 'file.txt', 'x'),
      ).rejects.toBeInstanceOf(GoneException);

      await flushScheduledCleanup();
      await flushScheduledCleanup();

      expect(mockWriteFileToContainer).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to stop container for expired session ${sessionId}:`,
        `Failed to find container for session ${sessionId}`,
      );
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('treats an already-absent container as idempotent cleanup', async () => {
    const sessionId = 'sess-idle-missing-container';
    expireIdle(sessionId);
    mockFindContainerBySessionId.mockRejectedValue(
      new Error(`Container not found for session ${sessionId}`),
    );

    await expect(
      service.writeFileToContainer(sessionId, 'file.txt', 'x'),
    ).rejects.toBeInstanceOf(GoneException);

    await flushScheduledCleanup();
    await flushScheduledCleanup();

    expect(mockWriteFileToContainer).not.toHaveBeenCalled();
    expect(mockStopContainer).not.toHaveBeenCalled();
    expect(mockRemoveContainer).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('treats an already-stopped container as idempotent cleanup', async () => {
    const sessionId = 'sess-idle-stopped-container';
    expireIdle(sessionId);
    mockFindContainerBySessionId.mockResolvedValue({
      id: 'container-stopped',
      inspect: jest.fn<any>().mockResolvedValue({ State: { Running: false } }),
    });

    await expect(
      service.writeFileToContainer(sessionId, 'file.txt', 'x'),
    ).rejects.toBeInstanceOf(GoneException);

    await flushScheduledCleanup();
    await flushScheduledCleanup();

    expect(mockWriteFileToContainer).not.toHaveBeenCalled();
    expect(mockStopContainer).not.toHaveBeenCalled();
    expect(mockRemoveContainer).toHaveBeenCalledWith('container-stopped');
  });

  it('returns 410 for concurrent expiration detections without a generic server error', async () => {
    const sessionId = 'sess-idle-concurrent';
    expireIdle(sessionId);

    const results = await Promise.allSettled([
      service.writeFileToContainer(sessionId, 'a.txt', 'one'),
      service.writeFileToContainer(sessionId, 'b.txt', 'two'),
    ]);

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      if (result.status !== 'rejected') {
        throw new Error('expected both callers to receive 410');
      }
      expect(result.reason).toBeInstanceOf(GoneException);
      expect((result.reason as GoneException).getStatus()).toBe(410);
      expect((result.reason as GoneException).message).toContain('idle_timeout');
    }

    expect(mockWriteFileToContainer).not.toHaveBeenCalled();
    expect(mockTerminateSessionRun).toHaveBeenCalledWith('idle_timeout', sessionId);

    await flushScheduledCleanup();
    expect(mockFindContainerBySessionId).toHaveBeenCalledTimes(1);
  });

  it('preserves the fresh-session file write path', async () => {
    const sessionId = 'sess-fresh-write';
    markFresh(sessionId);

    await service.writeFileToContainer(sessionId, 'README.md', 'hello');

    expect(mockWriteFileToContainer).toHaveBeenCalledWith(
      sessionId,
      'README.md',
      'hello',
    );
    expect(mockTerminateSessionRun).not.toHaveBeenCalled();
    expect(mockFindContainerBySessionId).not.toHaveBeenCalled();
    expect(
      (service as unknown as { lastActivity: Map<string, number> }).lastActivity.get(sessionId),
    ).toBeGreaterThan(0);
  });

  it('returns the same deterministic 410 from a shared idle-guard read path', async () => {
    const sessionId = 'sess-idle-read';
    expireIdle(sessionId);

    await expect(service.readFileFromContainer(sessionId, 'README.md')).rejects.toMatchObject({
      status: 410,
    });
    expect(mockReadFileFromContainer).not.toHaveBeenCalled();
    expect(mockTerminateSessionRun).toHaveBeenCalledWith('idle_timeout', sessionId);
  });
});

describe('SessionsService cross-store lifecycle notification (PRIVATE-BETA-BLOCKER-03E-B)', () => {
  const idleTimeoutMs = 30 * 60 * 1000;
  const maxLifetimeMs = 60 * 60 * 1000;

  let service: SessionsService;
  let mockWriteFileToContainer: jest.Mock<any>;
  let mockFindContainerBySessionId: jest.Mock<any>;
  let mockStopContainer: jest.Mock<any>;
  let mockRemoveContainer: jest.Mock<any>;
  let mockTerminateSessionRun: jest.Mock<any>;
  let mockAssertSessionGet: jest.Mock<any>;
  let mockLifetimeSessionGet: jest.Mock<any>;
  let mockQuotaSessionGet: jest.Mock<any>;
  let mockNotifySessionStopped: jest.Mock<any>;
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;
  let resolveHungNotification: (() => void) | undefined;

  function expireIdle(sessionId: string): void {
    (service as unknown as { lastActivity: Map<string, number> }).lastActivity.set(
      sessionId,
      Date.now() - idleTimeoutMs - 1000,
    );
  }

  function markFresh(sessionId: string): void {
    (service as unknown as { lastActivity: Map<string, number> }).lastActivity.set(
      sessionId,
      Date.now(),
    );
  }

  async function flushScheduledSideEffects(): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve));
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    jest.clearAllMocks();
    resolveHungNotification = undefined;

    mockWriteFileToContainer = jest.fn<any>().mockResolvedValue(undefined);
    mockStopContainer = jest.fn<any>().mockResolvedValue(undefined);
    mockRemoveContainer = jest.fn<any>().mockResolvedValue(undefined);
    mockFindContainerBySessionId = jest.fn<any>().mockResolvedValue({
      id: 'container-expired',
      inspect: jest.fn<any>().mockResolvedValue({ State: { Running: true } }),
    });
    mockTerminateSessionRun = jest.fn<any>().mockReturnValue({ changes: 1 });
    mockAssertSessionGet = jest.fn<any>().mockReturnValue({
      terminated_at: null,
      termination_reason: null,
    });
    mockLifetimeSessionGet = jest.fn<any>().mockReturnValue({
      created_at: new Date().toISOString(),
      terminated_at: null,
      user_id: 'user-1',
    });
    mockQuotaSessionGet = jest.fn<any>().mockReturnValue({
      user_id: 'user-1',
    });
    mockNotifySessionStopped = jest.fn<any>().mockResolvedValue(undefined);

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT terminated_at, termination_reason FROM sessions WHERE id = ?')) {
        return {
          get: mockAssertSessionGet,
          run: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
      }

      if (sql.includes('SELECT created_at, terminated_at, user_id FROM sessions WHERE id = ?')) {
        return {
          get: mockLifetimeSessionGet,
          run: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
      }

      if (sql.includes('SET terminated_at') && sql.includes('terminated_at IS NULL')) {
        return {
          get: jest.fn(),
          run: mockTerminateSessionRun,
          all: jest.fn().mockReturnValue([]),
        };
      }

      if (sql.includes('SELECT user_id FROM sessions WHERE id = ?')) {
        return {
          get: mockQuotaSessionGet,
          run: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        };
      }

      return {
        get: jest.fn(),
        run: jest.fn(),
        all: jest.fn().mockReturnValue([]),
      };
    });

    const dockerRuntimeService = {
      createContainer: jest.fn<any>(),
      startContainer: jest.fn<any>(),
      writeFileToContainer: mockWriteFileToContainer,
      findContainerBySessionId: mockFindContainerBySessionId,
      stopContainer: mockStopContainer,
      removeContainer: mockRemoveContainer,
    };

    service = new SessionsService(
      {} as any,
      {
        notifySessionStarted: jest.fn<any>(),
        notifySessionStopped: mockNotifySessionStopped,
      } as any,
      dockerRuntimeService as any,
      {
        sessionMaxLifetimeMs: maxLifetimeMs,
        sessionIdleTimeoutMs: idleTimeoutMs,
        maxConcurrentExecsPerSession: 3,
      } as any,
      {} as any,
      { logTerminationEvent: jest.fn<any>() } as any,
      { hasUserExceededQuota: jest.fn<any>().mockReturnValue(false) } as any,
    );

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    resolveHungNotification?.();
    resolveHungNotification = undefined;
    consoleErrorSpy.mockRestore();
  });

  it('notifies Gateway of idle_timeout independently of the immediate 410', async () => {
    const sessionId = 'sess-idle-notify';
    expireIdle(sessionId);

    await expect(
      service.writeFileToContainer(sessionId, 'file.txt', 'x'),
    ).rejects.toMatchObject({
      status: 410,
      message: `Session ${sessionId} expired due to inactivity (reason: idle_timeout)`,
    });

    expect(mockTerminateSessionRun).toHaveBeenCalledWith('idle_timeout', sessionId);
    expect(mockWriteFileToContainer).not.toHaveBeenCalled();
    expect(mockNotifySessionStopped).not.toHaveBeenCalled();

    await flushScheduledSideEffects();

    expect(mockNotifySessionStopped).toHaveBeenCalledWith(sessionId, 'idle_timeout');
  });

  it('notifies Gateway of max_lifetime independently of the immediate 410', async () => {
    const sessionId = 'sess-lifetime-notify';
    markFresh(sessionId);
    mockLifetimeSessionGet.mockReturnValue({
      created_at: new Date(Date.now() - maxLifetimeMs - 1000).toISOString(),
      terminated_at: null,
      user_id: 'user-1',
    });

    await expect(
      service.writeFileToContainer(sessionId, 'file.txt', 'x'),
    ).rejects.toMatchObject({
      status: 410,
      message: `Session ${sessionId} expired due to max lifetime exceeded (reason: max_lifetime)`,
    });

    expect(mockTerminateSessionRun).toHaveBeenCalledWith('max_lifetime', sessionId);
    expect(mockWriteFileToContainer).not.toHaveBeenCalled();
    expect(mockNotifySessionStopped).not.toHaveBeenCalled();

    await flushScheduledSideEffects();

    expect(mockNotifySessionStopped).toHaveBeenCalledWith(sessionId, 'max_lifetime');
  });

  it('returns 410 without waiting for a slow Gateway notification', async () => {
    const sessionId = 'sess-idle-slow-notify';
    expireIdle(sessionId);

    mockNotifySessionStopped.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveHungNotification = resolve;
        }),
    );

    const outcome = await Promise.race([
      service
        .writeFileToContainer(sessionId, 'file.txt', 'x')
        .then(() => ({ type: 'ok' as const }))
        .catch((error) => ({ type: 'error' as const, error })),
      new Promise<{ type: 'timeout' }>((resolve) =>
        setTimeout(() => resolve({ type: 'timeout' }), 100),
      ),
    ]);

    expect(outcome.type).toBe('error');
    if (outcome.type !== 'error') {
      throw new Error('expected GoneException before notification completed');
    }
    expect(outcome.error).toBeInstanceOf(GoneException);
    expect((outcome.error as GoneException).getStatus()).toBe(410);
    expect(mockNotifySessionStopped).not.toHaveBeenCalled();
    expect(mockWriteFileToContainer).not.toHaveBeenCalled();

    await flushScheduledSideEffects();
    expect(mockNotifySessionStopped).toHaveBeenCalledWith(sessionId, 'idle_timeout');
  });

  it('isolates rejected Gateway notification from the 410 caller result', async () => {
    const sessionId = 'sess-idle-notify-fail';
    expireIdle(sessionId);
    mockNotifySessionStopped.mockRejectedValue(new Error('gateway unreachable'));

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    try {
      await expect(
        service.writeFileToContainer(sessionId, 'file.txt', 'x'),
      ).rejects.toBeInstanceOf(GoneException);

      await flushScheduledSideEffects();
      await flushScheduledSideEffects();

      expect(mockWriteFileToContainer).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to notify api-gateway of session idle_timeout termination ${sessionId}:`,
        'gateway unreachable',
      );
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('allows duplicate expiration notifications because Gateway terminate is idempotent', async () => {
    const sessionId = 'sess-idle-notify-concurrent';
    expireIdle(sessionId);

    const results = await Promise.allSettled([
      service.writeFileToContainer(sessionId, 'a.txt', 'one'),
      service.writeFileToContainer(sessionId, 'b.txt', 'two'),
    ]);

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      if (result.status !== 'rejected') {
        throw new Error('expected both callers to receive 410');
      }
      expect(result.reason).toBeInstanceOf(GoneException);
      expect((result.reason as GoneException).getStatus()).toBe(410);
    }

    await flushScheduledSideEffects();

    expect(mockNotifySessionStopped.mock.calls.length).toBeGreaterThanOrEqual(1);
    for (const call of mockNotifySessionStopped.mock.calls) {
      expect(call).toEqual([sessionId, 'idle_timeout']);
    }
  });
});
