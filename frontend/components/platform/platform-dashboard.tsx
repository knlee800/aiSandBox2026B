'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  SignalIcon,
  Squares2X2Icon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { listAgents } from '@/lib/agent-platform/agent-registry';
import type { AgentStatus } from '@/lib/agent-platform/agent-registry';
import AgentStationCard from './agent-station-card';
import AgentDetailPanel from './agent-detail-panel';
import type { AgentDetailViewModel } from './agent-detail-panel';

import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';

type LocaleMessages = Record<string, unknown>;

function getLocaleMessages(locale?: string): LocaleMessages {
  if (locale === 'zh-TW') return zhTwMessages as LocaleMessages;
  if (locale === 'zh-CN') return zhCnMessages as LocaleMessages;
  return enMessages as LocaleMessages;
}

function resolveNestedMessage(
  source: LocaleMessages,
  fullKey: string,
): string {
  const keys = fullKey.split('.');
  let value: unknown = source;

  for (const keyPart of keys) {
    if (value && typeof value === 'object' && keyPart in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[keyPart];
    } else {
      return fullKey;
    }
  }

  return typeof value === 'string' ? value : fullKey;
}

function getStatusLabel(
  status: AgentStatus,
  messages: LocaleMessages,
): string {
  if (status === 'active') return resolveNestedMessage(messages, 'platform.agentStationActive');
  if (status === 'coming_soon') return resolveNestedMessage(messages, 'platform.agentStationComingSoon');
  return resolveNestedMessage(messages, 'platform.agentStationDisabled');
}

export interface PlatformDashboardProps {
  locale?: string;
}

