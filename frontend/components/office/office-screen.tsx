'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { listAgents, type AgentManifest } from '@/lib/agent-platform/agent-registry';
import { useTranslations } from '@/hooks/useTranslations';
import { useUserAgents } from '@/hooks/useUserAgents';
import { useOfficeRuns } from '@/hooks/useOfficeRuns';
import OfficeDeskCard from '@/components/office/office-desk';
import OfficeDeskPanel, {
  type OfficePanelLabels,
  type OfficePanelRun,
} from '@/components/office/office-desk-panel';
import { OFFICE_ART_MOTION_CSS } from '@/components/office/office-art';
import {
  buildOfficeDesks,
  deskShowsOutcome,
  deskTimeText,
  fillOfficeTemplate,
  formatDurationText,
  formatElapsedText,
  officeInitials,
  officeModeKey,
  officePlatformHref,
  officeProviderModel,
  officeRegistryFromManifests,
  officeStartedClock,
  officeTokensText,
  officeWorkspaceHref,
  phaseForRun,
  shouldPollOffice,
  type OfficeDesk,
  type OfficeDeskPhase,
  type OfficeRun,
  type OfficeUserAgentRef,
} from '@/lib/office/office.logic';

const PHASE_MESSAGE_KEY: Record<OfficeDeskPhase, string> = {
  vacant: 'status.vacant',
  idle: 'status.idle',
  queued: 'status.queued',
  working: 'status.working',
  stopping: 'status.stopping',
  done: 'status.done',
  failed: 'status.failed',
  stopped: 'status.stopped',
  timedOut: 'status.timedOut',
};

export interface OfficeScreenViewProps {
  t: (key: string) => string;
  resolveText: (key: string) => string;
  locale: string;
  loading: boolean;
  desks: readonly OfficeDesk[];
  userAgents: readonly OfficeUserAgentRef[];
  selectedDeskId: string | null;
  showEmpty: boolean;
  runsError: boolean;
  agentsError: boolean;
  stale: boolean;
  updatedAt: number | null;
  nowMs: number;
  reducedMotion: boolean;
  onSelectDesk: (id: string) => void;
  onClosePanel: () => void;
  onRefresh: () => void;
  onRetryRuns: () => void;
  onRetryAgents: () => void;
}

function statusLabel(phase: OfficeDeskPhase, t: (key: string) => string): string {
  return t(PHASE_MESSAGE_KEY[phase]);
}

