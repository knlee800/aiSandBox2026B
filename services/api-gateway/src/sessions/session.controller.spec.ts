import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, GoneException, BadRequestException } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionQuotaGuard } from '../quota/session-quota.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { SnapshotPersistenceService } from '../snapshots/snapshot-persistence.service';
import { WorkspaceArchiveService } from '../snapshots/workspace-archive.service';

describe('SessionController (TASK-68B-2 query extension)', () => {
  let controller: SessionController;
  let sessionService: jest.Mocked<SessionService>;
  let containerManagerClient: jest.Mocked<ContainerManagerHttpClient>;

  beforeEach(async () => {
    const mockSessionService = {
      createSession: jest.fn(),
      getSessionsByUser: jest.fn(),
      getSessionById: jest.fn(),
      stopSession: jest.fn(),
      deleteSession: jest.fn(),
      terminateSession: jest.fn(),
    };

    const mockContainerManagerHttpClient = {
      startSession: jest.fn(),
      stopSession: jest.fn(),
      deleteSession: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: ContainerManagerHttpClient,
          useValue: mockContainerManagerHttpClient,
        },
        {
          provide: SnapshotPersistenceService,
          useValue: {
            saveSnapshot: jest.fn(),
            restoreSnapshot: jest.fn(),
            listSnapshots: jest.fn(),
          },
        },
        {
          provide: WorkspaceArchiveService,
          useValue: {
            exportWorkspaceArchive: jest.fn(),
            importWorkspaceArchive: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SessionQuotaGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SessionController>(SessionController);
    sessionService = module.get(SessionService);
    containerManagerClient = module.get(ContainerManagerHttpClient);
  });

  it('applies JwtAuthGuard at controller level', () => {
    const guards = Reflect.getMetadata('__guards__', SessionController) || [];
    expect(guards).toContain(JwtAuthGuard);
  });

  it('GET /api/sessions defaults includeTerminated=false', async () => {
    sessionService.getSessionsByUser.mockResolvedValue([]);

    await controller.listSessions({ user: { userId: 'user-1' } }, undefined);

    expect(sessionService.getSessionsByUser).toHaveBeenCalledWith(
      'user-1',
      false,
    );
  });

  it('GET /api/sessions?includeTerminated=true includes terminated sessions', async () => {
    sessionService.getSessionsByUser.mockResolvedValue([]);

    await controller.listSessions({ user: { userId: 'user-1' } }, 'true');

    expect(sessionService.getSessionsByUser).toHaveBeenCalledWith(
      'user-1',
      true,
    );
  });

  it('GET /api/sessions ignores non-true includeTerminated values', async () => {
    sessionService.getSessionsByUser.mockResolvedValue([]);

    await controller.listSessions({ user: { userId: 'user-1' } }, '1');

    expect(sessionService.getSessionsByUser).toHaveBeenCalledWith(
      'user-1',
      false,
    );
  });
});

/**
 * PHASE-76F: ISSUE-76-002 regression tests
 * DELETE /api/sessions/:id must terminate (not physically delete) the session.
 */
describe('SessionController (PHASE-76F: ISSUE-76-002 DELETE termination fix)', () => {
  let controller: SessionController;
  let sessionService: jest.Mocked<SessionService>;
  let containerManagerClient: jest.Mocked<ContainerManagerHttpClient>;

  const mockActiveSession = {
    id: 'session-1',
    userId: 'user-1',
    status: 'pending' as any,
    containerId: null,
    createdAt: new Date(),
    expiresAt: new Date(),
    lastActivityAt: new Date(),
    user: {} as any,
    terminatedAt: null,
    terminationReason: null,
    project: null,
    projectId: null,
  };

  const mockTerminatedSession = {
    ...mockActiveSession,
    terminatedAt: new Date('2026-03-12T00:00:00Z'),
    terminationReason: 'manual',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        {
          provide: SessionService,
          useValue: {
            createSession: jest.fn(),
            getSessionsByUser: jest.fn(),
            getSessionById: jest.fn(),
            stopSession: jest.fn(),
            deleteSession: jest.fn(),
            terminateSession: jest.fn(),
          },
        },
        {
          provide: ContainerManagerHttpClient,
          useValue: {
            startSession: jest.fn(),
            stopSession: jest.fn(),
            deleteSession: jest.fn(),
          },
        },
        {
          provide: SnapshotPersistenceService,
          useValue: {
            saveSnapshot: jest.fn(),
            restoreSnapshot: jest.fn(),
            listSnapshots: jest.fn(),
          },
        },
        {
          provide: WorkspaceArchiveService,
          useValue: {
            exportWorkspaceArchive: jest.fn(),
            importWorkspaceArchive: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SessionQuotaGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SessionController>(SessionController);
    sessionService = module.get(SessionService);
    containerManagerClient = module.get(ContainerManagerHttpClient);
  });

  it('DELETE /api/sessions/:id terminates an active session and returns 200', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);
    containerManagerClient.stopSession.mockResolvedValue(undefined);
    sessionService.terminateSession.mockResolvedValue(undefined);

    const result = await controller.deleteSession('session-1', {
      user: { userId: 'user-1' },
    });

    expect(result).toEqual({ message: 'Session terminated successfully' });
    expect(sessionService.terminateSession).toHaveBeenCalledWith('session-1', 'manual');
    expect(containerManagerClient.stopSession).toHaveBeenCalledWith('session-1');
  });

  it('DELETE does not call containerManagerHttpClient.deleteSession (no physical deletion)', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);
    containerManagerClient.stopSession.mockResolvedValue(undefined);
    sessionService.terminateSession.mockResolvedValue(undefined);

    await controller.deleteSession('session-1', {
      user: { userId: 'user-1' },
    });

    expect(containerManagerClient.deleteSession).not.toHaveBeenCalled();
  });

  it('DELETE succeeds even when container stop fails (best-effort)', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);
    containerManagerClient.stopSession.mockRejectedValue(
      new Error('Container stop failed'),
    );
    sessionService.terminateSession.mockResolvedValue(undefined);

    const result = await controller.deleteSession('session-1', {
      user: { userId: 'user-1' },
    });

    expect(result).toEqual({ message: 'Session terminated successfully' });
    expect(sessionService.terminateSession).toHaveBeenCalledWith('session-1', 'manual');
  });

  it('DELETE on already-terminated session returns 200 (idempotent)', async () => {
    sessionService.getSessionById.mockResolvedValue(mockTerminatedSession);

    const result = await controller.deleteSession('session-1', {
      user: { userId: 'user-1' },
    });

    expect(result).toEqual({ message: 'Session already terminated' });
    expect(sessionService.terminateSession).not.toHaveBeenCalled();
    expect(containerManagerClient.stopSession).not.toHaveBeenCalled();
  });

  it('DELETE returns 404 for non-owned session', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);

    await expect(
      controller.deleteSession('session-1', {
        user: { userId: 'other-user' },
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('DELETE calls sessionService.terminateSession not deleteSession', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);
    containerManagerClient.stopSession.mockResolvedValue(undefined);
    sessionService.terminateSession.mockResolvedValue(undefined);

    await controller.deleteSession('session-1', {
      user: { userId: 'user-1' },
    });

    expect(sessionService.terminateSession).toHaveBeenCalledTimes(1);
    expect(sessionService.deleteSession).not.toHaveBeenCalled();
  });
});

