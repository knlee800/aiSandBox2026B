import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPrepare = jest.fn().mockReturnValue({
  get: jest.fn(),
  run: jest.fn(),
  all: jest.fn().mockReturnValue([]),
});

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
  let mockNotifySessionStarted: jest.Mock<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCreateContainer = jest.fn<any>().mockResolvedValue('container-abc');
    mockStartContainer = jest.fn<any>().mockResolvedValue(undefined);
    mockNotifySessionStarted = jest.fn<any>().mockResolvedValue(undefined);

    const dockerRuntimeService = {
      createContainer: mockCreateContainer,
      startContainer: mockStartContainer,
    };

    const apiGatewayClient = {
      notifySessionStarted: mockNotifySessionStarted,
    };

    service = new SessionsService(
      {} as any,
      apiGatewayClient as any,
      dockerRuntimeService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
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
