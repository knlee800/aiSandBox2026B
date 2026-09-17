import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common/enums/request-method.enum';
import axios from 'axios';
import { PreviewController } from './preview.controller';
import { PreviewService } from './preview.service';

jest.mock('axios');

describe('PreviewService readStaticPreviewContent', () => {
  let service: PreviewService;

  const sessionsService = {
    assertSessionUsable: jest.fn(),
  };

  const dockerRuntimeService = {
    readFileFromContainer: jest.fn<(sessionId: string, filePath: string) => Promise<string>>(),
  };

  const previewStrategyResolver = {};

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PreviewService(
      sessionsService as any,
      dockerRuntimeService as any,
      previewStrategyResolver as any,
    );
  });

  it('injects a base tag immediately after a plain head tag', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><head><title>Preview</title></head><body><a href="page2.html">Next</a></body></html>',
    );

    const result = await service.readStaticPreviewContent('session-123', '/index.html');

    expect(result.contentType).toBe('text/html; charset=utf-8');
    expect(result.content).toContain(
      '<head><base href="/api/preview/session-123/proxy/"><title>Preview</title></head>',
    );
  });

  it('injects a base tag immediately after a head tag with attributes', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><head data-test="preview"><title>Preview</title></head></html>',
    );

    const result = await service.readStaticPreviewContent('session-123', '/index.html');

    expect(result.content).toContain(
      '<head data-test="preview"><base href="/api/preview/session-123/proxy/"><title>Preview</title></head>',
    );
  });

  it('prepends a base tag when no head tag is present', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><body><a href="./page2.html">Next</a></body></html>',
    );

    const result = await service.readStaticPreviewContent('session-123', '/index.html');

    expect(result.content.startsWith('<base href="/api/preview/session-123/proxy/">')).toBe(true);
  });

  it('does not double inject when a base tag already exists', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><head><base href="/custom/"><title>Preview</title></head></html>',
    );

    const result = await service.readStaticPreviewContent('session-123', '/index.html');

    expect(result.content).toBe(
      '<html><head><base href="/custom/"><title>Preview</title></head></html>',
    );
    expect(result.content.match(/<base\b/gi)).toHaveLength(1);
  });

  it('leaves non-html content unchanged', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue('body { color: red; }');

    const result = await service.readStaticPreviewContent('session-123', '/styles.css');

    expect(result.contentType).toBe('text/css; charset=utf-8');
    expect(result.content).toBe('body { color: red; }');
  });

  it('url-encodes the session id in the injected href', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue('<html><head></head></html>');

    const result = await service.readStaticPreviewContent('session with spaces', '/index.html');

    expect(result.content).toContain(
      '<base href="/api/preview/session%20with%20spaces/proxy/">',
    );
  });

  it('rejects path traversal attempts', async () => {
    await expect(
      service.readStaticPreviewContent('session-123', '/../etc/passwd'),
    ).rejects.toThrow('Invalid static preview path');
  });

  it('rejects embedded path traversal', async () => {
    await expect(
      service.readStaticPreviewContent('session-123', '/assets/../../etc/passwd'),
    ).rejects.toThrow('Invalid static preview path');
  });
});

