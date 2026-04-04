import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import { UsageRecord } from '../entities/usage-record.entity';
import { Plan } from '../entities/plan.entity';
import { QuotaConfig } from '../quota/quota.config';
import {
  AdminUserDetailDto,
  AdminUserSummaryDto,
  AdminUsersResponseDto,
} from './dto/admin-users-response.dto';
import {
  AdminSessionVisibilityDto,
  AdminSessionsResponseDto,
} from './dto/admin-sessions-response.dto';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { SessionService } from '../sessions/session.service';

export interface AdminUsersQuery {
  search?: string;
  quotaStatus?: 'OK' | 'WARN' | 'EXCEEDED';
}

export interface AdminSessionsQuery {
  status?: 'active' | 'terminated';
  userId?: string;
  startDate?: string;
  endDate?: string;
  dateRange?: '24h' | '7d' | '30d';
}

@Injectable()
export class AdminDashboardService {
  private static readonly ESTIMATED_COST_PER_1K_TOKENS = 0.01;
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(UsageRecord)
    private readonly usageRecordRepository: Repository<UsageRecord>,
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    private readonly containerManagerHttpClient: ContainerManagerHttpClient,
    private readonly sessionService: SessionService,
  ) {}

  async getAdminUsers(query: AdminUsersQuery): Promise<AdminUsersResponseDto> {
    if (query.quotaStatus && !['OK', 'WARN', 'EXCEEDED'].includes(query.quotaStatus)) {
      throw new BadRequestException(
        'quotaStatus must be one of: OK, WARN, EXCEEDED',
      );
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const users = await this.userRepository.find({
      select: [
        'id',
        'email',
        'role',
        'planType',
        'planStatus',
        'isActive',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
    });
    const planByCode = await this.getPlanByCodeMap();

    const sessionStatsRows = await this.sessionRepository
      .createQueryBuilder('session')
      .select('session.userId', 'userId')
      .addSelect('COUNT(*)', 'totalSessions')
      .addSelect(
        'SUM(CASE WHEN session.terminatedAt IS NULL THEN 1 ELSE 0 END)',
        'activeSessions',
      )
      .addSelect(
        'SUM(CASE WHEN session.createdAt > :twentyFourHoursAgo THEN 1 ELSE 0 END)',
        'sessionsCreated24h',
      )
      .setParameter('twentyFourHoursAgo', twentyFourHoursAgo)
      .groupBy('session.userId')
      .getRawMany();

    const tokenUsageRows = await this.usageRecordRepository
      .createQueryBuilder('usage')
      .select('usage.userId', 'userId')
      .addSelect('SUM(COALESCE(usage.tokensUsed, 0))', 'tokensUsed24h')
      .where('usage.timestamp > :twentyFourHoursAgo', { twentyFourHoursAgo })
      .groupBy('usage.userId')
      .getRawMany();

    const sessionStatsByUser = new Map<
      string,
      { totalSessions: number; activeSessions: number; sessionsCreated24h: number }
    >();
    for (const row of sessionStatsRows) {
      sessionStatsByUser.set(row.userId, {
        totalSessions: parseInt(row.totalSessions || '0', 10),
        activeSessions: parseInt(row.activeSessions || '0', 10),
        sessionsCreated24h: parseInt(row.sessionsCreated24h || '0', 10),
      });
    }

    const tokenUsageByUser = new Map<string, number>();
    for (const row of tokenUsageRows) {
      tokenUsageByUser.set(row.userId, parseInt(row.tokensUsed24h || '0', 10));
    }

    let result: AdminUserSummaryDto[] = users.map((user) =>
      this.toAdminUserSummary(user, planByCode, sessionStatsByUser, tokenUsageByUser),
    );

    if (query.search) {
      const normalized = query.search.toLowerCase();
      result = result.filter(
        (user) =>
          user.email.toLowerCase().includes(normalized) ||
          user.userId.toLowerCase().includes(normalized),
      );
    }

    if (query.quotaStatus) {
      result = result.filter((user) => user.quotaStatus === query.quotaStatus);
    }

    return { users: result };
  }

  async getAdminSessions(
    query: AdminSessionsQuery,
  ): Promise<AdminSessionsResponseDto> {
    if (query.status && !['active', 'terminated'].includes(query.status)) {
      throw new BadRequestException('status must be one of: active, terminated');
    }

    const qb = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.user', 'user')
      .orderBy('session.createdAt', 'DESC');

    if (query.userId) {
      qb.andWhere('session.userId = :userId', { userId: query.userId });
    }

    if (query.status === 'active') {
      qb.andWhere('session.terminatedAt IS NULL');
    } else if (query.status === 'terminated') {
      qb.andWhere('session.terminatedAt IS NOT NULL');
    }

    if (query.dateRange) {
      const rangeStart = this.getDateRangeStart(query.dateRange);
      qb.andWhere('session.createdAt >= :rangeStart', { rangeStart });
    }

    if (query.startDate) {
      const parsed = new Date(query.startDate);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('startDate must be a valid ISO date string');
      }
      qb.andWhere('session.createdAt >= :startDate', { startDate: parsed });
    }

    if (query.endDate) {
      const parsed = new Date(query.endDate);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('endDate must be a valid ISO date string');
      }
      qb.andWhere('session.createdAt <= :endDate', { endDate: parsed });
    }

    const sessions = await qb.getMany();
    const result: AdminSessionVisibilityDto[] = sessions.map((session) => ({
      sessionId: session.id,
      userId: session.userId,
      userEmail: session.user?.email || '',
      status: session.status,
      isTerminated: !!session.terminatedAt,
      terminationReason: session.terminationReason || null,
      createdAt: session.createdAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    }));

    return { sessions: result };
  }

  async getAdminUserDetail(userId: string): Promise<AdminUserDetailDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'role',
        'planType',
        'planStatus',
        'isActive',
        'createdAt',
      ],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const [sessionStats, tokensUsed24h, planByCode] = await Promise.all([
      this.getSessionStatsForUser(user.id),
      this.getTokensUsed24hForUser(user.id),
      this.getPlanByCodeMap(),
    ]);

    const summary = this.toAdminUserSummary(
      user,
      planByCode,
      new Map([[user.id, sessionStats]]),
      new Map([[user.id, tokensUsed24h]]),
    );
    const resolvedPlan = this.resolvePlan(user.planType, planByCode);

    return {
      ...summary,
      quotas: {
        maxActiveSessions: resolvedPlan.maxActiveSessions,
        maxSessions24h: resolvedPlan.maxSessions24h,
        maxTokens24h: resolvedPlan.maxTokens24h,
        currentActiveSessions: summary.activeSessions,
        currentSessions24h: summary.sessionsCreated24h,
        currentTokens24h: summary.tokensUsed24h,
      },
    };
  }

  async terminateSessionAsAdmin(
    sessionId: string,
    adminActor: string,
  ): Promise<{ message: string }> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      select: ['id', 'terminatedAt', 'status', 'userId'],
    });
    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    if (session.terminatedAt !== null) {
      return { message: 'Session already terminated' };
    }

    try {
      await this.containerManagerHttpClient.stopSession(sessionId);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'admin.session.terminate.stop_failed',
          sessionId,
          adminActor,
          error:
            error instanceof Error ? error.message : 'unknown container stop failure',
        }),
      );
    }

    await this.sessionService.terminateSession(sessionId, 'manual');
    this.logger.log(
      JSON.stringify({
        event: 'admin.session.terminated',
        sessionId,
        adminActor,
        userId: session.userId,
      }),
    );

    return { message: 'Session terminated successfully' };
  }

  private computeQuotaStatus(
    activeSessions: number,
    sessionsCreated24h: number,
    tokensUsed24h: number,
  ): 'OK' | 'WARN' | 'EXCEEDED' {
    const activeRatio = activeSessions / QuotaConfig.MAX_ACTIVE_SESSIONS_PER_USER;
    const sessionsRatio = sessionsCreated24h / QuotaConfig.MAX_SESSIONS_PER_24H;
    const tokenRatio = tokensUsed24h / QuotaConfig.MAX_TOKENS_PER_24H;

    const maxRatio = Math.max(activeRatio, sessionsRatio, tokenRatio);
    if (maxRatio >= 1) {
      return 'EXCEEDED';
    }
    if (maxRatio >= 0.8) {
      return 'WARN';
    }
    return 'OK';
  }

  private getDateRangeStart(range: '24h' | '7d' | '30d'): Date {
    const now = Date.now();
    if (range === '24h') {
      return new Date(now - 24 * 60 * 60 * 1000);
    }
    if (range === '7d') {
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    }
    if (range === '30d') {
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    }
    throw new BadRequestException('dateRange must be one of: 24h, 7d, 30d');
  }

  private round3(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  private async getSessionStatsForUser(userId: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    sessionsCreated24h: number;
  }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const row = await this.sessionRepository
      .createQueryBuilder('session')
      .select('session.userId', 'userId')
      .addSelect('COUNT(*)', 'totalSessions')
      .addSelect(
        'SUM(CASE WHEN session.terminatedAt IS NULL THEN 1 ELSE 0 END)',
        'activeSessions',
      )
      .addSelect(
        'SUM(CASE WHEN session.createdAt > :twentyFourHoursAgo THEN 1 ELSE 0 END)',
        'sessionsCreated24h',
      )
      .where('session.userId = :userId', { userId })
      .setParameter('twentyFourHoursAgo', twentyFourHoursAgo)
      .groupBy('session.userId')
      .getRawOne();

    if (!row) {
      return { totalSessions: 0, activeSessions: 0, sessionsCreated24h: 0 };
    }

    return {
      totalSessions: parseInt(row.totalSessions || '0', 10),
      activeSessions: parseInt(row.activeSessions || '0', 10),
      sessionsCreated24h: parseInt(row.sessionsCreated24h || '0', 10),
    };
  }

  private async getTokensUsed24hForUser(userId: string): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const row = await this.usageRecordRepository
      .createQueryBuilder('usage')
      .select('usage.userId', 'userId')
      .addSelect('SUM(COALESCE(usage.tokensUsed, 0))', 'tokensUsed24h')
      .where('usage.timestamp > :twentyFourHoursAgo', { twentyFourHoursAgo })
      .andWhere('usage.userId = :userId', { userId })
      .groupBy('usage.userId')
      .getRawOne();

    return parseInt(row?.tokensUsed24h || '0', 10);
  }

  private async getPlanByCodeMap(): Promise<Map<string, Plan>> {
    const plans = await this.planRepository.find({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
    return new Map(plans.map((plan) => [plan.code, plan]));
  }

  private toAdminUserSummary(
    user: Pick<
      User,
      'id' | 'email' | 'role' | 'planType' | 'planStatus' | 'isActive' | 'createdAt'
    >,
    planByCode: Map<string, Plan>,
    sessionStatsByUser: Map<
      string,
      { totalSessions: number; activeSessions: number; sessionsCreated24h: number }
    >,
    tokenUsageByUser: Map<string, number>,
  ): AdminUserSummaryDto {
    const sessionStats = sessionStatsByUser.get(user.id) || {
      totalSessions: 0,
      activeSessions: 0,
      sessionsCreated24h: 0,
    };
    const tokensUsed24h = tokenUsageByUser.get(user.id) || 0;
    const estimatedCost = this.round3(
      (tokensUsed24h / 1000) * AdminDashboardService.ESTIMATED_COST_PER_1K_TOKENS,
    );
    const quotaStatus = this.computeQuotaStatus(
      sessionStats.activeSessions,
      sessionStats.sessionsCreated24h,
      tokensUsed24h,
    );
    const resolvedPlan = this.resolvePlan(user.planType, planByCode);

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      planCode: resolvedPlan.planCode,
      planName: resolvedPlan.planName,
      planType: user.planType,
      planStatus: user.planStatus || 'active',
      isActive: user.isActive,
      activeSessions: sessionStats.activeSessions,
      totalSessions: sessionStats.totalSessions,
      sessionsCreated24h: sessionStats.sessionsCreated24h,
      tokensUsed24h,
      estimatedCost,
      quotaStatus,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private resolvePlan(
    planCode: string,
    planByCode: Map<string, Plan>,
  ): {
    planCode: string;
    planName: string;
    maxActiveSessions: number;
    maxSessions24h: number;
    maxTokens24h: number;
  } {
    const plan = planByCode.get(planCode);
    if (!plan) {
      return {
        planCode,
        planName: planCode,
        maxActiveSessions: QuotaConfig.MAX_ACTIVE_SESSIONS_PER_USER,
        maxSessions24h: QuotaConfig.MAX_SESSIONS_PER_24H,
        maxTokens24h: QuotaConfig.MAX_TOKENS_PER_24H,
      };
    }

    return {
      planCode: plan.code,
      planName: plan.name,
      maxActiveSessions: plan.maxActiveSessions,
      maxSessions24h: plan.maxSessions24h,
      maxTokens24h: plan.maxTokens24h,
    };
  }
}
