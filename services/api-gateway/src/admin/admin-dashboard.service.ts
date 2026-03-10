import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import { UsageRecord } from '../entities/usage-record.entity';
import { QuotaConfig } from '../quota/quota.config';
import {
  AdminUserSummaryDto,
  AdminUsersResponseDto,
} from './dto/admin-users-response.dto';
import {
  AdminSessionVisibilityDto,
  AdminSessionsResponseDto,
} from './dto/admin-sessions-response.dto';

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

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(UsageRecord)
    private readonly usageRecordRepository: Repository<UsageRecord>,
  ) {}

  async getAdminUsers(query: AdminUsersQuery): Promise<AdminUsersResponseDto> {
    if (query.quotaStatus && !['OK', 'WARN', 'EXCEEDED'].includes(query.quotaStatus)) {
      throw new BadRequestException(
        'quotaStatus must be one of: OK, WARN, EXCEEDED',
      );
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const users = await this.userRepository.find({
      select: ['id', 'email', 'role', 'planType', 'isActive', 'createdAt'],
      order: { createdAt: 'DESC' },
    });

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

    let result: AdminUserSummaryDto[] = users.map((user) => {
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

      return {
        userId: user.id,
        email: user.email,
        role: user.role,
        planType: user.planType,
        isActive: user.isActive,
        activeSessions: sessionStats.activeSessions,
        totalSessions: sessionStats.totalSessions,
        sessionsCreated24h: sessionStats.sessionsCreated24h,
        tokensUsed24h,
        estimatedCost,
        quotaStatus,
        createdAt: user.createdAt.toISOString(),
      };
    });

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
}
