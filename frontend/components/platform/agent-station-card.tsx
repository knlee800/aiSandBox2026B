'use client';

import type { AgentStatus } from '@/lib/agent-platform/agent-registry';

export interface AgentStationCardProps {
  id: string;
  name: string;
  role: string;
  description: string;
  status: AgentStatus;
  enabled: boolean;
  statusLabel: string;
  actionHint: string;
  selected: boolean;
  onSelect: (agentId: string) => void;
}

function getStatusBadgeClasses(status: AgentStatus): string {
  if (status === 'active') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
  if (status === 'coming_soon') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  return 'bg-gray-100 text-gray-500 border-gray-200';
}

function getCardClasses(enabled: boolean, selected: boolean): string {
  const base =
    'relative flex min-h-44 w-full flex-col rounded-xl border p-5 text-left shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

  const selectedState = selected
    ? 'border-indigo-300 bg-indigo-50/70 shadow-md ring-1 ring-indigo-200'
    : '';

  if (enabled) {
    return `${base} border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md ${selectedState}`;
  }

  return `${base} border-gray-200 bg-gray-50/80 text-gray-700 hover:border-amber-300 hover:bg-amber-50/40 ${selectedState}`;
}

function getAvatarClasses(enabled: boolean): string {
  const base =
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-lg font-bold tracking-tight';
  if (enabled) {
    return `${base} border-indigo-200 bg-indigo-50 text-indigo-700`;
  }
  return `${base} border-gray-200 bg-gray-100 text-gray-400`;
}

export default function AgentStationCard(props: AgentStationCardProps) {
  const { name, role, description, status, enabled, statusLabel, actionHint, selected, onSelect } = props;

  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();

  const cardContent = (
    <>
      <div className="flex items-start gap-4">
        <div className={getAvatarClasses(enabled)} aria-hidden="true">
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">
              {name}
            </h3>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight ${getStatusBadgeClasses(status)}`}
            >
              {status === 'active' && (
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              )}
              {statusLabel}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs font-medium text-gray-500">
            {role}
          </p>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-gray-600">
        {description}
      </p>

      <p className="mt-4 text-xs font-medium text-indigo-700">
        {actionHint}
      </p>
    </>
  );

  return (
    <button
      type="button"
      className={`${getCardClasses(enabled, selected)} cursor-pointer`}
      data-testid={`agent-station-card-${props.id}`}
      data-status={status}
      data-enabled={enabled}
      onClick={() => onSelect(props.id)}
      aria-pressed={selected}
      aria-describedby={`agent-station-hint-${props.id}`}
    >
      {cardContent}
      <span id={`agent-station-hint-${props.id}`} className="sr-only">
        {actionHint}
      </span>
    </button>
  );
}
