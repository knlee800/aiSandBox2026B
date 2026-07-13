import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders } from 'axios';
import { ApiGatewayHttpClient } from './api-gateway-http.client';

function makeAxiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}

describe('ApiGatewayHttpClient - workspace file methods', () => {
  let client: ApiGatewayHttpClient;
  let httpService: { get: jest.Mock; post: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    process.env.API_GATEWAY_URL = 'http://localhost:4000';
    process.env.INTERNAL_SERVICE_KEY = 'test-key-123';

    httpService = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiGatewayHttpClient,
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    client = module.get<ApiGatewayHttpClient>(ApiGatewayHttpClient);
  });

  afterEach(() => {
    delete process.env.API_GATEWAY_URL;
    delete process.env.INTERNAL_SERVICE_KEY;
  });

  describe('readWorkspaceFile', () => {
    it('calls API Gateway internal workspace read endpoint with correct params', async () => {
      httpService.get.mockReturnValue(
        of(makeAxiosResponse({ path: 'src/app.ts', content: 'const x = 1;' })),
      );

      const result = await client.readWorkspaceFile('session-1', 'src/app.ts');

      expect(httpService.get).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/workspace/session-1/read',
        {
          params: { path: 'src/app.ts' },
          signal: undefined,
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
      expect(result).toEqual({ path: 'src/app.ts', content: 'const x = 1;' });
    });

    it('includes AbortSignal in readWorkspaceFile request config', async () => {
      httpService.get.mockReturnValue(
        of(makeAxiosResponse({ path: 'src/app.ts', content: 'const x = 1;' })),
      );
      const signal = new AbortController().signal;

      await client.readWorkspaceFile('session-1', 'src/app.ts', signal);

      expect(httpService.get).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/workspace/session-1/read',
        {
          params: { path: 'src/app.ts' },
          signal,
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
    });

    it('propagates upstream errors', async () => {
      httpService.get.mockReturnValue(
        throwError(() => new Error('Network failure')),
      );

      await expect(
        client.readWorkspaceFile('session-1', 'missing.ts'),
      ).rejects.toThrow('Network failure');
    });
  });

  describe('listWorkspaceDirectory', () => {
    it('calls API Gateway internal workspace list endpoint with correct params', async () => {
      httpService.get.mockReturnValue(
        of(
          makeAxiosResponse({
            path: 'src',
            entries: [
              { name: 'app.ts', type: 'file', size: 100, modifiedAt: '2026-01-01T00:00:00Z' },
            ],
          }),
        ),
      );

      const result = await client.listWorkspaceDirectory('session-1', 'src');

      expect(httpService.get).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/workspace/session-1/list',
        {
          params: { path: 'src' },
          signal: undefined,
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].name).toBe('app.ts');
    });

    it('defaults path to / when not provided', async () => {
      httpService.get.mockReturnValue(
        of(makeAxiosResponse({ path: '/', entries: [] })),
      );

      await client.listWorkspaceDirectory('session-1');

      expect(httpService.get).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/workspace/session-1/list',
        {
          params: { path: '/' },
          signal: undefined,
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
    });

    it('includes AbortSignal in listWorkspaceDirectory request config', async () => {
      httpService.get.mockReturnValue(
        of(makeAxiosResponse({ path: 'src', entries: [] })),
      );
      const signal = new AbortController().signal;

      await client.listWorkspaceDirectory('session-1', 'src', signal);

      expect(httpService.get).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/workspace/session-1/list',
        {
          params: { path: 'src' },
          signal,
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
    });

    it('propagates upstream errors', async () => {
      httpService.get.mockReturnValue(
        throwError(() => new Error('Service unavailable')),
      );

      await expect(
        client.listWorkspaceDirectory('session-1', 'src'),
      ).rejects.toThrow('Service unavailable');
    });
  });

  describe('writeWorkspaceFile', () => {
    it('calls API Gateway internal workspace write endpoint with correct body', async () => {
      httpService.post.mockReturnValue(
        of(makeAxiosResponse({ ok: true })),
      );

      await client.writeWorkspaceFile('session-1', 'src/app.ts', 'const x = 1;');

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/workspace/session-1/write',
        { path: 'src/app.ts', content: 'const x = 1;' },
        {
          signal: undefined,
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
    });

    it('includes AbortSignal in writeWorkspaceFile request config', async () => {
      httpService.post.mockReturnValue(
        of(makeAxiosResponse({ ok: true })),
      );
      const signal = new AbortController().signal;

      await client.writeWorkspaceFile('session-1', 'src/app.ts', 'const x = 1;', signal);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/workspace/session-1/write',
        { path: 'src/app.ts', content: 'const x = 1;' },
        {
          signal,
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
    });

    it('propagates upstream errors', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('Write failed')),
      );

      await expect(
        client.writeWorkspaceFile('session-1', 'file.ts', 'content'),
      ).rejects.toThrow('Write failed');
    });
  });

  describe('deleteWorkspaceFile', () => {
    it('calls API Gateway internal workspace delete endpoint with correct body', async () => {
      httpService.delete.mockReturnValue(
        of(makeAxiosResponse({ ok: true })),
      );

      await client.deleteWorkspaceFile('session-1', 'src/old.ts');

      expect(httpService.delete).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/workspace/session-1/delete',
        {
          data: { path: 'src/old.ts' },
          signal: undefined,
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
    });

    it('includes AbortSignal in deleteWorkspaceFile request config', async () => {
      httpService.delete.mockReturnValue(
        of(makeAxiosResponse({ ok: true })),
      );
      const signal = new AbortController().signal;

      await client.deleteWorkspaceFile('session-1', 'src/old.ts', signal);

      expect(httpService.delete).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/workspace/session-1/delete',
        {
          data: { path: 'src/old.ts' },
          signal,
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
    });

    it('propagates upstream errors', async () => {
      httpService.delete.mockReturnValue(
        throwError(() => new Error('Delete failed')),
      );

      await expect(
        client.deleteWorkspaceFile('session-1', 'missing.ts'),
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('runWorkspaceValidation', () => {
    it('calls API Gateway internal workspace validate endpoint with correct body', async () => {
      httpService.post.mockReturnValue(
        of(makeAxiosResponse({ exitCode: 0, stdout: 'PASS', stderr: '' })),
      );

      const result = await client.runWorkspaceValidation('session-1', 'npm test', 60000);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/workspace/session-1/validate',
        { command: 'npm test', timeoutMs: 60000 },
        {
          signal: undefined,
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
      expect(result).toEqual({ exitCode: 0, stdout: 'PASS', stderr: '' });
    });

    it('returns exitCode, stdout, and stderr from response', async () => {
      httpService.post.mockReturnValue(
        of(makeAxiosResponse({ exitCode: 1, stdout: '', stderr: 'Build error' })),
      );

      const result = await client.runWorkspaceValidation('session-1', 'npm run build', 120000);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('Build error');
    });

    it('propagates upstream errors', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('Validation failed')),
      );

      await expect(
        client.runWorkspaceValidation('session-1', 'npm test', 60000),
      ).rejects.toThrow('Validation failed');
    });

    it('includes AbortSignal in runWorkspaceValidation request config', async () => {
      httpService.post.mockReturnValue(
        of(makeAxiosResponse({ exitCode: 0, stdout: 'PASS', stderr: '' })),
      );
      const signal = new AbortController().signal;

      await client.runWorkspaceValidation('session-1', 'npm test', 60000, signal);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/workspace/session-1/validate',
        { command: 'npm test', timeoutMs: 60000 },
        {
          signal,
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
    });
  });

  describe('createWorkspaceCheckpoint', () => {
    it('calls API Gateway internal workspace checkpoint endpoint with internal service key', async () => {
      httpService.post.mockReturnValue(
        of(makeAxiosResponse({ commitHash: 'abc123', filesChanged: 2 })),
      );

      const result = await client.createWorkspaceCheckpoint(
        'session-1',
        'Pre-apply checkpoint',
      );

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/workspace/session-1/checkpoint',
        { description: 'Pre-apply checkpoint' },
        {
          signal: undefined,
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
      expect(result).toEqual({ commitHash: 'abc123', filesChanged: 2 });
    });

    it('returns commitHash and filesChanged from response', async () => {
      httpService.post.mockReturnValue(
        of(makeAxiosResponse({ commitHash: 'def456', filesChanged: 0 })),
      );

      const result = await client.createWorkspaceCheckpoint('session-1');

      expect(result.commitHash).toBe('def456');
      expect(result.filesChanged).toBe(0);
    });

    it('propagates non-2xx errors', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('Checkpoint failed')),
      );

      await expect(
        client.createWorkspaceCheckpoint('session-1', 'test'),
      ).rejects.toThrow('Checkpoint failed');
    });

    it('includes AbortSignal in createWorkspaceCheckpoint request config', async () => {
      httpService.post.mockReturnValue(
        of(makeAxiosResponse({ commitHash: 'ghi789', filesChanged: 1 })),
      );
      const signal = new AbortController().signal;

      await client.createWorkspaceCheckpoint('session-1', 'checkpoint', signal);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/workspace/session-1/checkpoint',
        { description: 'checkpoint' },
        {
          signal,
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
    });
  });

  describe('notifyExecutionComplete', () => {
    it('posts to /api/internal/executions/:executionId/finalize-accounting with internal service key', async () => {
      httpService.post.mockReturnValue(
        of(makeAxiosResponse({ executionId: 'exec-1', triggered: true, reason: 'completed' })),
      );

      await client.notifyExecutionComplete('exec-1');

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/executions/exec-1/finalize-accounting',
        {},
        {
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
    });

    it('suppresses errors and does not throw', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('Network failure')),
      );

      await expect(client.notifyExecutionComplete('exec-err')).resolves.toBeUndefined();
    });

    it('logs warning on failure', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      httpService.post.mockReturnValue(
        throwError(() => new Error('Service unavailable')),
      );

      await client.notifyExecutionComplete('exec-warn');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('notifyExecutionComplete failed for executionId=exec-warn'),
      );
      warnSpy.mockRestore();
    });
  });

  describe('runBrowserSmoke', () => {
    it('preserves timeout and includes signal in runBrowserSmoke request config', async () => {
      httpService.post.mockReturnValue(
        of(
          makeAxiosResponse({
            success: true,
            url: 'http://172.17.0.2:3000/',
            pageTitle: 'App',
            consoleErrors: [],
            consoleWarnings: [],
            networkErrors: [],
            visibleTextSnippet: '',
            durationMs: 1000,
            truncated: false,
          }),
        ),
      );
      const signal = new AbortController().signal;

      await client.runBrowserSmoke('session-1', '/', 45_000, signal);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:4000/api/internal/workspace/session-1/browser-smoke',
        { url: '/', timeoutMs: 45_000 },
        {
          timeout: 55_000,
          signal,
          headers: { 'X-Internal-Service-Key': 'test-key-123' },
        },
      );
    });
  });
});
