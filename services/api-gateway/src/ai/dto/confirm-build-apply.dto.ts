import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

/**
 * PRIVATE-BETA-BLOCKER-03D-A: Confirm-build-apply request body.
 *
 * Qualifying deduction is decided in UsageLedgerService against persisted
 * usage_records evidence. This DTO only rejects malformed input.
 */
export class ConfirmBuildApplyDto {
  @IsString()
  @IsNotEmpty()
  applyStatus: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalActions: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  successCount: number;
}
