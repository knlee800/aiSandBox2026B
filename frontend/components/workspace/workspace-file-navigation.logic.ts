export type WorkspaceFileSurfaceState = 'loading' | 'ready' | 'empty' | 'error';

export interface WorkspaceFileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
}

export interface WorkspaceFileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children: WorkspaceFileNode[];
}

export interface WorkspaceReadFileResponse {
  path: string;
  content: string;
}

export interface WorkspaceSearchMatch {
  path: string;
  line: number;
  preview: string;
}

export interface WorkspaceSearchResults {
  query: string;
  results: WorkspaceSearchMatch[];
  truncated: boolean;
}

export type WorkspaceFileSaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'save-error';

export type WorkspaceFileWriteFailureKind = 'session_expired' | 'generic_write_failure';
export type WorkspaceSessionTerminationReason = 'idle_timeout' | 'max_lifetime';

export const WORKSPACE_FILE_WRITE_SESSION_EXPIRED_CODE = 'session_expired';

export class WorkspaceFileWriteError extends Error {
  readonly kind: WorkspaceFileWriteFailureKind;
  readonly status: number | null;
  readonly terminationReason: WorkspaceSessionTerminationReason | null;

  constructor(args: {
    kind: WorkspaceFileWriteFailureKind;
    status: number | null;
    terminationReason?: WorkspaceSessionTerminationReason | null;
    message: string;
  }) {
    super(args.message);
    this.name = 'WorkspaceFileWriteError';
    this.kind = args.kind;
    this.status = args.status;
    this.terminationReason = args.terminationReason ?? null;
  }
}

export function isWorkspaceFileWriteError(value: unknown): value is WorkspaceFileWriteError {
  return value instanceof WorkspaceFileWriteError;
}

interface SessionFileRequestArgs {
  token?: string;
  sessionId: string;
  fetchImpl?: typeof fetch;
}

interface WorkspaceFileWriteErrorBody {
  message?: unknown;
  reason?: unknown;
}

async function readWorkspaceFileWriteErrorBody(
  response: Response,
): Promise<WorkspaceFileWriteErrorBody | null> {
  try {
    return (await response.json()) as WorkspaceFileWriteErrorBody;
  } catch {
    return null;
  }
}

function collectWorkspaceFileWriteErrorText(body: WorkspaceFileWriteErrorBody | null): string {
  if (!body) {
    return '';
  }

  const parts: string[] = [];
  if (typeof body.message === 'string') {
    parts.push(body.message);
  } else if (Array.isArray(body.message)) {
    for (const item of body.message) {
      if (typeof item === 'string') {
        parts.push(item);
      }
    }
  }
  if (typeof body.reason === 'string') {
    parts.push(body.reason);
  }
  return parts.join(' ');
}

function parseWorkspaceSessionTerminationReason(
  body: WorkspaceFileWriteErrorBody | null,
): WorkspaceSessionTerminationReason | null {
  const text = collectWorkspaceFileWriteErrorText(body);
  if (text.includes('idle_timeout')) {
    return 'idle_timeout';
  }
  if (text.includes('max_lifetime')) {
    return 'max_lifetime';
  }
  return null;
}

function toGenericWorkspaceFileWriteError(status: number | null, message: string): WorkspaceFileWriteError {
  return new WorkspaceFileWriteError({
    kind: 'generic_write_failure',
    status,
    terminationReason: null,
    message,
  });
}

function normalizeWorkspaceTreePath(path: string): string {
  return path.trim().replace(/^\/+/, '');
}

function isInternalGitTreeEntry(entry: Pick<WorkspaceFileEntry, 'name' | 'path'>): boolean {
  const normalizedPath = normalizeWorkspaceTreePath(entry.path);
  return entry.name === '.git' || normalizedPath === '.git' || normalizedPath.startsWith('.git/');
}

export async function listWorkspaceDirectory(
  args: SessionFileRequestArgs & { directoryPath?: string },
): Promise<WorkspaceFileEntry[]> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const directoryPath = args.directoryPath ?? '/';
  const query = new URLSearchParams({ path: directoryPath });
  const response = await fetchImpl(
    `/api/sessions/${encodeURIComponent(args.sessionId)}/files/list?${query.toString()}`,
    {
      method: 'GET',
    },
  );

  if (!response.ok) {
    throw new Error(`File list failed (${response.status})`);
  }

  return (await response.json()) as WorkspaceFileEntry[];
}

