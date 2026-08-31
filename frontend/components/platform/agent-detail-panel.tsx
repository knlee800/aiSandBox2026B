'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRightIcon,
  ClockIcon,
  RocketLaunchIcon,
  SparklesIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  canSubmitUserAgentDelete,
  nextUserAgentDeletePhase,
  shouldShowUserAgentDeleteControl,
  type UserAgentDeletePhase,
} from '@/hooks/useUserAgents';

export interface AgentDetailViewModel {
  id: string;
  name: string;
  role: string;
  description: string;
  statusLabel: string;
  intent: string;
  capabilities: string[];
  isBuilder: boolean;
  isComingSoon: boolean;
  isUserCreated?: boolean;
}

export interface AgentDetailPanelProps {
  agent: AgentDetailViewModel | null;
  localePrefix: string;
  title: string;
  subtitle: string;
  intentLabel: string;
  capabilitiesLabel: string;
  closeLabel: string;
  emptyTitle: string;
  emptyBody: string;
  startBuildingLabel: string;
  askButtonLabel: string;
  comingSoonLabel: string;
  comingSoonBody: string;
  deleteButtonLabel: string;
  deleteConfirmTitle: string;
  deleteConfirmBody: string;
  deleteConfirmActionLabel: string;
  deleteCancelLabel: string;
  deletingLabel: string;
  deleteErrorMessage: string | null;
  deletePending: boolean;
  onDelete: (agentId: string) => void;
  onClose: () => void;
}

export default function AgentDetailPanel(props: AgentDetailPanelProps) {
  const {
    agent,
    localePrefix,
    title,
    subtitle,
    intentLabel,
    capabilitiesLabel,
    closeLabel,
    emptyTitle,
    emptyBody,
    startBuildingLabel,
    askButtonLabel,
    comingSoonLabel,
    comingSoonBody,
    deleteButtonLabel,
    deleteConfirmTitle,
    deleteConfirmBody,
    deleteConfirmActionLabel,
    deleteCancelLabel,
    deletingLabel,
    deleteErrorMessage,
    deletePending,
    onDelete,
    onClose,
  } = props;
  const [deletePhase, setDeletePhase] = useState<UserAgentDeletePhase>('idle');

  useEffect(() => {
    setDeletePhase('idle');
  }, [agent?.id]);

  useEffect(() => {
    if (deletePending) {
      setDeletePhase((current) => nextUserAgentDeletePhase(current, 'confirm'));
      return;
    }
    setDeletePhase((current) => (current === 'pending' ? nextUserAgentDeletePhase(current, 'settled') : current));
  }, [deletePending]);

  if (!agent) {
    return (
      <aside
        className="rounded-2xl border border-dashed border-gray-300 bg-white/70 p-5"
        data-testid="agent-detail-panel-empty"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <SparklesIcon className="h-4 w-4" aria-hidden="true" />
          <span>{emptyTitle}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">{emptyBody}</p>
      </aside>
    );
  }

  const statusBadgeClass = agent.isComingSoon
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : agent.isUserCreated
      ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <aside
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      data-testid={`agent-detail-panel-${agent.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{title}</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">{agent.name}</h2>
          <p className="text-sm text-gray-500">{agent.role}</p>
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          onClick={onClose}
          aria-label={closeLabel}
          data-testid="agent-detail-close"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-gray-700">{agent.description}</p>

      <div className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass}`}>
        {agent.isComingSoon ? (
          <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <RocketLaunchIcon className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span>{agent.statusLabel}</span>
      </div>

      <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{intentLabel}</p>
        <p className="mt-1 text-sm text-gray-700">{agent.intent}</p>
      </div>

      <div className="mt-5">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
          <WrenchScrewdriverIcon className="h-4 w-4" aria-hidden="true" />
          {capabilitiesLabel}
        </p>
        <ul className="mt-2 space-y-2 text-sm text-gray-700">
          {agent.capabilities.map((capability) => (
            <li key={capability} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
              <span>{capability}</span>
            </li>
          ))}
        </ul>
      </div>

      {agent.isBuilder ? (
        <Link
          href={`${localePrefix}/app`}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          data-testid="agent-detail-start-building"
        >
          <span>{startBuildingLabel}</span>
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : agent.isUserCreated ? (
        <div data-testid="agent-detail-user-created">
          <Link
            href={`${localePrefix}/app?userAgentId=${encodeURIComponent(agent.id)}`}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            data-testid="agent-detail-ask"
          >
            <span>{askButtonLabel}</span>
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
          {shouldShowUserAgentDeleteControl(agent.isUserCreated) ? (
            <div className="mt-3">
              {deletePhase === 'idle' ? (
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-[transform,background-color,color] duration-150 ease-out hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-[0.97]"
                  onClick={() => setDeletePhase((current) => nextUserAgentDeletePhase(current, 'open'))}
                  data-testid="agent-detail-delete"
                >
                  <TrashIcon className="h-4 w-4" aria-hidden="true" />
                  <span>{deleteButtonLabel}</span>
                </button>
              ) : (
                <div
                  className="rounded-lg border border-red-200 bg-red-50/80 p-4"
                  data-testid="agent-detail-delete-confirm-panel"
                >
                  <p className="text-sm font-semibold text-red-800">{deleteConfirmTitle}</p>
                  <p className="mt-1 text-sm leading-relaxed text-red-700">{deleteConfirmBody}</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row-reverse">
                    <button
                      type="button"
                      className="inline-flex flex-1 items-center justify-center rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white transition-[transform,background-color] duration-150 ease-out hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-red-300"
                      onClick={() => {
                        if (!canSubmitUserAgentDelete(deletePhase) || deletePending) {
                          return;
                        }
                        setDeletePhase((current) => nextUserAgentDeletePhase(current, 'confirm'));
                        onDelete(agent.id);
                      }}
                      disabled={!canSubmitUserAgentDelete(deletePhase) || deletePending}
                      data-testid="agent-detail-delete-confirm"
                    >
                      {deletePending ? deletingLabel : deleteConfirmActionLabel}
                    </button>
                    <button
                      type="button"
                      className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-[transform,background-color] duration-150 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:text-gray-400"
                      onClick={() => setDeletePhase((current) => nextUserAgentDeletePhase(current, 'cancel'))}
                      disabled={deletePending}
                      data-testid="agent-detail-delete-cancel"
                    >
                      {deleteCancelLabel}
                    </button>
                  </div>
                </div>
              )}
              {deleteErrorMessage ? (
                <p className="mt-2 text-sm text-red-700" data-testid="agent-detail-delete-error" role="alert">
                  {deleteErrorMessage}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800">
            <ClockIcon className="h-4 w-4" aria-hidden="true" />
            <span>{comingSoonLabel}</span>
          </p>
          <p className="mt-1 text-sm text-amber-700">{comingSoonBody}</p>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500">{subtitle}</p>
    </aside>
  );
}
