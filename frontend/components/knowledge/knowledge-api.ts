export interface KnowledgeScopeItem {
  id: string;
  type: 'shared' | 'specialist';
}

export interface KnowledgeDocumentItem {
  id: string;
  scopeId: string;
  title: string;
  byteSize: number;
  updatedAt: string;
}

export const KNOWLEDGE_SERVER_ERROR_KEYS: Record<string, string> = {
  UNKNOWN_SCOPE: 'errorUnknownScope',
  TITLE_REQUIRED: 'errorTitleRequired',
  TITLE_TOO_LONG: 'errorTitleTooLong',
  CONTENT_REQUIRED: 'errorContentRequired',
  CONTENT_NOT_UTF8: 'errorContentNotUtf8',
  DOCUMENT_TOO_LARGE: 'errorDocumentTooLarge',
  TOO_MANY_DOCUMENTS: 'errorTooManyDocuments',
  ACCOUNT_TOO_LARGE: 'errorAccountTooLarge',
  WRONG_FILE_TYPE: 'errorWrongFileType',
  NOT_FOUND: 'errorNotFound',
};

export function knowledgeServerErrorKey(code: string | null): string {
  if (code && KNOWLEDGE_SERVER_ERROR_KEYS[code]) {
    return KNOWLEDGE_SERVER_ERROR_KEYS[code];
  }
  return 'saveError';
}

export function knowledgeDeleteErrorKey(code: string | null): string {
  if (code === 'NOT_FOUND') {
    return 'errorNotFound';
  }
  return 'deleteError';
}

function readCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const csrfCookie = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('aisandbox_csrf='));
  return csrfCookie ? csrfCookie.slice('aisandbox_csrf='.length) : null;
}

export async function knowledgeFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const csrfToken = readCsrfToken();
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
    if (typeof init.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }
  return fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  });
}

export async function readKnowledgeErrorCode(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as { code?: unknown };
    return typeof payload.code === 'string' ? payload.code : null;
  } catch {
    return null;
  }
}

export function parseKnowledgeScopes(payload: unknown): KnowledgeScopeItem[] | null {
  if (!payload || typeof payload !== 'object' || !('scopes' in payload)) {
    return null;
  }
  const scopes = (payload as { scopes?: unknown }).scopes;
  if (!Array.isArray(scopes)) {
    return null;
  }
  const parsed: KnowledgeScopeItem[] = [];
  for (const entry of scopes) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const id = (entry as { id?: unknown }).id;
    const type = (entry as { type?: unknown }).type;
    if (typeof id !== 'string' || (type !== 'shared' && type !== 'specialist')) {
      return null;
    }
    parsed.push({ id, type });
  }
  return parsed;
}

export function parseKnowledgeDocuments(payload: unknown): KnowledgeDocumentItem[] | null {
  if (!payload || typeof payload !== 'object' || !('documents' in payload)) {
    return null;
  }
  const documents = (payload as { documents?: unknown }).documents;
  if (!Array.isArray(documents)) {
    return null;
  }
  const parsed: KnowledgeDocumentItem[] = [];
  for (const entry of documents) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const row = entry as {
      id?: unknown;
      scopeId?: unknown;
      title?: unknown;
      byteSize?: unknown;
      updatedAt?: unknown;
    };
    if (
      typeof row.id !== 'string' ||
      typeof row.scopeId !== 'string' ||
      typeof row.title !== 'string' ||
      typeof row.byteSize !== 'number' ||
      !Number.isFinite(row.byteSize) ||
      typeof row.updatedAt !== 'string'
    ) {
      return null;
    }
    parsed.push({
      id: row.id,
      scopeId: row.scopeId,
      title: row.title,
      byteSize: row.byteSize,
      updatedAt: row.updatedAt,
    });
  }
  return parsed;
}
