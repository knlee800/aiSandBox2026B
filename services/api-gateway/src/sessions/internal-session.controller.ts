import { Controller, Post, Param, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { SessionService } from './session.service';

/**
 * Optional body for container-manager → api-gateway stop notification.
 * Empty body preserves explicit-stop semantics (status → STOPPED only).
 * `idle_timeout` / `max_lifetime` trigger idempotent terminateSession.
 */
export class InternalSessionStopDto {
  @IsOptional()
  @IsIn(['idle_timeout', 'max_lifetime'])
  reason?: 'idle_timeout' | 'max_lifetime';
}

/**
 * Internal Session Controller
 * HTTP endpoints for container-manager → api-gateway communication
 * NOT exposed to public API (use /api/internal/* routes)
 */
@Controller('internal/sessions')
export class InternalSessionController {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * Start a session (PENDING → ACTIVE)
   * Called by container-manager when session starts
   * POST /api/internal/sessions/:sessionId/start
   */
  @Post(':sessionId/start')
  @HttpCode(HttpStatus.OK)
  async startSession(@Param('sessionId') sessionId: string): Promise<{ message: string }> {
    await this.sessionService.startSession(sessionId);
    return { message: 'Session started successfully' };
  }

  /**
   * Stop a session (ACTIVE → STOPPED)
   * Called by container-manager when session stops
   * POST /api/internal/sessions/:sessionId/stop
   *
   * PRIVATE-BETA-BLOCKER-03E-B: optional `reason` is a backward-compatible
   * payload extension. When present (`idle_timeout` | `max_lifetime`),
   * persist terminal state via terminateSession (status=STOPPED,
   * terminatedAt, terminationReason). Duplicate notifications are
   * idempotent because terminateSession updates only when
   * terminatedAt IS NULL.
   */
  @Post(':sessionId/stop')
  @HttpCode(HttpStatus.OK)
  async stopSession(
    @Param('sessionId') sessionId: string,
    @Body() body?: InternalSessionStopDto,
  ): Promise<{ message: string }> {
    const reason = body?.reason;
    if (reason === 'idle_timeout' || reason === 'max_lifetime') {
      await this.sessionService.terminateSession(sessionId, reason);
      return { message: 'Session stopped successfully' };
    }

    await this.sessionService.stopSession(sessionId);
    return { message: 'Session stopped successfully' };
  }

  /**
   * Mark session as error (ANY → ERROR)
   * Called by container-manager when session encounters an error
   * POST /api/internal/sessions/:sessionId/error
   */
  @Post(':sessionId/error')
  @HttpCode(HttpStatus.OK)
  async markSessionError(@Param('sessionId') sessionId: string): Promise<{ message: string }> {
    await this.sessionService.markSessionError(sessionId);
    return { message: 'Session marked as error' };
  }
}
