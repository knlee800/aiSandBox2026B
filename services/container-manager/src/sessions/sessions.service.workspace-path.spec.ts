import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

const mockPrepare = jest.fn();
const mockRm = jest.fn<any>().mockResolvedValue(undefined);

jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    exec: jest.fn(),
    prepare: mockPrepare,
  }));
});

jest.mock('fs', () => ({
  ...jest.requireActual<typeof import('fs')>('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn<any>().mockResolvedValue(undefined),
  rm: (...args: unknown[]) => mockRm(...args),
}));

import { SessionsService } from './sessions.service';

describe('SessionsService workspace path (CM-PATH-01)', () => {
  let service: SessionsService;
  let mockRun: jest.Mock<any>;
  let dockerRuntimeService: {
    findContainerBySessionId: jest.Mock<any>;
    createContainer: jest.Mock<any>;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRun = jest.fn<any>();
    mockPrepare.mockImplementation(() => ({
      get: jest.fn(),
      run: mockRun,
      all: jest.fn().mockReturnValue([]),
    }));
    dockerRuntimeService = {
      findContainerBySessionId: jest.fn<any>().mockRejectedValue(new Error('no container')),
      createContainer: jest.fn<any>(),
    };
    service = new SessionsService(
      {} as any,
      {} as any,
      dockerRuntimeService as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  const workspacesRoot = () => (service as any).workspacesRoot as string;

  it('returns a direct child of the workspaces root for a plain id', () => {
    const id = '3f2a8c1e-0b4d-4c5e-9f6a-7b8c9d0e1f2a';
    const workspacePath = service.getWorkspacePath(id);
    expect(workspacePath).toBe(path.join(workspacesRoot(), id));
    expect(path.dirname(workspacePath)).toBe(path.resolve(workspacesRoot()));
  });

  it('refuses ids that would leave the workspaces root or reach a sibling', () => {
    for (const id of ['..', '.', '', '../abc', 'abc/../abcX', '..\\abc', '/etc', 'a\u0000b']) {
      expect(() => service.getWorkspacePath(id)).toThrow(BadRequestException);
    }
  });

  it('deleteSession refuses .. before removing a container, a workspace or a row', async () => {
    await expect(service.deleteSession('..')).rejects.toThrow('Invalid session id');
    expect(dockerRuntimeService.findContainerBySessionId).not.toHaveBeenCalled();
    expect(mockRm).not.toHaveBeenCalled();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('deleteSession still removes the workspace of a plain id', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.useFakeTimers();
    try {
      await service.deleteSession('sess-1');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
      errorSpy.mockRestore();
    }
    expect(mockRm).toHaveBeenCalledWith(path.join(workspacesRoot(), 'sess-1'), {
      recursive: true,
      force: true,
    });
  });

  it('startSessionContainer refuses .. before inserting a row or creating a container', async () => {
    await expect(service.startSessionContainer('..')).rejects.toThrow(BadRequestException);
    expect(mockPrepare).not.toHaveBeenCalledWith(expect.stringContaining('SELECT id FROM sessions'));
    expect(mockRun).not.toHaveBeenCalled();
    expect(dockerRuntimeService.createContainer).not.toHaveBeenCalled();
  });
});
