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
