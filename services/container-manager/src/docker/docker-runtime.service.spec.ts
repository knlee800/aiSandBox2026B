import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DockerRuntimeService } from './docker-runtime.service';

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

    it('logs a warning when search exits non-zero with empty stdout and stderr', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
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
      ).resolves.toEqual({
        query: 'SPECIAL_TEST_KEYWORD',
        results: [],
        truncated: false,
      });
      expect(warnSpy).toHaveBeenCalledWith(
        '[AI-WS-06-hotfix2] Search script failed for session session-123: exitCode=127, stderr=find: not found',
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

  it('uses node:20-alpine when browserCapable is not set', async () => {
    await service.createContainer('sess-1', '/tmp/ws');

    expect(mockCreateContainer).toHaveBeenCalledTimes(1);
    expect(getCallArgs().Image).toBe('node:20-alpine');
  });

  it('uses node:20-alpine when browserCapable is false', async () => {
    await service.createContainer('sess-2', '/tmp/ws', { browserCapable: false });

    expect(getCallArgs().Image).toBe('node:20-alpine');
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
