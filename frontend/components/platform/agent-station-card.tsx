'use client';

import React from 'react';
import Link from 'next/link';
import type { AgentStatus } from '@/lib/agent-platform/agent-registry';

export interface AgentStationCardProps {
  id: string;
  name: string;
  role: string;
  description: string;
  status: AgentStatus;
  enabled: boolean;
  statusLabel: string;
  href?: string;
  comingSoonMessage?: string;
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

function getCardClasses(enabled: boolean): string {
  const base =
    'relative flex flex-col rounded-xl border p-5 shadow-sm transition-all duration-150';
  if (enabled) {
    return `${base} border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`;
  }
  return `${base} border-gray-100 bg-gray-50/70 opacity-75 hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2`;
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
  const { name, role, description, status, enabled, statusLabel, href, comingSoonMessage } = props;
  const [showMessage, setShowMessage] = React.useState(false);

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

      {showMessage && comingSoonMessage && (
        <p
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"
          data-testid={`agent-coming-soon-message-${props.id}`}
        >
          {comingSoonMessage}
        </p>
      )}
    </>
  );

  if (enabled && href) {
    return (
      <Link
        href={href}
        className={getCardClasses(enabled)}
        data-testid={`agent-station-card-${props.id}`}
        data-status={status}
        data-enabled={enabled}
      >
        {cardContent}
      </Link>
    );
  }

  const isInteractive = !enabled && !!comingSoonMessage;

  return (
    <div
      className={`${getCardClasses(enabled)}${isInteractive ? ' cursor-pointer' : ''}`}
      data-testid={`agent-station-card-${props.id}`}
      data-status={status}
      data-enabled={enabled}
      onClick={isInteractive ? () => setShowMessage((prev) => !prev) : undefined}
      onKeyDown={
        isInteractive
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setShowMessage((prev) => !prev);
              }
            }
          : undefined
      }
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-expanded={isInteractive ? showMessage : undefined}
    >
      {cardContent}
    </div>
  );
}