describe('SessionController file delete route', () => {
  let controller: SessionController;
  let sessionService: jest.Mocked<SessionService>;
  let containerManagerClient: jest.Mocked<ContainerManagerHttpClient>;

  const mockActiveSession = {
    id: 'session-1',
    userId: 'user-1',
    status: 'active' as any,
    containerId: 'container-abc',
    createdAt: new Date(),
    expiresAt: new Date(),
    lastActivityAt: new Date(),
    user: {} as any,
    terminatedAt: null,
    terminationReason: null,
    project: null,
    projectId: null,
  };

  const mockTerminatedSession = {
    ...mockActiveSession,
    terminatedAt: new Date('2026-03-12T00:00:00Z'),
    terminationReason: 'manual',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        {
          provide: SessionService,
          useValue: {
            createSession: jest.fn(),
            getSessionsByUser: jest.fn(),
            getSessionById: jest.fn(),
            stopSession: jest.fn(),
            deleteSession: jest.fn(),
            terminateSession: jest.fn(),
          },
        },
        {
          provide: ContainerManagerHttpClient,
          useValue: {
            startSession: jest.fn(),
            stopSession: jest.fn(),
            deleteSession: jest.fn(),
            deleteSessionFile: jest.fn(),
          },
        },
        {
          provide: SnapshotPersistenceService,
          useValue: {
            saveSnapshot: jest.fn(),
            restoreSnapshot: jest.fn(),
            listSnapshots: jest.fn(),
          },
        },
        {
          provide: WorkspaceArchiveService,
          useValue: {
            exportWorkspaceArchive: jest.fn(),
            importWorkspaceArchive: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SessionQuotaGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SessionController>(SessionController);
    sessionService = module.get(SessionService);
    containerManagerClient = module.get(ContainerManagerHttpClient);
  });

  it('DELETE /api/sessions/:id/files/delete delegates for active owned session', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);
    containerManagerClient.deleteSessionFile.mockResolvedValue(undefined);

    await controller.deleteSessionFile('session-1', 'src/old.ts', {
      user: { userId: 'user-1' },
    });

    expect(containerManagerClient.deleteSessionFile).toHaveBeenCalledWith(
      'session-1',
      'src/old.ts',
    );
  });

  it('DELETE /api/sessions/:id/files/delete returns 404 for non-owned session', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);

    await expect(
      controller.deleteSessionFile('session-1', 'src/old.ts', {
        user: { userId: 'other-user' },
      }),
    ).rejects.toThrow(NotFoundException);

    expect(containerManagerClient.deleteSessionFile).not.toHaveBeenCalled();
  });

  it('DELETE /api/sessions/:id/files/delete returns 410 for terminated session', async () => {
    sessionService.getSessionById.mockResolvedValue(mockTerminatedSession);

    await expect(
      controller.deleteSessionFile('session-1', 'src/old.ts', {
        user: { userId: 'user-1' },
      }),
    ).rejects.toThrow(GoneException);

    expect(containerManagerClient.deleteSessionFile).not.toHaveBeenCalled();
  });

  it('DELETE /api/sessions/:id/files/delete returns 400 for empty path', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);

    await expect(
      controller.deleteSessionFile('session-1', '', {
        user: { userId: 'user-1' },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(containerManagerClient.deleteSessionFile).not.toHaveBeenCalled();
  });
});

