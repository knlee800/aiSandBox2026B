'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  InboxIcon,
  LinkIcon,
  PlusIcon,
  SignalIcon,
  Squares2X2Icon,
  UserCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import type { AgentStatus, PublicSystemAgent } from '@/lib/agent-platform/agent-registry';
import { useSystemAgents, type SystemAgentsError } from '@/lib/agent-platform/use-system-agents';
import {
  useUserAgentOptions,
  useUserAgents,
  useWorkflowSummaries,
  userAgentSwitchBody,
} from '@/hooks/useUserAgents';
import type { UserAgent } from '@/hooks/useUserAgents';
import { nextSelectedUserAgentIdAfterDelete } from '@/hooks/useUserAgents';
import AgentStationCard from './agent-station-card';
import AgentDetailPanel from './agent-detail-panel';
import AgentWorkflowSummary, { workflowTestedNote, workflowUsageLine } from './agent-workflow-summary';
import type { WorkflowUsageView } from './agent-workflow-fields';
import type { AgentDetailViewModel } from './agent-detail-panel';
import CreateAgentForm from './create-agent-form';
import { loadUnreadCount } from '@/components/results/results-api';
import { unreadBadgeText } from '@/components/results/results.logic';
import type { CreateAgentFormLabels, WorkflowSaveRequest } from './create-agent-form';
import type { TemplatePrefill } from './agent-workflow-model';

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
  if (status === 'draft') return resolveNestedMessage(messages, 'platform.agentCreate.agentStatusDraft');
  return resolveNestedMessage(messages, 'platform.agentStationDisabled');
}

export function countStationsByStatus(agents: readonly { status: string }[]): {
  active: number;
  reserve: number;
} {
  const active = agents.filter((agent) => agent.status === 'active').length;
  return { active, reserve: agents.length - active };
}

export function stationCountsForLoad(
  loading: boolean,
  error: SystemAgentsError | null,
  agents: readonly { status: string }[],
): { active: number; reserve: number } | null {
  if (loading || error === 'AUTH_EXPIRED') {
    return null;
  }
  return countStationsByStatus(agents);
}

const BUSINESS_STATION_COPY: Record<
  string,
  { intent: string; capabilities: readonly [string, string, string] }
> = {
  'chief-of-staff': {
    intent: 'platform.detail.chiefOfStaffIntent',
    capabilities: [
      'platform.detail.chiefOfStaffCapabilityOne',
      'platform.detail.chiefOfStaffCapabilityTwo',
      'platform.detail.chiefOfStaffCapabilityThree',
    ],
  },
  'product-strategy': {
    intent: 'platform.detail.productStrategyIntent',
    capabilities: [
      'platform.detail.productStrategyCapabilityOne',
      'platform.detail.productStrategyCapabilityTwo',
      'platform.detail.productStrategyCapabilityThree',
    ],
  },
  'technology-advisor': {
    intent: 'platform.detail.technologyAdvisorIntent',
    capabilities: [
      'platform.detail.technologyAdvisorCapabilityOne',
      'platform.detail.technologyAdvisorCapabilityTwo',
      'platform.detail.technologyAdvisorCapabilityThree',
    ],
  },
};

export function staticAgentProfileContent(
  agent: { id: string; enabled: boolean; status: AgentStatus },
  text: (key: string) => string,
): {
  intent: string;
  capabilities: string[];
  isComingSoon: boolean;
  actionHint: string;
  cardEnabled: boolean;
  openPath: string | null;
} {
  const business = BUSINESS_STATION_COPY[agent.id];
  const builderStyle = agent.enabled && !business;
  const isComingSoon = agent.status === 'coming_soon';
  const cardEnabled = agent.status === 'active';
  if (business) {
    return {
      intent: text(business.intent),
      capabilities: business.capabilities.map((key) => text(key)),
      isComingSoon,
      actionHint: text('platform.openAgentDetailChiefOfStaff'),
      cardEnabled,
      openPath: '/collaboration',
    };
  }
  return {
    intent: builderStyle
      ? text('platform.detail.builderIntent')
      : text('platform.detail.placeholderIntent'),
    capabilities: builderStyle
      ? [
          text('platform.detail.builderCapabilityOne'),
          text('platform.detail.builderCapabilityTwo'),
          text('platform.detail.builderCapabilityThree'),
        ]
      : [
          text('platform.detail.placeholderCapabilityOne'),
          text('platform.detail.placeholderCapabilityTwo'),
          text('platform.detail.placeholderCapabilityThree'),
        ],
    isComingSoon,
    actionHint: builderStyle
      ? text('platform.openAgentDetailActive')
      : text('platform.openAgentDetailComingSoon'),
    cardEnabled,
    openPath: null,
  };
}

