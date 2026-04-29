import { IsUUID } from 'class-validator';

export class MoveProjectDto {
  @IsUUID()
  targetWorkspaceId: string;
}
