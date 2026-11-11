import {
  collaborationRefusal,
  fillTemplate,
  handoffIsWaiting,
  readErrorMessage,
  type CollaborationRefusal,
} from './logic';

export interface CollaborationRunListItem {
  collaborationRunId: string;
  projectId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  teamId?: string;
}

export interface CollaborationSource {
  documentId: string;
  title: string;
  scopeId: string;
  heading: string | null;
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
  sources?: CollaborationSource[];
  droppedSourceCount?: number;
  unsourced?: boolean;
  showUnsourced?: boolean;
  canChangeFiles?: boolean;
  changedPaths?: string[];
  savePoint?: string | null;
  tests?: Array<{ command: string; passed: boolean }>;
  diff?: string | null;
  diffUnavailable?: boolean;
  testsGate?: 'passed' | 'not_required' | 'blocked';
  testsBlockReason?: 'failed' | 'none' | null;
  /** APPROVAL-SET-01B: set when the server approved this step under the lead's setting. */
  autoApproved?: CollaborationAutoApproved | null;
  /** APPROVAL-SET-01B: why a waiting step waits although the setting is not "every"; else null. */
  autoApprovalWaiting?: CollaborationAutoApprovalWaiting | null;
}

export interface CollaborationAutoApproved {
  mode: 'read_only' | 'credits';
  estimateCredits: number | null;
  creditLimit: number | null;
}

/** The reasons a waiting step still waits under an automatic setting; each has a translated line. */
export const AUTO_APPROVAL_WAIT_REASONS = [
  'writes',
  'unknown_cost',
  'over_limit',
  'checks_failed',
  'lead_missing',
] as const;
export type CollaborationAutoApprovalWaiting = (typeof AUTO_APPROVAL_WAIT_REASONS)[number];

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
  teamId?: string;
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

const AUTO_APPROVAL_WAIT_KEYS: Record<CollaborationAutoApprovalWaiting, string> = {
  writes: 'autoApprovalWaitingWrites',
  unknown_cost: 'autoApprovalWaitingUnknownCost',
  over_limit: 'autoApprovalWaitingOverLimit',
  checks_failed: 'autoApprovalWaitingChecksFailed',
  lead_missing: 'autoApprovalWaitingLeadMissing',
};

/**
 * APPROVAL-SET-01C: the "Approved automatically: ..." line for a step the server approved
 * under the lead's setting, or null when a person decided it. `t` reads the collaboration catalog.
 */
export function collaborationAutoApprovedText(
  handoff: Pick<CollaborationHandoff, 'autoApproved' | 'decidedBy'>,
  t: (key: string) => string,
): string | null {
  const approved = handoff.autoApproved;
  if (!approved || handoff.decidedBy === null) return null;
  if (approved.mode === 'credits') {
    if (typeof approved.estimateCredits === 'number' && typeof approved.creditLimit === 'number') {
      const amount = (count: number): string =>
        fillTemplate(t(count === 1 ? 'creditAmountOne' : 'creditAmountMany'), { count: String(count) });
      return fillTemplate(t('autoApprovedCredits'), {
        estimate: amount(approved.estimateCredits),
        limit: amount(approved.creditLimit),
      });
    }
    return t('autoApprovedCreditsShort');
  }
  return approved.mode === 'read_only' ? t('autoApprovedReadOnly') : null;
}

/** APPROVAL-SET-01C: why a waiting step still waits under an automatic setting; null when it has no reason. */
export function collaborationAutoApprovalWaitingText(
  handoff: Pick<CollaborationHandoff, 'autoApprovalWaiting' | 'status'>,
  t: (key: string) => string,
): string | null {
  const reason = handoff.autoApprovalWaiting;
  if (!reason || !handoffIsWaiting(handoff.status)) return null;
  const key = Object.prototype.hasOwnProperty.call(AUTO_APPROVAL_WAIT_KEYS, reason)
    ? AUTO_APPROVAL_WAIT_KEYS[reason]
    : null;
  return key ? t(key) : null;
}
