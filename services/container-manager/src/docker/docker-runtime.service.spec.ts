import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Readable, Writable } from 'stream';
import {
  DockerRuntimeService,
  EXEC_OUTPUT_MAX_BYTES,
  ExecOutputLimitError,
} from './docker-runtime.service';

const DEFAULT_GOVERNANCE_MOCK = {
  getContainerMemoryLimitBytes: jest.fn().mockReturnValue(256 * 1024 * 1024),
  containerCpuLimit: 1,
  containerPidsLimit: 128,
  containerMemoryLimitMb: 256,
  browserContainerCpuLimit: 1.0,
  browserContainerMemoryLimitMb: 768,
  browserContainerPidsLimit: 512,
  browserContainerShmSizeMb: 256,
  getBrowserContainerMemoryLimitBytes: jest.fn().mockReturnValue(768 * 1024 * 1024),
  getBrowserContainerShmSizeBytes: jest.fn().mockReturnValue(256 * 1024 * 1024),
};

describe('DockerRuntimeService file operations', () => {
  let service: DockerRuntimeService;

  beforeEach(() => {
    service = new DockerRuntimeService({
      getContainerMemoryLimitBytes: jest.fn().mockReturnValue(256 * 1024 * 1024),
      containerCpuLimit: 1,
      containerPidsLimit: 128,
      containerMemoryLimitMb: 256,
    } as any);
  });

  describe('writeFileToContainer path validation', () => {
    it.each([
      'app/api/auth/[...nextauth]/route.ts',
      'app/[id]/page.tsx',
      'app/[[...slug]]/page.tsx',
      'app/....dotfile/page.tsx',
      'src/components/auth/login.tsx',
    ])('allows safe path and reaches exec: %s', async (filePath) => {
      jest.spyOn(service, 'findContainerBySessionId').mockResolvedValue({
        inspect: jest.fn().mockImplementation(async () => ({ State: { Running: true } })),
      } as any);
      const execSpy = jest
        .spyOn(service, 'execInContainerBySessionId')
        .mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await expect(
        service.writeFileToContainer('session-123', filePath, 'file-content'),
      ).resolves.toBeUndefined();

      expect(execSpy).toHaveBeenCalledWith(
        'session-123',
        ['sh', '-c', 'mkdir -p "$(dirname "$FILE")" && printf "%s" "$CONTENT" > "$FILE"'],
        '/workspace',
        {
          FILE: `/workspace/${filePath}`,
          CONTENT: 'file-content',
        },
        30000,
      );
    });

    it.each([
      '../secret.txt',
      'foo/../bar',
      'a/../../etc/passwd',
      '/etc/passwd',
      '/workspace/foo.ts',
      '',
    ])('rejects unsafe path before exec: %s', async (filePath) => {
      const execSpy = jest.spyOn(service, 'execInContainerBySessionId');

      await expect(service.writeFileToContainer('session-123', filePath, 'file-content')).rejects.toThrow(
        BadRequestException,
      );

      expect(execSpy).not.toHaveBeenCalled();
    });
  });

  describe('deleteFileFromContainer', () => {
    it('calls exec with rm against the workspace file path', async () => {
      const inspect = jest.fn().mockImplementation(async () => ({ State: { Running: true } }));
      const execSpy = jest
        .spyOn(service, 'execInContainerBySessionId')
        .mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
      jest
        .spyOn(service, 'findContainerBySessionId')
        .mockResolvedValue({ inspect } as any);

      await service.deleteFileFromContainer('session-123', 'src/delete-test.html');

      expect(execSpy).toHaveBeenCalledWith(
        'session-123',
        ['rm', '/workspace/src/delete-test.html'],
        '/workspace',
        undefined,
        30000,
      );
    });

    it('throws not found when rm reports a missing file', async () => {
      jest
        .spyOn(service, 'findContainerBySessionId')
        .mockResolvedValue({
          inspect: jest.fn().mockImplementation(async () => ({ State: { Running: true } })),
        } as any);
      jest
        .spyOn(service, 'execInContainerBySessionId')
        .mockResolvedValue({
          exitCode: 1,
          stdout: '',
          stderr: "rm: can't remove '/workspace/src/missing.html': No such file or directory",
        });

      await expect(
        service.deleteFileFromContainer('session-123', 'src/missing.html'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects path traversal before exec', async () => {
      const execSpy = jest.spyOn(service, 'execInContainerBySessionId');

      await expect(
        service.deleteFileFromContainer('session-123', '../secret.txt'),
      ).rejects.toThrow(BadRequestException);

      expect(execSpy).not.toHaveBeenCalled();
    });
  });

  describe('searchFilesInContainer', () => {
    it('parses grep output into bounded structured results', async () => {
      const execSpy = jest
        .spyOn(service, 'execInContainerBySessionId')
        .mockResolvedValue({
          exitCode: 0,
          stdout: [
            '/workspace/src/app.ts:12:const SPECIAL_TEST_KEYWORD = true;',
            '/workspace/src/login.ts:8:export const SPECIAL_TEST_KEYWORD: string = "ok";',
            '__AI_WS_SEARCH_TRUNCATED__',
          ].join('\n'),
          stderr: '',
        });
      jest.spyOn(service, 'findContainerBySessionId').mockResolvedValue({
        inspect: jest.fn().mockImplementation(async () => ({ State: { Running: true } })),
      } as any);

      const result = await service.searchFilesInContainer(
        'session-123',
        'SPECIAL_TEST_KEYWORD',
      );

      expect(result).toEqual({
        query: 'SPECIAL_TEST_KEYWORD',
        results: [
          {
            path: 'src/app.ts',
            line: 12,
            preview: 'const SPECIAL_TEST_KEYWORD = true;',
          },
          {
            path: 'src/login.ts',
            line: 8,
            preview: 'export const SPECIAL_TEST_KEYWORD: string = "ok";',
          },
        ],
        truncated: true,
      });
      expect(execSpy).toHaveBeenCalledWith(
        'session-123',
        [
          'sh',
          '-c',
          expect.stringContaining('grep -FnHi -e "$QUERY" "$file"'),
        ],
        '/workspace',
        { QUERY: 'SPECIAL_TEST_KEYWORD' },
        30000,
      );
      expect(execSpy.mock.calls[0]?.[1]?.[2]).toContain('find /workspace');
      expect(execSpy.mock.calls[0]?.[1]?.[2]).not.toContain('mktemp');
    });

    it('parses .txt file grep output into structured results', async () => {
      jest.spyOn(service, 'findContainerBySessionId').mockResolvedValue({
        inspect: jest.fn().mockImplementation(async () => ({ State: { Running: true } })),
      } as any);
      jest.spyOn(service, 'execInContainerBySessionId').mockResolvedValue({
        exitCode: 0,
        stdout: '/workspace/key.txt:1:SPECIAL_TEST_KEYWORD',
        stderr: '',
      });

      await expect(
        service.searchFilesInContainer('session-123', 'SPECIAL_TEST_KEYWORD'),
      ).resolves.toEqual({
        query: 'SPECIAL_TEST_KEYWORD',
        results: [
          {
            path: 'key.txt',
            line: 1,
            preview: 'SPECIAL_TEST_KEYWORD',
          },
        ],
        truncated: false,
      });
    });

    it('returns empty results when grep finds no matches', async () => {
      jest.spyOn(service, 'findContainerBySessionId').mockResolvedValue({
        inspect: jest.fn().mockImplementation(async () => ({ State: { Running: true } })),
      } as any);
      jest.spyOn(service, 'execInContainerBySessionId').mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: '',
      });

      await expect(
        service.searchFilesInContainer('session-123', 'SPECIAL_TEST_KEYWORD'),
      ).resolves.toEqual({
        query: 'SPECIAL_TEST_KEYWORD',
        results: [],
        truncated: false,
      });
    });

    it('rejects when search exits 127 with stderr', async () => {
      jest.spyOn(service, 'findContainerBySessionId').mockResolvedValue({
        inspect: jest.fn().mockImplementation(async () => ({ State: { Running: true } })),
      } as any);
      jest.spyOn(service, 'execInContainerBySessionId').mockResolvedValue({
        exitCode: 127,
        stdout: '',
        stderr: 'find: not found',
      });

      await expect(
        service.searchFilesInContainer('session-123', 'SPECIAL_TEST_KEYWORD'),
      ).rejects.toThrow(
        'Failed to search files in container for session session-123',
      );
    });

    it('rejects another non-zero search exit with empty stderr', async () => {
      jest.spyOn(service, 'findContainerBySessionId').mockResolvedValue({
        inspect: jest.fn().mockImplementation(async () => ({ State: { Running: true } })),
      } as any);
      jest.spyOn(service, 'execInContainerBySessionId').mockResolvedValue({
        exitCode: 2,
        stdout: '',
        stderr: '',
      });

      await expect(
        service.searchFilesInContainer('session-123', 'SPECIAL_TEST_KEYWORD'),
      ).rejects.toThrow(
        'Failed to search files in container for session session-123',
      );
    });

    it('rejects empty query before exec', async () => {
      const execSpy = jest.spyOn(service, 'execInContainerBySessionId');

      await expect(service.searchFilesInContainer('session-123', '   ')).rejects.toThrow(
        BadRequestException,
      );

      expect(execSpy).not.toHaveBeenCalled();
    });

    it('rejects too-long query before exec', async () => {
      const execSpy = jest.spyOn(service, 'execInContainerBySessionId');

      await expect(
        service.searchFilesInContainer('session-123', 'x'.repeat(121)),
      ).rejects.toThrow(BadRequestException);

      expect(execSpy).not.toHaveBeenCalled();
    });
  });
});

