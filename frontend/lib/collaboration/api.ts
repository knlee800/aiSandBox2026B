import {
  collaborationRefusal,
  readErrorMessage,
  type CollaborationRefusal,
} from './logic';

export interface CollaborationRunListItem {
  collaborationRunId: string;
  projectId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollaborationHandoff {
  referralId: string;
  status: string;
  source: string;
  target: string;
  prompt: string | null;
  answer: string | null;
  handoffNote: string | null;
  failureReason: string | null;
  decidedBy: string | null;
  rejectReason: string | null;
  canChangeFiles?: boolean;
  changedPaths?: string[];
  savePoint?: string | null;
  tests?: Array<{ command: string; passed: boolean }>;
  diff?: string | null;
  diffUnavailable?: boolean;
}

export interface CollaborationRunDetail {
  run: {
    collaborationRunId: string;
    projectId: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    failedAt: string | null;
  };
  team: string[];
  handoffs: CollaborationHandoff[];
}

export interface CollaborationStartResult {
  collaborationRunId: string;
  projectId: string;
  status: string;
  referralId: string;
  handoffStatus: string;
  source: string;
  target: string;
  conversationId: string;
  conversationCreated: boolean;
}

export function readCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const csrfCookie = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('aisandbox_csrf='));
  return csrfCookie?.slice('aisandbox_csrf='.length) || null;
}

export async function collaborationFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const csrfToken = readCsrfToken();
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
    if (init.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }
  return fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  });
}

export async function readCollaborationFailure(response: Response): Promise<CollaborationRefusal> {
  let message = '';
  try {
    message = readErrorMessage(await response.json());
  } catch {
    message = '';
  }
  return collaborationRefusal(response.status, message);
}