export function SystemAgentStationArea(props: {
  agents: readonly PublicSystemAgent[];
  loading: boolean;
  error: SystemAgentsError | null;
  loadingLabel: string;
  errorLabel: string;
  retryLabel: string;
  text: (key: string) => string;
  statusLabel: (status: AgentStatus) => string;
  selectedAgentId: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
}): React.ReactElement {
  if (props.loading) {
    return (
      <div
        className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-6 text-center"
        data-testid="platform-system-agents-loading"
      >
        <p className="text-sm text-slate-400">{props.loadingLabel}</p>
      </div>
    );
  }

  if (props.error === 'AUTH_EXPIRED') {
    return <></>;
  }

  const cards = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {props.agents.map((agent) => {
        const profile = staticAgentProfileContent(agent, props.text);
        return (
          <AgentStationCard
            key={agent.id}
            id={agent.id}
            name={props.text(agent.nameKey)}
            role={props.text(agent.roleKey)}
            description={props.text(agent.descriptionKey)}
            status={agent.status}
            enabled={profile.cardEnabled}
            statusLabel={props.statusLabel(agent.status)}
            selected={props.selectedAgentId === agent.id}
            onSelect={props.onSelect}
            actionHint={profile.actionHint}
          />
        );
      })}
    </div>
  );

  if (props.error !== 'FETCH_FAILED') {
    return cards;
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border border-red-700/40 bg-red-950/30 px-4 py-4"
        data-testid="platform-system-agents-error"
      >
        <div className="flex items-center gap-2">
          <ExclamationTriangleIcon className="h-4 w-4 text-red-400" aria-hidden="true" />
          <p className="text-sm text-red-300">{props.errorLabel}</p>
        </div>
        <button
          type="button"
          onClick={props.onRetry}
          className="mt-2 text-sm font-medium text-indigo-300 hover:text-indigo-200"
          data-testid="platform-system-agents-retry"
        >
          {props.retryLabel}
        </button>
      </div>
      {cards}
    </div>
  );
}

/**
 * WORKFLOW-CREATE-01: the role and description a copy of a template starts with,
 * in the owner's language: the system agent's own keys from GET /api/system-agents,
 * else the registry's naming (agents.<camelCaseId>.role). A key that does not
 * resolve gives ''; nothing known gives null.
 */
export function templatePrefillFor(
  templateId: string,
  agents: readonly Pick<PublicSystemAgent, 'id' | 'roleKey' | 'descriptionKey'>[],
  text: (key: string) => string,
): TemplatePrefill | null {
  const known = agents.find((agent) => agent.id === templateId);
  const base = `agents.${templateId.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())}`;
  const roleKey = known?.roleKey ?? `${base}.role`;
  const descriptionKey = known?.descriptionKey ?? `${base}.description`;
  const read = (key: string): string => {
    const value = text(key);
    return value === key ? '' : value;
  };
  const prefill = { role: read(roleKey), description: read(descriptionKey) };
  return prefill.role === '' && prefill.description === '' ? null : prefill;
}

export interface PlatformDashboardProps {
  locale?: string;
}

/**
 * WORKFLOW-STATUS-02: the badge state of a user agent's card. A draft gets its own
 * badge; an unknown stored status reads as disabled, like the server does.
 */
