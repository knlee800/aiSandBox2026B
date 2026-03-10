import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
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

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly quotaService: QuotaService,
  ) {}

  /**
   * Get current user profile summary for dashboard account section.
   */
  async getCurrentUser(userId: string): Promise<UserMeResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
      select: ['id', 'email', 'createdAt'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      userId: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Get rolling 24h usage summary for current user.
   */
  async getUsage(userId: string): Promise<UserUsageResponseDto> {
    const [activeSessions, sessionsCreated24h, tokensUsed24h, oldestUsageIn24h] =
      await Promise.all([
        this.quotaService.getActiveSessionCount(userId),
        this.quotaService.getRolling24hSessionCount(userId),
        this.quotaService.getRolling24hTokenUsage(userId),
        this.quotaService.getOldestUsageIn24h(userId),
      ]);

    const resetAt = oldestUsageIn24h
      ? new Date(oldestUsageIn24h.getTime() + 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

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
    const usage = await this.getUsage(userId);

    return {
      maxActiveSessions: QuotaConfig.MAX_ACTIVE_SESSIONS_PER_USER,
      currentActiveSessions: usage.activeSessions,
      maxSessions24h: QuotaConfig.MAX_SESSIONS_PER_24H,
      currentSessions24h: usage.sessionsCreated24h,
      maxTokens24h: QuotaConfig.MAX_TOKENS_PER_24H,
      currentTokens24h: usage.tokensUsed24h,
      resetAt: usage.resetAt,
    };
  }

  private round3(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}
