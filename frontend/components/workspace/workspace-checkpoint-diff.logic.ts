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
}

interface LoadWorkspaceCheckpointDiffArgs {
  token: string;
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
      headers: {
        Authorization: `Bearer ${args.token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Checkpoint diff load failed (${response.status})`);
  }

  return (await response.json()) as WorkspaceCheckpointDiffResponse;
}
