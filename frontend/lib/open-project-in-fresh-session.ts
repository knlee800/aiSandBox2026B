import {
  associateWorkspaceProjectSession,
  openWorkspaceProject,
} from '../components/workspace/workspace-projects.logic';
import {
  loadWorkspaceSnapshots,
  resolveProjectScopedLatestSnapshotId,
} from '../components/workspace/workspace-snapshots.logic';

export interface OpenProjectInFreshSessionArgs {
  token: string;
  projectId: string;
  snapshotId?: string;
  fetchImpl?: typeof fetch;
}

export interface OpenProjectInFreshSessionResult {
  projectId: string;
  sessionId: string;
  restoredSnapshotId: string | null;
}

interface CreatedWorkspaceSession {
  id: string;
}

function trimMessage(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  return fallback;
}

async function createWorkspaceSession(args: {
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<CreatedWorkspaceSession> {
  const response = await (args.fetchImpl ?? fetch)('/api/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Session creation blocked by quota limits (403).');
    }
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(trimMessage(payload?.message, `Session create failed (${response.status})`));
  }

  return (await response.json()) as CreatedWorkspaceSession;
}

export async function openProjectInFreshSession(
  args: OpenProjectInFreshSessionArgs,
): Promise<OpenProjectInFreshSessionResult> {
  const projectId = args.projectId.trim();
  if (!projectId) {
    throw new Error('Project id is required to open a project in a fresh session.');
  }

  let snapshotIdToOpen = args.snapshotId?.trim() || undefined;
  if (!snapshotIdToOpen) {
    const freshSnapshots = await loadWorkspaceSnapshots({
      token: args.token,
      fetchImpl: args.fetchImpl,
    });
    snapshotIdToOpen =
      resolveProjectScopedLatestSnapshotId({
        snapshots: freshSnapshots,
        projectId,
      }) ?? undefined;
  }

  const createdSession = await createWorkspaceSession({
    token: args.token,
    fetchImpl: args.fetchImpl,
  });

  if (snapshotIdToOpen) {
    return await openWorkspaceProject({
      token: args.token,
      projectId,
      sessionId: createdSession.id,
      snapshotId: snapshotIdToOpen,
      fetchImpl: args.fetchImpl,
    });
  }

  await associateWorkspaceProjectSession({
    token: args.token,
    projectId,
    sessionId: createdSession.id,
    fetchImpl: args.fetchImpl,
  });

  return {
    projectId,
    sessionId: createdSession.id,
    restoredSnapshotId: null,
  };
}
