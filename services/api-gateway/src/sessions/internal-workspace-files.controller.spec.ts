import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InternalWorkspaceFilesController } from './internal-workspace-files.controller';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';

describe('InternalWorkspaceFilesController', () => {
  let controller: InternalWorkspaceFilesController;
  let mockClient: jest.Mocked<Pick<ContainerManagerHttpClient, 'readSessionFile' | 'listSessionDirectory' | 'writeSessionFile' | 'deleteSessionFile' | 'createManualCheckpoint'>>;

  beforeEach(async () => {
    mockClient = {
      readSessionFile: jest.fn(),
      listSessionDirectory: jest.fn(),
      writeSessionFile: jest.fn(),
      deleteSessionFile: jest.fn(),
      createManualCheckpoint: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalWorkspaceFilesController],
      providers: [
        {
          provide: ContainerManagerHttpClient,
          useValue: mockClient,
        },
      ],
    }).compile();

    controller = module.get<InternalWorkspaceFilesController>(
      InternalWorkspaceFilesController,
    );
  });

  describe('readFile', () => {
    it('delegates to ContainerManagerHttpClient.readSessionFile', async () => {
      mockClient.readSessionFile.mockResolvedValue({
        path: 'src/app.ts',
        content: 'const x = 1;',
      });

      const result = await controller.readFile('session-1', 'src/app.ts');

      expect(mockClient.readSessionFile).toHaveBeenCalledWith(
        'session-1',
        'src/app.ts',
      );
      expect(result).toEqual({ path: 'src/app.ts', content: 'const x = 1;' });
    });

    it('throws BadRequestException when path is missing', async () => {
      await expect(controller.readFile('session-1', undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when path is empty string', async () => {
      await expect(controller.readFile('session-1', '  ')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listDirectory', () => {
    it('delegates to ContainerManagerHttpClient.listSessionDirectory', async () => {
      mockClient.listSessionDirectory.mockResolvedValue({
        path: 'src',
        entries: [
          { name: 'app.ts', type: 'file', size: 100, modifiedAt: '2026-01-01T00:00:00Z' },
        ],
      });

      const result = await controller.listDirectory('session-1', 'src');

      expect(mockClient.listSessionDirectory).toHaveBeenCalledWith(
        'session-1',
        'src',
      );
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].name).toBe('app.ts');
    });

    it('defaults to root path when path is omitted', async () => {
      mockClient.listSessionDirectory.mockResolvedValue({
        path: '/',
        entries: [],
      });

      await controller.listDirectory('session-1', undefined);

      expect(mockClient.listSessionDirectory).toHaveBeenCalledWith(
        'session-1',
        '/',
      );
    });

    it('defaults to root path when path is empty', async () => {
      mockClient.listSessionDirectory.mockResolvedValue({
        path: '/',
        entries: [],
      });

      await controller.listDirectory('session-1', '  ');

      expect(mockClient.listSessionDirectory).toHaveBeenCalledWith(
        'session-1',
        '/',
      );
    });
  });

  describe('writeFile', () => {
    it('delegates to ContainerManagerHttpClient.writeSessionFile', async () => {
      mockClient.writeSessionFile.mockResolvedValue(undefined);

      const result = await controller.writeFile('session-1', 'src/app.ts', 'const x = 1;');

      expect(mockClient.writeSessionFile).toHaveBeenCalledWith(
        'session-1',
        'src/app.ts',
        'const x = 1;',
      );
      expect(result).toEqual({ ok: true });
    });

    it('throws BadRequestException when path is missing', async () => {
      await expect(controller.writeFile('session-1', undefined, 'content')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when path is empty string', async () => {
      await expect(controller.writeFile('session-1', '  ', 'content')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when content is missing', async () => {
      await expect(controller.writeFile('session-1', 'file.ts', undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates upstream errors from container-manager client', async () => {
      mockClient.writeSessionFile.mockRejectedValue(new Error('Container not running'));

      await expect(
        controller.writeFile('session-1', 'file.ts', 'content'),
      ).rejects.toThrow('Container not running');
    });
  });

  describe('deleteFile', () => {
    it('delegates to ContainerManagerHttpClient.deleteSessionFile', async () => {
      mockClient.deleteSessionFile.mockResolvedValue(undefined);

      const result = await controller.deleteFile('session-1', 'src/old.ts');

      expect(mockClient.deleteSessionFile).toHaveBeenCalledWith(
        'session-1',
        'src/old.ts',
      );
      expect(result).toEqual({ ok: true });
    });

    it('throws BadRequestException when path is missing', async () => {
      await expect(controller.deleteFile('session-1', undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when path is empty string', async () => {
      await expect(controller.deleteFile('session-1', '  ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propagates upstream errors from container-manager client', async () => {
      mockClient.deleteSessionFile.mockRejectedValue(new Error('File not found'));

      await expect(
        controller.deleteFile('session-1', 'missing.ts'),
      ).rejects.toThrow('File not found');
    });
  });

  describe('createCheckpoint', () => {
    it('delegates to ContainerManagerHttpClient.createManualCheckpoint', async () => {
      mockClient.createManualCheckpoint.mockResolvedValue({
        message: 'Checkpoint created',
        commitHash: 'abc123',
        filesChanged: 3,
      });

      const result = await controller.createCheckpoint('session-1', 'Pre-apply checkpoint');

      expect(mockClient.createManualCheckpoint).toHaveBeenCalledWith(
        'session-1',
        'agent-harness',
        0,
        'Pre-apply checkpoint',
        true,
      );
      expect(result).toEqual({ commitHash: 'abc123', filesChanged: 3 });
    });

    it('passes allowEmpty true to createManualCheckpoint', async () => {
      mockClient.createManualCheckpoint.mockResolvedValue({
        message: 'Checkpoint created',
        commitHash: 'def456',
        filesChanged: 0,
      });

      await controller.createCheckpoint('session-1', 'test');

      expect(mockClient.createManualCheckpoint).toHaveBeenCalledWith(
        'session-1',
        'agent-harness',
        0,
        'test',
        true,
      );
    });

    it('accepts optional description and defaults when omitted', async () => {
      mockClient.createManualCheckpoint.mockResolvedValue({
        message: 'Checkpoint created',
        commitHash: 'ghi789',
        filesChanged: 1,
      });

      await controller.createCheckpoint('session-1', undefined);

      expect(mockClient.createManualCheckpoint).toHaveBeenCalledWith(
        'session-1',
        'agent-harness',
        0,
        'Pre-apply checkpoint (Agent Harness)',
        true,
      );
    });

    it('propagates upstream errors from container-manager client', async () => {
      mockClient.createManualCheckpoint.mockRejectedValue(
        new Error('Container not running'),
      );

      await expect(
        controller.createCheckpoint('session-1', 'test'),
      ).rejects.toThrow('Container not running');
    });
  });
});
