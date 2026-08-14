import {
  WORKSPACE_FILE_WRITE_SESSION_EXPIRED_CODE,
  isWorkspaceFileWriteError,
} from './workspace-file-navigation.logic';
import { isUsableSession, type WorkspaceShellSession } from './workspace-shell.logic';

export type WorkspaceFileActionType = 'create' | 'write' | 'update' | 'delete';
export type WorkspaceFileWriteActionType = 'create' | 'write' | 'update';

const RISKY_BATCH_ACTION_COUNT_THRESHOLD = 3;
const RISKY_CONTENT_SIZE_THRESHOLD = 20_000;

export interface WorkspaceFileWriteAction {
  action: WorkspaceFileWriteActionType;
  path: string;
  content: string;
}

export interface WorkspaceFileDeleteAction {
  action: 'delete';
  path: string;
}

export type WorkspaceFileAction = WorkspaceFileWriteAction | WorkspaceFileDeleteAction;

export type WorkspaceExecutionFileActionResultStatus = 'success' | 'failed' | 'skipped';

export interface WorkspaceExecutionFileActionResult {
  action: WorkspaceFileActionType;
  path: string;
  status: WorkspaceExecutionFileActionResultStatus;
  error: string | null;
}

export type WorkspaceExecutionFileActionApplyStatus =
  | 'pending'
  | 'awaiting-confirmation'
  | 'applied'
  | 'skipped';

export interface WorkspaceExecutionFileActionState {
  executionId: string;
  source: 'stream' | 'status';
  fileActions: WorkspaceFileAction[];
  applyStatus: WorkspaceExecutionFileActionApplyStatus;
  confirmationRequired: boolean;
  skipReason: string | null;
  results: WorkspaceExecutionFileActionResult[];
}

function isRiskyFileActionPath(path: string): boolean {
  const normalizedPath = path.trim().toLowerCase();
  if (!normalizedPath) {
    return false;
  }

  const pathSegments = normalizedPath.split('/');
  const fileName = pathSegments[pathSegments.length - 1] ?? normalizedPath;

  return (
    fileName === '.env' ||
    fileName.startsWith('.env.') ||
    fileName.endsWith('.env') ||
    fileName.includes('.env.') ||
    fileName === 'package.json' ||
    fileName === 'package-lock.json' ||
    fileName === 'yarn.lock' ||
    fileName === 'pnpm-lock.yaml' ||
    fileName === 'docker-compose.yml' ||
    fileName === 'docker-compose.yaml' ||
    fileName.endsWith('.config.js') ||
    fileName.endsWith('.config.ts') ||
    fileName.endsWith('.config.mjs') ||
    fileName.endsWith('.config.cjs')
  );
}

export function isRiskyFileActionBatch(actions: WorkspaceFileAction[]): boolean {
  if (actions.length > RISKY_BATCH_ACTION_COUNT_THRESHOLD) {
    return true;
  }

  return actions.some((action) => {
    if (action.action === 'delete') {
      return true;
    }
    return (
      action.content.length > RISKY_CONTENT_SIZE_THRESHOLD ||
      isRiskyFileActionPath(action.path)
    );
  });
}

export function isWorkspaceFileAction(value: unknown): value is WorkspaceFileAction {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as {
    action?: unknown;
    path?: unknown;
    content?: unknown;
  };
  if (candidate.action === 'delete') {
    return typeof candidate.path === 'string';
  }
  return (
    (candidate.action === 'create' ||
      candidate.action === 'write' ||
      candidate.action === 'update') &&
    typeof candidate.path === 'string' &&
    typeof candidate.content === 'string'
  );
}

function isWorkspaceExecutionFileActionResult(
  value: unknown,
): value is WorkspaceExecutionFileActionResult {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as {
    action?: unknown;
    path?: unknown;
    status?: unknown;
    error?: unknown;
  };
  return (
    (candidate.action === 'create' ||
      candidate.action === 'write' ||
      candidate.action === 'update' ||
      candidate.action === 'delete') &&
    typeof candidate.path === 'string' &&
    (candidate.status === 'success' ||
      candidate.status === 'failed' ||
      candidate.status === 'skipped') &&
    (candidate.error === null || typeof candidate.error === 'string')
  );
}

