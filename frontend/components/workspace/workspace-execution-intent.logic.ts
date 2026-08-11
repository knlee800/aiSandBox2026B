export const WORKSPACE_EXECUTION_INTENTS = [
  'conversation',
  'workspace_mutation',
] as const;

export type WorkspaceExecutionIntent =
  (typeof WORKSPACE_EXECUTION_INTENTS)[number];

export const DEFAULT_WORKSPACE_EXECUTION_INTENT: WorkspaceExecutionIntent =
  'workspace_mutation';

function isWorkspaceExecutionIntent(
  value: unknown,
): value is WorkspaceExecutionIntent {
  return (
    typeof value === 'string' &&
    (value === 'conversation' || value === 'workspace_mutation')
  );
}

export function normalizeWorkspaceExecutionIntent(
  value: unknown,
): WorkspaceExecutionIntent {
  if (isWorkspaceExecutionIntent(value)) {
    return value;
  }
  return DEFAULT_WORKSPACE_EXECUTION_INTENT;
}

export function resolveExecutionIntentForRequest(input: {
  executionIntent?: unknown;
  providerWorkspaceMutationAttempted?: unknown;
}): WorkspaceExecutionIntent {
  void input.providerWorkspaceMutationAttempted;
  return normalizeWorkspaceExecutionIntent(input.executionIntent);
}

export function buildExecutionIntentRequestPayload(
  executionIntent: unknown,
): { executionIntent: WorkspaceExecutionIntent } {
  return {
    executionIntent: normalizeWorkspaceExecutionIntent(executionIntent),
  };
}

export function shouldApplyFileActionsForExecutionIntent(
  executionIntent: unknown,
): boolean {
  return normalizeWorkspaceExecutionIntent(executionIntent) === 'workspace_mutation';
}

export function resolveExecutionIntentSelection(input: {
  currentIntent: WorkspaceExecutionIntent;
  nextIntent: unknown;
}): WorkspaceExecutionIntent {
  const normalizedNextIntent = normalizeWorkspaceExecutionIntent(input.nextIntent);
  return normalizedNextIntent === input.currentIntent
    ? input.currentIntent
    : normalizedNextIntent;
}
