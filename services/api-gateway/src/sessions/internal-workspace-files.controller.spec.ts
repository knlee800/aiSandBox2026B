import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InternalWorkspaceFilesController } from './internal-workspace-files.controller';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';

describe('InternalWorkspaceFilesController', () => {
  let controller: InternalWorkspaceFilesController;
  let mockClient: jest.Mocked<Pick<ContainerManagerHttpClient, 'readSessionFile' | 'listSessionDirectory'>>;

  beforeEach(async () => {
    mockClient = {
      readSessionFile: jest.fn(),
      listSessionDirectory: jest.fn(),
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
});
