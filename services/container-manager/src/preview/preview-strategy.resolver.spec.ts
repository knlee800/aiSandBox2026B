import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PreviewStrategyResolver } from './preview-strategy.resolver';

describe('PreviewStrategyResolver', () => {
  let resolver: PreviewStrategyResolver;
  let execMock: jest.Mock;

  const dockerRuntimeService = {
    execInContainerBySessionId: jest.fn<
      (...args: any[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
    >(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    execMock = dockerRuntimeService.execInContainerBySessionId;
    resolver = new PreviewStrategyResolver(dockerRuntimeService as any);
  });

  it('returns provided command as node-dev-server without shell calls', async () => {
    const result = await resolver.resolve('session-1', 'npm start');

    expect(result.type).toBe('node-dev-server');
    expect(result.command).toBe('npm start');
    expect(result.servingMode).toBe('process-proxy');
    expect(execMock).not.toHaveBeenCalled();
  });

  it('detects Next.js from package.json dependencies', async () => {
    execMock.mockImplementation(async (_sid: any, cmd: string[]) => {
      const script = cmd[2];
      if (script === '[ -f /workspace/package.json ]') {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      if (script === 'cat /workspace/package.json') {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            dependencies: { next: '14.0.0', react: '18.0.0' },
            scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
          }),
          stderr: '',
        };
      }
      return { exitCode: 1, stdout: '', stderr: '' };
    });

    const result = await resolver.resolve('session-1');

    expect(result.type).toBe('node-dev-server');
    expect(result.framework).toBe('Next.js');
    expect(result.command).toBe('npm run dev');
    expect(result.servingMode).toBe('process-proxy');
  });

  it('detects Vite from package.json devDependencies', async () => {
    execMock.mockImplementation(async (_sid: any, cmd: string[]) => {
      const script = cmd[2];
      if (script === '[ -f /workspace/package.json ]') {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      if (script === 'cat /workspace/package.json') {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            dependencies: { react: '18.0.0' },
            devDependencies: { vite: '5.0.0' },
            scripts: { dev: 'vite', build: 'vite build' },
          }),
          stderr: '',
        };
      }
      return { exitCode: 1, stdout: '', stderr: '' };
    });

    const result = await resolver.resolve('session-1');

    expect(result.type).toBe('node-dev-server');
    expect(result.framework).toBe('Vite');
    expect(result.command).toBe('npm run dev');
    expect(result.servingMode).toBe('process-proxy');
  });

  it('detects generic dev script when no known framework is found', async () => {
    execMock.mockImplementation(async (_sid: any, cmd: string[]) => {
      const script = cmd[2];
      if (script === '[ -f /workspace/package.json ]') {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      if (script === 'cat /workspace/package.json') {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            dependencies: {},
            scripts: { dev: 'node dev.js' },
          }),
          stderr: '',
        };
      }
      return { exitCode: 1, stdout: '', stderr: '' };
    });

    const result = await resolver.resolve('session-1');

    expect(result.type).toBe('node-dev-server');
    expect(result.command).toBe('npm run dev');
    expect(result.servingMode).toBe('process-proxy');
  });

  it('detects static HTML at workspace root', async () => {
    execMock.mockImplementation(async (_sid: any, cmd: string[]) => {
      const script = cmd[2];
      if (script === '[ -f /workspace/package.json ]') {
        return { exitCode: 1, stdout: '', stderr: '' };
      }
      if (script === '[ -f /workspace/index.html ]') {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      return { exitCode: 1, stdout: '', stderr: '' };
    });

    const result = await resolver.resolve('session-1');

    expect(result.type).toBe('static-html');
    expect(result.framework).toBe('Static HTML');
    expect(result.appRoot).toBe('/workspace');
    expect(result.servingMode).toBe('direct-read');
  });

  it('detects static HTML in immediate subdirectory', async () => {
    execMock.mockImplementation(async (_sid: any, cmd: string[]) => {
      const script = cmd[2];
      if (script === '[ -f /workspace/package.json ]') {
        return { exitCode: 1, stdout: '', stderr: '' };
      }
      if (script === '[ -f /workspace/index.html ]') {
        return { exitCode: 1, stdout: '', stderr: '' };
      }
      if (script.includes('ls -d /workspace/*/index.html')) {
        return {
          exitCode: 0,
          stdout: '/workspace/WorkspaceA/index.html\n',
          stderr: '',
        };
      }
      return { exitCode: 1, stdout: '', stderr: '' };
    });

    const result = await resolver.resolve('session-1');

    expect(result.type).toBe('static-html');
    expect(result.framework).toBe('Static HTML');
    expect(result.appRoot).toBe('/workspace/WorkspaceA');
    expect(result.servingMode).toBe('direct-read');
  });

  it('returns unknown with missing-index when HTML exists but no index.html', async () => {
    execMock.mockImplementation(async (_sid: any, cmd: string[]) => {
      const script = cmd[2];
      if (script === '[ -f /workspace/package.json ]') {
        return { exitCode: 1, stdout: '', stderr: '' };
      }
      if (script === '[ -f /workspace/index.html ]') {
        return { exitCode: 1, stdout: '', stderr: '' };
      }
      if (script.includes('ls -d /workspace/*/index.html')) {
        return { exitCode: 1, stdout: '', stderr: '' };
      }
      if (script.includes('ls /workspace/*.html')) {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      return { exitCode: 1, stdout: '', stderr: '' };
    });

    const result = await resolver.resolve('session-1');

    expect(result.type).toBe('unknown');
    expect(result.framework).toBe('Static HTML (missing-index)');
    expect(result.diagnosticMessage).toBeTruthy();
  });

  it('returns unknown when no previewable content is found', async () => {
    execMock.mockImplementation(async () => {
      return { exitCode: 1, stdout: '', stderr: '' };
    });

    const result = await resolver.resolve('session-1');

    expect(result.type).toBe('unknown');
    expect(result.diagnosticMessage).toContain('No package.json');
    expect(result.servingMode).toBe('direct-read');
  });

  it('returns unknown when package.json exists but has no scripts', async () => {
    execMock.mockImplementation(async (_sid: any, cmd: string[]) => {
      const script = cmd[2];
      if (script === '[ -f /workspace/package.json ]') {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      if (script === 'cat /workspace/package.json') {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            name: 'empty-project',
            dependencies: {},
          }),
          stderr: '',
        };
      }
      return { exitCode: 1, stdout: '', stderr: '' };
    });

    const result = await resolver.resolve('session-1');

    expect(result.type).toBe('unknown');
    expect(result.diagnosticMessage).toContain('no start or dev script');
  });

  it('prefers root index.html over subdirectory index.html', async () => {
    execMock.mockImplementation(async (_sid: any, cmd: string[]) => {
      const script = cmd[2];
      if (script === '[ -f /workspace/package.json ]') {
        return { exitCode: 1, stdout: '', stderr: '' };
      }
      if (script === '[ -f /workspace/index.html ]') {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      if (script.includes('ls -d /workspace/*/index.html')) {
        return {
          exitCode: 0,
          stdout: '/workspace/SubDir/index.html\n',
          stderr: '',
        };
      }
      return { exitCode: 1, stdout: '', stderr: '' };
    });

    const result = await resolver.resolve('session-1');

    expect(result.type).toBe('static-html');
    expect(result.appRoot).toBe('/workspace');
  });
});
