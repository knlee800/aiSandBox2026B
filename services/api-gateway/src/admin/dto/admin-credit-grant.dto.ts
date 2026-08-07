import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class AdminCreditGrantRequestDto {
  @IsInt()
  @Min(1)
  amount: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @IsUUID()
  idempotencyKey: string;
}

export class AdminCreditGrantResponseDto {
  grantId: string;
  status: 'granted' | 'duplicate' | 'failed';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
}
