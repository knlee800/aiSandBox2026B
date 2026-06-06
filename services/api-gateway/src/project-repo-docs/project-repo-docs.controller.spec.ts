import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { ProjectsService } from '../projects/projects.service';
import { UpsertProjectRepoDocsDto } from './dto/upsert-project-repo-docs.dto';
import { ProjectRepoDocsController } from './project-repo-docs.controller';
import { ProjectRepoDocsService } from './project-repo-docs.service';

describe('ProjectRepoDocsController (AI-CONTEXT-04A)', () => {
  let controller: ProjectRepoDocsController;
  let projectRepoDocsService: jest.Mocked<ProjectRepoDocsService>;
  let projectsService: jest.Mocked<ProjectsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectRepoDocsController],
      providers: [
        {
          provide: ProjectRepoDocsService,
          useValue: {
            listByProjectId: jest.fn(),
            replaceForProject: jest.fn(),
          },
        },
        {
          provide: ProjectsService,
          useValue: {
            getProjectByIdForUser: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SessionCookieGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProjectRepoDocsController>(ProjectRepoDocsController);
    projectRepoDocsService = module.get(ProjectRepoDocsService);
    projectsService = module.get(ProjectsService);
  });

  it('applies SessionCookieGuard at controller level', () => {
    const guards = Reflect.getMetadata('__guards__', ProjectRepoDocsController) || [];
    expect(guards).toContain(SessionCookieGuard);
  });

  it('GET enforces ownership and returns { docs } response shape', async () => {
    const ownedProject = {
      id: 'project-1',
      userId: 'user-1',
    } as Awaited<ReturnType<ProjectsService['getProjectByIdForUser']>>;
    projectsService.getProjectByIdForUser.mockResolvedValue(ownedProject);
    projectRepoDocsService.listByProjectId.mockResolvedValue([
      { path: 'README.md', mode: 'always' },
    ]);

    const result = await controller.getProjectRepoDocs('project-1', {
      user: { userId: 'user-1' },
    });

    expect(projectsService.getProjectByIdForUser).toHaveBeenCalledWith('user-1', 'project-1');
    expect(projectRepoDocsService.listByProjectId).toHaveBeenCalledWith('project-1');
    expect(result).toEqual({
      docs: [{ path: 'README.md', mode: 'always' }],
    });
  });

  it('PUT enforces ownership and returns { docs } response shape', async () => {
    const ownedProject = {
      id: 'project-1',
      userId: 'user-1',
    } as Awaited<ReturnType<ProjectsService['getProjectByIdForUser']>>;
    projectsService.getProjectByIdForUser.mockResolvedValue(ownedProject);
    projectRepoDocsService.replaceForProject.mockResolvedValue([
      { path: 'README.md', mode: 'always' },
    ]);

    const result = await controller.replaceProjectRepoDocs(
      'project-1',
      { user: { userId: 'user-1' } },
      { docs: [{ path: 'README.md' }] },
    );

    expect(projectsService.getProjectByIdForUser).toHaveBeenCalledWith('user-1', 'project-1');
    expect(projectRepoDocsService.replaceForProject).toHaveBeenCalledWith('project-1', [
      { path: 'README.md' },
    ]);
    expect(result).toEqual({
      docs: [{ path: 'README.md', mode: 'always' }],
    });
  });

  it('denies access for non-owner by surfacing project ownership check failure', async () => {
    projectsService.getProjectByIdForUser.mockRejectedValue(
      new NotFoundException('Project with ID project-foreign not found'),
    );

    await expect(
      controller.getProjectRepoDocs('project-foreign', {
        user: { userId: 'user-1' },
      }),
    ).rejects.toThrow(NotFoundException);

    expect(projectRepoDocsService.listByProjectId).not.toHaveBeenCalled();
  });

  it('DTO rejects mode values other than always', async () => {
    const dto = plainToInstance(UpsertProjectRepoDocsDto, {
      docs: [{ path: 'README.md', mode: 'sometimes' }],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('docs');
    expect(errors[0].children?.[0].children?.[0].constraints?.isIn).toBeDefined();
  });

  it('DTO rejects non-array docs shape', async () => {
    const dto = plainToInstance(UpsertProjectRepoDocsDto, {
      docs: { path: 'README.md' },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('docs');
    expect(errors[0].constraints?.isArray).toBeDefined();
  });
});
