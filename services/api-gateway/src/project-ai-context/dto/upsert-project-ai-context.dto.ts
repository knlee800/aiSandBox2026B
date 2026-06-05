import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertProjectAiContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  projectInstructions?: string | null;
}
