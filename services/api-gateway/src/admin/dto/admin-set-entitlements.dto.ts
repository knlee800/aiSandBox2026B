import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PLAN_DEFINITIONS } from '../../credit-ledger/config/plan-definitions.config';

const PLAN_OVERRIDE_IDS = PLAN_DEFINITIONS.map((plan) => plan.id);

@ValidatorConstraint({ name: 'atLeastOneEntitlementField', async: false })
class AtLeastOneEntitlementFieldConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as AdminSetEntitlementsRequestDto;
    return (
      dto.harnessEnabled !== undefined ||
      dto.agentWriteEnabled !== undefined ||
      dto.planOverride !== undefined ||
      dto.dailyTokenLimitOverride !== undefined
    );
  }

  defaultMessage(): string {
    return 'At least one entitlement field is required';
  }
}

export class AdminSetEntitlementsRequestDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  harnessEnabled?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  agentWriteEnabled?: boolean;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsIn(PLAN_OVERRIDE_IDS)
  planOverride?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(1)
  @Max(100000000)
  dailyTokenLimitOverride?: number | null;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Validate(AtLeastOneEntitlementFieldConstraint)
  reason: string;
}
