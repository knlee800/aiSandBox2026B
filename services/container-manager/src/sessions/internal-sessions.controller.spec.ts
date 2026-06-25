import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { InternalSessionsController } from './internal-sessions.controller';

describe('InternalSessionsController file routes', () => {
  let controller: InternalSessionsController;
  let sessionsService: any;
  let browserSmokeService: any;

  beforeEach(() => {
    sessionsService = {
      deleteFileFromContainer: jest.fn<any>(),
      searchFilesInContainer: jest.fn<any>(),
    };
    browserSmokeService = {
      run: jest.fn<any>(),
    };
    controller = new InternalSessionsController(
      sessionsService,
      browserSmokeService,
    );
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

  it('delegates browser-smoke requests to BrowserSmokeService', async () => {
    const expected = {
      success: true,
      url: 'http://172.17.0.2:3000/',
      pageTitle: 'App',
      consoleErrors: [],
      consoleWarnings: [],
      networkErrors: [],
      visibleTextSnippet: '',
      durationMs: 500,
      truncated: false,
    };
    browserSmokeService.run.mockResolvedValue(expected);

    const result = await controller.runBrowserSmoke('session-123', '/', 60000);

    expect(browserSmokeService.run).toHaveBeenCalledWith({
      sessionId: 'session-123',
      url: '/',
      timeoutMs: 60000,
    });
    expect(result).toEqual(expected);
  });

  it('throws BadRequestException for invalid browser-smoke URL', async () => {
    browserSmokeService.run.mockRejectedValue(
      new Error('Absolute URLs are not allowed; provide a relative path starting with /'),
    );

    await expect(
      controller.runBrowserSmoke('session-123', 'https://evil.com'),
    ).rejects.toThrow(BadRequestException);
  });
});
