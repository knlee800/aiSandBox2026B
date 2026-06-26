import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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
