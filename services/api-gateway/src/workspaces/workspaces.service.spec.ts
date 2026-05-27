import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity';
import { Workspace } from '../entities/workspace.entity';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService (WS-02)', () => {
  let service: WorkspacesService;
  let workspaceRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let projectRepository: {
    update: jest.Mock;
  };

  beforeEach(async () => {
    workspaceRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    projectRepository = {
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        {
          provide: getRepositoryToken(Workspace),
          useValue: workspaceRepository,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: projectRepository,
        },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  it('creates a named workspace for the current user with per-user slug uniqueness', async () => {
    workspaceRepository.findOne.mockResolvedValueOnce(null);
    workspaceRepository.create.mockReturnValue({
      id: 'workspace-1',
      userId: 'user-1',
      name: 'My Workspace',
      slug: 'my-workspace',
      isDefault: false,
    });
    workspaceRepository.save.mockResolvedValue({
      id: 'workspace-1',
      userId: 'user-1',
      name: 'My Workspace',
      slug: 'my-workspace',
      isDefault: false,
    });

    const result = await service.createWorkspace('user-1', '  My Workspace  ');

    expect(workspaceRepository.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', slug: 'my-workspace' },
    });
    expect(workspaceRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'My Workspace',
      slug: 'my-workspace',
      isDefault: false,
    });
    expect(result.id).toBe('workspace-1');
  });

  it('listWorkspaces creates a default Personal workspace when user has none', async () => {
    workspaceRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    workspaceRepository.create.mockReturnValue({
      id: 'workspace-default',
      userId: 'user-1',
      name: 'Personal',
      slug: 'personal',
      isDefault: true,
    });
    workspaceRepository.save.mockResolvedValue({
      id: 'workspace-default',
      userId: 'user-1',
      name: 'Personal',
      slug: 'personal',
      isDefault: true,
    });
    workspaceRepository.find.mockResolvedValue([
      {
        id: 'workspace-default',
        userId: 'user-1',
        name: 'Personal',
        slug: 'personal',
        isDefault: true,
      },
    ]);

    const result = await service.listWorkspaces('user-1');

    expect(workspaceRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { userId: 'user-1', isDefault: true },
    });
    expect(workspaceRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Personal',
      slug: 'personal',
      isDefault: true,
    });
    expect(workspaceRepository.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { createdAt: 'ASC' },
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 'workspace-default',
        userId: 'user-1',
        isDefault: true,
      }),
    ]);
  });

  it('listWorkspaces does not create duplicate default workspace when one already exists', async () => {
    workspaceRepository.findOne.mockResolvedValueOnce({
      id: 'workspace-default',
      userId: 'user-1',
      name: 'Personal',
      slug: 'personal',
      isDefault: true,
    });
    workspaceRepository.find.mockResolvedValue([
      {
        id: 'workspace-default',
        userId: 'user-1',
        name: 'Personal',
        slug: 'personal',
        isDefault: true,
      },
      {
        id: 'workspace-2',
        userId: 'user-1',
        name: 'Other',
        slug: 'other',
        isDefault: false,
      },
    ]);

    const result = await service.listWorkspaces('user-1');

    expect(workspaceRepository.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', isDefault: true },
    });
    expect(workspaceRepository.create).not.toHaveBeenCalled();
    expect(workspaceRepository.save).not.toHaveBeenCalled();
    expect(workspaceRepository.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { createdAt: 'ASC' },
    });
    expect(result).toHaveLength(2);
  });

  it('get/update enforce workspace ownership', async () => {
    workspaceRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.getWorkspaceByIdForUser('user-1', 'workspace-missing')).rejects.toThrow(
      NotFoundException,
    );

    workspaceRepository.findOne.mockResolvedValueOnce({
      id: 'workspace-1',
      userId: 'user-1',
      name: 'Old Name',
      slug: 'old-name',
      isDefault: false,
    });
    workspaceRepository.findOne.mockResolvedValueOnce({
      id: 'workspace-1',
      userId: 'user-1',
      name: 'Old Name',
      slug: 'old-name',
      isDefault: false,
    });
    workspaceRepository.findOne.mockResolvedValueOnce({
      id: 'workspace-1',
      userId: 'user-1',
      name: 'Old Name',
      slug: 'new-name',
      isDefault: false,
    });
    workspaceRepository.save.mockResolvedValueOnce({
      id: 'workspace-1',
      userId: 'user-1',
      name: 'New Name',
      slug: 'new-name',
      isDefault: false,
    });

    const updated = await service.updateWorkspace('user-1', 'workspace-1', ' New Name ');
    expect(updated.name).toBe('New Name');
    expect(updated.slug).toBe('new-name');
  });

  it('rejects update when name is missing', async () => {
    await expect(service.updateWorkspace('user-1', 'workspace-1', undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deletes non-default workspace after reassigning projects to default workspace', async () => {
    workspaceRepository.findOne
      .mockResolvedValueOnce({
        id: 'workspace-2',
        userId: 'user-1',
        name: 'Extra',
        slug: 'extra',
        isDefault: false,
      })
      .mockResolvedValueOnce({
        id: 'workspace-1',
        userId: 'user-1',
        name: 'Personal',
        slug: 'personal',
        isDefault: true,
      });
    projectRepository.update.mockResolvedValue({ affected: 2 });
    workspaceRepository.delete.mockResolvedValue({ affected: 1 });

    const result = await service.deleteWorkspace('user-1', 'workspace-2');

    expect(projectRepository.update).toHaveBeenCalledWith(
      { workspaceId: 'workspace-2' },
      { workspaceId: 'workspace-1' },
    );
    expect(workspaceRepository.delete).toHaveBeenCalledWith({
      id: 'workspace-2',
      userId: 'user-1',
    });
    expect(result).toEqual({ deleted: true });
  });

  it('prevents deleting the default workspace', async () => {
    workspaceRepository.findOne.mockResolvedValue({
      id: 'workspace-1',
      userId: 'user-1',
      name: 'Personal',
      slug: 'personal',
      isDefault: true,
    });

    await expect(service.deleteWorkspace('user-1', 'workspace-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(projectRepository.update).not.toHaveBeenCalled();
    expect(workspaceRepository.delete).not.toHaveBeenCalled();
  });

  it('fails clearly if the default workspace is unexpectedly missing during delete', async () => {
    workspaceRepository.findOne
      .mockResolvedValueOnce({
        id: 'workspace-2',
        userId: 'user-1',
        name: 'Extra',
        slug: 'extra',
        isDefault: false,
      })
      .mockResolvedValueOnce(null);

    await expect(service.deleteWorkspace('user-1', 'workspace-2')).rejects.toThrow(
      NotFoundException,
    );
    expect(projectRepository.update).not.toHaveBeenCalled();
    expect(workspaceRepository.delete).not.toHaveBeenCalled();
  });
});
