import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Plan } from '../entities/plan.entity';
import { QuotaConfig } from '../quota/quota.config';
import { QuotaService } from '../quota/quota.service';
import { UserMeResponseDto } from './dto/user-me-response.dto';
import { UserUsageResponseDto } from './dto/user-usage-response.dto';
import { UserQuotasResponseDto } from './dto/user-quotas-response.dto';

/**
 * UsersService
 * TASK-68B-2: User dashboard support endpoints.
 */
@Injectable()
export class UsersService {
  private static readonly ESTIMATED_COST_PER_1K_TOKENS = 0.01;
  private static readonly FALLBACK_PLAN_NAME = 'Free';
  private static readonly FALLBACK_PLAN_CODE = 'free';
  private static readonly PLAN_STATUS_VALUES = new Set(['active', 'cancelled', 'expired']);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    private readonly quotaService: QuotaService,
  ) {}

  /**
   * Get current user profile summary for dashboard account section.
   */
  async getCurrentUser(userId: string): Promise<UserMeResponseDto> {
    const user = await this.findActiveUserOrThrow(userId);
    const planState = await this.resolvePlanStateForUser(user);

    return {
      userId: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      planCode: planState.planCode,
      planName: planState.planName,
      planStatus: planState.planStatus,
    };
  }

  /**
   * Get rolling 24h usage summary for current user.
   */
  async getUsage(userId: string): Promise<UserUsageResponseDto> {
    await this.ensureActiveUserExists(userId);

    const [activeSessions, sessionsCreated24h, tokensUsed24h, oldestUsageIn24h] =
      await Promise.all([
        this.quotaService.getActiveSessionCount(userId),
        this.quotaService.getRolling24hSessionCount(userId),
        this.quotaService.getRolling24hTokenUsage(userId),
        this.quotaService.getOldestUsageIn24h(userId),
      ]);

    const resetAt = oldestUsageIn24h
      ? new Date(oldestUsageIn24h.getTime() + 24 * 60 * 60 * 1000).toISOString()
      : null;

    const estimatedCost = this.round3(
      (tokensUsed24h / 1000) * UsersService.ESTIMATED_COST_PER_1K_TOKENS,
    );

    return {
      activeSessions,
      sessionsCreated24h,
      tokensUsed24h,
      estimatedCost,
      resetAt,
    };
  }

  /**
   * Get quota limits and current usage for current user.
   */
  async getQuotas(userId: string): Promise<UserQuotasResponseDto> {
    const [user, usage] = await Promise.all([
      this.findActiveUserOrThrow(userId),
      this.getUsage(userId),
    ]);
    const planState = await this.resolvePlanStateForUser(user);

    return {
      planCode: planState.planCode,
      planName: planState.planName,
      planStatus: planState.planStatus,
      maxActiveSessions: planState.maxActiveSessions,
      currentActiveSessions: usage.activeSessions,
      maxSessions24h: planState.maxSessions24h,
      currentSessions24h: usage.sessionsCreated24h,
      maxTokens24h: planState.maxTokens24h,
      currentTokens24h: usage.tokensUsed24h,
      resetAt: usage.resetAt,
    };
  }

  private round3(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  private async ensureActiveUserExists(userId: string): Promise<void> {
    await this.findActiveUserOrThrow(userId);
  }

  private async findActiveUserOrThrow(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
      select: ['id', 'email', 'createdAt', 'planType', 'planStatus'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private normalizePlanStatus(status: string | null | undefined): 'active' | 'cancelled' | 'expired' {
    const normalizedStatus = (status || 'active').toLowerCase();
    if (UsersService.PLAN_STATUS_VALUES.has(normalizedStatus)) {
      return normalizedStatus as 'active' | 'cancelled' | 'expired';
    }
    return 'active';
  }

  private async resolvePlanStateForUser(user: User): Promise<{
    planCode: string;
    planName: string;
    planStatus: 'active' | 'cancelled' | 'expired';
    maxActiveSessions: number;
    maxSessions24h: number;
    maxTokens24h: number;
  }> {
    const planStatus = this.normalizePlanStatus(user.planStatus);
    const requestedPlanCode = (user.planType || UsersService.FALLBACK_PLAN_CODE).toLowerCase();
    const effectivePlanCode =
      planStatus === 'active' ? requestedPlanCode : UsersService.FALLBACK_PLAN_CODE;

    const plan = await this.planRepository.findOne({
      where: { code: effectivePlanCode, isActive: true },
      select: ['code', 'name', 'maxActiveSessions', 'maxSessions24h', 'maxTokens24h'],
    });

    if (!plan) {
      return {
        planCode: effectivePlanCode,
        planName: UsersService.FALLBACK_PLAN_NAME,
        planStatus,
        maxActiveSessions: QuotaConfig.MAX_ACTIVE_SESSIONS_PER_USER,
        maxSessions24h: QuotaConfig.MAX_SESSIONS_PER_24H,
        maxTokens24h: QuotaConfig.MAX_TOKENS_PER_24H,
      };
    }

    return {
      planCode: plan.code,
      planName: plan.name,
      planStatus,
      maxActiveSessions: plan.maxActiveSessions,
      maxSessions24h: plan.maxSessions24h,
      maxTokens24h: plan.maxTokens24h,
    };
  }
}
