import { GoneException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { Session } from '../entities/session.entity';
import { SessionService } from '../sessions/session.service';
import { SnapshotPersistenceService } from '../snapshots/snapshot-persistence.service';
import { ProjectsService } from './projects.service';

describe('ProjectsService (PR-03-01)', () => {
  let service: ProjectsService;
  let projectRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let sessionRepository: {
    update: jest.Mock;
  };
  let sessionService: {
    getSessionById: jest.Mock;
  };
  let snapshotPersistenceService: {
    restoreSnapshot: jest.Mock;
  };

  beforeEach(async () => {
    projectRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    sessionRepository = {
      update: jest.fn(),
    };
    sessionService = {
      getSessionById: jest.fn(),
    };
    snapshotPersistenceService = {
      restoreSnapshot: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: projectRepository,
        },
        {
          provide: getRepositoryToken(Session),
          useValue: sessionRepository,
        },
        {
          provide: SessionService,
          useValue: sessionService,
        },
        {
          provide: SnapshotPersistenceService,
          useValue: snapshotPersistenceService,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('creates a named project for the current user', async () => {
    projectRepository.create.mockReturnValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'My Project',
    });
    projectRepository.save.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'My Project',
    });

    const result = await service.createProject('user-1', '  My Project  ');

    expect(projectRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'My Project',
    });
    expect(result.id).toBe('project-1');
  });

  it('lists only current user projects', async () => {
    projectRepository.find.mockResolvedValue([{ id: 'project-1', userId: 'user-1' }]);

    const result = await service.listProjects('user-1');

    expect(projectRepository.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { updatedAt: 'DESC' },
    });
    expect(result).toHaveLength(1);
  });

  it('get/rename enforce project ownership', async () => {
    projectRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.getProjectByIdForUser('user-1', 'project-missing')).rejects.toThrow(
      NotFoundException,
    );

    projectRepository.findOne.mockResolvedValueOnce({
      id: 'project-1',
      userId: 'user-1',
      name: 'Old Name',
    });
    projectRepository.save.mockResolvedValueOnce({
      id: 'project-1',
      userId: 'user-1',
      name: 'New Name',
    });

    const renamed = await service.renameProject('user-1', 'project-1', ' New Name ');
    expect(renamed.name).toBe('New Name');
  });

  it('associates a usable session with a project', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'Project A',
    });
    sessionService.getSessionById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      terminatedAt: null,
      projectId: null,
    });
    sessionRepository.update.mockResolvedValue({ affected: 1 });

    const result = await service.associateSessionWithProject({
      userId: 'user-1',
      projectId: 'project-1',
      sessionId: 'session-1',
    });

    expect(sessionRepository.update).toHaveBeenCalledWith(
      { id: 'session-1' },
      { projectId: 'project-1' },
    );
    expect(result).toEqual({ projectId: 'project-1', sessionId: 'session-1' });
  });

  it('prevents associating terminated sessions', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'Project A',
    });
    sessionService.getSessionById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      terminatedAt: new Date().toISOString(),
    });

    await expect(
      service.associateSessionWithProject({
        userId: 'user-1',
        projectId: 'project-1',
        sessionId: 'session-1',
      }),
    ).rejects.toThrow(GoneException);
  });

  it('opens project into session and reuses snapshot restore foundation', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'Project A',
    });
    sessionService.getSessionById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      terminatedAt: null,
      projectId: null,
    });
    sessionRepository.update.mockResolvedValue({ affected: 1 });
    snapshotPersistenceService.restoreSnapshot.mockResolvedValue({
      id: 'snapshot-1',
      userId: 'user-1',
      label: null,
      createdAt: '2026-04-04T00:00:00.000Z',
      fileCount: 1,
    });

    const result = await service.openProjectIntoSession({
      userId: 'user-1',
      projectId: 'project-1',
      sessionId: 'session-1',
      snapshotId: 'snapshot-1',
    });

    expect(snapshotPersistenceService.restoreSnapshot).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      snapshotId: 'snapshot-1',
    });
    expect(result.restoredSnapshotId).toBe('snapshot-1');
  });

  it('legacy sessions without project_id still work for association', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'Project A',
    });
    sessionService.getSessionById.mockResolvedValue({
      id: 'session-legacy',
      userId: 'user-1',
      terminatedAt: null,
    });
    sessionRepository.update.mockResolvedValue({ affected: 1 });

    const result = await service.associateSessionWithProject({
      userId: 'user-1',
      projectId: 'project-1',
      sessionId: 'session-legacy',
    });

    expect(result.sessionId).toBe('session-legacy');
  });
});
