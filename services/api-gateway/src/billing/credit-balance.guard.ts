import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditBalanceRepository } from './credit-deduction/credit-balance.repository';
import { User } from '../entities/user.entity';
import { UserRole } from '../entities/user-role.enum';
import { ApiKeyIdentity } from '../auth/api-key.config';
import { QuotaConfig } from '../quota/quota.config';

/**
 * BILLING-READY-04A: Credit Balance Gate Guard
 *
 * Pre-execution guard that verifies the requesting user has a
 * provisioned credit balance that covers the pre-execution estimate
 * (ceil(estimate / 1000) credits) before allowing AI execution.
 *
 * Position in guard chain: after IdempotencyGuard, before QuotaGuard.
 *
 * Read-only — does NOT deduct credits, lock rows, or mutate DB.
 * Credit deduction is handled post-execution by PersistentCreditDeductionGateway.
 *
 * Admin users (UserRole.ADMIN) bypass the balance check.
 */
@Injectable()
export class CreditBalanceGuard implements CanActivate {
  private readonly logger = new Logger(CreditBalanceGuard.name);

  constructor(
    private readonly creditBalanceRepository: CreditBalanceRepository,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const identity = request.apiKeyIdentity as ApiKeyIdentity | undefined;

    if (!identity?.userId) {
      throw new HttpException(
        'Credit balance check failed: missing identity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const userId = identity.userId;

    const [user, creditBalance] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.creditBalanceRepository.findByOwner(userId, 'user'),
    ]);

    if (user?.role === UserRole.ADMIN) {
      return true;
    }

    if (!creditBalance) {
      this.logger.warn(
        `Credit balance not provisioned for user ${userId}`,
      );
      throw new HttpException(
        {
          statusCode: 402,
          error: 'Payment Required',
          message: 'Credit balance not provisioned',
          details: {
            error_code: 'credit_balance_not_provisioned',
          },
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const estimatedTokens = QuotaConfig.estimatePreExecutionTokens(request.body);
    const requiredCredits = Math.ceil(estimatedTokens / 1000);

    if (creditBalance.balance < requiredCredits) {
      this.logger.warn(
        `Credit balance insufficient for user ${userId}: balance=${creditBalance.balance} required=${requiredCredits}`,
      );
      throw new HttpException(
        {
          statusCode: 402,
          error: 'Payment Required',
          message: 'Insufficient credit balance',
          details: {
            error_code: 'credit_balance_exhausted',
            current_balance: creditBalance.balance,
            required_credits: requiredCredits,
          },
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
