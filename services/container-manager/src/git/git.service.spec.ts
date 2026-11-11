import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { constants as fsConstants } from 'fs';
import { Readable } from 'stream';
import { EXEC_OUTPUT_MAX_BYTES } from '../docker/docker-runtime.service';
import {
  GitService,
  HISTORY_BUNDLE_BLOCK_BYTES,
  HISTORY_BUNDLE_CHUNK_BLOCKS,
  HISTORY_BUNDLE_CHUNK_COMMAND,
  HISTORY_BUNDLE_SIZE_COMMAND,
  HISTORY_RESTORE_STAGE_COMMAND,
  WORKTREE_DIFF_MAX_CHARS,
  WORKTREE_DIFF_TRUNCATED_MARKER,
} from './git.service';

jest.mock('fs/promises', () => {
  const actual = jest.requireActual('fs/promises') as typeof import('fs/promises');
  return {
    ...actual,
    mkdir: jest.fn(),
    copyFile: jest.fn(),
    open: jest.fn(),
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

// CM-HISTORY-LINK-01: host files are created exclusively and never follow a link.
const EXCLUSIVE_CREATE_FLAGS =
  fsConstants.O_WRONLY |
  fsConstants.O_CREAT |
  fsConstants.O_EXCL |
  (typeof fsConstants.O_NOFOLLOW === 'number' ? fsConstants.O_NOFOLLOW : 0);
const SAVED_BUNDLE_BYTES = Buffer.from('# v2 git bundle\nsaved-bytes\u0000ÿ\u0080end\n', 'latin1');
const STORED_BUNDLE_BYTES = Buffer.from('# v2 git bundle\nstored-bytes\u0000þ\n', 'latin1');
const STORED_BUNDLE_PATH = path.join(
  __dirname,
  '../../../..',
  'projects',
  '_checkpoint-history',
  `${PROJECT_ID}.bundle`,
);

interface HostFiles {
  written: Map<string, Buffer[]>;
}

let hostFiles: HostFiles = { written: new Map() };

function fakeHostOpen() {
  hostFiles = { written: new Map() };
  return async (filePath: string, flags: string | number) => {
    if (flags === 'r') {
      let position = 0;
      return {
        read: jest.fn(async (buffer: Buffer, offset: number, length: number) => {
          const count = Math.min(length, STORED_BUNDLE_BYTES.length - position);
          STORED_BUNDLE_BYTES.copy(buffer, offset, position, position + count);
          position += count;
          return { bytesRead: count, buffer };
        }),
        close: jest.fn(async () => undefined),
      };
    }
    const sink: Buffer[] = [];
    hostFiles.written.set(String(filePath), sink);
    return {
      write: jest.fn(async (buffer: Buffer, offset: number, length: number) => {
        sink.push(Buffer.from(buffer.subarray(offset, offset + length)));
        return { bytesWritten: length, buffer };
      }),
      close: jest.fn(async () => undefined),
    };
  };
}

function writtenTo(filePath: string): Buffer {
  return Buffer.concat(hostFiles.written.get(filePath) ?? []);
}

function saveBundleExec(command: string) {
  if (command === HISTORY_BUNDLE_SIZE_COMMAND) {
    return { exitCode: 0, stdout: `${SAVED_BUNDLE_BYTES.length}\n`, stderr: '' };
  }
  if (command === HISTORY_BUNDLE_CHUNK_COMMAND) {
    return { exitCode: 0, stdout: `${SAVED_BUNDLE_BYTES.toString('base64')}\n`, stderr: '' };
  }
  return null;
}

type StageExec = jest.Mock<any> & { received: () => Buffer };

/**
 * CM-EXEC-01: the stdin exec the restore stages its bundle through. It reads
 * the input to the end, as cat would, and answers like
 * HISTORY_RESTORE_STAGE_COMMAND: the byte count that landed (or a refusal).
 */
function stageExec(
  options: { exitCode?: number; stderr?: string; landed?: (sent: number) => number } = {},
): StageExec {
  const received: Buffer[] = [];
  const fn = jest.fn(async (_sessionId: string, _cmd: string[], input: Readable) => {
    for await (const chunk of input) {
      received.push(Buffer.from(chunk as Buffer));
    }
    const sent = Buffer.concat(received).length;
    if (options.exitCode && options.exitCode !== 0) {
      return { exitCode: options.exitCode, stdout: '', stderr: options.stderr ?? '' };
    }
    const landed = options.landed ? options.landed(sent) : sent;
    return { exitCode: 0, stdout: `${landed}\n`, stderr: '' };
  }) as StageExec;
  fn.received = () => Buffer.concat(received);
  return fn;
}

function historyHarness(execInContainer: jest.Mock, execInContainerWithStdin: jest.Mock = stageExec()) {
  return Object.assign(Object.create(GitService.prototype), {
    sessionsService: {
      execInContainer,
      execInContainerWithStdin,
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
    fsFn(fs.open).mockReset().mockImplementation(fakeHostOpen());
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
    expect(fs.open).not.toHaveBeenCalled();
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
    expect(fs.open).not.toHaveBeenCalled();
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
      const bundle = saveBundleExec(command);
      if (bundle) {
        return bundle;
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

    const historyDir = path.join(__dirname, '../../../..', 'projects', '_checkpoint-history');
    const [tempPath, destPath] = fsFn(fs.rename).mock.calls[0];
    expect(result).toEqual({ status: 'saved', bytes: 4096 });
    expect(path.dirname(String(tempPath))).toBe(historyDir);
    expect(path.dirname(String(destPath))).toBe(historyDir);
    expect(String(tempPath).endsWith('.tmp')).toBe(true);
    expect(String(tempPath)).toContain(PROJECT_ID);
    expect(destPath).toBe(path.join(historyDir, `${PROJECT_ID}.bundle`));
    expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(String(destPath)), { recursive: true });
    // CM-HISTORY-LINK-01: the bytes come through docker exec, not a host copy.
    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(fs.open).toHaveBeenCalledTimes(1);
    expect(fs.open).toHaveBeenCalledWith(tempPath, EXCLUSIVE_CREATE_FLAGS, 0o644);
    expect(writtenTo(String(tempPath)).equals(SAVED_BUNDLE_BYTES)).toBe(true);
    expect(execInContainer).toHaveBeenCalledWith(
      SESSION_ID,
      ['sh', '-lc', HISTORY_BUNDLE_SIZE_COMMAND],
      '/workspace',
    );
    expect(execInContainer).toHaveBeenCalledWith(
      SESSION_ID,
      ['sh', '-lc', HISTORY_BUNDLE_CHUNK_COMMAND],
      '/workspace',
      { SKIP_BLOCKS: '0', COUNT_BLOCKS: '8' },
    );
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
    expect(fs.open).not.toHaveBeenCalled();
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
    expect(fs.open).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('restores a branch HEAD, resets the index only, and removes both temporary bundles', async () => {
    const execInContainer = restoreExec({
      heads: `${BRANCH_HEAD} refs/heads/main\n${BRANCH_HEAD} HEAD\n`,
    });

    const execInContainerWithStdin = stageExec();

    const result = await callHistory(
      'restoreProjectHistory',
      historyHarness(execInContainer, execInContainerWithStdin),
      SESSION_ID,
      PROJECT_ID,
    );

    expect(result).toEqual({ status: 'restored', head: BRANCH_HEAD });
    // CM-EXEC-01: the stored bundle is only read on the host and piped into
    // the container, which stages it; the host writes nothing.
    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(fsFn(fs.open).mock.calls).toEqual([[STORED_BUNDLE_PATH, 'r']]);
    expect(hostFiles.written.size).toBe(0);
    expect(execInContainerWithStdin).toHaveBeenCalledTimes(1);
    expect(execInContainerWithStdin).toHaveBeenCalledWith(
      SESSION_ID,
      ['sh', '-lc', HISTORY_RESTORE_STAGE_COMMAND],
      expect.any(Readable),
      '/workspace',
    );
    expect(execInContainerWithStdin.received().equals(STORED_BUNDLE_BYTES)).toBe(true);
    expect(execInContainerWithStdin.mock.invocationCallOrder[0]).toBeLessThan(
      execInContainer.mock.invocationCallOrder[0],
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
      fsFn(fs.open).mockClear();
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
      expect(fs.open).not.toHaveBeenCalled();
    }
  });

  describe('CM-HISTORY-LINK-01: the bundle crosses through docker exec, checked', () => {
    function saveExec(overrides: Record<string, { exitCode: number; stdout: string; stderr: string }>) {
      return jest.fn(async (_sessionId: string, cmd: string[]) => {
        const command = cmd[2];
        if (overrides[command]) {
          return overrides[command];
        }
        if (command === 'git rev-parse --is-inside-work-tree') {
          return { exitCode: 0, stdout: 'true\n', stderr: '' };
        }
        if (command === 'git rev-parse --verify HEAD') {
          return { exitCode: 0, stdout: `${BRANCH_HEAD}\n`, stderr: '' };
        }
        if (command === `git bundle create ${CONTAINER_HISTORY_BUNDLE} --all`) {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        const bundle = saveBundleExec(command);
        if (bundle) {
          return bundle;
        }
        if (command === `rm -f ${CONTAINER_HISTORY_BUNDLE}`) {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });
    }

    it('pins the container commands: a symlink or non-file bundle is refused, slices are bounded', () => {
      expect(HISTORY_BUNDLE_SIZE_COMMAND).toBe(
        `[ -f ${CONTAINER_HISTORY_BUNDLE} ] && [ ! -L ${CONTAINER_HISTORY_BUNDLE} ] && wc -c < ${CONTAINER_HISTORY_BUNDLE}`,
      );
      expect(HISTORY_BUNDLE_CHUNK_COMMAND).toBe(
        `dd if=${CONTAINER_HISTORY_BUNDLE} bs=1048576 skip="$SKIP_BLOCKS" count="$COUNT_BLOCKS" 2>/dev/null | base64`,
      );
    });

    it('never opens, stats or copies a path inside the workspace while saving', async () => {
      const execInContainer = saveExec({});
      await callHistory('saveProjectHistory', historyHarness(execInContainer), SESSION_ID, PROJECT_ID);

      const workspace = workspaceFor(SESSION_ID);
      const touched = [fs.open, fs.stat, fs.copyFile, fs.mkdir, fs.rename, fs.unlink].flatMap((fn) =>
        fsFn(fn).mock.calls.flatMap((call) => call.filter((arg) => typeof arg === 'string')),
      );
      expect(touched.length).toBeGreaterThan(0);
      for (const filePath of touched) {
        expect(String(filePath).startsWith(workspace)).toBe(false);
      }
    });

    it('reads a large bundle in bounded slices and keeps every byte', async () => {
      const size = 8 * 1024 * 1024 * 2 + 5;
      const bytes = Buffer.alloc(size);
      for (let index = 0; index < size; index += 1) {
        bytes[index] = (index * 31 + 7) & 0xff;
      }
      const execInContainer = jest.fn(async (_sessionId: string, cmd: string[], _cwd: string, env?: any) => {
        const command = cmd[2];
        if (command === HISTORY_BUNDLE_SIZE_COMMAND) {
          return { exitCode: 0, stdout: `${size}\n`, stderr: '' };
        }
        if (command === HISTORY_BUNDLE_CHUNK_COMMAND) {
          const start = Number(env.SKIP_BLOCKS) * 1024 * 1024;
          const slice = bytes.subarray(start, start + Number(env.COUNT_BLOCKS) * 1024 * 1024);
          // base64 wraps lines at 76 characters, as busybox and coreutils do.
          const wrapped = slice.toString('base64').replace(/(.{76})/g, '$1\n');
          return { exitCode: 0, stdout: `${wrapped}\n`, stderr: '' };
        }
        return saveExec({})(_sessionId, cmd);
      });

      await callHistory('saveProjectHistory', historyHarness(execInContainer), SESSION_ID, PROJECT_ID);

      const [tempPath] = fsFn(fs.rename).mock.calls[0];
      expect(writtenTo(String(tempPath)).equals(bytes)).toBe(true);
      const slices = execInContainer.mock.calls
        .filter((call) => call[1][2] === HISTORY_BUNDLE_CHUNK_COMMAND)
        .map((call) => call[3]);
      expect(slices).toEqual([
        { SKIP_BLOCKS: '0', COUNT_BLOCKS: '8' },
        { SKIP_BLOCKS: '8', COUNT_BLOCKS: '8' },
        { SKIP_BLOCKS: '16', COUNT_BLOCKS: '8' },
      ]);
    });

    it('refuses the save when the container refuses the bundle (symlink or not a file), and cleans up', async () => {
      const execInContainer = saveExec({
        [HISTORY_BUNDLE_SIZE_COMMAND]: { exitCode: 1, stdout: '', stderr: '' },
      });
      await expect(
        callHistory('saveProjectHistory', historyHarness(execInContainer), SESSION_ID, PROJECT_ID),
      ).rejects.toThrow('Failed to read history bundle');
      expect(fs.open).not.toHaveBeenCalled();
      expect(fs.rename).not.toHaveBeenCalled();
      expect(execInContainer).toHaveBeenCalledWith(
        SESSION_ID,
        ['sh', '-lc', `rm -f ${CONTAINER_HISTORY_BUNDLE}`],
        '/workspace',
      );
    });

    it.each([
      ['a short slice', Buffer.from('short').toString('base64')],
      ['a long slice', Buffer.concat([SAVED_BUNDLE_BYTES, Buffer.from('x')]).toString('base64')],
      ['text that is not base64', 'not base64 at all!'],
    ])('refuses %s, removes the temporary file and stores nothing', async (_name, stdout) => {
      const execInContainer = saveExec({
        [HISTORY_BUNDLE_CHUNK_COMMAND]: { exitCode: 0, stdout, stderr: '' },
      });
      await expect(
        callHistory('saveProjectHistory', historyHarness(execInContainer), SESSION_ID, PROJECT_ID),
      ).rejects.toThrow('History bundle changed while it was read');
      const [tempPath] = fsFn(fs.open).mock.calls[0];
      expect(fs.rename).not.toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalledWith(tempPath);
    });

    it('pins the restore staging command: remove the old entry, create exclusively, report the size', () => {
      expect(HISTORY_RESTORE_STAGE_COMMAND).toBe(
        `rm -f ${CONTAINER_RESTORE_BUNDLE} && set -C && cat > ${CONTAINER_RESTORE_BUNDLE} && wc -c < ${CONTAINER_RESTORE_BUNDLE}`,
      );
    });

    it('keeps every save slice, in base64 with line breaks, under the exec output cap', () => {
      const sliceBytes = HISTORY_BUNDLE_BLOCK_BYTES * HISTORY_BUNDLE_CHUNK_BLOCKS;
      const base64Chars = Math.ceil(sliceBytes / 3) * 4;
      const withNewlines = base64Chars + Math.ceil(base64Chars / 76);
      expect(withNewlines).toBeLessThan(EXEC_OUTPUT_MAX_BYTES);
    });

    it.each([
      [
        'an entry planted after the rm (noclobber)',
        "sh: can't create /workspace/.aisb-history-restore.bundle: File exists",
      ],
      [
        'a directory at the restore path',
        "rm: can't remove '/workspace/.aisb-history-restore.bundle': Is a directory",
      ],
    ])('fails the restore when the container refuses to stage the bundle: %s', async (_name, stderr) => {
      const execInContainer = restoreExec({ heads: `${BRANCH_HEAD} HEAD\n` });

      await expect(
        callHistory(
          'restoreProjectHistory',
          historyHarness(execInContainer, stageExec({ exitCode: 1, stderr })),
          SESSION_ID,
          PROJECT_ID,
        ),
      ).rejects.toThrow(stderr);
      expect(execInContainer).not.toHaveBeenCalledWith(
        SESSION_ID,
        ['sh', '-lc', `git bundle list-heads ${CONTAINER_RESTORE_BUNDLE}`],
        '/workspace',
      );
      expect(execInContainer).not.toHaveBeenCalledWith(SESSION_ID, ['sh', '-lc', FETCH_COMMAND], '/workspace');
      expect(hostFiles.written.size).toBe(0);
      assertRestoreBundlesRemoved(execInContainer);
    });

    it('fails with a fallback message when the staging refusal has no stderr', async () => {
      const execInContainer = restoreExec({ heads: `${BRANCH_HEAD} HEAD\n` });
      await expect(
        callHistory(
          'restoreProjectHistory',
          historyHarness(execInContainer, stageExec({ exitCode: 2 })),
          SESSION_ID,
          PROJECT_ID,
        ),
      ).rejects.toThrow('Failed to stage history bundle');
      assertRestoreBundlesRemoved(execInContainer);
    });

    it.each([
      ['fewer bytes', (sent: number) => sent - 1],
      ['more bytes', (sent: number) => sent + 1],
    ])('fails the restore when the container reports %s than were sent', async (_name, landed) => {
      const execInContainer = restoreExec({ heads: `${BRANCH_HEAD} HEAD\n` });
      await expect(
        callHistory(
          'restoreProjectHistory',
          historyHarness(execInContainer, stageExec({ landed })),
          SESSION_ID,
          PROJECT_ID,
        ),
      ).rejects.toThrow('History bundle was not staged in full');
      expect(execInContainer).not.toHaveBeenCalledWith(SESSION_ID, ['sh', '-lc', FETCH_COMMAND], '/workspace');
      assertRestoreBundlesRemoved(execInContainer);
    });

    it('fails the restore, closes the stored bundle and cleans up when the stdin exec throws', async () => {
      const close = jest.fn(async () => undefined);
      fsFn(fs.open).mockImplementation(async () => ({
        read: jest.fn(async () => ({ bytesRead: 0 })),
        close,
      }));
      const execInContainer = restoreExec({ heads: `${BRANCH_HEAD} HEAD\n` });
      const failing = jest.fn(async () => {
        throw new Error('exec stdout output exceeded 16777216 bytes');
      });

      await expect(
        callHistory('restoreProjectHistory', historyHarness(execInContainer, failing), SESSION_ID, PROJECT_ID),
      ).rejects.toThrow('exec stdout output exceeded 16777216 bytes');
      expect(close).toHaveBeenCalledTimes(1);
      assertRestoreBundlesRemoved(execInContainer);
    });

    it('streams a large stored bundle in bounded reads and every byte reaches the container', async () => {
      const size = 3 * 1024 * 1024 + 7;
      const stored = Buffer.alloc(size);
      for (let index = 0; index < size; index += 1) {
        stored[index] = (index * 13 + 1) & 0xff;
      }
      const readLengths: number[] = [];
      let position = 0;
      fsFn(fs.open).mockImplementation(async (_filePath: string, flags: string | number) => {
        expect(flags).toBe('r');
        return {
          read: jest.fn(async (buffer: Buffer, offset: number, length: number) => {
            readLengths.push(length);
            const count = Math.min(length, size - position);
            stored.copy(buffer, offset, position, position + count);
            position += count;
            return { bytesRead: count, buffer };
          }),
          close: jest.fn(async () => undefined),
        };
      });
      const execInContainerWithStdin = stageExec();

      await expect(
        callHistory(
          'restoreProjectHistory',
          historyHarness(restoreExec({ heads: `${BRANCH_HEAD} HEAD\n` }), execInContainerWithStdin),
          SESSION_ID,
          PROJECT_ID,
        ),
      ).resolves.toEqual({ status: 'restored', head: BRANCH_HEAD });
      expect(execInContainerWithStdin.received().equals(stored)).toBe(true);
      expect(Math.max(...readLengths)).toBe(1024 * 1024);
      expect(readLengths).toHaveLength(5);
    });

    it('opens, creates or removes no path inside the workspace on the host while restoring', async () => {
      await callHistory(
        'restoreProjectHistory',
        historyHarness(restoreExec({ heads: `${BRANCH_HEAD} refs/heads/main\n${BRANCH_HEAD} HEAD\n` })),
        SESSION_ID,
        PROJECT_ID,
      );
      const workspace = workspaceFor(SESSION_ID);
      const touched = [fs.open, fs.stat, fs.copyFile, fs.mkdir, fs.rename, fs.unlink].flatMap((fn) =>
        fsFn(fn).mock.calls.flatMap((call) => call.filter((arg) => typeof arg === 'string')),
      );
      // fs.open(stored, 'r'), then fs.stat(stored): the history directory only.
      expect(touched).toEqual([STORED_BUNDLE_PATH, 'r', STORED_BUNDLE_PATH]);
      for (const filePath of touched) {
        expect(String(filePath).startsWith(workspace)).toBe(false);
      }
    });

    it('keeps the stored history path', () => {
      const plain = Object.create(GitService.prototype) as { historyBundlePath(id: string): string };
      expect(plain.historyBundlePath(PROJECT_ID)).toBe(STORED_BUNDLE_PATH);
    });
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

const WORKTREE_SESSION = '33333333-3333-4333-8333-333333333333';
const WORKTREE_HASH = 'abc123abc123abc123abc123abc123abc123abcd';

describe('GitService.getWorkingTreeDiff', () => {
  interface WorktreeDiffService {
    getWorkingTreeDiff: (
      sessionId: string,
      commitHash: string,
    ) => Promise<{ commitHash: string; diff: string; truncated: boolean }>;
    createCheckpoint: jest.Mock;
  }

  function serviceWith(execInContainer: jest.Mock, getSession: jest.Mock): WorktreeDiffService {
    const serviceLike = Object.create(GitService.prototype);
    serviceLike.sessionsService = { execInContainer, getSession };
    serviceLike.createCheckpoint = jest.fn();
    return serviceLike as WorktreeDiffService;
  }

  function expectWorktreeDiffReadOnly(execInContainer: jest.Mock): void {
    expect(execInContainer).toHaveBeenCalled();
    for (const call of execInContainer.mock.calls) {
      const command = String(call[1][2]);
      expect(command).not.toMatch(
        /git add|stash|git commit|git reset|git checkout|update-index|update-ref|intent-to-add/,
      );
    }
  }

  function mockWorktreeExec(options: {
    tracked: string;
    untrackedExit?: number;
    untrackedStdout?: string;
  }): jest.Mock {
    return jest.fn(async (_sessionId: string, cmd: string[]) => {
      const command = String(cmd[2]);
      if (command.includes('rev-parse')) {
        return { exitCode: 0, stdout: `${WORKTREE_HASH}\n`, stderr: '' };
      }
      if (command.includes('git ls-files')) {
        return {
          exitCode: options.untrackedExit ?? 0,
          stdout: options.untrackedStdout ?? '',
          stderr: '',
        };
      }
      if (command.includes('git --no-pager diff')) {
        return { exitCode: 0, stdout: options.tracked, stderr: '' };
      }
      throw new Error(`unexpected command ${command}`);
    });
  }

  const TRACKED_DIFF = 'diff --git a/src/form.ts b/src/form.ts\n+fixed\n';

  it('returns the working-tree diff and does not change the repository', async () => {
    const execInContainer = mockWorktreeExec({ tracked: TRACKED_DIFF });
    const getSession = jest.fn(async () => ({ id: WORKTREE_SESSION }));
    const serviceLike = serviceWith(execInContainer, getSession);

    const result = await serviceLike.getWorkingTreeDiff(WORKTREE_SESSION, WORKTREE_HASH);

    expect(result).toEqual({
      commitHash: WORKTREE_HASH,
      diff: TRACKED_DIFF,
      truncated: false,
    });
    expect(getSession).toHaveBeenCalledWith(WORKTREE_SESSION);
    expect(execInContainer).toHaveBeenCalledTimes(3);
    const commands = execInContainer.mock.calls.map((call) => String(call[1][2]));
    expect(commands.slice(0, 2)).toEqual([
      'git rev-parse --verify --quiet "$COMMIT_HASH^{commit}"',
      'git --no-pager diff --no-color --no-ext-diff "$COMMIT_HASH"',
    ]);
    expect(commands[2]).toContain('git ls-files --others --exclude-standard -z');
    expectWorktreeDiffReadOnly(execInContainer);
    expect(serviceLike.createCheckpoint).not.toHaveBeenCalled();
    expect(execInContainer).toHaveBeenNthCalledWith(
      1,
      WORKTREE_SESSION,
      ['sh', '-lc', 'git rev-parse --verify --quiet "$COMMIT_HASH^{commit}"'],
      '/workspace',
      { COMMIT_HASH: WORKTREE_HASH },
    );
  });

  it('caps a long diff and marks it truncated', async () => {
    const huge = `${'x'.repeat(WORKTREE_DIFF_MAX_CHARS + 20)}`;
    const execInContainer = jest.fn(async (_sessionId: string, cmd: string[]) => {
      const command = cmd[2];
      if (command.includes('rev-parse')) {
        return { exitCode: 0, stdout: `${WORKTREE_HASH}\n`, stderr: '' };
      }
      if (command.includes('git ls-files')) {
        throw new Error('untracked listing should not run when the tracked diff is already over the cap');
      }
      return { exitCode: 0, stdout: huge, stderr: '' };
    });
    const result = await serviceWith(
      execInContainer,
      jest.fn(async () => ({ id: WORKTREE_SESSION })),
    ).getWorkingTreeDiff(WORKTREE_SESSION, WORKTREE_HASH);

    expect(result.truncated).toBe(true);
    expect(result.diff.endsWith(WORKTREE_DIFF_TRUNCATED_MARKER)).toBe(true);
    expect(result.diff.length).toBeLessThanOrEqual(WORKTREE_DIFF_MAX_CHARS);
    expect(result.diff.length).toBeGreaterThan(WORKTREE_DIFF_TRUNCATED_MARKER.length);
    expect(execInContainer).toHaveBeenCalledTimes(2);
    expectWorktreeDiffReadOnly(execInContainer);
  });

  it('refuses an invalid hash before any session or git call', async () => {
    const execInContainer = jest.fn();
    const getSession = jest.fn();
    const serviceLike = serviceWith(execInContainer, getSession);

    await expect(
      serviceLike.getWorkingTreeDiff(WORKTREE_SESSION, 'abc123save'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      serviceLike.getWorkingTreeDiff(WORKTREE_SESSION, '$(git commit -am hijack)'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(getSession).not.toHaveBeenCalled();
    expect(execInContainer).not.toHaveBeenCalled();
    expect(serviceLike.createCheckpoint).not.toHaveBeenCalled();
  });

  it('refuses an unknown session and a hash git does not know', async () => {
    const execInContainer = jest.fn(async (_sessionId: string, _cmd: string[]) => ({
      exitCode: 1,
      stdout: '',
      stderr: 'fatal: bad revision',
    }));
    const missing = serviceWith(
      execInContainer,
      jest.fn(async () => {
        throw new NotFoundException('Session not found');
      }),
    );
    await expect(missing.getWorkingTreeDiff(WORKTREE_SESSION, WORKTREE_HASH)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(execInContainer).not.toHaveBeenCalled();

    const unknownHash = serviceWith(
      execInContainer,
      jest.fn(async () => ({ id: WORKTREE_SESSION })),
    );
    await expect(
      unknownHash.getWorkingTreeDiff(WORKTREE_SESSION, WORKTREE_HASH),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(execInContainer).toHaveBeenCalledTimes(1);
    const commands = execInContainer.mock.calls.map((call) => String(call[1][2]));
    expect(commands).toEqual(['git rev-parse --verify --quiet "$COMMIT_HASH^{commit}"']);
    expect(unknownHash.createCheckpoint).not.toHaveBeenCalled();
  });

  it('appends an untracked file as an added-file diff after the tracked diff', async () => {
    const added =
      'diff --git a/dev/null b/created.ts\nnew file mode 100644\n--- /dev/null\n+++ b/created.ts\n+created\n';
    const execInContainer = mockWorktreeExec({ tracked: TRACKED_DIFF, untrackedStdout: added });
    const serviceLike = serviceWith(execInContainer, jest.fn(async () => ({ id: WORKTREE_SESSION })));

    const result = await serviceLike.getWorkingTreeDiff(WORKTREE_SESSION, WORKTREE_HASH);

    expect(result).toEqual({
      commitHash: WORKTREE_HASH,
      diff: TRACKED_DIFF + added,
      truncated: false,
    });
    expect(execInContainer).toHaveBeenCalledTimes(3);
    const script = String(execInContainer.mock.calls[2][1][2]);
    expect(execInContainer.mock.calls[2][1][0]).toBe('sh');
    expect(execInContainer.mock.calls[2][1][1]).toBe('-lc');
    expect(execInContainer.mock.calls[2][2]).toBe('/workspace');
    expect(script).toContain('git --no-pager diff --no-color --no-ext-diff --no-index -- /dev/null "./$path"');
    expect(serviceLike.createCheckpoint).not.toHaveBeenCalled();
    expectWorktreeDiffReadOnly(execInContainer);
  });

  it('asks git to skip ignored files and does not invent a diff for them', async () => {
    const added = 'diff --git a/dev/null b/kept.ts\nnew file mode 100644\n--- /dev/null\n+++ b/kept.ts\n+k\n';
    const execInContainer = mockWorktreeExec({ tracked: TRACKED_DIFF, untrackedStdout: added });
    const result = await serviceWith(
      execInContainer,
      jest.fn(async () => ({ id: WORKTREE_SESSION })),
    ).getWorkingTreeDiff(WORKTREE_SESSION, WORKTREE_HASH);

    const script = String(execInContainer.mock.calls[2][1][2]);
    const listings = script.split('\n').filter((line) => line.includes('git ls-files'));
    expect(listings).toHaveLength(2);
    for (const line of listings) {
      expect(line).toContain('--others');
      expect(line).toContain('--exclude-standard');
      expect(line).toContain('-z');
    }
    expect(result.diff).toBe(TRACKED_DIFF + added);
    expect(result.diff).not.toContain('secret.log');
    expect(script).not.toContain('secret.log');
    expectWorktreeDiffReadOnly(execInContainer);
  });

  it('passes names with a space or a leading dash through a quoted shell variable', async () => {
    const added =
      'diff --git a/dev/null b/my file.txt\nnew file mode 100644\n--- /dev/null\n+++ b/my file.txt\n+a\n' +
      'diff --git a/dev/null b/-new.txt\nnew file mode 100644\n--- /dev/null\n+++ b/-new.txt\n+b\n';
    const execInContainer = mockWorktreeExec({ tracked: TRACKED_DIFF, untrackedStdout: added });
    const result = await serviceWith(
      execInContainer,
      jest.fn(async () => ({ id: WORKTREE_SESSION })),
    ).getWorkingTreeDiff(WORKTREE_SESSION, WORKTREE_HASH);

    const script = String(execInContainer.mock.calls[2][1][2]);
    expect(result.diff).toBe(TRACKED_DIFF + added);
    expect(result.diff.indexOf('my file.txt')).toBeGreaterThan(result.diff.indexOf('+fixed'));
    expect(result.diff.indexOf('-new.txt')).toBeGreaterThan(result.diff.indexOf('my file.txt'));
    expect(script).toContain("while IFS= read -r -d '' path");
    expect(script).toContain('-- /dev/null "./$path"');
    expect(script).not.toContain('my file.txt');
    expect(script).not.toContain('-new.txt');
    expect(execInContainer.mock.calls[2][3]).toEqual({
      DIFF_BUDGET: String(WORKTREE_DIFF_MAX_CHARS - TRACKED_DIFF.length + 1),
    });
    expect(Object.keys(execInContainer.mock.calls[2][3] as object)).toEqual(['DIFF_BUDGET']);
    expectWorktreeDiffReadOnly(execInContainer);
  });

  it('keeps a binary new file as the name git prints', async () => {
    const binary = 'Binary files /dev/null and "b/pixel.bin" differ\n';
    const execInContainer = mockWorktreeExec({ tracked: TRACKED_DIFF, untrackedStdout: binary });
    const result = await serviceWith(
      execInContainer,
      jest.fn(async () => ({ id: WORKTREE_SESSION })),
    ).getWorkingTreeDiff(WORKTREE_SESSION, WORKTREE_HASH);

    const script = String(execInContainer.mock.calls[2][1][2]);
    expect(result.diff).toBe(TRACKED_DIFF + binary);
    expect(result.diff).not.toContain('\0');
    expect(script).not.toContain('--text');
    expect(script).not.toContain('--binary');
    expect(script).not.toContain('cat "$path"');
    expect(script).not.toContain('cat "./$path"');
    expectWorktreeDiffReadOnly(execInContainer);
  });

  it('caps a large new file and marks the combined diff truncated', async () => {
    const budget = WORKTREE_DIFF_MAX_CHARS - TRACKED_DIFF.length + 1;
    const execInContainer = mockWorktreeExec({
      tracked: TRACKED_DIFF,
      untrackedStdout: 'y'.repeat(budget + 100),
    });
    const result = await serviceWith(
      execInContainer,
      jest.fn(async () => ({ id: WORKTREE_SESSION })),
    ).getWorkingTreeDiff(WORKTREE_SESSION, WORKTREE_HASH);

    const script = String(execInContainer.mock.calls[2][1][2]);
    expect(result.truncated).toBe(true);
    expect(result.diff.startsWith('diff --git a/src/form.ts')).toBe(true);
    expect(result.diff.endsWith(WORKTREE_DIFF_TRUNCATED_MARKER)).toBe(true);
    expect(result.diff.length).toBeLessThanOrEqual(WORKTREE_DIFF_MAX_CHARS);
    expect(script).toContain('head -c "$remain"');
    expect(script).toContain('if [ "$remain" -le 0 ]; then');
    expect(script).not.toContain(String(budget));
    expect(execInContainer.mock.calls[2][3]).toEqual({ DIFF_BUDGET: String(budget) });
    expectWorktreeDiffReadOnly(execInContainer);
  });

  it('returns the tracked diff when the untracked listing fails', async () => {
    const execInContainer = mockWorktreeExec({
      tracked: TRACKED_DIFF,
      untrackedExit: 2,
      untrackedStdout: 'diff --git a/LEAK b/LEAK\n+nope\n',
    });
    const serviceLike = serviceWith(execInContainer, jest.fn(async () => ({ id: WORKTREE_SESSION })));

    const result = await serviceLike.getWorkingTreeDiff(WORKTREE_SESSION, WORKTREE_HASH);

    expect(result).toEqual({
      commitHash: WORKTREE_HASH,
      diff: TRACKED_DIFF,
      truncated: false,
    });
    expect(serviceLike.createCheckpoint).not.toHaveBeenCalled();
    expectWorktreeDiffReadOnly(execInContainer);
  });
});

function assertRestoreBundlesRemoved(execInContainer: jest.Mock) {
  // CM-EXEC-01: the staged bundle lives only in the container; the host never
  // creates or removes it.
  expect(fs.unlink).not.toHaveBeenCalled();
  expect(execInContainer).toHaveBeenCalledWith(
    SESSION_ID,
    ['sh', '-lc', `rm -f ${CONTAINER_RESTORE_BUNDLE}`],
    '/workspace',
  );
}
