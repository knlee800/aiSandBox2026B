import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { InternalSessionsController } from './internal-sessions.controller';

describe('InternalSessionsController deleteFile', () => {
  let controller: InternalSessionsController;
  let sessionsService: {
    deleteFileFromContainer: jest.Mock;
  };

  beforeEach(() => {
    sessionsService = {
      deleteFileFromContainer: jest.fn(),
    };
    controller = new InternalSessionsController(sessionsService as any);
  });

  it('delegates delete requests to SessionsService with session id and path', async () => {
    await controller.deleteFile('session-123', 'src/delete-test.html');

    expect(sessionsService.deleteFileFromContainer).toHaveBeenCalledWith(
      'session-123',
      'src/delete-test.html',
    );
  });

  it('rejects missing path', async () => {
    await expect(controller.deleteFile('session-123', undefined)).rejects.toThrow(
      BadRequestException,
    );
  });
});
