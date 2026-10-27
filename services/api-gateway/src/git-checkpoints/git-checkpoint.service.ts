import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GitCheckpointRepository } from '../repositories/git-checkpoint.repository';
import { GitCheckpoint } from '../entities/git-checkpoint.entity';
import { Session } from '../entities/session.entity';

/**
 * GitCheckpointService
 * Business logic for git checkpoint tracking
 * Append-only ledger for version control history
 * NO git execution logic - only recording
 */
@Injectable()
export class GitCheckpointService {
  constructor(
    private readonly gitCheckpointRepository: GitCheckpointRepository,
    @InjectRepository(GitCheckpoint)
    private readonly checkpointRepository: Repository<GitCheckpoint>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  /**
   * Record a git checkpoint after sandbox auto-commit
   * Creates immutable checkpoint entry for timeline navigation
   * @param data - Checkpoint data
   * @param data.sessionId - Session UUID (required)
   * @param data.commitHash - Git commit SHA (required)
   * @param data.messageNumber - Associated chat message number (optional)
   * @param data.description - Human-readable description (optional)
   * @param data.filesChanged - Number of files changed in commit (required)
   * @returns Created checkpoint record
   */
  async recordCheckpoint(data: {
    sessionId: string;
    commitHash: string;
    messageNumber?: number | null;
    description?: string | null;
    filesChanged: number;
  }): Promise<GitCheckpoint> {
    return await this.gitCheckpointRepository.recordCheckpoint({
      sessionId: data.sessionId,
      commitHash: data.commitHash,
      messageNumber: data.messageNumber ?? null,
      description: data.description ?? null,
      filesChanged: data.filesChanged,
    });
  }

  /**
   * Get checkpoint timeline for a session
   * Returns checkpoints in chronological order for timeline UI
   * @param sessionId - Session UUID
   * @returns Array of checkpoints (oldest first)
   */
  async getSessionTimeline(sessionId: string): Promise<GitCheckpoint[]> {
    return await this.gitCheckpointRepository.getCheckpointsBySession(
      sessionId,
    );
  }

  /**
   * Get checkpoint by commit hash
   * Useful for validating checkpoint existence before revert
   * @param commitHash - Git commit SHA
   * @returns Checkpoint or null
   */
  async getCheckpointByHash(
    commitHash: string,
  ): Promise<GitCheckpoint | null> {
    return await this.gitCheckpointRepository.getCheckpointByHash(commitHash);
  }

  /**
   * Get latest checkpoint for a session
   * Represents current state of the sandbox
   * @param sessionId - Session UUID
   * @returns Latest checkpoint or null if no checkpoints
   */
  async getLatestCheckpoint(
    sessionId: string,
  ): Promise<GitCheckpoint | null> {
    return await this.gitCheckpointRepository.getLatestCheckpoint(sessionId);
  }

  /**
   * Owner and project of a session, for checkpoint history save.
   * Returns null when the session does not exist.
   */
  async getSessionOwnerAndProject(
    sessionId: string,
  ): Promise<{ userId: string; projectId: string | null } | null> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });
    if (!session) {
      return null;
    }
    return {
      userId: session.userId,
      projectId: session.projectId ?? null,
    };
  }

  /**
   * Ledger rows for every session of this project owned by this user.
   * Oldest first, same order as getSessionTimeline.
   */
  async getProjectTimeline(
    projectId: string,
    userId: string,
  ): Promise<GitCheckpoint[]> {
    return this.checkpointRepository
      .createQueryBuilder('checkpoint')
      .innerJoin('checkpoint.session', 'session')
      .where('session.projectId = :projectId', { projectId })
      .andWhere('session.userId = :userId', { userId })
      .orderBy('checkpoint.createdAt', 'ASC')
      .getMany();
  }

  /**
   * A ledger row with this hash for the given session, or for another
   * session of the same project and user. Null when neither matches.
   */
  async findCheckpointForSession(
    commitHash: string,
    session: Pick<Session, 'id' | 'projectId' | 'userId'>,
  ): Promise<GitCheckpoint | null> {
    const qb = this.checkpointRepository
      .createQueryBuilder('checkpoint')
      .innerJoinAndSelect('checkpoint.session', 'session')
      .where('checkpoint.commitHash = :commitHash', { commitHash });

    if (session.projectId) {
      qb.andWhere(
        '(checkpoint.sessionId = :sessionId OR (session.projectId = :projectId AND session.userId = :userId))',
        {
          sessionId: session.id,
          projectId: session.projectId,
          userId: session.userId,
        },
      );
    } else {
      qb.andWhere('checkpoint.sessionId = :sessionId', {
        sessionId: session.id,
      });
    }

    const rows = await qb.getMany();

    const own = rows.find(
      (row) => row.commitHash === commitHash && row.sessionId === session.id,
    );
    if (own) {
      return own;
    }
    if (!session.projectId) {
      return null;
    }
    return (
      rows.find(
        (row) =>
          row.commitHash === commitHash &&
          row.session?.projectId === session.projectId &&
          row.session?.userId === session.userId,
      ) ?? null
    );
  }
}
