import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GitService } from './git.service';

jest.mock('fs/promises', () => {
  const actual = jest.requireActual('fs/promises') as typeof import('fs/promises');
  return {
    ...actual,
    mkdir: jest.fn(),
    copyFile: jest.fn(),
    rename: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn(),
  };
});

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

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const BRANCH_HEAD = 'a'.repeat(40);
const DETACHED_HEAD = 'b'.repeat(40);
const CONTAINER_HISTORY_BUNDLE = '/workspace/.git/aisb-history.bundle';
const CONTAINER_RESTORE_BUNDLE = '/workspace/.aisb-history-restore.bundle';
const FETCH_COMMAND = `git fetch --update-head-ok ${CONTAINER_RESTORE_BUNDLE} "+refs/*:refs/*"`;

function fsFn(fn: unknown): jest.Mock<any> {
  return fn as jest.Mock<any>;
}

function workspaceFor(sessionId: string): string {
  return path.join('C:\\aisb-test', 'workspaces', sessionId);
}

function enoent(): NodeJS.ErrnoException {
  const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
  error.code = 'ENOENT';
  return error;
}

function historyHarness(execInContainer: jest.Mock) {
  return Object.assign(Object.create(GitService.prototype), {
    sessionsService: {
      execInContainer,
      getWorkspacePath: (sessionId: string) => workspaceFor(sessionId),
    },
  });
}

function callHistory(
  method: 'saveProjectHistory' | 'restoreProjectHistory',
  serviceLike: object,
  sessionId: string,
  projectId: string,
) {
  return (
    GitService.prototype as unknown as Record<
      'saveProjectHistory' | 'restoreProjectHistory',
      (sessionId: string, projectId: string) => Promise<unknown>
    >
  )[method].call(serviceLike, sessionId, projectId);
}

