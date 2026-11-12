export type WorkspaceCheckpointDiffState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'diff-error';

export interface WorkspaceCheckpointDiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  diff: string;
}

export interface WorkspaceCheckpointDiffResponse {
  commitHash: string;
  parentHash: string | null;
  files: WorkspaceCheckpointDiffFile[];
  /**
   * CM-DIFF-NOTICE-01: true when the diff was cut at diffLimitBytes
   * (CM-DIFF-CAP-01). Absent means the diff is whole.
   */
  truncated?: boolean;
  /** The byte limit the diff was cut at; only when truncated is true. */
  diffLimitBytes?: number;
}

export interface WorkspaceCheckpointDiffTruncation {
  truncated: boolean;
  diffLimitBytes: number | null;
}

/**
 * CM-DIFF-NOTICE-01: reads the cut from a diff response. Anything but
 * truncated === true is a whole diff; diffLimitBytes counts only when it is a
 * positive finite number on a cut diff.
 */
export function getWorkspaceCheckpointDiffTruncation(
  response: object | null | undefined,
): WorkspaceCheckpointDiffTruncation {
  const fields = (response ?? {}) as { truncated?: unknown; diffLimitBytes?: unknown };
  if (fields.truncated !== true) {
    return { truncated: false, diffLimitBytes: null };
  }
  const limit = fields.diffLimitBytes;
  return {
    truncated: true,
    diffLimitBytes:
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? limit : null,
  };
}

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

function formatSizeNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * CM-DIFF-NOTICE-01: a readable size for the notice, e.g. 8388608 -> "8 MB",
 * 1572864 -> "1.5 MB", 512000 -> "500 KB". Units are binary (1 MB = 1024 KB),
 * matching how container-manager sets the limit.
 */
export function formatWorkspaceCheckpointDiffLimit(bytes: number): string {
  if (bytes >= BYTES_PER_MB) {
    return `${formatSizeNumber(bytes / BYTES_PER_MB)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`;
}

interface LoadWorkspaceCheckpointDiffArgs {
  token?: string;
  sessionId: string;
  commitHash: string;
  fetchImpl?: typeof fetch;
}

export async function loadWorkspaceCheckpointDiff(
  args: LoadWorkspaceCheckpointDiffArgs,
): Promise<WorkspaceCheckpointDiffResponse> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `/api/sessions/${encodeURIComponent(args.sessionId)}/checkpoints/${encodeURIComponent(args.commitHash)}/diff`,
    {
      method: 'GET',
    },
  );

  if (!response.ok) {
    throw new Error(`Checkpoint diff load failed (${response.status})`);
  }

  const body = (await response.json()) as WorkspaceCheckpointDiffResponse;
  const { truncated, diffLimitBytes } = getWorkspaceCheckpointDiffTruncation(body);
  const result: WorkspaceCheckpointDiffResponse = {
    commitHash: body.commitHash,
    parentHash: body.parentHash,
    files: body.files,
  };
  if (truncated) {
    result.truncated = true;
    if (diffLimitBytes !== null) {
      result.diffLimitBytes = diffLimitBytes;
    }
  }
  return result;
}
