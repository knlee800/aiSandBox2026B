import type { WorkspaceExecState } from './workspace-exec.logic';

interface RefreshPostExecSurfacesInput {
  execState: WorkspaceExecState;
  refreshCheckpoints: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  refreshDashboard: () => Promise<void>;
}

export async function refreshPostExecSurfaces(
  input: RefreshPostExecSurfacesInput,
): Promise<boolean> {
  if (input.execState.status !== 'result') {
    return false;
  }

  await Promise.all([
    input.refreshCheckpoints(),
    input.refreshSessions(),
    input.refreshDashboard(),
  ]);

  return true;
}
