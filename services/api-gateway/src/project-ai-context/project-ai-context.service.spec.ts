import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectAiContext } from '../entities/project-ai-context.entity';
import { ProjectAiContextService } from './project-ai-context.service';

describe('ProjectAiContextService (AI-CONTEXT-02A)', () => {
  let service: ProjectAiContextService;
  let projectAiContextRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    projectAiContextRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectAiContextService,
        {
          provide: getRepositoryToken(ProjectAiContext),
          useValue: projectAiContextRepository,
        },
      ],
    }).compile();

    service = module.get<ProjectAiContextService>(ProjectAiContextService);
  });

  it('getByProjectId returns null when no record exists', async () => {
    projectAiContextRepository.findOne.mockResolvedValue(null);

    const result = await service.getByProjectId('project-1');

    expect(projectAiContextRepository.findOne).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
    });
    expect(result).toBeNull();
  });

  it('upsert creates a new row when no record exists', async () => {
    projectAiContextRepository.findOne.mockResolvedValue(null);
    projectAiContextRepository.create.mockReturnValue({
      projectId: 'project-1',
      projectInstructions: 'Use workspace conventions',
    });
    projectAiContextRepository.save.mockResolvedValue({
      id: 'project-context-1',
      projectId: 'project-1',
      projectInstructions: 'Use workspace conventions',
    });

    const result = await service.upsert('project-1', 'Use workspace conventions');

    expect(projectAiContextRepository.create).toHaveBeenCalledWith({
      projectId: 'project-1',
      projectInstructions: 'Use workspace conventions',
    });
    expect(projectAiContextRepository.save).toHaveBeenCalledWith({
      projectId: 'project-1',
      projectInstructions: 'Use workspace conventions',
    });
    expect(result).toBe('Use workspace conventions');
  });

  it('upsert updates existing row when record already exists', async () => {
    const existing = {
      id: 'project-context-1',
      projectId: 'project-1',
      projectInstructions: 'Old value',
    };
    projectAiContextRepository.findOne.mockResolvedValue(existing);
    projectAiContextRepository.save.mockResolvedValue({
      ...existing,
      projectInstructions: 'Updated value',
    });

    const result = await service.upsert('project-1', 'Updated value');

    expect(projectAiContextRepository.create).not.toHaveBeenCalled();
    expect(projectAiContextRepository.save).toHaveBeenCalledWith({
      id: 'project-context-1',
      projectId: 'project-1',
      projectInstructions: 'Updated value',
    });
    expect(result).toBe('Updated value');
  });
});
