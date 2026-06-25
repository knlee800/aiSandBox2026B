import { createBrowserSmokeHandler } from './browser-smoke-tool-handlers';

describe('browser-smoke-tool-handlers', () => {
  let mockClient: { runBrowserSmoke: jest.Mock };
  let handler: ReturnType<typeof createBrowserSmokeHandler>;

  beforeEach(() => {
    mockClient = {
      runBrowserSmoke: jest.fn(),
    };
    handler = createBrowserSmokeHandler({
      client: mockClient as any,
      sessionId: 'test-session-123',
      browserSmokeTimeoutMs: 120_000,
    });
  });

  it('should call runBrowserSmoke with default url "/" when url is not provided', async () => {
    mockClient.runBrowserSmoke.mockResolvedValue({
      success: true,
      url: 'http://172.17.0.2:3000/',
      pageTitle: 'App',
      consoleErrors: [],
      consoleWarnings: [],
      networkErrors: [],
      visibleTextSnippet: 'Hello',
      durationMs: 1000,
      truncated: false,
    });

    const result = await handler({});

    expect(mockClient.runBrowserSmoke).toHaveBeenCalledWith(
      'test-session-123',
      '/',
      120_000,
    );
    expect((result as any).success).toBe(true);
  });

  it('should pass url correctly when provided', async () => {
    mockClient.runBrowserSmoke.mockResolvedValue({
      success: true,
      url: 'http://172.17.0.2:3000/dashboard',
      pageTitle: 'Dashboard',
      consoleErrors: [],
      consoleWarnings: [],
      networkErrors: [],
      visibleTextSnippet: '',
      durationMs: 500,
      truncated: false,
    });

    await handler({ url: '/dashboard' });

    expect(mockClient.runBrowserSmoke).toHaveBeenCalledWith(
      'test-session-123',
      '/dashboard',
      120_000,
    );
  });

  it('should reject absolute URLs before making HTTP call', async () => {
    await expect(handler({ url: 'https://evil.com' })).rejects.toThrow(
      'Absolute URLs are not allowed',
    );

    expect(mockClient.runBrowserSmoke).not.toHaveBeenCalled();
  });

  it('should reject URLs not starting with /', async () => {
    await expect(handler({ url: 'relative/path' })).rejects.toThrow(
      'URL must be a relative path starting with /',
    );

    expect(mockClient.runBrowserSmoke).not.toHaveBeenCalled();
  });

  it('should reject non-string url values', async () => {
    await expect(handler({ url: 123 })).rejects.toThrow('url must be a string');
    expect(mockClient.runBrowserSmoke).not.toHaveBeenCalled();
  });

  it('should propagate structured failure results', async () => {
    mockClient.runBrowserSmoke.mockResolvedValue({
      success: false,
      url: 'http://172.17.0.2:3000/',
      pageTitle: '',
      consoleErrors: [],
      consoleWarnings: [],
      networkErrors: [],
      visibleTextSnippet: '',
      durationMs: 0,
      error: 'Preview target not available',
      truncated: false,
    });

    const result = await handler({ url: '/' });

    expect((result as any).success).toBe(false);
    expect((result as any).error).toBe('Preview target not available');
  });

  it('should propagate timeout via browserSmokeTimeoutMs', async () => {
    const customHandler = createBrowserSmokeHandler({
      client: mockClient as any,
      sessionId: 'sess-456',
      browserSmokeTimeoutMs: 60_000,
    });

    mockClient.runBrowserSmoke.mockResolvedValue({
      success: true,
      url: 'http://172.17.0.2:3000/',
      pageTitle: 'App',
      consoleErrors: [],
      consoleWarnings: [],
      networkErrors: [],
      visibleTextSnippet: '',
      durationMs: 200,
      truncated: false,
    });

    await customHandler({});

    expect(mockClient.runBrowserSmoke).toHaveBeenCalledWith(
      'sess-456',
      '/',
      60_000,
    );
  });

  it('should treat empty string url as default "/"', async () => {
    mockClient.runBrowserSmoke.mockResolvedValue({
      success: true,
      url: 'http://172.17.0.2:3000/',
      pageTitle: 'Home',
      consoleErrors: [],
      consoleWarnings: [],
      networkErrors: [],
      visibleTextSnippet: '',
      durationMs: 100,
      truncated: false,
    });

    await handler({ url: '' });

    expect(mockClient.runBrowserSmoke).toHaveBeenCalledWith(
      'test-session-123',
      '/',
      120_000,
    );
  });
});