describe('PreviewService subdirectory appRoot routing', () => {
  let service: PreviewService;

  const sessionsService = {
    assertSessionUsable: jest.fn(),
  };

  const dockerRuntimeService = {
    readFileFromContainer: jest.fn<(sessionId: string, filePath: string) => Promise<string>>(),
  };

  const previewStrategyResolver = {
    resolve: jest.fn<(...args: any[]) => Promise<any>>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new PreviewService(
      sessionsService as any,
      dockerRuntimeService as any,
      previewStrategyResolver as any,
    );

    previewStrategyResolver.resolve.mockResolvedValue({
      type: 'static-html',
      framework: 'Static HTML',
      command: 'npx serve -s . -l tcp://0.0.0.0:$PORT',
      appRoot: '/workspace/WorkspaceA',
      servingMode: 'direct-read',
    });

    await service.startPreview('session-sub');
  });

  it('resolves index from subdirectory appRoot', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><head></head><body>Index</body></html>',
    );

    await service.readStaticPreviewContent('session-sub', '/');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-sub',
      'WorkspaceA/index.html',
    );
  });

  it('resolves page2.html from subdirectory appRoot', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><head></head><body>Page 2</body></html>',
    );

    await service.readStaticPreviewContent('session-sub', '/page2.html');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-sub',
      'WorkspaceA/page2.html',
    );
  });

  it('resolves style.css from subdirectory appRoot', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue('body { color: red; }');

    const result = await service.readStaticPreviewContent('session-sub', '/style.css');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-sub',
      'WorkspaceA/style.css',
    );
    expect(result.contentType).toBe('text/css; charset=utf-8');
  });

  it('resolves script.js from subdirectory appRoot', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue('console.log("ok");');

    const result = await service.readStaticPreviewContent('session-sub', '/script.js');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-sub',
      'WorkspaceA/script.js',
    );
    expect(result.contentType).toBe('application/javascript; charset=utf-8');
  });

  it('resolves nested asset paths from subdirectory appRoot', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue('PNG_DATA');

    const result = await service.readStaticPreviewContent('session-sub', '/images/logo.png');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-sub',
      'WorkspaceA/images/logo.png',
    );
    expect(result.contentType).toBe('image/png');
  });

  it('injects base tag into subdirectory HTML responses', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><head><title>Sub</title></head><body>Hello</body></html>',
    );

    const result = await service.readStaticPreviewContent('session-sub', '/');

    expect(result.content).toContain(
      '<base href="/api/preview/session-sub/proxy/">',
    );
  });
});

describe('PreviewService root appRoot routing', () => {
  let service: PreviewService;

  const sessionsService = {
    assertSessionUsable: jest.fn(),
  };

  const dockerRuntimeService = {
    readFileFromContainer: jest.fn<(sessionId: string, filePath: string) => Promise<string>>(),
  };

  const previewStrategyResolver = {
    resolve: jest.fn<(...args: any[]) => Promise<any>>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new PreviewService(
      sessionsService as any,
      dockerRuntimeService as any,
      previewStrategyResolver as any,
    );

    previewStrategyResolver.resolve.mockResolvedValue({
      type: 'static-html',
      framework: 'Static HTML',
      command: 'npx serve -s . -l tcp://0.0.0.0:$PORT',
      appRoot: '/workspace',
      servingMode: 'direct-read',
    });

    await service.startPreview('session-root');
  });

  it('resolves index from workspace root', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue(
      '<html><head></head><body>Root</body></html>',
    );

    await service.readStaticPreviewContent('session-root', '/');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-root',
      'index.html',
    );
  });

  it('resolves assets from workspace root without subdir prefix', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue('body { margin: 0; }');

    await service.readStaticPreviewContent('session-root', '/style.css');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-root',
      'style.css',
    );
  });

  it('resolves nested assets from workspace root', async () => {
    dockerRuntimeService.readFileFromContainer.mockResolvedValue('JPEG_DATA');

    await service.readStaticPreviewContent('session-root', '/assets/photo.jpg');

    expect(dockerRuntimeService.readFileFromContainer).toHaveBeenCalledWith(
      'session-root',
      'assets/photo.jpg',
    );
  });
});

