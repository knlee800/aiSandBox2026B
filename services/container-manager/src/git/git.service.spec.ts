import { describe, expect, it, jest } from '@jest/globals';
import { GitService } from './git.service';

describe('GitService.revert', () => {
  it('runs git reset inside sandbox container and records checkpoint on success', async () => {
    const execInContainer = jest.fn(async () => ({
      exitCode: 0,
      stdout: 'HEAD is now at abc1234',
      stderr: '',
    }));
    const createCheckpoint = jest.fn(async () => undefined);

    const serviceLike = {
      sessionsService: { execInContainer },
      createCheckpoint,
    } as any;

    const sessionId = 'session-123';
    const userId = 'user-456';
    const commitHash = 'abc123def456789012345678901234567890abcd';

    const result = await GitService.prototype.revert.call(
      serviceLike,
      sessionId,
      userId,
      commitHash,
    );

    expect(execInContainer).toHaveBeenCalledWith(
      sessionId,
      ['sh', '-lc', 'git reset --hard "$COMMIT_HASH"'],
      '/workspace',
      { COMMIT_HASH: commitHash },
    );
    expect(createCheckpoint).toHaveBeenCalledWith(
      sessionId,
      userId,
      0,
      commitHash,
      'Reverted to abc123d',
      0,
    );
    expect(result).toEqual({
      message: 'Reverted to commit successfully',
      commitHash,
    });
  });

  it('throws command stderr when reset exits non-zero', async () => {
    const execInContainer = jest.fn(async () => ({
      exitCode: 1,
      stdout: '',
      stderr: 'fatal: ambiguous argument',
    }));

    const serviceLike = {
      sessionsService: { execInContainer },
      createCheckpoint: jest.fn(),
    } as any;

    await expect(
      GitService.prototype.revert.call(
        serviceLike,
        'session-123',
        'user-456',
        'abc123def456789012345678901234567890abcd',
      ),
    ).rejects.toThrow('fatal: ambiguous argument');
  });

  it('throws fallback message when reset exits non-zero without stderr', async () => {
    const execInContainer = jest.fn(async () => ({
      exitCode: 1,
      stdout: '',
      stderr: '',
    }));

    const serviceLike = {
      sessionsService: { execInContainer },
      createCheckpoint: jest.fn(),
    } as any;

    await expect(
      GitService.prototype.revert.call(
        serviceLike,
        'session-123',
        'user-456',
        'abc123def456789012345678901234567890abcd',
      ),
    ).rejects.toThrow('Failed to reset to commit');
  });
});

describe('GitService.commit', () => {
  it('creates empty commit when allowEmpty is true and workspace is clean', async () => {
    const sessionId = 'session-123';
    const userId = 'user-456';
    const messageNumber = 7;
    const commitHash = 'abc123def456789012345678901234567890abcd';
    const description = 'Auth Module: pre-install snapshot';

    const execResponses = [
      { exitCode: 0, stdout: '', stderr: '' },
      { exitCode: 0, stdout: '[main abc123d] checkpoint', stderr: '' },
      { exitCode: 0, stdout: `${commitHash}\n`, stderr: '' },
    ];
    const execInContainer = jest.fn(async () => {
      const next = execResponses.shift();
      if (!next) {
        throw new Error('Unexpected execInContainer call');
      }
      return next;
    });
    const createCheckpoint = jest.fn(async () => undefined);
    const ensureGitInitializedInContainer = jest.fn(async () => undefined);

    const serviceLike = {
      sessionsService: { execInContainer },
      createCheckpoint,
      ensureGitInitializedInContainer,
    } as any;

    const result = await GitService.prototype.commit.call(
      serviceLike,
      sessionId,
      userId,
      messageNumber,
      description,
      true,
    );

    expect(execInContainer).toHaveBeenCalledWith(
      sessionId,
      ['sh', '-lc', 'git commit --allow-empty -m "$COMMIT_MESSAGE"'],
      '/workspace',
      { COMMIT_MESSAGE: description },
    );
    expect(createCheckpoint).toHaveBeenCalledWith(
      sessionId,
      userId,
      messageNumber,
      commitHash,
      description,
      0,
    );
    expect(result).toEqual({
      message: 'Changes committed successfully',
      commitHash,
      filesChanged: 0,
    });
  });

  it('keeps null commitHash behavior when allowEmpty is not set and workspace is clean', async () => {
    const execInContainer = jest.fn(async () => ({
      exitCode: 0,
      stdout: '',
      stderr: '',
    }));
    const serviceLike = {
      sessionsService: { execInContainer },
      createCheckpoint: jest.fn(),
      ensureGitInitializedInContainer: jest.fn(async () => undefined),
    } as any;

    const result = await GitService.prototype.commit.call(
      serviceLike,
      'session-123',
      'user-456',
      3,
      'checkpoint',
    );

    expect(result).toEqual({
      message: 'No changes to commit',
      commitHash: null,
    });
    expect(serviceLike.createCheckpoint).not.toHaveBeenCalled();
  });

  it('uses normal dirty-workspace commit path when allowEmpty is true', async () => {
    const sessionId = 'session-123';
    const userId = 'user-456';
    const messageNumber = 8;
    const description = 'Auth Module: installed authentication starter';
    const commitHash = 'def456abc123789012345678901234567890abcd';

    const execResponses = [
      { exitCode: 0, stdout: 'M app/page.tsx\n', stderr: '' },
      { exitCode: 0, stdout: '', stderr: '' },
      { exitCode: 0, stdout: '[main def456a] checkpoint', stderr: '' },
      { exitCode: 0, stdout: `${commitHash}\n`, stderr: '' },
    ];
    const execInContainer = jest.fn(async () => {
      const next = execResponses.shift();
      if (!next) {
        throw new Error('Unexpected execInContainer call');
      }
      return next;
    });
    const createCheckpoint = jest.fn(async () => undefined);

    const serviceLike = {
      sessionsService: { execInContainer },
      createCheckpoint,
      ensureGitInitializedInContainer: jest.fn(async () => undefined),
    } as any;

    const result = await GitService.prototype.commit.call(
      serviceLike,
      sessionId,
      userId,
      messageNumber,
      description,
      true,
    );

    expect(execInContainer).toHaveBeenCalledWith(sessionId, ['sh', '-lc', 'git add -A'], '/workspace');
    expect(execInContainer).toHaveBeenCalledWith(
      sessionId,
      ['sh', '-lc', 'git commit -m "$COMMIT_MESSAGE"'],
      '/workspace',
      { COMMIT_MESSAGE: description },
    );
    expect(execInContainer).not.toHaveBeenCalledWith(
      sessionId,
      ['sh', '-lc', 'git commit --allow-empty -m "$COMMIT_MESSAGE"'],
      '/workspace',
      { COMMIT_MESSAGE: description },
    );
    expect(createCheckpoint).toHaveBeenCalledWith(
      sessionId,
      userId,
      messageNumber,
      commitHash,
      description,
      1,
    );
    expect(result).toEqual({
      message: 'Changes committed successfully',
      commitHash,
      filesChanged: 1,
    });
  });
});
