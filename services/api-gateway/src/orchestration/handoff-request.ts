import {
  DEFAULT_MAX_AGENTS_PER_COLLABORATION,
  type CollaborationListedAgent,
} from './orchestration.contracts';

export const MAX_HANDOFF_TASK_CHARS = 4000;
export const MAX_AGENT_INSTRUCTIONS_CHARS = 4000;
export const MAX_AGENT_NAME_CHARS = 40;

const OPEN_PREFIX = '<handoff to="';
const CLOSE_TAG = '</handoff>';
const FENCE = '```';

export type HandoffMalformedReason =
  | 'not_at_end'
  | 'inside_code_fence'
  | 'multiple_requests'
  | 'nested'
  | 'empty_task'
  | 'malformed_tag';

export type HandoffRequestParse =
  | { readonly kind: 'none' }
  | { readonly kind: 'malformed'; readonly reason: HandoffMalformedReason }
  | { readonly kind: 'too_long'; readonly to: string; readonly taskLength: number }
  | {
      readonly kind: 'request';
      readonly to: string;
      readonly task: string;
      readonly answerWithoutRequest: string;
    };

export function answerHandoffIdempotencyKey(parentReferralId: string): string {
  return `answer-handoff:${parentReferralId}`;
}

export function isCollaborationAgentName(value: string): boolean {
  if (value.length < 1 || value.length > MAX_AGENT_NAME_CHARS) {
    return false;
  }
  for (const char of value) {
    const code = char.charCodeAt(0);
    const digit = code >= 48 && code <= 57;
    const lower = code >= 97 && code <= 122;
    if (!digit && !lower && code !== 45) {
      return false;
    }
  }
  return true;
}

export function readCollaborationAgents(
  value: unknown,
): { ok: true; agents: CollaborationListedAgent[] } | { ok: false; message: string } {
  if (!Array.isArray(value)) {
    return { ok: false, message: 'agents must be an array' };
  }
  if (value.length < 1 || value.length > DEFAULT_MAX_AGENTS_PER_COLLABORATION) {
    return {
      ok: false,
      message: `agents must contain at least 1 and at most ${DEFAULT_MAX_AGENTS_PER_COLLABORATION} entries`,
    };
  }

  const agents: CollaborationListedAgent[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, message: `agents[${index}] is required` };
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.name !== 'string' || !isCollaborationAgentName(record.name)) {
      return { ok: false, message: `agents[${index}].name is invalid` };
    }
    if (seen.has(record.name)) {
      return { ok: false, message: `agents[${index}].name is duplicated` };
    }
    if (typeof record.instructions !== 'string') {
      return { ok: false, message: `agents[${index}].instructions must be a string` };
    }
    if (record.instructions.length > MAX_AGENT_INSTRUCTIONS_CHARS) {
      return {
        ok: false,
        message: `agents[${index}].instructions must be at most ${MAX_AGENT_INSTRUCTIONS_CHARS} characters`,
      };
    }
    seen.add(record.name);
    agents.push({ name: record.name, instructions: record.instructions });
  }

  return { ok: true, agents };
}

export function oneLine(value: string): string {
  let out = '';
  let pendingSpace = false;
  for (const char of value) {
    if (char.trim() === '') {
      pendingSpace = out.length > 0;
      continue;
    }
    if (pendingSpace) {
      out += ' ';
      pendingSpace = false;
    }
    out += char;
  }
  return out;
}

export function buildCollaborationProjectInstructions(input: {
  callerInstructions?: string | null;
  agents: readonly CollaborationListedAgent[];
  agentName: string;
}): string {
  const self = input.agents.find((agent) => agent.name === input.agentName);
  const own = self?.instructions.trim() ?? '';
  const lines: string[] = [`You are ${input.agentName}.`];
  if (own.length > 0) {
    lines.push(own);
  }
  lines.push('');
  lines.push('Other agents:');
  const others = input.agents.filter((agent) => agent.name !== input.agentName);
  if (others.length === 0) {
    lines.push('none');
  } else {
    for (const agent of others) {
      lines.push(`- ${agent.name}: ${oneLine(agent.instructions)}`);
    }
  }
  lines.push('');
  lines.push(
    'Ask another agent only when you genuinely need them. At most one request, alone at the very end of the answer, exactly <handoff to="name">task</handoff>. Otherwise no request.',
  );
  const brief = lines.join('\n');
  const caller = input.callerInstructions ?? '';
  if (caller.length === 0) {
    return brief;
  }
  return `${caller}\n\n${brief}`;
}

export function buildRequestedHandoffPrompt(
  task: string,
  answerWithoutRequest: string,
): string {
  if (answerWithoutRequest.length === 0) {
    return task;
  }
  return `${task}\n\n${answerWithoutRequest}`;
}

