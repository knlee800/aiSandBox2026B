import { IsString, IsNotEmpty, IsIn, MaxLength } from 'class-validator';

/**
 * BILLING-READY-05C: Subscription checkout request DTO.
 *
 * planId is validated against an allowlist — user cannot supply arbitrary
 * Stripe price IDs. The server maps planId to an internal price placeholder.
 */
export class CreateSubscriptionCheckoutDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['starter', 'pro', 'team'], {
    message: 'planId must be one of: starter, pro, team',
  })
  planId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  successUrl: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  cancelUrl: string;
}
