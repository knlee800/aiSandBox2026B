import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { InternalSessionController } from './internal-session.controller';
import { SessionService } from './session.service';

describe('InternalSessionController (PRIVATE-BETA-BLOCKER-03E-B)', () => {
  let app: INestApplication;
  let sessionService: {
    startSession: jest.Mock;
    stopSession: jest.Mock;
    terminateSession: jest.Mock;
    markSessionError: jest.Mock;
  };

  beforeEach(async () => {
    sessionService = {
      startSession: jest.fn().mockResolvedValue(undefined),
      stopSession: jest.fn().mockResolvedValue(undefined),
      terminateSession: jest.fn().mockResolvedValue(undefined),
      markSessionError: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalSessionController],
      providers: [
        {
          provide: SessionService,
          useValue: sessionService,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('keeps existing explicit stop notification status-only and idempotent', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/sessions/session-1/stop')
      .send({})
      .expect(200)
      .expect({ message: 'Session stopped successfully' });

    expect(sessionService.stopSession).toHaveBeenCalledWith('session-1');
    expect(sessionService.terminateSession).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .post('/api/internal/sessions/session-1/stop')
      .send({})
      .expect(200);

    expect(sessionService.stopSession).toHaveBeenCalledTimes(2);
  });

  it('idle_timeout notification terminates Postgres with idle_timeout', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/sessions/session-idle/stop')
      .send({ reason: 'idle_timeout' })
      .expect(200)
      .expect({ message: 'Session stopped successfully' });

    expect(sessionService.terminateSession).toHaveBeenCalledWith(
      'session-idle',
      'idle_timeout',
    );
    expect(sessionService.stopSession).not.toHaveBeenCalled();
  });

  it('max_lifetime notification terminates Postgres with max_lifetime', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/sessions/session-lifetime/stop')
      .send({ reason: 'max_lifetime' })
      .expect(200);

    expect(sessionService.terminateSession).toHaveBeenCalledWith(
      'session-lifetime',
      'max_lifetime',
    );
    expect(sessionService.stopSession).not.toHaveBeenCalled();
  });

  it('duplicate lifecycle notification is safe for an already-terminal session', async () => {
    sessionService.terminateSession.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/api/internal/sessions/session-dup/stop')
      .send({ reason: 'idle_timeout' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/internal/sessions/session-dup/stop')
      .send({ reason: 'idle_timeout' })
      .expect(200);

    expect(sessionService.terminateSession).toHaveBeenCalledTimes(2);
    expect(sessionService.terminateSession).toHaveBeenNthCalledWith(
      1,
      'session-dup',
      'idle_timeout',
    );
    expect(sessionService.terminateSession).toHaveBeenNthCalledWith(
      2,
      'session-dup',
      'idle_timeout',
    );
  });
});
