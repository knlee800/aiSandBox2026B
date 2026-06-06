import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectRepoDoc } from '../entities/project-repo-doc.entity';
import { ProjectRepoDocsService } from './project-repo-docs.service';

describe('ProjectRepoDocsService (AI-CONTEXT-04A)', () => {
  let service: ProjectRepoDocsService;
  let projectRepoDocRepository: {
    find: jest.Mock;
    manager: {
      transaction: jest.Mock;
    };
  };
  let transactionManager: {
    delete: jest.Mock;
    insert: jest.Mock;
  };

  beforeEach(async () => {
    transactionManager = {
      delete: jest.fn(),
      insert: jest.fn(),
    };

    projectRepoDocRepository = {
      find: jest.fn(),
      manager: {
        transaction: jest.fn().mockImplementation(async (callback) => callback(transactionManager)),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectRepoDocsService,
        {
          provide: getRepositoryToken(ProjectRepoDoc),
          useValue: projectRepoDocRepository,
        },
      ],
    }).compile();

    service = module.get<ProjectRepoDocsService>(ProjectRepoDocsService);
  });

  it('listByProjectId returns empty docs when no records exist', async () => {
    projectRepoDocRepository.find.mockResolvedValue([]);

    const result = await service.listByProjectId('project-1');

    expect(projectRepoDocRepository.find).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      order: { path: 'ASC' },
    });
    expect(result).toEqual([]);
  });

  it('replaceForProject creates normalized docs with mode defaulting to always', async () => {
    const result = await service.replaceForProject('project-1', [
      { path: 'README.md' },
      { path: 'docs/ARCHITECTURE.md', mode: 'always' },
    ]);

    expect(projectRepoDocRepository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(transactionManager.delete).toHaveBeenCalledWith(ProjectRepoDoc, {
      projectId: 'project-1',
    });
    expect(transactionManager.insert).toHaveBeenCalledWith(ProjectRepoDoc, [
      { projectId: 'project-1', path: 'docs/ARCHITECTURE.md', mode: 'always' },
      { projectId: 'project-1', path: 'README.md', mode: 'always' },
    ]);
    expect(result).toEqual([
      { path: 'docs/ARCHITECTURE.md', mode: 'always' },
      { path: 'README.md', mode: 'always' },
    ]);
  });

  it('replaceForProject updates docs by replacing prior rows atomically', async () => {
    await service.replaceForProject('project-1', [{ path: 'README.md' }]);
    const result = await service.replaceForProject('project-1', [{ path: 'docs/SETUP.md' }]);

    expect(transactionManager.delete).toHaveBeenCalledTimes(2);
    expect(transactionManager.insert).toHaveBeenNthCalledWith(1, ProjectRepoDoc, [
      { projectId: 'project-1', path: 'README.md', mode: 'always' },
    ]);
    expect(transactionManager.insert).toHaveBeenNthCalledWith(2, ProjectRepoDoc, [
      { projectId: 'project-1', path: 'docs/SETUP.md', mode: 'always' },
    ]);
    expect(result).toEqual([{ path: 'docs/SETUP.md', mode: 'always' }]);
  });

  it('replaceForProject deduplicates duplicate paths after trimming', async () => {
    const result = await service.replaceForProject('project-1', [
      { path: ' README.md ' },
      { path: 'README.md', mode: 'always' },
    ]);

    expect(transactionManager.insert).toHaveBeenCalledWith(ProjectRepoDoc, [
      { projectId: 'project-1', path: 'README.md', mode: 'always' },
    ]);
    expect(result).toEqual([{ path: 'README.md', mode: 'always' }]);
  });

  it.each([
    '../secret.md',
    '/absolute.md',
    'C:\\secret.md',
    'docs\\windows.md',
    '   ',
  ])('replaceForProject rejects invalid path: %s', async (invalidPath) => {
    await expect(
      service.replaceForProject('project-1', [{ path: invalidPath as string }]),
    ).rejects.toThrow(BadRequestException);

    expect(projectRepoDocRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it('replaceForProject rejects mode values other than always', async () => {
    await expect(
      service.replaceForProject('project-1', [{ path: 'README.md', mode: 'sometimes' as 'always' }]),
    ).rejects.toThrow(BadRequestException);

    expect(projectRepoDocRepository.manager.transaction).not.toHaveBeenCalled();
  });
});
