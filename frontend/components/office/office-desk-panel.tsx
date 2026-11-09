'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  officeRunDetailFocus,
  officeRunDetailKeyAction,
  type OfficeDeskPhase,
  type OfficeRunDetailPhase,
} from '@/lib/office/office.logic';

export interface OfficePanelRun {
  id: string;
  executionId: string | null;
  statusText: string;
  modeText: string;
  providerModel: string;
  startedText: string;
  durationText: string;
  tokensText: string;
}

export interface OfficePanelLabels {
  close: string;
  currentRun: string;
  recentRuns: string;
  noRuns: string;
  started: string;
  duration: string;
  tokens: string;
  outcomeUnknown: string;
  openWorkspace: string;
  openTeam: string;
  agentProfile: string;
  comingSoonBody: string;
  deskHint: string;
  openRun: string;
  backToRuns: string;
  savedOutput: string;
  runDetailLoading: string;
  runDetailEmpty: string;
  runDetailNotFound: string;
  runDetailError: string;
  retry: string;
}

export interface OfficeRunDetailState {
  executionId: string;
  phase: OfficeRunDetailPhase;
  output: string | null;
  summary: string | null;
}

export interface OfficeDeskPanelProps {
  desk: {
    id: string;
    name: string;
    role: string;
    phase: OfficeDeskPhase;
    statusText: string;
    vacant: boolean;
    current: OfficePanelRun | null;
    recent: OfficePanelRun[];
    showOutcome: boolean;
    knowledgeBadge: string | null;
    handoffBadge: string | null;
    workspaceHref: string | null;
    openHref: string | null;
    profileHref: string;
  } | null;
  labels: OfficePanelLabels;
  onClose: () => void;
  runDetail?: OfficeRunDetailState | null;
  onOpenRun?: (executionId: string) => void;
  onCloseRun?: () => void;
  onRetryRun?: () => void;
  reducedMotion?: boolean;
}

function statusClass(phase: OfficeDeskPhase): string {
  if (phase === 'working') {
    return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
  }
  if (phase === 'queued' || phase === 'stopping') {
    return 'border-amber-400/40 bg-amber-500/10 text-amber-200';
  }
  if (phase === 'failed' || phase === 'timedOut') {
    return 'border-red-400/40 bg-red-500/10 text-red-200';
  }
  if (phase === 'vacant') {
    return 'border-slate-600 bg-slate-800 text-slate-400';
  }
  return 'border-slate-600 bg-slate-800 text-slate-200';
}

function RunFacts(props: { run: OfficePanelRun; labels: OfficePanelLabels }) {
  const { run, labels } = props;
  return (
    <div className="mt-2 space-y-1 text-sm text-slate-200">
      <p>
        {run.modeText}
        <span className="text-slate-500"> · </span>
        {run.providerModel}
      </p>
      <p className="inline-flex items-center gap-1.5 text-slate-300">
        <ClockIcon className="h-4 w-4" aria-hidden="true" />
        <span>
          {labels.started} {run.startedText}
          <span className="text-slate-500"> · </span>
          {labels.duration} {run.durationText}
        </span>
      </p>
      <p className="text-slate-300">
        {labels.tokens} {run.tokensText}
      </p>
    </div>
  );
}

