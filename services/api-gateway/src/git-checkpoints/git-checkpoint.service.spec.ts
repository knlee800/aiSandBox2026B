import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GitCheckpoint } from '../entities/git-checkpoint.entity';
import { Session } from '../entities/session.entity';
import { GitCheckpointRepository } from '../repositories/git-checkpoint.repository';
import { GitCheckpointService } from './git-checkpoint.service';

describe('GitCheckpointService checkpoint history', () => {
  let service: GitCheckpointService;
  let checkpointRepository: { createQueryBuilder: jest.Mock };
  let sessionRepository: { findOne: jest.Mock };

  const commitHash = 'a'.repeat(40);

  function queryBuilder(rows: Partial<GitCheckpoint>[] = []) {
    return {
      innerJoin: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
  }

  function row(partial: Partial<GitCheckpoint>): GitCheckpoint {
    return {
      id: 'cp-1',
      commitHash,
      sessionId: 'session-old',
      messageNumber: 1,
      description: 'earlier',
      filesChanged: 1,
      createdAt: new Date('2026-03-01T00:00:00Z'),
      session: {
        id: 'session-old',
        userId: 'user-1',
        projectId: 'project-1',
      } as Session,
      ...partial,
    } as GitCheckpoint;
  }

  beforeEach(async () => {
    checkpointRepository = { createQueryBuilder: jest.fn() };
    sessionRepository = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitCheckpointService,
        {
          provide: GitCheckpointRepository,
          useValue: {
            recordCheckpoint: jest.fn(),
            getCheckpointsBySession: jest.fn(),
            getCheckpointByHash: jest.fn(),
            getLatestCheckpoint: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(GitCheckpoint),
          useValue: checkpointRepository,
        },
        {
          provide: getRepositoryToken(Session),
          useValue: sessionRepository,
        },
      ],
    }).compile();

    service = module.get(GitCheckpointService);
  });

  describe('getSessionOwnerAndProject', () => {
    it('returns the owner and project for a session', async () => {
      sessionRepository.findOne.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        projectId: 'project-1',
      });

      await expect(service.getSessionOwnerAndProject('session-1')).resolves.toEqual({
        userId: 'user-1',
        projectId: 'project-1',
      });
      expect(sessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });

    it('returns null when the session does not exist', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(service.getSessionOwnerAndProject('missing')).resolves.toBeNull();
    });

    it('returns a null project when the session has none', async () => {
      sessionRepository.findOne.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        projectId: null,
      });

      await expect(service.getSessionOwnerAndProject('session-1')).resolves.toEqual({
        userId: 'user-1',
        projectId: null,
      });
    });
  });

  describe('getProjectTimeline', () => {
    it('loads ledger rows for that project and owner through a session join, oldest first', async () => {
      const rows = [
        row({ id: 'older', createdAt: new Date('2026-03-01T00:00:00Z') }),
        row({ id: 'newer', createdAt: new Date('2026-03-02T00:00:00Z') }),
      ];
      const qb = queryBuilder(rows);
      checkpointRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getProjectTimeline('project-1', 'owner-1');

      expect(result).toBe(rows);
      expect(checkpointRepository.createQueryBuilder).toHaveBeenCalledWith('checkpoint');
      expect(qb.innerJoin).toHaveBeenCalledWith('checkpoint.session', 'session');
      expect(qb.where).toHaveBeenCalledWith('session.projectId = :projectId', {
        projectId: 'project-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('session.userId = :userId', {
        userId: 'owner-1',
      });
      expect(qb.orderBy).toHaveBeenCalledWith('checkpoint.createdAt', 'ASC');
    });
  });

  describe('findCheckpointForSession', () => {
    const current = {
      id: 'session-new',
      userId: 'user-1',
      projectId: 'project-1' as string | null,
    };

    it('returns the current session row when that hash was recorded there', async () => {
      const own = row({
        id: 'cp-own',
        sessionId: 'session-new',
        session: { id: 'session-new', userId: 'user-1', projectId: 'project-1' } as Session,
      });
      const earlier = row({ id: 'cp-earlier' });
      const qb = queryBuilder([earlier, own]);
      checkpointRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(service.findCheckpointForSession(commitHash, current)).resolves.toBe(own);
      expect(qb.innerJoinAndSelect).toHaveBeenCalledWith('checkpoint.session', 'session');
      expect(qb.where).toHaveBeenCalledWith('checkpoint.commitHash = :commitHash', {
        commitHash,
      });
    });

    it('returns an earlier session row for the same project and user', async () => {
      const earlier = row({ id: 'cp-earlier', sessionId: 'session-old' });
      const qb = queryBuilder([earlier]);
      checkpointRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(service.findCheckpointForSession(commitHash, current)).resolves.toBe(
        earlier,
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(checkpoint.sessionId = :sessionId OR (session.projectId = :projectId AND session.userId = :userId))',
        {
          sessionId: 'session-new',
          projectId: 'project-1',
          userId: 'user-1',
        },
      );
    });

    it('returns null for the same hash on another project', async () => {
      const otherProject = row({
        sessionId: 'session-other',
        session: {
          id: 'session-other',
          userId: 'user-1',
          projectId: 'project-2',
        } as Session,
      });
      checkpointRepository.createQueryBuilder.mockReturnValue(queryBuilder([otherProject]));

      await expect(service.findCheckpointForSession(commitHash, current)).resolves.toBeNull();
    });

    it('returns null for the same hash owned by another user', async () => {
      const otherUser = row({
        sessionId: 'session-other',
        session: {
          id: 'session-other',
          userId: 'user-2',
          projectId: 'project-1',
        } as Session,
      });
      checkpointRepository.createQueryBuilder.mockReturnValue(queryBuilder([otherUser]));

      await expect(service.findCheckpointForSession(commitHash, current)).resolves.toBeNull();
    });

    it('returns null for another session when this session has no project', async () => {
      const earlier = row({ sessionId: 'session-old' });
      const qb = queryBuilder([earlier]);
      checkpointRepository.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.findCheckpointForSession(commitHash, {
          id: 'session-new',
          userId: 'user-1',
          projectId: null,
        }),
      ).resolves.toBeNull();
      expect(qb.andWhere).toHaveBeenCalledWith('checkpoint.sessionId = :sessionId', {
        sessionId: 'session-new',
      });
    });
  });
});
