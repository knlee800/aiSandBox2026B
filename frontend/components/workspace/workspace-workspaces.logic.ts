export interface Workspace {
  id: string;
  userId: string;
  name: string;
  slug: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoadWorkspacesArgs {
  token?: string;
  fetchImpl?: typeof fetch;
}

export interface LoadWorkspaceArgs {
  token?: string;
  workspaceId: string;
  fetchImpl?: typeof fetch;
}

export interface CreateWorkspaceArgs {
  token?: string;
  name: string;
  fetchImpl?: typeof fetch;
}

export interface UpdateWorkspaceArgs {
  token?: string;
  workspaceId: string;
  name: string;
  fetchImpl?: typeof fetch;
}

export interface DeleteWorkspaceArgs {
  token?: string;
  workspaceId: string;
  fetchImpl?: typeof fetch;
}

function trimMessage(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  return fallback;
}

export async function loadWorkspaces(args: LoadWorkspacesArgs): Promise<Workspace[]> {
  const response = await (args.fetchImpl ?? fetch)('/api/workspaces', {
    method: 'GET',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(trimMessage(payload?.message, 'Failed to load workspaces.'));
  }

  const workspaces = (await response.json()) as Workspace[];
  return Array.isArray(workspaces) ? workspaces : [];
}

export async function loadWorkspace(args: LoadWorkspaceArgs): Promise<Workspace> {
  const response = await (args.fetchImpl ?? fetch)(`/api/workspaces/${args.workspaceId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(trimMessage(payload?.message, 'Failed to load workspace.'));
  }

  return (await response.json()) as Workspace;
}

export async function createWorkspace(args: CreateWorkspaceArgs): Promise<Workspace> {
  const response = await (args.fetchImpl ?? fetch)('/api/workspaces', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: args.name.trim() }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(trimMessage(payload?.message, 'Failed to create workspace.'));
  }

  return (await response.json()) as Workspace;
}

export async function updateWorkspace(args: UpdateWorkspaceArgs): Promise<Workspace> {
  const response = await (args.fetchImpl ?? fetch)(`/api/workspaces/${args.workspaceId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: args.name.trim() }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(trimMessage(payload?.message, 'Failed to update workspace.'));
  }

  return (await response.json()) as Workspace;
}

export async function deleteWorkspace(args: DeleteWorkspaceArgs): Promise<{ deleted: true }> {
  const response = await (args.fetchImpl ?? fetch)(`/api/workspaces/${args.workspaceId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(trimMessage(payload?.message, 'Failed to delete workspace.'));
  }

  return (await response.json()) as { deleted: true };
}
