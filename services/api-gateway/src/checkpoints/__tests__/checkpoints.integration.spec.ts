import { Test, TestingModule } from '@nestjs/testing';
import { CheckpointsController } from '../checkpoints.controller';
import { CheckpointsService } from '../checkpoints.service';
import { GitCheckpointService } from '../../git-checkpoints/git-checkpoint.service';
import { SessionService } from '../../sessions/session.service';
import { ContainerManagerHttpClient } from '../../clients/container-manager-http.client';
import { SessionCookieGuard } from '../../auth/session-cookie.guard';
import { NotFoundException, GoneException } from '@nestjs/common';

describe('CheckpointsController Integration (PHASE-68B)', () => {
  let controller: CheckpointsController;
  let service: CheckpointsService;
  let gitCheckpointService: jest.Mocked<GitCheckpointService>;
  let sessionService: jest.Mocked<SessionService>;
  let containerManagerClient: jest.Mocked<ContainerManagerHttpClient>;

  beforeEach(async () => {
    const mockGitCheckpointService = {
      getSessionTimeline: jest.fn(),
      getCheckpointByHash: jest.fn(),
    };

    const mockSessionService = {
      getSessionById: jest.fn(),
    };

    const mockContainerManagerClient = {
      getGitDiff: jest.fn(),
      revertToCheckpoint: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckpointsController],
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
    })
      .overrideGuard(SessionCookieGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CheckpointsController>(CheckpointsController);
    service = module.get<CheckpointsService>(CheckpointsService);
    gitCheckpointService = module.get(GitCheckpointService);
    sessionService = module.get(SessionService);
    containerManagerClient = module.get(ContainerManagerHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/sessions/:id/checkpoints - End-to-End', () => {
    it('should return checkpoints for owned session', async () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      const req = { user: { userId } };

      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: null,
      };

      const mockCheckpoints = [
        {
          id: 'checkpoint-1',
          sessionId,
          commitHash: 'abc123def456789012345678901234567890abcd',
          messageNumber: 1,
          description: 'First commit',
          filesChanged: 2,
          createdAt: new Date('2026-03-09T14:00:00Z'),
        },
        {
          id: 'checkpoint-2',
          sessionId,
          commitHash: 'def456abc789012345678901234567890abcdef',
          messageNumber: 2,
          description: 'Second commit',
          filesChanged: 3,
          createdAt: new Date('2026-03-09T15:00:00Z'),
        },
      ];

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getSessionTimeline.mockResolvedValue(mockCheckpoints as any);

      const result = await controller.listCheckpoints(sessionId, req);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('checkpoint-2');
      expect(result[1].id).toBe('checkpoint-1');
      expect(result[0].createdAt).toBe('2026-03-09T15:00:00.000Z');
      expect(sessionService.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(gitCheckpointService.getSessionTimeline).toHaveBeenCalledWith(sessionId);
    });

    it('should return empty array if no checkpoints exist', async () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      const req = { user: { userId } };

      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: null,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getSessionTimeline.mockResolvedValue([]);

      const result = await controller.listCheckpoints(sessionId, req);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException if session not owned by user', async () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      const req = { user: { userId } };

      const mockSession = {
        id: sessionId,
        userId: 'other-user',
        terminatedAt: null,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getSessionTimeline.mockResolvedValue([]);

      await expect(controller.listCheckpoints(sessionId, req)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if session does not exist', async () => {
      const sessionId = 'nonexistent';
      const userId = 'user-456';
      const req = { user: { userId } };

      sessionService.getSessionById.mockRejectedValue(
        new NotFoundException(`Session with ID ${sessionId} not found`),
      );

      await expect(controller.listCheckpoints(sessionId, req)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('GET /api/sessions/:id/checkpoints/:hash/diff - End-to-End', () => {
    it('should return diff for owned session checkpoint', async () => {
      const sessionId = 'session-123';
      const commitHash = 'abc123def456789012345678901234567890abcd';
      const userId = 'user-456';
      const req = { user: { userId } };

      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: null,
      };

      const mockCheckpoint = {
        id: 'checkpoint-1',
        sessionId,
        commitHash,
        messageNumber: 1,
        description: 'Test commit',
        filesChanged: 2,
      };

      const mockDiff = {
        commitHash,
        parentHash: 'parent123456789012345678901234567890abcd',
        files: [
          {
            path: 'app.py',
            status: 'added' as const,
            diff: '@@ -0,0 +1,3 @@\n+from flask import Flask\n+app = Flask(__name__)\n',
          },
        ],
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash.mockResolvedValue(mockCheckpoint as any);
      containerManagerClient.getGitDiff.mockResolvedValue(mockDiff);

      const result = await controller.getCheckpointDiff(sessionId, commitHash, req);

      expect(result).toEqual(mockDiff);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('app.py');
      expect(result.files[0].status).toBe('added');
      expect(sessionService.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(gitCheckpointService.getCheckpointByHash).toHaveBeenCalledWith(commitHash);
      expect(containerManagerClient.getGitDiff).toHaveBeenCalledWith(sessionId, commitHash);
    });

    it('should throw NotFoundException if session not owned by user', async () => {
      const sessionId = 'session-123';
      const commitHash = 'abc123def456789012345678901234567890abcd';
      const userId = 'user-456';
      const req = { user: { userId } };

      const mockSession = {
        id: sessionId,
        userId: 'other-user',
        terminatedAt: null,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);

      await expect(
        controller.getCheckpointDiff(sessionId, commitHash, req),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if checkpoint does not exist', async () => {
      const sessionId = 'session-123';
      const commitHash = 'nonexistent';
      const userId = 'user-456';
      const req = { user: { userId } };

      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: null,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash.mockResolvedValue(null);

      await expect(
        controller.getCheckpointDiff(sessionId, commitHash, req),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if checkpoint belongs to different session', async () => {
      const sessionId = 'session-123';
      const commitHash = 'abc123';
      const userId = 'user-456';
      const req = { user: { userId } };

      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: null,
      };

      const mockCheckpoint = {
        id: 'checkpoint-1',
        sessionId: 'other-session',
        commitHash,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash.mockResolvedValue(mockCheckpoint as any);

      await expect(
        controller.getCheckpointDiff(sessionId, commitHash, req),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /api/sessions/:id/revert - End-to-End', () => {
    it('should revert active session to checkpoint', async () => {
      const sessionId = 'session-123';
      const commitHash = 'abc123def456789012345678901234567890abcd';
      const userId = 'user-456';
      const req = { user: { userId } };
      const revertDto = { commitHash };

      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: null,
      };

      const mockCheckpoint = {
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

      const mockNewCheckpoint = {
        id: 'new-checkpoint-id',
        commitHash: mockRevertResult.commitHash,
        description: 'Reverted to abc123',
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash
        .mockResolvedValueOnce(mockCheckpoint as any)
        .mockResolvedValueOnce(mockNewCheckpoint as any);
      containerManagerClient.revertToCheckpoint.mockResolvedValue(mockRevertResult);

      const result = await controller.revertToCheckpoint(sessionId, revertDto, req);

      expect(result.message).toBe('Reverted successfully');
      expect(result.newCheckpoint.id).toBe('new-checkpoint-id');
      expect(result.newCheckpoint.commitHash).toBe(mockRevertResult.commitHash);
      expect(sessionService.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(containerManagerClient.revertToCheckpoint).toHaveBeenCalledWith(
        sessionId,
        commitHash,
      );
    });

    it('should throw NotFoundException if session not owned by user', async () => {
      const sessionId = 'session-123';
      const commitHash = 'abc123def456789012345678901234567890abcd';
      const userId = 'user-456';
      const req = { user: { userId } };
      const revertDto = { commitHash };

      const mockSession = {
        id: sessionId,
        userId: 'other-user',
        terminatedAt: null,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);

      await expect(
        controller.revertToCheckpoint(sessionId, revertDto, req),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw GoneException if session is terminated', async () => {
      const sessionId = 'session-123';
      const commitHash = 'abc123def456789012345678901234567890abcd';
      const userId = 'user-456';
      const req = { user: { userId } };
      const revertDto = { commitHash };

      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: new Date(),
      };

      const mockCheckpoint = {
        id: 'checkpoint-1',
        sessionId,
        commitHash,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash.mockResolvedValue(mockCheckpoint as any);

      await expect(
        controller.revertToCheckpoint(sessionId, revertDto, req),
      ).rejects.toThrow(GoneException);
    });

    it('should throw NotFoundException if checkpoint does not exist', async () => {
      const sessionId = 'session-123';
      const commitHash = 'nonexistent';
      const userId = 'user-456';
      const req = { user: { userId } };
      const revertDto = { commitHash };

      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: null,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash.mockResolvedValue(null);

      await expect(
        controller.revertToCheckpoint(sessionId, revertDto, req),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if checkpoint belongs to different session', async () => {
      const sessionId = 'session-123';
      const commitHash = 'abc123';
      const userId = 'user-456';
      const req = { user: { userId } };
      const revertDto = { commitHash };

      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: null,
      };

      const mockCheckpoint = {
        id: 'checkpoint-1',
        sessionId: 'other-session',
        commitHash,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash.mockResolvedValue(mockCheckpoint as any);

      await expect(
        controller.revertToCheckpoint(sessionId, revertDto, req),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Full Workflow Integration', () => {
    it('should support list → diff → revert workflow', async () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      const req = { user: { userId } };

      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: null,
      };

      // Step 1: List checkpoints
      const mockCheckpoints = [
        {
          id: 'checkpoint-1',
          sessionId,
          commitHash: 'abc123def456789012345678901234567890abcd',
          messageNumber: 1,
          description: 'First commit',
          filesChanged: 2,
          createdAt: new Date('2026-03-09T14:00:00Z'),
        },
      ];

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getSessionTimeline.mockResolvedValue(mockCheckpoints as any);

      const checkpoints = await controller.listCheckpoints(sessionId, req);
      expect(checkpoints).toHaveLength(1);

      // Step 2: Get diff for checkpoint
      const commitHash = checkpoints[0].commitHash;
      const mockDiff = {
        commitHash,
        parentHash: null,
        files: [
          {
            path: 'app.py',
            status: 'added' as const,
            diff: '@@ -0,0 +1,3 @@\n+from flask import Flask\n',
          },
        ],
      };

      gitCheckpointService.getCheckpointByHash.mockResolvedValue(mockCheckpoints[0] as any);
      containerManagerClient.getGitDiff.mockResolvedValue(mockDiff);

      const diff = await controller.getCheckpointDiff(sessionId, commitHash, req);
      expect(diff.files).toHaveLength(1);

      // Step 3: Revert to checkpoint
      const revertDto = { commitHash };
      const mockRevertResult = {
        message: 'Reverted to commit successfully',
        commitHash: 'revert123def456789012345678901234567890ab',
      };

      const mockNewCheckpoint = {
        id: 'new-checkpoint-id',
        commitHash: mockRevertResult.commitHash,
        description: 'Reverted to abc123',
      };

      gitCheckpointService.getCheckpointByHash
        .mockResolvedValueOnce(mockCheckpoints[0] as any)
        .mockResolvedValueOnce(mockNewCheckpoint as any);
      containerManagerClient.revertToCheckpoint.mockResolvedValue(mockRevertResult);

      const revertResult = await controller.revertToCheckpoint(sessionId, revertDto, req);
      expect(revertResult.message).toBe('Reverted successfully');
      expect(revertResult.newCheckpoint.commitHash).toBe(mockRevertResult.commitHash);
    });
  });

  describe('Auth and Ownership Enforcement', () => {
    it('should enforce ownership across all endpoints', async () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      const otherUserId = 'other-user';
      const req = { user: { userId } };

      const mockSession = {
        id: sessionId,
        userId: otherUserId,
        terminatedAt: null,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getSessionTimeline.mockResolvedValue([]);

      // List checkpoints
      await expect(controller.listCheckpoints(sessionId, req)).rejects.toThrow(
        NotFoundException,
      );

      // Get diff
      await expect(
        controller.getCheckpointDiff(sessionId, 'abc123', req),
      ).rejects.toThrow(NotFoundException);

      // Revert
      await expect(
        controller.revertToCheckpoint(sessionId, { commitHash: 'abc123' }, req),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Termination State Handling', () => {
    it('should allow listing checkpoints for terminated session', async () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      const req = { user: { userId } };

      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: new Date(),
      };

      const mockCheckpoints = [
        {
          id: 'checkpoint-1',
          sessionId,
          commitHash: 'abc123',
          messageNumber: 1,
          description: 'Commit',
          filesChanged: 2,
          createdAt: new Date('2026-03-09T14:00:00Z'),
        },
      ];

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getSessionTimeline.mockResolvedValue(mockCheckpoints as any);

      const result = await controller.listCheckpoints(sessionId, req);
      expect(result).toHaveLength(1);
    });

    it('should allow getting diff for terminated session', async () => {
      const sessionId = 'session-123';
      const commitHash = 'abc123';
      const userId = 'user-456';
      const req = { user: { userId } };

      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: new Date(),
      };

      const mockCheckpoint = {
        id: 'checkpoint-1',
        sessionId,
        commitHash,
      };

      const mockDiff = {
        commitHash,
        parentHash: null,
        files: [],
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash.mockResolvedValue(mockCheckpoint as any);
      containerManagerClient.getGitDiff.mockResolvedValue(mockDiff);

      const result = await controller.getCheckpointDiff(sessionId, commitHash, req);
      expect(result).toEqual(mockDiff);
    });

    it('should reject revert for terminated session', async () => {
      const sessionId = 'session-123';
      const commitHash = 'abc123';
      const userId = 'user-456';
      const req = { user: { userId } };
      const revertDto = { commitHash };

      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: new Date(),
      };

      const mockCheckpoint = {
        id: 'checkpoint-1',
        sessionId,
        commitHash,
      };

      sessionService.getSessionById.mockResolvedValue(mockSession as any);
      gitCheckpointService.getCheckpointByHash.mockResolvedValue(mockCheckpoint as any);

      await expect(
        controller.revertToCheckpoint(sessionId, revertDto, req),
      ).rejects.toThrow(GoneException);
    });
  });
});
