import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DockerRuntimeService } from './docker-runtime.service';

describe('DockerRuntimeService deleteFileFromContainer', () => {
  let service: DockerRuntimeService;

  beforeEach(() => {
    service = new DockerRuntimeService({
      getContainerMemoryLimitBytes: jest.fn().mockReturnValue(256 * 1024 * 1024),
      containerCpuLimit: 1,
      containerPidsLimit: 128,
      containerMemoryLimitMb: 256,
    } as any);
  });

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
