import {
  Controller,
  Post,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import {
  WebhookService,
  WebhookVerificationError,
} from './webhook.service';

/**
 * Express Request extended with rawBody from NestJS rawBody: true option.
 */
interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/**
 * BILLING-READY-05D: Stripe webhook controller.
 *
 * Public unauthenticated endpoint protected by Stripe HMAC signature verification.
 * No SessionCookieGuard. No PublicApiKeyGuard. No InternalServiceAuthGuard
 * (global guard bypasses non-/api/internal/* routes automatically).
 *
 * No Stripe SDK. No provider API calls. No env/secrets changes.
 */
@Controller('billing/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: RawBodyRequest,
  ): Promise<{ received: boolean; error?: string }> {
    const signature = req.headers['stripe-signature'] as string | undefined;

    if (!signature) {
      this.logger.warn('Webhook received without stripe-signature header');
      return WebhookController.errorResponse(
        HttpStatus.BAD_REQUEST,
        'MISSING_SIGNATURE',
        req,
      );
    }

    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body) || '{}');

    try {
      const result = await this.webhookService.processWebhook(
        rawBody,
        signature,
      );
      return { received: result.received };
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        this.logger.warn(
          `Webhook verification failed: ${error.code}`,
        );
        return WebhookController.errorResponse(
          HttpStatus.BAD_REQUEST,
          error.code,
          req,
        );
      }

      this.logger.error(
        `Unexpected webhook processing error: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return { received: true };
    }
  }

  /**
   * Set HTTP status on the response and return error body.
   * Uses the underlying Express response to override @HttpCode.
   */
  private static errorResponse(
    statusCode: number,
    errorCode: string,
    req: RawBodyRequest,
  ): { received: boolean; error: string } {
    const res = req.res;
    if (res && typeof res.status === 'function') {
      res.status(statusCode);
    }
    return { received: false, error: errorCode };
  }
}