export async function readWorkspaceFile(
  args: SessionFileRequestArgs & { filePath: string },
): Promise<WorkspaceReadFileResponse> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const response = await fetchImpl(`/api/sessions/${encodeURIComponent(args.sessionId)}/files/read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: args.filePath }),
  });

  if (!response.ok) {
    throw new Error(`File read failed (${response.status})`);
  }

  return (await response.json()) as WorkspaceReadFileResponse;
}

export async function writeWorkspaceFile(
  args: SessionFileRequestArgs & { filePath: string; content: string },
): Promise<void> {
  const fetchImpl = args.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`/api/sessions/${encodeURIComponent(args.sessionId)}/files/write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: args.filePath,
        content: args.content,
      }),
    });
  } catch (error) {
    throw toGenericWorkspaceFileWriteError(
      null,
      error instanceof Error && error.message.trim() ? error.message : 'File write failed',
    );
  }

  if (!response.ok) {
    const errorBody = await readWorkspaceFileWriteErrorBody(response);
    if (response.status === 410) {
      throw new WorkspaceFileWriteError({
        kind: 'session_expired',
        status: 410,
        terminationReason: parseWorkspaceSessionTerminationReason(errorBody),
        message: WORKSPACE_FILE_WRITE_SESSION_EXPIRED_CODE,
      });
    }
    throw toGenericWorkspaceFileWriteError(response.status, `File write failed (${response.status})`);
  }
}

export async function deleteWorkspaceFile(
  args: SessionFileRequestArgs & { filePath: string },
): Promise<void> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const response = await fetchImpl(`/api/sessions/${encodeURIComponent(args.sessionId)}/files/delete`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: args.filePath,
    }),
  });

  if (!response.ok) {
    let backendMessage: string | null = null;
    try {
      const errorBody = (await response.json()) as { message?: unknown };
      if (typeof errorBody.message === 'string' && errorBody.message.trim().length > 0) {
        backendMessage = errorBody.message.trim();
      }
    } catch {
      backendMessage = null;
    }
    if (backendMessage) {
      throw new Error(backendMessage);
    }
    throw new Error(`File delete failed (${response.status})`);
  }
}

export async function searchWorkspaceFiles(
  args: SessionFileRequestArgs & { query: string },
): Promise<WorkspaceSearchResults> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const response = await fetchImpl(`/api/sessions/${encodeURIComponent(args.sessionId)}/files/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: args.query,
    }),
  });

  if (!response.ok) {
    throw new Error(`File search failed (${response.status})`);
  }

  return (await response.json()) as WorkspaceSearchResults;
}

export async function loadWorkspaceFileTree(
  args: SessionFileRequestArgs,
): Promise<WorkspaceFileNode[]> {
  const buildTreeForPath = async (directoryPath: string): Promise<WorkspaceFileNode[]> => {
    const entries = await listWorkspaceDirectory({
      sessionId: args.sessionId,
      directoryPath,
      fetchImpl: args.fetchImpl,
    });

    const sortedEntries = entries.filter((entry) => !isInternalGitTreeEntry(entry)).sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'directory' ? -1 : 1;
      }
      return left.path.localeCompare(right.path);
    });

    const nodes = await Promise.all(
      sortedEntries.map(async (entry) => {
        if (entry.type === 'file') {
          return {
            name: entry.name,
            path: entry.path,
            type: 'file' as const,
            children: [],
          };
        }

        const children = await buildTreeForPath(entry.path);
        return {
          name: entry.name,
          path: entry.path,
          type: 'directory' as const,
          children,
        };
      }),
    );

    return nodes;
  };

  return buildTreeForPath('/');
}

export function findFirstFilePath(nodes: WorkspaceFileNode[]): string | null {
  for (const node of nodes) {
    if (node.type === 'file') {
      return node.path;
    }
    const nestedMatch = findFirstFilePath(node.children);
    if (nestedMatch) {
      return nestedMatch;
    }
  }
  return null;
}
