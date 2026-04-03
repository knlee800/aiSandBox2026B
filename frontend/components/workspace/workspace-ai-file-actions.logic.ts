import { isUsableSession, type WorkspaceShellSession } from './workspace-shell.logic';

export type WorkspaceFileActionType = 'create' | 'write' | 'update';

export interface WorkspaceFileAction {
  action: WorkspaceFileActionType;
  path: string;
  content: string;
}

export type WorkspaceExecutionFileActionResultStatus = 'success' | 'failed' | 'skipped';

export interface WorkspaceExecutionFileActionResult {
  action: WorkspaceFileActionType;
  path: string;
  status: WorkspaceExecutionFileActionResultStatus;
  error: string | null;
}

export type WorkspaceExecutionFileActionApplyStatus = 'pending' | 'applied' | 'skipped';

export interface WorkspaceExecutionFileActionState {
  executionId: string;
  source: 'stream' | 'status';
  fileActions: WorkspaceFileAction[];
  applyStatus: WorkspaceExecutionFileActionApplyStatus;
  skipReason: string | null;
  results: WorkspaceExecutionFileActionResult[];
}

export function acquireExecutionApplyGuard(
  executionId: string,
  appliedExecutionIds: Set<string>,
): boolean {
  if (appliedExecutionIds.has(executionId)) {
    return false;
  }
  appliedExecutionIds.add(executionId);
  return true;
}

export interface ApplySequentialFileActionsArgs {
  sessionId: string;
  actions: WorkspaceFileAction[];
  getSelectedSessionId: () => string | null;
  getSessionById: (sessionId: string) => WorkspaceShellSession | null;
  writeFile: (action: WorkspaceFileAction) => Promise<void>;
}

export interface ApplySequentialFileActionsResult {
  applyStatus: WorkspaceExecutionFileActionApplyStatus;
  skipReason: string | null;
  results: WorkspaceExecutionFileActionResult[];
}

function asErrorMessage(value: unknown): string {
  if (value instanceof Error && value.message.trim()) {
    return value.message;
  }
  return 'Unknown write failure.';
}

function toSkippedResults(
  actions: WorkspaceFileAction[],
  reason: string,
): WorkspaceExecutionFileActionResult[] {
  return actions.map((action) => ({
    action: action.action,
    path: action.path,
    status: 'skipped',
    error: reason,
  }));
}

function ensureSessionUsable(
  sessionId: string,
  getSelectedSessionId: () => string | null,
  getSessionById: (sessionId: string) => WorkspaceShellSession | null,
): { ok: true } | { ok: false; reason: string } {
  const selectedSessionId = getSelectedSessionId();
  if (!selectedSessionId || selectedSessionId !== sessionId) {
    return { ok: false, reason: 'stale-session' };
  }
  const session = getSessionById(sessionId);
  if (!session) {
    return { ok: false, reason: 'inactive-session' };
  }
  if (session.terminatedAt || session.status === 'terminated') {
    return { ok: false, reason: 'terminated-session' };
  }
  if (!isUsableSession(session)) {
    return { ok: false, reason: 'inactive-session' };
  }
  return { ok: true };
}

export async function applySequentialFileActions(
  args: ApplySequentialFileActionsArgs,
): Promise<ApplySequentialFileActionsResult> {
  const initialSessionGate = ensureSessionUsable(
    args.sessionId,
    args.getSelectedSessionId,
    args.getSessionById,
  );
  if (!initialSessionGate.ok) {
    return {
      applyStatus: 'skipped',
      skipReason: initialSessionGate.reason,
      results: toSkippedResults(args.actions, initialSessionGate.reason),
    };
  }

  const results: WorkspaceExecutionFileActionResult[] = [];
  for (let index = 0; index < args.actions.length; index += 1) {
    const action = args.actions[index];
    const sessionGate = ensureSessionUsable(
      args.sessionId,
      args.getSelectedSessionId,
      args.getSessionById,
    );
    if (!sessionGate.ok) {
      const remainingActions = args.actions.slice(index);
      results.push(...toSkippedResults(remainingActions, sessionGate.reason));
      return {
        applyStatus: 'skipped',
        skipReason: sessionGate.reason,
        results,
      };
    }

    try {
      await args.writeFile(action);
      results.push({
        action: action.action,
        path: action.path,
        status: 'success',
        error: null,
      });
    } catch (error) {
      results.push({
        action: action.action,
        path: action.path,
        status: 'failed',
        error: asErrorMessage(error),
      });
    }
  }

  return {
    applyStatus: 'applied',
    skipReason: null,
    results,
  };
}
