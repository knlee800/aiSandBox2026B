import { Test, TestingModule } from '@nestjs/testing';
import { CheckpointsController } from './checkpoints.controller';
import { CheckpointsService } from './checkpoints.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotFoundException, GoneException } from '@nestjs/common';
import { CheckpointResponseDto } from './dto/checkpoint-response.dto';
import { DiffResponseDto } from './dto/diff-response.dto';
import { RevertResponseDto } from './dto/revert-response.dto';

describe('CheckpointsController (PHASE-68B)', () => {
  let controller: CheckpointsController;
  let service: jest.Mocked<CheckpointsService>;
  let mockSessionService: any;

  beforeEach(async () => {
    mockSessionService = {
      getSessionById: jest.fn(),
    };

    const mockService = {
      listCheckpoints: jest.fn(),
      getCheckpointDiff: jest.fn(),
      revertToCheckpoint: jest.fn(),
    };

    Object.defineProperty(mockService, 'sessionService', {
      get: () => mockSessionService,
      configurable: true,
    });

    const mockGuard = {
      canActivate: jest.fn(() => true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckpointsController],
      providers: [
        {
          provide: CheckpointsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<CheckpointsController>(CheckpointsController);
    service = module.get(CheckpointsService);
  });

  describe('GET /api/sessions/:id/checkpoints', () => {
    it('should return checkpoints for owned session', async () => {
      const sessionId = 'session-123';
      const userId = 'user-456';
      const req = { user: { userId } };

      const mockSession = {
        id: sessionId,
        userId,
        terminatedAt: null,
      };

      const mockCheckpoints: CheckpointResponseDto[] = [
        {
          id: 'checkpoint-1',
          commitHash: 'abc123def456789012345678901234567890abcd',
          messageNumber: 1,
          description: 'Created Flask app',
          filesChanged: 2,
          createdAt: '2026-03-09T14:32:15Z',
        },
      ];

      service.listCheckpoints.mockResolvedValue(mockCheckpoints);
      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);

      const result = await controller.listCheckpoints(sessionId, req);

      expect(result).toEqual(mockCheckpoints);
      expect(service.listCheckpoints).toHaveBeenCalledWith(sessionId);
      expect(mockSessionService.getSessionById).toHaveBeenCalledWith(sessionId);
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

      service.listCheckpoints.mockResolvedValue([]);
      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);

      await expect(
        controller.listCheckpoints(sessionId, req),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if session does not exist', async () => {
      const sessionId = 'nonexistent';
      const userId = 'user-456';
      const req = { user: { userId } };

      service.listCheckpoints.mockRejectedValue(
        new NotFoundException(`Session with ID ${sessionId} not found`),
      );

      await expect(
        controller.listCheckpoints(sessionId, req),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /api/sessions/:id/checkpoints/:hash/diff', () => {
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

      const mockDiff: DiffResponseDto = {
        commitHash,
        parentHash: 'parent123456789012345678901234567890abcd',
        files: [
          {
            path: 'app.py',
            status: 'added',
            diff: '@@ -0,0 +1,3 @@\n+from flask import Flask\n',
          },
        ],
      };

      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);
      service.getCheckpointDiff.mockResolvedValue(mockDiff);

      const result = await controller.getCheckpointDiff(sessionId, commitHash, req);

      expect(result).toEqual(mockDiff);
      expect(mockSessionService.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(service.getCheckpointDiff).toHaveBeenCalledWith(sessionId, commitHash);
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

      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);

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

      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);
      service.getCheckpointDiff.mockRejectedValue(
        new NotFoundException(`Checkpoint with hash ${commitHash} not found`),
      );

      await expect(
        controller.getCheckpointDiff(sessionId, commitHash, req),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /api/sessions/:id/revert', () => {
    it('should revert session to checkpoint for owned active session', async () => {
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

      const mockRevertResponse: RevertResponseDto = {
        message: 'Reverted successfully',
        newCheckpoint: {
          id: 'new-checkpoint-id',
          commitHash: 'new123def456789012345678901234567890abcd',
          description: 'Reverted to abc123',
        },
      };

      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);
      service.revertToCheckpoint.mockResolvedValue(mockRevertResponse);

      const result = await controller.revertToCheckpoint(sessionId, revertDto, req);

      expect(result).toEqual(mockRevertResponse);
      expect(mockSessionService.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(service.revertToCheckpoint).toHaveBeenCalledWith(sessionId, commitHash);
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

      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);

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

      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);
      service.revertToCheckpoint.mockRejectedValue(
        new GoneException(`Session ${sessionId} is terminated and cannot be reverted`),
      );

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

      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);
      service.revertToCheckpoint.mockRejectedValue(
        new NotFoundException(`Checkpoint with hash ${commitHash} not found`),
      );

      await expect(
        controller.revertToCheckpoint(sessionId, revertDto, req),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
