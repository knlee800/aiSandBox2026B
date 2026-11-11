import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * CM-HISTORY-LINK-01: checkpoint history save and restore on real files.
 *
 * The workspace is bind-mounted into the sandbox, so the sandbox can put a
 * symlink, a link to another directory, a device node or a directory at any
 * path inside it, at any moment. Save must not read a host file through such a
 * link, and restore must not write through one. The container side is a fake
 * that answers each docker exec the way the real script would; the host side
 * is the real GitService on real temporary directories.
 *
 * CM-EXEC-01: restore no longer writes on the host at all. The stored bundle
 * is piped into the container (a stdin exec running
 * HISTORY_RESTORE_STAGE_COMMAND), so the tests check that the host touches
 * no workspace path and that the container-side staging refuses what the
 * real command refuses.
 */

jest.mock('fs/promises', () => {
  const actual = jest.requireActual('fs/promises') as typeof import('fs/promises');
  const recorded = (name: keyof typeof actual) =>
    jest.fn((...args: unknown[]) => (actual[name] as (...a: unknown[]) => unknown)(...args));
  return {
    ...actual,
    copyFile: recorded('copyFile'),
    mkdir: recorded('mkdir'),
    open: recorded('open'),
    rename: recorded('rename'),
    stat: recorded('stat'),
    unlink: recorded('unlink'),
  };
});

import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import {
  GitService,
  HISTORY_BUNDLE_BLOCK_BYTES,
  HISTORY_BUNDLE_CHUNK_COMMAND,
  HISTORY_BUNDLE_SIZE_COMMAND,
  HISTORY_RESTORE_STAGE_COMMAND,
} from './git.service';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const HEAD = 'a'.repeat(40);
const CONTAINER_HISTORY_BUNDLE = '/workspace/.git/aisb-history.bundle';
const CONTAINER_RESTORE_BUNDLE = '/workspace/.aisb-history-restore.bundle';
const SECRET = Buffer.from('host-only secret: must never reach stored history\n');
const VICTIM = Buffer.from('host-only file: must never be overwritten\n');

type ExecResult = { exitCode: number; stdout: string; stderr: string };
type StdinExec = jest.Mock<
  (sessionId: string, cmd: string[], input: Readable, cwd?: string) => Promise<ExecResult>
>;
type Exec = jest.Mock<
  (sessionId: string, cmd: string[], cwd?: string, env?: Record<string, string>) => Promise<ExecResult>
> & { withStdin: StdinExec };

function fsFn(fn: unknown): jest.Mock<any> {
  return fn as jest.Mock<any>;
}

function probeLink(type: 'file' | 'junction'): boolean {
  const dir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aisb-link-probe-'));
  try {
    const target = path.join(dir, type === 'file' ? 'target' : 'target-dir');
    if (type === 'file') {
      fsSync.writeFileSync(target, 'x');
    } else {
      fsSync.mkdirSync(target);
    }
    fsSync.symlinkSync(target, path.join(dir, 'link'), type === 'file' ? 'file' : 'junction');
    return true;
  } catch {
    return false;
  } finally {
    fsSync.rmSync(dir, { recursive: true, force: true });
  }
}

// Windows refuses file symlinks without Developer Mode or admin rights (EPERM);
// directory junctions need no privilege. Linux allows both.
const CAN_SYMLINK_FILES = probeLink('file');
const CAN_LINK_DIRECTORIES = probeLink('junction');
const itFileLink = CAN_SYMLINK_FILES ? it : it.skip;
const itDirLink = CAN_LINK_DIRECTORIES ? it : it.skip;

function bundleBytes(size: number, seed: number): Buffer {
  const bytes = Buffer.alloc(size);
  for (let index = 0; index < size; index += 1) {
    bytes[index] = (index * 131 + seed) & 0xff;
  }
  return Buffer.concat([Buffer.from('# v2 git bundle\n'), bytes]);
}

function isLink(filePath: string): boolean {
  try {
    return fsSync.lstatSync(filePath).isSymbolicLink();
  } catch {
    return false;
  }
}

