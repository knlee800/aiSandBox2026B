import {
  DRAFT_INVALID_REASONS,
  DRAFT_KINDS,
  DRAFT_PARTS,
  DRAFT_PROBLEM_REASONS,
  type CollaborationDraftInvalidReason,
  type CollaborationDraftKind,
  type CollaborationDraftPart,
  type CollaborationDraftProblemReason,
  type CollaborationDraftView,
} from '@/lib/collaboration/api';
import { fillTemplate } from '@/lib/collaboration/logic';

/**
 * COS-DRAFTS-01B: the reader and card helpers for a Chief of Staff draft. Pure: no request,
 * no storage, no save. A draft is only ever text to read; the owner saves it in the create form.
 */

const REPLY_LANGUAGES = ['owner', 'en', 'zh-TW', 'zh-CN'] as const;
const MAX_UNKNOWN_LABELS = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInvalidReason(value: unknown): value is CollaborationDraftInvalidReason {
  return typeof value === 'string' && (DRAFT_INVALID_REASONS as readonly string[]).includes(value);
}

function isProblemReason(value: unknown): value is CollaborationDraftProblemReason {
  return typeof value === 'string' && (DRAFT_PROBLEM_REASONS as readonly string[]).includes(value);
}

function isPart(value: unknown): value is CollaborationDraftPart {
  return typeof value === 'string' && (DRAFT_PARTS as readonly string[]).includes(value);
}

function emptyDraft(
  kind: CollaborationDraftKind | null,
  invalid: CollaborationDraftInvalidReason,
  unknownLabels: string[],
  answerWithoutDraft: string,
): CollaborationDraftView {
  return { kind, fields: {}, problems: [], invalid, unknownLabels, answerWithoutDraft };
}

/**
 * Reads the run detail's draft value. Fails closed: anything that is not a well-formed usable
 * draft becomes an invalid one (so the card shows a reason and no link), and a value that is
 * absent or not an object is no draft at all.
 */
export function readHandoffDraft(value: unknown): CollaborationDraftView | null {
  if (!isRecord(value)) return null;
  const kind =
    typeof value.kind === 'string' && (DRAFT_KINDS as readonly string[]).includes(value.kind)
      ? (value.kind as CollaborationDraftKind)
      : null;
  const answerWithoutDraft = typeof value.answerWithoutDraft === 'string' ? value.answerWithoutDraft : '';
  const unknownLabels = Array.isArray(value.unknownLabels)
    ? value.unknownLabels.filter((label): label is string => typeof label === 'string').slice(0, MAX_UNKNOWN_LABELS)
    : [];
  if (value.invalid !== null && value.invalid !== undefined) {
    // An unknown reason is still refused: it shows the generic copy.
    return emptyDraft(
      kind,
      isInvalidReason(value.invalid) ? value.invalid : 'malformed_tag',
      unknownLabels,
      answerWithoutDraft,
    );
  }
  if (kind === null) return emptyDraft(null, 'invalid_kind', unknownLabels, answerWithoutDraft);

  const fields: CollaborationDraftView['fields'] = {};
  const source = isRecord(value.fields) ? value.fields : {};
  for (const part of DRAFT_PARTS) {
    const text = source[part];
    if (typeof text !== 'string' || text.trim() === '') continue;
    if (part === 'replyLanguage' && !(REPLY_LANGUAGES as readonly string[]).includes(text)) continue;
    fields[part] = text;
  }
  if (!fields.name || fields.name.trim() === '') {
    return emptyDraft(kind, 'missing_name', unknownLabels, answerWithoutDraft);
  }
  const problems: CollaborationDraftView['problems'] = [];
  if (Array.isArray(value.problems)) {
    for (const item of value.problems) {
      if (isRecord(item) && isPart(item.part) && isProblemReason(item.reason)) {
        problems.push({ part: item.part, reason: item.reason });
      }
    }
  }
  return { kind, fields, problems, invalid: null, unknownLabels, answerWithoutDraft };
}

/** The Team page link that opens the create form prefilled with this step's draft. */
export function draftReviewHref(locale: string, runId: string, referralId: string): string {
  const prefix = locale ? `/${locale}` : '';
  return `${prefix}/platform?draftRun=${encodeURIComponent(runId)}&draftStep=${encodeURIComponent(referralId)}`;
}

/** The message key for a part label, an invalid reason or a problem reason. */
function camel(snake: string): string {
  return snake
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

export function draftFieldKey(part: CollaborationDraftPart): string {
  return `draftField${part.charAt(0).toUpperCase()}${part.slice(1)}`;
}

export function draftInvalidKey(reason: CollaborationDraftInvalidReason): string {
  return `draftInvalid${camel(reason)}`;
}

export function draftProblemKey(reason: CollaborationDraftProblemReason): string {
  return `draftProblem${camel(reason)}`;
}

export interface CollaborationDraftCardView {
  title: string;
  kindLabel: string;
  valid: boolean;
  partsSummary: string;
  parts: Array<{ part: CollaborationDraftPart; label: string; value: string }>;
  notSavedText: string;
  ownerSetsText: string | null;
  droppedText: string | null;
  unknownLabelsText: string | null;
  invalidText: string | null;
  reviewLabel: string;
  /** Null unless the draft is usable: an invalid draft has no link. */
  reviewHref: string | null;
}

export function buildDraftCard(
  draft: CollaborationDraftView,
  context: { t: (key: string) => string; locale: string; runId: string; referralId: string },
): CollaborationDraftCardView {
  const { t } = context;
  const valid = draft.invalid === null;
  const kindLabel = draft.kind === null ? '' : t(draft.kind === 'agent' ? 'draftKindAgent' : 'draftKindWorkflow');
  const name = draft.fields.name ?? '';
  const parts = valid
    ? DRAFT_PARTS.flatMap((part) => {
        const value = draft.fields[part];
        return value ? [{ part, label: t(draftFieldKey(part)), value }] : [];
      })
    : [];
  const droppedItems = draft.problems.map((problem) =>
    fillTemplate(t('draftProblemItem'), { part: t(draftFieldKey(problem.part)), reason: t(draftProblemKey(problem.reason)) }),
  );
  const labels = draft.unknownLabels.join(', ');
  return {
    title: valid
      ? fillTemplate(t('draftTitle'), { kind: kindLabel, name })
      : t('draftTitleInvalid'),
    kindLabel,
    valid,
    partsSummary: t('draftParts'),
    parts,
    notSavedText: t('draftNotSaved'),
    ownerSetsText: valid ? t('draftOwnerSets') : null,
    droppedText: valid && droppedItems.length > 0 ? fillTemplate(t('draftDropped'), { parts: droppedItems.join('; ') }) : null,
    unknownLabelsText:
      !valid && draft.invalid === 'unknown_label' && labels.length > 0
        ? fillTemplate(t('draftUnknownLabels'), { labels })
        : null,
    invalidText: valid || draft.invalid === null ? null : t(draftInvalidKey(draft.invalid)),
    reviewLabel: t('draftReview'),
    reviewHref: valid ? draftReviewHref(context.locale, context.runId, context.referralId) : null,
  };
}
