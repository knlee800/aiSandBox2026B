export interface WorkspaceExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type WorkspaceExecStatus =
  | 'idle'
  | 'sending'
  | 'result'
  | 'http-400'
  | 'http-404'
  | 'http-410'
  | 'network-error';

export interface WorkspaceExecState {
  status: WorkspaceExecStatus;
  result: WorkspaceExecResult | null;
  errorMessage?: string;
}

interface ExecuteSessionCommandInput {
  token: string;
  sessionId: string;
  command: string;
  fetchImpl?: typeof fetch;
}

export async function executeSessionCommand(
  input: ExecuteSessionCommandInput,
): Promise<WorkspaceExecState> {
  const fetchImpl = input.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`/api/sessions/${input.sessionId}/exec`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command: input.command }),
    });

    if (response.ok) {
      const payload = (await response.json()) as WorkspaceExecResult;
      return {
        status: 'result',
        result: payload,
      };
    }

    if (response.status === 400) {
      return { status: 'http-400', result: null };
    }

    if (response.status === 404) {
      return { status: 'http-404', result: null };
    }

    if (response.status === 410) {
      return { status: 'http-410', result: null };
    }

    let errorMessage = `Exec request failed (HTTP ${response.status})`;
    try {
      const rawText = await response.text();
      if (rawText.trim()) {
        try {
          const parsed = JSON.parse(rawText) as { message?: string; error?: string };
          const serverMessage = parsed.message ?? parsed.error;
          if (typeof serverMessage === 'string' && serverMessage.trim()) {
            errorMessage = `Exec request failed (HTTP ${response.status}): ${serverMessage}`;
          }
        } catch {
          errorMessage = `Exec request failed (HTTP ${response.status}): ${rawText.trim()}`;
        }
      }
    } catch {
      // Keep fallback HTTP status message if response body cannot be read.
    }

    return { status: 'network-error', result: null, errorMessage };
  } catch (error) {
    if (error instanceof Error && error.message.trim()) {
      return { status: 'network-error', result: null, errorMessage: `Exec request failed: ${error.message}` };
    }
    return { status: 'network-error', result: null, errorMessage: 'Exec request failed: network error' };
  }
}
