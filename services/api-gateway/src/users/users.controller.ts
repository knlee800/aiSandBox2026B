import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { UsersService } from './users.service';
import { UserMeResponseDto } from './dto/user-me-response.dto';
import { UserUsageResponseDto } from './dto/user-usage-response.dto';
import { UserQuotasResponseDto } from './dto/user-quotas-response.dto';
import { SnapshotPersistenceService } from '../snapshots/snapshot-persistence.service';

/**
 * UsersController
 * TASK-68B-2: Public user dashboard endpoints.
 */
@Controller('users')
@UseGuards(SessionCookieGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly snapshotPersistenceService: SnapshotPersistenceService,
  ) {}

  /**
   * Get current user info.
   * GET /api/users/me
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getCurrentUser(@Request() req): Promise<UserMeResponseDto> {
    return await this.usersService.getCurrentUser(req.user.userId);
  }

  /**
   * Get rolling 24h usage for current user.
   * GET /api/users/me/usage
   */
  @Get('me/usage')
  @HttpCode(HttpStatus.OK)
  async getUsage(@Request() req): Promise<UserUsageResponseDto> {
    return await this.usersService.getUsage(req.user.userId);
  }

  /**
   * Get quota limits and usage for current user.
   * GET /api/users/me/quotas
   */
  @Get('me/quotas')
  @HttpCode(HttpStatus.OK)
  async getQuotas(@Request() req): Promise<UserQuotasResponseDto> {
    return await this.usersService.getQuotas(req.user.userId);
  }

  @Get('me/snapshots')
  @HttpCode(HttpStatus.OK)
  async listSnapshots(@Request() req) {
    return await this.snapshotPersistenceService.listSnapshots(req.user.userId);
  }
}