export function userAgentCardStatus(status: string): AgentStatus {
  if (status === 'active' || status === 'draft') return status;
  return 'disabled';
}

/** The badge text on a user agent's card and panel: Active, Draft or Disabled. */
export function getUserAgentStatusLabel(
  status: string,
  messages: LocaleMessages,
): string {
  if (status === 'active') return resolveNestedMessage(messages, 'platform.agentCreate.agentStatusActive');
  if (status === 'draft') return resolveNestedMessage(messages, 'platform.agentCreate.agentStatusDraft');
  return resolveNestedMessage(messages, 'platform.agentCreate.agentStatusDisabled');
}

/** RESULTS-01 D15: the header count pill in badge-active tokens; nothing when the count is 0 or unknown. */
export function ResultsUnreadPill({ count, template }: { count: number | null; template: string }) {
  const text = unreadBadgeText(count);
  if (text === null || count === null) {
    return null;
  }
  return (
    <span
      className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-emerald-800"
      data-testid="platform-results-unread"
    >
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{template.split('{count}').join(String(count))}</span>
    </span>
  );
}

export default function PlatformDashboard({ locale }: PlatformDashboardProps) {
  const router = useRouter();
  const messages = getLocaleMessages(locale);
  const systemAgents = useSystemAgents();
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);
  const [selectedUserAgentId, setSelectedUserAgentId] = React.useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [editingUserAgentId, setEditingUserAgentId] = React.useState<string | null>(null);
  const [copiedAgentId, setCopiedAgentId] = React.useState<string | null>(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [unreadResults, setUnreadResults] = React.useState<number | null>(null);
  const deleteInFlightRef = React.useRef(false);
  const resolvedLocale = locale ?? 'en';

  const {
    agents: userAgents,
    loading: userAgentsLoading,
    error: userAgentsError,
    createAgent,
    createAgentFromTemplate,
    updateAgent,
    deleteAgent,
    refetch: refetchUserAgents,
  } = useUserAgents();
  const agentOptions = useUserAgentOptions(
    showCreateForm || editingUserAgentId !== null || selectedUserAgentId !== null,
  );
  const workflowSummaries = useWorkflowSummaries(userAgents.length > 0);

  const title = resolveNestedMessage(messages, 'platform.title');
  const subtitle = resolveNestedMessage(messages, 'platform.subtitle');
  const backToWorkspace = resolveNestedMessage(messages, 'platform.backToWorkspace');
  const openOffice = resolveNestedMessage(messages, 'platform.openOffice');
  const openKnowledge = resolveNestedMessage(messages, 'platform.openKnowledge');
  const openConnections = resolveNestedMessage(messages, 'platform.openConnections');
  const openResults = resolveNestedMessage(messages, 'platform.openResults');
  const unreadResultsTemplate = resolveNestedMessage(messages, 'platform.unreadResults');
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
  const detailAskButton = resolveNestedMessage(messages, 'platform.agentCreate.askButton');
  const detailDeleteButton = resolveNestedMessage(messages, 'platform.agentCreate.deleteButton');
  const detailDeleteConfirmTitle = resolveNestedMessage(messages, 'platform.agentCreate.deleteConfirmTitle');
  const detailDeleteConfirmBody = resolveNestedMessage(messages, 'platform.agentCreate.deleteConfirmBody');
  const detailDeleteConfirmAction = resolveNestedMessage(messages, 'platform.agentCreate.deleteConfirmAction');
  const detailDeleteError = resolveNestedMessage(messages, 'platform.agentCreate.deleteError');
  const detailDeleteCancel = resolveNestedMessage(messages, 'platform.agentCreate.cancelButton');
  const detailDeleting = resolveNestedMessage(messages, 'common.deleting');
  const detailComingSoonTitle = resolveNestedMessage(messages, 'platform.detail.comingSoonTitle');
  const detailComingSoonBody = resolveNestedMessage(messages, 'platform.detail.comingSoonBody');
  const openTeamLabel = resolveNestedMessage(messages, 'common.open');
  const openAgentDetailActive = resolveNestedMessage(messages, 'platform.openAgentDetailActive');
  const activeStationsLabel = resolveNestedMessage(messages, 'platform.activeStationsLabel');
  const reserveStationsLabel = resolveNestedMessage(messages, 'platform.reserveStationsLabel');
  const selectedStationLabel = resolveNestedMessage(messages, 'platform.selectedStationLabel');
  const noStationSelected = resolveNestedMessage(messages, 'platform.noStationSelected');
  const loadingLabel = resolveNestedMessage(messages, 'common.loading');

  const acSectionTitle = resolveNestedMessage(messages, 'platform.agentCreate.sectionTitle');
  const acSectionSubtitle = resolveNestedMessage(messages, 'platform.agentCreate.sectionSubtitle');
  const acCreateButton = resolveNestedMessage(messages, 'platform.agentCreate.createButton');
  const acEmptyTitle = resolveNestedMessage(messages, 'platform.agentCreate.emptyTitle');
  const acEmptyBody = resolveNestedMessage(messages, 'platform.agentCreate.emptyBody');
  const acLoadError = resolveNestedMessage(messages, 'platform.agentCreate.loadError');
  const acRetry = resolveNestedMessage(messages, 'platform.agentCreate.retry');
  const systemAgentsLoadingLabel = resolveNestedMessage(messages, 'platform.systemAgentsLoading');
  const systemAgentsLoadError = resolveNestedMessage(messages, 'platform.systemAgentsLoadError');

  const formLabels: CreateAgentFormLabels = {
    formTitle: resolveNestedMessage(messages, 'platform.agentCreate.formTitle'),
    nameLabel: resolveNestedMessage(messages, 'platform.agentCreate.nameLabel'),
    namePlaceholder: resolveNestedMessage(messages, 'platform.agentCreate.namePlaceholder'),
    roleLabel: resolveNestedMessage(messages, 'platform.agentCreate.roleLabel'),
    rolePlaceholder: resolveNestedMessage(messages, 'platform.agentCreate.rolePlaceholder'),
    descriptionLabel: resolveNestedMessage(messages, 'platform.agentCreate.descriptionLabel'),
    descriptionPlaceholder: resolveNestedMessage(messages, 'platform.agentCreate.descriptionPlaceholder'),
    submitButton: resolveNestedMessage(messages, 'platform.agentCreate.submitButton'),
    cancelButton: resolveNestedMessage(messages, 'platform.agentCreate.cancelButton'),
    submitting: resolveNestedMessage(messages, 'platform.agentCreate.submitting'),
    nameRequired: resolveNestedMessage(messages, 'platform.agentCreate.nameRequired'),
    nameTooLong: resolveNestedMessage(messages, 'platform.agentCreate.nameTooLong'),
    roleRequired: resolveNestedMessage(messages, 'platform.agentCreate.roleRequired'),
    roleTooLong: resolveNestedMessage(messages, 'platform.agentCreate.roleTooLong'),
    descriptionRequired: resolveNestedMessage(messages, 'platform.agentCreate.descriptionRequired'),
    descriptionTooLong: resolveNestedMessage(messages, 'platform.agentCreate.descriptionTooLong'),
    createError: resolveNestedMessage(messages, 'platform.agentCreate.createError'),
    createSuccess: resolveNestedMessage(messages, 'platform.agentCreate.createSuccess'),
    roleHint: resolveNestedMessage(messages, 'platform.agentCreate.roleHint'),
    descriptionHint: resolveNestedMessage(messages, 'platform.agentCreate.descriptionHint'),
  };

  const workflowT = (key: string) => resolveNestedMessage(messages, `platform.agentWorkflow.${key}`);
  const workflowScopeName = (id: string) => resolveNestedMessage(messages, `knowledge.scopes.${id}`);
  const detailEditButton = workflowT('editButton');

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

  // RESULTS-01 D15: the unread count, read once after sign-in. Any non-200 hides the pill.
  React.useEffect(() => {
    if (!authReady) {
      return;
    }
    let isMounted = true;
    void loadUnreadCount().then((count) => {
      if (isMounted) {
        setUnreadResults(count);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [authReady]);

  React.useEffect(() => {
    if (userAgentsError === 'AUTH_EXPIRED' || systemAgents.error === 'AUTH_EXPIRED') {
      router.replace(`/${resolvedLocale}/login`);
    }
  }, [userAgentsError, systemAgents.error, resolvedLocale, router]);

  const localePrefix = locale ? `/${locale}` : '';
  const stationCounts = stationCountsForLoad(
    systemAgents.loading,
    systemAgents.error,
    systemAgents.agents,
  );
  const profileText = (key: string) => resolveNestedMessage(messages, key);

  const selectedStaticAgent = selectedAgentId
    ? systemAgents.agents.find((agent) => agent.id === selectedAgentId) ?? null
    : null;

  const selectedUserAgent: UserAgent | null = selectedUserAgentId
    ? userAgents.find((ua) => ua.id === selectedUserAgentId) ?? null
    : null;

  function handleSelectStaticAgent(id: string) {
    setSelectedAgentId(id);
    setSelectedUserAgentId(null);
    setShowCreateForm(false);
    setEditingUserAgentId(null);
    setDeleteError(null);
  }

  function handleSelectUserAgent(id: string) {
    setSelectedUserAgentId(id);
    setSelectedAgentId(null);
    setShowCreateForm(false);
    setEditingUserAgentId(null);
    setDeleteError(null);
  }

  function handleOpenCreateForm() {
    setShowCreateForm(true);
    setEditingUserAgentId(null);
    setSelectedAgentId(null);
    setSelectedUserAgentId(null);
    setDeleteError(null);
  }

  function handleCloseDetail() {
    setSelectedAgentId(null);
    setSelectedUserAgentId(null);
    setShowCreateForm(false);
    setEditingUserAgentId(null);
    setDeleteError(null);
  }

  function handleEditUserAgent(id: string) {
    setEditingUserAgentId(id);
    setCopiedAgentId(null);
    setShowCreateForm(false);
    setDeleteError(null);
  }

  async function handleSaveWorkflow(request: WorkflowSaveRequest) {
    const result =
      request.kind === 'update'
        ? await updateAgent(request.agentId, request.body)
        : request.kind === 'template'
          ? await createAgentFromTemplate(request.body)
          : await createAgent(request.body);
    if (result.error === 'AUTH_EXPIRED') {
      router.replace(`/${resolvedLocale}/login`);
    }
    if (result.agent) {
      // A saved change can move the workflow to a new version: read the tested flag again.
      workflowSummaries.refetch();
    }
    return result;
  }

  async function handleSwitchWorkflow(
    agentId: string,
    on: boolean,
  ): Promise<{ error?: string; code?: string }> {
    const result = await updateAgent(agentId, userAgentSwitchBody(on));
    if (result.error === 'AUTH_EXPIRED') {
      router.replace(`/${resolvedLocale}/login`);
    }
    // WORKFLOW-STATUS-02: a refused switch-on also reloads the tested state, so the
    // panel can show "Run a test first" when the server says the version is untested.
    if (result.agent || (on && result.error && result.error !== 'AUTH_EXPIRED')) {
      workflowSummaries.refetch();
    }
    if (!result.error) return {};
    return result.code ? { error: result.error, code: result.code } : { error: result.error };
  }

  function handleWorkflowSaved(agent: UserAgent, kind: WorkflowSaveRequest['kind']) {
    if (kind === 'template') {
      // A copy opens straight in the editor so the owner can adjust it.
      setShowCreateForm(false);
      setSelectedUserAgentId(agent.id);
      setEditingUserAgentId(agent.id);
      setCopiedAgentId(agent.id);
    }
  }

  async function handleCreateAgent(data: { name: string; role: string; description: string }) {
    const result = await createAgent(data);
    if (result.error) {
      if (result.error === 'AUTH_EXPIRED') {
        router.replace(`/${resolvedLocale}/login`);
      }
      return { error: result.error };
    }
    return {};
  }

  async function handleDeleteAgent(agentId: string) {
    if (deletePending || deleteInFlightRef.current) {
      return;
    }
    deleteInFlightRef.current = true;
    setDeletePending(true);
    setDeleteError(null);
    const result = await deleteAgent(agentId);
    deleteInFlightRef.current = false;
    setDeletePending(false);
    if (result.error === 'AUTH_EXPIRED') {
      router.replace(`/${resolvedLocale}/login`);
      return;
    }
    if (result.error) {
      setDeleteError(detailDeleteError);
      return;
    }
    setSelectedUserAgentId((current) => nextSelectedUserAgentIdAfterDelete(current, agentId));
  }

  let detailPanelContent: AgentDetailViewModel | null = null;

  if (selectedStaticAgent) {
    const profile = staticAgentProfileContent(selectedStaticAgent, profileText);
    detailPanelContent = {
      id: selectedStaticAgent.id,
      name: resolveNestedMessage(messages, selectedStaticAgent.nameKey),
      role: resolveNestedMessage(messages, selectedStaticAgent.roleKey),
      description: resolveNestedMessage(messages, selectedStaticAgent.descriptionKey),
      statusLabel: getStatusLabel(selectedStaticAgent.status, messages),
      intent: profile.intent,
      capabilities: profile.capabilities,
      isBuilder: selectedStaticAgent.id === 'builder',
      isComingSoon: profile.isComingSoon,
      openHref: profile.openPath ? `${localePrefix}${profile.openPath}` : undefined,
      openLabel: profile.openPath ? openTeamLabel : undefined,
    };
  } else if (selectedUserAgent) {
    detailPanelContent = {
      id: selectedUserAgent.id,
      name: selectedUserAgent.name,
      role: selectedUserAgent.role,
      description: selectedUserAgent.description,
      statusLabel: getUserAgentStatusLabel(selectedUserAgent.status, messages),
      intent: selectedUserAgent.role,
      capabilities: [],
      isBuilder: false,
      isComingSoon: false,
      isUserCreated: true,
    };
  }

  const editingUserAgent: UserAgent | null = editingUserAgentId
    ? userAgents.find((ua) => ua.id === editingUserAgentId) ?? null
    : null;

  const editingSummary = editingUserAgent
    ? (workflowSummaries.items.find((entry) => entry.id === editingUserAgent.id) ?? null)
    : null;
  const editingUsage: WorkflowUsageView | null = !editingUserAgent
    ? null
    : workflowSummaries.state === 'failed'
      ? { state: 'failed' }
      : workflowSummaries.state === 'loaded' && editingSummary
        ? { state: 'loaded', line: workflowUsageLine(workflowT, editingSummary) }
        : workflowSummaries.state === 'loaded'
          ? null
          : { state: 'loading' };

  const displaySelectedName = selectedStaticAgent
    ? resolveNestedMessage(messages, selectedStaticAgent.nameKey)
    : selectedUserAgent
      ? selectedUserAgent.name
      : noStationSelected;

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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href={`${localePrefix}/office`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              data-testid="platform-open-office"
            >
              <BuildingOffice2Icon className="h-4 w-4" aria-hidden="true" />
              {openOffice}
            </Link>
            <Link
              href={`${localePrefix}/knowledge`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              data-testid="platform-open-knowledge"
            >
              <BookOpenIcon className="h-4 w-4" aria-hidden="true" />
              {openKnowledge}
            </Link>
            <Link
              href={`${localePrefix}/connections`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              data-testid="platform-open-connections"
            >
              <LinkIcon className="h-4 w-4" aria-hidden="true" />
              {openConnections}
            </Link>
            <Link
              href={`${localePrefix}/results`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              data-testid="platform-open-results"
            >
              <InboxIcon className="h-4 w-4" aria-hidden="true" />
              {openResults}
              <ResultsUnreadPill count={unreadResults} template={unreadResultsTemplate} />
            </Link>
            <Link
              href={`${localePrefix}/app`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              data-testid="platform-back-to-workspace"
            >
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              {backToWorkspace}
            </Link>
          </div>
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
                  <p className="mt-1 text-xl font-semibold text-white">{stationCounts ? stationCounts.active : '\u00A0'}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-300">{reserveStationsLabel}</p>
                  <p className="mt-1 text-xl font-semibold text-white">{stationCounts ? stationCounts.reserve : '\u00A0'}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-300">{selectedStationLabel}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">
                    {displaySelectedName}
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
              <SystemAgentStationArea
                agents={systemAgents.agents}
                loading={systemAgents.loading}
                error={systemAgents.error}
                loadingLabel={systemAgentsLoadingLabel}
                errorLabel={systemAgentsLoadError}
                retryLabel={acRetry}
                text={profileText}
                statusLabel={(status) => getStatusLabel(status, messages)}
                selectedAgentId={selectedAgentId}
                onSelect={handleSelectStaticAgent}
                onRetry={() => {
                  void systemAgents.refetch();
                }}
              />

              <div className="mt-6 border-t border-slate-700 pt-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-start gap-2">
                    <UserGroupIcon className="mt-0.5 h-4 w-4 text-indigo-300" aria-hidden="true" />
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                        {acSectionTitle}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">{acSectionSubtitle}</p>
                    </div>
                  </div>
                  {!showCreateForm && (
                    <button
                      type="button"
                      onClick={handleOpenCreateForm}
                      className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                      data-testid="create-agent-cta"
                    >
                      <PlusIcon className="h-4 w-4" aria-hidden="true" />
                      {acCreateButton}
                    </button>
                  )}
                </div>

                {userAgentsLoading && (
                  <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-6 text-center" data-testid="user-agents-loading">
                    <p className="text-sm text-slate-400">{loadingLabel}</p>
                  </div>
                )}

                {!userAgentsLoading && userAgentsError && userAgentsError !== 'AUTH_EXPIRED' && (
                  <div className="rounded-lg border border-red-700/40 bg-red-950/30 px-4 py-4" data-testid="user-agents-error">
                    <div className="flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-4 w-4 text-red-400" aria-hidden="true" />
                      <p className="text-sm text-red-300">{acLoadError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => refetchUserAgents()}
                      className="mt-2 text-sm font-medium text-indigo-300 hover:text-indigo-200"
                      data-testid="user-agents-retry"
                    >
                      {acRetry}
                    </button>
                  </div>
                )}

                {!userAgentsLoading && !userAgentsError && userAgents.length === 0 && !showCreateForm && (
                  <div className="rounded-lg border border-dashed border-slate-600 bg-slate-800/40 px-4 py-6 text-center" data-testid="user-agents-empty">
                    <UserGroupIcon className="mx-auto h-8 w-8 text-slate-500" aria-hidden="true" />
                    <p className="mt-2 text-sm font-medium text-slate-300">{acEmptyTitle}</p>
                    <p className="mt-1 text-sm text-slate-400">{acEmptyBody}</p>
                    <button
                      type="button"
                      onClick={handleOpenCreateForm}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                      data-testid="create-agent-empty-cta"
                    >
                      <PlusIcon className="h-4 w-4" aria-hidden="true" />
                      {acCreateButton}
                    </button>
                  </div>
                )}

                {!userAgentsLoading && !userAgentsError && userAgents.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="user-agents-list">
                    {userAgents.map((ua) => (
                      <AgentStationCard
                        key={ua.id}
                        id={`user-${ua.id}`}
                        name={ua.name}
                        role={ua.role}
                        description={ua.description}
                        status={userAgentCardStatus(ua.status)}
                        enabled={ua.status === 'active'}
                        statusLabel={getUserAgentStatusLabel(ua.status, messages)}
                        selected={selectedUserAgentId === ua.id}
                        workflowNote={workflowTestedNote(
                          workflowT,
                          workflowSummaries.state === 'loaded'
                            ? (workflowSummaries.items.find((entry) => entry.id === ua.id)?.tested ?? null)
                            : null,
                        )}
                        onSelect={() => handleSelectUserAgent(ua.id)}
                        actionHint={openAgentDetailActive}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2 text-slate-200">
                <UserCircleIcon className="h-5 w-5 text-indigo-300" aria-hidden="true" />
                <h2 className="text-sm font-semibold uppercase tracking-wide">{detailLabel}</h2>
              </div>
              {editingUserAgent ? (
                <CreateAgentForm
                  key={`edit-${editingUserAgent.id}`}
                  labels={formLabels}
                  onSubmit={handleCreateAgent}
                  onCancel={() => setEditingUserAgentId(null)}
                  workflow={{
                    mode: 'edit',
                    t: workflowT,
                    scopeName: workflowScopeName,
                    localePrefix,
                    options: agentOptions.options,
                    optionsLoading: agentOptions.loading,
                    optionsError: agentOptions.error !== null,
                    onRetryOptions: agentOptions.retry,
                    agent: editingUserAgent,
                    createdNotice: copiedAgentId === editingUserAgent.id,
                    usage: editingUsage,
                    onSave: handleSaveWorkflow,
                  }}
                />
              ) : showCreateForm ? (
                <CreateAgentForm
                  key="create"
                  labels={formLabels}
                  onSubmit={handleCreateAgent}
                  onCancel={() => setShowCreateForm(false)}
                  workflow={{
                    mode: 'create',
                    t: workflowT,
                    scopeName: workflowScopeName,
                    localePrefix,
                    options: agentOptions.options,
                    optionsLoading: agentOptions.loading,
                    optionsError: agentOptions.error !== null,
                    onRetryOptions: agentOptions.retry,
                    onSave: handleSaveWorkflow,
                    onSaved: handleWorkflowSaved,
                    templatePrefill: (templateId) =>
                      templatePrefillFor(templateId, systemAgents.agents, profileText),
                  }}
                />
              ) : (
                <AgentDetailPanel
                  agent={detailPanelContent}
                  localePrefix={localePrefix}
                  title={detailLabel}
                  subtitle={detailSubtitle}
                  intentLabel={detailIntentLabel}
                  capabilitiesLabel={detailCapabilitiesLabel}
                  closeLabel={detailCloseLabel}
                  emptyTitle={detailEmptyTitle}
                  emptyBody={detailEmptyBody}
                  startBuildingLabel={detailStartBuilding}
                  askButtonLabel={detailAskButton}
                  comingSoonLabel={detailComingSoonTitle}
                  comingSoonBody={detailComingSoonBody}
                  deleteButtonLabel={detailDeleteButton}
                  deleteConfirmTitle={detailDeleteConfirmTitle}
                  deleteConfirmBody={detailDeleteConfirmBody}
                  deleteConfirmActionLabel={detailDeleteConfirmAction}
                  deleteCancelLabel={detailDeleteCancel}
                  deletingLabel={detailDeleting}
                  deleteErrorMessage={deleteError}
                  deletePending={deletePending}
                  onDelete={handleDeleteAgent}
                  editButtonLabel={detailEditButton}
                  onEdit={handleEditUserAgent}
                  workflowSummary={
                    selectedUserAgent ? (
                      <AgentWorkflowSummary
                        t={workflowT}
                        scopeName={workflowScopeName}
                        localePrefix={localePrefix}
                        agentId={selectedUserAgent.id}
                        status={selectedUserAgent.status}
                        summaryState={workflowSummaries.state}
                        item={workflowSummaries.items.find((entry) => entry.id === selectedUserAgent.id) ?? null}
                        models={agentOptions.options?.models ?? null}
                        onRetry={workflowSummaries.retry}
                        onSwitch={handleSwitchWorkflow}
                      />
                    ) : null
                  }
                  onClose={handleCloseDetail}
                />
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
