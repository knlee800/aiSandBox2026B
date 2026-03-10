import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import {
  AdminDashboardService,
  AdminSessionsQuery,
  AdminUsersQuery,
} from './admin-dashboard.service';
import { AdminUsersResponseDto } from './dto/admin-users-response.dto';
import { AdminSessionsResponseDto } from './dto/admin-sessions-response.dto';

/**
 * Admin dashboard visibility endpoints for TASK-68B-3.
 * Internal-only routes protected by InternalServiceAuthGuard (global).
 */
@Controller('internal/admin')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  /**
   * GET /api/internal/admin/users
   * Returns user-level admin visibility summary with optional filters.
   * Query params:
   * - search: email or userId substring
   * - quotaStatus: OK | WARN | EXCEEDED
   */
  @Get('users')
  @HttpCode(HttpStatus.OK)
  async getUsers(
    @Query('search') search?: string,
    @Query('quotaStatus') quotaStatus?: 'OK' | 'WARN' | 'EXCEEDED',
  ): Promise<AdminUsersResponseDto> {
    const query: AdminUsersQuery = { search, quotaStatus };
    return await this.adminDashboardService.getAdminUsers(query);
  }

  /**
   * GET /api/internal/admin/sessions
   * Returns session-level admin visibility across users with optional filters.
   * Query params:
   * - status: active | terminated
   * - userId: session owner user id
   * - dateRange: 24h | 7d | 30d
   * - startDate/endDate: ISO date strings
   */
  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  async getSessions(
    @Query('status') status?: 'active' | 'terminated',
    @Query('userId') userId?: string,
    @Query('dateRange') dateRange?: '24h' | '7d' | '30d',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<AdminSessionsResponseDto> {
    const query: AdminSessionsQuery = {
      status,
      userId,
      dateRange,
      startDate,
      endDate,
    };
    return await this.adminDashboardService.getAdminSessions(query);
  }
}