describe('GitService.createCheckpoint refs', () => {
  const commitHash = 'abc123def456789012345678901234567890abcd';

  function checkpointHarness(execInContainer: jest.Mock, recordGitCheckpoint: jest.Mock) {
    return Object.assign(Object.create(GitService.prototype), {
      sessionsService: { execInContainer },
      apiGatewayClient: {
        recordGitCheckpoint,
        notifyCheckpointCreated: jest.fn(async () => undefined),
      },
      db: {
        prepare: () => ({ run: jest.fn() }),
      },
    });
  }

  async function recordCheckpoint(serviceLike: object) {
    await (
      GitService.prototype as unknown as {
        createCheckpoint: (
          sessionId: string,
          userId: string,
          messageNumber: number,
          commitHash: string,
          description: string,
          filesChanged?: number,
        ) => Promise<void>;
      }
    ).createCheckpoint.call(serviceLike, SESSION_ID, USER_ID, 4, commitHash, 'Checkpoint', 1);
  }

  it('points refs/checkpoints at the commit before recording it', async () => {
    const order: string[] = [];
    const execInContainer = jest.fn(async () => {
      order.push('ref');
      return { exitCode: 0, stdout: '', stderr: '' };
    });
    const recordGitCheckpoint = jest.fn(async () => {
      order.push('record');
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await recordCheckpoint(checkpointHarness(execInContainer, recordGitCheckpoint));

      expect(execInContainer).toHaveBeenCalledWith(
        SESSION_ID,
        ['sh', '-lc', 'git update-ref "refs/checkpoints/$COMMIT_HASH" "$COMMIT_HASH"'],
        '/workspace',
        { COMMIT_HASH: commitHash },
      );
      expect(order).toEqual(['ref', 'record']);
      expect(recordGitCheckpoint).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        commitHash,
        filesChanged: 1,
        messageNumber: 4,
        description: 'Checkpoint',
      });
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('logs a checkpoint ref failure and still records the checkpoint', async () => {
    const order: string[] = [];
    const execInContainer = jest.fn(async () => {
      order.push('ref');
      return { exitCode: 1, stdout: '', stderr: 'fatal: cannot update ref' };
    });
    const recordGitCheckpoint = jest.fn(async () => {
      order.push('record');
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await recordCheckpoint(checkpointHarness(execInContainer, recordGitCheckpoint));

      expect(order).toEqual(['ref', 'record']);
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to create checkpoint ref:',
        'fatal: cannot update ref',
      );
      expect(recordGitCheckpoint).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('logs a thrown checkpoint ref failure and still records the checkpoint', async () => {
    const execInContainer = jest.fn(async () => {
      throw new Error('container down');
    });
    const recordGitCheckpoint = jest.fn(async () => undefined);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await recordCheckpoint(checkpointHarness(execInContainer, recordGitCheckpoint));

      expect(consoleError).toHaveBeenCalledWith('Failed to create checkpoint ref:', 'container down');
      expect(recordGitCheckpoint).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe('GitService checkpoint history', () => {
  beforeEach(() => {
    fsFn(fs.mkdir).mockReset().mockResolvedValue(undefined);
    fsFn(fs.copyFile).mockReset().mockResolvedValue(undefined);
    fsFn(fs.rename).mockReset().mockResolvedValue(undefined);
    fsFn(fs.unlink).mockReset().mockResolvedValue(undefined);
    fsFn(fs.stat).mockReset().mockResolvedValue({ size: 4096, isFile: () => true });
  });

  it('skips save when the workspace has no repository', async () => {
    const execInContainer = jest.fn(async (_sessionId: string, cmd: string[]) => {
      const command = cmd[2];
      if (command === 'git rev-parse --is-inside-work-tree') {
        return {
          exitCode: 128,
          stdout: '',
          stderr: 'fatal: not a git repository (or any of the parent directories): .git',
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const result = await callHistory(
      'saveProjectHistory',
      historyHarness(execInContainer),
      SESSION_ID,
      PROJECT_ID,
    );

    expect(result).toEqual({ status: 'skipped' });
    expect(execInContainer).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it('skips save when the repository has no commit', async () => {
    const execInContainer = jest.fn(async (_sessionId: string, cmd: string[]) => {
      const command = cmd[2];
      if (command === 'git rev-parse --is-inside-work-tree') {
        return { exitCode: 0, stdout: 'true\n', stderr: '' };
      }
      if (command === 'git rev-parse --verify HEAD') {
        return { exitCode: 128, stdout: '', stderr: 'fatal: Needed a single revision' };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const result = await callHistory(
      'saveProjectHistory',
      historyHarness(execInContainer),
      SESSION_ID,
      PROJECT_ID,
    );

    expect(result).toEqual({ status: 'skipped' });
    expect(execInContainer).not.toHaveBeenCalledWith(
      SESSION_ID,
      ['sh', '-lc', `git bundle create ${CONTAINER_HISTORY_BUNDLE} --all`],
      '/workspace',
    );
    expect(fs.copyFile).not.toHaveBeenCalled();
  });

  it('saves a bundle through a temporary file in the history directory', async () => {
    const execInContainer = jest.fn(async (_sessionId: string, cmd: string[]) => {
      const command = cmd[2];
      if (command === 'git rev-parse --is-inside-work-tree') {
        return { exitCode: 0, stdout: 'true\n', stderr: '' };
      }
      if (command === 'git rev-parse --verify HEAD') {
        return { exitCode: 0, stdout: `${BRANCH_HEAD}\n`, stderr: '' };
      }
      if (command === `git bundle create ${CONTAINER_HISTORY_BUNDLE} --all`) {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      if (command === `rm -f ${CONTAINER_HISTORY_BUNDLE}`) {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const result = await callHistory(
      'saveProjectHistory',
      historyHarness(execInContainer),
      SESSION_ID,
      PROJECT_ID,
    );

    const hostBundle = path.join(workspaceFor(SESSION_ID), '.git', 'aisb-history.bundle');
    const historyDir = path.join(__dirname, '../../../..', 'projects', '_checkpoint-history');
    const [tempPath, destPath] = fsFn(fs.rename).mock.calls[0];
    expect(result).toEqual({ status: 'saved', bytes: 4096 });
    expect(path.dirname(String(tempPath))).toBe(historyDir);
    expect(path.dirname(String(destPath))).toBe(historyDir);
    expect(String(tempPath).endsWith('.tmp')).toBe(true);
    expect(String(tempPath)).toContain(PROJECT_ID);
    expect(destPath).toBe(path.join(historyDir, `${PROJECT_ID}.bundle`));
    expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(String(destPath)), { recursive: true });
    expect(fs.copyFile).toHaveBeenCalledWith(hostBundle, tempPath);
    expect(fs.stat).toHaveBeenCalledWith(tempPath);
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(execInContainer).toHaveBeenCalledWith(
      SESSION_ID,
      ['sh', '-lc', `rm -f ${CONTAINER_HISTORY_BUNDLE}`],
      '/workspace',
    );
  });

  it('removes the save bundle when bundle creation fails', async () => {
    const execInContainer = jest.fn(async (_sessionId: string, cmd: string[]) => {
      const command = cmd[2];
      if (command === 'git rev-parse --is-inside-work-tree') {
        return { exitCode: 0, stdout: 'true\n', stderr: '' };
      }
      if (command === 'git rev-parse --verify HEAD') {
        return { exitCode: 0, stdout: `${BRANCH_HEAD}\n`, stderr: '' };
      }
      if (command === `git bundle create ${CONTAINER_HISTORY_BUNDLE} --all`) {
        return { exitCode: 1, stdout: '', stderr: 'fatal: bundle create failed' };
      }
      if (command === `rm -f ${CONTAINER_HISTORY_BUNDLE}`) {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(
      callHistory('saveProjectHistory', historyHarness(execInContainer), SESSION_ID, PROJECT_ID),
    ).rejects.toThrow('fatal: bundle create failed');

    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(fs.rename).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(execInContainer).toHaveBeenCalledWith(
      SESSION_ID,
      ['sh', '-lc', `rm -f ${CONTAINER_HISTORY_BUNDLE}`],
      '/workspace',
    );
  });

  it('returns none when no bundle is stored', async () => {
    fsFn(fs.stat).mockRejectedValue(enoent());
    const execInContainer = jest.fn(async () => {
      throw new Error('exec should not run');
    });

    const result = await callHistory(
      'restoreProjectHistory',
      historyHarness(execInContainer),
      SESSION_ID,
      PROJECT_ID,
    );

    expect(result).toEqual({ status: 'none' });
    expect(execInContainer).not.toHaveBeenCalled();
    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('restores a branch HEAD, resets the index only, and removes both temporary bundles', async () => {
    const execInContainer = restoreExec({
      heads: `${BRANCH_HEAD} refs/heads/main\n${BRANCH_HEAD} HEAD\n`,
    });

    const result = await callHistory(
      'restoreProjectHistory',
      historyHarness(execInContainer),
      SESSION_ID,
      PROJECT_ID,
    );

    expect(result).toEqual({ status: 'restored', head: BRANCH_HEAD });
    expect(fs.copyFile).toHaveBeenCalledWith(
      path.join(__dirname, '../../../..', 'projects', '_checkpoint-history', `${PROJECT_ID}.bundle`),
      path.join(workspaceFor(SESSION_ID), '.aisb-history-restore.bundle'),
    );
    expect(execInContainer).toHaveBeenNthCalledWith(
      1,
      SESSION_ID,
      ['sh', '-lc', CHECK_REPO_COMMAND],
      '/workspace',
    );
    expect(execInContainer).toHaveBeenCalledWith(
      SESSION_ID,
      ['sh', '-lc', `git bundle list-heads ${CONTAINER_RESTORE_BUNDLE}`],
      '/workspace',
    );
    expect(execInContainer).toHaveBeenCalledWith(
      SESSION_ID,
      ['sh', '-lc', FETCH_COMMAND],
      '/workspace',
    );
    expect(execInContainer).toHaveBeenCalledWith(
      SESSION_ID,
      ['sh', '-lc', 'git symbolic-ref HEAD "$BRANCH_REF"'],
      '/workspace',
      { BRANCH_REF: 'refs/heads/main' },
    );
    expect(execInContainer).not.toHaveBeenCalledWith(
      SESSION_ID,
      ['sh', '-lc', 'git update-ref --no-deref HEAD "$COMMIT_HASH"'],
      '/workspace',
      expect.anything(),
    );
    assertIndexOnlyReset(execInContainer);
    assertRestoreBundlesRemoved(execInContainer);
  });

  it('restores a detached HEAD without moving the working tree, and removes temporary bundles', async () => {
    const execInContainer = restoreExec({
      heads: `${DETACHED_HEAD} HEAD\n${BRANCH_HEAD} refs/heads/main\n`,
    });

    const result = await callHistory(
      'restoreProjectHistory',
      historyHarness(execInContainer),
      SESSION_ID,
      PROJECT_ID,
    );

    expect(result).toEqual({ status: 'restored', head: DETACHED_HEAD });
    expect(execInContainer).toHaveBeenCalledWith(
      SESSION_ID,
      ['sh', '-lc', 'git update-ref --no-deref HEAD "$COMMIT_HASH"'],
      '/workspace',
      { COMMIT_HASH: DETACHED_HEAD },
    );
    expect(execInContainer).not.toHaveBeenCalledWith(
      SESSION_ID,
      ['sh', '-lc', 'git symbolic-ref HEAD "$BRANCH_REF"'],
      '/workspace',
      expect.anything(),
    );
    assertIndexOnlyReset(execInContainer);
    assertRestoreBundlesRemoved(execInContainer);
  });

  it('removes restore bundles when fetch fails', async () => {
    const execInContainer = jest.fn(async (_sessionId: string, cmd: string[]) => {
      const command = cmd[2];
      if (command === CHECK_REPO_COMMAND) {
        return { exitCode: 0, stdout: 'true\n', stderr: '' };
      }
      if (command === `git bundle list-heads ${CONTAINER_RESTORE_BUNDLE}`) {
        return { exitCode: 0, stdout: `${BRANCH_HEAD} HEAD\n${BRANCH_HEAD} refs/heads/main\n`, stderr: '' };
      }
      if (command === FETCH_COMMAND) {
        return { exitCode: 1, stdout: '', stderr: 'fatal: fetch failed' };
      }
      if (command === `rm -f ${CONTAINER_RESTORE_BUNDLE}`) {
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(
      callHistory('restoreProjectHistory', historyHarness(execInContainer), SESSION_ID, PROJECT_ID),
    ).rejects.toThrow('fatal: fetch failed');

    expect(execInContainer).not.toHaveBeenCalledWith(SESSION_ID, ['sh', '-lc', 'git reset -q'], '/workspace');
    assertRestoreBundlesRemoved(execInContainer);
  });

  it('rejects invalid ids before exec or files', async () => {
    const cases: Array<['saveProjectHistory' | 'restoreProjectHistory', string, string]> = [
      ['saveProjectHistory', 'not-a-uuid', PROJECT_ID],
      ['saveProjectHistory', SESSION_ID, '../escaped'],
      ['restoreProjectHistory', 'not-a-uuid', PROJECT_ID],
      ['restoreProjectHistory', SESSION_ID, 'project-1'],
    ];

    for (const [method, sessionId, projectId] of cases) {
      fsFn(fs.stat).mockClear();
      fsFn(fs.mkdir).mockClear();
      fsFn(fs.copyFile).mockClear();
      const execInContainer = jest.fn(async () => {
        throw new Error('exec should not run');
      });

      await expect(
        callHistory(method, historyHarness(execInContainer), sessionId, projectId),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(execInContainer).not.toHaveBeenCalled();
      expect(fs.stat).not.toHaveBeenCalled();
      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.copyFile).not.toHaveBeenCalled();
    }
  });
});

function restoreExec(options: { heads: string }): jest.Mock {
  return jest.fn(async (_sessionId: string, cmd: string[]) => {
    const command = cmd[2];
    if (command === CHECK_REPO_COMMAND) {
      return { exitCode: 0, stdout: 'true\n', stderr: '' };
    }
    if (command === `git bundle list-heads ${CONTAINER_RESTORE_BUNDLE}`) {
      return { exitCode: 0, stdout: options.heads, stderr: '' };
    }
    if (command === FETCH_COMMAND) {
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    if (
      command === 'git symbolic-ref HEAD "$BRANCH_REF"' ||
      command === 'git update-ref --no-deref HEAD "$COMMIT_HASH"'
    ) {
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    if (command === 'git reset -q') {
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    if (command === `rm -f ${CONTAINER_RESTORE_BUNDLE}`) {
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    throw new Error(`Unexpected command: ${command}`);
  });
}

function assertIndexOnlyReset(execInContainer: jest.Mock) {
  const commands = execInContainer.mock.calls.map((call) => String(call[1][2]));
  expect(commands).toContain('git reset -q');
  for (const command of commands) {
    expect(command).not.toContain('--hard');
    expect(command).not.toContain('git clean');
    expect(command).not.toContain('checkout');
  }
  expect(execInContainer).toHaveBeenCalledWith(SESSION_ID, ['sh', '-lc', 'git reset -q'], '/workspace');
}

function assertRestoreBundlesRemoved(execInContainer: jest.Mock) {
  const hostRestore = path.join(workspaceFor(SESSION_ID), '.aisb-history-restore.bundle');
  expect(fs.unlink).toHaveBeenCalledWith(hostRestore);
  const removed = fsFn(fs.unlink).mock.calls.map((call) => String(call[0]));
  expect(removed.every((filePath) => filePath.endsWith('.aisb-history-restore.bundle'))).toBe(true);
  expect(execInContainer).toHaveBeenCalledWith(
    SESSION_ID,
    ['sh', '-lc', `rm -f ${CONTAINER_RESTORE_BUNDLE}`],
    '/workspace',
  );
}
