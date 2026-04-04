export interface WorkspaceProjectSummary {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface LoadProjectsArgs {
  token: string;
  fetchImpl?: typeof fetch;
}

interface CreateProjectArgs {
  token: string;
  name: string;
  fetchImpl?: typeof fetch;
}

interface OpenProjectArgs {
  token: string;
  projectId: string;
  sessionId: string;
  snapshotId?: string;
  fetchImpl?: typeof fetch;
}

function trimMessage(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  return fallback;
}

export async function loadWorkspaceProjects(
  args: LoadProjectsArgs,
): Promise<WorkspaceProjectSummary[]> {
  const response = await (args.fetchImpl ?? fetch)('/api/projects', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${args.token}`,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(trimMessage(payload?.message, 'Failed to load projects.'));
  }

  const projects = (await response.json()) as WorkspaceProjectSummary[];
  return Array.isArray(projects) ? projects : [];
}

export async function createWorkspaceProject(
  args: CreateProjectArgs,
): Promise<WorkspaceProjectSummary> {
  const response = await (args.fetchImpl ?? fetch)('/api/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: args.name.trim() }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(trimMessage(payload?.message, 'Failed to create project.'));
  }

  return (await response.json()) as WorkspaceProjectSummary;
}

export async function openWorkspaceProject(
  args: OpenProjectArgs,
): Promise<{ projectId: string; sessionId: string; restoredSnapshotId: string | null }> {
  const response = await (args.fetchImpl ?? fetch)(`/api/projects/${args.projectId}/open`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: args.sessionId,
      snapshotId: args.snapshotId?.trim() ? args.snapshotId.trim() : undefined,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(trimMessage(payload?.message, 'Failed to open project.'));
  }

  return (await response.json()) as {
    projectId: string;
    sessionId: string;
    restoredSnapshotId: string | null;
  };
}
