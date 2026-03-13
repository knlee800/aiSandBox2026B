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
} from '@nestjs/common';
import { SessionService } from './session.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Session } from '../entities/session.entity';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { RateLimitGuard, RateLimit } from '../guards/rate-limit.guard';
import { SessionQuotaGuard } from '../quota/session-quota.guard';

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
    await this.containerManagerHttpClient.startSession(session.id);

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

    const result = await this.containerManagerHttpClient.execInSession(
      id,
      ['sh', '-c', command],
    );

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    };
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
