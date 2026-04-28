import { GoneException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { Session } from '../entities/session.entity';
import { SessionService } from '../sessions/session.service';
import { SnapshotPersistenceService } from '../snapshots/snapshot-persistence.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
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
    listSnapshots: jest.Mock;
  };
  let workspacesService: {
    getWorkspaceByIdForUser: jest.Mock;
    listWorkspaces: jest.Mock;
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
      listSnapshots: jest.fn(),
    };
    workspacesService = {
      getWorkspaceByIdForUser: jest.fn(),
      listWorkspaces: jest.fn(),
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
        {
          provide: WorkspacesService,
          useValue: workspacesService,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('creates a named project for the current user with an explicit owned workspace', async () => {
    projectRepository.findOne.mockResolvedValue(null);
    workspacesService.getWorkspaceByIdForUser.mockResolvedValue({
      id: 'workspace-1',
      userId: 'user-1',
      name: 'Workspace A',
      isDefault: false,
    });
    projectRepository.create.mockReturnValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'My Project',
      slug: 'my-project',
      visibility: 'private',
      workspaceId: 'workspace-1',
    });
    projectRepository.save.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'My Project',
      slug: 'my-project',
      visibility: 'private',
      workspaceId: 'workspace-1',
    });

    const result = await service.createProject('user-1', '  My Project  ', 'workspace-1');

    expect(workspacesService.getWorkspaceByIdForUser).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );
    expect(workspacesService.listWorkspaces).not.toHaveBeenCalled();
    expect(projectRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'My Project',
      slug: 'my-project',
      visibility: 'private',
      workspaceId: 'workspace-1',
    });
    expect(result.id).toBe('project-1');
  });

  it('creates a named project in the default workspace when workspaceId is omitted', async () => {
    projectRepository.findOne.mockResolvedValue(null);
    workspacesService.listWorkspaces.mockResolvedValue([
      {
        id: 'workspace-default',
        userId: 'user-1',
        name: 'Personal',
        isDefault: true,
      },
      {
        id: 'workspace-other',
        userId: 'user-1',
        name: 'Other',
        isDefault: false,
      },
    ]);
    projectRepository.create.mockReturnValue({
      id: 'project-2',
      userId: 'user-1',
      name: 'Default Project',
      slug: 'default-project',
      visibility: 'private',
      workspaceId: 'workspace-default',
    });
    projectRepository.save.mockResolvedValue({
      id: 'project-2',
      userId: 'user-1',
      name: 'Default Project',
      slug: 'default-project',
      visibility: 'private',
      workspaceId: 'workspace-default',
    });

    const result = await service.createProject('user-1', ' Default Project ');

    expect(workspacesService.listWorkspaces).toHaveBeenCalledWith('user-1');
    expect(workspacesService.getWorkspaceByIdForUser).not.toHaveBeenCalled();
    expect(projectRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Default Project',
      slug: 'default-project',
      visibility: 'private',
      workspaceId: 'workspace-default',
    });
    expect(result.workspaceId).toBe('workspace-default');
  });

  it('rejects a cross-user workspaceId during project creation', async () => {
    projectRepository.findOne.mockResolvedValue(null);
    workspacesService.getWorkspaceByIdForUser.mockRejectedValue(
      new NotFoundException('Workspace with ID workspace-foreign not found'),
    );

    await expect(
      service.createProject('user-1', ' Project A ', 'workspace-foreign'),
    ).rejects.toThrow(NotFoundException);
    expect(projectRepository.create).not.toHaveBeenCalled();
  });

  it('fails clearly if the default workspace is unexpectedly missing during create', async () => {
    projectRepository.findOne.mockResolvedValue(null);
    workspacesService.listWorkspaces.mockResolvedValue([
      {
        id: 'workspace-other',
        userId: 'user-1',
        name: 'Other',
        isDefault: false,
      },
    ]);

    await expect(service.createProject('user-1', ' Project A ')).rejects.toThrow(
      NotFoundException,
    );
    expect(projectRepository.create).not.toHaveBeenCalled();
  });

  it('lists only current user projects and supports optional workspace filtering', async () => {
    projectRepository.find.mockResolvedValue([{ id: 'project-1', userId: 'user-1' }]);

    const result = await service.listProjects('user-1');

    expect(projectRepository.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { updatedAt: 'DESC' },
    });
    expect(result).toHaveLength(1);

    await service.listProjects('user-1', 'workspace-1');
    expect(projectRepository.find).toHaveBeenLastCalledWith({
      where: { userId: 'user-1', workspaceId: 'workspace-1' },
      order: { updatedAt: 'DESC' },
    });
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
    snapshotPersistenceService.listSnapshots.mockResolvedValue([
      {
        id: 'snapshot-latest',
        userId: 'user-1',
        label: null,
        createdAt: '2026-04-05T00:00:00.000Z',
        fileCount: 1,
      },
    ]);

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
    expect(snapshotPersistenceService.listSnapshots).not.toHaveBeenCalled();
  });

  it('opens project into session and restores latest snapshot by default when snapshotId is omitted', async () => {
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
    snapshotPersistenceService.listSnapshots.mockResolvedValue([
      {
        id: 'snapshot-latest',
        userId: 'user-1',
        label: null,
        createdAt: '2026-04-06T00:00:00.000Z',
        fileCount: 1,
      },
      {
        id: 'snapshot-older',
        userId: 'user-1',
        label: null,
        createdAt: '2026-04-05T00:00:00.000Z',
        fileCount: 1,
      },
    ]);
    snapshotPersistenceService.restoreSnapshot.mockResolvedValue({
      id: 'snapshot-latest',
      userId: 'user-1',
      label: null,
      createdAt: '2026-04-06T00:00:00.000Z',
      fileCount: 1,
    });

    const result = await service.openProjectIntoSession({
      userId: 'user-1',
      projectId: 'project-1',
      sessionId: 'session-1',
    });

    expect(snapshotPersistenceService.listSnapshots).toHaveBeenCalledWith('user-1');
    expect(snapshotPersistenceService.restoreSnapshot).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      snapshotId: 'snapshot-latest',
    });
    expect(result).toEqual({
      projectId: 'project-1',
      sessionId: 'session-1',
      restoredSnapshotId: 'snapshot-latest',
    });
    expect(sessionRepository.update).toHaveBeenCalledWith(
      { id: 'session-1' },
      { projectId: 'project-1' },
    );
  });

  it('opens project into session safely when no snapshots exist and snapshotId is omitted', async () => {
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
    snapshotPersistenceService.listSnapshots.mockResolvedValue([]);

    const result = await service.openProjectIntoSession({
      userId: 'user-1',
      projectId: 'project-1',
      sessionId: 'session-1',
    });

    expect(snapshotPersistenceService.listSnapshots).toHaveBeenCalledWith('user-1');
    expect(snapshotPersistenceService.restoreSnapshot).not.toHaveBeenCalled();
    expect(result).toEqual({
      projectId: 'project-1',
      sessionId: 'session-1',
      restoredSnapshotId: null,
    });
    expect(sessionRepository.update).toHaveBeenCalledWith(
      { id: 'session-1' },
      { projectId: 'project-1' },
    );
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

  it('updates project visibility for owner and keeps default private behavior', async () => {
    projectRepository.findOne.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'Project A',
      visibility: 'private',
    });
    projectRepository.save.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'Project A',
      visibility: 'public',
    });

    const updated = await service.updateProjectVisibility(
      'user-1',
      'project-1',
      'public',
    );
    expect(updated.visibility).toBe('public');
  });

  it('lists only public projects for public surface', async () => {
    projectRepository.find.mockResolvedValue([
      { id: 'project-public-1', visibility: 'public' } as any,
    ]);

    const projects = await service.listPublicProjects();
    expect(projectRepository.find).toHaveBeenCalledWith({
      where: { visibility: 'public' },
      order: { updatedAt: 'DESC' },
    });
    expect(projects).toHaveLength(1);
  });

  it('forks public project into independent private project for requester', async () => {
    projectRepository.findOne.mockResolvedValueOnce({
      id: 'project-public-1',
      userId: 'owner-1',
      name: 'Shared Project',
      visibility: 'public',
    });
    projectRepository.findOne.mockResolvedValueOnce(null);
    projectRepository.create.mockReturnValue({
      id: 'fork-1',
      userId: 'user-2',
      name: 'Fork of Shared Project',
      slug: 'fork-of-shared-project',
      visibility: 'private',
    });
    projectRepository.save.mockResolvedValue({
      id: 'fork-1',
      userId: 'user-2',
      name: 'Fork of Shared Project',
      slug: 'fork-of-shared-project',
      visibility: 'private',
    });

    const forked = await service.forkPublicProject({
      userId: 'user-2',
      projectId: 'project-public-1',
    });

    expect(projectRepository.create).toHaveBeenCalledWith({
      userId: 'user-2',
      name: 'Fork of Shared Project',
      slug: 'fork-of-shared-project',
      visibility: 'private',
    });
    expect(forked.userId).toBe('user-2');
    expect(forked.visibility).toBe('private');
  });
});
