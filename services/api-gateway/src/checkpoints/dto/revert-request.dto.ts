import { IsString, IsNotEmpty, Length } from 'class-validator';

/**
 * RevertRequestDto
 * Request body for POST /api/sessions/:id/revert
 * Validates commit hash format
 */
export class RevertRequestDto {
  @IsString()
  @IsNotEmpty()
  @Length(40, 40, { message: 'commitHash must be exactly 40 characters' })
  commitHash: string;
}
