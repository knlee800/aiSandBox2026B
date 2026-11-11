import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * CM-GIT-HOST-01: container-manager never runs git, or any other program, on
 * the host. The session workspace is bind-mounted into the sandbox, which can
 * write .git/config (core.fsmonitor, core.hooksPath, diff.external) and
 * .git/hooks, so a host-side git there could run programs of the sandbox's
 * choosing. Every git command goes through docker exec into the container.
 */

const childProcessCalls: string[] = [];

function recordingChildProcess() {
  const names = ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'];
  const mock: Record<string, unknown> = {};
  for (const name of names) {
    mock[name] = jest.fn(() => {
      childProcessCalls.push(name);
      throw new Error(`CM-GIT-HOST-01: host child_process.${name} called`);
    });
  }
  return mock;
}

jest.mock('child_process', () => recordingChildProcess());
jest.mock('node:child_process', () => recordingChildProcess());

jest.mock('better-sqlite3', () =>
  jest.fn().mockImplementation(() => ({
    exec: jest.fn(),
    prepare: jest.fn().mockReturnValue({
      get: jest.fn(),
      run: jest.fn(),
      all: jest.fn().mockReturnValue([]),
    }),
  })),
);

jest.mock('fs/promises', () => {
  const actual = jest.requireActual('fs/promises') as typeof import('fs/promises');
  return {
    ...actual,
    mkdir: jest.fn(async () => undefined),
    copyFile: jest.fn(async () => undefined),
    // CM-HISTORY-LINK-01: history files are opened and written, not copied.
    open: jest.fn(async () => ({
      read: jest.fn(async () => ({ bytesRead: 0 })),
      write: jest.fn(async (_buffer: unknown, _offset: number, length: number) => ({
        bytesWritten: length,
      })),
      close: jest.fn(async () => undefined),
    })),
    rename: jest.fn(async () => undefined),
    stat: jest.fn(async () => ({ size: 1024, isFile: () => true })),
    unlink: jest.fn(async () => undefined),
  };
});

import * as fsSync from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';
import {
  GitService,
  HISTORY_BUNDLE_CHUNK_COMMAND,
  HISTORY_BUNDLE_SIZE_COMMAND,
  HISTORY_RESTORE_STAGE_COMMAND,
} from '../git/git.service';
import { GitController } from '../git/git.controller';
import { SessionsService } from '../sessions/sessions.service';
import { SessionsController } from '../sessions/sessions.controller';

const SRC_ROOT = path.join(__dirname, '..');
const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const HEAD = 'a'.repeat(40);
const PARENT = 'b'.repeat(40);

