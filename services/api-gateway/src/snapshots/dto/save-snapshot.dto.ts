import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveSnapshotDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}
