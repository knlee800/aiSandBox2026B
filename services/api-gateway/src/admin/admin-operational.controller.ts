import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
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
import {
  AdminCreditGrantRequestDto,
  AdminCreditGrantResponseDto,
} from './dto/admin-credit-grant.dto';
import { AdminCreditGrantService } from './admin-credit-grant.service';

type AdminRequestContext = {
  user?: {
    userId?: string;
    email?: string;
    role?: string;
  };
};

@Controller('admin')
@UseGuards(SessionCookieGuard, AdminRoleGuard)
export class AdminOperationalController {
  constructor(
    private readonly adminDashboardService: AdminDashboardService,
    private readonly adminCreditGrantService: AdminCreditGrantService,
  ) {}

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

  @Post('users/:userId/credits')
  @HttpCode(HttpStatus.OK)
  async grantUserCredits(
    @Param('userId') userId: string,
    @Body() dto: AdminCreditGrantRequestDto,
    @Req() request: AdminRequestContext,
  ): Promise<AdminCreditGrantResponseDto> {
    const authenticatedAdminId = request.user?.userId;
    if (!authenticatedAdminId) {
      throw new UnauthorizedException('Authentication required');
    }

    return await this.adminCreditGrantService.grantCredits(
      userId,
      authenticatedAdminId,
      dto,
    );
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
    @Req() request: AdminRequestContext,
  ): Promise<{ message: string }> {
    const adminActor = request.user?.email || request.user?.userId || 'admin';
    return await this.adminDashboardService.terminateSessionAsAdmin(
      sessionId,
      adminActor,
    );
  }
}
