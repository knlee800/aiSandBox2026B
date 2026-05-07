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

interface SessionFileRequestArgs {
  token?: string;
  sessionId: string;
  fetchImpl?: typeof fetch;
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
  const response = await fetchImpl(`/api/sessions/${encodeURIComponent(args.sessionId)}/files/write`, {
    method: 'POST',
    headers: {
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
