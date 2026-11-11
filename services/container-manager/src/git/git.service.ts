import { BadRequestException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SessionsService } from '../sessions/sessions.service';
import { ApiGatewayHttpClient } from '../clients/api-gateway-http.client';
import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import { constants as fsConstants } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMMIT_HASH_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
const CONTAINER_HISTORY_BUNDLE = '/workspace/.git/aisb-history.bundle';
const CONTAINER_RESTORE_BUNDLE = '/workspace/.aisb-history-restore.bundle';

// CM-HISTORY-LINK-01: the saved bundle leaves the container through docker exec,
// read in bounded slices so container-manager never holds the whole bundle in
// memory. The size is read once, after git bundle create; the copy never reads
// past it. CM-BINARY-01: each slice is read as raw bytes through the
// binary-safe governed exec (SessionsService.execInContainerBuffer), no longer
// as base64 text; every slice must still be exactly the expected length.
export const HISTORY_BUNDLE_BLOCK_BYTES = 1024 * 1024;
export const HISTORY_BUNDLE_CHUNK_BLOCKS = 8;
export const HISTORY_BUNDLE_SIZE_COMMAND = `[ -f ${CONTAINER_HISTORY_BUNDLE} ] && [ ! -L ${CONTAINER_HISTORY_BUNDLE} ] && wc -c < ${CONTAINER_HISTORY_BUNDLE}`;
export const HISTORY_BUNDLE_CHUNK_COMMAND = `dd if=${CONTAINER_HISTORY_BUNDLE} bs=${HISTORY_BUNDLE_BLOCK_BYTES} skip="$SKIP_BLOCKS" count="$COUNT_BLOCKS" 2>/dev/null`;
const HOST_COPY_BUFFER_BYTES = 1024 * 1024;

// CM-EXEC-01: restore stages the stored bundle by piping its bytes into the
// container's stdin; the host never writes into the bind-mounted workspace.
// Inside the container: rm -f removes whatever entry is there (a symlink
// itself, never its target; a directory makes it fail), set -C (noclobber)
// makes the redirect refuse an existing regular file and create a missing one
// with O_CREAT|O_EXCL, so a file or link planted after the rm fails the
// restore instead of being overwritten; cat copies stdin, and wc -c reports
// what landed, which must equal the bytes sent. Whatever the shell resolves
// there resolves inside the container's own filesystem, never on the host.
export const HISTORY_RESTORE_STAGE_COMMAND = `rm -f ${CONTAINER_RESTORE_BUNDLE} && set -C && cat > ${CONTAINER_RESTORE_BUNDLE} && wc -c < ${CONTAINER_RESTORE_BUNDLE}`;

// Save's temporary file in the history directory (host side, outside the
// workspace). O_CREAT | O_EXCL never follows a symlink and fails on any
// existing entry (symlink, device node, FIFO, directory or file), atomically. O_NOFOLLOW is
// added where the platform defines it (Linux, macOS); Windows has none, and
// O_EXCL alone already refuses an existing entry there.
const HOST_CREATE_EXCLUSIVE_FLAGS =
  fsConstants.O_WRONLY |
  fsConstants.O_CREAT |
  fsConstants.O_EXCL |
  (typeof fsConstants.O_NOFOLLOW === 'number' ? fsConstants.O_NOFOLLOW : 0);

export const WORKTREE_DIFF_MAX_CHARS = 65536;
export const WORKTREE_DIFF_TRUNCATED_MARKER = '\n[diff truncated]\n';

