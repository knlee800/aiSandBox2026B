import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertUserAiInstructionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  globalInstructions?: string | null;
}