export default function PlatformDashboard({ locale }: PlatformDashboardProps) {
  const router = useRouter();
  const messages = getLocaleMessages(locale);
  const agents = listAgents();
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);
  const [authReady, setAuthReady] = React.useState(false);
  const resolvedLocale = locale ?? 'en';

  const title = resolveNestedMessage(messages, 'platform.title');
  const subtitle = resolveNestedMessage(messages, 'platform.subtitle');
  const backToWorkspace = resolveNestedMessage(messages, 'platform.backToWorkspace');
  const commandDeckLabel = resolveNestedMessage(messages, 'platform.commandDeckLabel');
  const commandDeckIntro = resolveNestedMessage(messages, 'platform.commandDeckIntro');
  const statusTitle = resolveNestedMessage(messages, 'platform.commandCenterStatusTitle');
  const statusBody = resolveNestedMessage(messages, 'platform.commandCenterStatusBody');
  const stationsTitle = resolveNestedMessage(messages, 'platform.stationsTitle');
  const stationsSubtitle = resolveNestedMessage(messages, 'platform.stationsSubtitle');
  const detailLabel = resolveNestedMessage(messages, 'platform.detail.title');
  const detailSubtitle = resolveNestedMessage(messages, 'platform.detail.subtitle');
  const detailIntentLabel = resolveNestedMessage(messages, 'platform.detail.intentLabel');
  const detailCapabilitiesLabel = resolveNestedMessage(messages, 'platform.detail.capabilitiesLabel');
  const detailCloseLabel = resolveNestedMessage(messages, 'platform.detail.close');
  const detailEmptyTitle = resolveNestedMessage(messages, 'platform.detail.emptyTitle');
  const detailEmptyBody = resolveNestedMessage(messages, 'platform.detail.emptyBody');
  const detailStartBuilding = resolveNestedMessage(messages, 'platform.detail.startBuilding');
  const detailComingSoonTitle = resolveNestedMessage(messages, 'platform.detail.comingSoonTitle');
  const detailComingSoonBody = resolveNestedMessage(messages, 'platform.detail.comingSoonBody');
  const builderIntent = resolveNestedMessage(messages, 'platform.detail.builderIntent');
  const placeholderIntent = resolveNestedMessage(messages, 'platform.detail.placeholderIntent');
  const openAgentDetailActive = resolveNestedMessage(messages, 'platform.openAgentDetailActive');
  const openAgentDetailComingSoon = resolveNestedMessage(messages, 'platform.openAgentDetailComingSoon');
  const activeStationsLabel = resolveNestedMessage(messages, 'platform.activeStationsLabel');
  const reserveStationsLabel = resolveNestedMessage(messages, 'platform.reserveStationsLabel');
  const selectedStationLabel = resolveNestedMessage(messages, 'platform.selectedStationLabel');
  const noStationSelected = resolveNestedMessage(messages, 'platform.noStationSelected');
  const loadingLabel = resolveNestedMessage(messages, 'common.loading');

  React.useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          router.replace(`/${resolvedLocale}/login`);
          return;
        }

        const payload = (await response.json()) as { id?: unknown };
        if (typeof payload.id !== 'string' || !payload.id.trim()) {
          router.replace(`/${resolvedLocale}/login`);
          return;
        }

        if (isMounted) {
          setAuthReady(true);
        }
      } catch {
        router.replace(`/${resolvedLocale}/login`);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [resolvedLocale, router]);

  const localePrefix = locale ? `/${locale}` : '';
  const activeAgents = agents.filter((agent) => agent.enabled).length;
  const reserveAgents = agents.length - activeAgents;

  const selectedAgent = selectedAgentId
    ? agents.find((agent) => agent.id === selectedAgentId) ?? null
    : null;

  const selectedAgentDetail: AgentDetailViewModel | null = selectedAgent
    ? {
        id: selectedAgent.id,
        name: resolveNestedMessage(messages, selectedAgent.nameKey),
        role: resolveNestedMessage(messages, selectedAgent.roleKey),
        description: resolveNestedMessage(messages, selectedAgent.descriptionKey),
        statusLabel: getStatusLabel(selectedAgent.status, messages),
        intent: selectedAgent.enabled ? builderIntent : placeholderIntent,
        capabilities: selectedAgent.enabled
          ? [
              resolveNestedMessage(messages, 'platform.detail.builderCapabilityOne'),
              resolveNestedMessage(messages, 'platform.detail.builderCapabilityTwo'),
              resolveNestedMessage(messages, 'platform.detail.builderCapabilityThree'),
            ]
          : [
              resolveNestedMessage(messages, 'platform.detail.placeholderCapabilityOne'),
              resolveNestedMessage(messages, 'platform.detail.placeholderCapabilityTwo'),
              resolveNestedMessage(messages, 'platform.detail.placeholderCapabilityThree'),
            ],
        isBuilder: selectedAgent.id === 'builder',
        isComingSoon: selectedAgent.status === 'coming_soon',
      }
    : null;

  if (!authReady) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-slate-950 px-6"
        data-testid="platform-auth-loading"
      >
        <p className="text-sm font-medium text-slate-200">{loadingLabel}</p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-950"
      data-testid="platform-dashboard"
    >
      <header className="border-b border-slate-800 bg-slate-950 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/90 text-white">
              <BuildingOffice2Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-300">
                {commandDeckLabel}
              </p>
              <h1 className="text-lg font-semibold text-white">{title}</h1>
              <p className="text-sm text-slate-300">{subtitle}</p>
            </div>
          </div>
          <Link
            href={`${localePrefix}/app`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            data-testid="platform-back-to-workspace"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            {backToWorkspace}
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <section className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 px-4 py-5 sm:px-6">
            <p className="max-w-3xl text-sm leading-relaxed text-slate-200">{commandDeckIntro}</p>
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <div className="flex items-start gap-2">
                <SignalIcon className="mt-0.5 h-4 w-4 text-indigo-300" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-white">{statusTitle}</p>
                  <p className="mt-1 text-sm text-slate-300">{statusBody}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-300">{activeStationsLabel}</p>
                  <p className="mt-1 text-xl font-semibold text-white">{activeAgents}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-300">{reserveStationsLabel}</p>
                  <p className="mt-1 text-xl font-semibold text-white">{reserveAgents}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-300">{selectedStationLabel}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">
                    {selectedAgent
                      ? resolveNestedMessage(messages, selectedAgent.nameKey)
                      : noStationSelected}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
              <div className="mb-4 flex items-start gap-2">
                <Squares2X2Icon className="mt-0.5 h-4 w-4 text-indigo-300" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                    {stationsTitle}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">{stationsSubtitle}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {agents.map((agent) => (
                  <AgentStationCard
                    key={agent.id}
                    id={agent.id}
                    name={resolveNestedMessage(messages, agent.nameKey)}
                    role={resolveNestedMessage(messages, agent.roleKey)}
                    description={resolveNestedMessage(messages, agent.descriptionKey)}
                    status={agent.status}
                    enabled={agent.enabled}
                    statusLabel={getStatusLabel(agent.status, messages)}
                    selected={selectedAgentId === agent.id}
                    onSelect={setSelectedAgentId}
                    actionHint={agent.enabled ? openAgentDetailActive : openAgentDetailComingSoon}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 text-slate-200">
                <UserCircleIcon className="h-5 w-5 text-indigo-300" aria-hidden="true" />
                <h2 className="text-sm font-semibold uppercase tracking-wide">{detailLabel}</h2>
              </div>
              <AgentDetailPanel
                agent={selectedAgentDetail}
                localePrefix={localePrefix}
                title={detailLabel}
                subtitle={detailSubtitle}
                intentLabel={detailIntentLabel}
                capabilitiesLabel={detailCapabilitiesLabel}
                closeLabel={detailCloseLabel}
                emptyTitle={detailEmptyTitle}
                emptyBody={detailEmptyBody}
                startBuildingLabel={detailStartBuilding}
                comingSoonLabel={detailComingSoonTitle}
                comingSoonBody={detailComingSoonBody}
                onClose={() => setSelectedAgentId(null)}
              />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