// One read-only exec: NUL-separated untracked paths (never interpolated into this
// string) become --no-index diffs against /dev/null. head -c stops a single new
// file from streaming without a bound. Exit 141 is SIGPIPE from that bound.
// Exit 0 from the whole script means the listing worked; any other exit means
// the caller keeps the tracked diff and does not fail the route.
const WORKTREE_UNTRACKED_DIFF_SCRIPT = [
  'set +e',
  'set -f',
  'if ! git ls-files --others --exclude-standard -z >/dev/null 2>&1; then',
  '  exit 1',
  'fi',
  'case "$DIFF_BUDGET" in',
  "  ''|*[!0-9]*) exit 1 ;;",
  'esac',
  'tmp=/tmp/aisb-wtd.$$',
  "trap 'rm -f \"$tmp\"' EXIT",
  'emitted=0',
  "git ls-files --others --exclude-standard -z | while IFS= read -r -d '' path; do",
  '  [ -n "$path" ] || continue',
  '  remain=$((DIFF_BUDGET - emitted))',
  '  if [ "$remain" -le 0 ]; then',
  '    break',
  '  fi',
  '  set -o pipefail',
  '  git --no-pager diff --no-color --no-ext-diff --no-index -- /dev/null "./$path" 2>/dev/null | head -c "$remain" >"$tmp"',
  '  ec=$?',
  '  set +o pipefail',
  '  case "$ec" in',
  '    0|1|141) ;;',
  '    *) continue ;;',
  '  esac',
  '  cat "$tmp"',
  '  emitted=$((emitted + $(wc -c <"$tmp")))',
  'done',
  'exit 0',
].join('\n');

export interface WorkingTreeDiffResult {
  commitHash: string;
  diff: string;
  truncated: boolean;
}

export function isFullCommitHash(value: string): boolean {
  return COMMIT_HASH_PATTERN.test(value);
}

