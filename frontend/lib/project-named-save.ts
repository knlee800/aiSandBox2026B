import {
  buildProjectScopedSnapshotLabelWithName,
  saveWorkspaceSnapshot,
  type WorkspaceSnapshotSummary,
} from '../components/workspace/workspace-snapshots.logic';

export type NamedProjectSaveResult =
  | { status: 'saved'; savedSnapshot: WorkspaceSnapshotSummary }
  | { status: 'failed' };

export async function attemptNamedProjectSave(args: {
  token?: string;
  sessionId: string;
  projectId: string;
  name: string;
  fetchImpl?: typeof fetch;
}): Promise<NamedProjectSaveResult> {
  try {
    const savedSnapshot = await saveWorkspaceSnapshot({
      sessionId: args.sessionId,
      label: buildProjectScopedSnapshotLabelWithName(args.projectId, args.name),
      fetchImpl: args.fetchImpl,
    });
    return { status: 'saved', savedSnapshot };
  } catch (error) {
    console.error('Failed to save named project snapshot:', error);
    return { status: 'failed' };
  }
}
