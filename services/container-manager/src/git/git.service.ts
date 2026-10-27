import { BadRequestException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { simpleGit, SimpleGit } from 'simple-git';
import { SessionsService } from '../sessions/sessions.service';
import { ApiGatewayHttpClient } from '../clients/api-gateway-http.client';
import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTAINER_HISTORY_BUNDLE = '/workspace/.git/aisb-history.bundle';
const CONTAINER_RESTORE_BUNDLE = '/workspace/.aisb-history-restore.bundle';

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

  async initializeGit(sessionId: string, userId: string) {
    const workspacePath = this.sessionsService.getWorkspacePath(sessionId);
    const git: SimpleGit = simpleGit(workspacePath);

    // Initialize git
    await git.init();
    await git.addConfig('user.name', 'AI Sandbox');
    await git.addConfig('user.email', 'sandbox@aisandbox.com');

    // Create initial commit
    await git.add('./*');
    await git.commit('Initial commit');

    // Update database
    this.db
      .prepare('UPDATE sessions SET git_initialized = 1 WHERE id = ?')
      .run(sessionId);

    // Create checkpoint
    const commitHash = await git.revparse(['HEAD']);
    await this.createCheckpoint(sessionId, userId, 0, commitHash, 'Initial commit');

    return {
      message: 'Git initialized successfully',
      commitHash,
    };
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

  async getHistory(sessionId: string, limit: number = 10) {
    const workspacePath = this.sessionsService.getWorkspacePath(sessionId);
    const git: SimpleGit = simpleGit(workspacePath);

    try {
      const log = await git.log({ maxCount: limit });
      return log.all.map(commit => ({
        hash: commit.hash,
        message: commit.message,
        date: commit.date,
        author: commit.author_name,
      }));
    } catch (error) {
      return [];
    }
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

    const hostBundlePath = path.join(
      this.sessionsService.getWorkspacePath(sessionId),
      '.git',
      'aisb-history.bundle',
    );
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

      await fs.mkdir(historyDir, { recursive: true });
      await fs.copyFile(hostBundlePath, tempPath);
      removeTemp = true;
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

    const hostRestorePath = path.join(
      this.sessionsService.getWorkspacePath(sessionId),
      '.aisb-history-restore.bundle',
    );

    try {
      await fs.copyFile(this.historyBundlePath(projectId), hostRestorePath);
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
      await this.removeHostFile(hostRestorePath);
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
