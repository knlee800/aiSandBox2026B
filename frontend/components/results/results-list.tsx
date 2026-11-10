'use client';

import React from 'react';
import Link from 'next/link';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  InboxIcon,
  InformationCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import Spinner from '@/components/ui/Spinner';
import type { ResultsWorkflowOption } from './results-api';
import {
  RESULTS_STATUS_FILTERS,
  fillResultsTemplate,
  formatResultTime,
  isResultUnread,
  isResultsStatusFilter,
  resultStatusKey,
  resultStatusTone,
  resultTitle,
  resultsDateRangeInvalid,
  resultsFiltersActive,
  resultsPageCount,
  type ResultListItem,
  type ResultsFilters,
  type ResultsPage,
} from './results.logic';
import type { ResultsListPhase } from './use-results';

export const RESULTS_QUIET_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50';
const PRIMARY_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50';
const FIELD =
  'mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

const TONE_CLASSES: Record<ReturnType<typeof resultStatusTone>, string> = {
  success: 'border-emerald-400/40 text-emerald-200',
  danger: 'border-red-400/40 text-red-200',
  active: 'border-indigo-400/40 text-indigo-200',
  neutral: 'border-slate-600 text-slate-300',
};

export function ResultStatusPill({ status, t }: { status: string; t: (key: string) => string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE_CLASSES[resultStatusTone(status)]}`}
      data-testid="results-status"
      data-status={status}
    >
      {t(resultStatusKey(status))}
    </span>
  );
}

export function ResultTestRunBadge({ t }: { t: (key: string) => string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
      data-testid="results-test-run"
    >
      {t('collaboration.testRunBadge')}
    </span>
  );
}

export interface ResultsListViewProps {
  t: (key: string) => string;
  locale: string;
  phase: ResultsListPhase;
  page: ResultsPage | null;
  filters: ResultsFilters;
  workflows: ResultsWorkflowOption[];
  onApplyFilters: (filters: ResultsFilters) => void;
  onPage: (page: number) => void;
  onRetry: () => void;
  onOpen: (collaborationRunId: string) => void;
}

function ResultRow({
  item,
  t,
  locale,
  onOpen,
}: {
  item: ResultListItem;
  t: (key: string) => string;
  locale: string;
  onOpen: (collaborationRunId: string) => void;
}) {
  const unread = isResultUnread(item);
  const title = resultTitle(item, t);
  const started = formatResultTime(item.createdAt, locale);
  const finished = formatResultTime(item.finishedAt, locale);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item.collaborationRunId)}
        className="group flex w-full min-w-0 flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-left transition-colors hover:border-slate-700 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.99] motion-reduce:active:scale-100 sm:px-5"
        data-testid={`results-item-${item.collaborationRunId}`}
        data-unread={unread ? 'true' : 'false'}
        aria-label={`${title}. ${t(resultStatusKey(item.status))}${unread ? `. ${t('results.item.new')}` : ''}`}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          {unread ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" data-testid="results-unread-dot" />
          ) : null}
          <span className={`min-w-0 truncate text-sm ${unread ? 'font-semibold text-white' : 'font-medium text-slate-100'}`}>
            {title}
          </span>
          <ResultStatusPill status={item.status} t={t} />
          {item.workflow?.testRun ? <ResultTestRunBadge t={t} /> : null}
          {unread ? (
            <span
              className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
              data-testid="results-new"
            >
              {t('results.item.new')}
            </span>
          ) : null}
        </span>
        {item.task ? (
          <span className="line-clamp-2 min-w-0 break-words text-sm text-slate-300" data-testid="results-task">
            {item.task}
          </span>
        ) : null}
        <span
          className={`line-clamp-2 min-w-0 break-words text-sm ${item.excerpt ? 'text-slate-400' : 'italic text-slate-500'}`}
          data-testid="results-excerpt"
        >
          {item.excerpt ?? t('results.item.noAnswer')}
        </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          {started ? <span>{fillResultsTemplate(t('results.item.started'), { time: started })}</span> : null}
          {finished ? <span>{fillResultsTemplate(t('results.item.finished'), { time: finished })}</span> : null}
        </span>
      </button>
    </li>
  );
}

function ResultsFiltersForm({
  t,
  filters,
  workflows,
  onApply,
}: {
  t: (key: string) => string;
  filters: ResultsFilters;
  workflows: ResultsWorkflowOption[];
  onApply: (filters: ResultsFilters) => void;
}) {
  const [rangeError, setRangeError] = React.useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const status = String(data.get('status') ?? '');
    const next: ResultsFilters = {
      status: isResultsStatusFilter(status) ? status : '',
      workflowId: String(data.get('workflowId') ?? ''),
      from: String(data.get('from') ?? ''),
      to: String(data.get('to') ?? ''),
    };
    if (resultsDateRangeInvalid(next)) {
      setRangeError(true);
      return;
    }
    setRangeError(false);
    onApply(next);
  }

  const active = resultsFiltersActive(filters);
  const key = `${filters.status}|${filters.workflowId}|${filters.from}|${filters.to}`;
  return (
    <form
      key={key}
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-4 sm:px-5"
      aria-labelledby="results-filters-title"
      data-testid="results-filters"
    >
      <h2 id="results-filters-title" className="flex items-center gap-2 text-xs font-medium text-slate-300">
        <FunnelIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
        {t('results.filters.label')}
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block min-w-0 text-xs font-medium text-slate-300">
          {t('results.filters.status')}
          <select name="status" defaultValue={filters.status} className={FIELD} data-testid="results-filter-status">
            <option value="">{t('results.filters.statusAll')}</option>
            {RESULTS_STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {t(resultStatusKey(status))}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 text-xs font-medium text-slate-300">
          {t('results.filters.workflow')}
          <select
            name="workflowId"
            defaultValue={filters.workflowId}
            className={FIELD}
            data-testid="results-filter-workflow"
          >
            <option value="">{t('results.filters.workflowAll')}</option>
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 text-xs font-medium text-slate-300">
          {t('results.filters.from')}
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className={FIELD}
            data-testid="results-filter-from"
          />
        </label>
        <label className="block min-w-0 text-xs font-medium text-slate-300">
          {t('results.filters.to')}
          <input type="date" name="to" defaultValue={filters.to} className={FIELD} data-testid="results-filter-to" />
        </label>
      </div>
      {rangeError ? (
        <p className="mt-3 text-sm text-red-200" role="alert" data-testid="results-filter-range-error">
          {t('results.filters.rangeError')}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className={PRIMARY_BUTTON} data-testid="results-filter-apply">
          {t('results.filters.apply')}
        </button>
        {active ? (
          <button
            type="button"
            className={RESULTS_QUIET_BUTTON}
            onClick={() => {
              setRangeError(false);
              onApply({ status: '', workflowId: '', from: '', to: '' });
            }}
            data-testid="results-filter-clear"
          >
            {t('results.filters.clear')}
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function ResultsListView(props: ResultsListViewProps): React.ReactElement {
  const { t, locale, phase, page, filters, workflows, onApplyFilters, onPage, onRetry, onOpen } = props;

  if (phase === 'forbidden') {
    return (
      <div
        className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-4"
        role="status"
        data-testid="results-forbidden"
      >
        <div className="flex items-start gap-2">
          <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{t('results.forbiddenTitle')}</p>
            <p className="mt-1 break-words text-sm text-slate-300">{t('results.forbiddenBody')}</p>
          </div>
        </div>
      </div>
    );
  }

  const pages = page ? resultsPageCount(page.total, page.pageSize) : 1;
  const current = page?.page ?? 1;
  const filtered = resultsFiltersActive(filters);

  return (
    <div className="flex flex-col gap-4">
      <ResultsFiltersForm t={t} filters={filters} workflows={workflows} onApply={onApplyFilters} />

      {phase === 'loading' ? (
        <div
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-sm text-slate-200"
          role="status"
          aria-busy="true"
          data-testid="results-loading"
        >
          <Spinner className="h-4 w-4 text-slate-300" />
          {t('results.loading')}
        </div>
      ) : null}

      {phase === 'error' ? (
        <div
          className="rounded-xl border border-red-700/40 bg-red-950/30 px-4 py-4"
          role="alert"
          data-testid="results-error"
        >
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden="true" />
            <p className="break-words text-sm text-red-100">{t('results.loadError')}</p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            data-testid="results-retry"
          >
            {t('results.retry')}
          </button>
        </div>
      ) : null}

      {phase === 'ready' && page && page.results.length === 0 ? (
        <div
          className="flex flex-col items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-6 sm:px-5"
          role="status"
          data-testid={filtered ? 'results-empty-filtered' : 'results-empty'}
        >
          <InboxIcon className="h-6 w-6 text-slate-500" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              {filtered ? t('results.emptyFilteredTitle') : t('results.emptyTitle')}
            </p>
            <p className="mt-1 max-w-prose break-words text-sm text-slate-300">
              {filtered ? t('results.emptyFilteredBody') : t('results.emptyBody')}
            </p>
          </div>
          {filtered ? null : (
            <Link
              href={`/${locale}/collaboration`}
              className={RESULTS_QUIET_BUTTON}
              data-testid="results-empty-team"
            >
              <UserGroupIcon className="h-4 w-4" aria-hidden="true" />
              {t('results.openTeam')}
            </Link>
          )}
        </div>
      ) : null}

      {phase === 'ready' && page && page.results.length > 0 ? (
        <>
          <ul className="flex flex-col gap-2" data-testid="results-list">
            {page.results.map((item) => (
              <ResultRow key={item.collaborationRunId} item={item} t={t} locale={locale} onOpen={onOpen} />
            ))}
          </ul>
          <nav
            className="flex flex-wrap items-center justify-between gap-3"
            aria-label={t('results.pager.label')}
            data-testid="results-pager"
          >
            <p className="text-xs text-slate-400" data-testid="results-pager-summary">
              {fillResultsTemplate(t('results.pager.summary'), {
                page: String(current),
                pages: String(pages),
                total: String(page.total),
              })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={RESULTS_QUIET_BUTTON}
                disabled={current <= 1}
                onClick={() => onPage(current - 1)}
                data-testid="results-pager-previous"
              >
                <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
                {t('results.pager.previous')}
              </button>
              <button
                type="button"
                className={RESULTS_QUIET_BUTTON}
                disabled={current >= pages}
                onClick={() => onPage(current + 1)}
                data-testid="results-pager-next"
              >
                {t('results.pager.next')}
                <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
