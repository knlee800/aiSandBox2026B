import {
  agentInstructionsWithinLimit,
  isSystemAgentReplyLanguage,
  MAX_AGENT_TONE_CHARS,
  systemAgentPromptSpecProblems,
  type SystemAgentReplyLanguage,
} from '../system-agents/system-agent-registry';
import { USER_WORKFLOW_RULES } from '../user-agent/user-workflow-rules';
import { MAX_AGENT_INSTRUCTIONS_CHARS } from './handoff-request';
import { COLLABORATION_CHIEF_OF_STAFF_PROFILE_ID } from './collaboration-teams';

/**
 * COS-DRAFTS-01 (D1, D2, D4): the draft block at the end of a Chief of Staff
 * answer, parsed on read (D5). Pure: no storage, no route, no grant.
 *
 * The block has the hand-off tag's placement rules: exactly one, alone at
 * the very end of the answer, not inside a code fence:
 *
 *   <draft kind="workflow">
 *   name: Weekly sales digest
 *   role: Sales analyst
 *   description: Sums up the week's sales mail.
 *   tone: calm
 *   reply language: zh-TW
 *   purpose: ...
 *   procedure: ...
 *   result: ...
 *   </draft>
 *
 * kind is "workflow" or "agent" (a plain agent: name, role and description).
 * A label is a line that starts, at column 0, with one to three lower-case
 * words and a colon. Its value runs to the next label. Only the eight text
 * parts of the create form exist (DRAFT_LABELS). Any other label (tools:,
 * folders:, model:, budget:, team:, approval:, status: ...) makes the whole
 * draft invalid: a draft can never carry access, a model, a budget, a team,
 * an approval setting or a status (D2). A part that does not fit the form's
 * limits is dropped and named in `problems`; nothing is cut (D4). The owner
 * saves through POST /api/agents, which validates again.
 */

export const DRAFT_KINDS = ['workflow', 'agent'] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

/** The label as written in the block, and the form part it fills. In block order. */
export const DRAFT_LABELS = [
  { label: 'name', part: 'name' },
  { label: 'role', part: 'role' },
  { label: 'description', part: 'description' },
  { label: 'tone', part: 'tone' },
  { label: 'reply language', part: 'replyLanguage' },
  { label: 'purpose', part: 'purpose' },
  { label: 'procedure', part: 'procedure' },
  { label: 'result', part: 'result' },
] as const;

export type DraftPart = (typeof DRAFT_LABELS)[number]['part'];

/** The parts a kind="agent" draft may fill; the others are dropped (not_for_agent). */
const AGENT_KIND_PARTS: readonly DraftPart[] = ['name', 'role', 'description'];

/** The create form's limits (dto/create-agent.dto.ts). */
export const DRAFT_NAME_MAX_CHARS = 100;
export const DRAFT_ROLE_MAX_CHARS = 200;
export const DRAFT_DESCRIPTION_MAX_CHARS = 2000;

export interface DraftFields {
  name?: string;
  role?: string;
  description?: string;
  tone?: string;
  replyLanguage?: SystemAgentReplyLanguage;
  purpose?: string;
  procedure?: string;
  result?: string;
}

export type DraftProblemReason =
  | 'too_long'
  | 'control_characters'
  | 'not_allowed_value'
  | 'not_for_agent'
  | 'prompt_too_long';

export interface DraftProblem {
  part: DraftPart;
  reason: DraftProblemReason;
}

export type DraftInvalidReason =
  | 'malformed_tag'
  | 'invalid_kind'
  | 'not_at_end'
  | 'inside_code_fence'
  | 'multiple_blocks'
  | 'nested'
  | 'text_before_label'
  | 'unknown_label'
  | 'duplicate_label'
  | 'missing_name'
  | 'invalid_name';

/** What the run detail shows for a Chief of Staff step whose answer carries a block. */
export interface CollaborationDraftView {
  /** null when the opening tag could not be read. */
  kind: DraftKind | null;
  /** Empty when invalid. Only the eight text parts, each within the form's limits. */
  fields: DraftFields;
  /** Parts left out of `fields`, with why. Empty when invalid. */
  problems: DraftProblem[];
  /** Why the whole draft is refused; null for a usable draft. */
  invalid: DraftInvalidReason | null;
  /** Labels outside DRAFT_LABELS, as written (cut at 40 characters, at most 10), when invalid is unknown_label. */
  unknownLabels: string[];
  /** The answer before the block, trimmed; the whole answer, trimmed, when the block is misplaced. */
  answerWithoutDraft: string;
}

const OPEN_TAG = '<draft';
const CLOSE_TAG = '</draft>';
const FENCE = '```';
const OPEN_TAG_PATTERN = /^<draft kind="([^"\n]{0,40})">$/;
/** One to three lower-case words, then a colon, at the start of a line. */
const LABEL_LINE = /^([a-z][a-z_-]*(?: [a-z][a-z_-]*){0,2}):(.*)$/;
const MAX_LISTED_UNKNOWN_LABELS = 10;
const MAX_UNKNOWN_LABEL_CHARS = 40;

