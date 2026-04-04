import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OpenProjectDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  snapshotId?: string;
}
