import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { SessionCookieGuard } from '../auth/session-cookie.guard';

describe('WorkspacesController (WS-02)', () => {
  let controller: WorkspacesController;
  let workspacesService: jest.Mocked<WorkspacesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        {
          provide: WorkspacesService,
          useValue: {
            createWorkspace: jest.fn(),
            listWorkspaces: jest.fn(),
            getWorkspaceByIdForUser: jest.fn(),
            updateWorkspace: jest.fn(),
            deleteWorkspace: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SessionCookieGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WorkspacesController>(WorkspacesController);
    workspacesService = module.get(WorkspacesService);
  });

  it('applies SessionCookieGuard at controller level', () => {
    const guards = Reflect.getMetadata('__guards__', WorkspacesController) || [];
    expect(guards).toContain(SessionCookieGuard);
  });

  it('routes owner-scoped CRUD calls through the service', async () => {
    workspacesService.createWorkspace.mockResolvedValue({
      id: 'workspace-1',
      userId: 'user-1',
      name: 'Workspace A',
      slug: 'workspace-a',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    workspacesService.listWorkspaces.mockResolvedValue([
      {
        id: 'workspace-1',
        userId: 'user-1',
        name: 'Workspace A',
      } as any,
    ]);
    workspacesService.getWorkspaceByIdForUser.mockResolvedValue({
      id: 'workspace-1',
      userId: 'user-1',
      name: 'Workspace A',
    } as any);
    workspacesService.updateWorkspace.mockResolvedValue({
      id: 'workspace-1',
      userId: 'user-1',
      name: 'Workspace B',
    } as any);
    workspacesService.deleteWorkspace.mockResolvedValue({
      deleted: true,
    });

    const userReq = { user: { userId: 'user-1' } };
    const created = await controller.createWorkspace({ name: 'Workspace A' }, userReq);
    const listed = await controller.listWorkspaces(userReq);
    await controller.getWorkspace('workspace-1', userReq);
    await controller.updateWorkspace('workspace-1', { name: 'Workspace B' }, userReq);
    const deleted = await controller.deleteWorkspace('workspace-1', userReq);

    expect(created.id).toBe('workspace-1');
    expect(listed).toHaveLength(1);
    expect(deleted).toEqual({ deleted: true });
    expect(workspacesService.createWorkspace).toHaveBeenCalledWith('user-1', 'Workspace A');
    expect(workspacesService.listWorkspaces).toHaveBeenCalledWith('user-1');
    expect(workspacesService.getWorkspaceByIdForUser).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );
    expect(workspacesService.updateWorkspace).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
      'Workspace B',
    );
    expect(workspacesService.deleteWorkspace).toHaveBeenCalledWith('user-1', 'workspace-1');
  });
});
