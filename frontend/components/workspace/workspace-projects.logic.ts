export interface WorkspaceProjectSummary {
  id: string;
  userId: string;
  name: string;
  visibility?: 'private' | 'public';
  createdAt: string;
  updatedAt: string;
}

export interface WorkspacePublicProjectSummary {
  id: string;
  name: string;
  visibility: 'public';
  createdAt: string;
  updatedAt: string;
}

export interface WorkspacePublicProjectDetail extends WorkspacePublicProjectSummary {
  readOnly: true;
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

interface AssociateProjectSessionArgs {
  token: string;
  projectId: string;
  sessionId: string;
  fetchImpl?: typeof fetch;
}

interface UpdateProjectVisibilityArgs {
  token: string;
  projectId: string;
  visibility: 'private' | 'public';
  fetchImpl?: typeof fetch;
}

interface ForkPublicProjectArgs {
  token: string;
  projectId: string;
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

export async function updateWorkspaceProjectVisibility(
  args: UpdateProjectVisibilityArgs,
): Promise<WorkspaceProjectSummary> {
  const response = await (args.fetchImpl ?? fetch)(`/api/projects/${args.projectId}/visibility`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${args.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ visibility: args.visibility }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(trimMessage(payload?.message, 'Failed to update project visibility.'));
  }

  return (await response.json()) as WorkspaceProjectSummary;
}

export async function loadPublicWorkspaceProjects(
  fetchImpl: typeof fetch = fetch,
): Promise<WorkspacePublicProjectSummary[]> {
  const response = await fetchImpl('/api/projects/public', {
    method: 'GET',
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(trimMessage(payload?.message, 'Failed to load public projects.'));
  }
  const projects = (await response.json()) as WorkspacePublicProjectSummary[];
  return Array.isArray(projects) ? projects : [];
}

export async function loadPublicWorkspaceProjectDetail(args: {
  projectId: string;
  fetchImpl?: typeof fetch;
}): Promise<WorkspacePublicProjectDetail> {
  const response = await (args.fetchImpl ?? fetch)(`/api/projects/public/${args.projectId}`, {
    method: 'GET',
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(trimMessage(payload?.message, 'Failed to load public project detail.'));
  }
  return (await response.json()) as WorkspacePublicProjectDetail;
}

export async function forkPublicWorkspaceProject(
  args: ForkPublicProjectArgs,
): Promise<WorkspaceProjectSummary> {
  const response = await (args.fetchImpl ?? fetch)(`/api/projects/public/${args.projectId}/fork`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.token}`,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(trimMessage(payload?.message, 'Failed to fork public project.'));
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

export async function associateWorkspaceProjectSession(
  args: AssociateProjectSessionArgs,
): Promise<WorkspaceProjectSummary> {
  const response = await (args.fetchImpl ?? fetch)(
    `/api/projects/${args.projectId}/sessions/${args.sessionId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.token}`,
      },
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(trimMessage(payload?.message, 'Failed to associate project with session.'));
  }

  return (await response.json()) as WorkspaceProjectSummary;
}
