import * as path from 'path';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import {
  BrowserSmokeService,
  STATIC_FILE_RESOLVER_SOURCE,
  STATIC_PREVIEW_ORIGIN,
} from './browser-smoke.service';
import { PreviewProxyService } from '../previews/preview-proxy.service';
import { PreviewService as PreviewPortRegistry } from '../previews/preview.service';

describe('BrowserSmokeService', () => {
  let service: BrowserSmokeService;
  let mockDockerRuntimeService: {
    execInContainerBySessionId: jest.Mock;
  };
  let mockPreviewProxyService: {
    getProxyTarget: jest.Mock;
    getStaticRoot: jest.Mock;
  };

  beforeEach(() => {
    mockDockerRuntimeService = {
      execInContainerBySessionId: jest.fn(),
    };
    mockPreviewProxyService = {
      getProxyTarget: jest.fn(),
      // BROWSER-SMOKE-02: no static preview unless a test registers one.
      getStaticRoot: jest.fn().mockReturnValue(null),
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

  it('should use absolute image-owned playwright path in SMOKE_SCRIPT', async () => {
    mockPreviewProxyService.getProxyTarget.mockResolvedValue('http://172.17.0.2:3000');
    mockDockerRuntimeService.execInContainerBySessionId.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        success: true,
        url: 'http://172.17.0.2:3000/',
        pageTitle: 'Test',
        consoleErrors: [],
        consoleWarnings: [],
        networkErrors: [],
        visibleTextSnippet: '',
        durationMs: 100,
      }),
      stderr: '',
    });

    await service.run({ sessionId: 'sess-1', url: '/' });

    const callArgs = mockDockerRuntimeService.execInContainerBySessionId.mock.calls[0];
    const env = callArgs[3];
    expect(env.SMOKE_SCRIPT).toContain(
      "require('/opt/browser-smoke/node_modules/playwright')",
    );
    expect(env.SMOKE_SCRIPT).not.toMatch(/require\(\s*['"]playwright['"]\s*\)/);
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

  describe('BROWSER-SMOKE-02: static previews', () => {
    const okOutput = (url: string) => ({
      exitCode: 0,
      stdout: JSON.stringify({
        success: true,
        url,
        pageTitle: 'Static',
        consoleErrors: [],
        consoleWarnings: [],
        networkErrors: [],
        visibleTextSnippet: 'Hello',
        durationMs: 300,
      }),
      stderr: '',
    });

    it('uses a registered port over a static root, exactly as before', async () => {
      mockPreviewProxyService.getProxyTarget.mockResolvedValue('http://172.17.0.2:3000');
      mockPreviewProxyService.getStaticRoot.mockReturnValue('/workspace');
      mockDockerRuntimeService.execInContainerBySessionId.mockResolvedValue(
        okOutput('http://172.17.0.2:3000/about'),
      );

      const result = await service.run({ sessionId: 'sess-1', url: '/about' });

      expect(result.success).toBe(true);
      expect(result.url).toBe('http://172.17.0.2:3000/about');
      const env = mockDockerRuntimeService.execInContainerBySessionId.mock.calls[0][3];
      expect(Object.keys(env).sort()).toEqual(['SMOKE_SCRIPT', 'SMOKE_TIMEOUT_MS', 'SMOKE_URL']);
      expect(env.SMOKE_URL).toBe('http://172.17.0.2:3000/about');
      expect(mockPreviewProxyService.getStaticRoot).not.toHaveBeenCalled();
    });

    it('runs in static mode with SMOKE_STATIC_ROOT and the static-preview.invalid URL', async () => {
      mockPreviewProxyService.getProxyTarget.mockRejectedValue(
        new NotFoundException('No preview port registered for session sess-1'),
      );
      mockPreviewProxyService.getStaticRoot.mockReturnValue('/workspace/site');
      mockDockerRuntimeService.execInContainerBySessionId.mockResolvedValue(
        okOutput('http://static-preview.invalid/about.html'),
      );

      const result = await service.run({ sessionId: 'sess-1', url: '/about.html', timeoutMs: 60000 });

      expect(result.success).toBe(true);
      expect(result.url).toBe('http://static-preview.invalid/about.html');
      expect(mockPreviewProxyService.getStaticRoot).toHaveBeenCalledWith('sess-1');
      const [sessionId, cmd, workdir, env, execTimeout] =
        mockDockerRuntimeService.execInContainerBySessionId.mock.calls[0];
      expect(sessionId).toBe('sess-1');
      expect(cmd).toEqual(['sh', '-c', 'echo "$SMOKE_SCRIPT" | node']);
      expect(workdir).toBe('/workspace');
      expect(execTimeout).toBe(65000);
      expect(env.SMOKE_STATIC_ROOT).toBe('/workspace/site');
      expect(env.SMOKE_URL).toBe(`${STATIC_PREVIEW_ORIGIN}/about.html`);
      expect(env.SMOKE_URL).toBe('http://static-preview.invalid/about.html');
      expect(env.SMOKE_TIMEOUT_MS).toBe('50000');
    });

    it('defaults to / in static mode and still refuses an absolute url', async () => {
      mockPreviewProxyService.getProxyTarget.mockRejectedValue(new NotFoundException('none'));
      mockPreviewProxyService.getStaticRoot.mockReturnValue('/workspace');
      mockDockerRuntimeService.execInContainerBySessionId.mockResolvedValue(
        okOutput('http://static-preview.invalid/'),
      );

      await service.run({ sessionId: 'sess-1' });
      expect(mockDockerRuntimeService.execInContainerBySessionId.mock.calls[0][3].SMOKE_URL).toBe(
        'http://static-preview.invalid/',
      );

      await expect(
        service.run({ sessionId: 'sess-1', url: 'http://static-preview.invalid/x' }),
      ).rejects.toThrow('Absolute URLs are not allowed');
    });

    it('gives the same failure text as before when neither a port nor a static root is registered', async () => {
      mockPreviewProxyService.getProxyTarget.mockRejectedValue(
        new NotFoundException('No preview port registered for session sess-1'),
      );

      const result = await service.run({ sessionId: 'sess-1', url: '/' });

      expect(result.success).toBe(false);
      expect(result.url).toBe('/');
      expect(result.error).toBe(
        'Preview target not available: No preview port registered for session sess-1',
      );
      expect(mockDockerRuntimeService.execInContainerBySessionId).not.toHaveBeenCalled();
    });

    it('does not fall back to static mode when a registered port cannot be reached', async () => {
      mockPreviewProxyService.getProxyTarget.mockRejectedValue(
        new InternalServerErrorException('Container for session sess-1 is not running'),
      );
      mockPreviewProxyService.getStaticRoot.mockReturnValue('/workspace');

      const result = await service.run({ sessionId: 'sess-1', url: '/' });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Preview target not available: Container for session sess-1 is not running',
      );
      expect(mockDockerRuntimeService.execInContainerBySessionId).not.toHaveBeenCalled();
    });
  });
});

/**
 * BROWSER-SMOKE-02: the in-container script, without Playwright. The path
 * check is the exact source embedded in the script, evaluated here; the
 * whole script also runs here against a stand-in chromium, path and fs.
 */
type FakeEntry = 'file' | 'dir' | { link: string };

/** A posix fs stand-in: statSync and realpathSync over a fixed tree. */
function fakeFs(tree: Record<string, FakeEntry>) {
  const posix = path.posix;
  function realpath(p: string, depth = 0): string {
    if (depth > 20) {
      throw new Error('ELOOP');
    }
    const parts = posix.resolve(p).split('/').filter(Boolean);
    let current = '/';
    for (const part of parts) {
      current = posix.join(current, part);
      const entry = tree[current];
      if (entry && typeof entry === 'object') {
        current = realpath(entry.link, depth + 1);
      }
    }
    if (current !== '/' && !tree[current]) {
      throw new Error(`ENOENT: ${current}`);
    }
    return current;
  }
  return {
    realpathSync: (p: string) => realpath(p),
    statSync: (p: string) => {
      const real = realpath(p);
      const entry = real === '/' ? 'dir' : tree[real];
      return { isDirectory: () => entry === 'dir', isFile: () => entry === 'file' };
    },
  };
}

const TREE: Record<string, FakeEntry> = {
  '/workspace': 'dir',
  '/workspace/secret.txt': 'file',
  '/workspace/site': 'dir',
  '/workspace/site/index.html': 'file',
  '/workspace/site/about.html': 'file',
  '/workspace/site/my page.html': 'file',
  '/workspace/site/sub': 'dir',
  '/workspace/site/sub/index.html': 'file',
  '/workspace/site/empty': 'dir',
  '/workspace/site/inside-link.html': { link: '/workspace/site/about.html' },
  '/workspace/site/outside-link.txt': { link: '/etc/passwd' },
  '/workspace/site/outside-dir': { link: '/etc' },
  '/workspace/site2': 'dir',
  '/workspace/site2/x.html': 'file',
  '/etc': 'dir',
  '/etc/passwd': 'file',
};

describe('BROWSER-SMOKE-02: static path check embedded in the smoke script', () => {
  const resolveStaticFile = new Function(
    `${STATIC_FILE_RESOLVER_SOURCE}; return resolveStaticFile;`,
  )() as (
    pathLib: typeof path.posix,
    fs: ReturnType<typeof fakeFs>,
    root: string,
    pathname: string,
  ) => { status: number; filePath?: string };
  const fs = fakeFs(TREE);
  const resolve = (pathname: string, root = '/workspace/site') =>
    resolveStaticFile(path.posix, fs, root, pathname);

  it.each([
    ['/', '/workspace/site/index.html'],
    ['', '/workspace/site/index.html'],
    ['/about.html', '/workspace/site/about.html'],
    ['/sub', '/workspace/site/sub/index.html'],
    ['/sub/', '/workspace/site/sub/index.html'],
    ['/my%20page.html', '/workspace/site/my page.html'],
    ['/sub/../about.html', '/workspace/site/about.html'],
    ['/inside-link.html', '/workspace/site/about.html'],
  ])('serves %j as %s', (pathname, filePath) => {
    expect(resolve(pathname)).toEqual({ status: 200, filePath });
  });

  it.each([
    ['/../secret.txt'],
    ['/%2e%2e/secret.txt'],
    ['/a%2F..%2F..%2Fsecret.txt'],
    ['/../site2/x.html'],
    ['/../../etc/passwd'],
    ['/outside-link.txt'],
    ['/outside-dir/passwd'],
  ])('refuses %j outside the root with 403', (pathname) => {
    expect(resolve(pathname)).toEqual({ status: 403 });
  });

  it.each([['/missing.html'], ['/empty/'], ['/sub/missing.css']])('answers 404 for %j', (pathname) => {
    expect(resolve(pathname)).toEqual({ status: 404 });
  });

  it.each([['/%E0%A4%A'], ['/x%00y']])('answers 400 for %j', (pathname) => {
    expect(resolve(pathname)).toEqual({ status: 400 });
  });

  it('serves from /workspace itself when that is the root', () => {
    expect(resolve('/secret.txt', '/workspace')).toEqual({
      status: 200,
      filePath: '/workspace/secret.txt',
    });
    expect(resolve('/../etc/passwd', '/workspace')).toEqual({ status: 403 });
  });
});

describe('BROWSER-SMOKE-02: the smoke script in static mode, with a stand-in browser', () => {
  async function smokeScript(): Promise<string> {
    const exec = jest.fn().mockResolvedValue({ exitCode: 0, stdout: '{}', stderr: '' });
    const proxy = {
      getProxyTarget: jest.fn().mockRejectedValue(new NotFoundException('none')),
      getStaticRoot: jest.fn().mockReturnValue('/workspace/site'),
    };
    await new BrowserSmokeService({ execInContainerBySessionId: exec } as any, proxy as any).run({
      sessionId: 'sess-1',
    });
    return exec.mock.calls[0][3].SMOKE_SCRIPT as string;
  }

  type Fulfilled = Record<string, unknown>;

  /** Runs the script with a fake chromium; goto and extra requests go through the route. */
  async function runScript(env: Record<string, string>, extraRequests: string[] = []) {
    const script = await smokeScript();
    const routes: Array<{ match: (u: URL) => boolean; handler: (route: unknown) => Promise<void> }> = [];
    const fulfilled: Array<{ url: string; options: Fulfilled }> = [];
    const unrouted: string[] = [];

    async function request(url: string) {
      const hit = routes.find((r) => r.match(new URL(url)));
      if (!hit) {
        unrouted.push(url);
        return;
      }
      await hit.handler({
        request: () => ({ url: () => url }),
        fulfill: async (options: Fulfilled) => {
          fulfilled.push({ url, options });
        },
      });
    }

    const page = {
      on: () => undefined,
      route: async (match: (u: URL) => boolean, handler: (route: unknown) => Promise<void>) => {
        routes.push({ match, handler });
      },
      goto: async (url: string) => {
        await request(url);
        for (const extra of extraRequests) {
          await request(extra);
        }
      },
      title: async () => 'Static page',
      evaluate: async () => 'Hello',
    };
    const chromium = {
      launch: async () => ({
        newContext: async () => ({ newPage: async () => page }),
        close: async () => undefined,
      }),
    };
    const fakeRequire = (name: string) => {
      if (name === '/opt/browser-smoke/node_modules/playwright') return { chromium };
      if (name === 'path') return path;
      if (name === 'fs') return fakeFs(TREE);
      throw new Error(`unexpected require ${name}`);
    };

    let output = '';
    const done = new Promise<void>((resolve) => {
      const fakeConsole = {
        log: (line: string) => {
          output = line;
          resolve();
        },
      };
      new Function('require', 'process', 'console', 'URL', script)(
        fakeRequire,
        { env },
        fakeConsole,
        URL,
      );
    });
    await done;
    return { result: JSON.parse(output), routes, fulfilled, unrouted };
  }

  it('holds no backslash, since sh echo may expand escapes', async () => {
    const script = await smokeScript();
    expect(script).not.toContain('\\');
    expect(script).toContain(STATIC_FILE_RESOLVER_SOURCE);
    expect(script).toContain("process.env.SMOKE_STATIC_ROOT");
    expect(script).toContain(`const STATIC_ORIGIN = '${STATIC_PREVIEW_ORIGIN}';`);
  });

  it('routes only the static origin and serves files from the app root', async () => {
    const { result, routes, fulfilled, unrouted } = await runScript(
      {
        SMOKE_URL: 'http://static-preview.invalid/',
        SMOKE_TIMEOUT_MS: '5000',
        SMOKE_STATIC_ROOT: '/workspace/site',
      },
      [
        'http://static-preview.invalid/about.html',
        'http://static-preview.invalid/missing.css',
        'http://static-preview.invalid/a%2F..%2F..%2Fsecret.txt',
        'https://cdn.example.com/lib.js',
      ],
    );

    expect(result).toMatchObject({
      success: true,
      url: 'http://static-preview.invalid/',
      pageTitle: 'Static page',
      visibleTextSnippet: 'Hello',
    });
    expect(routes).toHaveLength(1);
    expect(routes[0].match(new URL('http://static-preview.invalid/x'))).toBe(true);
    expect(routes[0].match(new URL('https://static-preview.invalid/x'))).toBe(false);
    expect(routes[0].match(new URL('https://cdn.example.com/lib.js'))).toBe(false);
    expect(fulfilled).toEqual([
      { url: 'http://static-preview.invalid/', options: { path: '/workspace/site/index.html' } },
      { url: 'http://static-preview.invalid/about.html', options: { path: '/workspace/site/about.html' } },
      {
        url: 'http://static-preview.invalid/missing.css',
        options: { status: 404, contentType: 'text/plain', body: 'Not found' },
      },
      {
        url: 'http://static-preview.invalid/a%2F..%2F..%2Fsecret.txt',
        options: { status: 403, contentType: 'text/plain', body: 'Forbidden' },
      },
    ]);
    expect(unrouted).toEqual(['https://cdn.example.com/lib.js']);
  });

  it('adds no route without SMOKE_STATIC_ROOT (port mode)', async () => {
    const { result, routes, unrouted } = await runScript({
      SMOKE_URL: 'http://172.18.0.10:3001/',
      SMOKE_TIMEOUT_MS: '5000',
    });

    expect(result.success).toBe(true);
    expect(routes).toHaveLength(0);
    expect(unrouted).toEqual(['http://172.18.0.10:3001/']);
  });
});

/**
 * BROWSER-SMOKE-01: the real PreviewProxyService and port registry, so the
 * target comes from a registered preview port rather than a mocked proxy.
 */
describe('BrowserSmokeService with the preview port registry', () => {
  const sessionsService = { assertSessionUsable: jest.fn() };
  let dockerRuntimeService: {
    findContainerBySessionId: jest.Mock;
    execInContainerBySessionId: jest.Mock;
  };
  let registry: PreviewPortRegistry;
  let service: BrowserSmokeService;

  beforeEach(() => {
    dockerRuntimeService = {
      findContainerBySessionId: jest.fn().mockResolvedValue({
        inspect: async () => ({
          State: { Running: true },
          NetworkSettings: { Networks: { bridge: { IPAddress: '172.18.0.10' } } },
        }),
      }),
      execInContainerBySessionId: jest.fn().mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({
          success: true,
          url: 'http://172.18.0.10:3001/todo',
          pageTitle: 'Todo',
          consoleErrors: [],
          consoleWarnings: [],
          networkErrors: [],
          visibleTextSnippet: 'Todo list',
          durationMs: 800,
        }),
        stderr: '',
      }),
    };
    registry = new PreviewPortRegistry(sessionsService as any, dockerRuntimeService as any);
    service = new BrowserSmokeService(
      dockerRuntimeService as any,
      new PreviewProxyService(registry, dockerRuntimeService as any),
    );
  });

  it('builds the target URL from the registered port and runs the smoke script in the session', async () => {
    await registry.registerPreviewPort('sess-1', 3001);

    const result = await service.run({ sessionId: 'sess-1', url: '/todo' });

    expect(result.success).toBe(true);
    expect(result.pageTitle).toBe('Todo');
    expect(dockerRuntimeService.execInContainerBySessionId).toHaveBeenCalledTimes(1);
    const [sessionId, cmd, workdir, env] =
      dockerRuntimeService.execInContainerBySessionId.mock.calls[0];
    expect(sessionId).toBe('sess-1');
    expect(cmd).toEqual(['sh', '-c', 'echo "$SMOKE_SCRIPT" | node']);
    expect(workdir).toBe('/workspace');
    expect(env.SMOKE_URL).toBe('http://172.18.0.10:3001/todo');
  });

  it('still reports "Preview target not available" without a registered port, and runs nothing', async () => {
    const result = await service.run({ sessionId: 'sess-1' });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Preview target not available: No preview port registered for session sess-1',
    );
    expect(dockerRuntimeService.execInContainerBySessionId).not.toHaveBeenCalled();
  });
});
