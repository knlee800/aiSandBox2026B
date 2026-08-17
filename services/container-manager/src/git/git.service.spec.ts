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

const GIT_INSTALL_PREFIX =
  'command -v git >/dev/null 2>&1 || apk add --no-cache git >/dev/null 2>&1;';
const WORKSPACE_SAFE_DIRECTORY_COMMAND =
  'git config --global --replace-all safe.directory /workspace';
const CHECK_REPO_COMMAND = `${GIT_INSTALL_PREFIX} ${WORKSPACE_SAFE_DIRECTORY_COMMAND} && git rev-parse --is-inside-work-tree`;
const INIT_REPO_COMMAND = `${GIT_INSTALL_PREFIX} ${WORKSPACE_SAFE_DIRECTORY_COMMAND} && git init && git config user.name "AI Sandbox" && git config user.email "sandbox@aisandbox.com"`;

function execShellCommand(execInContainer: jest.Mock, callIndex: number): string {
  const argv = execInContainer.mock.calls[callIndex]?.[1] as string[] | undefined;
  return argv?.[2] ?? '';
}

function assertNarrowWorkspaceSafeDirectory(command: string) {
  expect(command).toContain(GIT_INSTALL_PREFIX);
  expect(command).toContain(WORKSPACE_SAFE_DIRECTORY_COMMAND);
  expect(command).toContain('safe.directory /workspace');
  expect(command).not.toContain("safe.directory '*'");
  expect(command).not.toContain('safe.directory "*"');
  expect(command).not.toContain('safe.directory *');
}

function ensureGitInitializedInContainer(
  serviceLike: { sessionsService: { execInContainer: jest.Mock } },
  sessionId: string,
): Promise<void> {
  return (
    GitService.prototype as unknown as {
      ensureGitInitializedInContainer: (sessionId: string) => Promise<void>;
    }
  ).ensureGitInitializedInContainer.call(serviceLike, sessionId);
}

describe('GitService.ensureGitInitializedInContainer', () => {
  it('installs or finds git, then trusts only /workspace before checking an existing repo', async () => {
    const execInContainer = jest.fn(async () => ({
      exitCode: 0,
      stdout: 'true\n',
      stderr: '',
    }));
    const serviceLike = {
      sessionsService: { execInContainer },
    } as any;

    await ensureGitInitializedInContainer(serviceLike, 'session-123');

    expect(execInContainer).toHaveBeenCalledTimes(1);
    expect(execInContainer).toHaveBeenCalledWith(
      'session-123',
      ['sh', '-lc', CHECK_REPO_COMMAND],
      '/workspace',
    );
    assertNarrowWorkspaceSafeDirectory(execShellCommand(execInContainer, 0));
    expect(execShellCommand(execInContainer, 0)).toContain(
      'git rev-parse --is-inside-work-tree',
    );
    expect(execShellCommand(execInContainer, 0)).not.toContain('git init');
  });

  it('trusts /workspace before git init and identity config when the repo is missing', async () => {
    const execResponses = [
      { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' },
      { exitCode: 0, stdout: 'Initialized empty Git repository\n', stderr: '' },
    ];
    const execInContainer = jest.fn(async () => {
      const next = execResponses.shift();
      if (!next) {
        throw new Error('Unexpected execInContainer call');
      }
      return next;
    });
    const serviceLike = {
      sessionsService: { execInContainer },
    } as any;

    await ensureGitInitializedInContainer(serviceLike, 'session-123');

    expect(execInContainer).toHaveBeenCalledTimes(2);
    expect(execInContainer).toHaveBeenNthCalledWith(
      1,
      'session-123',
      ['sh', '-lc', CHECK_REPO_COMMAND],
      '/workspace',
    );
    expect(execInContainer).toHaveBeenNthCalledWith(
      2,
      'session-123',
      ['sh', '-lc', INIT_REPO_COMMAND],
      '/workspace',
    );

    const checkCommand = execShellCommand(execInContainer, 0);
    const initCommand = execShellCommand(execInContainer, 1);
    assertNarrowWorkspaceSafeDirectory(checkCommand);
    assertNarrowWorkspaceSafeDirectory(initCommand);
    expect(initCommand.indexOf(WORKSPACE_SAFE_DIRECTORY_COMMAND)).toBeLessThan(
      initCommand.indexOf('git init'),
    );
    expect(initCommand).toContain('git init');
    expect(initCommand).toContain('git config user.name "AI Sandbox"');
    expect(initCommand).toContain('git config user.email "sandbox@aisandbox.com"');
  });

  it('does not re-init when the repository is already present on repeated calls', async () => {
    const execInContainer = jest.fn(async () => ({
      exitCode: 0,
      stdout: 'true\n',
      stderr: '',
    }));
    const serviceLike = {
      sessionsService: { execInContainer },
    } as any;

    await ensureGitInitializedInContainer(serviceLike, 'session-123');
    await ensureGitInitializedInContainer(serviceLike, 'session-123');

    expect(execInContainer).toHaveBeenCalledTimes(2);
    expect(execInContainer).toHaveBeenNthCalledWith(
      1,
      'session-123',
      ['sh', '-lc', CHECK_REPO_COMMAND],
      '/workspace',
    );
    expect(execInContainer).toHaveBeenNthCalledWith(
      2,
      'session-123',
      ['sh', '-lc', CHECK_REPO_COMMAND],
      '/workspace',
    );
    expect(execShellCommand(execInContainer, 0)).not.toContain('git init');
    expect(execShellCommand(execInContainer, 1)).not.toContain('git init');
  });

  it('keeps dirty-workspace add/commit behavior after the /workspace trust step', async () => {
    const sessionId = 'session-123';
    const userId = 'user-456';
    const messageNumber = 8;
    const description = 'Auth Module: installed authentication starter';
    const commitHash = 'def456abc123789012345678901234567890abcd';

    const execResponses = [
      { exitCode: 0, stdout: 'true\n', stderr: '' },
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
      ensureGitInitializedInContainer: (
        GitService.prototype as unknown as {
          ensureGitInitializedInContainer: (sessionId: string) => Promise<void>;
        }
      ).ensureGitInitializedInContainer,
    } as any;

    const result = await GitService.prototype.commit.call(
      serviceLike,
      sessionId,
      userId,
      messageNumber,
      description,
      true,
    );

    expect(execInContainer).toHaveBeenNthCalledWith(
      1,
      sessionId,
      ['sh', '-lc', CHECK_REPO_COMMAND],
      '/workspace',
    );
    assertNarrowWorkspaceSafeDirectory(execShellCommand(execInContainer, 0));
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
