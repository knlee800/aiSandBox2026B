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
const PROJECT_SCOPED_SNAPSHOT_NAME_SEPARATOR = ':name:';
const PROJECT_SCOPED_SNAPSHOT_SOURCE_SEPARATOR = ':source:';
const PROJECT_SCOPED_SNAPSHOT_HINT_SEPARATOR = ':hint:';
const PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX = ']';
const PROJECT_SCOPED_SNAPSHOT_HINT_MAX_LENGTH = 40;

export type ProjectScopedSnapshotSource =
  | 'ai'
  | 'file-save'
  | 'preview'
  | 'expiry'
  | 'initial';

function trimMessage(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  return fallback;
}

function normalizeProjectScopedSnapshotSource(
  source: string | null | undefined,
): ProjectScopedSnapshotSource | null {
  switch (source?.trim()) {
    case 'ai':
      return 'ai';
    case 'file-save':
      return 'file-save';
    case 'preview':
      return 'preview';
    case 'expiry':
      return 'expiry';
    case 'initial':
      return 'initial';
    default:
      return null;
  }
}

function normalizeProjectScopedSnapshotHint(hint: string | null | undefined): string | null {
  if (typeof hint !== 'string') {
    return null;
  }

  const normalizedHint = hint
    .trim()
    .replace(/\]/g, ' ')
    .split(PROJECT_SCOPED_SNAPSHOT_NAME_SEPARATOR)
    .join(' ')
    .split(PROJECT_SCOPED_SNAPSHOT_SOURCE_SEPARATOR)
    .join(' ')
    .split(PROJECT_SCOPED_SNAPSHOT_HINT_SEPARATOR)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PROJECT_SCOPED_SNAPSHOT_HINT_MAX_LENGTH)
    .trim();

  return normalizedHint ? normalizedHint : null;
}

export function buildProjectScopedSnapshotLabel(
  projectId: string,
  source?: ProjectScopedSnapshotSource,
  hint?: string,
): string {
  const normalizedProjectId = projectId.trim();
  const normalizedSource = normalizeProjectScopedSnapshotSource(source);
  if (!normalizedSource) {
    return `${PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX}${normalizedProjectId}${PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX}`;
  }

  const normalizedHint = normalizeProjectScopedSnapshotHint(hint);
  if (!normalizedHint) {
    return `${PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX}${normalizedProjectId}${PROJECT_SCOPED_SNAPSHOT_SOURCE_SEPARATOR}${normalizedSource}${PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX}`;
  }

  return `${PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX}${normalizedProjectId}${PROJECT_SCOPED_SNAPSHOT_SOURCE_SEPARATOR}${normalizedSource}${PROJECT_SCOPED_SNAPSHOT_HINT_SEPARATOR}${normalizedHint}${PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX}`;
}

function normalizeProjectScopedSnapshotName(name: string): string | null {
  const normalizedName = name.trim();
  return normalizedName ? normalizedName : null;
}

function parseProjectScopedSnapshotLabelParts(label: string | null): {
  projectId: string;
  name: string | null;
  source: ProjectScopedSnapshotSource | null;
  hint: string | null;
} | null {
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

  const rawBody = trimmed.slice(
    PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX.length,
    trimmed.length - PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX.length,
  );
  const nameSeparatorIndex = rawBody.indexOf(PROJECT_SCOPED_SNAPSHOT_NAME_SEPARATOR);
  const sourceSeparatorIndex = rawBody.indexOf(PROJECT_SCOPED_SNAPSHOT_SOURCE_SEPARATOR);
  const firstSeparatorIndex =
    nameSeparatorIndex >= 0
      ? nameSeparatorIndex
      : sourceSeparatorIndex >= 0
        ? sourceSeparatorIndex
        : -1;
  const rawProjectId =
    firstSeparatorIndex >= 0 ? rawBody.slice(0, firstSeparatorIndex) : rawBody;
  const projectId = rawProjectId.trim();
  if (!projectId) {
    return null;
  }

  const rawName =
    nameSeparatorIndex >= 0
      ? rawBody.slice(
          nameSeparatorIndex + PROJECT_SCOPED_SNAPSHOT_NAME_SEPARATOR.length,
        )
      : null;
  const rawSource =
    nameSeparatorIndex >= 0 || sourceSeparatorIndex < 0
      ? null
      : rawBody.slice(
          sourceSeparatorIndex + PROJECT_SCOPED_SNAPSHOT_SOURCE_SEPARATOR.length,
        );
  const hintSeparatorIndex =
    rawSource === null ? -1 : rawSource.indexOf(PROJECT_SCOPED_SNAPSHOT_HINT_SEPARATOR);
  const rawHint =
    rawSource === null || hintSeparatorIndex < 0
      ? null
      : rawSource.slice(hintSeparatorIndex + PROJECT_SCOPED_SNAPSHOT_HINT_SEPARATOR.length);

  return {
    projectId,
    name: rawName === null ? null : normalizeProjectScopedSnapshotName(rawName),
    source:
      rawSource === null
        ? null
        : normalizeProjectScopedSnapshotSource(
            hintSeparatorIndex >= 0 ? rawSource.slice(0, hintSeparatorIndex) : rawSource,
          ),
    hint: rawHint === null ? null : normalizeProjectScopedSnapshotHint(rawHint),
  };
}

export function buildProjectScopedSnapshotLabelWithName(
  projectId: string,
  name: string,
): string {
  const normalizedName = normalizeProjectScopedSnapshotName(name);
  if (!normalizedName) {
    return buildProjectScopedSnapshotLabel(projectId);
  }

  return `${PROJECT_SCOPED_SNAPSHOT_LABEL_PREFIX}${projectId.trim()}${PROJECT_SCOPED_SNAPSHOT_NAME_SEPARATOR}${normalizedName}${PROJECT_SCOPED_SNAPSHOT_LABEL_SUFFIX}`;
}

function parseProjectIdFromSnapshotLabel(label: string | null): string | null {
  return parseProjectScopedSnapshotLabelParts(label)?.projectId ?? null;
}

export function parseProjectScopedSnapshotName(label: string | null): string | null {
  return parseProjectScopedSnapshotLabelParts(label)?.name ?? null;
}

export function parseProjectScopedSnapshotSource(
  label: string | null,
): ProjectScopedSnapshotSource | null {
  return parseProjectScopedSnapshotLabelParts(label)?.source ?? null;
}

export function parseProjectScopedSnapshotHint(label: string | null): string | null {
  return parseProjectScopedSnapshotLabelParts(label)?.hint ?? null;
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