/**
 * PHASE-77A: ISSUE-76-005 regression tests
 * POST /api/sessions/:id/exec must exist and behave per PRD/ARCHITECTURE contract.
 */
describe('SessionController (PHASE-77A: ISSUE-76-005 exec route)', () => {
  let controller: SessionController;
  let sessionService: jest.Mocked<SessionService>;
  let containerManagerClient: jest.Mocked<ContainerManagerHttpClient>;

  const mockActiveSession = {
    id: 'session-1',
    userId: 'user-1',
    status: 'active' as any,
    containerId: 'container-abc',
    createdAt: new Date(),
    expiresAt: new Date(),
    lastActivityAt: new Date(),
    user: {} as any,
    terminatedAt: null,
    terminationReason: null,
    project: null,
    projectId: null,
  };

  const mockTerminatedSession = {
    ...mockActiveSession,
    terminatedAt: new Date('2026-03-12T00:00:00Z'),
    terminationReason: 'manual',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        {
          provide: SessionService,
          useValue: {
            createSession: jest.fn(),
            getSessionsByUser: jest.fn(),
            getSessionById: jest.fn(),
            stopSession: jest.fn(),
            deleteSession: jest.fn(),
            terminateSession: jest.fn(),
          },
        },
        {
          provide: ContainerManagerHttpClient,
          useValue: {
            startSession: jest.fn(),
            stopSession: jest.fn(),
            deleteSession: jest.fn(),
            execInSession: jest.fn(),
          },
        },
        {
          provide: SnapshotPersistenceService,
          useValue: {
            saveSnapshot: jest.fn(),
            restoreSnapshot: jest.fn(),
            listSnapshots: jest.fn(),
          },
        },
        {
          provide: WorkspaceArchiveService,
          useValue: {
            exportWorkspaceArchive: jest.fn(),
            importWorkspaceArchive: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SessionQuotaGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SessionController>(SessionController);
    sessionService = module.get(SessionService);
    containerManagerClient = module.get(ContainerManagerHttpClient);
  });

  it('POST /api/sessions/:id/exec executes command on active session and returns result', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);
    containerManagerClient.execInSession.mockResolvedValue({
      exitCode: 0,
      stdout: 'hello\n',
      stderr: '',
    });

    const result = await controller.execInSession('session-1', 'echo hello', {
      user: { userId: 'user-1' },
    });

    expect(result).toEqual({ exitCode: 0, stdout: 'hello\n', stderr: '' });
    expect(containerManagerClient.execInSession).toHaveBeenCalledWith(
      'session-1',
      ['sh', '-c', 'echo hello'],
    );
  });

  it('POST /api/sessions/:id/exec returns 410 Gone for terminated session', async () => {
    sessionService.getSessionById.mockResolvedValue(mockTerminatedSession);

    await expect(
      controller.execInSession('session-1', 'echo hello', {
        user: { userId: 'user-1' },
      }),
    ).rejects.toThrow(GoneException);

    expect(containerManagerClient.execInSession).not.toHaveBeenCalled();
  });

  it('POST /api/sessions/:id/exec returns 404 for non-owned session', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);

    await expect(
      controller.execInSession('session-1', 'echo hello', {
        user: { userId: 'other-user' },
      }),
    ).rejects.toThrow(NotFoundException);

    expect(containerManagerClient.execInSession).not.toHaveBeenCalled();
  });

  it('POST /api/sessions/:id/exec returns 404 for non-existent session', async () => {
    sessionService.getSessionById.mockRejectedValue(
      new NotFoundException('Session with ID nonexistent not found'),
    );

    await expect(
      controller.execInSession('nonexistent', 'echo hello', {
        user: { userId: 'user-1' },
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('POST /api/sessions/:id/exec returns 400 for empty command', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);

    await expect(
      controller.execInSession('session-1', '', {
        user: { userId: 'user-1' },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(containerManagerClient.execInSession).not.toHaveBeenCalled();
  });

  it('POST /api/sessions/:id/exec returns 400 for null/undefined command', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);

    await expect(
      controller.execInSession('session-1', undefined as any, {
        user: { userId: 'user-1' },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(containerManagerClient.execInSession).not.toHaveBeenCalled();
  });

  it('POST /api/sessions/:id/exec propagates non-zero exit codes', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);
    containerManagerClient.execInSession.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'command not found',
    });

    const result = await controller.execInSession('session-1', 'badcmd', {
      user: { userId: 'user-1' },
    });

    expect(result).toEqual({
      exitCode: 1,
      stdout: '',
      stderr: 'command not found',
    });
  });
});

describe('SessionController (PR-01-01 snapshots)', () => {
  let controller: SessionController;
  let sessionService: jest.Mocked<SessionService>;
  let snapshotService: jest.Mocked<SnapshotPersistenceService>;

  const mockActiveSession = {
    id: 'session-1',
    userId: 'user-1',
    status: 'active' as any,
    containerId: 'container-abc',
    createdAt: new Date(),
    expiresAt: new Date(),
    lastActivityAt: new Date(),
    user: {} as any,
    terminatedAt: null,
    terminationReason: null,
    project: null,
    projectId: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        {
          provide: SessionService,
          useValue: {
            createSession: jest.fn(),
            getSessionsByUser: jest.fn(),
            getSessionById: jest.fn(),
            stopSession: jest.fn(),
            deleteSession: jest.fn(),
            terminateSession: jest.fn(),
          },
        },
        {
          provide: ContainerManagerHttpClient,
          useValue: {
            startSession: jest.fn(),
            stopSession: jest.fn(),
            deleteSession: jest.fn(),
          },
        },
        {
          provide: SnapshotPersistenceService,
          useValue: {
            saveSnapshot: jest.fn(),
            restoreSnapshot: jest.fn(),
            listSnapshots: jest.fn(),
          },
        },
        {
          provide: WorkspaceArchiveService,
          useValue: {
            exportWorkspaceArchive: jest.fn(),
            importWorkspaceArchive: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SessionQuotaGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SessionController>(SessionController);
    sessionService = module.get(SessionService);
    snapshotService = module.get(SnapshotPersistenceService);
  });

  it('POST /api/sessions/:id/snapshot enforces ownership and saves metadata', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);
    snapshotService.saveSnapshot.mockResolvedValue({
      id: 'snapshot-1',
      userId: 'user-1',
      label: 'before-restore',
      createdAt: '2026-04-03T00:00:00.000Z',
      fileCount: 2,
    });

    const result = await controller.saveSessionSnapshot(
      'session-1',
      { label: 'before-restore' },
      { user: { userId: 'user-1' } },
    );

    expect(snapshotService.saveSnapshot).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      label: 'before-restore',
    });
    expect(result.id).toBe('snapshot-1');
  });

  it('POST /api/sessions/:id/snapshot returns 404 for non-owned session', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);

    await expect(
      controller.saveSessionSnapshot(
        'session-1',
        { label: 'x' },
        { user: { userId: 'other-user' } },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('POST /api/sessions/:id/restore enforces ownership and restores snapshot', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);
    snapshotService.restoreSnapshot.mockResolvedValue({
      id: 'snapshot-1',
      userId: 'user-1',
      label: null,
      createdAt: '2026-04-03T00:00:00.000Z',
      fileCount: 3,
    });

    const result = await controller.restoreSessionSnapshot(
      'session-1',
      { snapshotId: 'snapshot-1' },
      { user: { userId: 'user-1' } },
    );

    expect(snapshotService.restoreSnapshot).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      snapshotId: 'snapshot-1',
    });
    expect(result.fileCount).toBe(3);
  });

  it('POST /api/sessions/:id/restore returns 404 for non-owned session', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);

    await expect(
      controller.restoreSessionSnapshot(
        'session-1',
        { snapshotId: 'snapshot-1' },
        { user: { userId: 'other-user' } },
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('SessionController (PR-02-01 import/export)', () => {
  let controller: SessionController;
  let sessionService: jest.Mocked<SessionService>;
  let archiveService: jest.Mocked<WorkspaceArchiveService>;

  const mockActiveSession = {
    id: 'session-1',
    userId: 'user-1',
    status: 'active' as any,
    containerId: null,
    createdAt: new Date(),
    expiresAt: new Date(),
    lastActivityAt: new Date(),
    user: {} as any,
    terminatedAt: null,
    terminationReason: null,
    project: null,
    projectId: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        {
          provide: SessionService,
          useValue: {
            createSession: jest.fn(),
            getSessionsByUser: jest.fn(),
            getSessionById: jest.fn(),
            stopSession: jest.fn(),
            deleteSession: jest.fn(),
            terminateSession: jest.fn(),
          },
        },
        {
          provide: ContainerManagerHttpClient,
          useValue: {
            startSession: jest.fn(),
            stopSession: jest.fn(),
            deleteSession: jest.fn(),
          },
        },
        {
          provide: SnapshotPersistenceService,
          useValue: {
            saveSnapshot: jest.fn(),
            restoreSnapshot: jest.fn(),
            listSnapshots: jest.fn(),
          },
        },
        {
          provide: WorkspaceArchiveService,
          useValue: {
            exportWorkspaceArchive: jest.fn(),
            importWorkspaceArchive: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SessionQuotaGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SessionController>(SessionController);
    sessionService = module.get(SessionService);
    archiveService = module.get(WorkspaceArchiveService);
  });

  it('GET /api/sessions/:id/export enforces ownership and returns zip stream', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);
    archiveService.exportWorkspaceArchive.mockResolvedValue(
      Buffer.from('zip-content'),
    );
    const responseHeaders: Record<string, string> = {};
    const res = {
      setHeader: (name: string, value: string) => {
        responseHeaders[name] = value;
      },
    } as any;

    const result = await controller.exportSessionWorkspace(
      'session-1',
      { user: { userId: 'user-1' } },
      res,
    );

    expect(archiveService.exportWorkspaceArchive).toHaveBeenCalledWith('session-1');
    expect(responseHeaders['Content-Type']).toBe('application/zip');
    expect(result).toBeDefined();
  });

  it('GET /api/sessions/:id/export returns 404 for non-owned session', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);

    await expect(
      controller.exportSessionWorkspace(
        'session-1',
        { user: { userId: 'other-user' } },
        { setHeader: () => undefined } as any,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('POST /api/sessions/:id/import enforces ownership and imports archive', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);
    archiveService.importWorkspaceArchive.mockResolvedValue({
      importedFileCount: 2,
    });

    const result = await controller.importSessionWorkspace(
      'session-1',
      {
        originalname: 'workspace.zip',
        buffer: Buffer.from([1, 2, 3]),
      } as any,
      { user: { userId: 'user-1' } },
    );

    expect(archiveService.importWorkspaceArchive).toHaveBeenCalledWith(
      'session-1',
      Buffer.from([1, 2, 3]),
    );
    expect(result.importedFileCount).toBe(2);
  });

  it('POST /api/sessions/:id/import returns 404 for non-owned session', async () => {
    sessionService.getSessionById.mockResolvedValue(mockActiveSession);

    await expect(
      controller.importSessionWorkspace(
        'session-1',
        { originalname: 'workspace.zip', buffer: Buffer.from([1]) } as any,
        { user: { userId: 'other-user' } },
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