// The registry's rules: one-line text has no control character; a
// multi-line part allows a newline and no other control character.
const ONE_LINE_FORBIDDEN = /[\u0000-\u001f\u007f-\u009f]/;
const PART_FORBIDDEN = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/;

/** D3: only a step whose target is the Chief of Staff is read for a draft. */
export function stepMayDraft(targetProfileId: string): boolean {
  return targetProfileId === COLLABORATION_CHIEF_OF_STAFF_PROFILE_ID;
}

/**
 * The draft in an answer, or null when the answer holds no draft tag.
 * Deterministic: the same answer always gives the same view.
 */
export function parseDraftBlock(answer: string): CollaborationDraftView | null {
  const text = answer.replace(/\r\n?/g, '\n').trim();
  const opens = indexesOf(text, OPEN_TAG);
  const closes = indexesOf(text, CLOSE_TAG);
  if (opens.length === 0 && closes.length === 0) {
    return null;
  }
  if (opens.length > 1 || closes.length > 1) {
    return refused(nestedOpen(opens, closes) ? 'nested' : 'multiple_blocks', null, text);
  }
  if (opens.length !== 1 || closes.length !== 1) {
    return refused('malformed_tag', null, text);
  }
  const openAt = opens[0];
  const closeAt = closes[0];
  if (isInsideCodeFence(text, openAt)) {
    return refused('inside_code_fence', null, text);
  }
  if (
    closeAt < openAt ||
    closeAt + CLOSE_TAG.length !== text.length ||
    !isAloneOnItsLine(text, openAt) ||
    !isAloneOnItsLine(text, closeAt)
  ) {
    return refused('not_at_end', null, text);
  }
  const openEnd = text.indexOf('\n', openAt);
  if (openEnd < 0 || openEnd > closeAt) {
    return refused('malformed_tag', null, text);
  }
  const answerWithoutDraft = text.slice(0, startOfLine(text, openAt)).trim();
  const tag = OPEN_TAG_PATTERN.exec(text.slice(openAt, openEnd).trimEnd());
  if (!tag) {
    return refused('malformed_tag', null, answerWithoutDraft);
  }
  const kind = (DRAFT_KINDS as readonly string[]).includes(tag[1]) ? (tag[1] as DraftKind) : null;
  if (!kind) {
    return refused('invalid_kind', null, answerWithoutDraft);
  }
  const body = text.slice(openEnd + 1, closeAt);
  const read = readLabelledParts(body);
  if ('invalid' in read) {
    return {
      ...refused(read.invalid, kind, answerWithoutDraft),
      unknownLabels: read.unknownLabels,
    };
  }
  return validateDraft(kind, read.values, answerWithoutDraft);
}

/**
 * D4: the form's limits. A part that fails is dropped and named; a missing,
 * empty or unusable name refuses the whole draft. `values` maps a part to
 * its raw text (trimmed). Empty optional parts are left out without a problem.
 */
export function validateDraft(
  kind: DraftKind,
  values: ReadonlyMap<DraftPart, string>,
  answerWithoutDraft = '',
): CollaborationDraftView {
  const fields: DraftFields = {};
  const problems: DraftProblem[] = [];
  const drop = (part: DraftPart, reason: DraftProblemReason): void => {
    problems.push({ part, reason });
  };

  const name = values.get('name') ?? '';
  if (name.length === 0) {
    return refused('missing_name', kind, answerWithoutDraft);
  }
  if (name.length > DRAFT_NAME_MAX_CHARS || ONE_LINE_FORBIDDEN.test(name)) {
    return refused('invalid_name', kind, answerWithoutDraft);
  }
  fields.name = name;

  for (const { part } of DRAFT_LABELS) {
    const value = values.get(part) ?? '';
    if (part === 'name' || value.length === 0) {
      continue;
    }
    if (kind === 'agent' && !AGENT_KIND_PARTS.includes(part)) {
      drop(part, 'not_for_agent');
      continue;
    }
    switch (part) {
      case 'role':
        if (value.length > DRAFT_ROLE_MAX_CHARS) drop(part, 'too_long');
        else if (ONE_LINE_FORBIDDEN.test(value)) drop(part, 'control_characters');
        else fields.role = value;
        break;
      case 'description':
        if (value.length > DRAFT_DESCRIPTION_MAX_CHARS) drop(part, 'too_long');
        else if (PART_FORBIDDEN.test(value)) drop(part, 'control_characters');
        else fields.description = value;
        break;
      case 'tone':
        if (value.length > MAX_AGENT_TONE_CHARS) drop(part, 'too_long');
        else if (specProblem({ tone: value })) drop(part, 'control_characters');
        else fields.tone = value;
        break;
      case 'replyLanguage':
        if (isSystemAgentReplyLanguage(value)) fields.replyLanguage = value;
        else drop(part, 'not_allowed_value');
        break;
      case 'purpose':
      case 'procedure':
      case 'result':
        if (value.length > MAX_AGENT_INSTRUCTIONS_CHARS) drop(part, 'too_long');
        else if (specProblem({ [part]: value })) drop(part, 'control_characters');
        else fields[part] = value;
        break;
    }
  }

  // The rendered prompt with the platform rules must fit, as on save.
  const withinLimit = agentInstructionsWithinLimit({
    tone: fields.tone ?? null,
    replyLanguage: fields.replyLanguage ?? null,
    purpose: fields.purpose ?? '',
    procedure: fields.procedure ?? '',
    result: fields.result ?? '',
    rules: USER_WORKFLOW_RULES,
  });
  if (!withinLimit) {
    for (const part of ['purpose', 'procedure', 'result'] as const) {
      if (fields[part] !== undefined) {
        delete fields[part];
        drop(part, 'prompt_too_long');
      }
    }
  }

  return { kind, fields, problems, invalid: null, unknownLabels: [], answerWithoutDraft };
}

