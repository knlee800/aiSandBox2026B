import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { of } from 'rxjs';

jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    exec: jest.fn(),
    prepare: jest.fn().mockReturnValue({
      get: jest.fn(),
      run: jest.fn(),
      all: jest.fn().mockReturnValue([]),
    }),
  }));
});

jest.mock('fs', () => ({
  ...jest.requireActual<typeof import('fs')>('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn<any>().mockResolvedValue(undefined),
  writeFile: jest.fn<any>().mockResolvedValue(undefined),
  rm: jest.fn<any>().mockResolvedValue(undefined),
}));

import { SessionsService } from './sessions.service';

/**
 * CM-AUTH-01 (D3): createSession's self-call to POST /api/git/:id/init goes
 * through the global guard, so it sends X-Internal-Service-Key.
 */
describe('SessionsService.createSession git init self-call (CM-AUTH-01 D3)', () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  const originalPort = process.env.PORT;
  let post: jest.Mock<any>;
  let service: SessionsService;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    delete process.env.PORT;
    post = jest.fn<any>().mockReturnValue(of({ data: {} }));
    service = new SessionsService(
      { post } as any,
      { notifySessionStarted: jest.fn<any>().mockResolvedValue(undefined) } as any,
      {} as any,
      {} as any,
      {
        createProject: jest.fn<any>().mockResolvedValue({ id: 'project-1' }),
        persistWorkspaceSnapshot: jest.fn<any>().mockResolvedValue(undefined),
      } as any,
      {} as any,
    );
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
    }
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
    jest.restoreAllMocks();
  });

  it('sends the internal key on the git init call', async () => {
    process.env.INTERNAL_SERVICE_KEY = 'cm-auth-01-self-call-key';

    const result = await service.createSession('user-1');

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      `http://localhost:4002/api/git/${result.sessionId}/init`,
      { userId: 'user-1' },
      { headers: { 'X-Internal-Service-Key': 'cm-auth-01-self-call-key' } },
    );
  });

  it('never logs the key', async () => {
    process.env.INTERNAL_SERVICE_KEY = 'cm-auth-01-self-call-key';
    await service.createSession('user-1');

    const logged = JSON.stringify([
      (console.log as unknown as jest.Mock).mock.calls,
      (console.error as unknown as jest.Mock).mock.calls,
    ]);
    expect(logged).not.toContain('cm-auth-01-self-call-key');
  });

  it('leaves the header out when the key is unset', async () => {
    delete process.env.INTERNAL_SERVICE_KEY;

    await service.createSession('user-1');

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][2]).toBeUndefined();
  });
});