describe('DockerRuntimeService createContainer browser-capable path', () => {
  let service: DockerRuntimeService;
  let mockCreateContainer: jest.Mock<any>;

  beforeEach(() => {
    service = new DockerRuntimeService({ ...DEFAULT_GOVERNANCE_MOCK } as any);
    mockCreateContainer = jest.fn<any>().mockResolvedValue({ id: 'container-abc' } as any);
    (service as any).docker = {
      createContainer: mockCreateContainer,
      ping: jest.fn<any>().mockResolvedValue('OK' as any),
      pull: jest.fn(),
      modem: { followProgress: jest.fn() },
    };
  });

  function getCallArgs(): any {
    return mockCreateContainer.mock.calls[0][0];
  }

  function createIsolatedRuntime(sandboxImage: string | undefined): {
    service: DockerRuntimeService;
    mockCreateContainer: jest.Mock<any>;
  } {
    const previous = process.env.SANDBOX_IMAGE;
    if (sandboxImage === undefined) {
      delete process.env.SANDBOX_IMAGE;
    } else {
      process.env.SANDBOX_IMAGE = sandboxImage;
    }

    let isolatedService: DockerRuntimeService | undefined;
    let isolatedCreate: jest.Mock<any> | undefined;
    jest.resetModules();
    jest.isolateModules(() => {
      const loaded = require('./docker-runtime.service') as typeof import('./docker-runtime.service');
      isolatedService = new loaded.DockerRuntimeService({ ...DEFAULT_GOVERNANCE_MOCK } as any);
      isolatedCreate = jest.fn<any>().mockResolvedValue({ id: 'container-abc' } as any);
      (isolatedService as any).docker = {
        createContainer: isolatedCreate,
        ping: jest.fn<any>().mockResolvedValue('OK' as any),
        pull: jest.fn(),
        modem: { followProgress: jest.fn() },
      };
    });

    if (previous === undefined) {
      delete process.env.SANDBOX_IMAGE;
    } else {
      process.env.SANDBOX_IMAGE = previous;
    }

    if (!isolatedService || !isolatedCreate) {
      throw new Error('isolated docker runtime module did not load');
    }
    return { service: isolatedService, mockCreateContainer: isolatedCreate };
  }

  function createdImage(mockCreate: jest.Mock<any>): string {
    const args = mockCreate.mock.calls[0][0] as { Image: string };
    return args.Image;
  }

  it('uses node:24-alpine when SANDBOX_IMAGE is unset and browserCapable is not set', async () => {
    const isolated = createIsolatedRuntime(undefined);
    await isolated.service.createContainer('sess-1', '/tmp/ws');

    expect(isolated.mockCreateContainer).toHaveBeenCalledTimes(1);
    expect(createdImage(isolated.mockCreateContainer)).toBe('node:24-alpine');
  });

  it('uses node:24-alpine when SANDBOX_IMAGE is unset and browserCapable is false', async () => {
    const isolated = createIsolatedRuntime(undefined);
    await isolated.service.createContainer('sess-2', '/tmp/ws', { browserCapable: false });

    expect(createdImage(isolated.mockCreateContainer)).toBe('node:24-alpine');
  });

  it('uses node:24-alpine when SANDBOX_IMAGE is blank', async () => {
    const isolated = createIsolatedRuntime('');
    await isolated.service.createContainer('sess-blank', '/tmp/ws');

    expect(createdImage(isolated.mockCreateContainer)).toBe('node:24-alpine');
  });

  it('uses node:24-alpine when SANDBOX_IMAGE is only whitespace', async () => {
    const isolated = createIsolatedRuntime('   ');
    await isolated.service.createContainer('sess-blank-ws', '/tmp/ws');

    expect(createdImage(isolated.mockCreateContainer)).toBe('node:24-alpine');
  });

  it('uses a trimmed SANDBOX_IMAGE override for normal workspace creation', async () => {
    const isolated = createIsolatedRuntime('  node:22-alpine  ');
    await isolated.service.createContainer('sess-override', '/tmp/ws', { browserCapable: false });

    expect(createdImage(isolated.mockCreateContainer)).toBe('node:22-alpine');
  });

  it('keeps the browser workspace image when SANDBOX_IMAGE is set', async () => {
    const isolated = createIsolatedRuntime('node:22-alpine');
    await isolated.service.createContainer('sess-browser-override', '/tmp/ws', { browserCapable: true });

    expect(createdImage(isolated.mockCreateContainer)).toBe('aisandbox-workspace-browser:local');
  });

  it('applies standard resource limits when browserCapable is not set', async () => {
    await service.createContainer('sess-3', '/tmp/ws');

    const args = getCallArgs();
    expect(args.HostConfig.Memory).toBe(256 * 1024 * 1024);
    expect(args.HostConfig.NanoCpus).toBe(Math.floor(1 * 1e9));
    expect(args.HostConfig.PidsLimit).toBe(128);
  });

  it('does not set ShmSize when browserCapable is not set', async () => {
    await service.createContainer('sess-4', '/tmp/ws');

    expect(getCallArgs().HostConfig.ShmSize).toBeUndefined();
  });

  it('uses browser sandbox image when browserCapable is true', async () => {
    await service.createContainer('sess-5', '/tmp/ws', { browserCapable: true });

    expect(getCallArgs().Image).toBe('aisandbox-workspace-browser:local');
  });

  it('applies browser resource limits when browserCapable is true', async () => {
    await service.createContainer('sess-6', '/tmp/ws', { browserCapable: true });

    const args = getCallArgs();
    expect(args.HostConfig.Memory).toBe(768 * 1024 * 1024);
    expect(args.HostConfig.NanoCpus).toBe(Math.floor(1.0 * 1e9));
    expect(args.HostConfig.PidsLimit).toBe(512);
  });

  it('sets ShmSize to browserContainerShmSizeMb in bytes when browserCapable is true', async () => {
    await service.createContainer('sess-7', '/tmp/ws', { browserCapable: true });

    expect(getCallArgs().HostConfig.ShmSize).toBe(256 * 1024 * 1024);
  });

  it('preserves common container config for both paths', async () => {
    await service.createContainer('sess-8', '/tmp/ws', { browserCapable: true });

    const args = getCallArgs();
    expect(args.WorkingDir).toBe('/workspace');
    expect(args.Cmd).toEqual(['/bin/sh', '-c', 'while true; do sleep 3600; done']);
    expect(args.HostConfig.Binds).toEqual(['/tmp/ws:/workspace:rw']);
    expect(args.HostConfig.AutoRemove).toBe(false);
  });
});

