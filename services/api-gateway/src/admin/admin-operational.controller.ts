import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AdminDashboardService,
  AdminSessionsQuery,
  AdminUsersQuery,
} from './admin-dashboard.service';
import {
  AdminUserDetailDto,
  AdminUsersResponseDto,
} from './dto/admin-users-response.dto';
import { AdminSessionsResponseDto } from './dto/admin-sessions-response.dto';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';

@Controller('admin')
@UseGuards(SessionCookieGuard, AdminRoleGuard)
export class AdminOperationalController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('users')
  @HttpCode(HttpStatus.OK)
  async getUsers(
    @Query('search') search?: string,
    @Query('quotaStatus') quotaStatus?: 'OK' | 'WARN' | 'EXCEEDED',
  ): Promise<AdminUsersResponseDto> {
    const query: AdminUsersQuery = { search, quotaStatus };
    return await this.adminDashboardService.getAdminUsers(query);
  }

  @Get('users/:userId')
  @HttpCode(HttpStatus.OK)
  async getUserDetail(@Param('userId') userId: string): Promise<AdminUserDetailDto> {
    return await this.adminDashboardService.getAdminUserDetail(userId);
  }

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

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  async terminateSession(
    @Param('sessionId') sessionId: string,
    @Req() request: { user: { userId?: string; email?: string } },
  ): Promise<{ message: string }> {
    const adminActor = request.user?.email || request.user?.userId || 'admin';
    return await this.adminDashboardService.terminateSessionAsAdmin(
      sessionId,
      adminActor,
    );
  }
}
