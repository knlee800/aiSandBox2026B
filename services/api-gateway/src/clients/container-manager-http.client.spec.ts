import axios from 'axios';
import { HttpException } from '@nestjs/common';
import { ContainerManagerHttpClient } from './container-manager-http.client';
import { SessionService } from '../sessions/session.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ContainerManagerHttpClient file operations', () => {
  let client: ContainerManagerHttpClient;
  let mockAxiosInstance: { delete: jest.Mock; post: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_SERVICE_KEY = 'test-internal-key';

    mockAxiosInstance = {
      delete: jest.fn(),
      post: jest.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

    client = new ContainerManagerHttpClient();
    client.onModuleInit();
  });

  afterEach(() => {
    delete process.env.INTERNAL_SERVICE_KEY;
  });

  it('calls the internal sessions file delete endpoint', async () => {
    mockAxiosInstance.delete.mockResolvedValue({ data: undefined });

    await client.deleteSessionFile('session-123', 'src/old.ts');

    expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
      '/api/internal/sessions/session-123/files',
      {
        data: { path: 'src/old.ts' },
        headers: {
          'X-Internal-Service-Key': 'test-internal-key',
        },
      },
    );
  });

  it('calls the bounded container-manager file search endpoint', async () => {
    const expected = {
      query: 'login',
      results: [{ path: 'src/app.ts', line: 12, preview: 'const login = true;' }],
      truncated: false,
    };
    mockAxiosInstance.post.mockResolvedValue({ data: expected });

    const result = await client.searchSessionFiles('session-123', 'login');

    expect(result).toEqual(expected);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/internal/sessions/session-123/files/search',
      { query: 'login' },
      {
        headers: {
          'X-Internal-Service-Key': 'test-internal-key',
        },
      },
    );
  });
});

describe('ContainerManagerHttpClient 410 lazy reconciliation (PRIVATE-BETA-BLOCKER-03E-B)', () => {
  let client: ContainerManagerHttpClient;
  let mockAxiosInstance: { post: jest.Mock };
  let terminateSession: jest.Mock;
  let consoleErrorSpy: jest.SpyInstance;

  function goneError(message: string): Error {
    const axiosError: any = new Error('Request failed');
    axiosError.isAxiosError = true;
    axiosError.response = {
      status: 410,
      data: {
        statusCode: 410,
        message,
        error: 'Gone',
      },
    };
    return axiosError;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_SERVICE_KEY = 'test-internal-key';
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    mockAxiosInstance = {
      post: jest.fn(),
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as never);
    (mockedAxios.isAxiosError as unknown as jest.Mock) = jest.fn((error: unknown) =>
      Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
    );

    terminateSession = jest.fn().mockResolvedValue(undefined);
    client = new ContainerManagerHttpClient({
      terminateSession,
    } as unknown as SessionService);
    client.onModuleInit();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    delete process.env.INTERNAL_SERVICE_KEY;
  });

  it('reconciles Postgres on container-manager 410 and preserves 410 to the caller', async () => {
    const sessionId = 'session-410';
    mockAxiosInstance.post.mockRejectedValue(
      goneError(`Session ${sessionId} expired due to inactivity (reason: idle_timeout)`),
    );

    await expect(
      client.writeSessionFile(sessionId, 'file.txt', 'content'),
    ).rejects.toMatchObject({
      status: 410,
      message: `Session ${sessionId} expired due to inactivity (reason: idle_timeout)`,
    });

    expect(terminateSession).toHaveBeenCalledWith(sessionId, 'idle_timeout');
  });

  it('preserves max_lifetime as the persisted termination reason', async () => {
    const sessionId = 'session-lifetime-410';
    mockAxiosInstance.post.mockRejectedValue(
      goneError(
        `Session ${sessionId} expired due to max lifetime exceeded (reason: max_lifetime)`,
      ),
    );

    try {
      await client.writeSessionFile(sessionId, 'file.txt', 'content');
      throw new Error('expected HttpException');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(410);
    }

    expect(terminateSession).toHaveBeenCalledWith(sessionId, 'max_lifetime');
  });

  it('does not reconcile a non-410 upstream error as terminated', async () => {
    const axiosError: any = new Error('Request failed');
    axiosError.isAxiosError = true;
    axiosError.response = {
      status: 500,
      data: { message: 'internal error', statusCode: 500 },
    };
    mockAxiosInstance.post.mockRejectedValue(axiosError);

    await expect(
      client.writeSessionFile('session-500', 'file.txt', 'content'),
    ).rejects.toMatchObject({
      status: 500,
    });

    expect(terminateSession).not.toHaveBeenCalled();
  });

  it('does not reconcile a timeout/502-class error as terminated', async () => {
    const axiosError: any = new Error('timeout of 10000ms exceeded');
    axiosError.isAxiosError = true;
    axiosError.code = 'ECONNABORTED';
    mockAxiosInstance.post.mockRejectedValue(axiosError);

    await expect(
      client.writeSessionFile('session-timeout', 'file.txt', 'content'),
    ).rejects.toMatchObject({
      status: 502,
    });

    expect(terminateSession).not.toHaveBeenCalled();
  });

  it('preserves 410 when Postgres reconciliation itself fails', async () => {
    const sessionId = 'session-recon-fail';
    terminateSession.mockRejectedValue(new Error('database write failed'));
    mockAxiosInstance.post.mockRejectedValue(
      goneError(`Session ${sessionId} expired due to inactivity (reason: idle_timeout)`),
    );

    await expect(
      client.writeSessionFile(sessionId, 'file.txt', 'content'),
    ).rejects.toMatchObject({
      status: 410,
      message: `Session ${sessionId} expired due to inactivity (reason: idle_timeout)`,
    });

    expect(terminateSession).toHaveBeenCalledWith(sessionId, 'idle_timeout');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Failed to reconcile Postgres session ${sessionId} after container-manager 410:`,
      'database write failed',
    );
  });

  it('does not reconcile a successful fresh-session write', async () => {
    mockAxiosInstance.post.mockResolvedValue({ data: undefined });

    await client.writeSessionFile('session-fresh', 'README.md', 'hello');

    expect(terminateSession).not.toHaveBeenCalled();
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/api/internal/sessions/session-fresh/files',
      { path: 'README.md', content: 'hello' },
      {
        headers: {
          'X-Internal-Service-Key': 'test-internal-key',
        },
      },
    );
  });
});
