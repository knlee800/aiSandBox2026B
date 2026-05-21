import { Injectable, OnModuleInit } from '@nestjs/common';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import Docker from 'dockerode';
import { GovernanceConfig } from '../config/governance.config';

const SANDBOX_IMAGE = 'node:20-alpine';
const WORKSPACE_SEARCH_MAX_QUERY_LENGTH = 120;
const WORKSPACE_SEARCH_MAX_FILES_SCANNED = 200;
const WORKSPACE_SEARCH_MAX_MATCHES = 20;
const WORKSPACE_SEARCH_MAX_PREVIEW_CHARS = 240;
const WORKSPACE_SEARCH_MAX_TOTAL_RESPONSE_CHARS = 8000;
const WORKSPACE_SEARCH_MAX_FILE_BYTES = 262_144;
const WORKSPACE_SEARCH_TRUNCATED_MARKER = '__AI_WS_SEARCH_TRUNCATED__';

/**
 * DockerRuntimeService
 * Manages Docker container lifecycle for sandbox sessions
 * Each session gets one isolated Docker container
 *
 * Task 8.1B: Enforces Docker resource limits at container creation
 * TASK-56B: Auto-pulls missing image before retry on fresh hosts
 */
@Injectable()
export class DockerRuntimeService implements OnModuleInit {
  private docker: Docker;

  constructor(private governanceConfig: GovernanceConfig) {
    // Initialize Docker client with platform-aware socket path
    this.docker = new Docker({
      socketPath: process.platform === 'win32'
        ? '//./pipe/docker_engine'
        : '/var/run/docker.sock',
    });
  }

  /**
   * Verify Docker daemon connectivity on module initialization
   * Fail-fast if Docker is unreachable
   */
  async onModuleInit() {
    try {
      await this.docker.ping();
      console.log('✓ Docker daemon connection verified');
    } catch (error) {
      throw new Error(
        `FATAL: Cannot connect to Docker daemon. Ensure Docker is running and DOCKER_HOST is configured correctly. Error: ${error.message}`,
      );
    }
  }

  /**
   * Create a Docker container for a session
   * Does NOT start the container - use startContainer() separately
   *
   * Task 8.1B: Enforces resource limits from GovernanceConfig
   * TASK-56B: On missing image, pulls then retries once
   *
   * @param sessionId - Unique session identifier
   * @param workspacePath - Absolute path to session workspace on host
   * @returns Container ID
   */
  async createContainer(
    sessionId: string,
    workspacePath: string,
  ): Promise<string> {
    const containerName = `sandbox-session-${sessionId}`;
    const imageName = SANDBOX_IMAGE;

    const doCreate = async (): Promise<string> => {
      const memoryBytes = this.governanceConfig.getContainerMemoryLimitBytes();
      const cpuLimit = this.governanceConfig.containerCpuLimit;
      const pidsLimit = this.governanceConfig.containerPidsLimit;
      const nanoCpus = Math.floor(cpuLimit * 1e9);

      const container = await this.docker.createContainer({
        name: containerName,
        Image: imageName,
        WorkingDir: '/workspace',
        Cmd: ['/bin/sh', '-c', 'while true; do sleep 3600; done'],
        HostConfig: {
          Binds: [`${workspacePath}:/workspace:rw`],
          AutoRemove: false,
          Memory: memoryBytes,
          NanoCpus: nanoCpus,
          PidsLimit: pidsLimit,
        },
        AttachStdin: false,
        AttachStdout: false,
        AttachStderr: false,
        Tty: false,
        OpenStdin: false,
      });

      console.log(`✓ Container created: ${containerName} (${container.id})`);
      console.log(`  - Memory limit: ${memoryBytes} bytes (${this.governanceConfig.containerMemoryLimitMb}MB)`);
      console.log(`  - CPU limit: ${cpuLimit} cores (${nanoCpus} nanocpus)`);
      console.log(`  - PIDs limit: ${pidsLimit}`);
      return container.id;
    };

    try {
      return await doCreate();
    } catch (error) {
      if (!this.isMissingImageError(error)) {
        throw new Error(
          `Failed to create container for session ${sessionId}: ${error.message}`,
        );
      }
      await this.ensureImagePresent(imageName);
      try {
        return await doCreate();
      } catch (retryError) {
        throw new Error(
          `Failed to create container for session ${sessionId} after pulling image: ${retryError.message}`,
        );
      }
    }
  }

