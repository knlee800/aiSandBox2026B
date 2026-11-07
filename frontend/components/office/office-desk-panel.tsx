'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRightIcon,
  BookOpenIcon,
  ClockIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { OfficeDeskPhase } from '@/lib/office/office.logic';

export interface OfficePanelRun {
  id: string;
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
    workspaceHref: string | null;
    openHref: string | null;
    profileHref: string;
  } | null;
  labels: OfficePanelLabels;
  onClose: () => void;
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

export default function OfficeDeskPanel({ desk, labels, onClose }: OfficeDeskPanelProps): React.ReactElement {
  if (!desk) {
    return (
      <aside
        className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-5"
        data-testid="office-desk-panel-empty"
      >
        <p className="text-sm text-slate-400">{labels.deskHint}</p>
      </aside>
    );
  }

  return (
    <aside
      className="rounded-2xl border border-slate-700 bg-slate-900 p-5"
      data-testid="office-desk-panel"
      data-desk-id={desk.id}
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

      {desk.vacant ? (
        <p className="mt-4 text-sm leading-relaxed text-slate-300">{labels.comingSoonBody}</p>
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
                  <li
                    key={run.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                    data-testid="office-recent-run"
                  >
                    <p className="text-sm font-medium text-white">{run.statusText}</p>
                    <RunFacts run={run} labels={labels} />
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
