import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { ProjectsService } from '../projects/projects.service';
import { UpsertProjectAiContextDto } from './dto/upsert-project-ai-context.dto';
import { ProjectAiContextController } from './project-ai-context.controller';
import { ProjectAiContextService } from './project-ai-context.service';

describe('ProjectAiContextController (AI-CONTEXT-02A)', () => {
  let controller: ProjectAiContextController;
  let projectAiContextService: jest.Mocked<ProjectAiContextService>;
  let projectsService: jest.Mocked<ProjectsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectAiContextController],
      providers: [
        {
          provide: ProjectAiContextService,
          useValue: {
            getByProjectId: jest.fn(),
            upsert: jest.fn(),
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

    controller = module.get<ProjectAiContextController>(ProjectAiContextController);
    projectAiContextService = module.get(ProjectAiContextService);
    projectsService = module.get(ProjectsService);
  });

  it('applies SessionCookieGuard at controller level', () => {
    const guards = Reflect.getMetadata('__guards__', ProjectAiContextController) || [];
    expect(guards).toContain(SessionCookieGuard);
  });

  it('GET enforces ownership and maps response shape to { projectInstructions }', async () => {
    const ownedProject = {
      id: 'project-1',
      userId: 'user-1',
    } as Awaited<ReturnType<ProjectsService['getProjectByIdForUser']>>;
    projectsService.getProjectByIdForUser.mockResolvedValue(ownedProject);
    projectAiContextService.getByProjectId.mockResolvedValue('Use project conventions');

    const result = await controller.getProjectAiContext('project-1', {
      user: { userId: 'user-1' },
    });

    expect(projectsService.getProjectByIdForUser).toHaveBeenCalledWith('user-1', 'project-1');
    expect(projectAiContextService.getByProjectId).toHaveBeenCalledWith('project-1');
    expect(result).toEqual({ projectInstructions: 'Use project conventions' });
  });

  it('PUT enforces ownership and maps response shape to { projectInstructions }', async () => {
    const ownedProject = {
      id: 'project-1',
      userId: 'user-1',
    } as Awaited<ReturnType<ProjectsService['getProjectByIdForUser']>>;
    projectsService.getProjectByIdForUser.mockResolvedValue(ownedProject);
    projectAiContextService.upsert.mockResolvedValue('Updated project instructions');

    const result = await controller.upsertProjectAiContext(
      'project-1',
      { user: { userId: 'user-1' } },
      { projectInstructions: 'Updated project instructions' },
    );

    expect(projectsService.getProjectByIdForUser).toHaveBeenCalledWith('user-1', 'project-1');
    expect(projectAiContextService.upsert).toHaveBeenCalledWith(
      'project-1',
      'Updated project instructions',
    );
    expect(result).toEqual({ projectInstructions: 'Updated project instructions' });
  });

  it('denies access for non-owner by surfacing project ownership check failure', async () => {
    projectsService.getProjectByIdForUser.mockRejectedValue(
      new NotFoundException('Project with ID project-foreign not found'),
    );

    await expect(
      controller.getProjectAiContext('project-foreign', {
        user: { userId: 'user-1' },
      }),
    ).rejects.toThrow(NotFoundException);
    expect(projectAiContextService.getByProjectId).not.toHaveBeenCalled();
  });

  it('DTO rejects projectInstructions over 4000 chars', async () => {
    const dto = new UpsertProjectAiContextDto();
    dto.projectInstructions = 'x'.repeat(4001);

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('projectInstructions');
    expect(errors[0].constraints?.maxLength).toBeDefined();
  });
});
