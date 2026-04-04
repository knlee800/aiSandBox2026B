import { IsNotEmpty, IsString } from 'class-validator';

export class RestoreSnapshotDto {
  @IsString()
  @IsNotEmpty()
  snapshotId: string;
}
