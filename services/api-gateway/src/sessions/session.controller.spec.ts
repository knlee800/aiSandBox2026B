import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionQuotaGuard } from '../quota/session-quota.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';

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
