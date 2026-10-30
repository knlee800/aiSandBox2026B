export type WorkspaceCheckpointCreateState = 'idle' | 'creating' | 'created' | 'create-error';

interface CreateWorkspaceCheckpointArgs {
  token?: string;
  sessionId: string;
  userId: string;
  description?: string;
  allowEmpty?: boolean;
  fetchImpl?: typeof fetch;
}

export interface WorkspaceCheckpointCreateResult {
  message: string;
  commitHash: string | null;
  filesChanged: number;
}

export async function createWorkspaceCheckpoint(
  args: CreateWorkspaceCheckpointArgs,
): Promise<WorkspaceCheckpointCreateResult> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const trimmedDescription = args.description?.trim();
  const body: Record<string, unknown> = {
    userId: args.userId,
    messageNumber: 0,
  };

  if (trimmedDescription) {
    body.description = trimmedDescription;
  }
  if (args.allowEmpty === true) {
    body.allowEmpty = true;
  }

  const response = await fetchImpl(
    `/api/sessions/${encodeURIComponent(args.sessionId)}/checkpoints`,
    {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    let responseText = '';
    try {
      responseText = await response.text();
    } catch {
      responseText = '';
    }
    const detail = responseText.trim();
    throw new Error(
      detail
        ? `Checkpoint create failed (${response.status}): ${detail}`
        : `Checkpoint create failed (${response.status})`,
    );
  }

  try {
    return (await response.json()) as WorkspaceCheckpointCreateResult;
  } catch {
    return { message: 'Checkpoint created', commitHash: null, filesChanged: 0 };
  }
}
