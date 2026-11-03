export const COLLABORATION_POLL_MS = 5000;

export type CollaborationRefusal =
  | 'off'
  | 'credits'
  | 'tokens'
  | 'rate'
  | 'notFound'
  | 'forbidden'
  | 'session'
  | 'generic';

const REFUSAL_MESSAGE_KEYS: Record<CollaborationRefusal, string> = {
  off: 'refusalOff',
  credits: 'refusalCredits',
  tokens: 'refusalTokens',
  rate: 'refusalRate',
  notFound: 'refusalNotFound',
  forbidden: 'refusalForbidden',
  session: 'refusalSession',
  generic: 'refusalGeneric',
};

export function collaborationRefusalMessageKey(refusal: CollaborationRefusal): string {
  return REFUSAL_MESSAGE_KEYS[refusal];
}

export function collaborationRefusal(status: number, message: string): CollaborationRefusal {
  const text = message.toLowerCase();
  if (status === 404) {
    return 'notFound';
  }
  if (status === 403) {
    return 'forbidden';
  }
  if (status === 402) {
    return 'credits';
  }
  if (status === 429) {
    return text.includes('token') ? 'tokens' : 'rate';
  }
  if (status === 503) {
    return 'off';
  }
  if (status === 409 && text.includes('session')) {
    return 'session';
  }
  return 'generic';
}

export function readErrorMessage(body: unknown): string {
  if (!body || typeof body !== 'object') {
    return '';
  }
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message)) {
    return message.filter((entry) => typeof entry === 'string').join(' ');
  }
  return '';
}

export function collaborationRunIsActive(status: string | null | undefined): boolean {
  return status === 'active';
}

export function shouldPollCollaboration(input: {
  runStatus: string | null | undefined;
  documentHidden: boolean;
}): boolean {
  return collaborationRunIsActive(input.runStatus) && !input.documentHidden;
}

export function handoffIsWaiting(status: string): boolean {
  return status === 'pending_approval';
}

export function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

export function readHandoffTests(
  value: unknown,
): Array<{ command: string; passed: boolean }> {
  if (!Array.isArray(value)) {
    return [];
  }
  const tests: Array<{ command: string; passed: boolean }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const command = (entry as { command?: unknown }).command;
    const passed = (entry as { passed?: unknown }).passed;
    if (typeof command !== 'string' || command.length === 0 || typeof passed !== 'boolean') {
      continue;
    }
    tests.push({ command, passed });
  }
  return tests;
}

export function collaborationTeamHref(
  locale: string,
  sessionId: string,
  projectId: string | null,
): string {
  const params = new URLSearchParams();
  params.set('sessionId', sessionId);
  if (projectId && projectId.trim().length > 0) {
    params.set('projectId', projectId.trim());
  }
  return `/${locale}/collaboration?${params.toString()}`;
}

export function fillTemplate(template: string, values: Record<string, string>): string {
  let filled = template;
  for (const [key, value] of Object.entries(values)) {
    filled = filled.split(`{${key}}`).join(value);
  }
  return filled;
}

export function collaborationMemberLabel(
  name: string,
  labels: { you: string; lead: string; writer: string; reviewer: string },
): string {
  if (name === 'user') {
    return labels.you;
  }
  if (name === 'lead') {
    return labels.lead;
  }
  if (name === 'writer') {
    return labels.writer;
  }
  if (name === 'reviewer') {
    return labels.reviewer;
  }
  return name;
}

export function createSingleFlight(): {
  tryBegin: () => boolean;
  end: () => void;
} {
  let busy = false;
  return {
    tryBegin: () => {
      if (busy) {
        return false;
      }
      busy = true;
      return true;
    },
    end: () => {
      busy = false;
    },
  };
}
