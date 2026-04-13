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

interface ExportWorkspaceArchiveArgs {
  token: string;
  sessionId: string;
  fetchImpl?: typeof fetch;
}

interface ImportWorkspaceArchiveArgs {
  token: string;
  sessionId: string;
  archiveFile: File;
  fetchImpl?: typeof fetch;
}

const PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX = '[project-id:';
const PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX = ']';

function trimMessage(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  return fallback;
}

export function buildProjectScopedSnapshotLabel(projectId: string): string {
  return `${PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX}${projectId.trim()}${PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX}`;
}

function parseProjectIdFromSnapshotLabel(label: string | null): string | null {
  if (!label) {
    return null;
  }
  const trimmed = label.trim();
  if (
    !trimmed.startsWith(PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX) ||
    !trimmed.endsWith(PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX)
  ) {
    return null;
  }
  const rawProjectId = trimmed.slice(
    PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX.length,
    trimmed.length - PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX.length,
  );
  return rawProjectId.trim() ? rawProjectId.trim() : null;
}

export function resolveProjectScopedLatestSnapshotId(args: {
  snapshots: WorkspaceSnapshotSummary[];
  projectId: string;
}): string | null {
  const normalizedProjectId = args.projectId.trim();
  if (!normalizedProjectId) {
    return null;
  }
  const matchedSnapshot = args.snapshots.find(
    (snapshot) => parseProjectIdFromSnapshotLabel(snapshot.label) === normalizedProjectId,
  );
  return matchedSnapshot?.id ?? null;
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

export async function exportWorkspaceArchive(
  args: ExportWorkspaceArchiveArgs,
): Promise<Blob> {
  const response = await (args.fetchImpl ?? fetch)(
    `/api/sessions/${args.sessionId}/export`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${args.token}`,
      },
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(
      trimMessage(payload?.message, 'Failed to export workspace archive.'),
    );
  }

  return await response.blob();
}

export async function importWorkspaceArchive(
  args: ImportWorkspaceArchiveArgs,
): Promise<{ importedFileCount: number }> {
  const formData = new FormData();
  formData.append('archive', args.archiveFile);
  const response = await (args.fetchImpl ?? fetch)(
    `/api/sessions/${args.sessionId}/import`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.token}`,
      },
      body: formData,
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(
      trimMessage(payload?.message, 'Failed to import workspace archive.'),
    );
  }

  return (await response.json()) as { importedFileCount: number };
}
