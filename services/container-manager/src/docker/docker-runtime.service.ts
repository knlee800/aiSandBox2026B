import { Injectable, OnModuleInit } from '@nestjs/common';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import Docker from 'dockerode';
import { Duplex, Readable, Writable } from 'stream';
import { GovernanceConfig } from '../config/governance.config';

/**
 * CM-EXEC-01: the most bytes one exec keeps per stream (stdout and stderr
 * each). Past it the exec is cut off and fails with ExecOutputLimitError,
 * instead of building an unbounded string (which can throw "Invalid string
 * length" inside a stream callback and take container-manager down). 16 MiB
 * holds the largest planned output, an 8 MiB history-bundle slice, with room
 * to spare. Since CM-BINARY-01 history slices are read raw through the binary
 * exec, not in base64. A call may ask for a smaller cap, never a larger one.
 */
export const EXEC_OUTPUT_MAX_BYTES = 16 * 1024 * 1024;

export class ExecOutputLimitError extends Error {
  constructor(
    readonly stream: 'stdout' | 'stderr',
    readonly limitBytes: number,
  ) {
    super(`exec ${stream} output exceeded ${limitBytes} bytes`);
    this.name = 'ExecOutputLimitError';
  }
}

export interface ExecOptions {
  /** Per-stream byte cap for this call; at most EXEC_OUTPUT_MAX_BYTES. */
  maxOutputBytes?: number;
}

/** CM-EXEC-01: bytes to stream into an exec's stdin. */
export type ExecStdinInput = Buffer | Readable;

interface RawExecResult {
  exitCode: number;
  stdout: Buffer;
  stderr: Buffer;
}

const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE?.trim() || 'node:24-alpine';
const BROWSER_SANDBOX_IMAGE = 'aisandbox-workspace-browser:local';

