export type WorkspaceCheckpointCreateState = 'idle' | 'creating' | 'created' | 'create-error';

interface CreateWorkspaceCheckpointArgs {
  token: string;
  sessionId: string;
  userId: string;
  description?: string;
  fetchImpl?: typeof fetch;
}

export async function createWorkspaceCheckpoint(
  args: CreateWorkspaceCheckpointArgs,
): Promise<void> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const trimmedDescription = args.description?.trim();
  const body: Record<string, unknown> = {
    userId: args.userId,
    messageNumber: 0,
  };

  if (trimmedDescription) {
    body.description = trimmedDescription;
  }

  const response = await fetchImpl(`/api/git/${encodeURIComponent(args.sessionId)}/commit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Checkpoint create failed (${response.status})`);
  }
}
