import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InternalWorkspaceFilesController } from './internal-workspace-files.controller';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { SessionService } from './session.service';
import { SnapshotPersistenceService } from '../snapshots/snapshot-persistence.service';
import { ProjectsService } from '../projects/projects.service';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('InternalWorkspaceFilesController', () => {
  let controller: InternalWorkspaceFilesController;
  let mockClient: jest.Mocked<Pick<ContainerManagerHttpClient, 'readSessionFile' | 'listSessionDirectory' | 'searchSessionFiles' | 'writeSessionFile' | 'deleteSessionFile' | 'createManualCheckpoint' | 'execInSession'>>;
  let mockSessionService: { getSessionById: jest.Mock };
  let mockSnapshotPersistence: { saveSnapshot: jest.Mock };

  beforeEach(async () => {
    mockClient = {
      readSessionFile: jest.fn(),
      listSessionDirectory: jest.fn(),
      searchSessionFiles: jest.fn(),
      writeSessionFile: jest.fn(),
      deleteSessionFile: jest.fn(),
      createManualCheckpoint: jest.fn(),
      execInSession: jest.fn(),
    };
    mockSessionService = {
      getSessionById: jest.fn(),
    };
    mockSnapshotPersistence = {
      saveSnapshot: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalWorkspaceFilesController],
      providers: [
        {
          provide: ContainerManagerHttpClient,
          useValue: mockClient,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: SnapshotPersistenceService,
          useValue: mockSnapshotPersistence,
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

  describe('searchFiles', () => {
    it('delegates to ContainerManagerHttpClient.searchSessionFiles', async () => {
      const payload = {
        query: 'login',
        results: [{ path: 'src/app.ts', line: 4, preview: 'function login()' }],
        truncated: false,
      };
      mockClient.searchSessionFiles.mockResolvedValue(payload);

      const result = await controller.searchFiles('session-1', 'login');

      expect(mockClient.searchSessionFiles).toHaveBeenCalledWith(
        'session-1',
        'login',
      );
      expect(result).toEqual(payload);
    });

    it('throws BadRequestException when query is missing', async () => {
      await expect(controller.searchFiles('session-1', undefined)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockClient.searchSessionFiles).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when query is empty', async () => {
      await expect(controller.searchFiles('session-1', '')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockClient.searchSessionFiles).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when query is blank', async () => {
      await expect(controller.searchFiles('session-1', '   ')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockClient.searchSessionFiles).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when query is not a string', async () => {
      await expect(controller.searchFiles('session-1', 12)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockClient.searchSessionFiles).not.toHaveBeenCalled();
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

  describe('runValidation', () => {
    it('delegates to ContainerManagerHttpClient.execInSession with shell wrapper', async () => {
      mockClient.execInSession.mockResolvedValue({
        exitCode: 0,
        stdout: 'PASS',
        stderr: '',
      });

      const result = await controller.runValidation('session-1', 'npm test', 60000);

      expect(mockClient.execInSession).toHaveBeenCalledWith(
        'session-1',
        ['sh', '-lc', 'npm test'],
        '/workspace',
        undefined,
        60000,
      );
      expect(result).toEqual({ exitCode: 0, stdout: 'PASS', stderr: '' });
    });

    it('throws BadRequestException when command is missing', async () => {
      await expect(
        controller.runValidation('session-1', undefined, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when command is empty string', async () => {
      await expect(
        controller.runValidation('session-1', '  ', undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('propagates exec result from container-manager client', async () => {
      mockClient.execInSession.mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: 'Build failed',
      });

      const result = await controller.runValidation('session-1', 'npm run build');

      expect(result).toEqual({ exitCode: 1, stdout: '', stderr: 'Build failed' });
    });

    it('defaults timeoutMs to 120000 when not provided', async () => {
      mockClient.execInSession.mockResolvedValue({
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
      });

      await controller.runValidation('session-1', 'npm test');

      expect(mockClient.execInSession).toHaveBeenCalledWith(
        'session-1',
        ['sh', '-lc', 'npm test'],
        '/workspace',
        undefined,
        120_000,
      );
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

  describe('saveProjectSnapshot', () => {
    it('saves with the project-scoped ai label and returns the snapshot id', async () => {
      mockSessionService.getSessionById.mockResolvedValue({
        userId: 'user-1',
        projectId: 'project-1',
        terminatedAt: null,
      });
      mockSnapshotPersistence.saveSnapshot.mockResolvedValue({
        id: 'snap-1',
        userId: 'user-1',
        label: '[project-id:project-1:source:ai]',
        createdAt: '2026-11-02T00:00:00.000Z',
        fileCount: 1,
      });

      const result = await controller.saveProjectSnapshot('session-1');

      expect(mockSnapshotPersistence.saveSnapshot).toHaveBeenCalledTimes(1);
      expect(mockSnapshotPersistence.saveSnapshot).toHaveBeenCalledWith({
        userId: 'user-1',
        sessionId: 'session-1',
        label: '[project-id:project-1:source:ai]',
      });
      expect(result).toEqual({ saved: true, snapshotId: 'snap-1' });
    });

    it('returns saved false without saving when the session has no project', async () => {
      mockSessionService.getSessionById.mockResolvedValue({
        userId: 'user-1',
        projectId: null,
        terminatedAt: null,
      });

      const result = await controller.saveProjectSnapshot('session-1');

      expect(result).toEqual({ saved: false });
      expect(mockSnapshotPersistence.saveSnapshot).not.toHaveBeenCalled();
    });

    it('returns saved false without saving when the session has ended', async () => {
      mockSessionService.getSessionById.mockResolvedValue({
        userId: 'user-1',
        projectId: 'project-1',
        terminatedAt: new Date('2026-11-02T00:00:00.000Z'),
      });

      const result = await controller.saveProjectSnapshot('session-1');

      expect(result).toEqual({ saved: false });
      expect(mockSnapshotPersistence.saveSnapshot).not.toHaveBeenCalled();
    });

    it('returns saved false without saving when the session is missing', async () => {
      mockSessionService.getSessionById.mockRejectedValue(
        new NotFoundException('Session with ID session-missing not found'),
      );

      const result = await controller.saveProjectSnapshot('session-missing');

      expect(result).toEqual({ saved: false });
      expect(mockSnapshotPersistence.saveSnapshot).not.toHaveBeenCalled();
    });

    describe('SNAPSHOT-LABEL-01: shared snapshot label examples', () => {
      type ParseCase = { id: string; label: string | null; projectId: string | null };
      type WriterCase = { writer: string; projectId: string; label: string };
      const examples = JSON.parse(
        readFileSync(join(__dirname, '../snapshots/snapshot-label-examples.json'), 'utf8'),
      ) as { parseCases: ParseCase[]; writerCases: WriterCase[] };
      const gatewayWriterCases = examples.writerCases.filter(
        (example) => example.writer === 'gateway-ai',
      );

      it('has gateway writer cases', () => {
        expect(gatewayWriterCases.length).toBeGreaterThan(0);
      });

      it.each(gatewayWriterCases.map((example) => [JSON.stringify(example.projectId), example] as const))(
        'writes the example label for project id %s and it parses back to that project',
        async (_projectId, example) => {
          mockSessionService.getSessionById.mockResolvedValue({
            userId: 'user-1',
            projectId: example.projectId,
            terminatedAt: null,
          });
          mockSnapshotPersistence.saveSnapshot.mockResolvedValue({ id: 'snap-1' });

          await controller.saveProjectSnapshot('session-1');

          const written = mockSnapshotPersistence.saveSnapshot.mock.calls[0][0].label;
          expect(written).toBe(example.label);
          const parseCase = examples.parseCases.find((candidate) => candidate.label === written);
          expect(parseCase?.projectId).toBe(example.projectId.trim());
          expect(ProjectsService['parseProjectIdFromSnapshotLabel'](written)).toBe(
            example.projectId.trim(),
          );
        },
      );
    });
  });
});
