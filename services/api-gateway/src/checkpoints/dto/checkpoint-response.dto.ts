/**
 * CheckpointResponseDto
 * Response format for checkpoint list endpoint
 * Maps GitCheckpoint entity to public API format
 */
export class CheckpointResponseDto {
  id: string;
  commitHash: string;
  messageNumber: number | null;
  description: string | null;
  filesChanged: number;
  createdAt: string;
}
