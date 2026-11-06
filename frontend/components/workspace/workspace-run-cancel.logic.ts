export type RunCancelKind = 'requested' | 'already_finished' | 'failed';

export type RunCancelResult = {
  kind: RunCancelKind;
};

export async function requestRunCancel(args: {
  executionId: string;
  fetchImpl?: typeof fetch;
}): Promise<RunCancelResult> {
  try {
    const response = await (args.fetchImpl ?? fetch)(
      `/api/ai/executions/${args.executionId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
    );

    if (response.ok) {
      return { kind: 'requested' };
    }

    if (response.status === 409) {
      return { kind: 'already_finished' };
    }

    return { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}

export function shouldShowChatStopButton(args: {
  requestState: string;
  executionId: string | null;
  hasStopHandler: boolean;
}): boolean {
  if (!args.hasStopHandler || !args.executionId) {
    return false;
  }
  return args.requestState === 'queued' || args.requestState === 'running';
}

export function chatTerminalFailureCopy(args: {
  status: string;
  output: string;
  runStoppedMessage: string;
}): { rawMessage: string; fallbackMessage: string } {
  if (args.status === 'cancelled') {
    return {
      rawMessage: '',
      fallbackMessage: args.runStoppedMessage,
    };
  }

  return {
    rawMessage: args.output,
    fallbackMessage: `Execution ended with status: ${args.status}.`,
  };
}

export function runCancelUserMessage(args: {
  kind: RunCancelKind;
  alreadyFinishedMessage: string;
  failedMessage: string;
}): string | null {
  if (args.kind === 'already_finished') {
    return args.alreadyFinishedMessage;
  }
  if (args.kind === 'failed') {
    return args.failedMessage;
  }
  return null;
}

export function shouldReleaseStopButton(kind: RunCancelKind): boolean {
  return kind === 'failed';
}
