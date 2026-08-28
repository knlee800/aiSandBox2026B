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

const USER_AGENT_ID_QUERY_PARAM = 'userAgentId';
const UUID_SHAPED_VALUE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_NOT_FOUND_MESSAGE = /^Session with ID .+ not found$/i;

export function parseUserAgentIdQueryParam(search: string): string | null {
  const query = search.startsWith('?') ? search.slice(1) : search;
  if (!query.trim()) {
    return null;
  }
  const raw = new URLSearchParams(query).get(USER_AGENT_ID_QUERY_PARAM);
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!UUID_SHAPED_VALUE.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function buildPersistedUserAgentAskRequestFields(input: {
  agentId?: string | null;
  executionIntent: unknown;
}): { agentId: string } | Record<string, never> {
  if (normalizeWorkspaceExecutionIntent(input.executionIntent) !== 'conversation') {
    return {};
  }
  const agentId = typeof input.agentId === 'string' ? input.agentId.trim() : '';
  if (!agentId) {
    return {};
  }
  return { agentId };
}

export function resolvePersistedUserAgentAskExecuteError(input: {
  boundUserAgentId?: string | null;
  statusCode?: number;
  rawMessage?: string;
  notFoundMessage: string;
  sessionNotFoundMessage: string;
}): string | null {
  const boundId =
    typeof input.boundUserAgentId === 'string' ? input.boundUserAgentId.trim() : '';
  if (!boundId || input.statusCode !== 404) {
    return null;
  }
  const raw = typeof input.rawMessage === 'string' ? input.rawMessage.trim() : '';
  if (SESSION_NOT_FOUND_MESSAGE.test(raw)) {
    return input.sessionNotFoundMessage;
  }
  return input.notFoundMessage;
}
