/**
 * RevertCheckpointDto
 * Nested checkpoint info in revert response
 */
export class RevertCheckpointDto {
  id: string;
  commitHash: string;
  description: string;
}

/**
 * RevertResponseDto
 * Response format for POST /api/sessions/:id/revert
 * Returns success message and new checkpoint info
 */
export class RevertResponseDto {
  message: string;
  newCheckpoint: RevertCheckpointDto;
}
