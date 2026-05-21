import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CheckpointsController } from '../checkpoints.controller';
import { CheckpointsService } from '../checkpoints.service';
import { SessionCookieGuard } from '../../auth/session-cookie.guard';

describe('CheckpointsController HTTP route registration', () => {
  let app: INestApplication;
  let service: jest.Mocked<CheckpointsService>;
  let mockSessionService: {
    getSessionById: jest.Mock;
  };

  const authenticatedUserId = 'user-456';

  beforeEach(async () => {
    mockSessionService = {
      getSessionById: jest.fn(),
    };

    const mockService = {
      createManualCheckpoint: jest.fn(),
      listCheckpoints: jest.fn(),
      getCheckpointDiff: jest.fn(),
      revertToCheckpoint: jest.fn(),
    };

    Object.defineProperty(mockService, 'sessionService', {
      get: () => mockSessionService,
      configurable: true,
    });

    const authGuard: CanActivate = {
      canActivate: (context: ExecutionContext): boolean => {
        const req = context.switchToHttp().getRequest();
        req.user = { userId: authenticatedUserId };
        return true;
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckpointsController],
      providers: [
        {
          provide: CheckpointsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(SessionCookieGuard)
      .useValue(authGuard)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    service = module.get(CheckpointsService);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('registers POST /api/sessions/:id/revert and forwards commitHash', async () => {
    const sessionId = 'session-123';
    const commitHash = 'a'.repeat(40);
    const revertResponse = {
      message: 'Reverted successfully',
      newCheckpoint: {
        id: 'checkpoint-new',
        commitHash: 'b'.repeat(40),
        description: 'Reverted to aaaaaaa',
      },
    };

    mockSessionService.getSessionById.mockResolvedValue({
      id: sessionId,
      userId: authenticatedUserId,
      terminatedAt: null,
    } as any);
    service.revertToCheckpoint.mockResolvedValue(revertResponse as any);

    const response = await request(app.getHttpServer())
      .post(`/api/sessions/${sessionId}/revert`)
      .send({
        userId: authenticatedUserId,
        commitHash,
      })
      .expect(200);

    expect(response.body).toEqual(revertResponse);
    expect(mockSessionService.getSessionById).toHaveBeenCalledWith(sessionId);
    expect(service.revertToCheckpoint).toHaveBeenCalledWith(sessionId, commitHash, authenticatedUserId);
  });

  it('returns 400 when commitHash is missing for POST /api/sessions/:id/revert', async () => {
    const sessionId = 'session-123';

    const response = await request(app.getHttpServer())
      .post(`/api/sessions/${sessionId}/revert`)
      .send({
        userId: authenticatedUserId,
      })
      .expect(400);

    expect(JSON.stringify(response.body.message)).toContain('commitHash');
    expect(service.revertToCheckpoint).not.toHaveBeenCalled();
  });

  it('keeps GET /api/sessions/:id/checkpoints route registered', async () => {
    const sessionId = 'session-123';
    const checkpoints = [
      {
        id: 'checkpoint-1',
        commitHash: 'abc123def456789012345678901234567890abcd',
        messageNumber: 1,
        description: 'Created Flask app',
        filesChanged: 2,
        createdAt: '2026-03-09T14:32:15Z',
      },
    ];

    mockSessionService.getSessionById.mockResolvedValue({
      id: sessionId,
      userId: authenticatedUserId,
      terminatedAt: null,
    } as any);
    service.listCheckpoints.mockResolvedValue(checkpoints as any);

    const response = await request(app.getHttpServer())
      .get(`/api/sessions/${sessionId}/checkpoints`)
      .expect(200);

    expect(response.body).toEqual(checkpoints);
    expect(service.listCheckpoints).toHaveBeenCalledWith(sessionId);
    expect(mockSessionService.getSessionById).toHaveBeenCalledWith(sessionId);
  });
});
