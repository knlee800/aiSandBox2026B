import { shouldAllowAutosaveNow } from './autosave-rate-limit';
import {
  buildProjectScopedSnapshotLabel,
  saveWorkspaceSnapshot,
  type WorkspaceSnapshotSummary,
} from '../components/workspace/workspace-snapshots.logic';

export type ProjectAutosaveResult =
  | { status: 'saved'; savedSnapshot: WorkspaceSnapshotSummary }
  | { status: 'skipped-rate-limited' }
  | { status: 'failed' };

export async function attemptProjectAutosave(args: {
  token: string;
  sessionId: string;
  projectId: string;
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
      token: args.token,
      sessionId: args.sessionId,
      label: buildProjectScopedSnapshotLabel(args.projectId),
      fetchImpl: args.fetchImpl,
    });
    return { status: 'saved', savedSnapshot };
  } catch (error) {
    console.error('Failed to autosave project snapshot:', error);
    return { status: 'failed' };
  }
}