function RunDetail(props: {
  detail: OfficeRunDetailState;
  labels: OfficePanelLabels;
  reducedMotion: boolean;
  backRef: React.RefObject<HTMLButtonElement | null>;
  detailRef: React.RefObject<HTMLElement | null>;
  onCloseRun: () => void;
  onRetryRun: () => void;
}): React.ReactElement {
  const { detail, labels, reducedMotion, backRef, detailRef, onCloseRun, onRetryRun } = props;
  const output = detail.phase === 'output' ? detail.output : null;
  const showOutput = typeof output === 'string' && output.trim().length > 0;

  return (
    <section
      ref={detailRef}
      className="mt-5 min-w-0"
      data-testid="office-run-detail"
      data-phase={detail.phase}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      aria-busy={detail.phase === 'loading' ? true : undefined}
    >
      <button
        ref={backRef}
        type="button"
        autoFocus
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        onClick={onCloseRun}
        data-testid="office-run-detail-back"
      >
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
        {labels.backToRuns}
      </button>

      {detail.summary ? (
        <p className="mt-4 text-sm text-slate-300" data-testid="office-run-detail-summary">
          {detail.summary}
        </p>
      ) : null}

      {detail.phase === 'loading' ? (
        <p
          className="mt-4 text-sm font-medium text-slate-200"
          data-testid="office-run-detail-loading"
          aria-live="polite"
        >
          {labels.runDetailLoading}
        </p>
      ) : null}

      {showOutput ? (
        <>
          <h3
            id="office-saved-output"
            className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            {labels.savedOutput}
          </h3>
          <pre
            tabIndex={0}
            data-testid="office-run-detail-output"
            aria-labelledby="office-saved-output"
            className="mt-2 max-h-72 max-w-full overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-sans text-sm leading-relaxed text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {output}
          </pre>
        </>
      ) : null}

      {detail.phase === 'empty' || (detail.phase === 'output' && !showOutput) ? (
        <p
          className="mt-4 text-sm leading-relaxed text-slate-300"
          data-testid="office-run-detail-empty"
          aria-live="polite"
        >
          {labels.runDetailEmpty}
        </p>
      ) : null}

      {detail.phase === 'notFound' ? (
        <p
          className="mt-4 text-sm leading-relaxed text-slate-300"
          data-testid="office-run-detail-not-found"
          aria-live="polite"
        >
          {labels.runDetailNotFound}
        </p>
      ) : null}

      {detail.phase === 'error' ? (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-700/40 bg-red-950/30 px-4 py-3"
          data-testid="office-run-detail-error"
        >
          <ExclamationTriangleIcon className="h-4 w-4 text-red-300" aria-hidden="true" />
          <p className="text-sm text-red-200">{labels.runDetailError}</p>
          <button
            type="button"
            className="rounded-md text-sm font-medium text-indigo-300 hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            onClick={onRetryRun}
            data-testid="office-run-detail-retry"
          >
            {labels.retry}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default function OfficeDeskPanel({
  desk,
  labels,
  onClose,
  runDetail = null,
  onOpenRun,
  onCloseRun,
  onRetryRun,
  reducedMotion = false,
}: OfficeDeskPanelProps): React.ReactElement {
  const backRef = useRef<HTMLButtonElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const seenRunId = useRef<string | null>(null);
  const pendingReturnId = useRef<string | null>(null);

  useEffect(() => {
    const detailOpen = runDetail != null;
    const sameRun = detailOpen && seenRunId.current === runDetail.executionId;
    const focusLost =
      typeof document === 'undefined' ||
      document.activeElement == null ||
      document.activeElement === document.body;
    const action = officeRunDetailFocus({ detailOpen, sameRun, focusLost });
    seenRunId.current = detailOpen ? runDetail.executionId : null;
    if (action === 'stay') {
      return;
    }
    if (action === 'back') {
      backRef.current?.focus();
      return;
    }
    const returnId = pendingReturnId.current;
    pendingReturnId.current = null;
    if (!returnId || typeof document === 'undefined') {
      return;
    }
    const button = document.querySelector<HTMLElement>(
      `[data-execution-id="${CSS.escape(returnId)}"]`,
    );
    button?.focus();
  }, [runDetail?.executionId, runDetail?.phase]);

  if (!desk) {
    return (
      <aside
        className="min-w-0 rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-5"
        data-testid="office-desk-panel-empty"
      >
        <p className="text-sm text-slate-400">{labels.deskHint}</p>
      </aside>
    );
  }

  return (
    <aside
      className="min-w-0 rounded-2xl border border-slate-700 bg-slate-900 p-5"
      data-testid="office-desk-panel"
      data-desk-id={desk.id}
      onKeyDown={(event) => {
        if (officeRunDetailKeyAction(event.key, runDetail != null) !== 'back') {
          return;
        }
        event.preventDefault();
        onCloseRun?.();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-white">{desk.name}</h2>
          {desk.role ? <p className="truncate text-sm text-slate-400">{desk.role}</p> : null}
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          onClick={onClose}
          aria-label={labels.close}
          data-testid="office-close-panel"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p
        className={`mt-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusClass(desk.phase)}`}
        data-testid="office-panel-status"
      >
        {desk.statusText}
      </p>

      {desk.knowledgeBadge ? (
        <p
          className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200"
          data-testid="office-panel-knowledge-badge"
        >
          <BookOpenIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {desk.knowledgeBadge}
        </p>
      ) : null}

      {desk.handoffBadge ? (
        <p
          className="mt-3 inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200"
          data-testid="office-panel-handoff-badge"
        >
          <ClockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{desk.handoffBadge}</span>
        </p>
      ) : null}

      {desk.vacant ? (
        <p className="mt-4 text-sm leading-relaxed text-slate-300">{labels.comingSoonBody}</p>
      ) : runDetail ? (
        <RunDetail
          detail={runDetail}
          labels={labels}
          reducedMotion={reducedMotion}
          backRef={backRef}
          detailRef={detailRef}
          onCloseRun={() => onCloseRun?.()}
          onRetryRun={() => onRetryRun?.()}
        />
      ) : (
        <>
          {desk.current ? (
            <section className="mt-5" data-testid="office-current-run">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {labels.currentRun}
              </h3>
              <RunFacts run={desk.current} labels={labels} />
            </section>
          ) : null}

          {desk.recent.length > 0 ? (
            <section className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {labels.recentRuns}
              </h3>
              <ul className="mt-2 space-y-3">
                {desk.recent.map((run) => (
                  <li key={run.id}>
                    {run.executionId ? (
                      <button
                        type="button"
                        className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-left hover:border-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                        data-testid="office-recent-run"
                        data-execution-id={run.executionId}
                        onClick={() => {
                          pendingReturnId.current = run.executionId;
                          onOpenRun?.(run.executionId as string);
                        }}
                      >
                        <p className="text-sm font-medium text-white">{run.statusText}</p>
                        <RunFacts run={run} labels={labels} />
                        <span className="sr-only">{labels.openRun}</span>
                      </button>
                    ) : (
                      <div
                        className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                        data-testid="office-recent-run"
                      >
                        <p className="text-sm font-medium text-white">{run.statusText}</p>
                        <RunFacts run={run} labels={labels} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!desk.current && desk.recent.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400" data-testid="office-no-runs">
              {labels.noRuns}
            </p>
          ) : null}

          {desk.showOutcome ? (
            <p className="mt-4 text-sm leading-relaxed text-slate-300" data-testid="office-outcome-unknown">
              {labels.outcomeUnknown}
            </p>
          ) : null}
        </>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {desk.openHref ? (
          <Link
            href={desk.openHref}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            data-testid="office-open-team"
          >
            <span>{labels.openTeam}</span>
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
        {desk.workspaceHref ? (
          <Link
            href={desk.workspaceHref}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            data-testid="office-open-workspace"
          >
            <span>{labels.openWorkspace}</span>
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
        <Link
          href={desk.profileHref}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          data-testid="office-agent-profile"
        >
          <UserCircleIcon className="h-4 w-4" aria-hidden="true" />
          <span>{labels.agentProfile}</span>
        </Link>
      </div>
    </aside>
  );
}
