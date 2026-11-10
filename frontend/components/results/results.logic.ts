/**
 * RESULTS-01: pure helpers for the Results page and the header badge.
 * No fetch, no React. Every visible string comes from the message catalog.
 */

export const RESULTS_PAGE_SIZE = 20;

/** D3 (DECISION B): unread until opened. Cancelled and active never count. */
export const RESULTS_UNREAD_STATUSES = ['completed', 'failed', 'timed_out'] as const;

/** D8: the status filter values, in the order the filter offers them. */
export const RESULTS_STATUS_FILTERS = ['completed', 'failed', 'timed_out', 'cancelled', 'active'] as const;
export type ResultsStatusFilter = (typeof RESULTS_STATUS_FILTERS)[number];

export interface ResultWorkflow {
  id: string;
  name: string;
  testRun: boolean;
}

export interface ResultListItem {
  collaborationRunId: string;
  projectId: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  teamId: string;
  workflow: ResultWorkflow | null;
  task: string | null;
  excerpt: string | null;
  seenAt: string | null;
}

export interface ResultsPage {
  results: ResultListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ResultsFilters {
  status: ResultsStatusFilter | '';
  workflowId: string;
  /** A local calendar day, YYYY-MM-DD, or empty. */
  from: string;
  /** A local calendar day, YYYY-MM-DD, or empty. */
  to: string;
}

export const EMPTY_RESULTS_FILTERS: ResultsFilters = { status: '', workflowId: '', from: '', to: '' };

export interface ResultSource {
  documentId: string;
  title: string;
  scopeId: string;
  heading: string | null;
}

/** D2, D13: what the detail shows, derived from GET /api/collaboration/runs/:id. */
export interface ResultDetail {
  collaborationRunId: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  teamId: string;
  workflow: ResultWorkflow | null;
  task: string | null;
  answer: string | null;
  sources: ResultSource[];
  showUnsourced: boolean;
  droppedSourceCount: number;
  failureReason: string | null;
}

export function isResultsStatusFilter(value: unknown): value is ResultsStatusFilter {
  return typeof value === 'string' && (RESULTS_STATUS_FILTERS as readonly string[]).includes(value);
}

export function isResultUnread(item: Pick<ResultListItem, 'status' | 'seenAt'>): boolean {
  return item.seenAt === null && (RESULTS_UNREAD_STATUSES as readonly string[]).includes(item.status);
}

/** The catalog key for a run status; an unknown one has its own copy. */
export function resultStatusKey(status: string): string {
  return isResultsStatusFilter(status) ? `results.status.${status}` : 'results.status.unknown';
}

export function resultStatusTone(status: string): 'success' | 'danger' | 'neutral' | 'active' {
  if (status === 'completed') return 'success';
  if (status === 'failed' || status === 'timed_out') return 'danger';
  if (status === 'active') return 'active';
  return 'neutral';
}

/** D1: the workflow name, else the team label (existing collaboration.* keys). */
export function resultTitle(
  item: Pick<ResultListItem, 'teamId' | 'workflow'>,
  t: (key: string) => string,
): string {
  if (item.workflow && item.workflow.name.trim().length > 0) {
    return item.workflow.name;
  }
  if (item.teamId === 'chief-of-staff') return t('collaboration.teamChiefOfStaff');
  if (item.teamId === 'advisors') return t('collaboration.teamAdvisors');
  return t('collaboration.teamCoding');
}

export function fillResultsTemplate(template: string, values: Record<string, string>): string {
  let filled = template;
  for (const [key, value] of Object.entries(values)) {
    filled = filled.split(`{${key}}`).join(value);
  }
  return filled;
}

const LOCAL_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function localDay(day: string, endOfDay: boolean): Date | null {
  const match = LOCAL_DAY.exec(day);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const date = Number(match[3]);
  const value = endOfDay
    ? new Date(year, month, date, 23, 59, 59, 999)
    : new Date(year, month, date, 0, 0, 0, 0);
  if (value.getFullYear() !== year || value.getMonth() !== month || value.getDate() !== date) {
    return null;
  }
  return value;
}

/** The start of a local day as an ISO date-time with a zone, or null. */
export function localDayStartIso(day: string): string | null {
  return localDay(day, false)?.toISOString() ?? null;
}

/** The last millisecond of a local day as an ISO date-time with a zone, or null. */
export function localDayEndIso(day: string): string | null {
  return localDay(day, true)?.toISOString() ?? null;
}

/** True when both days are set and From is after To. The page refuses before asking the server. */
export function resultsDateRangeInvalid(filters: Pick<ResultsFilters, 'from' | 'to'>): boolean {
  const from = localDayStartIso(filters.from);
  const to = localDayEndIso(filters.to);
  return from !== null && to !== null && from > to;
}

/** D8 query string. Empty filters are left out; local days become zoned date-times. */
export function resultsQueryString(filters: ResultsFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.workflowId) params.set('workflowId', filters.workflowId);
  const from = filters.from ? localDayStartIso(filters.from) : null;
  const to = filters.to ? localDayEndIso(filters.to) : null;
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  params.set('page', String(Math.max(1, Math.floor(page))));
  params.set('pageSize', String(RESULTS_PAGE_SIZE));
  return params.toString();
}

export function resultsFiltersActive(filters: ResultsFilters): boolean {
  return Boolean(filters.status || filters.workflowId || filters.from || filters.to);
}

export function resultsPageCount(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0 || pageSize <= 0) {
    return 1;
  }
  return Math.ceil(total / pageSize);
}

export function formatResultTime(iso: string | null, locale: string): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch {
    return date.toISOString();
  }
}

/** D15: the header pill text; null hides the pill. */
export function unreadBadgeText(count: number | null): string | null {
  if (count === null || !Number.isInteger(count) || count <= 0) {
    return null;
  }
  return count > 99 ? '99+' : String(count);
}

/** Opening a result clears its unread mark in place, without refetching the list (D14). */
export function withResultSeen(
  items: readonly ResultListItem[],
  collaborationRunId: string,
  seenAt: string,
): ResultListItem[] {
  return items.map((item) =>
    item.collaborationRunId === collaborationRunId && item.seenAt === null ? { ...item, seenAt } : item,
  );
}
