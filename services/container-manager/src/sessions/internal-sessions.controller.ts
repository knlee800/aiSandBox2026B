import {
  Controller,
  Delete,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';
import { ExecCommandDto, ExecResultDto } from './dto/exec.dto';
import { BrowserSmokeService, BrowserSmokeResult } from '../browser-smoke/browser-smoke.service';

/**
 * InternalSessionsController
 * Task 6.5: Explicit Container Deletion
 * Task 7.1A: Internal Container Exec Primitive
 * Task 7.2A: Container File Read (Read-Only)
 * Task 7.2B: Container File Write (Create / Overwrite)
 *
 * Internal-only endpoints for container lifecycle management
 * Protected by X-Internal-Service-Key authentication
 */
@Controller('internal/sessions')
@UseGuards(InternalServiceAuthGuard)
export class InternalSessionsController {
  constructor(
    private sessionsService: SessionsService,
    private browserSmokeService: BrowserSmokeService,
  ) {}

  /**
   * POST /api/internal/sessions/:id/start
   * Start a session's Docker container with optional browser-capable mode
   * AGENT-HARNESS-05B5A: Internal-only browser-capable session creation wiring
   *
   * Request body:
   * - userId (optional): User ID to associate with the session
   * - browserCapable (optional): If true, creates a browser-capable container
   *   using aisandbox-workspace-browser:local with elevated resource limits
   *
   * Errors:
   * - 403 Forbidden: Missing or invalid X-Internal-Service-Key
   * - 500 Internal Server Error: Container creation or startup failed
   */
  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  async startContainer(
    @Param('id') sessionId: string,
    @Body('userId') userId?: string,
    @Body('browserCapable') browserCapable?: boolean,
  ): Promise<{ message: string }> {
    await this.sessionsService.startSessionContainer(
      sessionId,
      userId,
      browserCapable === true ? { browserCapable: true } : undefined,
    );
    return { message: 'Session container started successfully' };
  }

  /**
   * DELETE /api/internal/sessions/:id/container
   * Remove a session's Docker container
   *
   * Behavior:
   * 1. Find container by session ID (fail-fast if not found)
   * 2. Stop container if running
   * 3. Remove container
   * 4. Return 204 No Content on success
   *
   * Errors:
   * - 403 Forbidden: Missing or invalid X-Internal-Service-Key
   * - 500 Internal Server Error: Container not found or removal failed
   */
  @Delete(':id/container')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeContainer(@Param('id') sessionId: string): Promise<void> {
    await this.sessionsService.removeSessionContainer(sessionId);
  }

  /**
   * POST /api/internal/sessions/:id/exec
   * Execute a command inside a session's container
   * Task 7.1A: Internal Container Exec Primitive
   *
   * Behavior:
   * 1. Resolve container by session ID (fail-fast if not found)
   * 2. Verify container is running (fail-fast if not)
   * 3. Execute command using Docker exec API
   * 4. Capture stdout, stderr, and exit code
   * 5. Enforce timeout (default 5 minutes)
   * 6. Return result
   *
   * Errors:
   * - 403 Forbidden: Missing or invalid X-Internal-Service-Key
   * - 500 Internal Server Error: Container not found, not running, or exec failed
   */
  @Post(':id/exec')
  @HttpCode(HttpStatus.OK)
  async execCommand(
    @Param('id') sessionId: string,
    @Body() execDto: ExecCommandDto,
  ): Promise<ExecResultDto> {
    const result = await this.sessionsService.execInContainer(
      sessionId,
      execDto.cmd,
      execDto.cwd,
      execDto.env,
      execDto.timeoutMs,
    );

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  /**
   * GET /api/internal/sessions/:id/files
   * Read a file from a session's container filesystem
   * Task 7.2A: Container File Read (Read-Only)
   *
   * Behavior:
   * 1. Resolve container by session ID (fail-fast if not found)
   * 2. Verify container is running (fail-fast if not)
   * 3. Validate path (reject .., absolute paths outside /workspace)
   * 4. Read file using cat command via Docker exec
   * 5. Return file content as UTF-8 string
   *
   * Query params:
   * - path (required): Relative path from /workspace (e.g., "index.js", "src/app.ts")
   *
   * Errors:
   * - 400 Bad Request: Missing or invalid path
   * - 403 Forbidden: Missing or invalid X-Internal-Service-Key
   * - 500 Internal Server Error: Container not found, not running, or file read failed
   */
  @Get(':id/files')
  @HttpCode(HttpStatus.OK)
  async readFile(
    @Param('id') sessionId: string,
    @Query('path') filePath?: string,
  ): Promise<{ path: string; content: string }> {
    if (!filePath) {
      throw new BadRequestException('Query parameter "path" is required');
    }

    const content = await this.sessionsService.readFileFromContainer(
      sessionId,
      filePath,
    );

    return {
      path: filePath,
      content,
    };
  }

  /**
   * POST /api/internal/sessions/:id/files
   * Write a file to a session's container filesystem
   * Task 7.2B: Container File Write (Create / Overwrite)
   *
   * Behavior:
   * 1. Resolve container by session ID (fail-fast if not found)
   * 2. Verify container is running (fail-fast if not)
   * 3. Validate path (reject .., absolute paths outside /workspace)
   * 4. Create parent directories if they don't exist
   * 5. Write file content using shell redirection via Docker exec
   * 6. Return 204 No Content on success
   *
   * Request body:
   * - path (required): Relative path from /workspace (e.g., "index.js", "src/app.ts")
   * - content (required): File content as UTF-8 string
   *
   * Errors:
   * - 400 Bad Request: Missing or invalid path or content
   * - 403 Forbidden: Missing or invalid X-Internal-Service-Key
   * - 500 Internal Server Error: Container not found, not running, or file write failed
   */
  @Post(':id/files')
  @HttpCode(HttpStatus.NO_CONTENT)
  async writeFile(
    @Param('id') sessionId: string,
    @Body('path') filePath?: string,
    @Body('content') content?: string,
  ): Promise<void> {
    if (!filePath) {
      throw new BadRequestException('Request body field "path" is required');
    }

    if (content === undefined || content === null) {
      throw new BadRequestException('Request body field "content" is required');
    }

    await this.sessionsService.writeFileToContainer(
      sessionId,
      filePath,
      content,
    );
  }

  /**
   * DELETE /api/internal/sessions/:id/files
   * Delete a file from a session's container filesystem
   * Task AI-WS-03-hotfix5: Route file delete through container exec
   *
   * Request body:
   * - path (required): Relative file path from /workspace
   */
  @Delete(':id/files')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(
    @Param('id') sessionId: string,
    @Body('path') filePath?: string,
  ): Promise<void> {
    if (!filePath) {
      throw new BadRequestException('Request body field "path" is required');
    }

    await this.sessionsService.deleteFileFromContainer(sessionId, filePath);
  }

  /**
   * POST /api/internal/sessions/:id/files/search
   * Search text-like files from a session's container filesystem
   * Task AI-WS-06-hotfix: Route workspace search through container exec
   *
   * Request body:
   * - query (required): Plain-text search query
   */
  @Post(':id/files/search')
  @HttpCode(HttpStatus.OK)
  async searchFiles(
    @Param('id') sessionId: string,
    @Body('query') query?: string,
  ): Promise<{
    query: string;
    results: Array<{ path: string; line: number; preview: string }>;
    truncated: boolean;
  }> {
    if (!query) {
      throw new BadRequestException('Request body field "query" is required');
    }

    return this.sessionsService.searchFilesInContainer(sessionId, query);
  }

  /**
   * GET /api/internal/sessions/:id/dirs
   * List directory contents from a session's container filesystem
   * Task 7.2C: Container Directory Listing (Read-Only)
   *
   * Behavior:
   * 1. Resolve container by session ID (fail-fast if not found)
   * 2. Verify container is running (fail-fast if not)
   * 3. Validate path (reject .., absolute paths outside /workspace)
   * 4. List directory contents using shell commands via Docker exec
   * 5. Return structured JSON with entries
   *
   * Query params:
   * - path (optional): Relative path from /workspace (e.g., "src", "src/components")
   *   - If omitted or "/", defaults to root workspace
   *
   * Response:
   * - path: The requested path
   * - entries: Array of { name, type, size, modifiedAt }
   *
   * Errors:
   * - 400 Bad Request: Invalid path
   * - 403 Forbidden: Missing or invalid X-Internal-Service-Key
   * - 500 Internal Server Error: Container not found, not running, or listing failed
   */
  @Get(':id/dirs')
  @HttpCode(HttpStatus.OK)
  async listDirectory(
    @Param('id') sessionId: string,
    @Query('path') dirPath?: string,
  ): Promise<{
    path: string;
    entries: Array<{
      name: string;
      type: 'file' | 'dir';
      size: number;
      modifiedAt: string;
    }>;
  }> {
    const entries = await this.sessionsService.listDirectoryInContainer(
      sessionId,
      dirPath,
    );

    return {
      path: dirPath || '/',
      entries,
    };
  }

  /**
   * GET /api/internal/sessions/:id/stat
   * Get file/directory metadata from a session's container filesystem
   * Task 7.2D: Container File Stat / Existence
   *
   * Behavior:
   * 1. Resolve container by session ID (fail-fast if not found)
   * 2. Verify container is running (fail-fast if not)
   * 3. Validate path (reject .., absolute paths outside /workspace)
   * 4. Check existence and get metadata using shell commands via Docker exec
   * 5. Return structured JSON with path, exists, and metadata if exists
   *
   * Query params:
   * - path (required): Relative path from /workspace (e.g., "src/app.ts", "src")
   *
   * Response (if exists):
   * - path: The requested path
   * - exists: true
   * - type: "file" | "dir"
   * - size: Number of bytes
   * - modifiedAt: ISO timestamp
   *
   * Response (if not exists):
   * - path: The requested path
   * - exists: false
   *
   * Errors:
   * - 400 Bad Request: Missing or invalid path
   * - 403 Forbidden: Missing or invalid X-Internal-Service-Key
   * - 500 Internal Server Error: Container not found, not running, or stat failed
   */
  @Get(':id/stat')
  @HttpCode(HttpStatus.OK)
  async statPath(
    @Param('id') sessionId: string,
    @Query('path') filePath?: string,
  ): Promise<{
    path: string;
    exists: boolean;
    type?: 'file' | 'dir';
    size?: number;
    modifiedAt?: string;
  }> {
    if (!filePath) {
      throw new BadRequestException('Query parameter "path" is required');
    }

    return this.sessionsService.statPathInContainer(sessionId, filePath);
  }

  /**
   * POST /api/internal/sessions/:id/browser-smoke
   * Run browser smoke check inside a session's browser-capable container
   * AGENT-HARNESS-05B2: Browser Smoke Handler
   *
   * Request body:
   * - url (optional): Relative path to navigate (defaults to "/")
   * - timeoutMs (optional): Timeout in milliseconds
   *
   * Returns BrowserSmokeResult.
   */
  @Post(':id/browser-smoke')
  @HttpCode(HttpStatus.OK)
  async runBrowserSmoke(
    @Param('id') sessionId: string,
    @Body('url') url?: string,
    @Body('timeoutMs') timeoutMs?: number,
  ): Promise<BrowserSmokeResult> {
    try {
      return await this.browserSmokeService.run({
        sessionId,
        url,
        timeoutMs: typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : undefined,
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Browser smoke request failed',
      );
    }
  }
}