export function capWorktreeDiff(diff: string): { text: string; truncated: boolean } {
  if (diff.length <= WORKTREE_DIFF_MAX_CHARS) {
    return { text: diff, truncated: false };
  }
  const keep = Math.max(0, WORKTREE_DIFF_MAX_CHARS - WORKTREE_DIFF_TRUNCATED_MARKER.length);
  return {
    text: diff.slice(0, keep) + WORKTREE_DIFF_TRUNCATED_MARKER,
    truncated: true,
  };
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export type CheckpointHistorySaveResult =
  | { status: 'saved'; bytes: number }
  | { status: 'skipped' };

export type CheckpointHistoryRestoreResult =
  | { status: 'restored'; head: string }
  | { status: 'none' };

type ExecResult = { exitCode: number; stdout: string; stderr: string };

/**
 * CM-GIT-HOST-01: every git command runs inside the session container through
 * docker exec, never on the host. The workspace is bind-mounted and the sandbox
 * can write .git/config and .git/hooks, so a host-side git could run programs
 * of the sandbox's choosing (core.fsmonitor, core.hooksPath, diff.external).
 * The host-side simple-git initializeGit and getHistory are removed.
 */
@Injectable()
export class GitService {
  private db: Database.Database;

  constructor(
    private sessionsService: SessionsService,
    private httpService: HttpService,
    private apiGatewayClient: ApiGatewayHttpClient,
  ) {
    const dbPath = path.join(__dirname, '../../../..', 'database', 'aisandbox.db');
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        message_number INTEGER NOT NULL DEFAULT 0,
        git_commit_hash TEXT NOT NULL,
        checkpoint_type TEXT NOT NULL DEFAULT 'auto',
        description TEXT,
        files_changed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        is_deleted INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  async commit(
    sessionId: string,
    userId: string,
    messageNumber: number,
    description?: string,
    allowEmpty?: boolean,
  ) {
    await this.ensureGitInitializedInContainer(sessionId);

    const statusResult = await this.sessionsService.execInContainer(
      sessionId,
      ['sh', '-lc', 'git status --porcelain'],
      '/workspace',
    );
    if (statusResult.exitCode !== 0) {
      throw new Error(statusResult.stderr || 'Failed to read git status');
    }

    const changedEntries = statusResult.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const commitMessage = description || `Auto-commit: Message ${messageNumber}`;
    if (changedEntries.length === 0) {
      if (!allowEmpty) {
        return {
          message: 'No changes to commit',
          commitHash: null,
        };
      }

      const emptyCommitResult = await this.sessionsService.execInContainer(
        sessionId,
        ['sh', '-lc', 'git commit --allow-empty -m "$COMMIT_MESSAGE"'],
        '/workspace',
        { COMMIT_MESSAGE: commitMessage },
      );
      if (emptyCommitResult.exitCode !== 0) {
        throw new Error(emptyCommitResult.stderr || 'Failed to create commit');
      }

      const revParseResult = await this.sessionsService.execInContainer(
        sessionId,
        ['sh', '-lc', 'git rev-parse HEAD'],
        '/workspace',
      );
      if (revParseResult.exitCode !== 0) {
        throw new Error(revParseResult.stderr || 'Failed to resolve commit hash');
      }
      const commitHash = revParseResult.stdout.trim();

      await this.createCheckpoint(sessionId, userId, messageNumber, commitHash, commitMessage, 0);

      return {
        message: 'Changes committed successfully',
        commitHash,
        filesChanged: 0,
      };
    }

    const addResult = await this.sessionsService.execInContainer(
      sessionId,
      ['sh', '-lc', 'git add -A'],
      '/workspace',
    );
    if (addResult.exitCode !== 0) {
      throw new Error(addResult.stderr || 'Failed to stage changes');
    }

    const commitResult = await this.sessionsService.execInContainer(
      sessionId,
      ['sh', '-lc', 'git commit -m "$COMMIT_MESSAGE"'],
      '/workspace',
      { COMMIT_MESSAGE: commitMessage },
    );
    if (commitResult.exitCode !== 0) {
      throw new Error(commitResult.stderr || 'Failed to create commit');
    }

    const revParseResult = await this.sessionsService.execInContainer(
      sessionId,
      ['sh', '-lc', 'git rev-parse HEAD'],
      '/workspace',
    );
    if (revParseResult.exitCode !== 0) {
      throw new Error(revParseResult.stderr || 'Failed to resolve commit hash');
    }
    const commitHash = revParseResult.stdout.trim();

    // Create checkpoint
    const filesChanged = changedEntries.length;
    await this.createCheckpoint(sessionId, userId, messageNumber, commitHash, commitMessage, filesChanged);

    return {
      message: 'Changes committed successfully',
      commitHash,
      filesChanged,
    };
  }

  async revert(sessionId: string, userId: string, commitHash: string) {
    const resetResult = await this.sessionsService.execInContainer(
      sessionId,
      ['sh', '-lc', 'git reset --hard "$COMMIT_HASH"'],
      '/workspace',
      { COMMIT_HASH: commitHash },
    );
    if (resetResult.exitCode !== 0) {
      throw new Error(resetResult.stderr || 'Failed to reset to commit');
    }

    // Create checkpoint for the revert operation
    const revertDescription = `Reverted to ${commitHash.substring(0, 7)}`;
    await this.createCheckpoint(sessionId, userId, 0, commitHash, revertDescription, 0);

    return {
      message: 'Reverted to commit successfully',
      commitHash,
    };
  }

  async getDiff(sessionId: string, commitHash: string) {
    try {
      const parentResult = await this.sessionsService.execInContainer(
        sessionId,
        ['sh', '-lc', `git rev-list --parents -n 1 ${commitHash}`],
        '/workspace',
      );
      if (parentResult.exitCode !== 0) {
        throw new Error(parentResult.stderr || `Failed to resolve parent for commit ${commitHash}`);
      }
      const parentHash = parentResult.stdout.trim().split(/\s+/)[1] || null;

      let diffOutput: string;
      if (parentHash) {
        const diffResult = await this.sessionsService.execInContainer(
          sessionId,
          ['sh', '-lc', `git diff ${parentHash}..${commitHash}`],
          '/workspace',
        );
        if (diffResult.exitCode !== 0) {
          throw new Error(diffResult.stderr || `Failed to compute diff for commit ${commitHash}`);
        }
        diffOutput = diffResult.stdout;
      } else {
        const showResult = await this.sessionsService.execInContainer(
          sessionId,
          ['sh', '-lc', `git show ${commitHash}`],
          '/workspace',
        );
        if (showResult.exitCode !== 0) {
          throw new Error(showResult.stderr || `Failed to show commit ${commitHash}`);
        }
        diffOutput = showResult.stdout;
      }

      const files = this.parseDiffOutput(diffOutput);
      return {
        commitHash,
        parentHash,
        files,
      };
    } catch (error) {
      console.error(`Failed to get diff for commit ${commitHash}:`, error);
      throw error;
    }
  }

  /**
   * Unified diff of the session working tree against one commit, including
   * untracked non-ignored files as additions. Read-only: does not stage or commit.
   */
  async getWorkingTreeDiff(
    sessionId: string,
    commitHash: string,
  ): Promise<WorkingTreeDiffResult> {
    if (!isFullCommitHash(commitHash)) {
      throw new BadRequestException('Invalid commit');
    }
    await this.sessionsService.getSession(sessionId);

    const verified = await this.execWorkspace(
      sessionId,
      'git rev-parse --verify --quiet "$COMMIT_HASH^{commit}"',
      { COMMIT_HASH: commitHash },
    );
    const verifiedHash = verified.stdout.trim().split(/\s+/)[0] ?? '';
    if (verified.exitCode !== 0 || !isFullCommitHash(verifiedHash)) {
      throw new BadRequestException('Invalid commit');
    }

    const diff = await this.execWorkspace(
      sessionId,
      'git --no-pager diff --no-color --no-ext-diff "$COMMIT_HASH"',
      { COMMIT_HASH: commitHash },
    );
    if (diff.exitCode !== 0) {
      throw new BadRequestException('Invalid commit');
    }

    const combined = await this.collectUntrackedAdditions(sessionId, diff.stdout);
    const capped = capWorktreeDiff(combined);
    return {
      commitHash: verifiedHash,
      diff: capped.text,
      truncated: capped.truncated,
    };
  }

  private async collectUntrackedAdditions(sessionId: string, tracked: string): Promise<string> {
    if (tracked.length > WORKTREE_DIFF_MAX_CHARS) {
      return tracked;
    }
    const untracked = await this.execWorkspace(sessionId, WORKTREE_UNTRACKED_DIFF_SCRIPT, {
      DIFF_BUDGET: String(WORKTREE_DIFF_MAX_CHARS - tracked.length + 1),
    });
    if (untracked.exitCode !== 0 || untracked.stdout.length === 0) {
      return tracked;
    }
    if (tracked.length > 0 && !tracked.endsWith('\n')) {
      return `${tracked}\n${untracked.stdout}`;
    }
    return tracked + untracked.stdout;
  }

  private parseDiffOutput(diffOutput: string): Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted';
    diff: string;
  }> {
    const files: Array<{
      path: string;
      status: 'added' | 'modified' | 'deleted';
      diff: string;
    }> = [];

    // Split diff by file boundaries (diff --git lines)
    const fileDiffs = diffOutput.split(/(?=diff --git)/);

    for (const fileDiff of fileDiffs) {
      if (!fileDiff.trim()) continue;

      // Extract file path
      const pathMatch = fileDiff.match(/diff --git a\/(.*?) b\/(.*?)$/m);
      if (!pathMatch) continue;

      const path = pathMatch[2];

      // Determine status
      let status: 'added' | 'modified' | 'deleted' = 'modified';
      if (fileDiff.includes('new file mode')) {
        status = 'added';
      } else if (fileDiff.includes('deleted file mode')) {
        status = 'deleted';
      }

      files.push({
        path,
        status,
        diff: fileDiff,
      });
    }

    return files;
  }

  async getCheckpoints(sessionId: string, limit: number = 10) {
    const checkpoints = this.db
      .prepare(`
        SELECT * FROM checkpoints
        WHERE session_id = ? AND is_deleted = 0
        ORDER BY message_number DESC
        LIMIT ?
      `)
      .all(sessionId, limit);

    return checkpoints;
  }

  private async createCheckpoint(
    sessionId: string,
    userId: string,
    messageNumber: number,
    commitHash: string,
    description: string,
    filesChanged: number = 0
  ) {
    try {
      const refResult = await this.sessionsService.execInContainer(
        sessionId,
        ['sh', '-lc', 'git update-ref "refs/checkpoints/$COMMIT_HASH" "$COMMIT_HASH"'],
        '/workspace',
        { COMMIT_HASH: commitHash },
      );
      if (refResult.exitCode !== 0) {
        console.error(
          'Failed to create checkpoint ref:',
          refResult.stderr || 'git update-ref failed',
        );
      }
    } catch (error) {
      console.error('Failed to create checkpoint ref:', error.message);
    }

    // Record checkpoint in api-gateway via HTTP
    try {
      await this.apiGatewayClient.recordGitCheckpoint({
        sessionId,
        commitHash,
        filesChanged,
        messageNumber,
        description,
      });
    } catch (error) {
      console.error('Failed to record checkpoint in api-gateway:', error.message);
      // Continue execution - checkpoint recording failure should not block git operations
    }

    // Keep local database record for backward compatibility
    const id = this.generateId();
    this.db.prepare(`
      INSERT INTO checkpoints (
        id, session_id, user_id, message_number, git_commit_hash,
        checkpoint_type, description, files_changed, created_at, is_deleted
      )
      VALUES (?, ?, ?, ?, ?, 'auto', ?, ?, datetime('now'), 0)
    `).run(id, sessionId, userId, messageNumber, commitHash, description, filesChanged);

    // Emit checkpoint created event
    await this.emitCheckpointCreated(sessionId, {
      id,
      session_id: sessionId,
      user_id: userId,
      message_number: messageNumber,
      git_commit_hash: commitHash,
      checkpoint_type: 'auto',
      description,
      files_changed: filesChanged,
      created_at: new Date().toISOString(),
    });
  }

  async saveProjectHistory(
    sessionId: string,
    projectId: string,
  ): Promise<CheckpointHistorySaveResult> {
    this.assertHistoryIds(sessionId, projectId);

    const repo = await this.execWorkspace(sessionId, 'git rev-parse --is-inside-work-tree');
    if (!this.isInsideWorkTree(repo)) {
      if (this.isMissingRepository(repo)) {
        return { status: 'skipped' };
      }
      throw new Error(repo.stderr || 'Failed to inspect git repository');
    }

    const head = await this.execWorkspace(sessionId, 'git rev-parse --verify HEAD');
    if (head.exitCode !== 0) {
      if (this.isMissingCommit(head.stderr)) {
        return { status: 'skipped' };
      }
      throw new Error(head.stderr || 'Failed to resolve HEAD');
    }

    const historyDir = this.checkpointHistoryDir();
    const finalPath = this.historyBundlePath(projectId);
    const tempPath = path.join(historyDir, `${projectId}.${randomBytes(8).toString('hex')}.tmp`);
    let removeContainerBundle = false;
    let removeTemp = false;

    try {
      removeContainerBundle = true;
      const created = await this.execWorkspace(
        sessionId,
        `git bundle create ${CONTAINER_HISTORY_BUNDLE} --all`,
      );
      if (created.exitCode !== 0) {
        throw new Error(created.stderr || 'Failed to create history bundle');
      }

      // CM-HISTORY-LINK-01: the bundle is read out of the container through
      // docker exec, never through the host path of the bind-mounted
      // workspace, where the sandbox could swap in a symlink (to the file or to
      // .git itself) or a device node after git bundle create.
      const size = await this.readContainerBundleSize(sessionId);
      await fs.mkdir(historyDir, { recursive: true });
      const handle = await fs.open(tempPath, HOST_CREATE_EXCLUSIVE_FLAGS, 0o644);
      removeTemp = true;
      try {
        await this.copyContainerBundleTo(sessionId, size, handle);
      } finally {
        await handle.close();
      }
      const stat = await fs.stat(tempPath);
      await fs.rename(tempPath, finalPath);
      removeTemp = false;
      return { status: 'saved', bytes: stat.size };
    } finally {
      if (removeContainerBundle) {
        await this.removeContainerFile(sessionId, CONTAINER_HISTORY_BUNDLE);
      }
      if (removeTemp) {
        await this.removeHostFile(tempPath);
      }
    }
  }

  async restoreProjectHistory(
    sessionId: string,
    projectId: string,
  ): Promise<CheckpointHistoryRestoreResult> {
    this.assertHistoryIds(sessionId, projectId);

    if (!(await this.storedBundleExists(projectId))) {
      return { status: 'none' };
    }

    try {
      await this.stageRestoreBundle(sessionId, this.historyBundlePath(projectId));
      await this.ensureGitInitializedInContainer(sessionId);

      const listed = await this.execWorkspace(
        sessionId,
        `git bundle list-heads ${CONTAINER_RESTORE_BUNDLE}`,
      );
      if (listed.exitCode !== 0) {
        throw new Error(listed.stderr || 'Failed to list bundle heads');
      }
      const head = this.resolveBundleHead(listed.stdout);

      const fetched = await this.execWorkspace(
        sessionId,
        `git fetch --update-head-ok ${CONTAINER_RESTORE_BUNDLE} "+refs/*:refs/*"`,
      );
      if (fetched.exitCode !== 0) {
        throw new Error(fetched.stderr || 'Failed to fetch history bundle');
      }

      if (head.branch) {
        const pointed = await this.execWorkspace(
          sessionId,
          'git symbolic-ref HEAD "$BRANCH_REF"',
          { BRANCH_REF: head.branch },
        );
        if (pointed.exitCode !== 0) {
          throw new Error(pointed.stderr || 'Failed to point HEAD at branch');
        }
      } else {
        const pointed = await this.execWorkspace(
          sessionId,
          'git update-ref --no-deref HEAD "$COMMIT_HASH"',
          { COMMIT_HASH: head.hash },
        );
        if (pointed.exitCode !== 0) {
          throw new Error(pointed.stderr || 'Failed to point HEAD at commit');
        }
      }

      const reset = await this.execWorkspace(sessionId, 'git reset -q');
      if (reset.exitCode !== 0) {
        throw new Error(reset.stderr || 'Failed to reset index');
      }

      return { status: 'restored', head: head.hash };
    } finally {
      await this.removeContainerFile(sessionId, CONTAINER_RESTORE_BUNDLE);
    }
  }

  private assertHistoryIds(sessionId: string, projectId: string): void {
    if (!isUuid(sessionId) || !isUuid(projectId)) {
      throw new BadRequestException('Invalid id');
    }
  }

  private projectsRoot(): string {
    return path.join(__dirname, '../../../..', 'projects');
  }

  private checkpointHistoryDir(): string {
    return path.join(this.projectsRoot(), '_checkpoint-history');
  }

  private historyBundlePath(projectId: string): string {
    const historyDir = this.checkpointHistoryDir();
    const bundlePath = path.resolve(historyDir, `${projectId}.bundle`);
    const relative = path.relative(historyDir, bundlePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BadRequestException('Invalid id');
    }
    return bundlePath;
  }

  private async storedBundleExists(projectId: string): Promise<boolean> {
    try {
      const stat = await fs.stat(this.historyBundlePath(projectId));
      return stat.isFile();
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * CM-HISTORY-LINK-01: size of the bundle git just wrote, read inside the
   * container. A symlink or anything but a regular file there is refused.
   */
  private async readContainerBundleSize(sessionId: string): Promise<number> {
    const sized = await this.execWorkspace(sessionId, HISTORY_BUNDLE_SIZE_COMMAND);
    const text = sized.stdout.trim();
    if (sized.exitCode !== 0 || !/^\d+$/.test(text)) {
      throw new Error(sized.stderr || 'Failed to read history bundle');
    }
    const size = Number(text);
    if (!Number.isSafeInteger(size)) {
      throw new Error('Failed to read history bundle');
    }
    return size;
  }

  /**
   * CM-HISTORY-LINK-01: copy exactly `size` bytes of the container's bundle to
   * an already-open host file, in slices of HISTORY_BUNDLE_CHUNK_BLOCKS blocks,
   * each read as raw bytes through the governed binary exec (CM-BINARY-01).
   * The host opens no path inside the workspace. A slice that is short or long
   * fails the save.
   */
  private async copyContainerBundleTo(
    sessionId: string,
    size: number,
    handle: fs.FileHandle,
  ): Promise<void> {
    const chunkBytes = HISTORY_BUNDLE_BLOCK_BYTES * HISTORY_BUNDLE_CHUNK_BLOCKS;
    for (let offset = 0; offset < size; offset += chunkBytes) {
      const expected = Math.min(chunkBytes, size - offset);
      const read = await this.sessionsService.execInContainerBuffer(
        sessionId,
        ['sh', '-lc', HISTORY_BUNDLE_CHUNK_COMMAND],
        '/workspace',
        {
          SKIP_BLOCKS: String(offset / HISTORY_BUNDLE_BLOCK_BYTES),
          COUNT_BLOCKS: String(HISTORY_BUNDLE_CHUNK_BLOCKS),
        },
      );
      if (read.exitCode !== 0) {
        throw new Error(read.stderr || 'Failed to read history bundle');
      }
      const bytes = read.stdout;
      if (!Buffer.isBuffer(bytes) || bytes.length !== expected) {
        throw new Error('History bundle changed while it was read');
      }
      await this.writeAll(handle, bytes);
    }
  }

  /**
   * CM-EXEC-01: put the stored bundle at CONTAINER_RESTORE_BUNDLE by streaming
   * it into the container (HISTORY_RESTORE_STAGE_COMMAND), in
   * HOST_COPY_BUFFER_BYTES reads, so memory stays bounded. The host only reads
   * the stored bundle in the history directory; it opens no workspace path.
   * The container must report exactly the number of bytes sent.
   */
  private async stageRestoreBundle(sessionId: string, storedPath: string): Promise<void> {
    const source = await fs.open(storedPath, 'r');
    try {
      const sent = { bytes: 0 };
      const staged = await this.sessionsService.execInContainerWithStdin(
        sessionId,
        ['sh', '-lc', HISTORY_RESTORE_STAGE_COMMAND],
        Readable.from(this.readStoredBundle(source, sent), { objectMode: false }),
        '/workspace',
      );
      if (staged.exitCode !== 0) {
        throw new Error(staged.stderr || 'Failed to stage history bundle');
      }
      const landed = staged.stdout.trim();
      if (!/^\d+$/.test(landed) || Number(landed) !== sent.bytes) {
        throw new Error('History bundle was not staged in full');
      }
    } finally {
      await source.close();
    }
  }

  private async *readStoredBundle(
    source: fs.FileHandle,
    sent: { bytes: number },
  ): AsyncGenerator<Buffer> {
    for (;;) {
      // A fresh buffer per read: the exec stream may still hold the last one.
      const buffer = Buffer.allocUnsafe(HOST_COPY_BUFFER_BYTES);
      const { bytesRead } = await source.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) {
        return;
      }
      sent.bytes += bytesRead;
      yield buffer.subarray(0, bytesRead);
    }
  }

  private async writeAll(handle: fs.FileHandle, bytes: Buffer): Promise<void> {
    let written = 0;
    while (written < bytes.length) {
      const result = await handle.write(bytes, written, bytes.length - written, null);
      if (result.bytesWritten <= 0) {
        throw new Error('Failed to write history bundle');
      }
      written += result.bytesWritten;
    }
  }

  private isInsideWorkTree(result: ExecResult): boolean {
    return result.exitCode === 0 && result.stdout.trim() === 'true';
  }

  private isMissingRepository(result: ExecResult): boolean {
    if (result.exitCode === 0) {
      return result.stdout.trim() !== 'true';
    }
    return result.stderr.toLowerCase().includes('not a git repository');
  }

  private isMissingCommit(stderr: string): boolean {
    const text = stderr.toLowerCase();
    return (
      text.includes('needed a single revision') ||
      text.includes('unknown revision') ||
      text.includes('ambiguous argument') ||
      text.includes('bad revision') ||
      text.includes('not a valid object name')
    );
  }

  private resolveBundleHead(output: string): { hash: string; branch: string | null } {
    const branches: Array<{ ref: string; hash: string }> = [];
    let headHash: string | null = null;

    for (const line of output.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const match = /^([0-9a-f]{40}|[0-9a-f]{64})\s+(\S+)$/i.exec(trimmed);
      if (!match) {
        continue;
      }
      const hash = match[1].toLowerCase();
      const ref = match[2];
      if (ref === 'HEAD') {
        headHash = hash;
      } else if (ref.startsWith('refs/heads/') && this.isSafeBranchRef(ref)) {
        branches.push({ ref, hash });
      }
    }

    if (!headHash) {
      throw new Error('Bundle has no HEAD');
    }

    const matches = branches.filter((branch) => branch.hash === headHash);
    if (matches.length === 0) {
      return { hash: headHash, branch: null };
    }
    if (matches.length === 1) {
      return { hash: headHash, branch: matches[0].ref };
    }

    const preferred =
      matches.find((branch) => branch.ref === 'refs/heads/main') ??
      matches.find((branch) => branch.ref === 'refs/heads/master') ??
      matches[0];
    return { hash: headHash, branch: preferred.ref };
  }

  private isSafeBranchRef(ref: string): boolean {
    return /^refs\/heads\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref) && !ref.includes('..');
  }

  private async execWorkspace(
    sessionId: string,
    command: string,
    env?: Record<string, string>,
  ): Promise<ExecResult> {
    if (env) {
      return this.sessionsService.execInContainer(
        sessionId,
        ['sh', '-lc', command],
        '/workspace',
        env,
      );
    }
    return this.sessionsService.execInContainer(sessionId, ['sh', '-lc', command], '/workspace');
  }

  private async removeHostFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to remove temporary bundle:', error.message);
      }
    }
  }

  private async removeContainerFile(sessionId: string, containerPath: string): Promise<void> {
    try {
      const result = await this.execWorkspace(sessionId, `rm -f ${containerPath}`);
      if (result.exitCode !== 0) {
        console.error('Failed to remove temporary bundle:', result.stderr || containerPath);
      }
    } catch (error) {
      console.error('Failed to remove temporary bundle:', error.message);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  private async ensureGitInitializedInContainer(sessionId: string): Promise<void> {
    const checkRepo = await this.sessionsService.execInContainer(
      sessionId,
      [
        'sh',
        '-lc',
        'command -v git >/dev/null 2>&1 || apk add --no-cache git >/dev/null 2>&1; git config --global --replace-all safe.directory /workspace && git rev-parse --is-inside-work-tree',
      ],
      '/workspace',
    );
    if (checkRepo.exitCode === 0) {
      return;
    }

    const initRepo = await this.sessionsService.execInContainer(
      sessionId,
      [
        'sh',
        '-lc',
        'command -v git >/dev/null 2>&1 || apk add --no-cache git >/dev/null 2>&1; git config --global --replace-all safe.directory /workspace && git init && git config user.name "AI Sandbox" && git config user.email "sandbox@aisandbox.com"',
      ],
      '/workspace',
    );
    if (initRepo.exitCode !== 0) {
      throw new Error(initRepo.stderr || 'Failed to initialize git repository');
    }
  }

  private async emitCheckpointCreated(sessionId: string, checkpoint: any) {
    try {
      await this.apiGatewayClient.notifyCheckpointCreated(sessionId, checkpoint);
    } catch (error) {
      console.error('Failed to emit checkpoint created event:', error.message);
    }
  }
}
