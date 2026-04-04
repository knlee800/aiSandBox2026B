import { IsIn, IsString } from 'class-validator';

export class UpdateProjectVisibilityDto {
  @IsString()
  @IsIn(['private', 'public'])
  visibility: 'private' | 'public';
}
