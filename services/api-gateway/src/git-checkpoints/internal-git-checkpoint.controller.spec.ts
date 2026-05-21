import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { InternalGitCheckpointController } from './internal-git-checkpoint.controller';
import { GitCheckpointService } from './git-checkpoint.service';

describe('InternalGitCheckpointController', () => {
  let app: INestApplication;
  let gitCheckpointService: {
    recordCheckpoint: jest.Mock;
  };

  beforeEach(async () => {
    gitCheckpointService = {
      recordCheckpoint: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalGitCheckpointController],
      providers: [
        {
          provide: GitCheckpointService,
          useValue: gitCheckpointService,
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

  it('returns success for valid full body and forwards exact payload', async () => {
    gitCheckpointService.recordCheckpoint.mockResolvedValue({
      id: 'checkpoint-1',
    });

    const payload = {
      sessionId: 'session-123',
      commitHash: 'a'.repeat(40),
      filesChanged: 3,
      messageNumber: 42,
      description: 'Created checkpoint after revert',
    };

    const response = await request(app.getHttpServer())
      .post('/api/internal/git-checkpoints')
      .send(payload)
      .expect(201);

    expect(response.body).toEqual({
      message: 'Git checkpoint recorded successfully',
    });
    expect(gitCheckpointService.recordCheckpoint).toHaveBeenCalledWith(payload);
  });

  it('accepts minimal valid body and forwards null optional fields', async () => {
    gitCheckpointService.recordCheckpoint.mockResolvedValue({
      id: 'checkpoint-2',
    });

    const payload = {
      sessionId: 'session-456',
      commitHash: 'b'.repeat(40),
      filesChanged: 0,
    };

    await request(app.getHttpServer())
      .post('/api/internal/git-checkpoints')
      .send(payload)
      .expect(201);

    expect(gitCheckpointService.recordCheckpoint).toHaveBeenCalledWith({
      ...payload,
      messageNumber: null,
      description: null,
    });
  });

  it('returns 400 when sessionId is missing', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/git-checkpoints')
      .send({
        commitHash: 'c'.repeat(40),
        filesChanged: 1,
      })
      .expect(400);

    expect(gitCheckpointService.recordCheckpoint).not.toHaveBeenCalled();
  });

  it('returns 400 when commitHash is missing', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/git-checkpoints')
      .send({
        sessionId: 'session-789',
        filesChanged: 1,
      })
      .expect(400);

    expect(gitCheckpointService.recordCheckpoint).not.toHaveBeenCalled();
  });

  it('returns 400 when filesChanged is missing', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/git-checkpoints')
      .send({
        sessionId: 'session-987',
        commitHash: 'd'.repeat(40),
      })
      .expect(400);

    expect(gitCheckpointService.recordCheckpoint).not.toHaveBeenCalled();
  });

  it('returns 400 when sessionId is not a string', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/git-checkpoints')
      .send({
        sessionId: 123,
        commitHash: 'e'.repeat(40),
        filesChanged: 1,
      })
      .expect(400);

    expect(gitCheckpointService.recordCheckpoint).not.toHaveBeenCalled();
  });

  it('keeps sessionId intact for valid requests (not stripped by whitelist)', async () => {
    gitCheckpointService.recordCheckpoint.mockResolvedValue({
      id: 'checkpoint-3',
    });

    const sessionId = 'session-forward-check';
    await request(app.getHttpServer())
      .post('/api/internal/git-checkpoints')
      .send({
        sessionId,
        commitHash: 'f'.repeat(40),
        filesChanged: 2,
      })
      .expect(201);

    expect(gitCheckpointService.recordCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId }),
    );
  });
});
