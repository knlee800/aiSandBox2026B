import { BrowserSmokeService } from './browser-smoke.service';

describe('BrowserSmokeService', () => {
  let service: BrowserSmokeService;
  let mockDockerRuntimeService: {
    execInContainerBySessionId: jest.Mock;
  };
  let mockPreviewProxyService: {
    getProxyTarget: jest.Mock;
  };

  beforeEach(() => {
    mockDockerRuntimeService = {
      execInContainerBySessionId: jest.fn(),
    };
    mockPreviewProxyService = {
      getProxyTarget: jest.fn(),
    };
    service = new BrowserSmokeService(
      mockDockerRuntimeService as any,
      mockPreviewProxyService as any,
    );
  });

  it('should return structured success result on valid JSON output', async () => {
    mockPreviewProxyService.getProxyTarget.mockResolvedValue('http://172.17.0.2:3000');
    mockDockerRuntimeService.execInContainerBySessionId.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        success: true,
        url: 'http://172.17.0.2:3000/',
        pageTitle: 'My App',
        consoleErrors: [],
        consoleWarnings: [],
        networkErrors: [],
        visibleTextSnippet: 'Hello world',
        durationMs: 1500,
      }),
      stderr: '',
    });

    const result = await service.run({ sessionId: 'sess-1', url: '/' });

    expect(result.success).toBe(true);
    expect(result.url).toBe('http://172.17.0.2:3000/');
    expect(result.pageTitle).toBe('My App');
    expect(result.visibleTextSnippet).toBe('Hello world');
    expect(result.durationMs).toBe(1500);
    expect(result.truncated).toBe(false);
  });

  it('should default url to "/" when not provided', async () => {
    mockPreviewProxyService.getProxyTarget.mockResolvedValue('http://172.17.0.2:3000');
    mockDockerRuntimeService.execInContainerBySessionId.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        success: true,
        url: 'http://172.17.0.2:3000/',
        pageTitle: 'Home',
        consoleErrors: [],
        consoleWarnings: [],
        networkErrors: [],
        visibleTextSnippet: '',
        durationMs: 500,
      }),
      stderr: '',
    });

    await service.run({ sessionId: 'sess-1' });

    const callArgs = mockDockerRuntimeService.execInContainerBySessionId.mock.calls[0];
    const env = callArgs[3];
    expect(env.SMOKE_URL).toBe('http://172.17.0.2:3000/');
  });

  it('should reject absolute URLs containing "://"', async () => {
    const result = service.run({
      sessionId: 'sess-1',
      url: 'https://evil.com/hack',
    });

    await expect(result).rejects.toThrow('Absolute URLs are not allowed');
  });

  it('should reject URLs not starting with "/"', async () => {
    const result = service.run({
      sessionId: 'sess-1',
      url: 'dashboard',
    });

    await expect(result).rejects.toThrow('URL must be a relative path starting with /');
  });

  it('should return structured failure when preview target is missing', async () => {
    mockPreviewProxyService.getProxyTarget.mockRejectedValue(
      new Error('No preview port registered for session sess-1'),
    );

    const result = await service.run({ sessionId: 'sess-1', url: '/' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Preview target not available');
  });

  it('should return structured failure when exec fails', async () => {
    mockPreviewProxyService.getProxyTarget.mockResolvedValue('http://172.17.0.2:3000');
    mockDockerRuntimeService.execInContainerBySessionId.mockRejectedValue(
      new Error('Container not running'),
    );

    const result = await service.run({ sessionId: 'sess-1', url: '/' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Exec failed');
  });

  it('should return structured failure when script outputs non-JSON', async () => {
    mockPreviewProxyService.getProxyTarget.mockResolvedValue('http://172.17.0.2:3000');
    mockDockerRuntimeService.execInContainerBySessionId.mockResolvedValue({
      exitCode: 1,
      stdout: 'Error: playwright not found',
      stderr: 'command not found: npx',
    });

    const result = await service.run({ sessionId: 'sess-1', url: '/' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Script exited with code 1');
  });

  it('should truncate console errors exceeding limits', async () => {
    const longErrors = Array.from({ length: 15 }, (_, i) => 'E'.repeat(600) + i);
    mockPreviewProxyService.getProxyTarget.mockResolvedValue('http://172.17.0.2:3000');
    mockDockerRuntimeService.execInContainerBySessionId.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        success: true,
        url: 'http://172.17.0.2:3000/',
        pageTitle: 'App',
        consoleErrors: longErrors,
        consoleWarnings: [],
        networkErrors: [],
        visibleTextSnippet: '',
        durationMs: 100,
      }),
      stderr: '',
    });

    const result = await service.run({ sessionId: 'sess-1', url: '/' });

    expect(result.consoleErrors.length).toBe(10);
    expect(result.consoleErrors[0].length).toBe(500);
    expect(result.truncated).toBe(true);
  });

  it('should truncate visibleTextSnippet exceeding 2000 chars', async () => {
    const longText = 'X'.repeat(3000);
    mockPreviewProxyService.getProxyTarget.mockResolvedValue('http://172.17.0.2:3000');
    mockDockerRuntimeService.execInContainerBySessionId.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        success: true,
        url: 'http://172.17.0.2:3000/',
        pageTitle: 'App',
        consoleErrors: [],
        consoleWarnings: [],
        networkErrors: [],
        visibleTextSnippet: longText,
        durationMs: 200,
      }),
      stderr: '',
    });

    const result = await service.run({ sessionId: 'sess-1', url: '/' });

    expect(result.visibleTextSnippet.length).toBe(2000);
    expect(result.truncated).toBe(true);
  });

  it('should pass environment variables without URL interpolation', async () => {
    mockPreviewProxyService.getProxyTarget.mockResolvedValue('http://172.17.0.2:3000');
    mockDockerRuntimeService.execInContainerBySessionId.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        success: true,
        url: 'http://172.17.0.2:3000/test',
        pageTitle: 'Test',
        consoleErrors: [],
        consoleWarnings: [],
        networkErrors: [],
        visibleTextSnippet: '',
        durationMs: 100,
      }),
      stderr: '',
    });

    await service.run({ sessionId: 'sess-1', url: '/test', timeoutMs: 60000 });

    const callArgs = mockDockerRuntimeService.execInContainerBySessionId.mock.calls[0];
    expect(callArgs[0]).toBe('sess-1');
    expect(callArgs[1]).toEqual(['sh', '-c', 'echo "$SMOKE_SCRIPT" | node']);
    expect(callArgs[2]).toBe('/workspace');

    const env = callArgs[3];
    expect(env.SMOKE_URL).toBe('http://172.17.0.2:3000/test');
    expect(env.SMOKE_TIMEOUT_MS).toBe('50000');
    expect(typeof env.SMOKE_SCRIPT).toBe('string');
    expect(env.SMOKE_SCRIPT.length).toBeGreaterThan(100);
  });

  it('should return structured failure result on script failure JSON', async () => {
    mockPreviewProxyService.getProxyTarget.mockResolvedValue('http://172.17.0.2:3000');
    mockDockerRuntimeService.execInContainerBySessionId.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        success: false,
        url: 'http://172.17.0.2:3000/',
        pageTitle: '',
        consoleErrors: ['TypeError: foo is not defined'],
        consoleWarnings: [],
        networkErrors: [],
        visibleTextSnippet: '',
        durationMs: 800,
        error: 'Navigation failed: net::ERR_CONNECTION_REFUSED',
      }),
      stderr: '',
    });

    const result = await service.run({ sessionId: 'sess-1', url: '/' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Navigation failed: net::ERR_CONNECTION_REFUSED');
    expect(result.consoleErrors).toEqual(['TypeError: foo is not defined']);
  });
});
