'use client';

import React from 'react';
import { ArrowLeftIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import Spinner from '@/components/ui/Spinner';
import {
  collaborationFailureReason,
  collaborationProviderUsageLimitCopy,
  collaborationScopeLabel,
  formatCollaborationSource,
} from '@/lib/collaboration/logic';
import { RESULTS_QUIET_BUTTON, ResultStatusPill, ResultTestRunBadge } from './results-list';
import { fillResultsTemplate, formatResultTime, resultTitle } from './results.logic';
import type { ResultDetailState } from './use-results';

export interface ResultDetailViewProps {
  t: (key: string) => string;
  locale: string;
  state: ResultDetailState;
  onBack: () => void;
  onRetry: () => void;
}

function MetaRow({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-xs font-medium text-slate-400 sm:w-28">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-slate-100" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

export function ResultDetailView({ t, locale, state, onBack, onRetry }: ResultDetailViewProps): React.ReactElement {
  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className={`${RESULTS_QUIET_BUTTON} self-start`}
      data-testid="results-detail-back"
      autoFocus={state.phase !== 'loading'}
    >
      <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
      {t('results.detail.back')}
    </button>
  );

  if (state.phase === 'loading') {
    return (
      <div className="flex flex-col gap-4" data-testid="results-detail">
        {backButton}
        <div
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-sm text-slate-200"
          role="status"
          aria-busy="true"
          data-testid="results-detail-loading"
        >
          <Spinner className="h-4 w-4 text-slate-300" />
          {t('results.detail.loading')}
        </div>
      </div>
    );
  }

  if (state.phase === 'not_found') {
    return (
      <div className="flex flex-col gap-4" data-testid="results-detail">
        {backButton}
        <div
          className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-4"
          role="status"
          data-testid="results-detail-not-found"
        >
          <div className="flex items-start gap-2">
            <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            <p className="break-words text-sm text-slate-200">{t('results.detail.notFound')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'error' || !state.detail) {
    return (
      <div className="flex flex-col gap-4" data-testid="results-detail">
        {backButton}
        <div
          className="rounded-xl border border-red-700/40 bg-red-950/30 px-4 py-4"
          role="alert"
          data-testid="results-detail-error"
        >
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden="true" />
            <p className="break-words text-sm text-red-100">{t('results.detail.loadError')}</p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-950 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            data-testid="results-detail-retry"
          >
            {t('results.retry')}
          </button>
        </div>
      </div>
    );
  }

  const detail = state.detail;
  const title = resultTitle(detail, t);
  const started = formatResultTime(detail.createdAt, locale);
  const finished = formatResultTime(detail.finishedAt, locale);
  const scopeLabel = (scopeId: string) => collaborationScopeLabel(scopeId, t(`knowledge.scopes.${scopeId}`));

  return (
    <div className="flex flex-col gap-4" data-testid="results-detail">
      {backButton}
      <article
        className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-5 sm:px-6"
        aria-labelledby="results-detail-title"
        data-testid="results-detail-ready"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 id="results-detail-title" className="min-w-0 break-words text-base font-semibold text-white">
            {title}
          </h2>
          <ResultStatusPill status={detail.status} t={t} />
          {detail.workflow?.testRun ? <ResultTestRunBadge t={t} /> : null}
        </div>

        <dl className="mt-4 flex flex-col gap-2" data-testid="results-detail-meta">
          {started ? (
            <MetaRow label={t('results.detail.started')} value={started} testId="results-detail-started" />
          ) : null}
          <MetaRow
            label={t('results.detail.finished')}
            value={finished ?? t('results.detail.notFinished')}
            testId="results-detail-finished"
          />
        </dl>

        {detail.task ? (
          <section className="mt-5 min-w-0" data-testid="results-detail-task">
            <h3 className="text-xs font-medium text-slate-400">{t('results.detail.task')}</h3>
            <pre className="mt-1 max-w-full whitespace-pre-wrap break-words font-sans text-sm text-slate-200">
              {detail.task}
            </pre>
          </section>
        ) : null}

        <section className="mt-5 min-w-0">
          <h3 className="text-xs font-medium text-slate-400">{t('results.detail.answer')}</h3>
          {detail.answer !== null ? (
            <pre
              className="mt-1 max-h-[60vh] max-w-full overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950 p-3 font-sans text-sm leading-relaxed text-slate-100"
              data-testid="results-detail-answer"
            >
              {detail.answer}
            </pre>
          ) : (
            <p className="mt-1 text-sm italic text-slate-400" data-testid="results-detail-no-answer">
              {t('results.detail.noAnswer')}
            </p>
          )}
        </section>

        {detail.answer !== null &&
        (detail.sources.length > 0 || detail.showUnsourced || detail.droppedSourceCount > 0) ? (
          <section className="mt-4 min-w-0" data-testid="results-detail-sources">
            {detail.sources.length > 0 ? (
              <>
                <h3 className="text-xs font-medium text-slate-400">{t('results.detail.sources')}</h3>
                <ul className="mt-1 space-y-1">
                  {detail.sources.map((source, index) => (
                    <li
                      key={`${source.documentId}-${index}`}
                      className="break-words text-sm text-slate-200"
                      data-testid={`results-detail-source-${index}`}
                    >
                      {formatCollaborationSource({
                        title: source.title,
                        scopeLabel: scopeLabel(source.scopeId),
                        heading: source.heading,
                      })}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {detail.showUnsourced ? (
              <p className="mt-1 text-sm font-medium text-amber-300" data-testid="results-detail-unsourced">
                {t('results.detail.unsourced')}
              </p>
            ) : null}
            {detail.droppedSourceCount > 0 ? (
              <p className="mt-1 break-words text-sm text-slate-400" data-testid="results-detail-dropped-sources">
                {fillResultsTemplate(t('results.detail.droppedSources'), {
                  count: String(detail.droppedSourceCount),
                })}
              </p>
            ) : null}
          </section>
        ) : null}

        {detail.failureReason ? (
          <section
            className="mt-4 min-w-0 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-2"
            data-testid="results-detail-failure"
          >
            <h3 className="text-xs font-medium text-red-200">{t('results.detail.failure')}</h3>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-red-100">
              {collaborationFailureReason(detail.failureReason, collaborationProviderUsageLimitCopy(locale))}
            </p>
          </section>
        ) : null}
      </article>
    </div>
  );
}
