/**
 * DiffFileDto
 * Represents a single file change in a diff
 */
export class DiffFileDto {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  diff: string;
}

/**
 * DiffResponseDto
 * Response format for checkpoint diff endpoint
 * Contains diff between checkpoint and parent commit
 */
export class DiffResponseDto {
  commitHash: string;
  parentHash: string | null;
  files: DiffFileDto[];
}
