import { Test, TestingModule } from '@nestjs/testing';
import { CheckpointsService } from './checkpoints.service';
import { GitCheckpointService } from '../git-checkpoints/git-checkpoint.service';
import { SessionService } from '../sessions/session.service';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { NotFoundException, GoneException } from '@nestjs/common';
import { GitCheckpoint } from '../entities/git-checkpoint.entity';

describe('CheckpointsService (PHASE-68B)', () => {
  let service: CheckpointsService;
  let gitCheckpointService: jest.Mocked<GitCheckpointService>;
  let sessionService: jest.Mocked<SessionService>;
  let containerManagerClient: jest.Mocked<ContainerManagerHttpClient>;

  beforeEach(async () => {
    const mockGitCheckpointService = {
      getSessionTimeline: jest.fn(),
      getCheckpointByHash: jest.fn(),
      recordCheckpoint: jest.fn(),
    };

    const mockSessionService = {
      getSessionById: jest.fn(),
    };

    const mockContainerManagerClient = {
      getGitDiff: jest.fn(),
      revertToCheckpoint: jest.fn(),
      createManualCheckpoint: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckpointsService,
        {
          provide: GitCheckpointService,
          useValue: mockGitCheckpointService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: ContainerManagerHttpClient,
          useValue: mockContainerManagerClient,
        },
      ],
    }).compile();

    service = module.get<CheckpointsService>(CheckpointsService);
    gitCheckpointService = module.get(GitCheckpointService);
    sessionService = module.get(SessionService);
    containerManagerClient = module.get(ContainerManagerHttpClient);
  });

  describe('listCheckpoints', () => {
    it('should return checkpoints in reverse chronological order', async () => {
      const sessionId = 'session-123';
      const mockSession = { id: sessionId, userId: 'user-456' };

      const mockCheckpoints: Partial<GitCheckpoint>[] = [
        {
          id: 'checkpoint-1',
          commitHash: 'abc123',
          messageNumber: 1,
          description: 'First commit',
          filesChanged: 2,
          createdAt: new Date('2026-03-09T14:00:00Z'),
        },
        {
          id: 'checkpoint-2',
          commitHash: 'def456',
          messageNumber: 2,
          description: 'Second commit',
          filesChanged: 3,
          createdAt: new Date('2026-03-09T15:00:00Z'),
        },
      ];

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getSessionTimeline.mockResolvedValue(mockCheckpoints as GitCheckpoint[]);

      const result = await service.listCheckpoints(sessionId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('checkpoint-2');
      expect(result[1].id).toBe('checkpoint-1');
      expect(sessionService.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(gitCheckpointService.getSessionTimeline).toHaveBeenCalledWith(sessionId);
    });

    it('should throw NotFoundException if session does not exist', async () => {
      const sessionId = 'nonexistent';

      sessionService.getSessionById.mockRejectedValue(
        new NotFoundException(`Session with ID ${sessionId} not found`),
      );

      await expect(service.listCheckpoints(sessionId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCheckpointDiff', () => {
    it('should return diff for valid checkpoint', async () => {
      const sessionId = 'session-123';
      const commitHash = 'abc123def456789012345678901234567890abcd';
      const mockSession = { id: sessionId, userId: 'user-456' };

      const mockCheckpoint: Partial<GitCheckpoint> = {
        id: 'checkpoint-1',
        sessionId,
        commitHash,
        messageNumber: 1,
        description: 'Test commit',
        filesChanged: 2,
      };

      const mockDiff = {
        commitHash,
        parentHash: 'parent123',
        files: [
          {
            path: 'app.py',
            status: 'added' as const,
            diff: '@@ -0,0 +1,3 @@\n+from flask import Flask\n',
          },
        ],
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash.mockResolvedValue(mockCheckpoint as GitCheckpoint);
      containerManagerClient.getGitDiff.mockResolvedValue(mockDiff);

      const result = await service.getCheckpointDiff(sessionId, commitHash);

      expect(result).toEqual(mockDiff);
      expect(sessionService.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(gitCheckpointService.getCheckpointByHash).toHaveBeenCalledWith(commitHash);
      expect(containerManagerClient.getGitDiff).toHaveBeenCalledWith(sessionId, commitHash);
    });

    it('should throw NotFoundException if checkpoint does not exist', async () => {
      const sessionId = 'session-123';
      const commitHash = 'nonexistent';
      const mockSession = { id: sessionId, userId: 'user-456' };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash.mockResolvedValue(null);

      await expect(
        service.getCheckpointDiff(sessionId, commitHash),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if checkpoint belongs to different session', async () => {
      const sessionId = 'session-123';
      const commitHash = 'abc123';
      const mockSession = { id: sessionId, userId: 'user-456' };

      const mockCheckpoint: Partial<GitCheckpoint> = {
        id: 'checkpoint-1',
        sessionId: 'other-session',
        commitHash,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash.mockResolvedValue(mockCheckpoint as GitCheckpoint);

      await expect(
        service.getCheckpointDiff(sessionId, commitHash),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('revertToCheckpoint', () => {
    it('should revert active session to checkpoint', async () => {
      const sessionId = 'session-123';
      const commitHash = 'abc123def456789012345678901234567890abcd';
      const mockSession = {
        id: sessionId,
        userId: 'user-456',
        terminatedAt: null,
      };

      const mockCheckpoint: Partial<GitCheckpoint> = {
        id: 'checkpoint-1',
        sessionId,
        commitHash,
        messageNumber: 1,
        description: 'Test commit',
      };

      const mockRevertResult = {
        message: 'Reverted to commit successfully',
        commitHash: 'new123def456789012345678901234567890abcd',
      };

      const mockNewCheckpoint: Partial<GitCheckpoint> = {
        id: 'new-checkpoint-id',
        commitHash: mockRevertResult.commitHash,
        description: 'Reverted to abc123',
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash
        .mockResolvedValueOnce(mockCheckpoint as GitCheckpoint)
        .mockResolvedValueOnce(mockNewCheckpoint as GitCheckpoint);
      containerManagerClient.revertToCheckpoint.mockResolvedValue(mockRevertResult);

      const result = await service.revertToCheckpoint(sessionId, commitHash, 'user-456');

      expect(result.message).toBe('Reverted successfully');
      expect(result.newCheckpoint.id).toBe('new-checkpoint-id');
      expect(sessionService.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(containerManagerClient.revertToCheckpoint).toHaveBeenCalledWith(sessionId, commitHash, 'user-456');
    });

    it('should throw GoneException if session is terminated', async () => {
      const sessionId = 'session-123';
      const commitHash = 'abc123';
      const mockSession = {
        id: sessionId,
        userId: 'user-456',
        terminatedAt: new Date(),
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);

      await expect(
        service.revertToCheckpoint(sessionId, commitHash, 'user-456'),
      ).rejects.toThrow(GoneException);
    });

    it('should throw NotFoundException if checkpoint does not exist', async () => {
      const sessionId = 'session-123';
      const commitHash = 'nonexistent';
      const mockSession = {
        id: sessionId,
        userId: 'user-456',
        terminatedAt: null,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash.mockResolvedValue(null);

      await expect(
        service.revertToCheckpoint(sessionId, commitHash, 'user-456'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if checkpoint belongs to different session', async () => {
      const sessionId = 'session-123';
      const commitHash = 'abc123';
      const mockSession = {
        id: sessionId,
        userId: 'user-456',
        terminatedAt: null,
      };

      const mockCheckpoint: Partial<GitCheckpoint> = {
        id: 'checkpoint-1',
        sessionId: 'other-session',
        commitHash,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash.mockResolvedValue(mockCheckpoint as GitCheckpoint);

      await expect(
        service.revertToCheckpoint(sessionId, commitHash, 'user-456'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createManualCheckpoint', () => {
    it('forwards allowEmpty=true and records checkpoint when commit hash is returned', async () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: null,
      };
      const result = {
        message: 'Changes committed successfully',
        commitHash: 'abc123def456789012345678901234567890abcd',
        filesChanged: 0,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      containerManagerClient.createManualCheckpoint.mockResolvedValue(result as any);
      gitCheckpointService.getCheckpointByHash.mockResolvedValue(null);

      const response = await service.createManualCheckpoint(
        sessionId,
        userId,
        0,
        'Auth Module: pre-install snapshot',
        true,
      );

      expect(containerManagerClient.createManualCheckpoint).toHaveBeenCalledWith(
        sessionId,
        userId,
        0,
        'Auth Module: pre-install snapshot',
        true,
      );
      expect(gitCheckpointService.recordCheckpoint).toHaveBeenCalledWith({
        sessionId,
        commitHash: result.commitHash,
        filesChanged: 0,
        messageNumber: 0,
        description: 'Auth Module: pre-install snapshot',
      });
      expect(response).toEqual(result);
    });

    it('does not record checkpoint when commitHash is null', async () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: null,
      };
      const result = {
        message: 'No changes to commit',
        commitHash: null,
        filesChanged: 0,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      containerManagerClient.createManualCheckpoint.mockResolvedValue(result as any);

      const response = await service.createManualCheckpoint(
        sessionId,
        userId,
        0,
        'Auth Module: pre-install snapshot',
        true,
      );

      expect(gitCheckpointService.getCheckpointByHash).not.toHaveBeenCalled();
      expect(gitCheckpointService.recordCheckpoint).not.toHaveBeenCalled();
      expect(response).toEqual(result);
    });
  });
});