export function isWorkspaceExecutionFileActionState(
  value: unknown,
): value is WorkspaceExecutionFileActionState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as {
    executionId?: unknown;
    source?: unknown;
    fileActions?: unknown;
    applyStatus?: unknown;
    confirmationRequired?: unknown;
    skipReason?: unknown;
    results?: unknown;
  };
  if (
    typeof candidate.executionId !== 'string' ||
    (candidate.source !== 'stream' && candidate.source !== 'status') ||
    !Array.isArray(candidate.fileActions) ||
    (candidate.applyStatus !== 'pending' &&
      candidate.applyStatus !== 'awaiting-confirmation' &&
      candidate.applyStatus !== 'applied' &&
      candidate.applyStatus !== 'skipped') ||
    (candidate.confirmationRequired !== undefined &&
      typeof candidate.confirmationRequired !== 'boolean') ||
    (candidate.skipReason !== null && typeof candidate.skipReason !== 'string') ||
    !Array.isArray(candidate.results)
  ) {
    return false;
  }
  return (
    candidate.fileActions.every((item) => isWorkspaceFileAction(item)) &&
    candidate.results.every((item) => isWorkspaceExecutionFileActionResult(item))
  );
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
  if (isWorkspaceFileWriteError(value) && value.kind === 'session_expired') {
    return WORKSPACE_FILE_WRITE_SESSION_EXPIRED_CODE;
  }
  if (value instanceof Error && value.message.trim()) {
    return value.message;
  }
  return 'Unknown write failure.';
}

export function resolveWorkspaceFileActionErrorCopy(
  error: string | null,
  sessionExpiredCopy: string,
): string | null {
  if (error === null) {
    return null;
  }
  if (error === WORKSPACE_FILE_WRITE_SESSION_EXPIRED_CODE) {
    return sessionExpiredCopy;
  }
  return error;
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

export interface BuildApplyConfirmationPayload {
  applyStatus: 'applied';
  totalActions: number;
  successCount: number;
}

export function qualifyBuildApplyConfirmation(
  applyResult: ApplySequentialFileActionsResult,
): BuildApplyConfirmationPayload | null {
  if (applyResult.applyStatus !== 'applied') {
    return null;
  }

  const totalActions = applyResult.results.length;
  if (totalActions <= 0) {
    return null;
  }

  const successCount = applyResult.results.filter(
    (result) => result.status === 'success',
  ).length;
  if (
    successCount !== totalActions ||
    applyResult.results.some((result) => result.status !== 'success')
  ) {
    return null;
  }

  return {
    applyStatus: 'applied',
    totalActions,
    successCount,
  };
}

export async function confirmBuildApplyIfQualifying(args: {
  executionId: string;
  applyResult: ApplySequentialFileActionsResult;
  confirmBuildApply: (input: {
    executionId: string;
    payload: BuildApplyConfirmationPayload;
  }) => Promise<void>;
  onConfirmationError?: (error: unknown) => void;
}): Promise<'confirmed' | 'skipped' | 'confirmation-failed'> {
  const payload = qualifyBuildApplyConfirmation(args.applyResult);
  if (!payload || !args.executionId) {
    return 'skipped';
  }

  try {
    await args.confirmBuildApply({
      executionId: args.executionId,
      payload,
    });
    return 'confirmed';
  } catch (error) {
    args.onConfirmationError?.(error);
    return 'confirmation-failed';
  }
}

export function buildConfirmBuildApplyRequestUrl(executionId: string): string {
  return `/api/ai/executions/${encodeURIComponent(executionId)}/confirm-build-apply`;
}

export async function requestBuildApplyConfirmation(input: {
  executionId: string;
  payload: BuildApplyConfirmationPayload;
}): Promise<void> {
  const response = await fetch(buildConfirmBuildApplyRequestUrl(input.executionId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      applyStatus: input.payload.applyStatus,
      totalActions: input.payload.totalActions,
      successCount: input.payload.successCount,
    }),
  });
  if (!response.ok) {
    throw new Error(`Build apply confirmation failed (${response.status})`);
  }
}
