import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  GoneException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ApiGatewayHttpClient } from '../clients/api-gateway-http.client';
import { DockerRuntimeService } from '../docker/docker-runtime.service';
import { GovernanceConfig } from '../config/governance.config';
import { ProjectsService } from '../projects/projects.service';
import { GovernanceEventsService } from '../governance/governance-events.service';
import { QuotaEvaluationService } from '../usage/quota-evaluation.service';

const execAsync = promisify(exec);

@Injectable()
export class SessionsService {
  private db: Database.Database;
  private workspacesRoot: string;
  /**
   * Task 8.2A: In-memory tracking of active exec operations per session
   * Map<sessionId, activeExecCount>
   */
  private activeExecs: Map<string, number> = new Map();

  /**
   * Task 8.3A: In-memory tracking of last activity timestamp per session
   * Map<sessionId, lastActivityTimestamp>
   * Used for request-driven idle timeout enforcement
   */
  private lastActivity: Map<string, number> = new Map();

  constructor(
    private httpService: HttpService,
    private apiGatewayClient: ApiGatewayHttpClient,
    private dockerRuntimeService: DockerRuntimeService,
    private governanceConfig: GovernanceConfig,
    private projectsService: ProjectsService,
    private governanceEventsService: GovernanceEventsService,
    private quotaEvaluationService: QuotaEvaluationService,
  ) {
    const dbPath = path.join(__dirname, '../../../..', 'database', 'aisandbox.db');
    const dbDir = path.dirname(dbPath);
    if (!fsSync.existsSync(dbDir)) {
      fsSync.mkdirSync(dbDir, { recursive: true });
    }
    this.db = new Database(dbPath);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL,
        project_id TEXT,
        container_id TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        git_initialized INTEGER DEFAULT 0,
        resource_limits TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL DEFAULT (datetime('now', '+2 hours')),
        last_activity_at TEXT DEFAULT (datetime('now')),
        metadata TEXT,
        orchestrator_enabled INTEGER DEFAULT 0,
        orchestrator_mode TEXT DEFAULT 'off',
        terminated_at TEXT,
        termination_reason TEXT
      );
      CREATE TABLE IF NOT EXISTS governance_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        user_id TEXT,
        termination_reason TEXT NOT NULL,
        terminated_at TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'container-manager',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Set workspaces directory
    this.workspacesRoot = path.join(__dirname, '../../../..', 'workspaces');

