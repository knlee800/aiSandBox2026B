import {
  Controller,
  Get,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { CreditBalanceRepository } from './credit-deduction/credit-balance.repository';
import { SubscriptionRepository } from './subscription/subscription.repository';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
    plan: string;
  };
}

export interface BillingBalanceResponse {
  balance: number;
  monthlyAllocation: number;
  planId: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
}

export interface BillingSubscriptionResponse {
  planType: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAt: string | null;
}

/**
 * BILLING-READY-05F: Billing read-only endpoints.
 *
 * Browser-session-only GET endpoints for the billing UI page.
 * Returns current user's credit balance and subscription status.
 * No provider calls. No credit mutation. No API key access.
 */
@Controller('billing')
@UseGuards(SessionCookieGuard)
export class BillingReadController {
  constructor(
    private readonly creditBalanceRepository: CreditBalanceRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
  ) {}

  @Get('balance')
  @HttpCode(HttpStatus.OK)
  async getBalance(
    @Req() req: AuthenticatedRequest,
  ): Promise<BillingBalanceResponse> {
    const balance = await this.creditBalanceRepository.findByOwner(
      req.user.userId,
      'user',
    );

    if (!balance) {
      return {
        balance: 0,
        monthlyAllocation: 0,
        planId: 'free',
        periodStart: null,
        periodEnd: null,
        status: 'active',
      };
    }

    return {
      balance: balance.balance,
      monthlyAllocation: balance.monthlyAllocation,
      planId: balance.planId,
      periodStart: balance.periodStart?.toISOString() ?? null,
      periodEnd: balance.periodEnd?.toISOString() ?? null,
      status: balance.status,
    };
  }

  @Get('subscription')
  @HttpCode(HttpStatus.OK)
  async getSubscription(
    @Req() req: AuthenticatedRequest,
  ): Promise<BillingSubscriptionResponse | null> {
    const subscription =
      await this.subscriptionRepository.findActiveByUserId(req.user.userId);

    if (!subscription) {
      return null;
    }

    return {
      planType: subscription.planType,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      cancelAt: subscription.cancelAt?.toISOString() ?? null,
    };
  }
}
