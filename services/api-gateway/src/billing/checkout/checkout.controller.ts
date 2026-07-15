import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionCookieGuard } from '../../auth/session-cookie.guard';
import { CheckoutService } from './checkout.service';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';
import { CreateTopUpCheckoutDto } from './dto/create-topup-checkout.dto';
import type { CheckoutSessionResponseDto } from './dto/checkout-session-response.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
    plan: string;
  };
}

/**
 * BILLING-READY-05C: Checkout controller.
 *
 * Browser-session-only authenticated endpoints for subscription checkout
 * and credit top-up checkout. No API key access allowed.
 *
 * Routes: /api/billing/checkout/* (global prefix 'api' applied in main.ts)
 */
@Controller('billing/checkout')
@UseGuards(SessionCookieGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  /**
   * POST /api/billing/checkout/subscription
   *
   * Create a subscription checkout session for the authenticated user.
   */
  @Post('subscription')
  @HttpCode(HttpStatus.CREATED)
  async createSubscriptionCheckout(
    @Body() dto: CreateSubscriptionCheckoutDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<CheckoutSessionResponseDto> {
    return this.checkoutService.createSubscriptionCheckout(
      req.user.userId,
      req.user.email,
      dto.planId,
      dto.successUrl,
      dto.cancelUrl,
    );
  }

  /**
   * POST /api/billing/checkout/topup
   *
   * Create a credit top-up checkout session for the authenticated user.
   */
  @Post('topup')
  @HttpCode(HttpStatus.CREATED)
  async createTopUpCheckout(
    @Body() dto: CreateTopUpCheckoutDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<CheckoutSessionResponseDto> {
    return this.checkoutService.createTopUpCheckout(
      req.user.userId,
      req.user.email,
      dto.topUpPackId,
      dto.successUrl,
      dto.cancelUrl,
    );
  }
}
