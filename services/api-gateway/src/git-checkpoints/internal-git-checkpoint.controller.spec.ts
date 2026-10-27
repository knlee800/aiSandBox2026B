import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { InternalGitCheckpointController } from './internal-git-checkpoint.controller';
import { GitCheckpointService } from './git-checkpoint.service';

describe('InternalGitCheckpointController', () => {
  let app: INestApplication;
  let gitCheckpointService: {
    recordCheckpoint: jest.Mock;
    getSessionOwnerAndProject: jest.Mock;
  };
  let containerManager: {
    saveCheckpointHistory: jest.Mock;
  };

  beforeEach(async () => {
    gitCheckpointService = {
      recordCheckpoint: jest.fn(),
      getSessionOwnerAndProject: jest.fn().mockResolvedValue({
        userId: 'user-1',
        projectId: null,
      }),
    };
    containerManager = {
      saveCheckpointHistory: jest.fn().mockResolvedValue({ status: 'skipped' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalGitCheckpointController],
      providers: [
        {
          provide: GitCheckpointService,
          useValue: gitCheckpointService,
        },
        {
          provide: ContainerManagerHttpClient,
          useValue: containerManager,
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

  it('starts a checkpoint history save without awaiting it when the session has a project', async () => {
    let releaseSave: (value: { status: 'saved'; bytes: number }) => void = () => undefined;
    const savePending = new Promise<{ status: 'saved'; bytes: number }>((resolve) => {
      releaseSave = resolve;
    });
    containerManager.saveCheckpointHistory.mockReturnValue(savePending);
    gitCheckpointService.recordCheckpoint.mockResolvedValue({ id: 'checkpoint-1' });
    gitCheckpointService.getSessionOwnerAndProject.mockResolvedValue({
      userId: 'user-1',
      projectId: 'project-1',
    });

    const response = await request(app.getHttpServer())
      .post('/api/internal/git-checkpoints')
      .send({
        sessionId: 'session-123',
        commitHash: 'a'.repeat(40),
        filesChanged: 1,
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      message: 'Git checkpoint recorded successfully',
    });
    expect(containerManager.saveCheckpointHistory).toHaveBeenCalledWith(
      'session-123',
      'project-1',
    );

    releaseSave({ status: 'saved', bytes: 12 });
    await savePending;
  });

  it('logs a failing history save and leaves the recorded response unchanged', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    containerManager.saveCheckpointHistory.mockRejectedValue(new Error('bundle write failed'));
    gitCheckpointService.recordCheckpoint.mockResolvedValue({ id: 'checkpoint-1' });
    gitCheckpointService.getSessionOwnerAndProject.mockResolvedValue({
      userId: 'user-1',
      projectId: 'project-1',
    });

    try {
      const response = await request(app.getHttpServer())
        .post('/api/internal/git-checkpoints')
        .send({
          sessionId: 'session-123',
          commitHash: 'a'.repeat(40),
          filesChanged: 2,
        })
        .expect(201);

      expect(response.body).toEqual({
        message: 'Git checkpoint recorded successfully',
      });
      await new Promise((resolve) => setImmediate(resolve));
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('bundle write failed'),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('session-123'),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('does not save checkpoint history when the session has no project', async () => {
    gitCheckpointService.recordCheckpoint.mockResolvedValue({ id: 'checkpoint-1' });
    gitCheckpointService.getSessionOwnerAndProject.mockResolvedValue({
      userId: 'user-1',
      projectId: null,
    });

    await request(app.getHttpServer())
      .post('/api/internal/git-checkpoints')
      .send({
        sessionId: 'session-123',
        commitHash: 'b'.repeat(40),
        filesChanged: 0,
      })
      .expect(201);

    expect(containerManager.saveCheckpointHistory).not.toHaveBeenCalled();
  });

  it('returns the recorded response when the session lookup fails', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    gitCheckpointService.recordCheckpoint.mockResolvedValue({ id: 'checkpoint-1' });
    gitCheckpointService.getSessionOwnerAndProject.mockRejectedValue(
      new Error('session lookup failed'),
    );

    try {
      const response = await request(app.getHttpServer())
        .post('/api/internal/git-checkpoints')
        .send({
          sessionId: 'session-123',
          commitHash: 'c'.repeat(40),
          filesChanged: 1,
        })
        .expect(201);

      expect(response.body).toEqual({
        message: 'Git checkpoint recorded successfully',
      });
      await new Promise((resolve) => setImmediate(resolve));
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('session lookup failed'),
      );
      expect(containerManager.saveCheckpointHistory).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
