import { shouldAllowAutosaveNow } from './autosave-rate-limit';
import {
  buildProjectScopedSnapshotLabel,
  saveWorkspaceSnapshot,
  type ProjectScopedSnapshotSource,
  type WorkspaceSnapshotSummary,
} from '../components/workspace/workspace-snapshots.logic';

export type ProjectAutosaveResult =
  | { status: 'saved'; savedSnapshot: WorkspaceSnapshotSummary }
  | { status: 'skipped-rate-limited' }
  | { status: 'failed' };

export async function attemptProjectAutosave(args: {
  token?: string;
  sessionId: string;
  projectId: string;
  source?: ProjectScopedSnapshotSource;
  hint?: string;
  now: number;
  lastAutosaveAt: number | null;
  minIntervalMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<ProjectAutosaveResult> {
  if (
    !shouldAllowAutosaveNow({
      now: args.now,
      lastSnapshotAt: args.lastAutosaveAt,
      minIntervalMs: args.minIntervalMs,
    })
  ) {
    return { status: 'skipped-rate-limited' };
  }

  try {
    const savedSnapshot = await saveWorkspaceSnapshot({
      sessionId: args.sessionId,
      label: buildProjectScopedSnapshotLabel(args.projectId, args.source, args.hint),
      fetchImpl: args.fetchImpl,
    });
    return { status: 'saved', savedSnapshot };
  } catch (error) {
    console.error('Failed to autosave project snapshot:', error);
    return { status: 'failed' };
  }
}

export type TrailingAutosaveScheduler = {
  schedule: (delayMs: number, run: () => void | Promise<void>) => void;
  cancel: () => void;
  isPending: () => boolean;
};

export function createTrailingAutosaveScheduler(args?: {
  setTimeoutImpl?: (callback: () => void, delayMs: number) => unknown;
  clearTimeoutImpl?: (handle: unknown) => void;
}): TrailingAutosaveScheduler {
  const setTimeoutImpl =
    args?.setTimeoutImpl ??
    ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs));
  const clearTimeoutImpl =
    args?.clearTimeoutImpl ??
    ((handle: unknown) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });

  let generation = 0;
  let pendingHandle: unknown = null;

  return {
    schedule(delayMs, run) {
      generation += 1;
      const scheduledGeneration = generation;
      if (pendingHandle !== null) {
        const handleToClear = pendingHandle;
        pendingHandle = null;
        clearTimeoutImpl(handleToClear);
      }

      let hasStarted = false;
      const handle = setTimeoutImpl(() => {
        if (hasStarted || scheduledGeneration !== generation) {
          return;
        }
        hasStarted = true;
        pendingHandle = null;
        void run();
      }, delayMs);

      if (scheduledGeneration === generation && !hasStarted) {
        pendingHandle = handle;
      }
    },
    cancel() {
      generation += 1;
      if (pendingHandle !== null) {
        const handleToClear = pendingHandle;
        pendingHandle = null;
        clearTimeoutImpl(handleToClear);
      }
    },
    isPending() {
      return pendingHandle !== null;
    },
  };
}
