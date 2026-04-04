import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

describe('ProjectsController (PR-03-01)', () => {
  let controller: ProjectsController;
  let projectsService: jest.Mocked<ProjectsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        {
          provide: ProjectsService,
          useValue: {
            createProject: jest.fn(),
            listProjects: jest.fn(),
            getProjectByIdForUser: jest.fn(),
            renameProject: jest.fn(),
            associateSessionWithProject: jest.fn(),
            openProjectIntoSession: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
    projectsService = module.get(ProjectsService);
  });

  it('applies JwtAuthGuard at controller level', () => {
    const guards = Reflect.getMetadata('__guards__', ProjectsController) || [];
    expect(guards).toContain(JwtAuthGuard);
  });

  it('creates and lists user projects through service', async () => {
    projectsService.createProject.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'My Project',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    projectsService.listProjects.mockResolvedValue([
      {
        id: 'project-1',
        userId: 'user-1',
        name: 'My Project',
      } as any,
    ]);

    const created = await controller.createProject(
      { name: 'My Project' },
      { user: { userId: 'user-1' } },
    );
    const listed = await controller.listProjects({ user: { userId: 'user-1' } });

    expect(created.id).toBe('project-1');
    expect(listed).toHaveLength(1);
  });

  it('gets, renames, associates, and opens project with ownership-scoped user id', async () => {
    projectsService.getProjectByIdForUser.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'Project A',
    } as any);
    projectsService.renameProject.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'Project B',
    } as any);
    projectsService.associateSessionWithProject.mockResolvedValue({
      projectId: 'project-1',
      sessionId: 'session-1',
    });
    projectsService.openProjectIntoSession.mockResolvedValue({
      projectId: 'project-1',
      sessionId: 'session-1',
      restoredSnapshotId: 'snapshot-1',
    });

    const userReq = { user: { userId: 'user-1' } };
    await controller.getProject('project-1', userReq);
    await controller.renameProject('project-1', { name: 'Project B' }, userReq);
    await controller.associateSessionWithProject('project-1', 'session-1', userReq);
    await controller.openProjectIntoSession(
      'project-1',
      { sessionId: 'session-1', snapshotId: 'snapshot-1' },
      userReq,
    );

    expect(projectsService.getProjectByIdForUser).toHaveBeenCalledWith('user-1', 'project-1');
    expect(projectsService.renameProject).toHaveBeenCalledWith(
      'user-1',
      'project-1',
      'Project B',
    );
    expect(projectsService.associateSessionWithProject).toHaveBeenCalledWith({
      userId: 'user-1',
      projectId: 'project-1',
      sessionId: 'session-1',
    });
    expect(projectsService.openProjectIntoSession).toHaveBeenCalledWith({
      userId: 'user-1',
      projectId: 'project-1',
      sessionId: 'session-1',
      snapshotId: 'snapshot-1',
    });
  });
});
