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

/**
 * BILLING-READY-04A: Credit Balance Gate Guard
 *
 * Pre-execution guard that verifies the requesting user has a
 * provisioned credit balance with balance > 0 before allowing
 * AI execution to proceed.
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

    if (creditBalance.balance <= 0) {
      this.logger.warn(
        `Credit balance exhausted for user ${userId}: balance=${creditBalance.balance}`,
      );
      throw new HttpException(
        {
          statusCode: 402,
          error: 'Payment Required',
          message: 'Insufficient credit balance',
          details: {
            error_code: 'credit_balance_exhausted',
            current_balance: creditBalance.balance,
          },
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