describe('PreviewService Vite-only node preview', () => {
  let service: PreviewService;
  let execMock: jest.Mock<
    (...args: any[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  >;
  const axiosGet = axios.get as unknown as {
    mockReset: () => void;
    mockResolvedValue: (value: unknown) => unknown;
    mockImplementation: (fn: (...args: any[]) => Promise<unknown>) => unknown;
  };

  const sessionsService = {
    assertSessionUsable: jest.fn(),
  };

  const dockerRuntimeService = {
    execInContainerBySessionId: jest.fn<
      (...args: any[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
    >(),
    findContainerBySessionId: jest.fn<(sessionId: string) => Promise<any>>(),
    readFileFromContainer: jest.fn<(sessionId: string, filePath: string) => Promise<string>>(),
  };

  const previewStrategyResolver = {
    resolve: jest.fn<(...args: any[]) => Promise<any>>(),
  };

  function execScripts(): string[] {
    return execMock.mock.calls.map((call: any) => String(call[1]?.[2] ?? ''));
  }

  function mockRunningContainer() {
    dockerRuntimeService.findContainerBySessionId.mockResolvedValue({
      inspect: async () => ({
        State: { Running: true },
        NetworkSettings: {
          Networks: {
            bridge: { IPAddress: '172.18.0.10' },
          },
        },
      }),
    });
  }

  function mockViteExec(options: {
    nodeModulesExists: boolean;
    installExitCode?: number;
    installError?: Error;
    launchStdout?: string;
    launchExitCode?: number;
  }) {
    execMock.mockImplementation(async (_sid: any, cmd: string[]) => {
      const script = cmd[2];
      if (script === '[ -d /workspace/node_modules ]') {
        return {
          exitCode: options.nodeModulesExists ? 0 : 1,
          stdout: '',
          stderr: '',
        };
      }
      if (script === 'npm install --no-audit --no-fund') {
        if (options.installError) {
          throw options.installError;
        }
        return {
          exitCode: options.installExitCode ?? 0,
          stdout: '',
          stderr: '',
        };
      }
      if (typeof script === 'string' && script.includes('& echo $!')) {
        return {
          exitCode: options.launchExitCode ?? 0,
          stdout: options.launchStdout ?? '4242\n',
          stderr: '',
        };
      }
      if (typeof script === 'string' && script.includes('kill -TERM')) {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    axiosGet.mockReset();
    axiosGet.mockResolvedValue({ status: 200 });
    execMock = dockerRuntimeService.execInContainerBySessionId;
    mockRunningContainer();
    service = new PreviewService(
      sessionsService as any,
      dockerRuntimeService as any,
      previewStrategyResolver as any,
    );
    previewStrategyResolver.resolve.mockResolvedValue({
      type: 'node-dev-server',
      framework: 'Vite',
      command: 'npm run dev',
      servingMode: 'process-proxy',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips npm install when node_modules exists and launches Vite with host and allocated port', async () => {
    mockViteExec({ nodeModulesExists: true });

    const result = await service.startPreview('session-vite');

    expect(result.status).toBe('running');
    expect(result.port).toBe(3001);
    expect(result.framework).toBe('Vite');

    const scripts = execScripts();
    expect(scripts).toContain('[ -d /workspace/node_modules ]');
    expect(scripts).not.toContain('npm install --no-audit --no-fund');
    expect(scripts.some((script) => script.includes('npm ci'))).toBe(false);

    const launchCall = execMock.mock.calls.find((call: any) =>
      String(call[1]?.[2] ?? '').includes('& echo $!'),
    ) as any;
    expect(launchCall).toBeDefined();
    expect(launchCall[1][2]).toBe(
      '(npm run dev -- --host 0.0.0.0 --port 3001) >/tmp/preview-3001.log 2>&1 & echo $!',
    );
    expect(launchCall[2]).toBe('/workspace');
    expect(launchCall[3]).toEqual({ PORT: '3001', NODE_ENV: 'development' });
    expect(result.port).toBeGreaterThanOrEqual(3001);
    expect(result.port).toBeLessThanOrEqual(3100);
  });

  it('runs frozen npm install when node_modules is missing then launches Vite with host and allocated port', async () => {
    mockViteExec({ nodeModulesExists: false });

    const result = await service.startPreview('session-vite');

    expect(result.status).toBe('running');
    expect(result.port).toBe(3001);

    expect(execMock).toHaveBeenCalledWith(
      'session-vite',
      ['sh', '-c', 'npm install --no-audit --no-fund'],
      '/workspace',
      undefined,
      120000,
    );

    const launchCall = execMock.mock.calls.find((call: any) =>
      String(call[1]?.[2] ?? '').includes('& echo $!'),
    ) as any;
    expect(launchCall[1][2]).toContain('--host 0.0.0.0');
    expect(launchCall[1][2]).toContain('--port 3001');
    expect(launchCall[3].PORT).toBe('3001');
  });

  it('fails closed on npm install timeout without launching a preview process', async () => {
    mockViteExec({
      nodeModulesExists: false,
      installError: new Error('Execution timeout after 120000ms'),
    });

    await expect(service.startPreview('session-vite')).rejects.toThrow(
      'Preview npm install timed out.',
    );

    const scripts = execScripts();
    expect(scripts.some((script) => script.includes('& echo $!'))).toBe(false);
    expect(service.getPreviewStatus('session-vite')).toBeNull();
    expect((service as any).portPool.has(3001)).toBe(true);
    expect((service as any).portPool.size).toBe(100);
  });

  it('fails closed on npm install failure without launching a preview process', async () => {
    mockViteExec({ nodeModulesExists: false, installExitCode: 1 });

    await expect(service.startPreview('session-vite')).rejects.toThrow(
      'Preview could not install npm dependencies.',
    );

    const scripts = execScripts();
    expect(scripts.some((script) => script.includes('& echo $!'))).toBe(false);
    expect(service.getPreviewStatus('session-vite')).toBeNull();
    expect((service as any).portPool.has(3001)).toBe(true);
    expect((service as any).portPool.size).toBe(100);
  });

  it('marks Vite preview running when the health probe returns any HTTP status >= 100', async () => {
    mockViteExec({ nodeModulesExists: true });
    axiosGet.mockResolvedValue({ status: 404 });

    const result = await service.startPreview('session-vite');

    expect(result.status).toBe('running');
    expect(service.getPreviewStatus('session-vite')?.status).toBe('running');
    expect(axiosGet).toHaveBeenCalled();
  });

  it('kills the Vite process and releases the port when wait times out', async () => {
    mockViteExec({ nodeModulesExists: true, launchStdout: '4242\n' });
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    axiosGet.mockImplementation(async () => {
      now = 1_000_000 + 20_000;
      throw new Error('ECONNREFUSED');
    });

    await expect(service.startPreview('session-vite')).rejects.toThrow(
      'Preview server did not become reachable in time.',
    );

    const scripts = execScripts();
    expect(scripts.some((script) => script.includes('kill -TERM 4242'))).toBe(true);
    expect(scripts.some((script) => script.includes('kill -KILL 4242'))).toBe(true);
    expect(service.getPreviewStatus('session-vite')).toBeNull();
    expect((service as any).portPool.has(3001)).toBe(true);
    expect((service as any).portPool.size).toBe(100);
  });

  it('fails closed for Next.js without install or process launch', async () => {
    previewStrategyResolver.resolve.mockResolvedValue({
      type: 'node-dev-server',
      framework: 'Next.js',
      command: 'npm run dev',
      servingMode: 'process-proxy',
    });

    await expect(service.startPreview('session-next')).rejects.toThrow(
      'Framework preview currently supports Vite. This workspace looks like Next.js.',
    );

    expect(execMock).not.toHaveBeenCalled();
    expect(service.getPreviewStatus('session-next')).toBeNull();
  });

  it('fails closed for Create React App without install or process launch', async () => {
    previewStrategyResolver.resolve.mockResolvedValue({
      type: 'node-dev-server',
      framework: 'Create React App',
      command: 'npm start',
      servingMode: 'process-proxy',
    });

    await expect(service.startPreview('session-cra')).rejects.toThrow(
      'Framework preview currently supports Vite. This workspace looks like Create React App.',
    );

    expect(execMock).not.toHaveBeenCalled();
  });

  it('fails closed for providedCommand without launching a process', async () => {
    previewStrategyResolver.resolve.mockResolvedValue({
      type: 'node-dev-server',
      command: 'npm start -- --host 0.0.0.0',
      servingMode: 'process-proxy',
    });

    await expect(
      service.startPreview('session-provided', 'npm start -- --host 0.0.0.0'),
    ).rejects.toThrow(
      'Framework preview currently supports Vite. This workspace looks like a Node app.',
    );

    expect(previewStrategyResolver.resolve).toHaveBeenCalledWith(
      'session-provided',
      'npm start -- --host 0.0.0.0',
    );
    expect(execMock).not.toHaveBeenCalled();
    expect(service.getPreviewStatus('session-provided')).toBeNull();
  });

  it('fails closed for Vite without an npm dev script', async () => {
    previewStrategyResolver.resolve.mockResolvedValue({
      type: 'node-dev-server',
      framework: 'Vite',
      command: 'npm start',
      servingMode: 'process-proxy',
    });

    await expect(service.startPreview('session-vite')).rejects.toThrow(
      'Vite preview requires an npm dev script.',
    );

    expect(execMock).not.toHaveBeenCalled();
  });

  it('does not run npm install when starting static HTML preview', async () => {
    previewStrategyResolver.resolve.mockResolvedValue({
      type: 'static-html',
      framework: 'Static HTML',
      command: 'npx serve -s . -l tcp://0.0.0.0:$PORT',
      appRoot: '/workspace',
      servingMode: 'direct-read',
    });

    const result = await service.startPreview('session-static');

    expect(result.status).toBe('running');
    expect(execMock).not.toHaveBeenCalled();
    const scripts = execScripts();
    expect(scripts.some((script) => script.includes('npm install'))).toBe(false);
  });

  it('stops a running Vite preview by killing the process tree, clearing state, and releasing the port', async () => {
    mockViteExec({ nodeModulesExists: true });

    await service.startPreview('session-vite');
    const result = await service.stopPreview('session-vite');

    expect(result).toEqual({ message: 'Preview stopped successfully' });
    expect(service.getPreviewStatus('session-vite')).toBeNull();
    expect((service as any).portPool.has(3001)).toBe(true);
    expect((service as any).portPool.size).toBe(100);

    const killScript = execScripts().find((script) => script.includes('kill -TERM 4242'));
    expect(killScript).toBeDefined();
    expect(killScript).toContain('kill -KILL 4242');
    expect(killScript).toContain('kill -TERM -4242');
    expect(killScript).toContain('kill -KILL -4242');
    expect(killScript).toContain('fuser -k 3001/tcp');
    expect(killScript).toContain('/proc/net/tcp');
  });

  it('stops a starting Vite preview, clears state, and releases the port without throwing', async () => {
    mockViteExec({ nodeModulesExists: true });
    (service as any).portPool.delete(3001);
    (service as any).activePreviews.set('session-vite', {
      pid: 4242,
      port: 3001,
      status: 'starting',
      command: 'npm run dev -- --host 0.0.0.0 --port 3001',
      framework: 'Vite',
      startedAt: new Date(),
    });

    await expect(service.stopPreview('session-vite')).resolves.toEqual({
      message: 'Preview stopped successfully',
    });

    const killScript = execScripts().find((script) => script.includes('kill -TERM 4242'));
    expect(killScript).toBeDefined();
    expect(killScript).toContain('kill -KILL 4242');
    expect(service.getPreviewStatus('session-vite')).toBeNull();
    expect((service as any).portPool.has(3001)).toBe(true);
    expect((service as any).portPool.size).toBe(100);
  });

  it('returns idempotent success when no active preview exists', async () => {
    await expect(service.stopPreview('session-empty')).resolves.toEqual({
      message: 'No active preview for this session',
    });
    expect(sessionsService.assertSessionUsable).toHaveBeenCalledWith('session-empty');
    expect(execMock).not.toHaveBeenCalled();
    expect(service.getPreviewStatus('session-empty')).toBeNull();
  });

  it('stops static preview without process kill, clears state, and releases the port', async () => {
    previewStrategyResolver.resolve.mockResolvedValue({
      type: 'static-html',
      framework: 'Static HTML',
      command: 'npx serve -s . -l tcp://0.0.0.0:$PORT',
      appRoot: '/workspace',
      servingMode: 'direct-read',
    });

    const started = await service.startPreview('session-static-stop');
    expect(started.status).toBe('running');
    expect(execMock).not.toHaveBeenCalled();

    const result = await service.stopPreview('session-static-stop');

    expect(result).toEqual({ message: 'Preview stopped successfully' });
    expect(execMock).not.toHaveBeenCalled();
    expect(service.getPreviewStatus('session-static-stop')).toBeNull();
    expect((service as any).portPool.has(3001)).toBe(true);
    expect((service as any).portPool.size).toBe(100);
  });

  it('can start Vite again after stop instead of early-returning the previous preview', async () => {
    mockViteExec({ nodeModulesExists: true });

    const first = await service.startPreview('session-vite');
    expect(first.port).toBe(3001);
    expect(first.status).toBe('running');
    await service.stopPreview('session-vite');
    expect(service.getPreviewStatus('session-vite')).toBeNull();
    expect((service as any).portPool.has(3001)).toBe(true);

    const second = await service.startPreview('session-vite');
    expect(second.status).toBe('running');
    expect(second.port).toBeGreaterThanOrEqual(3001);
    expect(second.port).toBeLessThanOrEqual(3100);

    const launchScripts = execScripts().filter((script) => script.includes('& echo $!'));
    expect(launchScripts).toHaveLength(2);
    expect(launchScripts[1]).toContain('npm run dev -- --host 0.0.0.0 --port');
    expect(launchScripts[1]).toContain(`--port ${second.port}`);
    expect(launchScripts[1]).toContain('& echo $!');
  });

  it('clears state and releases the port when process kill throws', async () => {
    mockViteExec({ nodeModulesExists: true });
    await service.startPreview('session-vite');

    execMock.mockImplementation(async () => {
      throw new Error('exec kill failed');
    });

    await expect(service.stopPreview('session-vite')).resolves.toEqual({
      message: 'Preview stopped successfully',
    });

    expect(service.getPreviewStatus('session-vite')).toBeNull();
    expect((service as any).portPool.has(3001)).toBe(true);
    expect((service as any).portPool.size).toBe(100);
  });

  it('fails closed when the preview map is cleared during start wait', async () => {
    mockViteExec({ nodeModulesExists: true });
    axiosGet.mockImplementation(async () => {
      (service as any).activePreviews.delete('session-vite');
      (service as any).portPool.add(3001);
      return { status: 200 };
    });

    await expect(service.startPreview('session-vite')).rejects.toThrow(
      'Preview was stopped before it became ready.',
    );

    expect(service.getPreviewStatus('session-vite')).toBeNull();
  });
});

describe('PreviewController stop route mapping', () => {
  function controllerRoutes() {
    return Object.getOwnPropertyNames(PreviewController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => {
        const fn = (PreviewController.prototype as any)[name];
        return {
          name,
          path: Reflect.getMetadata(PATH_METADATA, fn),
          method: Reflect.getMetadata(METHOD_METADATA, fn),
        };
      })
      .filter((entry) => entry.path !== undefined);
  }

  it('registers POST and DELETE on :sessionId/stop and keeps POST :sessionId/start', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PreviewController.prototype.stopPreview)).toBe(
      ':sessionId/stop',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, PreviewController.prototype.stopPreview)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(PATH_METADATA, PreviewController.prototype.stopPreviewByDelete)).toBe(
      ':sessionId/stop',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, PreviewController.prototype.stopPreviewByDelete)).toBe(
      RequestMethod.DELETE,
    );

    const stopMethods = controllerRoutes()
      .filter((entry) => entry.path === ':sessionId/stop')
      .map((entry) => entry.method);
    expect(stopMethods).toEqual(expect.arrayContaining([RequestMethod.POST, RequestMethod.DELETE]));
    expect(stopMethods).toHaveLength(2);

    const startRoutes = controllerRoutes().filter((entry) => entry.path === ':sessionId/start');
    expect(startRoutes).toHaveLength(1);
    expect(startRoutes[0].method).toBe(RequestMethod.POST);
  });

  it('POST stop route delegates to PreviewService.stopPreview', async () => {
    const previewService = {
      stopPreview: jest.fn(async () => ({ message: 'Preview stopped successfully' })),
    };
    const controller = new PreviewController(previewService as any);

    const result = await controller.stopPreview('session-stop');

    expect(previewService.stopPreview).toHaveBeenCalledWith('session-stop');
    expect(result).toEqual({
      success: true,
      message: 'Preview stopped successfully',
    });
  });

  it('DELETE stop route still delegates to PreviewService.stopPreview', async () => {
    const previewService = {
      stopPreview: jest.fn(async () => ({ message: 'Preview stopped successfully' })),
    };
    const controller = new PreviewController(previewService as any);

    const result = await controller.stopPreviewByDelete('session-stop');

    expect(previewService.stopPreview).toHaveBeenCalledWith('session-stop');
    expect(result).toEqual({
      success: true,
      message: 'Preview stopped successfully',
    });
  });
});
