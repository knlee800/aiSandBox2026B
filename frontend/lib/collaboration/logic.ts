export const COLLABORATION_POLL_MS = 5000;

export type CollaborationRefusal =
  | 'off'
  | 'credits'
  | 'dailyCredits'
  | 'tokens'
  | 'rate'
  | 'notFound'
  | 'forbidden'
  | 'session'
  | 'generic';

const REFUSAL_MESSAGE_KEYS: Record<CollaborationRefusal, string> = {
  off: 'refusalOff',
  credits: 'refusalCredits',
  dailyCredits: 'refusalDailyCredits',
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

function readCreditCap(body: unknown): 'user' | 'platform' | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }
  const cap = (body as { cap?: unknown }).cap;
  if (cap === 'user' || cap === 'platform') {
    return cap;
  }
  return null;
}

export function collaborationRefusal(
  status: number,
  message: string,
  body?: unknown,
): CollaborationRefusal {
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
    if (readCreditCap(body)) {
      return 'dailyCredits';
    }
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

export type CollaborationTestsGate = 'passed' | 'not_required' | 'blocked';

export type CollaborationTestsBlockReason = 'failed' | 'none';

export function readTestsGate(value: unknown): CollaborationTestsGate {
  if (value === 'passed' || value === 'not_required' || value === 'blocked') {
    return value;
  }
  return 'not_required';
}

export function readTestsBlockReason(value: unknown): CollaborationTestsBlockReason | null {
  if (value === 'failed' || value === 'none') {
    return value;
  }
  return null;
}

export function readTestsNotPassed(
  status: number,
  body: unknown,
): CollaborationTestsBlockReason | null {
  if (status !== 409 || !body || typeof body !== 'object') {
    return null;
  }
  const record = body as { code?: unknown; testsBlockReason?: unknown };
  if (record.code !== 'TESTS_NOT_PASSED') {
    return null;
  }
  return record.testsBlockReason === 'failed' ? 'failed' : 'none';
}

export function approveRequestBody(
  approveWithoutPassingTests: boolean,
): { approveWithoutPassingTests: true } | Record<string, never> {
  if (approveWithoutPassingTests) {
    return { approveWithoutPassingTests: true };
  }
  return {};
}

export function approveWithoutPassingTestsForClick(input: {
  testsGate: CollaborationTestsGate;
  approveWithoutTests: boolean;
}): boolean {
  return input.testsGate === 'blocked' && input.approveWithoutTests;
}

/** Round number for each reviewer-to-writer step, in chain order. Other steps are null. */
export function sendBackRoundNumbers(
  handoffs: readonly { source: string; target: string }[],
): Array<number | null> {
  let round = 0;
  return handoffs.map((handoff) => {
    if (handoff.source === 'reviewer' && handoff.target === 'writer') {
      round += 1;
      return round;
    }
    return null;
  });
}

export function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

export interface CollaborationSourceRead {
  documentId: string;
  title: string;
  scopeId: string;
  heading: string | null;
}

export function readCollaborationSources(value: unknown): CollaborationSourceRead[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const sources: CollaborationSourceRead[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.documentId !== 'string' || record.documentId.length === 0) {
      continue;
    }
    if (typeof record.title !== 'string' || record.title.length === 0) {
      continue;
    }
    if (typeof record.scopeId !== 'string' || record.scopeId.length === 0) {
      continue;
    }
    const heading = record.heading;
    if (heading != null && typeof heading !== 'string') {
      continue;
    }
    sources.push({
      documentId: record.documentId,
      title: record.title,
      scopeId: record.scopeId,
      heading: typeof heading === 'string' && heading.length > 0 ? heading : null,
    });
  }
  return sources;
}

export function readDroppedSourceCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return 0;
  }
  return value;
}

export function collaborationScopeLabel(scopeId: string, translated: string): string {
  if (translated === `knowledge.scopes.${scopeId}` || translated.trim().length === 0) {
    return scopeId;
  }
  return translated;
}

export function formatCollaborationSource(source: {
  title: string;
  scopeLabel: string;
  heading: string | null;
}): string {
  if (source.heading && source.heading.length > 0) {
    return `${source.title} · ${source.scopeLabel} · ${source.heading}`;
  }
  return `${source.title} · ${source.scopeLabel}`;
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