describe('CM-HISTORY-LINK-01: checkpoint history on real files and links', () => {
  let root: string;
  let workspace: string;
  let historyDir: string;
  let outside: string;

  beforeEach(() => {
    root = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aisb-history-links-'));
    workspace = path.join(root, 'workspaces', SESSION_ID);
    historyDir = path.join(root, 'projects', '_checkpoint-history');
    outside = path.join(root, 'host-only');
    fsSync.mkdirSync(path.join(workspace, '.git'), { recursive: true });
    fsSync.mkdirSync(outside, { recursive: true });
    fsSync.writeFileSync(path.join(outside, 'secret.txt'), SECRET);
    fsSync.writeFileSync(path.join(outside, 'victim.txt'), VICTIM);
    for (const fn of [fs.copyFile, fs.mkdir, fs.open, fs.rename, fs.stat, fs.unlink]) {
      fsFn(fn).mockClear();
    }
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Remove links first so cleanup never walks into their targets.
    for (const candidate of [
      path.join(workspace, '.git'),
      path.join(workspace, '.git', 'aisb-history.bundle'),
      path.join(workspace, '.aisb-history-restore.bundle'),
    ]) {
      if (isLink(candidate)) {
        fsSync.unlinkSync(candidate);
      }
    }
    fsSync.rmSync(root, { recursive: true, force: true });
  });

  function service(execInContainer: Exec) {
    return Object.assign(Object.create(GitService.prototype), {
      sessionsService: {
        execInContainer,
        execInContainerWithStdin: execInContainer.withStdin,
        getWorkspacePath: (id: string) => path.join(root, 'workspaces', id),
      },
      checkpointHistoryDir: () => historyDir,
    }) as GitService;
  }

  /**
   * The container's view of /workspace is the real workspace directory, but a
   * link the sandbox makes to a host path does not lead to that host path in
   * the container. The size script refuses a symlink or anything but a file.
   */
  function containerPath(containerFile: string): string {
    return path.join(workspace, containerFile.replace(/^\/workspace\//, ''));
  }

  function fakeContainer(options: {
    bundle?: Buffer;
    afterBundleCreate?: () => void;
    onListHeads?: (hostRestorePath: string) => void;
    /** Runs between the staging command's rm -f and its exclusive create. */
    beforeStageCreate?: (hostRestorePath: string) => void;
  }): Exec {
    const exec = jest.fn(async (_sessionId: string, cmd: string[], _cwd?: string, env?: Record<string, string>) => {
      const command = cmd[2];
      const ok = (stdout = ''): ExecResult => ({ exitCode: 0, stdout, stderr: '' });
      if (command.includes('git rev-parse --is-inside-work-tree')) {
        return ok('true\n');
      }
      if (command === 'git rev-parse --verify HEAD') {
        return ok(`${HEAD}\n`);
      }
      if (command === `git bundle create ${CONTAINER_HISTORY_BUNDLE} --all`) {
        fsSync.writeFileSync(containerPath(CONTAINER_HISTORY_BUNDLE), options.bundle ?? Buffer.alloc(0));
        options.afterBundleCreate?.();
        return ok();
      }
      if (command === HISTORY_BUNDLE_SIZE_COMMAND) {
        const file = containerPath(CONTAINER_HISTORY_BUNDLE);
        if (isLink(path.join(workspace, '.git')) || isLink(file) || !fsSync.existsSync(file)) {
          return { exitCode: 1, stdout: '', stderr: '' };
        }
        return ok(`${fsSync.statSync(file).size}\n`);
      }
      if (command === HISTORY_BUNDLE_CHUNK_COMMAND) {
        const bytes = fsSync.readFileSync(containerPath(CONTAINER_HISTORY_BUNDLE));
        const start = Number(env?.SKIP_BLOCKS) * HISTORY_BUNDLE_BLOCK_BYTES;
        const end = start + Number(env?.COUNT_BLOCKS) * HISTORY_BUNDLE_BLOCK_BYTES;
        return ok(`${bytes.subarray(start, end).toString('base64')}\n`);
      }
      if (command === `git bundle list-heads ${CONTAINER_RESTORE_BUNDLE}`) {
        options.onListHeads?.(containerPath(CONTAINER_RESTORE_BUNDLE));
        return ok(`${HEAD} refs/heads/main\n${HEAD} HEAD\n`);
      }
      if (
        command.startsWith('git fetch --update-head-ok') ||
        command === 'git symbolic-ref HEAD "$BRANCH_REF"' ||
        command === 'git reset -q'
      ) {
        return ok();
      }
      if (command === `rm -f ${CONTAINER_HISTORY_BUNDLE}` || command === `rm -f ${CONTAINER_RESTORE_BUNDLE}`) {
        const file = containerPath(command.slice('rm -f '.length));
        if (isLink(file)) {
          fsSync.unlinkSync(file);
        } else {
          fsSync.rmSync(file, { force: true });
        }
        return ok();
      }
      throw new Error(`Unexpected command: ${command}`);
    }) as unknown as Exec;

    // CM-EXEC-01: HISTORY_RESTORE_STAGE_COMMAND as the container shell runs
    // it: rm -f (a directory makes it fail), then an exclusive create (set -C:
    // an existing entry fails it), cat of stdin, and wc -c of what landed.
    exec.withStdin = jest.fn(async (_sessionId: string, cmd: string[], input: Readable) => {
      const fail = (stderr: string): ExecResult => ({ exitCode: 1, stdout: '', stderr });
      if (cmd[2] !== HISTORY_RESTORE_STAGE_COMMAND) {
        throw new Error(`Unexpected stdin command: ${cmd[2]}`);
      }
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        chunks.push(Buffer.from(chunk as Buffer));
      }
      const file = containerPath(CONTAINER_RESTORE_BUNDLE);
      if (isLink(file)) {
        fsSync.unlinkSync(file);
      } else if (fsSync.existsSync(file)) {
        if (fsSync.statSync(file).isDirectory()) {
          return fail(`rm: can't remove '${CONTAINER_RESTORE_BUNDLE}': Is a directory`);
        }
        fsSync.rmSync(file);
      }
      options.beforeStageCreate?.(file);
      let fd: number;
      try {
        fd = fsSync.openSync(file, 'wx');
      } catch {
        return fail(`sh: can't create ${CONTAINER_RESTORE_BUNDLE}: File exists`);
      }
      try {
        fsSync.writeSync(fd, Buffer.concat(chunks));
      } finally {
        fsSync.closeSync(fd);
      }
      return { exitCode: 0, stdout: `${fsSync.statSync(file).size}\n`, stderr: '' };
    }) as StdinExec;
    return exec;
  }

  function hostPathsTouched(): string[] {
    return [fs.copyFile, fs.mkdir, fs.open, fs.rename, fs.stat, fs.unlink].flatMap((fn) =>
      fsFn(fn).mock.calls.flatMap((call) =>
        call.filter((arg): arg is string => typeof arg === 'string').map((arg) => path.resolve(arg)),
      ),
    );
  }

  function storedFiles(): string[] {
    return fsSync.existsSync(historyDir) ? fsSync.readdirSync(historyDir) : [];
  }

  it('save then restore round trip keeps the bytes, and the host never opens a workspace path', async () => {
    const original = bundleBytes(3 * 1024 * 1024 + 17, 5);
    const saved = await service(fakeContainer({ bundle: original })).saveProjectHistory(
      SESSION_ID,
      PROJECT_ID,
    );

    expect(saved).toEqual({ status: 'saved', bytes: original.length });
    expect(storedFiles()).toEqual([`${PROJECT_ID}.bundle`]);
    expect(fsSync.readFileSync(path.join(historyDir, `${PROJECT_ID}.bundle`)).equals(original)).toBe(true);
    expect(fs.copyFile).not.toHaveBeenCalled();
    const touched = hostPathsTouched();
    expect(touched.length).toBeGreaterThan(0);
    expect(touched.filter((filePath) => filePath.startsWith(path.resolve(workspace)))).toEqual([]);
    expect(fsSync.existsSync(path.join(workspace, '.git', 'aisb-history.bundle'))).toBe(false);

    for (const fn of [fs.copyFile, fs.mkdir, fs.open, fs.rename, fs.stat, fs.unlink]) {
      fsFn(fn).mockClear();
    }
    let staged: Buffer | null = null;
    let stagedWasPlainFile = false;
    const restoreContainer = fakeContainer({
      onListHeads: (hostRestorePath) => {
        const stat = fsSync.lstatSync(hostRestorePath);
        stagedWasPlainFile = stat.isFile() && !stat.isSymbolicLink();
        staged = fsSync.readFileSync(hostRestorePath);
      },
    });
    const restored = await service(restoreContainer).restoreProjectHistory(SESSION_ID, PROJECT_ID);

    expect(restored).toEqual({ status: 'restored', head: HEAD });
    expect(restoreContainer.withStdin).toHaveBeenCalledTimes(1);
    const restoreTouched = hostPathsTouched();
    expect(restoreTouched).toContain(path.resolve(historyDir, `${PROJECT_ID}.bundle`));
    expect(restoreTouched.filter((filePath) => filePath.startsWith(path.resolve(workspace)))).toEqual([]);
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(stagedWasPlainFile).toBe(true);
    expect(staged).not.toBeNull();
    expect((staged as unknown as Buffer).equals(original)).toBe(true);
    expect(fsSync.existsSync(path.join(workspace, '.aisb-history-restore.bundle'))).toBe(false);
    expect(fs.copyFile).not.toHaveBeenCalled();
  });

  itFileLink(
    'save refuses a symlink swapped in at .git/aisb-history.bundle and stores nothing (needs file symlinks)',
    async () => {
      const bundlePath = path.join(workspace, '.git', 'aisb-history.bundle');
      const container = fakeContainer({
        bundle: bundleBytes(1024, 9),
        afterBundleCreate: () => {
          fsSync.unlinkSync(bundlePath);
          fsSync.symlinkSync(path.join(outside, 'secret.txt'), bundlePath, 'file');
        },
      });

      await expect(service(container).saveProjectHistory(SESSION_ID, PROJECT_ID)).rejects.toThrow(
        'Failed to read history bundle',
      );
      expect(storedFiles()).toEqual([]);
      expect(fs.copyFile).not.toHaveBeenCalled();
      expect(hostPathsTouched().filter((p) => p.startsWith(path.resolve(workspace)))).toEqual([]);
      expect(fsSync.readFileSync(path.join(outside, 'secret.txt')).equals(SECRET)).toBe(true);
    },
  );

  itDirLink(
    'save does not read a host file when .git is swapped for a link to a host directory (needs directory links)',
    async () => {
      const container = fakeContainer({
        bundle: bundleBytes(1024, 11),
        afterBundleCreate: () => {
          fsSync.renameSync(path.join(workspace, '.git'), path.join(workspace, '.git-moved'));
          fsSync.writeFileSync(path.join(outside, 'aisb-history.bundle'), SECRET);
          fsSync.symlinkSync(outside, path.join(workspace, '.git'), 'junction');
        },
      });

      await expect(service(container).saveProjectHistory(SESSION_ID, PROJECT_ID)).rejects.toThrow(
        'Failed to read history bundle',
      );
      expect(storedFiles()).toEqual([]);
      expect(fs.copyFile).not.toHaveBeenCalled();
      expect(hostPathsTouched().filter((p) => p.startsWith(path.resolve(workspace)))).toEqual([]);
    },
  );

  function writeStored(bytes: Buffer): void {
    fsSync.mkdirSync(historyDir, { recursive: true });
    fsSync.writeFileSync(path.join(historyDir, `${PROJECT_ID}.bundle`), bytes);
  }

  function workspacePathsTouched(): string[] {
    return hostPathsTouched().filter((filePath) => filePath.startsWith(path.resolve(workspace)));
  }

  itFileLink(
    'restore does not overwrite a host file through a symlink planted at .aisb-history-restore.bundle (needs file symlinks)',
    async () => {
      const stored = bundleBytes(2048, 3);
      writeStored(stored);
      const planted = path.join(workspace, '.aisb-history-restore.bundle');
      fsSync.symlinkSync(path.join(outside, 'victim.txt'), planted, 'file');

      let staged: Buffer | null = null;
      let stagedWasLink = true;
      const result = await service(
        fakeContainer({
          onListHeads: (hostRestorePath) => {
            stagedWasLink = isLink(hostRestorePath);
            staged = fsSync.readFileSync(hostRestorePath);
          },
        }),
      ).restoreProjectHistory(SESSION_ID, PROJECT_ID);

      expect(result).toEqual({ status: 'restored', head: HEAD });
      expect(stagedWasLink).toBe(false);
      expect((staged as unknown as Buffer).equals(stored)).toBe(true);
      expect(fsSync.readFileSync(path.join(outside, 'victim.txt')).equals(VICTIM)).toBe(true);
      expect(fsSync.existsSync(planted)).toBe(false);
      expect(workspacePathsTouched()).toEqual([]);
    },
  );

  it('restore fails rather than reuse an entry that appears after the old one is removed', async () => {
    writeStored(bundleBytes(2048, 6));
    const planted = Buffer.from('entry planted by the sandbox\n');
    let plantedSeen: Buffer | null = null;
    const container = fakeContainer({
      beforeStageCreate: (hostRestorePath) => fsSync.writeFileSync(hostRestorePath, planted),
    });
    const removeRestore = container.getMockImplementation()!;
    container.mockImplementation(async (sessionId, cmd, cwd, env) => {
      if (cmd[2] === `rm -f ${CONTAINER_RESTORE_BUNDLE}`) {
        plantedSeen = fsSync.readFileSync(containerPath(CONTAINER_RESTORE_BUNDLE));
      }
      return removeRestore(sessionId, cmd, cwd, env);
    });

    await expect(service(container).restoreProjectHistory(SESSION_ID, PROJECT_ID)).rejects.toThrow(
      'File exists',
    );
    // The planted entry was neither overwritten nor read as the bundle; the
    // cleanup removed it inside the container.
    expect((plantedSeen as unknown as Buffer).equals(planted)).toBe(true);
    expect(container.mock.calls.map((call) => call[1][2])).toEqual([`rm -f ${CONTAINER_RESTORE_BUNDLE}`]);
    expect(fsSync.existsSync(path.join(workspace, '.aisb-history-restore.bundle'))).toBe(false);
    expect(workspacePathsTouched()).toEqual([]);
  });

  it('restore refuses a directory at the restore path and leaves it as it was', async () => {
    writeStored(bundleBytes(512, 2));
    const restorePath = path.join(workspace, '.aisb-history-restore.bundle');
    fsSync.mkdirSync(restorePath);
    fsSync.writeFileSync(path.join(restorePath, 'inside.txt'), 'kept');

    const container = fakeContainer({});
    await expect(service(container).restoreProjectHistory(SESSION_ID, PROJECT_ID)).rejects.toThrow(
      'Is a directory',
    );
    expect(fsSync.readFileSync(path.join(restorePath, 'inside.txt'), 'utf8')).toBe('kept');
    expect(container.mock.calls.map((call) => call[1][2])).not.toContain(
      `git bundle list-heads ${CONTAINER_RESTORE_BUNDLE}`,
    );
    expect(workspacePathsTouched()).toEqual([]);
  });

  it('restore replaces a stale regular file left at the restore path', async () => {
    const stored = bundleBytes(4096, 8);
    writeStored(stored);
    fsSync.writeFileSync(path.join(workspace, '.aisb-history-restore.bundle'), 'stale');

    let staged: Buffer | null = null;
    const result = await service(
      fakeContainer({ onListHeads: (hostRestorePath) => (staged = fsSync.readFileSync(hostRestorePath)) }),
    ).restoreProjectHistory(SESSION_ID, PROJECT_ID);

    expect(result).toEqual({ status: 'restored', head: HEAD });
    expect((staged as unknown as Buffer).equals(stored)).toBe(true);
    expect(fsSync.existsSync(path.join(workspace, '.aisb-history-restore.bundle'))).toBe(false);
    expect(workspacePathsTouched()).toEqual([]);
  });

  it('restore of a bundle over 8 MiB streams every byte through stdin', async () => {
    const stored = bundleBytes(9 * 1024 * 1024 + 3, 12);
    writeStored(stored);

    let staged: Buffer | null = null;
    const result = await service(
      fakeContainer({ onListHeads: (hostRestorePath) => (staged = fsSync.readFileSync(hostRestorePath)) }),
    ).restoreProjectHistory(SESSION_ID, PROJECT_ID);

    expect(result).toEqual({ status: 'restored', head: HEAD });
    expect((staged as unknown as Buffer).equals(stored)).toBe(true);
    expect(workspacePathsTouched()).toEqual([]);
  });
});
