import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { InternalSessionsController } from './internal-sessions.controller';

describe('InternalSessionsController file routes', () => {
  let controller: InternalSessionsController;
  let sessionsService: {
    deleteFileFromContainer: jest.Mock;
    searchFilesInContainer: jest.Mock;
  };

  beforeEach(() => {
    sessionsService = {
      deleteFileFromContainer: jest.fn(),
      searchFilesInContainer: jest.fn(),
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

  it('delegates search requests to SessionsService with session id and query', async () => {
    const expected = {
      query: 'SPECIAL_TEST_KEYWORD',
      results: [{ path: 'src/app.ts', line: 12, preview: 'const SPECIAL_TEST_KEYWORD = true;' }],
      truncated: false,
    };
    sessionsService.searchFilesInContainer.mockImplementation(async () => expected);

    await expect(
      controller.searchFiles('session-123', 'SPECIAL_TEST_KEYWORD'),
    ).resolves.toEqual(expected);

    expect(sessionsService.searchFilesInContainer).toHaveBeenCalledWith(
      'session-123',
      'SPECIAL_TEST_KEYWORD',
    );
  });

  it('rejects missing search query', async () => {
    await expect(controller.searchFiles('session-123', undefined)).rejects.toThrow(
      BadRequestException,
    );
  });
});
