import { Test, TestingModule } from '@nestjs/testing';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionQuotaGuard } from '../quota/session-quota.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';

describe('SessionController (TASK-68B-2 query extension)', () => {
  let controller: SessionController;
  let sessionService: jest.Mocked<SessionService>;

  beforeEach(async () => {
    const mockSessionService = {
      createSession: jest.fn(),
      getSessionsByUser: jest.fn(),
      getSessionById: jest.fn(),
      stopSession: jest.fn(),
      deleteSession: jest.fn(),
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