    // Create workspaces directory if it doesn't exist
    if (!fsSync.existsSync(this.workspacesRoot)) {
      fsSync.mkdirSync(this.workspacesRoot, { recursive: true });
    }
  }

  async createSession(userId: string, projectId?: string) {
    // Task 9.1: Handle project creation or validation
    let finalProjectId: string;
    let shouldRestoreWorkspace = false;

    if (projectId) {
      // Validate that project exists
      const projectExists = await this.projectsService.exists(projectId);
      if (!projectExists) {
        throw new BadRequestException(`Project ${projectId} not found`);
      }
      finalProjectId = projectId;
      shouldRestoreWorkspace = true; // Task 9.2A: restore when projectId provided
    } else {
      // Create a new project
      const project = await this.projectsService.createProject(
        userId,
        undefined, // Auto-generate name
        undefined, // No description
      );
      finalProjectId = project.id;
      shouldRestoreWorkspace = false; // No restore for new projects
    }

    // Generate session ID
    const sessionId = this.generateId();

    // Create workspace directory
    const workspacePath = path.join(this.workspacesRoot, sessionId);
    await fs.mkdir(workspacePath, { recursive: true });

    // Task 9.2A: Restore workspace if project was provided
    if (shouldRestoreWorkspace) {
      try {
        await this.restoreWorkspaceFromProject(finalProjectId, workspacePath);
      } catch (error) {
        // Cleanup: remove workspace directory on restore failure
        console.error(`Restore failed for project ${finalProjectId}, cleaning up workspace`);
        await fs.rm(workspacePath, { recursive: true, force: true });
        throw new InternalServerErrorException(
          `Failed to restore workspace from project ${finalProjectId}: ${error.message}`,
        );
      }
    }

    // Insert session into database
    const insert = this.db.prepare(`
      INSERT INTO sessions (
        id, user_id, project_id, status, git_initialized,
        created_at, expires_at, last_activity_at
      )
      VALUES (?, ?, ?, 'active', 0, datetime('now'), datetime('now', '+2 hours'), datetime('now'))
    `);

    insert.run(sessionId, userId, finalProjectId);

    // Notify api-gateway that session has started
    try {
      await this.apiGatewayClient.notifySessionStarted(sessionId);
    } catch (error) {
      console.error(`Failed to notify api-gateway of session start ${sessionId}:`, error.message);
      // Continue execution - notification failure should not block session creation
    }

    // Only initialize welcome file if NOT restoring (new project)
    if (!shouldRestoreWorkspace) {
      // Initialize with a welcome file
      const welcomeFile = path.join(workspacePath, 'README.md');
      await fs.writeFile(
        welcomeFile,
        '# Welcome to AI Sandbox!\n\nStart building your application here.\n',
        'utf-8',
      );
    }

    // Auto-initialize git via HTTP call to avoid circular dependency
    try {
      const localApiBaseUrl = `http://localhost:${process.env.PORT || 4002}`;
      await firstValueFrom(
        this.httpService.post(`${localApiBaseUrl}/api/git/${sessionId}/init`, {
          userId,
        }),
      );
      console.log(`Git initialized for session ${sessionId}`);
    } catch (error) {
      console.error(`Failed to initialize git for session ${sessionId}:`, error.message);
    }

    // Task 9.1: Persist workspace snapshot to project (initial state)
    // Only for new projects (not when restoring)
    if (!shouldRestoreWorkspace) {
      try {
        await this.projectsService.persistWorkspaceSnapshot(finalProjectId, workspacePath);
      } catch (error) {
        console.error(`Failed to persist workspace snapshot for project ${finalProjectId}:`, error.message);
        // Continue - snapshot failure should not block session creation
      }
    }

    return {
      sessionId,
      projectId: finalProjectId,
      workspacePath,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
  }

  async getSession(sessionId: string) {
    const session = this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId);

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const workspacePath = path.join(this.workspacesRoot, sessionId);

    return {
      ...session,
      workspacePath,
    };
  }

  async listUserSessions(userId: string) {
    const sessions = this.db
      .prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10')
      .all(userId);

    return sessions.map(session => ({
      ...session,
      workspacePath: path.join(this.workspacesRoot, session.id),
    }));
  }

  async updateActivity(sessionId: string) {
    this.db
      .prepare("UPDATE sessions SET last_activity_at = datetime('now') WHERE id = ?")
      .run(sessionId);
  }

  async stopSession(sessionId: string) {
    const result = this.db
      .prepare("UPDATE sessions SET status = 'stopped' WHERE id = ?")
      .run(sessionId);

    if (result.changes === 0) {
      throw new NotFoundException('Session not found');
    }

    // OPS-01-02: Reuse existing physical cleanup path for normal stop flow.
    // Keep stop semantics resilient by treating runtime cleanup as best-effort.
    try {
      await this.removeSessionContainer(sessionId);
    } catch (error) {
      console.error(
        `Failed to remove container for session ${sessionId} during stop:`,
        error.message,
      );
      // Continue with status/notification semantics even if cleanup fails.
    }

    // Notify api-gateway that session has stopped
    try {
      await this.apiGatewayClient.notifySessionStopped(sessionId);
    } catch (error) {
      console.error(`Failed to notify api-gateway of session stop ${sessionId}:`, error.message);
      // Continue execution - notification failure should not block session stop
    }

    // Task 8.3A & 8.3B: Clean up all governance tracking
    this.lastActivity.delete(sessionId);
    this.activeExecs.delete(sessionId);

    return { message: 'Session stopped successfully' };
  }

  async deleteSession(sessionId: string) {
    // Task 40B-1: Remove container BEFORE deleting session data
    // Best-effort container cleanup (log errors but continue with deletion)
    try {
      await this.removeSessionContainer(sessionId);
    } catch (error) {
      console.error(
        `Failed to remove container for session ${sessionId} during deletion:`,
        error.message,
      );
      // Continue with session deletion even if container removal fails
    }

    // Delete workspace directory (time-bounded best-effort)
    // Task 40B-3R: Prevent Windows workspace deletion from blocking HTTP response
    const workspacePath = path.join(this.workspacesRoot, sessionId);
    try {
      const workspaceDeleteTimeout = 3000; // 3 seconds max
      await Promise.race([
        fs.rm(workspacePath, { recursive: true, force: true }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Workspace deletion timeout')),
            workspaceDeleteTimeout,
          ),
        ),
      ]);
    } catch (error) {
      // Best-effort: log warning but continue with DB deletion
      console.warn(
        `Workspace deletion for session ${sessionId} failed or timed out (continuing):`,
        error.message,
      );
    }

    // Delete from database
    this.db
      .prepare('DELETE FROM sessions WHERE id = ?')
      .run(sessionId);

    // Task 8.3A & 8.3B: Clean up all governance tracking
    this.lastActivity.delete(sessionId);
    this.activeExecs.delete(sessionId);

    return { message: 'Session deleted successfully' };
  }

  getWorkspacePath(sessionId: string): string {
    return path.join(this.workspacesRoot, sessionId);
  }

  /**
   * Start a Docker container for an existing session
   * Creates and starts the container, mounting the session workspace
   * Returns only after container is confirmed running
   * @param sessionId - Session UUID
   */
  async startSessionContainer(sessionId: string, userId?: string): Promise<void> {
    if (userId) {
      const existing = this.db
        .prepare('SELECT id FROM sessions WHERE id = ?')
        .get(sessionId);
      if (!existing) {
        this.db
          .prepare(
            `INSERT INTO sessions (id, user_id, status, git_initialized, created_at, expires_at, last_activity_at)
             VALUES (?, ?, 'active', 0, datetime('now'), datetime('now', '+2 hours'), datetime('now'))`,
          )
          .run(sessionId, userId);
      }
      // #region agent log
      fetch('http://127.0.0.1:7870/ingest/eba94f28-6765-4a01-9905-123e592de80f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8262b1'},body:JSON.stringify({sessionId:'8262b1',location:'sessions.service.ts:startSessionContainer',message:'session record ensured in SQLite',data:{sessionId,userId,existed:!!existing},timestamp:Date.now(),runId:'post-fix'})}).catch(()=>{});
      // #endregion
    }

    const workspacePath = this.getWorkspacePath(sessionId);

    if (!fsSync.existsSync(workspacePath)) {
      fsSync.mkdirSync(workspacePath, { recursive: true });
    }

    const containerId = await this.dockerRuntimeService.createContainer(
      sessionId,
      workspacePath,
    );
    await this.dockerRuntimeService.startContainer(containerId);

    // Keep API Gateway session status in sync after successful container startup.
    try {
      await this.apiGatewayClient.notifySessionStarted(sessionId);
    } catch (error) {
      console.error(`Failed to notify api-gateway of session start ${sessionId}:`, error.message);
    }
  }

  /**
   * Remove a Docker container for a session
   * Task 6.5: Explicit Container Deletion
   * Task 8.3A: Clean up idle timeout tracking
   * Task 8.3B: Clean up all governance tracking
   *
   * Fail-fast behavior:
   * 1. Find container by session ID (fails if not found)
   * 2. Stop container if running
   * 3. Remove container
   *
   * @param sessionId - Session UUID
   * @throws Error if container not found or removal fails
   */
  async removeSessionContainer(sessionId: string): Promise<void> {
    // Find container by session ID (fail-fast if not found)
    const container = await this.dockerRuntimeService.findContainerBySessionId(
      sessionId,
    );

    // Inspect container to check if it's running
    const inspect = await container.inspect();

    // Stop container if running
    if (inspect.State.Running) {
      await this.dockerRuntimeService.stopContainer(container.id);
    }

    // Remove container
    await this.dockerRuntimeService.removeContainer(container.id);

    // Task 8.3A & 8.3B: Clean up all governance tracking
    this.lastActivity.delete(sessionId);
    this.activeExecs.delete(sessionId);
  }

  /**
   * Execute a command inside a session's container
   * Task 7.1A: Internal Container Exec Primitive
   * Task 8.2A: Enforce Exec Concurrency Per Session
   * Task 8.3A: Enforce Session Idle Timeout
   * Task 8.3B: Enforce Session Max Lifetime
   * Task 8.4A: Enforce Session Termination (HTTP 410)
   * Task 9.5A: Enforce Quota Limits (HTTP 429)
   *
   * @param sessionId - Session UUID
   * @param cmd - Command array
   * @param cwd - Working directory (default: /workspace)
   * @param env - Environment variables
   * @param timeoutMs - Execution timeout in milliseconds
   * @returns Object with exitCode, stdout, stderr
   * @throws NotFoundException if session does not exist
   * @throws GoneException if session is terminated, max lifetime exceeded, or idle timeout exceeded
   * @throws TooManyRequestsException if concurrent exec limit exceeded or quota exceeded
   * @throws Error if container not found, not running, or exec fails
   */
  async execInContainer(
    sessionId: string,
    cmd: string[],
    cwd?: string,
    env?: Record<string, string>,
    timeoutMs?: number,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    // Task 8.4A: Check termination FIRST (DB-backed, survives restarts)
    this.assertSessionUsableOrThrow(sessionId);

    // Task 8.3B: Check max lifetime SECOND (absolute limit)
    await this.checkAndEnforceMaxLifetime(sessionId);

    // Task 8.3A: Check idle timeout THIRD
    await this.checkAndEnforceIdleTimeout(sessionId);

    // Task 9.5A: Check quota limits FOURTH (request-time blocking)
    await this.checkAndEnforceQuota(sessionId);

    // Task 8.2A: Check concurrent exec limit
    const currentActive = this.activeExecs.get(sessionId) || 0;
    const maxAllowed = this.governanceConfig.maxConcurrentExecsPerSession;

    if (currentActive >= maxAllowed) {
      throw new HttpException(
        `Concurrent exec limit exceeded for session ${sessionId}: ${currentActive}/${maxAllowed} active`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment active exec counter
    this.activeExecs.set(sessionId, currentActive + 1);

    try {
      // Execute command (existing logic)
      const result = await this.dockerRuntimeService.execInContainerBySessionId(
        sessionId,
        cmd,
        cwd,
        env,
        timeoutMs,
      );

      // Task 8.3A: Update activity after success
      this.updateLastActivity(sessionId);

      return result;
    } finally {
      // Always decrement counter (even on error/timeout)
      const activeCount = this.activeExecs.get(sessionId) || 0;
      const newCount = Math.max(0, activeCount - 1);

      if (newCount === 0) {
        // Remove entry if no active execs
        this.activeExecs.delete(sessionId);
      } else {
        this.activeExecs.set(sessionId, newCount);
      }
    }
  }

  /**
   * Read a file from a session's container filesystem
   * Task 7.2A: Container File Read (Read-Only)
   * Task 8.3A: Enforce Session Idle Timeout
   * Task 8.3B: Enforce Session Max Lifetime
   * Task 8.4A: Enforce Session Termination (HTTP 410)
   * Task 9.5A: Enforce Quota Limits (HTTP 429)
   *
   * @param sessionId - Session UUID
   * @param filePath - Relative path from /workspace
   * @returns File content as UTF-8 string
   * @throws NotFoundException if session does not exist
   * @throws GoneException if session is terminated, max lifetime exceeded, or idle timeout exceeded
   * @throws TooManyRequestsException if quota exceeded
   * @throws Error if container not found, not running, path invalid, or file read fails
   */
  async readFileFromContainer(
    sessionId: string,
    filePath: string,
  ): Promise<string> {
    // Task 8.4A: Check termination FIRST (DB-backed, survives restarts)
    this.assertSessionUsableOrThrow(sessionId);

    // Task 8.3B: Check max lifetime SECOND (absolute limit)
    await this.checkAndEnforceMaxLifetime(sessionId);

    // Task 8.3A: Check idle timeout THIRD
    await this.checkAndEnforceIdleTimeout(sessionId);

    // Task 9.5A: Check quota limits FOURTH (request-time blocking)
    await this.checkAndEnforceQuota(sessionId);

    const result = await this.dockerRuntimeService.readFileFromContainer(
      sessionId,
      filePath,
    );

    // Task 8.3A: Update activity after success
    this.updateLastActivity(sessionId);

    return result;
  }

  /**
   * Write a file to a session's container filesystem
   * Task 7.2B: Container File Write (Create / Overwrite)
   * Task 8.3A: Enforce Session Idle Timeout
   * Task 8.3B: Enforce Session Max Lifetime
   * Task 8.4A: Enforce Session Termination (HTTP 410)
   * Task 9.5A: Enforce Quota Limits (HTTP 429)
   *
   * @param sessionId - Session UUID
   * @param filePath - Relative path from /workspace
   * @param content - File content as UTF-8 string
   * @throws NotFoundException if session does not exist
   * @throws GoneException if session is terminated, max lifetime exceeded, or idle timeout exceeded
   * @throws TooManyRequestsException if quota exceeded
   * @throws Error if container not found, not running, path invalid, or file write fails
   */
  async writeFileToContainer(
    sessionId: string,
    filePath: string,
    content: string,
  ): Promise<void> {
    // Task 8.4A: Check termination FIRST (DB-backed, survives restarts)
    this.assertSessionUsableOrThrow(sessionId);

    // Task 8.3B: Check max lifetime SECOND (absolute limit)
    await this.checkAndEnforceMaxLifetime(sessionId);

    // Task 8.3A: Check idle timeout THIRD
    await this.checkAndEnforceIdleTimeout(sessionId);

    // Task 9.5A: Check quota limits FOURTH (request-time blocking)
    await this.checkAndEnforceQuota(sessionId);

    await this.dockerRuntimeService.writeFileToContainer(
      sessionId,
      filePath,
      content,
    );

    // Task 8.3A: Update activity after success
    this.updateLastActivity(sessionId);
  }

  /**
   * Delete a file from a session's container filesystem
   * Task AI-WS-03-hotfix5: Route file delete through container exec
   *
   * @param sessionId - Session UUID
   * @param filePath - Relative path from /workspace
   * @throws NotFoundException if session does not exist or file is missing
   * @throws GoneException if session is terminated, max lifetime exceeded, or idle timeout exceeded
   * @throws TooManyRequestsException if quota exceeded
   * @throws Error if container not found, not running, path invalid, or delete fails
   */
  async deleteFileFromContainer(
    sessionId: string,
    filePath: string,
  ): Promise<void> {
    this.assertSessionUsableOrThrow(sessionId);
    await this.checkAndEnforceMaxLifetime(sessionId);
    await this.checkAndEnforceIdleTimeout(sessionId);
    await this.checkAndEnforceQuota(sessionId);

    await this.dockerRuntimeService.deleteFileFromContainer(sessionId, filePath);

    this.updateLastActivity(sessionId);
  }

  /**
   * Search text-like files in a session's container filesystem
   * Task AI-WS-06-hotfix: Route workspace search through container exec
   *
   * @param sessionId - Session UUID
   * @param query - Plain-text query to search for
   * @returns Structured bounded search results
   * @throws NotFoundException if session does not exist
   * @throws GoneException if session is terminated, max lifetime exceeded, or idle timeout exceeded
   * @throws TooManyRequestsException if quota exceeded
   * @throws Error if container not found, not running, query invalid, or search fails
   */
  async searchFilesInContainer(
    sessionId: string,
    query: string,
  ): Promise<{
    query: string;
    results: Array<{ path: string; line: number; preview: string }>;
    truncated: boolean;
  }> {
    this.assertSessionUsableOrThrow(sessionId);
    await this.checkAndEnforceMaxLifetime(sessionId);
    await this.checkAndEnforceIdleTimeout(sessionId);
    await this.checkAndEnforceQuota(sessionId);

    const result = await this.dockerRuntimeService.searchFilesInContainer(
      sessionId,
      query,
    );

    this.updateLastActivity(sessionId);
    return result;
  }

  /**
   * List directory contents from a session's container filesystem
   * Task 7.2C: Container Directory Listing (Read-Only)
   * Task 8.3A: Enforce Session Idle Timeout
   * Task 8.3B: Enforce Session Max Lifetime
   * Task 8.4A: Enforce Session Termination (HTTP 410)
   * Task 9.5A: Enforce Quota Limits (HTTP 429)
   *
   * @param sessionId - Session UUID
   * @param dirPath - Relative path from /workspace (empty or "/" means root)
   * @returns Array of directory entries
   * @throws NotFoundException if session does not exist
   * @throws GoneException if session is terminated, max lifetime exceeded, or idle timeout exceeded
   * @throws TooManyRequestsException if quota exceeded
   * @throws Error if container not found, not running, path invalid, or listing fails
   */
  async listDirectoryInContainer(
    sessionId: string,
    dirPath?: string,
  ): Promise<
    Array<{ name: string; type: 'file' | 'dir'; size: number; modifiedAt: string }>
  > {
    // Task 8.4A: Check termination FIRST (DB-backed, survives restarts)
    this.assertSessionUsableOrThrow(sessionId);

    // Task 8.3B: Check max lifetime SECOND (absolute limit)
    await this.checkAndEnforceMaxLifetime(sessionId);

    // Task 8.3A: Check idle timeout THIRD
    await this.checkAndEnforceIdleTimeout(sessionId);

    // Task 9.5A: Check quota limits FOURTH (request-time blocking)
    await this.checkAndEnforceQuota(sessionId);

    const result = await this.dockerRuntimeService.listDirectoryInContainer(
      sessionId,
      dirPath,
    );

    // Task 8.3A: Update activity after success
    this.updateLastActivity(sessionId);

    return result;
  }

  /**
   * Get file/directory metadata from a session's container filesystem
   * Task 7.2D: Container File Stat / Existence
   * Task 8.3A: Enforce Session Idle Timeout
   * Task 8.3B: Enforce Session Max Lifetime
   * Task 8.4A: Enforce Session Termination (HTTP 410)
   * Task 9.5A: Enforce Quota Limits (HTTP 429)
   *
   * @param sessionId - Session UUID
   * @param filePath - Relative path from /workspace
   * @returns Object with path, exists, and metadata if exists
   * @throws NotFoundException if session does not exist
   * @throws GoneException if session is terminated, max lifetime exceeded, or idle timeout exceeded
   * @throws TooManyRequestsException if quota exceeded
   * @throws Error if container not found, not running, path invalid, or stat fails
   */
  async statPathInContainer(
    sessionId: string,
    filePath: string,
  ): Promise<{
    path: string;
    exists: boolean;
    type?: 'file' | 'dir';
    size?: number;
    modifiedAt?: string;
  }> {
    // Task 8.4A: Check termination FIRST (DB-backed, survives restarts)
    this.assertSessionUsableOrThrow(sessionId);

    // Task 8.3B: Check max lifetime SECOND (absolute limit)
    await this.checkAndEnforceMaxLifetime(sessionId);

    // Task 8.3A: Check idle timeout THIRD
    await this.checkAndEnforceIdleTimeout(sessionId);

    // Task 9.5A: Check quota limits FOURTH (request-time blocking)
    await this.checkAndEnforceQuota(sessionId);

    const result = await this.dockerRuntimeService.statPathInContainer(
      sessionId,
      filePath,
    );

    // Task 8.3A: Update activity after success
    this.updateLastActivity(sessionId);

    return result;
  }

  /**
   * Task 8.4A: Public wrapper for termination check (for use by controllers)
   * Delegates to private helper - no DB logic duplication
   *
   * @param sessionId - Session UUID
   * @throws NotFoundException if session does not exist
   * @throws GoneException if session is terminated
   */
  public assertSessionUsable(sessionId: string): void {
    this.assertSessionUsableOrThrow(sessionId);
  }

  /**
   * Task 9.5A: Public wrapper for quota check (for use by other services)
   * Delegates to private helper - no logic duplication
   *
   * @param sessionId - Session UUID
   * @throws TooManyRequestsException (HTTP 429) if quota exceeded
   */
  public async checkQuota(sessionId: string): Promise<void> {
    await this.checkAndEnforceQuota(sessionId);
  }

  /**
   * Task 8.4A: Assert session exists and is not terminated
   * DB-backed check that survives process restarts
   * PRIVATE - controllers use public wrapper above
   *
   * @param sessionId - Session UUID
   * @throws NotFoundException if session does not exist
   * @throws GoneException if session is terminated
   */
  private assertSessionUsableOrThrow(sessionId: string): void {
    const session = this.db
      .prepare('SELECT terminated_at, termination_reason FROM sessions WHERE id = ?')
      .get(sessionId) as { terminated_at: string | null; termination_reason: string | null } | undefined;

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    if (session.terminated_at !== null) {
      const reason = session.termination_reason
        ? ` (reason: ${session.termination_reason})`
        : '';
      throw new GoneException(
        `Session ${sessionId} has been terminated${reason}`,
      );
    }
  }

  /**
   * Task 8.3B: Check and enforce session max lifetime
   * Task 8.4B: Write termination to database on max lifetime violation
   * Task 9.3A: Log governance termination event (passive, best-effort)
   * Request-driven enforcement only (no background workers)
   * Lifetime is absolute from session creation and NOT reset by activity
   *
   * @param sessionId - Session UUID
   * @throws GoneException if session has exceeded max lifetime
   */
  private async checkAndEnforceMaxLifetime(sessionId: string): Promise<void> {
    // Read session from database to get creation time and termination status
    const session = this.db
      .prepare('SELECT created_at, terminated_at, user_id FROM sessions WHERE id = ?')
      .get(sessionId) as { created_at: string; terminated_at: string | null; user_id: string } | undefined;

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    // Parse creation time (SQLite datetime format)
    const createdAt = new Date(session.created_at).getTime();
    const now = Date.now();
    const elapsedMs = now - createdAt;
    const maxLifetimeMs = this.governanceConfig.sessionMaxLifetimeMs;

    // Check if max lifetime exceeded
    if (elapsedMs > maxLifetimeMs) {
      // Task 8.4B: Write termination to database (idempotent - only if not already terminated)
      if (session.terminated_at === null) {
        this.db
          .prepare(`
            UPDATE sessions
            SET terminated_at = datetime('now'), termination_reason = ?
            WHERE id = ? AND terminated_at IS NULL
          `)
          .run('max_lifetime', sessionId);
      }

      // Task 9.3A: Log governance event (best-effort, never throws)
      this.governanceEventsService.logTerminationEvent(
        sessionId,
        session.user_id,
        'max_lifetime',
        new Date().toISOString(),
      );

      // Clean up all in-memory tracking (must happen even if container cleanup fails)
      this.lastActivity.delete(sessionId);
      this.activeExecs.delete(sessionId);

      // Try to stop container (best-effort)
      try {
        await this.removeSessionContainer(sessionId);
      } catch (error) {
        console.error(
          `Failed to stop container for lifetime-expired session ${sessionId}:`,
          error.message,
        );
        // Continue to throw GoneException even if container stop failed
      }

      // Reject request
      throw new GoneException(
        `Session ${sessionId} expired due to max lifetime exceeded (reason: max_lifetime)`,
      );
    }
  }

  /**
   * Task 8.3A: Check and enforce session idle timeout
   * Task 8.4B: Write termination to database on idle timeout violation
   * Task 9.3A: Log governance termination event (passive, best-effort)
   * Request-driven enforcement only (no background workers)
   *
   * @param sessionId - Session UUID
   * @throws GoneException if session has been idle for too long
   */
  private async checkAndEnforceIdleTimeout(sessionId: string): Promise<void> {
    const now = Date.now();
    const lastActivityAt = this.lastActivity.get(sessionId);

    // First activity for this session - initialize timestamp
    if (lastActivityAt === undefined) {
      this.lastActivity.set(sessionId, now);
      return;
    }

    // Check if idle timeout exceeded
    const elapsedMs = now - lastActivityAt;
    const idleTimeoutMs = this.governanceConfig.sessionIdleTimeoutMs;

    if (elapsedMs > idleTimeoutMs) {
      // Task 9.3A: Get user_id for logging (read from DB)
      const session = this.db
        .prepare('SELECT user_id FROM sessions WHERE id = ?')
        .get(sessionId) as { user_id: string } | undefined;

      // Task 8.4B: Write termination to database (idempotent - only if not already terminated)
      this.db
        .prepare(`
          UPDATE sessions
          SET terminated_at = datetime('now'), termination_reason = ?
          WHERE id = ? AND terminated_at IS NULL
        `)
        .run('idle_timeout', sessionId);

      // Task 9.3A: Log governance event (best-effort, never throws)
      this.governanceEventsService.logTerminationEvent(
        sessionId,
        session?.user_id ?? null,
        'idle_timeout',
        new Date().toISOString(),
      );

      // Clean up all in-memory tracking (must happen even if container cleanup fails)
      this.lastActivity.delete(sessionId);
      this.activeExecs.delete(sessionId);

      // Try to stop container (best-effort)
      try {
        await this.removeSessionContainer(sessionId);
      } catch (error) {
        console.error(
          `Failed to stop container for expired session ${sessionId}:`,
          error.message,
        );
        // Continue to throw GoneException even if container stop failed
      }

      // Reject request
      throw new GoneException(
        `Session ${sessionId} expired due to inactivity (reason: idle_timeout)`,
      );
    }
  }

  /**
   * Task 8.3A: Update last activity timestamp for a session
   * Called after successful operations
   *
   * @param sessionId - Session UUID
   */
  private updateLastActivity(sessionId: string): void {
    this.lastActivity.set(sessionId, Date.now());
  }

  /**
   * Task 9.5A: Check and enforce quota limits for a session
   * Request-time quota enforcement (blocks only on EXCEEDED status)
   * Fail-open: if quota evaluation fails, allow request
   *
   * @param sessionId - Session UUID
   * @throws TooManyRequestsException (HTTP 429) if quota exceeded
   */
  private async checkAndEnforceQuota(sessionId: string): Promise<void> {
    try {
      // Read session to get user_id
      const session = this.db
        .prepare('SELECT user_id FROM sessions WHERE id = ?')
        .get(sessionId) as { user_id: string } | undefined;

      if (!session) {
        // Session not found - already handled by assertSessionUsableOrThrow
        // Fail-open: allow request
        return;
      }

      // Get current month date range
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString();
      const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)).toISOString();

      // Check if user has exceeded quota
      const exceeded = this.quotaEvaluationService.hasUserExceededQuota(
        session.user_id,
        startDate,
        endDate,
      );

      if (exceeded) {
        // Reject request with HTTP 429
        throw new HttpException(
          {
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'Quota exceeded',
            details: {
              userId: session.user_id,
              periodStart: startDate,
              periodEnd: endDate,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Quota OK - allow request
    } catch (error) {
      // If error is HttpException with 429 status, re-throw it
      if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        throw error;
      }

      // Otherwise, fail-open (allow request despite evaluation failure)
      console.error(
        `[Task 9.5A] Quota evaluation failed for session ${sessionId}, failing open:`,
        error.message,
      );
      // Do not throw - allow request to proceed
    }
  }

  /**
   * Task 9.2A: Restore workspace from project archive
   * Extracts workspace.tar into session workspace directory
   * Ensures clean workspace before extraction
   *
   * @param projectId - Project ID
   * @param workspacePath - Session workspace path
   * @throws Error if archive missing or extraction fails
   */
  private async restoreWorkspaceFromProject(
    projectId: string,
    workspacePath: string,
  ): Promise<void> {
    console.log(`[Task 9.2A] Restoring workspace for project ${projectId} into ${workspacePath}`);

    const projectDir = this.projectsService.getProjectDirectory(projectId);
    const workspaceTarPath = path.join(projectDir, 'workspace.tar');

    // Verify archive exists
    try {
      await fs.access(workspaceTarPath);
    } catch (error) {
      throw new Error(`Workspace archive not found for project ${projectId}`);
    }

    // Ensure workspace directory is empty (clean restore)
    const entries = await fs.readdir(workspacePath);
    if (entries.length > 0) {
      console.log(`[Task 9.2A] Cleaning non-empty workspace before restore: ${workspacePath}`);
      // Delete all contents
      for (const entry of entries) {
        await fs.rm(path.join(workspacePath, entry), { recursive: true, force: true });
      }
    }

    // Extract archive
    try {
      await execAsync(`tar -xf "${workspaceTarPath}" -C "${workspacePath}"`);
      console.log(`[Task 9.2A] Workspace restored successfully for project ${projectId}`);
    } catch (error) {
      throw new Error(`Failed to extract workspace archive: ${error.message}`);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}