export function OfficeScreenView(props: OfficeScreenViewProps): React.ReactElement {
  const {
    t,
    resolveText,
    locale,
    loading,
    desks,
    userAgents,
    selectedDeskId,
    showEmpty,
    runsError,
    agentsError,
    stale,
    updatedAt,
    nowMs,
    reducedMotion,
    onSelectDesk,
    onClosePanel,
    onRefresh,
    onRetryRuns,
    onRetryAgents,
  } = props;

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-slate-950 px-6"
        data-testid="office-loading"
      >
        <p className="text-sm font-medium text-slate-200">{t('loading')}</p>
      </div>
    );
  }

  const manifests = new Map<string, AgentManifest>(listAgents().map((agent) => [agent.id, agent]));
  const users = new Map(userAgents.map((agent) => [agent.id, agent]));

  function deskCopy(desk: OfficeDesk): { name: string; role: string } {
    if (desk.kind === 'team') {
      return {
        name: t('teamDesk'),
        role: desk.teamRole ? fillOfficeTemplate(t('teamRole'), { role: desk.teamRole }) : '',
      };
    }
    if (desk.kind === 'former') {
      return { name: t('formerAgents'), role: '' };
    }
    if (desk.kind === 'user' && desk.userAgentId) {
      const agent = users.get(desk.userAgentId);
      return {
        name: agent?.name ?? desk.userAgentId,
        role: agent?.role ?? '',
      };
    }
    const manifest = desk.registryId ? manifests.get(desk.registryId) : undefined;
    if (!manifest) {
      return { name: desk.id, role: '' };
    }
    return {
      name: resolveText(manifest.nameKey),
      role: resolveText(manifest.roleKey),
    };
  }

  function toPanelRun(run: OfficeRun, list: 'active' | 'recent', index: number): OfficePanelRun {
    const elapsed = list === 'active';
    return {
      id: `${run.executionId ?? 'run'}-${index}`,
      statusText: statusLabel(phaseForRun(run.status, list), t),
      modeText: t(`mode.${officeModeKey(run.mode)}`),
      providerModel: officeProviderModel(run),
      startedText: officeStartedClock(run.startedAt, locale),
      durationText: elapsed
        ? formatElapsedText(run.startedAt, nowMs)
        : formatDurationText(run.durationMs),
      tokensText: officeTokensText(run.tokensUsed),
    };
  }

  const selected = desks.find((desk) => desk.id === selectedDeskId) ?? null;
  const selectedCopy = selected ? deskCopy(selected) : null;
  const panelLabels: OfficePanelLabels = {
    close: t('closePanel'),
    currentRun: t('currentRun'),
    recentRuns: t('recentRuns'),
    noRuns: t('noRuns'),
    started: t('started'),
    duration: t('duration'),
    tokens: t('tokens'),
    outcomeUnknown: t('outcomeUnknown'),
    openWorkspace: t('openWorkspace'),
    agentProfile: t('agentProfile'),
    comingSoonBody: t('comingSoonBody'),
    deskHint: t('deskHint'),
  };
  const updatedSeconds =
    updatedAt == null ? null : Math.max(0, Math.floor((nowMs - updatedAt) / 1000));

  return (
    <div className="flex min-h-screen flex-col bg-slate-950" data-testid="office-screen">
      <style>{OFFICE_ART_MOTION_CSS}</style>
      <header className="border-b border-slate-800 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/90 text-white">
              <BuildingOffice2Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">{t('title')}</h1>
              <p className="text-sm text-slate-300">{t('subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {updatedSeconds !== null ? (
              <p className="text-sm text-slate-300" data-testid="office-updated" data-stale={stale ? 'true' : 'false'}>
                {fillOfficeTemplate(t('updatedAgo'), { seconds: String(updatedSeconds) })}
              </p>
            ) : null}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              onClick={onRefresh}
              data-testid="office-refresh"
            >
              <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
              {t('refresh')}
            </button>
            <Link
              href={officePlatformHref(locale)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              data-testid="office-back-to-platform"
            >
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              {t('backToPlatform')}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section data-testid="office-floor">
            {showEmpty ? (
              <div
                className="mb-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-4"
                data-testid="office-empty"
              >
                <p className="text-sm font-medium text-white">{t('emptyTitle')}</p>
                <p className="mt-1 text-sm text-slate-300">{t('emptyBody')}</p>
                <Link
                  href={officePlatformHref(locale)}
                  className="mt-3 inline-flex text-sm font-medium text-indigo-300 hover:text-indigo-200"
                  data-testid="office-empty-platform"
                >
                  {t('backToPlatform')}
                </Link>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {desks.map((desk) => {
                const copy = deskCopy(desk);
                const label = statusLabel(desk.phase, t);
                return (
                  <OfficeDeskCard
                    key={desk.id}
                    id={desk.id}
                    name={copy.name}
                    role={copy.role}
                    initials={officeInitials(copy.name)}
                    phase={desk.phase}
                    statusText={desk.isLastRun ? `${t('lastRun')}: ${label}` : label}
                    timeText={deskTimeText(desk, nowMs)}
                    selected={desk.id === selectedDeskId}
                    muted={desk.vacant || desk.kind === 'former'}
                    vacant={desk.vacant}
                    hint={t('deskHint')}
                    reducedMotion={reducedMotion}
                    onSelect={onSelectDesk}
                  />
                );
              })}
            </div>
          </section>

          <OfficeDeskPanel
            desk={
              selected && selectedCopy
                ? {
                    id: selected.id,
                    name: selectedCopy.name,
                    role: selectedCopy.role,
                    phase: selected.phase,
                    statusText: selected.isLastRun
                      ? `${t('lastRun')}: ${statusLabel(selected.phase, t)}`
                      : statusLabel(selected.phase, t),
                    vacant: selected.vacant,
                    current: selected.currentRun
                      ? toPanelRun(selected.currentRun, 'active', 0)
                      : null,
                    recent: selected.recentRuns.map((run, index) => toPanelRun(run, 'recent', index)),
                    showOutcome: deskShowsOutcome(selected),
                    workspaceHref: selected.vacant
                      ? null
                      : officeWorkspaceHref(locale, selected.userAgentId),
                    profileHref: officePlatformHref(locale),
                  }
                : null
            }
            labels={panelLabels}
            onClose={onClosePanel}
          />
        </div>
      </main>

      {runsError || agentsError ? (
        <div className="border-t border-slate-800 px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            {runsError ? (
              <div
                role="alert"
                className="flex flex-wrap items-center gap-3 rounded-lg border border-red-700/40 bg-red-950/30 px-4 py-3"
                data-testid="office-runs-error"
                data-stale={stale ? 'true' : 'false'}
              >
                {stale ? <span data-testid="office-stale" className="sr-only" /> : null}
                <ExclamationTriangleIcon className="h-4 w-4 text-red-300" aria-hidden="true" />
                <p className="text-sm text-red-200">{t('runsLoadError')}</p>
                <button
                  type="button"
                  className="text-sm font-medium text-indigo-300 hover:text-indigo-200"
                  onClick={onRetryRuns}
                  data-testid="office-runs-retry"
                >
                  {t('retry')}
                </button>
              </div>
            ) : null}
            {agentsError ? (
              <div
                role="alert"
                className="flex flex-wrap items-center gap-3 rounded-lg border border-red-700/40 bg-red-950/30 px-4 py-3"
                data-testid="office-agents-error"
              >
                <ExclamationTriangleIcon className="h-4 w-4 text-red-300" aria-hidden="true" />
                <p className="text-sm text-red-200">{t('agentsLoadError')}</p>
                <button
                  type="button"
                  className="text-sm font-medium text-indigo-300 hover:text-indigo-200"
                  onClick={onRetryAgents}
                  data-testid="office-agents-retry"
                >
                  {t('retry')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export interface OfficeScreenProps {
  locale: string;
}

export default function OfficeScreen({ locale }: OfficeScreenProps): React.ReactElement {
  const t = useTranslations('office');
  const resolveText = useTranslations();
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [selectedDeskId, setSelectedDeskId] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [poll, setPoll] = useState(false);
  const {
    agents: userAgents,
    loading: userAgentsLoading,
    error: userAgentsError,
    refetch: refetchUserAgents,
  } = useUserAgents();
  const runs = useOfficeRuns(authReady, poll);
  const registry = useMemo(() => officeRegistryFromManifests(listAgents()), []);
  const userRefs = useMemo<OfficeUserAgentRef[]>(
    () =>
      userAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        description: agent.description,
      })),
    [userAgents],
  );
  const desks = useMemo(
    () =>
      buildOfficeDesks({
        registry,
        userAgents: userRefs,
        activeRuns: runs.activeRuns,
        recentRuns: runs.recentRuns,
      }),
    [registry, userRefs, runs.activeRuns, runs.recentRuns],
  );

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          router.replace(`/${locale}/login`);
          return;
        }
        const payload = (await response.json()) as { id?: unknown };
        if (typeof payload.id !== 'string' || !payload.id.trim()) {
          router.replace(`/${locale}/login`);
          return;
        }
        if (isMounted) {
          setAuthReady(true);
        }
      } catch {
        router.replace(`/${locale}/login`);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [locale, router]);

  useEffect(() => {
    if (userAgentsError === 'AUTH_EXPIRED' || runs.error === 'AUTH_EXPIRED') {
      router.replace(`/${locale}/login`);
    }
  }, [userAgentsError, runs.error, locale, router]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setPoll(shouldPollOffice(desks.map((desk) => desk.phase)));
  }, [desks]);

  useEffect(() => {
    if (selectedDeskId && !desks.some((desk) => desk.id === selectedDeskId)) {
      setSelectedDeskId(null);
    }
  }, [desks, selectedDeskId]);

  const redirecting = runs.error === 'AUTH_EXPIRED' || userAgentsError === 'AUTH_EXPIRED';
  const loading = !authReady || redirecting || !runs.settled || userAgentsLoading;
  const showEmpty =
    !userAgentsError &&
    userRefs.length === 0 &&
    runs.error == null &&
    runs.activeRuns.length === 0 &&
    runs.recentRuns.length === 0;

  return (
    <OfficeScreenView
      t={t}
      resolveText={resolveText}
      locale={locale}
      loading={loading}
      desks={desks}
      userAgents={userRefs}
      selectedDeskId={selectedDeskId}
      showEmpty={showEmpty}
      runsError={runs.error === 'FETCH_FAILED'}
      agentsError={userAgentsError === 'FETCH_FAILED'}
      stale={runs.stale}
      updatedAt={runs.updatedAt}
      nowMs={nowMs}
      reducedMotion={reducedMotion}
      onSelectDesk={setSelectedDeskId}
      onClosePanel={() => setSelectedDeskId(null)}
      onRefresh={runs.refresh}
      onRetryRuns={runs.refresh}
      onRetryAgents={() => {
        void refetchUserAgents();
      }}
    />
  );
}
