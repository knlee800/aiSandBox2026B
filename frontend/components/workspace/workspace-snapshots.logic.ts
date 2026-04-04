export interface WorkspaceSnapshotSummary {
  id: string;
  userId: string;
  label: string | null;
  createdAt: string;
  fileCount: number;
}

interface SaveSnapshotArgs {
  token: string;
  sessionId: string;
  label?: string;
  fetchImpl?: typeof fetch;
}

interface RestoreSnapshotArgs {
  token: string;
  sessionId: string;
  snapshotId: string;
  fetchImpl?: typeof fetch;
}

interface LoadSnapshotsArgs {
  token: string;
  fetchImpl?: typeof fetch;
}

function trimMessage(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  return fallback;
}

export async function saveWorkspaceSnapshot(
  args: SaveSnapshotArgs,
): Promise<WorkspaceSnapshotSummary> {
  const response = await (args.fetchImpl ?? fetch)(
    `/api/sessions/${args.sessionId}/snapshot`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        label: args.label?.trim() ? args.label.trim() : undefined,
      }),
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(
      trimMessage(payload?.message, 'Failed to save workspace snapshot.'),
    );
  }

  return (await response.json()) as WorkspaceSnapshotSummary;
}

export async function loadWorkspaceSnapshots(
  args: LoadSnapshotsArgs,
): Promise<WorkspaceSnapshotSummary[]> {
  const response = await (args.fetchImpl ?? fetch)('/api/users/me/snapshots', {
    headers: {
      Authorization: `Bearer ${args.token}`,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(
      trimMessage(payload?.message, 'Failed to load workspace snapshots.'),
    );
  }

  const snapshots = (await response.json()) as WorkspaceSnapshotSummary[];
  return Array.isArray(snapshots) ? snapshots : [];
}

export async function restoreWorkspaceSnapshot(
  args: RestoreSnapshotArgs,
): Promise<void> {
  const response = await (args.fetchImpl ?? fetch)(
    `/api/sessions/${args.sessionId}/restore`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snapshotId: args.snapshotId,
      }),
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(
      trimMessage(payload?.message, 'Failed to restore workspace snapshot.'),
    );
  }
}
