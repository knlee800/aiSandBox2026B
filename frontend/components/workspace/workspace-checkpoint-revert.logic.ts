export type WorkspaceCheckpointRevertState =
  | 'idle'
  | 'previewing'
  | 'confirming'
  | 'reverting'
  | 'reverted'
  | 'revert-error';

interface RevertWorkspaceCheckpointArgs {
  token?: string;
  sessionId: string;
  userId: string;
  commitHash: string;
  fetchImpl?: typeof fetch;
}

export async function revertWorkspaceCheckpoint(
  args: RevertWorkspaceCheckpointArgs,
): Promise<void> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const response = await fetchImpl(`/api/git/${encodeURIComponent(args.sessionId)}/revert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: args.userId,
      commitHash: args.commitHash,
    }),
  });

  if (!response.ok) {
    throw new Error(`Checkpoint revert failed (${response.status})`);
  }
}
