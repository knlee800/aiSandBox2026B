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
    // #region agent log
    fetch('http://127.0.0.1:7870/ingest/eba94f28-6765-4a01-9905-123e592de80f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8262b1'},body:JSON.stringify({sessionId:'8262b1',runId:'save-point-pre-fix',hypothesisId:'SP1,SP2,SP3',location:'workspace-checkpoint-create.logic.ts:createWorkspaceCheckpoint',message:'checkpoint create request failed',data:{sessionId:args.sessionId,status:response.status,statusText:response.statusText,bodySnippet:responseText.slice(0,300)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
