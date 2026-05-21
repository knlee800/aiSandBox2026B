import { Injectable, NotFoundException, GoneException } from '@nestjs/common';
import { GitCheckpointService } from '../git-checkpoints/git-checkpoint.service';
import { SessionService } from '../sessions/session.service';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { CheckpointResponseDto } from './dto/checkpoint-response.dto';
import { DiffResponseDto } from './dto/diff-response.dto';
import { RevertResponseDto } from './dto/revert-response.dto';

/**
 * CheckpointsService
 * PHASE-68B: Business logic for checkpoint history/control operations
 * Orchestrates git operations via container-manager and checkpoint data from git-checkpoint service
 */
@Injectable()
export class CheckpointsService {
  constructor(
    private readonly gitCheckpointService: GitCheckpointService,
    private readonly sessionService: SessionService,
    private readonly containerManagerHttpClient: ContainerManagerHttpClient,
  ) {}

  /**
   * List all checkpoints for a session
   * Returns checkpoints in reverse chronological order (newest first)
   * @param sessionId - Session UUID
   * @returns Array of checkpoints
   * @throws NotFoundException if session not found
   */
  async listCheckpoints(sessionId: string): Promise<CheckpointResponseDto[]> {
    // Verify session exists (throws NotFoundException if not found)
    await this.sessionService.getSessionById(sessionId);

    // Get checkpoints from git_checkpoints table
    const checkpoints = await this.gitCheckpointService.getSessionTimeline(
      sessionId,
    );

    // Map to response DTO format (reverse order for newest-first)
    return checkpoints
      .reverse()
      .map((checkpoint) => ({
        id: checkpoint.id,
        commitHash: checkpoint.commitHash,
        messageNumber: checkpoint.messageNumber,
        description: checkpoint.description,
        filesChanged: checkpoint.filesChanged,
        createdAt: checkpoint.createdAt.toISOString(),
      }));
  }

  /**
   * Get diff for a specific checkpoint
   * Returns diff between checkpoint and parent commit
   * @param sessionId - Session UUID
   * @param commitHash - Commit hash to get diff for
   * @returns Diff data
   * @throws NotFoundException if session or checkpoint not found
   */
  async getCheckpointDiff(
    sessionId: string,
    commitHash: string,
  ): Promise<DiffResponseDto> {
    // Verify session exists
    await this.sessionService.getSessionById(sessionId);

    // Verify checkpoint exists
    const checkpoint = await this.gitCheckpointService.getCheckpointByHash(
      commitHash,
    );
    if (!checkpoint) {
      throw new NotFoundException(
        `Checkpoint with hash ${commitHash} not found`,
      );
    }

    // Verify checkpoint belongs to session
    if (checkpoint.sessionId !== sessionId) {
      throw new NotFoundException(
        `Checkpoint with hash ${commitHash} not found`,
      );
    }

    // Get diff from container-manager
    const diffResult = await this.containerManagerHttpClient.getGitDiff(
      sessionId,
      commitHash,
    );

    return {
      commitHash: diffResult.commitHash,
      parentHash: diffResult.parentHash,
      files: diffResult.files,
    };
  }

  /**
   * Revert session to a specific checkpoint
   * Creates new checkpoint after revert operation
   * @param sessionId - Session UUID
   * @param commitHash - Commit hash to revert to
   * @returns Revert result with new checkpoint info
   * @throws NotFoundException if session or checkpoint not found
   * @throws GoneException if session is terminated
   */
  async revertToCheckpoint(
    sessionId: string,
    commitHash: string,
    userId: string,
  ): Promise<RevertResponseDto> {
    // Verify session exists and not terminated
    const session = await this.sessionService.getSessionById(sessionId);

    // Check if session is terminated
    if (session.terminatedAt !== null) {
      throw new GoneException(
        `Session ${sessionId} is terminated and cannot be reverted`,
      );
    }

    // Verify checkpoint exists
    const checkpoint = await this.gitCheckpointService.getCheckpointByHash(
      commitHash,
    );
    if (!checkpoint) {
      throw new NotFoundException(
        `Checkpoint with hash ${commitHash} not found`,
      );
    }

    // Verify checkpoint belongs to session
    if (checkpoint.sessionId !== sessionId) {
      throw new NotFoundException(
        `Checkpoint with hash ${commitHash} not found`,
      );
    }

    // Execute revert in container-manager
    const revertResult = await this.containerManagerHttpClient.revertToCheckpoint(
      sessionId,
      commitHash,
      userId,
    );

    // Get the new checkpoint created by the revert operation
    // The revert operation in container-manager creates a new checkpoint automatically
    const newCheckpoint = await this.gitCheckpointService.getCheckpointByHash(
      revertResult.commitHash,
    );

    if (!newCheckpoint) {
      throw new Error(
        `Failed to retrieve new checkpoint after revert (commit ${revertResult.commitHash})`,
      );
    }

    return {
      message: 'Reverted successfully',
      newCheckpoint: {
        id: newCheckpoint.id,
        commitHash: newCheckpoint.commitHash,
        description: newCheckpoint.description || `Reverted to ${commitHash.substring(0, 7)}`,
      },
    };
  }

  async createManualCheckpoint(
    sessionId: string,
    userId: string,
    messageNumber: number = 0,
    description?: string,
  ): Promise<{ message: string; commitHash: string; filesChanged: number }> {
    const session = await this.sessionService.getSessionById(sessionId);
    if (session.terminatedAt !== null) {
      throw new GoneException(
        `Session ${sessionId} is terminated and cannot create save points`,
      );
    }

    const result = await this.containerManagerHttpClient.createManualCheckpoint(
      sessionId,
      userId,
      messageNumber,
      description,
    );

    if (result.commitHash) {
      const existing = await this.gitCheckpointService.getCheckpointByHash(result.commitHash);
      if (!existing) {
        await this.gitCheckpointService.recordCheckpoint({
          sessionId,
          commitHash: result.commitHash,
          filesChanged: result.filesChanged ?? 0,
          messageNumber,
          description: description || null,
        });
      }
    }

    return result;
  }
}