function productionSources(dir: string, out: string[] = []): string[] {
  for (const entry of fsSync.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      productionSources(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

function offending(pattern: RegExp): string[] {
  return productionSources(SRC_ROOT)
    .filter((file) => pattern.test(fsSync.readFileSync(file, 'utf8')))
    .map((file) => path.relative(SRC_ROOT, file).split(path.sep).join('/'));
}

describe('CM-GIT-HOST-01: no host-side git or process call in container-manager source', () => {
  it('scans a real source tree (sanity check)', () => {
    const files = productionSources(SRC_ROOT).map((f) => path.relative(SRC_ROOT, f).split(path.sep).join('/'));
    expect(files).toContain('git/git.service.ts');
    expect(files).toContain('sessions/sessions.service.ts');
    expect(files.length).toBeGreaterThan(30);
  });

  it('no production file imports simple-git or calls simpleGit()', () => {
    expect(offending(/['"]simple-git['"]|\bsimpleGit\s*\(/)).toEqual([]);
  });

  it('no production file imports or requires child_process', () => {
    expect(offending(/['"](node:)?child_process['"]/)).toEqual([]);
  });

  it('the removed host-side methods are gone', () => {
    expect((GitService.prototype as any).initializeGit).toBeUndefined();
    expect((GitService.prototype as any).getHistory).toBeUndefined();
    expect((SessionsService.prototype as any).createSession).toBeUndefined();
    expect((SessionsService.prototype as any).restoreWorkspaceFromProject).toBeUndefined();
    expect((GitController.prototype as any).init).toBeUndefined();
    expect((GitController.prototype as any).history).toBeUndefined();
    expect((SessionsController.prototype as any).create).toBeUndefined();
  });

  it('the projects module (host tar snapshots, reached only from create) is gone', () => {
    expect(fsSync.existsSync(path.join(SRC_ROOT, 'projects'))).toBe(false);
  });

  it('CM-EXEC-01: git.service.ts never resolves a host workspace path (restore stages through stdin)', () => {
    const source = fsSync.readFileSync(path.join(SRC_ROOT, 'git', 'git.service.ts'), 'utf8');
    expect(source).not.toMatch(/getWorkspacePath/);
    expect(source).not.toMatch(/['"]\.aisb-history-restore\.bundle['"]/);
    expect(source).toMatch(/execInContainerWithStdin\(/);
  });

  it('CM-BINARY-01: git.service.ts reads save slices through the binary exec, with no base64 framing', () => {
    const source = fsSync.readFileSync(path.join(SRC_ROOT, 'git', 'git.service.ts'), 'utf8');
    expect(source).toMatch(/execInContainerBuffer\(/);
    expect(source).not.toMatch(/\|\s*base64/);
    expect(source).not.toMatch(/['"]base64['"]/);
    expect(HISTORY_BUNDLE_CHUNK_COMMAND).not.toMatch(/base64/);
  });
});

describe('CM-GIT-HOST-01: every checkpoint git path runs inside the container', () => {
  let execInContainer: jest.Mock<any>;
  let execInContainerWithStdin: jest.Mock<any>;
  let execInContainerBuffer: jest.Mock<any>;
  let service: GitService;

  function commandFor(command: string): { exitCode: number; stdout: string; stderr: string } {
    // CM-HISTORY-LINK-01: the saved bundle's size (its bytes come through the
    // binary exec, CM-BINARY-01).
    if (command === HISTORY_BUNDLE_SIZE_COMMAND) {
      return { exitCode: 0, stdout: '4\n', stderr: '' };
    }
    if (command.includes('rev-parse --is-inside-work-tree')) {
      return { exitCode: 0, stdout: 'true\n', stderr: '' };
    }
    if (command.includes('git status --porcelain')) {
      return { exitCode: 0, stdout: ' M src/app.ts\n', stderr: '' };
    }
    if (command.includes('rev-list --parents')) {
      return { exitCode: 0, stdout: `${HEAD} ${PARENT}\n`, stderr: '' };
    }
    if (command.includes('bundle list-heads')) {
      return { exitCode: 0, stdout: `${HEAD} refs/heads/main\n${HEAD} HEAD\n`, stderr: '' };
    }
    if (command.includes('rev-parse')) {
      return { exitCode: 0, stdout: `${HEAD}\n`, stderr: '' };
    }
    if (command.includes('git diff') || command.includes('git --no-pager diff')) {
      return { exitCode: 0, stdout: 'diff --git a/src/app.ts b/src/app.ts\n+x\n', stderr: '' };
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  }

  beforeEach(() => {
    childProcessCalls.length = 0;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    execInContainer = jest.fn(async (_sessionId: string, cmd: string[]) => commandFor(String(cmd[2])));
    // CM-BINARY-01: save reads its slices as raw bytes through the binary exec.
    execInContainerBuffer = jest.fn(async (_sessionId: string, cmd: string[]) => {
      if (cmd[2] !== HISTORY_BUNDLE_CHUNK_COMMAND) {
        throw new Error(`unexpected binary command ${cmd[2]}`);
      }
      return { exitCode: 0, stdout: Buffer.from('PACK'), stderr: '' };
    });
    // CM-EXEC-01: restore pipes the stored bundle into the container.
    execInContainerWithStdin = jest.fn(async (_sessionId: string, cmd: string[], input: Readable) => {
      if (cmd[2] !== HISTORY_RESTORE_STAGE_COMMAND) {
        throw new Error(`unexpected stdin command ${cmd[2]}`);
      }
      let bytes = 0;
      for await (const chunk of input) {
        bytes += (chunk as Buffer).length;
      }
      return { exitCode: 0, stdout: `${bytes}\n`, stderr: '' };
    });
    const sessionsService = {
      execInContainer,
      execInContainerWithStdin,
      execInContainerBuffer,
      getSession: jest.fn(async () => ({ id: SESSION_ID })),
      getWorkspacePath: (id: string) => path.join(SRC_ROOT, '..', 'workspaces-test', id),
    };
    const apiGatewayClient = {
      recordGitCheckpoint: jest.fn(async () => undefined),
      notifyCheckpointCreated: jest.fn(async () => undefined),
    };
    service = new GitService(sessionsService as any, {} as any, apiGatewayClient as any);
  });

  function expectContainerOnly(): void {
    expect(childProcessCalls).toEqual([]);
    expect(execInContainer).toHaveBeenCalled();
    for (const call of execInContainer.mock.calls) {
      expect(call[0]).toBe(SESSION_ID);
      expect((call[1] as string[]).slice(0, 2)).toEqual(['sh', '-lc']);
      expect(call[2]).toBe('/workspace');
    }
    for (const call of execInContainerWithStdin.mock.calls) {
      expect(call[0]).toBe(SESSION_ID);
      expect((call[1] as string[]).slice(0, 2)).toEqual(['sh', '-lc']);
      expect(call[3]).toBe('/workspace');
    }
    for (const call of execInContainerBuffer.mock.calls) {
      expect(call[0]).toBe(SESSION_ID);
      expect((call[1] as string[]).slice(0, 2)).toEqual(['sh', '-lc']);
      expect(call[2]).toBe('/workspace');
    }
  }

  it('commit (create a checkpoint)', async () => {
    const result = await service.commit(SESSION_ID, 'u1', 3, 'Checkpoint');
    expect(result).toMatchObject({ commitHash: HEAD, filesChanged: 1 });
    expectContainerOnly();
  });

  it('revert', async () => {
    await service.revert(SESSION_ID, 'u1', HEAD);
    expectContainerOnly();
  });

  it('diff of one commit', async () => {
    const result = await service.getDiff(SESSION_ID, HEAD);
    expect(result.parentHash).toBe(PARENT);
    expectContainerOnly();
  });

  it('working-tree diff', async () => {
    await service.getWorkingTreeDiff(SESSION_ID, HEAD);
    expectContainerOnly();
  });

  it('save and restore the history bundle', async () => {
    expect(await service.saveProjectHistory(SESSION_ID, PROJECT_ID)).toEqual({
      status: 'saved',
      bytes: 1024,
    });
    expect(execInContainerBuffer).toHaveBeenCalledTimes(1);
    const fsMocks = [fsPromises.open, fsPromises.unlink, fsPromises.rename, fsPromises.mkdir, fsPromises.copyFile];
    for (const fn of fsMocks) {
      (fn as unknown as jest.Mock).mockClear();
    }
    expect(await service.restoreProjectHistory(SESSION_ID, PROJECT_ID)).toEqual({
      status: 'restored',
      head: HEAD,
    });
    expectContainerOnly();
    // CM-EXEC-01: restore only reads the stored bundle on the host; it opens
    // nothing for writing and creates, renames or removes nothing.
    expect(execInContainerWithStdin).toHaveBeenCalledTimes(1);
    const opens = (fsPromises.open as unknown as jest.Mock).mock.calls;
    expect(opens).toHaveLength(1);
    expect(opens[0][1]).toBe('r');
    expect(String(opens[0][0])).toContain('_checkpoint-history');
    for (const fn of [fsPromises.unlink, fsPromises.rename, fsPromises.mkdir, fsPromises.copyFile]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});