  /**
   * TASK-56B/56C: Detect missing image error from Docker API.
   * Excludes "pull access denied" so it surfaces as failure.
   */
  private isMissingImageError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { statusCode?: number; message?: string };
    const msg = (e.message || '').toLowerCase();
    if (msg.includes('pull access denied')) return false;
    const is404 = e.statusCode === 404;
    const isMissing =
      msg.includes('no such image') ||
      msg.includes('not found') ||
      msg.includes('image not found') ||
      msg.includes('does not exist');
    return is404 && isMissing;
  }

  /**
   * TASK-56B: Pull image via Docker API; logs once.
   * Uses dockerode pull + followProgress.
   */
  private async ensureImagePresent(imageName: string): Promise<void> {
    console.log(`pulling missing image ${imageName}`);
    await new Promise<void>((resolve, reject) => {
      this.docker.pull(imageName, (err, stream) => {
        if (err) return reject(err);
        this.docker.modem.followProgress(stream, (e: Error | null) =>
          e ? reject(e) : resolve(),
        );
      });
    });
  }

  /**
   * Start a Docker container
   * Blocks until container is running or fails
   *
   * @param containerId - Docker container ID
   */
  async startContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.start();

      // Verify container is running
      const inspect = await container.inspect();
      if (!inspect.State.Running) {
        throw new Error('Container failed to reach running state');
      }

      console.log(`✓ Container started: ${containerId}`);
    } catch (error) {
      throw new Error(
        `Failed to start container ${containerId}: ${error.message}`,
      );
    }
  }

  /**
   * Stop a Docker container
   * Waits for graceful shutdown (10 second timeout, then force kill)
   *
   * @param containerId - Docker container ID
   */
  async stopContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop({ t: 10 }); // 10 second graceful shutdown timeout

      console.log(`✓ Container stopped: ${containerId}`);
    } catch (error) {
      // Ignore "container already stopped" errors
      if (error.statusCode === 304) {
        console.log(`✓ Container already stopped: ${containerId}`);
        return;
      }
      throw new Error(
        `Failed to stop container ${containerId}: ${error.message}`,
      );
    }
  }

  /**
   * Remove a Docker container
   * Container must be stopped before removal
   *
   * @param containerId - Docker container ID
   */
  async removeContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.remove({ force: false }); // Require explicit stop first

      console.log(`✓ Container removed: ${containerId}`);
    } catch (error) {
      // Ignore "container not found" errors
      if (error.statusCode === 404) {
        console.log(`✓ Container not found (already removed): ${containerId}`);
        return;
      }
      throw new Error(
        `Failed to remove container ${containerId}: ${error.message}`,
      );
    }
  }

  /**
   * Find a container by session ID
   * Resolves container using naming convention: sandbox-session-{sessionId}
   *
   * @param sessionId - Session identifier
   * @returns Docker Container instance
   * @throws Error if container not found
   */
  async findContainerBySessionId(sessionId: string): Promise<Docker.Container> {
    try {
      const containerName = `sandbox-session-${sessionId}`;
      const containers = await this.docker.listContainers({ all: true });

      const containerInfo = containers.find((c) =>
        c.Names.includes(`/${containerName}`),
      );

      if (!containerInfo) {
        throw new Error(`Container not found for session ${sessionId}`);
      }

      return this.docker.getContainer(containerInfo.Id);
    } catch (error) {
      throw new Error(
        `Failed to find container for session ${sessionId}: ${error.message}`,
      );
    }
  }

  /**
   * Execute a command inside a container by session ID
   * Task 7.1A: Internal Container Exec Primitive
   * Task 7.1B: Exec Parity & Hardening
   *
   * @param sessionId - Session identifier
   * @param cmd - Command array (e.g., ["node", "-v"])
   * @param cwd - Working directory (default: /workspace)
   * @param env - Environment variables as key-value pairs
   * @param timeoutMs - Execution timeout in milliseconds (default: 300000)
   * @returns Object with exitCode, stdout, stderr
   * @throws Error if container not found, not running, or exec fails
   */
  async execInContainerBySessionId(
    sessionId: string,
    cmd: string[],
    cwd: string = '/workspace',
    env?: Record<string, string>,
    timeoutMs: number = 300000,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    try {
      // Find container by session ID
      const container = await this.findContainerBySessionId(sessionId);

      // Verify container is running
      const inspect = await container.inspect();
      if (!inspect.State.Running) {
        throw new Error(`Container for session ${sessionId} is not running`);
      }

      // Ensure cwd defaults to /workspace if empty or undefined
      const workingDir = cwd && cwd.trim() !== '' ? cwd : '/workspace';

      // Convert env object to array format ["KEY=VALUE"]
      // Filter out non-string values for safety
      const envArray = env
        ? Object.entries(env)
            .filter(([_, value]) => typeof value === 'string')
            .map(([key, value]) => `${key}=${value}`)
        : undefined;

      // Create exec instance
      const exec = await container.exec({
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: workingDir,
        Env: envArray,
      });

      // Track timeout ID for cleanup
      let timeoutId: NodeJS.Timeout | undefined;

      // Execute with timeout
      const execPromise = new Promise<{
        exitCode: number;
        stdout: string;
        stderr: string;
      }>(async (resolve, reject) => {
        // Guard against duplicate resolve/reject calls
        let settled = false;

        const safeResolve = (result: {
          exitCode: number;
          stdout: string;
          stderr: string;
        }) => {
          if (!settled) {
            settled = true;
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            resolve(result);
          }
        };

        const safeReject = (error: Error) => {
          if (!settled) {
            settled = true;
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            reject(error);
          }
        };

        try {
          const stream = await exec.start({ Detach: false });

          let stdout = '';
          let stderr = '';

          // Dockerode returns a multiplexed stream for exec
          // We need to demultiplex it
          const stdoutStream = new (require('stream').Writable)();
          const stderrStream = new (require('stream').Writable)();

          stdoutStream._write = (
            chunk: Buffer,
            encoding: string,
            callback: () => void,
          ) => {
            stdout += chunk.toString();
            callback();
          };

          stderrStream._write = (
            chunk: Buffer,
            encoding: string,
            callback: () => void,
          ) => {
            stderr += chunk.toString();
            callback();
          };

          // Demultiplex the stream
          container.modem.demuxStream(stream, stdoutStream, stderrStream);

          stream.on('end', async () => {
            try {
              // Inspect exec to get exit code
              const execInspect = await exec.inspect();
              safeResolve({
                exitCode: execInspect.ExitCode ?? 0,
                stdout,
                stderr,
              });
            } catch (error) {
              safeReject(error);
            }
          });

          stream.on('error', safeReject);
        } catch (error) {
          safeReject(error);
        }
      });

      // Enforce timeout with cleanup
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Execution timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      return await Promise.race([execPromise, timeoutPromise]);
    } catch (error) {
      throw new Error(
        `Failed to execute command in container for session ${sessionId}: ${error.message}`,
      );
    }
  }

  /**
   * Read a file from container filesystem by session ID
   * Task 7.2A: Container File Read (Read-Only)
   * Task 7.2A-1: Invalid Path → 400
   *
   * @param sessionId - Session identifier
   * @param filePath - Relative path from /workspace (e.g., "index.js", "src/app.ts")
   * @returns File content as UTF-8 string
   * @throws BadRequestException if path is invalid
   * @throws Error if container not found, not running, or file read fails
   */
  async readFileFromContainer(
    sessionId: string,
    filePath: string,
  ): Promise<string> {
    try {
      // Validate path safety (throws BadRequestException on invalid path)
      this.validateWorkspacePath(filePath);

      // Find container by session ID
      const container = await this.findContainerBySessionId(sessionId);

      // Verify container is running
      const inspect = await container.inspect();
      if (!inspect.State.Running) {
        throw new Error(`Container for session ${sessionId} is not running`);
      }

      // Resolve full path as /workspace/{path}
      const fullPath = `/workspace/${filePath}`;

      // Read file using cat command via exec
      const result = await this.execInContainerBySessionId(
        sessionId,
        ['cat', fullPath],
        '/workspace',
        undefined,
        30000, // 30 second timeout for file read
      );

      // Check if cat command succeeded
      if (result.exitCode !== 0) {
        throw new Error(`File not found or cannot be read: ${filePath}`);
      }

      return result.stdout;
    } catch (error) {
      // Re-throw BadRequestException as-is (HTTP 400)
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Wrap other errors (file-not-found, Docker failures) as HTTP 500
      throw new Error(
        `Failed to read file from container for session ${sessionId}: ${error.message}`,
      );
    }
  }

  /**
   * Write a file to container filesystem by session ID
   * Task 7.2B: Container File Write (Create / Overwrite)
   *
   * @param sessionId - Session identifier
   * @param filePath - Relative path from /workspace (e.g., "index.js", "src/app.ts")
   * @param content - File content as UTF-8 string
   * @throws BadRequestException if path is invalid
   * @throws Error if container not found, not running, or file write fails
   */
  async writeFileToContainer(
    sessionId: string,
    filePath: string,
    content: string,
  ): Promise<void> {
    try {
      // Validate path safety (throws BadRequestException on invalid path)
      this.validateWorkspacePath(filePath);

      // Find container by session ID
      const container = await this.findContainerBySessionId(sessionId);

      // Verify container is running
      const inspect = await container.inspect();
      if (!inspect.State.Running) {
        throw new Error(`Container for session ${sessionId} is not running`);
      }

      // Resolve full path as /workspace/{path}
      const fullPath = `/workspace/${filePath}`;

      // Create parent directories and write file using printf (safe for any content)
      // Pass FILE and CONTENT as env vars to avoid shell escaping issues
      const result = await this.execInContainerBySessionId(
        sessionId,
        ['sh', '-c', 'mkdir -p "$(dirname "$FILE")" && printf "%s" "$CONTENT" > "$FILE"'],
        '/workspace',
        {
          FILE: fullPath,
          CONTENT: content,
        },
        30000, // 30 second timeout for file write
      );

      // Check if write command succeeded
      if (result.exitCode !== 0) {
        throw new Error(`Failed to write file: ${filePath}`);
      }
    } catch (error) {
      // Re-throw BadRequestException as-is (HTTP 400)
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Wrap other errors (container errors, write failures) as HTTP 500
      throw new Error(
        `Failed to write file to container for session ${sessionId}: ${error.message}`,
      );
    }
  }

  /**
   * Delete a file from container filesystem by session ID
   * Task AI-WS-03-hotfix5: Route file delete through container exec
   *
   * @param sessionId - Session identifier
   * @param filePath - Relative path from /workspace (e.g., "index.js", "src/app.ts")
   * @throws BadRequestException if path is invalid or points to a directory
   * @throws NotFoundException if file does not exist
   * @throws Error if container not found, not running, or delete fails
   */
  async deleteFileFromContainer(
    sessionId: string,
    filePath: string,
  ): Promise<void> {
    try {
      this.validateWorkspacePath(filePath);

      const container = await this.findContainerBySessionId(sessionId);
      const inspect = await container.inspect();
      if (!inspect.State.Running) {
        throw new Error(`Container for session ${sessionId} is not running`);
      }

      const fullPath = `/workspace/${filePath}`;
      const result = await this.execInContainerBySessionId(
        sessionId,
        ['rm', fullPath],
        '/workspace',
        undefined,
        30000,
      );

      if (result.exitCode !== 0) {
        const stderr = `${result.stderr ?? ''}`.trim();
        if (/No such file/i.test(stderr)) {
          throw new NotFoundException(`File not found: ${filePath}`);
        }
        if (/Is a directory/i.test(stderr)) {
          throw new BadRequestException('Directory delete is not supported');
        }
        throw new Error(`Failed to delete file: ${filePath}`);
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new Error(
        `Failed to delete file from container for session ${sessionId}: ${error.message}`,
      );
    }
  }

  /**
   * Search text-like files in container filesystem by session ID
   * Task AI-WS-06-hotfix: Route workspace search through container exec
   *
   * @param sessionId - Session identifier
   * @param query - Plain-text query to search for
   * @returns Structured bounded search results
   * @throws BadRequestException if query is invalid
   * @throws Error if container not found, not running, or search fails
   */
  async searchFilesInContainer(
    sessionId: string,
    query: string,
  ): Promise<{
    query: string;
    results: Array<{ path: string; line: number; preview: string }>;
    truncated: boolean;
  }> {
    try {
      const normalizedQuery = this.normalizeWorkspaceSearchQuery(query);

      const container = await this.findContainerBySessionId(sessionId);
      const inspect = await container.inspect();
      if (!inspect.State.Running) {
        throw new Error(`Container for session ${sessionId} is not running`);
      }

      const searchScript = `
        files="$(
          find /workspace \
            \\( -type d \\( \
              -name '.git' -o \
              -name 'node_modules' -o \
              -name 'dist' -o \
              -name 'build' -o \
              -name '.next' -o \
              -name 'coverage' -o \
              -name 'vendor' -o \
              -name 'generated' -o \
              -name '.turbo' -o \
              -name '.cache' \
            \\) -prune \\) -o \
            \\( -type f -size -${WORKSPACE_SEARCH_MAX_FILE_BYTES + 1}c \
              ! -name '.env' \
              ! -name '.env.*' \
              ! -name '*.env' \
              ! -name '*.env.*' \
              ! -name '*.key' \
              ! -name '*.pem' \
              ! -name '*.cert' \
              ! -name '*.secret' \
              ! -name '*.credentials' \
              ! -name 'package-lock.json' \
              ! -name 'yarn.lock' \
              ! -name 'pnpm-lock.yaml' \
              ! -name '*.lock' \
              ! -name '*.min.js' \
              ! -name '*.min.css' \
              ! -name '*.map' \
              ! -name '*.png' \
              ! -name '*.jpg' \
              ! -name '*.jpeg' \
              ! -name '*.gif' \
              ! -name '*.ico' \
              ! -name '*.webp' \
              ! -name '*.svg' \
              ! -name '*.woff' \
              ! -name '*.woff2' \
              ! -name '*.ttf' \
              ! -name '*.eot' \
              ! -name '*.mp4' \
              ! -name '*.mp3' \
              ! -name '*.zip' \
              ! -name '*.gz' \
              ! -name '*.tar' \
              ! -name '*.bin' \
              ! -name '*.exe' \
              ! -name '*.dll' \
              ! -name '*.so' \
              ! -name '*.pdf' \
              -print \
            \\)
        )" || exit $?

        files_scanned=0
        printf '%s\n' "$files" | while IFS= read -r file; do
          [ -n "$file" ] || continue
          files_scanned=$((files_scanned + 1))
          if [ "$files_scanned" -gt ${WORKSPACE_SEARCH_MAX_FILES_SCANNED} ]; then
            echo '${WORKSPACE_SEARCH_TRUNCATED_MARKER}'
            break
          fi
          grep -FnHi -e "$QUERY" "$file" 2>/dev/null || true
        done
      `.trim();

      const result = await this.execInContainerBySessionId(
        sessionId,
        ['sh', '-c', searchScript],
        '/workspace',
        { QUERY: normalizedQuery },
        30000,
      );

      if (result.exitCode !== 0 && `${result.stdout ?? ''}`.trim().length === 0) {
        const stderr = `${result.stderr ?? ''}`.trim();
        if (stderr.length > 0) {
          console.warn(
            `[AI-WS-06-hotfix2] Search script failed for session ${sessionId}: exitCode=${result.exitCode}, stderr=${stderr}`,
          );
        }
        return {
          query: normalizedQuery,
          results: [],
          truncated: false,
        };
      }
      if (result.exitCode !== 0) {
        throw new Error(`Failed to search files for query: ${normalizedQuery}`);
      }

      return this.parseWorkspaceSearchOutput(normalizedQuery, result.stdout ?? '');
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error(
        `Failed to search files in container for session ${sessionId}: ${error.message}`,
      );
    }
  }

  /**
   * List directory contents from container filesystem by session ID
   * Task 7.2C: Container Directory Listing (Read-Only)
   *
   * @param sessionId - Session identifier
   * @param dirPath - Relative path from /workspace (empty or "/" means root)
   * @returns Array of directory entries with name, type, size, modifiedAt
   * @throws BadRequestException if path is invalid
   * @throws Error if container not found, not running, or listing fails
   */
  async listDirectoryInContainer(
    sessionId: string,
    dirPath: string = '/',
  ): Promise<
    Array<{ name: string; type: 'file' | 'dir'; size: number; modifiedAt: string }>
  > {
    try {
      // Normalize path: empty or "/" means root workspace
      const normalizedPath = !dirPath || dirPath === '/' ? '' : dirPath;

      // Validate if not root
      if (normalizedPath) {
        this.validateWorkspacePath(normalizedPath);
      }

      // Find container by session ID
      const container = await this.findContainerBySessionId(sessionId);

      // Verify container is running
      const inspect = await container.inspect();
      if (!inspect.State.Running) {
        throw new Error(`Container for session ${sessionId} is not running`);
      }

      // Resolve full path
      const fullPath = normalizedPath ? `/workspace/${normalizedPath}` : '/workspace';

      // Shell script to list directory with structured output
      // Uses pipe-separated format: name|type|size|mtime
      const listScript = `
        cd "$DIR" || exit 1
        for f in * .[^.]* ..?*; do
          [ -e "$f" ] || continue
          [ "$f" = "." ] && continue
          [ "$f" = ".." ] && continue
          if [ -d "$f" ]; then
            type="dir"
          elif [ -f "$f" ]; then
            type="file"
          else
            continue
          fi
          size=$(stat -c %s "$f" 2>/dev/null || echo "0")
          mtime=$(stat -c %Y "$f" 2>/dev/null || echo "0")
          echo "$f|$type|$size|$mtime"
        done
      `.trim();

      // Execute listing via container exec
      const result = await this.execInContainerBySessionId(
        sessionId,
        ['sh', '-c', listScript],
        '/workspace',
        { DIR: fullPath },
        30000, // 30 second timeout
      );

      // Check if listing succeeded
      if (result.exitCode !== 0) {
        throw new Error(`Directory not found or cannot be read: ${dirPath}`);
      }

      // Parse output into structured entries
      const entries = result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => {
          const [name, type, sizeStr, mtimeStr] = line.split('|');
          const size = parseInt(sizeStr, 10) || 0;
          const mtimeUnix = parseInt(mtimeStr, 10) || 0;
          const modifiedAt = new Date(mtimeUnix * 1000).toISOString();

          return {
            name,
            type: type as 'file' | 'dir',
            size,
            modifiedAt,
          };
        });

      return entries;
    } catch (error) {
      // Re-throw BadRequestException as-is (HTTP 400)
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Wrap other errors (directory-not-found, Docker failures) as HTTP 500
      throw new Error(
        `Failed to list directory in container for session ${sessionId}: ${error.message}`,
      );
    }
  }

  /**
   * Get file/directory metadata from container filesystem by session ID
   * Task 7.2D: Container File Stat / Existence
   *
   * @param sessionId - Session identifier
   * @param filePath - Relative path from /workspace
   * @returns Object with path, exists, and metadata if exists
   * @throws BadRequestException if path is invalid
   * @throws Error if container not found, not running, or stat fails
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
    try {
      // Validate path safety (throws BadRequestException on invalid path)
      this.validateWorkspacePath(filePath);

      // Find container by session ID
      const container = await this.findContainerBySessionId(sessionId);

      // Verify container is running
      const inspect = await container.inspect();
      if (!inspect.State.Running) {
        throw new Error(`Container for session ${sessionId} is not running`);
      }

      // Resolve full path as /workspace/{path}
      const fullPath = `/workspace/${filePath}`;

      // Shell script to check existence and get metadata
      // Exit code 0 if exists, 1 if not exists
      const statScript = `
        if [ ! -e "$PATH" ]; then
          echo "exists=false"
          exit 0
        fi
        if [ -d "$PATH" ]; then
          type="dir"
        elif [ -f "$PATH" ]; then
          type="file"
        else
          type="other"
        fi
        size=$(stat -c %s "$PATH" 2>/dev/null || echo "0")
        mtime=$(stat -c %Y "$PATH" 2>/dev/null || echo "0")
        echo "exists=true|type=$type|size=$size|mtime=$mtime"
      `.trim();

      // Execute stat via container exec
      const result = await this.execInContainerBySessionId(
        sessionId,
        ['sh', '-c', statScript],
        '/workspace',
        { PATH: fullPath },
        30000, // 30 second timeout
      );

      // Parse output
      const output = result.stdout.trim();

      // Check if path doesn't exist
      if (output === 'exists=false') {
        return {
          path: filePath,
          exists: false,
        };
      }

      // Parse metadata from pipe-separated output
      const parts = output.replace('exists=true|', '').split('|');
      const metadata: Record<string, string> = {};
      parts.forEach((part) => {
        const [key, value] = part.split('=');
        metadata[key] = value;
      });

      const type = metadata.type === 'dir' ? 'dir' : 'file';
      const size = parseInt(metadata.size, 10) || 0;
      const mtimeUnix = parseInt(metadata.mtime, 10) || 0;
      const modifiedAt = new Date(mtimeUnix * 1000).toISOString();

      return {
        path: filePath,
        exists: true,
        type,
        size,
        modifiedAt,
      };
    } catch (error) {
      // Re-throw BadRequestException as-is (HTTP 400)
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Wrap other errors (container errors, stat failures) as HTTP 500
      throw new Error(
        `Failed to stat path in container for session ${sessionId}: ${error.message}`,
      );
    }
  }

  /**
   * Validate that a path is safe for workspace operations
   * Rejects path traversal attempts and absolute paths outside /workspace
   * Task 7.2A-1: Throws BadRequestException for invalid paths (HTTP 400)
   *
   * @param filePath - Relative path to validate
   * @throws BadRequestException if path is unsafe
   */
  private validateWorkspacePath(filePath: string): void {
    // Reject empty paths
    if (!filePath || filePath.trim() === '') {
      throw new BadRequestException('File path is required');
    }

    // Reject path traversal attempts
    const pathSegments = filePath.split('/');
    if (pathSegments.some((segment) => segment === '..')) {
      throw new BadRequestException('Path traversal not allowed');
    }

    // Reject absolute paths that don't start with /workspace
    if (filePath.startsWith('/') && !filePath.startsWith('/workspace')) {
      throw new BadRequestException('Absolute paths outside /workspace not allowed');
    }

    // Reject paths that try to escape workspace via absolute path
    if (filePath.startsWith('/workspace')) {
      throw new BadRequestException('Path must be relative to /workspace');
    }
  }

  private normalizeWorkspaceSearchQuery(query: string): string {
    if (typeof query !== 'string') {
      throw new BadRequestException('Search query is required');
    }

    if (/[\u0000-\u001f\u007f]/.test(query)) {
      throw new BadRequestException('Search query contains unsupported control characters');
    }

    const normalizedQuery = query.trim().replace(/\s+/g, ' ');
    if (!normalizedQuery) {
      throw new BadRequestException('Search query is required');
    }
    if (normalizedQuery.length > WORKSPACE_SEARCH_MAX_QUERY_LENGTH) {
      throw new BadRequestException(
        `Search query must be at most ${WORKSPACE_SEARCH_MAX_QUERY_LENGTH} characters`,
      );
    }

    return normalizedQuery;
  }

  private parseWorkspaceSearchOutput(
    query: string,
    stdout: string,
  ): {
    query: string;
    results: Array<{ path: string; line: number; preview: string }>;
    truncated: boolean;
  } {
    const results: Array<{ path: string; line: number; preview: string }> = [];
    let totalResponseChars = 0;
    let truncated = false;

    for (const rawLine of stdout.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }
      if (line === WORKSPACE_SEARCH_TRUNCATED_MARKER) {
        truncated = true;
        continue;
      }

      const firstColonIndex = line.indexOf(':');
      const secondColonIndex =
        firstColonIndex >= 0 ? line.indexOf(':', firstColonIndex + 1) : -1;
      if (firstColonIndex <= 0 || secondColonIndex <= firstColonIndex + 1) {
        continue;
      }

      const rawPath = line.slice(0, firstColonIndex);
      const path = rawPath.startsWith('/workspace/')
        ? rawPath.slice('/workspace/'.length)
        : rawPath === '/workspace'
          ? ''
          : rawPath;
      if (!path || this.shouldSkipSearchResultPath(path)) {
        continue;
      }

      const parsedLineNumber = Number.parseInt(
        line.slice(firstColonIndex + 1, secondColonIndex),
        10,
      );
      if (!Number.isFinite(parsedLineNumber) || parsedLineNumber < 1) {
        continue;
      }

      const preview = this.normalizeSearchPreview(line.slice(secondColonIndex + 1));
      if (!preview) {
        continue;
      }

      const nextResultCharCount = path.length + preview.length + String(parsedLineNumber).length + 8;
      if (
        results.length >= WORKSPACE_SEARCH_MAX_MATCHES ||
        totalResponseChars + nextResultCharCount > WORKSPACE_SEARCH_MAX_TOTAL_RESPONSE_CHARS
      ) {
        truncated = true;
        break;
      }

      results.push({
        path,
        line: parsedLineNumber,
        preview,
      });
      totalResponseChars += nextResultCharCount;
    }

    return {
      query,
      results,
      truncated,
    };
  }

  private shouldSkipSearchResultPath(relativePath: string): boolean {
    const normalizedPath = relativePath.trim().toLowerCase();
    const fileName = normalizedPath.split('/').pop() ?? '';

    if (
      fileName === '.env' ||
      fileName.startsWith('.env.') ||
      fileName.endsWith('.env') ||
      fileName.includes('.env.') ||
      fileName.endsWith('.key') ||
      fileName.endsWith('.pem') ||
      fileName.endsWith('.cert') ||
      fileName.endsWith('.secret') ||
      fileName.endsWith('.credentials') ||
      fileName === 'package-lock.json' ||
      fileName === 'yarn.lock' ||
      fileName === 'pnpm-lock.yaml' ||
      fileName.endsWith('.lock') ||
      fileName.endsWith('.min.js') ||
      fileName.endsWith('.min.css') ||
      fileName.endsWith('.map') ||
      fileName.endsWith('.png') ||
      fileName.endsWith('.jpg') ||
      fileName.endsWith('.jpeg') ||
      fileName.endsWith('.gif') ||
      fileName.endsWith('.ico') ||
      fileName.endsWith('.webp') ||
      fileName.endsWith('.svg') ||
      fileName.endsWith('.woff') ||
      fileName.endsWith('.woff2') ||
      fileName.endsWith('.ttf') ||
      fileName.endsWith('.eot') ||
      fileName.endsWith('.mp4') ||
      fileName.endsWith('.mp3') ||
      fileName.endsWith('.zip') ||
      fileName.endsWith('.gz') ||
      fileName.endsWith('.tar') ||
      fileName.endsWith('.bin') ||
      fileName.endsWith('.exe') ||
      fileName.endsWith('.dll') ||
      fileName.endsWith('.so') ||
      fileName.endsWith('.pdf')
    ) {
      return true;
    }

    return (
      normalizedPath.includes('/.git/') ||
      normalizedPath.includes('/node_modules/') ||
      normalizedPath.includes('/dist/') ||
      normalizedPath.includes('/build/') ||
      normalizedPath.includes('/.next/') ||
      normalizedPath.includes('/coverage/') ||
      normalizedPath.includes('/vendor/') ||
      normalizedPath.includes('/generated/') ||
      normalizedPath.includes('/.turbo/') ||
      normalizedPath.includes('/.cache/')
    );
  }

  private normalizeSearchPreview(preview: string): string {
    const normalizedPreview = preview.replace(/\t/g, ' ').trim();
    if (!normalizedPreview) {
      return '';
    }
    if (normalizedPreview.length <= WORKSPACE_SEARCH_MAX_PREVIEW_CHARS) {
      return normalizedPreview;
    }
    return `${normalizedPreview.slice(0, WORKSPACE_SEARCH_MAX_PREVIEW_CHARS - 3)}...`;
  }

  /**
   * Ping Docker daemon to check connectivity
   * PHASE-41A: Added for runtime metrics
   * @returns Promise that resolves if Docker is reachable
   * @throws Error if Docker is unreachable
   */
  async pingDocker(): Promise<void> {
    await this.docker.ping();
  }

  /**
   * List all running containers
   * PHASE-41A: Added for runtime metrics
   * @returns Array of running container info
   */
  async listRunningContainers(): Promise<Docker.ContainerInfo[]> {
    return await this.docker.listContainers({
      filters: { status: ['running'] },
    });
  }
}