export interface CreateContainerOptions {
  browserCapable?: boolean;
}

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
   * AGENT-HARNESS-05B1: Optional browserCapable path uses browser sandbox image
   *   with elevated resource limits and /dev/shm. Default path is unchanged.
   *
   * @param sessionId - Unique session identifier
   * @param workspacePath - Absolute path to session workspace on host
   * @param options - Optional container creation options
   * @returns Container ID
   */
  async createContainer(
    sessionId: string,
    workspacePath: string,
    options?: CreateContainerOptions,
  ): Promise<string> {
    const containerName = `sandbox-session-${sessionId}`;
    const browserCapable = options?.browserCapable === true;
    const imageName = browserCapable ? BROWSER_SANDBOX_IMAGE : SANDBOX_IMAGE;

    const doCreate = async (): Promise<string> => {
      let memoryBytes: number;
      let cpuLimit: number;
      let pidsLimit: number;

      if (browserCapable) {
        memoryBytes = this.governanceConfig.getBrowserContainerMemoryLimitBytes();
        cpuLimit = this.governanceConfig.browserContainerCpuLimit;
        pidsLimit = this.governanceConfig.browserContainerPidsLimit;
      } else {
        memoryBytes = this.governanceConfig.getContainerMemoryLimitBytes();
        cpuLimit = this.governanceConfig.containerCpuLimit;
        pidsLimit = this.governanceConfig.containerPidsLimit;
      }

      const nanoCpus = Math.floor(cpuLimit * 1e9);

      const hostConfig: Record<string, unknown> = {
        Binds: [`${workspacePath}:/workspace:rw`],
        AutoRemove: false,
        Memory: memoryBytes,
        NanoCpus: nanoCpus,
        PidsLimit: pidsLimit,
      };

      if (browserCapable) {
        hostConfig.ShmSize = this.governanceConfig.getBrowserContainerShmSizeBytes();
      }

      const container = await this.docker.createContainer({
        name: containerName,
        Image: imageName,
        WorkingDir: '/workspace',
        Cmd: ['/bin/sh', '-c', 'while true; do sleep 3600; done'],
        HostConfig: hostConfig as any,
        AttachStdin: false,
        AttachStdout: false,
        AttachStderr: false,
        Tty: false,
        OpenStdin: false,
      });

      console.log(`✓ Container created: ${containerName} (${container.id})`);
      if (browserCapable) {
        console.log(`  - Image: ${imageName} (browser-capable)`);
        console.log(`  - Memory limit: ${memoryBytes} bytes (${this.governanceConfig.browserContainerMemoryLimitMb}MB)`);
        console.log(`  - CPU limit: ${cpuLimit} cores (${nanoCpus} nanocpus)`);
        console.log(`  - PIDs limit: ${pidsLimit}`);
        console.log(`  - SHM size: ${this.governanceConfig.getBrowserContainerShmSizeBytes()} bytes (${this.governanceConfig.browserContainerShmSizeMb}MB)`);
      } else {
        console.log(`  - Memory limit: ${memoryBytes} bytes (${this.governanceConfig.containerMemoryLimitMb}MB)`);
        console.log(`  - CPU limit: ${cpuLimit} cores (${nanoCpus} nanocpus)`);
        console.log(`  - PIDs limit: ${pidsLimit}`);
      }
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
   * SESSION-STALE-01: Report whether the session container is running,
   * stopped, or absent. Uses the same sandbox-session-{sessionId} lookup
   * as findContainerBySessionId. A missing container is a state, not an
   * error. listContainers and inspect failures propagate unchanged.
   */
  async getSessionContainerState(
    sessionId: string,
  ): Promise<'running' | 'stopped' | 'missing'> {
    const containerName = `sandbox-session-${sessionId}`;
    const containers = await this.docker.listContainers({ all: true });

    const containerInfo = containers.find((c) =>
      c.Names.includes(`/${containerName}`),
    );

    if (!containerInfo) {
      return 'missing';
    }

    const container = this.docker.getContainer(containerInfo.Id);
    const inspect = await container.inspect();
    return inspect.State.Running ? 'running' : 'stopped';
  }

  /**
   * Execute a command inside a container by session ID
   * Task 7.1A: Internal Container Exec Primitive
   * Task 7.1B: Exec Parity & Hardening
   * CM-EXEC-01: output is collected as bytes, capped per stream at
   * EXEC_OUTPUT_MAX_BYTES (or a smaller per-call cap), and decoded as UTF-8
   * once at the end, so a character split across chunks survives.
   *
   * @param sessionId - Session identifier
   * @param cmd - Command array (e.g., ["node", "-v"])
   * @param cwd - Working directory (default: /workspace)
   * @param env - Environment variables as key-value pairs
   * @param timeoutMs - Execution timeout in milliseconds (default: 300000)
   * @param options - Optional per-call output cap
   * @returns Object with exitCode, stdout, stderr
   * @throws ExecOutputLimitError if stdout or stderr passes the cap
   * @throws Error if container not found, not running, or exec fails
   */
  async execInContainerBySessionId(
    sessionId: string,
    cmd: string[],
    cwd: string = '/workspace',
    env?: Record<string, string>,
    timeoutMs: number = 300000,
    options?: ExecOptions,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const raw = await this.runExecBySessionId(sessionId, cmd, cwd, env, timeoutMs, options);
    return {
      exitCode: raw.exitCode,
      stdout: raw.stdout.toString('utf8'),
      stderr: raw.stderr.toString('utf8'),
    };
  }

  /**
   * CM-EXEC-01: same as execInContainerBySessionId, but stdout comes back as
   * the exact bytes the command wrote (binary safe). stderr stays text.
   */
  async execInContainerBySessionIdBuffer(
    sessionId: string,
    cmd: string[],
    cwd: string = '/workspace',
    env?: Record<string, string>,
    timeoutMs: number = 300000,
    options?: ExecOptions,
  ): Promise<{ exitCode: number; stdout: Buffer; stderr: string }> {
    const raw = await this.runExecBySessionId(sessionId, cmd, cwd, env, timeoutMs, options);
    return {
      exitCode: raw.exitCode,
      stdout: raw.stdout,
      stderr: raw.stderr.toString('utf8'),
    };
  }

  /**
   * CM-EXEC-01: run a command with `input` streamed into its stdin (exec with
   * AttachStdin, started hijacked). A Buffer is written whole; a readable
   * stream is piped with backpressure. Stdin is ended when the input ends, so
   * the command sees EOF. The same output cap and timeout apply.
   */
  async execInContainerWithStdinBySessionId(
    sessionId: string,
    cmd: string[],
    input: ExecStdinInput,
    cwd: string = '/workspace',
    env?: Record<string, string>,
    timeoutMs: number = 300000,
    options?: ExecOptions,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    if (!Buffer.isBuffer(input) && typeof (input as Readable)?.pipe !== 'function') {
      throw new Error(
        `Failed to execute command in container for session ${sessionId}: Invalid exec input`,
      );
    }
    const raw = await this.runExecBySessionId(sessionId, cmd, cwd, env, timeoutMs, options, input);
    return {
      exitCode: raw.exitCode,
      stdout: raw.stdout.toString('utf8'),
      stderr: raw.stderr.toString('utf8'),
    };
  }

  private resolveExecOutputCap(options?: ExecOptions): number {
    const requested = options?.maxOutputBytes;
    if (requested === undefined) {
      return EXEC_OUTPUT_MAX_BYTES;
    }
    if (!Number.isSafeInteger(requested) || requested <= 0) {
      throw new Error('Invalid exec output cap');
    }
    return Math.min(requested, EXEC_OUTPUT_MAX_BYTES);
  }

  private async runExecBySessionId(
    sessionId: string,
    cmd: string[],
    cwd: string,
    env: Record<string, string> | undefined,
    timeoutMs: number,
    options: ExecOptions | undefined,
    stdin?: ExecStdinInput,
  ): Promise<RawExecResult> {
    try {
      const maxOutputBytes = this.resolveExecOutputCap(options);

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
        ...(stdin !== undefined ? { AttachStdin: true } : {}),
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: workingDir,
        Env: envArray,
      });

      return await this.collectExecOutput(container, exec, {
        timeoutMs,
        maxOutputBytes,
        stdin,
      });
    } catch (error) {
      if (error instanceof ExecOutputLimitError) {
        throw error;
      }
      throw new Error(
        `Failed to execute command in container for session ${sessionId}: ${error.message}`,
      );
    }
  }

  /**
   * CM-EXEC-01: start the exec, demultiplex its stream into byte sinks and
   * settle once. Every stream callback is guarded: nothing it does can throw
   * (no string is ever built from unbounded output, so no RangeError), and
   * after settling the sinks drop further data. Past the cap the stream is
   * destroyed and the call rejects with ExecOutputLimitError. On timeout the
   * stream is left to drain, as before (the sinks still consume it, so the
   * command is never blocked on a full pipe), but nothing more is kept.
   */
  private collectExecOutput(
    container: Docker.Container,
    exec: Docker.Exec,
    options: { timeoutMs: number; maxOutputBytes: number; stdin?: ExecStdinInput },
  ): Promise<RawExecResult> {
    const { timeoutMs, maxOutputBytes, stdin } = options;

    return new Promise<RawExecResult>((resolve, reject) => {
      let settled = false;
      let stream: Duplex | undefined;
      let timeoutId: NodeJS.Timeout | undefined;
      const sinks = {
        stdout: { chunks: [] as Buffer[], bytes: 0 },
        stderr: { chunks: [] as Buffer[], bytes: 0 },
      };

      const releaseInput = () => {
        if (stdin && !Buffer.isBuffer(stdin)) {
          try {
            if (stream) {
              stdin.unpipe(stream);
            }
            stdin.destroy();
          } catch {
            // best effort: the input is no longer needed
          }
        }
      };

      const settle = (error: Error | null, result?: RawExecResult) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        sinks.stdout.chunks = [];
        sinks.stderr.chunks = [];
        releaseInput();
        if (error) {
          reject(error);
        } else {
          resolve(result as RawExecResult);
        }
      };

      const destroyStream = () => {
        try {
          stream?.destroy();
        } catch {
          // best effort: the call has already failed
        }
      };

      const sink = (name: 'stdout' | 'stderr') =>
        new Writable({
          write(chunk: Buffer | string, _encoding: BufferEncoding, callback: () => void) {
            try {
              if (!settled) {
                const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                const target = sinks[name];
                if (target.bytes + bytes.length > maxOutputBytes) {
                  settle(new ExecOutputLimitError(name, maxOutputBytes));
                  destroyStream();
                } else {
                  target.bytes += bytes.length;
                  target.chunks.push(bytes);
                }
              }
            } catch (error) {
              settle(error instanceof Error ? error : new Error(String(error)));
            }
            callback();
          },
        });

      timeoutId = setTimeout(() => {
        settle(new Error(`Execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const startOptions =
        stdin !== undefined
          ? { hijack: true, stdin: true, Detach: false, Tty: false }
          : { Detach: false };

      exec
        .start(startOptions)
        .then((started) => {
          stream = started;

          // Dockerode returns a multiplexed stream for exec
          // We need to demultiplex it
          container.modem.demuxStream(started, sink('stdout'), sink('stderr'));

          started.on('end', () => {
            if (settled) {
              return;
            }
            exec.inspect().then(
              (execInspect) => {
                settle(null, {
                  exitCode: execInspect.ExitCode ?? 0,
                  stdout: Buffer.concat(sinks.stdout.chunks, sinks.stdout.bytes),
                  stderr: Buffer.concat(sinks.stderr.chunks, sinks.stderr.bytes),
                });
              },
              (error) => settle(error),
            );
          });

          started.on('error', (error: Error) => settle(error));

          if (stdin !== undefined) {
            if (Buffer.isBuffer(stdin)) {
              started.end(stdin);
            } else {
              stdin.on('error', (error: Error) => {
                settle(error);
                destroyStream();
              });
              // pipe() ends stdin on the exec when the input ends.
              stdin.pipe(started);
            }
          }
        })
        .catch((error) => settle(error));
    });
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
   * CM-EXEC-01: binary-safe file read. Same path checks, command, timeout and
   * errors as readFileFromContainer, but the file comes back as its exact
   * bytes. A file larger than the output cap fails with the cap's message.
   *
   * @param sessionId - Session identifier
   * @param filePath - Relative path from /workspace
   * @param options - Optional smaller output cap
   * @returns File content as a Buffer
   */
  async readFileBufferFromContainer(
    sessionId: string,
    filePath: string,
    options?: ExecOptions,
  ): Promise<Buffer> {
    try {
      this.validateWorkspacePath(filePath);

      const container = await this.findContainerBySessionId(sessionId);
      const inspect = await container.inspect();
      if (!inspect.State.Running) {
        throw new Error(`Container for session ${sessionId} is not running`);
      }

      const result = await this.execInContainerBySessionIdBuffer(
        sessionId,
        ['cat', `/workspace/${filePath}`],
        '/workspace',
        undefined,
        30000,
        options,
      );

      if (result.exitCode !== 0) {
        throw new Error(`File not found or cannot be read: ${filePath}`);
      }

      return result.stdout;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
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

      const stdoutText = `${result.stdout ?? ''}`;
      const stderrText = `${result.stderr ?? ''}`.trim();
      if (
        result.exitCode === 1 &&
        stdoutText.trim().length === 0 &&
        stderrText.length === 0
      ) {
        return {
          query: normalizedQuery,
          results: [],
          truncated: false,
        };
      }
      if (result.exitCode !== 0 && stdoutText.trim().length === 0) {
        throw new Error(
          `Search script failed with exitCode=${result.exitCode}`,
        );
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
