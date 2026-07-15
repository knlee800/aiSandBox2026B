import { IsString, IsNotEmpty, IsIn, MaxLength } from 'class-validator';

/**
 * BILLING-READY-05C: Credit top-up checkout request DTO.
 *
 * topUpPackId is validated against a static server-side allowlist.
 * User cannot supply arbitrary Stripe price IDs.
 */
export class CreateTopUpCheckoutDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['topup_1000', 'topup_5000', 'topup_20000'], {
    message: 'topUpPackId must be one of: topup_1000, topup_5000, topup_20000',
  })
  topUpPackId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  successUrl: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  cancelUrl: string;
}
