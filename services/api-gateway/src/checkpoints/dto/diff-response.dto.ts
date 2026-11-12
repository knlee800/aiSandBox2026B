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
  /**
   * CM-DIFF-NOTICE-01: true when container-manager cut the commit diff at
   * diffLimitBytes (CM-DIFF-CAP-01). Absent or false means the diff is whole.
   */
  truncated?: boolean;
  /** The byte limit the diff was cut at. Present only when truncated is true. */
  diffLimitBytes?: number;
}
