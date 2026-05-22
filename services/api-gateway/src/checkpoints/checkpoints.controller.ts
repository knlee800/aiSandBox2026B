import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { CheckpointsService } from './checkpoints.service';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { CheckpointResponseDto } from './dto/checkpoint-response.dto';
import { DiffResponseDto } from './dto/diff-response.dto';
import { RevertRequestDto } from './dto/revert-request.dto';
import { RevertResponseDto } from './dto/revert-response.dto';

/**
 * CheckpointsController
 * PHASE-68B: Public HTTP endpoints for checkpoint history/control operations
 * All endpoints require JWT authentication and enforce session ownership
 * Routes: /api/sessions/:id/checkpoints/* and /api/sessions/:id/revert
 * (global prefix 'api' applied in main.ts)
 */
@Controller('sessions/:id')
@UseGuards(SessionCookieGuard)
export class CheckpointsController {
  constructor(private readonly checkpointsService: CheckpointsService) {}

  @Post('checkpoints')
  @HttpCode(HttpStatus.CREATED)
  async createManualCheckpoint(
    @Param('id') id: string,
    @Body() body: { messageNumber?: number; description?: string; allowEmpty?: boolean },
    @Request() req,
  ): Promise<{ message: string; commitHash: string; filesChanged: number }> {
    const userId = req.user.userId;
    const session = await this.checkpointsService['sessionService'].getSessionById(id);
    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    return await this.checkpointsService.createManualCheckpoint(
      id,
      userId,
      typeof body?.messageNumber === 'number' ? body.messageNumber : 0,
      body?.description,
      body?.allowEmpty === true,
    );
  }

  /**
   * List all checkpoints for a session
   * GET /api/sessions/:id/checkpoints
   * Returns checkpoints in reverse chronological order (newest first)
   * Returns 404 if session not found or not owned by user
   * Returns 401 if not authenticated
   * @param id - Session UUID
   * @param req - Request object with authenticated user
   * @returns Array of checkpoints
   */
  @Get('checkpoints')
  @HttpCode(HttpStatus.OK)
  async listCheckpoints(
    @Param('id') id: string,
    @Request() req,
  ): Promise<CheckpointResponseDto[]> {
    const userId = req.user.userId;

    // Get checkpoints (service validates session existence and ownership)
    const checkpoints = await this.checkpointsService.listCheckpoints(id);

    // Verify session ownership (session service already validated existence)
    // Re-fetch session to verify ownership
    const session = await this.checkpointsService['sessionService'].getSessionById(id);
    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    return checkpoints;
  }

  /**
   * Get diff for a specific checkpoint
   * GET /api/sessions/:id/checkpoints/:hash/diff
   * Returns diff between checkpoint and parent commit
   * Returns 404 if session or checkpoint not found
   * Returns 403 if session not owned by user
   * Returns 401 if not authenticated
   * @param id - Session UUID
   * @param hash - Commit hash
   * @param req - Request object with authenticated user
   * @returns Diff data
   */
  @Get('checkpoints/:hash/diff')
  @HttpCode(HttpStatus.OK)
  async getCheckpointDiff(
    @Param('id') id: string,
    @Param('hash') hash: string,
    @Request() req,
  ): Promise<DiffResponseDto> {
    const userId = req.user.userId;

    // Verify session ownership first
    const session = await this.checkpointsService['sessionService'].getSessionById(id);
    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    // Get diff (service validates checkpoint existence and ownership)
    return await this.checkpointsService.getCheckpointDiff(id, hash);
  }

  /**
   * Revert session to a specific checkpoint
   * POST /api/sessions/:id/revert
   * Creates new checkpoint after revert operation
   * Returns 404 if session or checkpoint not found
   * Returns 410 if session is terminated
   * Returns 403 if session not owned by user
   * Returns 401 if not authenticated
   * @param id - Session UUID
   * @param revertDto - Request body with commit hash
   * @param req - Request object with authenticated user
   * @returns Revert result with new checkpoint info
   */
  @Post('revert')
  @HttpCode(HttpStatus.OK)
  async revertToCheckpoint(
    @Param('id') id: string,
    @Body() revertDto: RevertRequestDto,
    @Request() req,
  ): Promise<RevertResponseDto> {
    const userId = req.user.userId;

    // Verify session ownership first
    const session = await this.checkpointsService['sessionService'].getSessionById(id);
    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    // Execute revert (service validates checkpoint existence, session active state)
    return await this.checkpointsService.revertToCheckpoint(
      id,
      revertDto.commitHash,
      userId,
    );
  }
}
