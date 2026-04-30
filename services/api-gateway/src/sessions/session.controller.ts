import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  NotFoundException,
  GoneException,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
  Res,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Session } from '../entities/session.entity';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { RateLimitGuard, RateLimit } from '../guards/rate-limit.guard';
import { SessionQuotaGuard } from '../quota/session-quota.guard';
import { SaveSnapshotDto } from '../snapshots/dto/save-snapshot.dto';
import { RestoreSnapshotDto } from '../snapshots/dto/restore-snapshot.dto';
import { SnapshotPersistenceService } from '../snapshots/snapshot-persistence.service';
import { WorkspaceArchiveService } from '../snapshots/workspace-archive.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

/**
 * SessionController
 * Public HTTP endpoints for session lifecycle management
 * All endpoints require JWT authentication
 * Routes: /api/sessions/* (global prefix 'api' applied in main.ts)
 */
@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly containerManagerHttpClient: ContainerManagerHttpClient,
    private readonly snapshotPersistenceService: SnapshotPersistenceService,
    private readonly workspaceArchiveService: WorkspaceArchiveService,
  ) {}

  /**
   * Create a new sandbox session for the authenticated user
   * POST /api/sessions
   * Flow: Quota check → Create session record → Start container → Return session
   * PHASE-41B: Rate limited to 10 requests per minute per IP
   * PHASE-42A-1: Quota limited to 5 active sessions per user
   * @param req - Request object with authenticated user
   * @returns Created session data
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RateLimitGuard, SessionQuotaGuard)
  @RateLimit({ maxRequests: 10, windowMs: 60000 })
  async createSession(@Request() req): Promise<Session> {
    const userId = req.user.userId;

    // Create session record in database
    const session = await this.sessionService.createSession(userId);

    // Start container (fail-fast if container-manager is unreachable)
    await this.containerManagerHttpClient.startSession(session.id, userId);

    return session;
  }

  /**
   * List all active sessions belonging to the authenticated user
   * GET /api/sessions
   * Optional query:
   * - includeTerminated=true: include terminated sessions
   * @param req - Request object with authenticated user
   * @returns Array of user's active sessions
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listSessions(
    @Request() req,
    @Query('includeTerminated') includeTerminated?: string,
  ): Promise<Session[]> {
    const userId = req.user.userId;
    const shouldIncludeTerminated = includeTerminated === 'true';
    return await this.sessionService.getSessionsByUser(
      userId,
      shouldIncludeTerminated,
    );
  }

  /**
   * Get details of a specific session
   * GET /api/sessions/:id
   * Returns 404 if session not found or not owned by user
   * @param id - Session UUID
   * @param req - Request object with authenticated user
   * @returns Session details
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getSession(
    @Param('id') id: string,
    @Request() req,
  ): Promise<Session> {
    const userId = req.user.userId;
    const session = await this.sessionService.getSessionById(id);

    // Validate ownership - return 404 to avoid leaking session existence
    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    return session;
  }

  /**
   * Stop a session owned by the authenticated user
   * POST /api/sessions/:id/stop
   * Returns 404 if session not found or not owned by user
   * Flow: Stop container → Update DB status
   * @param id - Session UUID
   * @param req - Request object with authenticated user
   * @returns Success message
   */
  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  async stopSession(
    @Param('id') id: string,
    @Request() req,
  ): Promise<{ message: string }> {
    const userId = req.user.userId;
    const session = await this.sessionService.getSessionById(id);

    // Validate ownership - return 404 to avoid leaking session existence
    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    // Stop container first (fail-fast if container-manager is unreachable)
    await this.containerManagerHttpClient.stopSession(id);

    // Update database status after successful container shutdown
    await this.sessionService.stopSession(id);

    return { message: 'Session stopped successfully' };
  }

  /**
   * Execute a command inside a session's container
   * POST /api/sessions/:id/exec
   * Per ARCHITECTURE Section 8: JWT required, ownership enforced
   * Per PRD Section 3B: Output includes exit code, stdout, stderr
   * Per ARCHITECTURE Section 4 enforcement order: Exists? → Terminated? → Execute
   * PHASE-77A: Added to resolve ISSUE-76-005
   * @param id - Session UUID
   * @param command - Command string to execute
   * @param req - Request object with authenticated user
   * @returns Execution result with exitCode, stdout, stderr
   */
  @Post(':id/exec')
  @HttpCode(HttpStatus.OK)
  async execInSession(
    @Param('id') id: string,
    @Body('command') command: string,
    @Request() req,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    // #region agent log
    fetch('http://127.0.0.1:7870/ingest/eba94f28-6765-4a01-9905-123e592de80f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8262b1'},body:JSON.stringify({sessionId:'8262b1',location:'session.controller.ts:execInSession:entry',message:'execInSession called',data:{sessionId:id,command,hasUser:!!req?.user,userId:req?.user?.userId},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    const userId = req.user.userId;
    const session = await this.sessionService.getSessionById(id);

    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    if (session.terminatedAt !== null) {
      throw new GoneException(`Session ${id} is terminated`);
    }

    if (!command || command.trim().length === 0) {
      throw new BadRequestException('command is required');
    }

    try {
      const result = await this.containerManagerHttpClient.execInSession(
        id,
        ['sh', '-c', command],
      );

      // #region agent log
      fetch('http://127.0.0.1:7870/ingest/eba94f28-6765-4a01-9905-123e592de80f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8262b1'},body:JSON.stringify({sessionId:'8262b1',location:'session.controller.ts:execInSession:success',message:'exec succeeded',data:{exitCode:result.exitCode,stdoutLen:result.stdout?.length,stderrLen:result.stderr?.length},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion

      return {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (execError: any) {
      // #region agent log
      fetch('http://127.0.0.1:7870/ingest/eba94f28-6765-4a01-9905-123e592de80f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8262b1'},body:JSON.stringify({sessionId:'8262b1',location:'session.controller.ts:execInSession:catch',message:'exec threw',data:{errorName:execError?.constructor?.name,errorMessage:execError?.message,errorStatus:execError?.getStatus?.(),isHttpException:execError?.getStatus!==undefined},timestamp:Date.now(),hypothesisId:'H1,H2,H3'})}).catch(()=>{});
      // #endregion
      throw execError;
    }
  }

  @Get(':id/files/list')
  @HttpCode(HttpStatus.OK)
  async listSessionFiles(
    @Param('id') id: string,
    @Query('path') path: string = '/',
    @Request() req,
  ): Promise<Array<{ name: string; path: string; type: 'file' | 'directory'; size: number; modified: string }>> {
    const userId = req.user.userId;
    const session = await this.sessionService.getSessionById(id);

    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    if (session.terminatedAt !== null) {
      throw new GoneException(`Session ${id} is terminated`);
    }

    const result = await this.containerManagerHttpClient.listSessionDirectory(id, path);
    return result.entries.map((entry) => ({
      name: entry.name,
      path: path === '/' || !path ? entry.name : `${path.replace(/\/$/, '')}/${entry.name}`,
      type: entry.type === 'dir' ? 'directory' : 'file',
      size: entry.size,
      modified: entry.modifiedAt,
    }));
  }

  @Post(':id/files/read')
  @HttpCode(HttpStatus.OK)
  async readSessionFile(
    @Param('id') id: string,
    @Body('path') path: string,
    @Request() req,
  ): Promise<{ path: string; content: string }> {
    const userId = req.user.userId;
    const session = await this.sessionService.getSessionById(id);

    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    if (session.terminatedAt !== null) {
      throw new GoneException(`Session ${id} is terminated`);
    }

    if (!path || path.trim().length === 0) {
      throw new BadRequestException('path is required');
    }

    return await this.containerManagerHttpClient.readSessionFile(id, path);
  }

  @Post(':id/files/write')
  @HttpCode(HttpStatus.NO_CONTENT)
  async writeSessionFile(
    @Param('id') id: string,
    @Body('path') path: string,
    @Body('content') content: string,
    @Request() req,
  ): Promise<void> {
    const userId = req.user.userId;
    const session = await this.sessionService.getSessionById(id);

    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    if (session.terminatedAt !== null) {
      throw new GoneException(`Session ${id} is terminated`);
    }

    if (!path || path.trim().length === 0) {
      throw new BadRequestException('path is required');
    }

    if (content === undefined || content === null) {
      throw new BadRequestException('content is required');
    }

    await this.containerManagerHttpClient.writeSessionFile(id, path, content);
  }

  @Delete(':id/files/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSessionFile(
    @Param('id') id: string,
    @Body('path') path: string,
    @Request() req,
  ): Promise<void> {
    const userId = req.user.userId;
    const session = await this.sessionService.getSessionById(id);

    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    if (session.terminatedAt !== null) {
      throw new GoneException(`Session ${id} is terminated`);
    }

    if (!path || path.trim().length === 0) {
      throw new BadRequestException('path is required');
    }

    await this.containerManagerHttpClient.deleteSessionFile(id, path);
  }

  @Post(':id/files/search')
  @HttpCode(HttpStatus.OK)
  async searchSessionFiles(
    @Param('id') id: string,
    @Body('query') query: string,
    @Request() req,
  ): Promise<{
    query: string;
    results: Array<{ path: string; line: number; preview: string }>;
    truncated: boolean;
  }> {
    const userId = req.user.userId;
    const session = await this.sessionService.getSessionById(id);

    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    if (session.terminatedAt !== null) {
      throw new GoneException(`Session ${id} is terminated`);
    }

    if (!query || query.trim().length === 0) {
      throw new BadRequestException('query is required');
    }

    return await this.containerManagerHttpClient.searchSessionFiles(id, query);
  }

  @Post(':id/snapshot')
  @HttpCode(HttpStatus.CREATED)
  async saveSessionSnapshot(
    @Param('id') id: string,
    @Body() body: SaveSnapshotDto,
    @Request() req,
  ) {
    const userId = req.user.userId;
    const session = await this.sessionService.getSessionById(id);
    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    if (session.terminatedAt !== null) {
      throw new GoneException(`Session ${id} is terminated`);
    }

    return await this.snapshotPersistenceService.saveSnapshot({
      userId,
      sessionId: id,
      label: body.label,
    });
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  async restoreSessionSnapshot(
    @Param('id') id: string,
    @Body() body: RestoreSnapshotDto,
    @Request() req,
  ) {
    const userId = req.user.userId;
    const session = await this.sessionService.getSessionById(id);
    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    if (session.terminatedAt !== null) {
      throw new GoneException(`Session ${id} is terminated`);
    }

    return await this.snapshotPersistenceService.restoreSnapshot({
      userId,
      sessionId: id,
      snapshotId: body.snapshotId,
    });
  }

  @Get(':id/export')
  @HttpCode(HttpStatus.OK)
  async exportSessionWorkspace(
    @Param('id') id: string,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const userId = req.user.userId;
    const session = await this.sessionService.getSessionById(id);
    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    if (session.terminatedAt !== null) {
      throw new GoneException(`Session ${id} is terminated`);
    }

    const archiveBuffer = await this.workspaceArchiveService.exportWorkspaceArchive(id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="session-${id}-workspace.zip"`,
    );
    return new StreamableFile(archiveBuffer);
  }

  @Post(':id/import')
  @UseInterceptors(
    FileInterceptor('archive', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const name = (file.originalname || '').toLowerCase();
        if (!name.endsWith('.zip')) {
          cb(new BadRequestException('Only .zip archives are supported.'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  @HttpCode(HttpStatus.OK)
  async importSessionWorkspace(
    @Param('id') id: string,
    @UploadedFile() archiveFile: { buffer: Buffer } | undefined,
    @Request() req,
  ): Promise<{ importedFileCount: number }> {
    const userId = req.user.userId;
    const session = await this.sessionService.getSessionById(id);
    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    if (session.terminatedAt !== null) {
      throw new GoneException(`Session ${id} is terminated`);
    }
    if (!archiveFile || !archiveFile.buffer || archiveFile.buffer.length === 0) {
      throw new BadRequestException('archive file is required');
    }

    return await this.workspaceArchiveService.importWorkspaceArchive(
      id,
      archiveFile.buffer,
    );
  }

  /**
   * Terminate a session owned by the authenticated user
   * DELETE /api/sessions/:id
   * Returns 404 if session not found or not owned by user
   * Flow: Best-effort stop container → Terminate session in DB
   * Idempotent: returns 200 if session already terminated
   * Per PRD/ARCHITECTURE: termination is permanent and irreversible (HTTP 410 on subsequent mutations)
   * PHASE-41B: Rate limited to 5 requests per minute per IP
   * PHASE-76F: Fixed to terminate (set terminated_at) instead of physical deletion
   * @param id - Session UUID
   * @param req - Request object with authenticated user
   * @returns Success message
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ maxRequests: 5, windowMs: 60000 })
  async deleteSession(
    @Param('id') id: string,
    @Request() req,
  ): Promise<{ message: string }> {
    const userId = req.user.userId;
    const session = await this.sessionService.getSessionById(id);

    // Validate ownership - return 404 to avoid leaking session existence
    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    // Idempotent: if session is already terminated, return success
    if (session.terminatedAt !== null) {
      return { message: 'Session already terminated' };
    }

    // Best-effort stop container in container-manager (tolerates failures)
    try {
      await this.containerManagerHttpClient.stopSession(id);
    } catch (error) {
      // Best-effort: log but do not block termination
      console.error(
        `Best-effort container stop failed for session ${id} during termination:`,
        error.message,
      );
    }

    // Terminate session in api-gateway database (set terminated_at, termination_reason)
    await this.sessionService.terminateSession(id, 'manual');

    return { message: 'Session terminated successfully' };
  }
}