describe('DockerRuntimeService.getSessionContainerState (SESSION-STALE-01)', () => {
  let service: DockerRuntimeService;

  beforeEach(() => {
    service = new DockerRuntimeService({ ...DEFAULT_GOVERNANCE_MOCK } as any);
  });

  it('returns running when the session container is running', async () => {
    const inspect = jest.fn<any>().mockResolvedValue({ State: { Running: true } });
    const getContainer = jest.fn<any>().mockReturnValue({ inspect });
    const listContainers = jest.fn<any>().mockResolvedValue([
      { Id: 'other', Names: ['/sandbox-session-other'] },
      { Id: 'abc', Names: ['/sandbox-session-sess-run'] },
    ]);
    (service as any).docker = { listContainers, getContainer };

    await expect(service.getSessionContainerState('sess-run')).resolves.toBe('running');

    expect(listContainers).toHaveBeenCalledTimes(1);
    expect(listContainers).toHaveBeenCalledWith({ all: true });
    expect(getContainer).toHaveBeenCalledTimes(1);
    expect(getContainer).toHaveBeenCalledWith('abc');
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it('returns stopped when the session container exists but is not running', async () => {
    const inspect = jest.fn<any>().mockResolvedValue({ State: { Running: false } });
    const getContainer = jest.fn<any>().mockReturnValue({ inspect });
    const listContainers = jest.fn<any>().mockResolvedValue([
      { Id: 'stopped-id', Names: ['/sandbox-session-sess-stopped'] },
    ]);
    (service as any).docker = { listContainers, getContainer };

    await expect(service.getSessionContainerState('sess-stopped')).resolves.toBe('stopped');

    expect(listContainers).toHaveBeenCalledWith({ all: true });
    expect(getContainer).toHaveBeenCalledWith('stopped-id');
    expect(inspect).toHaveBeenCalledTimes(1);
  });

  it('returns missing when no container matches the session name', async () => {
    const getContainer = jest.fn<any>();
    const listContainers = jest.fn<any>().mockResolvedValue([
      { Id: 'other', Names: ['/sandbox-session-other'] },
      { Id: 'plain', Names: ['/not-a-session'] },
    ]);
    (service as any).docker = { listContainers, getContainer };

    await expect(service.getSessionContainerState('sess-missing')).resolves.toBe('missing');

    expect(listContainers).toHaveBeenCalledWith({ all: true });
    expect(getContainer).not.toHaveBeenCalled();
  });

  it('rethrows a Docker listContainers error', async () => {
    const dockerError = new Error('connect ENOENT //./pipe/docker_engine');
    const getContainer = jest.fn<any>();
    const listContainers = jest.fn<any>().mockRejectedValue(dockerError);
    (service as any).docker = { listContainers, getContainer };

    await expect(service.getSessionContainerState('sess-1')).rejects.toBe(dockerError);
    expect(getContainer).not.toHaveBeenCalled();
  });

  it('rethrows a Docker inspect error', async () => {
    const dockerError = new Error('inspect failed');
    const inspect = jest.fn<any>().mockRejectedValue(dockerError);
    const getContainer = jest.fn<any>().mockReturnValue({ inspect });
    const listContainers = jest.fn<any>().mockResolvedValue([
      { Id: 'abc', Names: ['/sandbox-session-sess-1'] },
    ]);
    (service as any).docker = { listContainers, getContainer };

    await expect(service.getSessionContainerState('sess-1')).rejects.toBe(dockerError);
    expect(listContainers).toHaveBeenCalledWith({ all: true });
    expect(getContainer).toHaveBeenCalledWith('abc');
  });
});

/**
 * CM-EXEC-01: the exec core on a fake dockerode container. demuxStream hands
 * the service's stdout and stderr sinks to the test, which writes into them as
 * the daemon would; emitting 'end' on the exec stream finishes the command.
 */
describe('DockerRuntimeService exec output cap, binary stdout and stdin (CM-EXEC-01)', () => {
  let service: DockerRuntimeService;

  type Sinks = { stdout: Writable; stderr: Writable };

  function fakeExec(options: { exitCode?: number } = {}) {
    let resolveSinks: (sinks: Sinks) => void = () => undefined;
    const sinksReady = new Promise<Sinks>((resolve) => {
      resolveSinks = resolve;
    });
    const written: Buffer[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding: BufferEncoding, callback: () => void) {
        written.push(Buffer.from(chunk));
        callback();
      },
    });
    const destroy = jest.spyOn(stream, 'destroy');
    const exec = {
      start: jest.fn(async () => stream),
      inspect: jest.fn(async () => ({ ExitCode: options.exitCode ?? 0 })),
    };
    const container = {
      inspect: jest.fn(async () => ({ State: { Running: true } })),
      exec: jest.fn(async () => exec),
      modem: {
        demuxStream: jest.fn((_stream: unknown, stdout: Writable, stderr: Writable) => {
          resolveSinks({ stdout, stderr });
        }),
      },
    };
    jest.spyOn(service, 'findContainerBySessionId').mockResolvedValue(container as any);
    return {
      container,
      exec,
      stream,
      destroy,
      sinksReady,
      written: () => Buffer.concat(written),
      finish: () => stream.emit('end'),
    };
  }

  function stdinFinished(stream: Writable): Promise<void> {
    return stream.writableFinished
      ? Promise.resolve()
      : new Promise((resolve) => stream.once('finish', () => resolve()));
  }

  function writeAcknowledged(sink: Writable, bytes: Buffer): Promise<boolean> {
    return new Promise((resolve) => {
      sink.write(bytes, (error?: Error | null) => resolve(!error));
    });
  }

  beforeEach(() => {
    service = new DockerRuntimeService({ ...DEFAULT_GOVERNANCE_MOCK } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('collects stdout and stderr as bytes and decodes them once, keeping a character split across chunks', async () => {
    const fake = fakeExec({ exitCode: 3 });
    const pending = service.execInContainerBySessionId('sess-1', ['node', '-v'], '/workspace/app', {
      A: '1',
    });
    const sinks = await fake.sinksReady;
    const euro = Buffer.from('price: €\n', 'utf8');
    sinks.stdout.write(euro.subarray(0, 8));
    sinks.stdout.write(euro.subarray(8));
    sinks.stderr.write(Buffer.from('warn\n'));
    fake.finish();

    await expect(pending).resolves.toEqual({ exitCode: 3, stdout: 'price: €\n', stderr: 'warn\n' });
    // The existing exec contract is unchanged: no stdin, not hijacked.
    expect(fake.container.exec).toHaveBeenCalledWith({
      Cmd: ['node', '-v'],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/workspace/app',
      Env: ['A=1'],
    });
    expect(fake.exec.start).toHaveBeenCalledWith({ Detach: false });
  });

  it('returns stdout as the exact bytes from the buffer variant (non-UTF-8 bytes survive)', async () => {
    const fake = fakeExec();
    const bytes = Buffer.from(Array.from({ length: 256 }, (_value, index) => index));
    const pending = service.execInContainerBySessionIdBuffer('sess-1', ['cat', '/workspace/a.bin']);
    const sinks = await fake.sinksReady;
    sinks.stdout.write(bytes.subarray(0, 100));
    sinks.stdout.write(bytes.subarray(100));
    fake.finish();

    const result = await pending;
    expect(Buffer.isBuffer(result.stdout)).toBe(true);
    expect(result.stdout.equals(bytes)).toBe(true);
    expect(result).toMatchObject({ exitCode: 0, stderr: '' });
    // The string variant would not round-trip the same bytes.
    expect(Buffer.from(result.stdout.toString('utf8'), 'utf8').equals(bytes)).toBe(false);
  });

  it('reads a binary file with readFileBufferFromContainer, with the same command, timeout and path checks', async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x80]);
    jest.spyOn(service, 'findContainerBySessionId').mockResolvedValue({
      inspect: jest.fn(async () => ({ State: { Running: true } })),
    } as any);
    const execSpy = jest
      .spyOn(service, 'execInContainerBySessionIdBuffer')
      .mockResolvedValue({ exitCode: 0, stdout: bytes, stderr: '' });

    const result = await service.readFileBufferFromContainer('sess-1', 'public/logo.png');

    expect(result.equals(bytes)).toBe(true);
    expect(execSpy).toHaveBeenCalledWith(
      'sess-1',
      ['cat', '/workspace/public/logo.png'],
      '/workspace',
      undefined,
      30000,
      undefined,
    );

    execSpy.mockResolvedValue({ exitCode: 1, stdout: Buffer.alloc(0), stderr: 'No such file' });
    await expect(service.readFileBufferFromContainer('sess-1', 'missing.png')).rejects.toThrow(
      'File not found or cannot be read: missing.png',
    );

    execSpy.mockClear();
    await expect(service.readFileBufferFromContainer('sess-1', '../etc/passwd')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(execSpy).not.toHaveBeenCalled();
  });

  it('accepts output exactly at the default cap', async () => {
    const fake = fakeExec();
    const pending = service.execInContainerBySessionIdBuffer('sess-1', ['cat', 'big']);
    const sinks = await fake.sinksReady;
    sinks.stdout.write(Buffer.alloc(EXEC_OUTPUT_MAX_BYTES - 1));
    sinks.stdout.write(Buffer.alloc(1));
    fake.finish();

    const result = await pending;
    expect(result.stdout.length).toBe(EXEC_OUTPUT_MAX_BYTES);
    expect(fake.destroy).not.toHaveBeenCalled();
  });

  it('rejects stdout past the cap with ExecOutputLimitError, cuts the stream and never throws from a stream callback', async () => {
    expect(EXEC_OUTPUT_MAX_BYTES).toBe(16 * 1024 * 1024);
    const fake = fakeExec();
    // A larger per-call cap is clamped to the default.
    const pending = service.execInContainerBySessionId('sess-1', ['cat', 'huge'], '/workspace', undefined, 300000, {
      maxOutputBytes: EXEC_OUTPUT_MAX_BYTES * 4,
    });
    const sinks = await fake.sinksReady;
    sinks.stdout.write(Buffer.alloc(EXEC_OUTPUT_MAX_BYTES));
    sinks.stdout.write(Buffer.alloc(1));

    const error = await pending.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ExecOutputLimitError);
    expect((error as Error).message).toBe('exec stdout output exceeded 16777216 bytes');
    expect(error).toMatchObject({ stream: 'stdout', limitBytes: EXEC_OUTPUT_MAX_BYTES });
    expect(fake.destroy).toHaveBeenCalled();

    // Data still arriving after the cut is acknowledged and dropped: no throw.
    await expect(writeAcknowledged(sinks.stdout, Buffer.alloc(1024))).resolves.toBe(true);
    expect(() => fake.finish()).not.toThrow();
    expect(fake.exec.inspect).not.toHaveBeenCalled();
  });

  it('rejects stderr past a smaller per-call cap', async () => {
    const fake = fakeExec();
    const pending = service.execInContainerBySessionId('sess-1', ['sh', '-c', 'noisy'], '/workspace', undefined, 300000, {
      maxOutputBytes: 10,
    });
    const sinks = await fake.sinksReady;
    sinks.stdout.write(Buffer.alloc(10));
    sinks.stderr.write(Buffer.from('0123456789'));
    sinks.stderr.write(Buffer.from('!'));

    await expect(pending).rejects.toThrow(new ExecOutputLimitError('stderr', 10));
    expect(fake.destroy).toHaveBeenCalled();
  });

  it('keeps the cap message through readFileFromContainer on a file over the cap', async () => {
    const fake = fakeExec();
    const pending = service.readFileFromContainer('sess-1', 'data/huge.json');
    const sinks = await fake.sinksReady;
    sinks.stdout.write(Buffer.alloc(EXEC_OUTPUT_MAX_BYTES + 1));

    await expect(pending).rejects.toThrow(
      'Failed to read file from container for session sess-1: exec stdout output exceeded 16777216 bytes',
    );
  });

  it.each([0, -1, 1.5, Number.NaN])('refuses an invalid per-call cap (%s) before creating an exec', async (cap) => {
    const fake = fakeExec();
    await expect(
      service.execInContainerBySessionId('sess-1', ['true'], '/workspace', undefined, 1000, { maxOutputBytes: cap }),
    ).rejects.toThrow('Invalid exec output cap');
    expect(fake.container.exec).not.toHaveBeenCalled();
  });

  it('times out as before, leaves the stream to drain and keeps nothing more', async () => {
    const fake = fakeExec();
    const pending = service.execInContainerBySessionId('sess-1', ['sleep', '10'], '/workspace', undefined, 30);
    const sinks = await fake.sinksReady;
    sinks.stdout.write(Buffer.from('partial'));

    await expect(pending).rejects.toThrow(
      'Failed to execute command in container for session sess-1: Execution timeout after 30ms',
    );
    expect(fake.destroy).not.toHaveBeenCalled();
    await expect(writeAcknowledged(sinks.stdout, Buffer.alloc(EXEC_OUTPUT_MAX_BYTES + 1))).resolves.toBe(true);
    expect(() => fake.finish()).not.toThrow();
  });

  it('wraps a stream error as before', async () => {
    const fake = fakeExec();
    const pending = service.execInContainerBySessionId('sess-1', ['true']);
    await fake.sinksReady;
    fake.stream.emit('error', new Error('socket hang up'));

    await expect(pending).rejects.toThrow(
      'Failed to execute command in container for session sess-1: socket hang up',
    );
  });

  it('stdin variant: attaches stdin, starts hijacked, writes a Buffer input whole and ends stdin', async () => {
    const fake = fakeExec({ exitCode: 0 });
    const input = Buffer.from([0x00, 0x01, 0xfe, 0xff, 0x0a, 0x80]);
    const pending = service.execInContainerWithStdinBySessionId(
      'sess-1',
      ['sh', '-c', 'cat > /workspace/x && wc -c < /workspace/x'],
      input,
      '/workspace',
      { K: 'v' },
    );
    const sinks = await fake.sinksReady;
    await stdinFinished(fake.stream);
    expect(fake.written().equals(input)).toBe(true);
    expect(fake.stream.writableEnded).toBe(true);
    sinks.stdout.write(Buffer.from('6\n'));
    fake.finish();

    await expect(pending).resolves.toEqual({ exitCode: 0, stdout: '6\n', stderr: '' });
    expect(fake.container.exec).toHaveBeenCalledWith({
      Cmd: ['sh', '-c', 'cat > /workspace/x && wc -c < /workspace/x'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: '/workspace',
      Env: ['K=v'],
    });
    expect(fake.exec.start).toHaveBeenCalledWith({ hijack: true, stdin: true, Detach: false, Tty: false });
  });

  it('stdin variant: pipes a readable input with every byte and ends stdin when the input ends', async () => {
    const fake = fakeExec();
    const parts = [Buffer.alloc(70_000, 1), Buffer.alloc(3, 2), Buffer.alloc(200_000, 3)];
    const pending = service.execInContainerWithStdinBySessionId(
      'sess-1',
      ['sh', '-c', 'cat > /workspace/y'],
      Readable.from(parts, { objectMode: false }),
    );
    await fake.sinksReady;
    await stdinFinished(fake.stream);
    expect(fake.written().equals(Buffer.concat(parts))).toBe(true);
    fake.finish();

    await expect(pending).resolves.toEqual({ exitCode: 0, stdout: '', stderr: '' });
  });

  it('stdin variant: the output cap applies and the input is released', async () => {
    const fake = fakeExec();
    const input = new Readable({ read() {} });
    const pending = service.execInContainerWithStdinBySessionId('sess-1', ['cat'], input, '/workspace', undefined, 300000, {
      maxOutputBytes: 4,
    });
    const sinks = await fake.sinksReady;
    sinks.stdout.write(Buffer.from('12345'));

    await expect(pending).rejects.toThrow('exec stdout output exceeded 4 bytes');
    expect(input.destroyed).toBe(true);
    expect(fake.destroy).toHaveBeenCalled();
  });

  it('stdin variant: the timeout applies and the input is released', async () => {
    const fake = fakeExec();
    const input = new Readable({ read() {} });
    const pending = service.execInContainerWithStdinBySessionId('sess-1', ['cat'], input, '/workspace', undefined, 30);
    await fake.sinksReady;

    await expect(pending).rejects.toThrow('Execution timeout after 30ms');
    expect(input.destroyed).toBe(true);
  });

  it('stdin variant: an input error fails the call', async () => {
    const fake = fakeExec();
    const input = new Readable({ read() {} });
    const pending = service.execInContainerWithStdinBySessionId('sess-1', ['cat'], input);
    await fake.sinksReady;
    input.destroy(new Error('stored bundle unreadable'));

    await expect(pending).rejects.toThrow(
      'Failed to execute command in container for session sess-1: stored bundle unreadable',
    );
    expect(fake.destroy).toHaveBeenCalled();
  });

  it('stdin variant: refuses an input that is neither bytes nor a stream before any exec', async () => {
    const fake = fakeExec();
    await expect(
      service.execInContainerWithStdinBySessionId('sess-1', ['cat'], 'text' as unknown as Buffer),
    ).rejects.toThrow('Invalid exec input');
    expect(fake.container.exec).not.toHaveBeenCalled();
  });

  it('stdin variant: refuses a stopped container before any exec', async () => {
    const fake = fakeExec();
    fake.container.inspect.mockResolvedValue({ State: { Running: false } });
    await expect(
      service.execInContainerWithStdinBySessionId('sess-1', ['cat'], Buffer.from('x')),
    ).rejects.toThrow('Container for session sess-1 is not running');
    expect(fake.container.exec).not.toHaveBeenCalled();
  });
});