export function parseHandoffRequest(answer: string): HandoffRequestParse {
  const trimmed = answer.trim();
  const opens = findAtMost(trimmed, '<handoff', 2);
  const closes = findAtMost(trimmed, CLOSE_TAG, 2);
  if (opens.indexes.length === 0 && closes.indexes.length === 0) {
    return { kind: 'none' };
  }

  const countReason = classifyTagCounts(opens, closes);
  if (countReason) {
    return { kind: 'malformed', reason: countReason };
  }

  const openAt = opens.indexes[0];
  const closeAt = closes.indexes[0];
  if (isInsideCodeFence(trimmed, openAt)) {
    return { kind: 'malformed', reason: 'inside_code_fence' };
  }
  if (closeAt + CLOSE_TAG.length !== trimmed.length || !isAloneOnItsLine(trimmed, openAt)) {
    return { kind: 'malformed', reason: 'not_at_end' };
  }
  if (closeAt < openAt || !trimmed.startsWith(OPEN_PREFIX, openAt)) {
    return { kind: 'malformed', reason: 'malformed_tag' };
  }

  const nameStart = openAt + OPEN_PREFIX.length;
  const nameEnd = trimmed.indexOf('">', nameStart);
  if (nameEnd < 0 || nameEnd > closeAt) {
    return { kind: 'malformed', reason: 'malformed_tag' };
  }
  const name = trimmed.slice(nameStart, nameEnd);
  if (!isCollaborationAgentName(name)) {
    return { kind: 'malformed', reason: 'malformed_tag' };
  }

  const taskRaw = trimmed.slice(nameEnd + 2, closeAt);
  if (taskRaw.includes('<handoff') || taskRaw.includes(CLOSE_TAG)) {
    return { kind: 'malformed', reason: 'nested' };
  }
  const task = taskRaw.trim();
  if (task.length === 0) {
    return { kind: 'malformed', reason: 'empty_task' };
  }
  if (task.length > MAX_HANDOFF_TASK_CHARS) {
    return { kind: 'too_long', to: name, taskLength: task.length };
  }

  const lineStart = startOfLine(trimmed, openAt);
  return {
    kind: 'request',
    to: name,
    task,
    answerWithoutRequest: trimmed.slice(0, lineStart).trim(),
  };
}

function classifyTagCounts(
  opens: { indexes: number[]; truncated: boolean },
  closes: { indexes: number[]; truncated: boolean },
): HandoffMalformedReason | null {
  if (opens.truncated || closes.truncated || opens.indexes.length > 1 || closes.indexes.length > 1) {
    return nestedOpen(opens.indexes, closes.indexes) ? 'nested' : 'multiple_requests';
  }
  if (opens.indexes.length !== 1 || closes.indexes.length !== 1) {
    return 'malformed_tag';
  }
  return null;
}

function nestedOpen(opens: readonly number[], closes: readonly number[]): boolean {
  for (let index = 0; index < opens.length; index += 1) {
    const openAt = opens[index];
    let closeAfter = -1;
    for (const closeAt of closes) {
      if (closeAt > openAt) {
        closeAfter = closeAt;
        break;
      }
    }
    if (closeAfter < 0) {
      continue;
    }
    for (let other = 0; other < opens.length; other += 1) {
      if (other !== index && opens[other] > openAt && opens[other] < closeAfter) {
        return true;
      }
    }
  }
  return false;
}

function findAtMost(
  text: string,
  needle: string,
  limit: number,
): { indexes: number[]; truncated: boolean } {
  const indexes: number[] = [];
  let from = 0;
  while (indexes.length <= limit) {
    const found = text.indexOf(needle, from);
    if (found < 0) {
      return { indexes, truncated: false };
    }
    indexes.push(found);
    from = found + needle.length;
  }
  return { indexes, truncated: true };
}

function isInsideCodeFence(text: string, index: number): boolean {
  let fences = 0;
  let cursor = 0;
  while (cursor < index) {
    const found = text.indexOf(FENCE, cursor);
    if (found < 0 || found >= index) {
      break;
    }
    fences += 1;
    cursor = found + FENCE.length;
  }
  return fences % 2 === 1;
}

function startOfLine(text: string, index: number): number {
  if (index <= 0) {
    return 0;
  }
  const newline = text.lastIndexOf('\n', index - 1);
  return newline < 0 ? 0 : newline + 1;
}

function isAloneOnItsLine(text: string, openAt: number): boolean {
  const start = startOfLine(text, openAt);
  for (let index = start; index < openAt; index += 1) {
    const char = text[index];
    if (char !== ' ' && char !== '\t' && char !== '\r') {
      return false;
    }
  }
  return true;
}