function specProblem(part: { tone?: string; purpose?: string; procedure?: string; result?: string }): boolean {
  return (
    systemAgentPromptSpecProblems({
      tone: part.tone ?? null,
      replyLanguage: null,
      purpose: part.purpose ?? '',
      procedure: part.procedure ?? '',
      result: part.result ?? '',
      rules: '',
    }).length > 0
  );
}

function refused(
  invalid: DraftInvalidReason,
  kind: DraftKind | null,
  answerWithoutDraft: string,
): CollaborationDraftView {
  return { kind, fields: {}, problems: [], invalid, unknownLabels: [], answerWithoutDraft };
}

function readLabelledParts(
  body: string,
):
  | { values: Map<DraftPart, string> }
  | { invalid: DraftInvalidReason; unknownLabels: string[] } {
  const raw = new Map<DraftPart, string[]>();
  const unknownLabels: string[] = [];
  let current: string[] | null = null;
  let duplicate = false;
  for (const line of body.split('\n')) {
    const match = LABEL_LINE.exec(line);
    if (match) {
      const known = DRAFT_LABELS.find((entry) => entry.label === match[1]);
      if (!known) {
        const label = match[1].slice(0, MAX_UNKNOWN_LABEL_CHARS);
        if (!unknownLabels.includes(label) && unknownLabels.length < MAX_LISTED_UNKNOWN_LABELS) {
          unknownLabels.push(label);
        }
        current = [];
        continue;
      }
      if (raw.has(known.part)) {
        duplicate = true;
      }
      current = [match[2]];
      raw.set(known.part, current);
      continue;
    }
    if (current === null) {
      if (line.trim().length > 0) {
        return { invalid: 'text_before_label', unknownLabels: [] };
      }
      continue;
    }
    current.push(line);
  }
  if (unknownLabels.length > 0) {
    return { invalid: 'unknown_label', unknownLabels };
  }
  if (duplicate) {
    return { invalid: 'duplicate_label', unknownLabels: [] };
  }
  const values = new Map<DraftPart, string>();
  for (const [part, lines] of raw) {
    values.set(part, lines.join('\n').trim());
  }
  return { values };
}

function indexesOf(text: string, needle: string): number[] {
  const indexes: number[] = [];
  let from = 0;
  for (;;) {
    const found = text.indexOf(needle, from);
    if (found < 0) {
      return indexes;
    }
    indexes.push(found);
    from = found + needle.length;
  }
}

function nestedOpen(opens: readonly number[], closes: readonly number[]): boolean {
  for (const openAt of opens) {
    const closeAfter = closes.find((closeAt) => closeAt > openAt);
    if (closeAfter === undefined) {
      continue;
    }
    if (opens.some((other) => other > openAt && other < closeAfter)) {
      return true;
    }
  }
  return false;
}

function isInsideCodeFence(text: string, index: number): boolean {
  let fences = 0;
  let cursor = 0;
  for (;;) {
    const found = text.indexOf(FENCE, cursor);
    if (found < 0 || found >= index) {
      return fences % 2 === 1;
    }
    fences += 1;
    cursor = found + FENCE.length;
  }
}

function startOfLine(text: string, index: number): number {
  if (index <= 0) {
    return 0;
  }
  const newline = text.lastIndexOf('\n', index - 1);
  return newline < 0 ? 0 : newline + 1;
}

/** Only spaces or tabs before the tag on its line. */
function isAloneOnItsLine(text: string, at: number): boolean {
  for (let index = startOfLine(text, at); index < at; index += 1) {
    if (text[index] !== ' ' && text[index] !== '\t') {
      return false;
    }
  }
  return true;
}
