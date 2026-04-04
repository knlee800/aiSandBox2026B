import { NotFoundException } from '@nestjs/common';
import { PublicProjectsController } from './public-projects.controller';

describe('PublicProjectsController (ADV-05-01)', () => {
  const projectsService = {
    listPublicProjects: jest.fn(),
    getPublicProjectById: jest.fn(),
    forkPublicProject: jest.fn(),
  };

  const controller = new PublicProjectsController(projectsService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns bounded public project list payload', async () => {
    projectsService.listPublicProjects.mockResolvedValue([
      {
        id: 'project-1',
        name: 'Shared Project',
        visibility: 'public',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        userId: 'owner-1',
      },
    ]);

    const result = await controller.listPublicProjects();
    expect(result[0]).toEqual({
      id: 'project-1',
      name: 'Shared Project',
      visibility: 'public',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    expect((result[0] as any).userId).toBeUndefined();
  });

  it('returns read-only public detail payload', async () => {
    projectsService.getPublicProjectById.mockResolvedValue({
      id: 'project-1',
      name: 'Shared Project',
      visibility: 'public',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const result = await controller.getPublicProject('project-1');
    expect(result.readOnly).toBe(true);
    expect(result.visibility).toBe('public');
  });

  it('propagates non-public/missing project protection from service', async () => {
    projectsService.getPublicProjectById.mockRejectedValue(
      new NotFoundException('Public project with ID project-private not found'),
    );

    await expect(controller.getPublicProject('project-private')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('forks public project into requester-owned private project', async () => {
    projectsService.forkPublicProject.mockResolvedValue({
      id: 'fork-1',
      name: 'Fork of Shared Project',
      visibility: 'private',
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    });

    const result = await controller.forkPublicProject('project-1', {
      user: { userId: 'user-2' },
    });
    expect(projectsService.forkPublicProject).toHaveBeenCalledWith({
      userId: 'user-2',
      projectId: 'project-1',
    });
    expect(result.visibility).toBe('private');
  });
});
