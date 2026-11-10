'use client';

import React from 'react';
import { BookOpenIcon, ClockIcon } from '@heroicons/react/24/outline';
import OfficeDeskArt from '@/components/office/office-art';
import type { OfficeDeskPhase } from '@/lib/office/office.logic';

export interface OfficeDeskProps {
  id: string;
  name: string;
  role: string;
  initials: string;
  phase: OfficeDeskPhase;
  statusText: string;
  timeText: string | null;
  selected: boolean;
  muted: boolean;
  vacant: boolean;
  hint: string;
  badge: string | null;
  handoffBadge: string | null;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
}

function statusClass(phase: OfficeDeskPhase): string {
  if (phase === 'working') {
    return 'text-emerald-300';
  }
  if (phase === 'queued' || phase === 'stopping') {
    return 'text-amber-300';
  }
  if (phase === 'failed' || phase === 'timedOut') {
    return 'text-red-300';
  }
  if (phase === 'vacant') {
    return 'text-slate-500';
  }
  return 'text-slate-300';
}

export default function OfficeDesk(props: OfficeDeskProps): React.ReactElement {
  const {
    id,
    name,
    role,
    initials,
    phase,
    statusText,
    timeText,
    selected,
    muted,
    vacant,
    hint,
    badge,
    handoffBadge,
    reducedMotion,
    onSelect,
  } = props;

  const spokenBadges = [badge, handoffBadge].filter((text): text is string => Boolean(text));
  const accessibleName =
    spokenBadges.length > 0 ? `${name}. ${spokenBadges.join('. ')}. ${hint}` : `${name}. ${hint}`;

  const selectedClass = selected
    ? 'border-indigo-400 bg-slate-900 ring-2 ring-indigo-400'
    : 'border-slate-700 bg-slate-900/80 hover:border-indigo-500';
  const mutedClass = muted ? 'opacity-70' : '';
  const vacantClass = vacant ? 'border-dashed' : '';

  return (
    <button
      type="button"
      className={`flex min-h-44 w-full flex-col rounded-xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${selectedClass} ${mutedClass} ${vacantClass}`}
      data-testid={`office-desk-${id}`}
      data-phase={phase}
      data-kind={vacant ? 'vacant' : 'occupied'}
      data-muted={muted ? 'true' : 'false'}
      aria-pressed={selected}
      aria-label={accessibleName}
      onClick={() => onSelect(id)}
    >
      <OfficeDeskArt phase={phase} reducedMotion={reducedMotion} />
      <div className="mt-3 flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-indigo-400/40 bg-indigo-500/10 text-sm font-semibold text-indigo-200"
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white">{name}</h3>
          {role ? <p className="truncate text-xs text-slate-400">{role}</p> : null}
        </div>
      </div>
      <p className={`mt-3 text-xs font-medium ${statusClass(phase)}`}>{statusText}</p>
      {badge ? (
        <p
          className="mt-2 inline-flex w-fit items-center gap-1 rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-200"
          data-testid="office-knowledge-badge"
        >
          <BookOpenIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {badge}
        </p>
      ) : null}
      {handoffBadge ? (
        <p
          className="mt-2 inline-flex w-fit max-w-full items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-200"
          data-testid="office-handoff-badge"
        >
          <ClockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{handoffBadge}</span>
        </p>
      ) : null}
      {timeText ? <p className="mt-1 text-xs text-slate-400">{timeText}</p> : null}
    </button>
  );
}
