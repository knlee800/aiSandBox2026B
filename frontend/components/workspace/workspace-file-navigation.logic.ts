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

export type WorkspaceFileSaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'save-error';

interface SessionFileRequestArgs {
  token: string;
  sessionId: string;
  fetchImpl?: typeof fetch;
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
      headers: {
        Authorization: `Bearer ${args.token}`,
      },
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
      Authorization: `Bearer ${args.token}`,
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
  const response = await fetchImpl(`/api/sessions/${encodeURIComponent(args.sessionId)}/files/write`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: args.filePath,
      content: args.content,
    }),
  });

  if (!response.ok) {
    throw new Error(`File write failed (${response.status})`);
  }
}

export async function deleteWorkspaceFile(
  args: SessionFileRequestArgs & { filePath: string },
): Promise<void> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const response = await fetchImpl(`/api/sessions/${encodeURIComponent(args.sessionId)}/files/delete`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${args.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: args.filePath,
    }),
  });

  if (!response.ok) {
    throw new Error(`File delete failed (${response.status})`);
  }
}

export async function loadWorkspaceFileTree(
  args: SessionFileRequestArgs,
): Promise<WorkspaceFileNode[]> {
  const buildTreeForPath = async (directoryPath: string): Promise<WorkspaceFileNode[]> => {
    const entries = await listWorkspaceDirectory({
      token: args.token,
      sessionId: args.sessionId,
      directoryPath,
      fetchImpl: args.fetchImpl,
    });

    const sortedEntries = [...entries].sort((left, right) => {
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
