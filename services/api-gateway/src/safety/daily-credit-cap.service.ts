import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditDeductionRecord } from '../entities/credit-deduction-record.entity';

const DEFAULT_MAX_DAILY_CREDITS_PLATFORM = 1000;
const DEFAULT_MAX_DAILY_CREDITS_PER_USER = 500;

type CreditTotalRow = { total?: string | number | null };

/**
 * Daily credit caps from credit_deduction_records.
 * Totals are requested_credits created since 00:00:00.000 UTC today.
 * Every status is included. A missing or invalid cap falls back to the default.
 */
@Injectable()
export class DailyCreditCapService {
  private readonly logger = new Logger(DailyCreditCapService.name);

  constructor(
    @InjectRepository(CreditDeductionRecord)
    private readonly records: Repository<CreditDeductionRecord>,
  ) {}

  async assertWithinDailyCap(userId: unknown): Promise<void> {
    try {
      if (typeof userId !== 'string' || userId.trim() === '') {
        throw this.limitReached();
      }

      const since = this.startOfUtcDay(new Date());
      const platformCap = this.readCap(
        process.env.MAX_DAILY_CREDITS_PLATFORM,
        DEFAULT_MAX_DAILY_CREDITS_PLATFORM,
      );
      const userCap = this.readCap(
        process.env.MAX_DAILY_CREDITS_PER_USER,
        DEFAULT_MAX_DAILY_CREDITS_PER_USER,
      );
      const platformTotal = await this.sumRequestedCredits(since);
      const userTotal = await this.sumRequestedCredits(since, userId);

      if (platformTotal >= platformCap) {
        throw this.limitReached('platform');
      }
      if (userTotal >= userCap) {
        throw this.limitReached('user');
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.warn('Daily credit cap check failed');
      throw new ServiceUnavailableException('Daily credit limit check failed');
    }
  }

  private limitReached(cap?: 'platform' | 'user'): HttpException {
    const body: Record<string, unknown> = {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Daily credit limit reached',
      error: 'Too Many Requests',
    };
    if (cap) {
      body.cap = cap;
    }
    return new HttpException(body, HttpStatus.TOO_MANY_REQUESTS);
  }

  private readCap(raw: string | undefined, fallback: number): number {
    if (raw === undefined || raw.trim() === '') {
      return fallback;
    }
    const parsed = Number(raw.trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }

  private startOfUtcDay(now: Date): Date {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private async sumRequestedCredits(since: Date, userId?: string): Promise<number> {
    const query = this.records
      .createQueryBuilder('record')
      .select('COALESCE(SUM(record.requestedCredits), 0)', 'total')
      .where('record.createdAt >= :since', { since });
    if (userId !== undefined) {
      query.andWhere('record.ownerId = :userId', { userId });
    }
    const raw = (await query.getRawOne()) as CreditTotalRow | null | undefined;
    if (raw == null || raw.total === undefined || raw.total === null) {
      throw new Error('missing credit total');
    }
    const total = typeof raw.total === 'number' ? raw.total : Number(raw.total);
    if (!Number.isFinite(total)) {
      throw new Error('invalid credit total');
    }
    return total;
  }
}
