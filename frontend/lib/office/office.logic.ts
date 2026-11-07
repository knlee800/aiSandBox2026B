export const OFFICE_POLL_MS = 5000;
export const OFFICE_RECENT_LIMIT = 5;
export const BUILDER_DESK_ID = 'registry:builder';
export const TEAM_DESK_ID = 'team';
export const FORMER_DESK_ID = 'former';

export type OfficeRunList = 'active' | 'recent';

export interface OfficeRun {
  executionId: string | null;
  status: string;
  sessionId: string | null;
  provider: string | null;
  model: string | null;
  tokensUsed: number | null;
  startedAt: string | null;
  durationMs: number | null;
  mode: string;
  agentId: string | null;
  collaborationRunId: string | null;
  builderProfileId: string | null;
}

export type OfficeDeskPhase =
  | 'vacant'
  | 'idle'
  | 'queued'
  | 'working'
  | 'stopping'
  | 'done'
  | 'failed'
  | 'stopped'
  | 'timedOut';

export type OfficeDeskKind = 'registry' | 'user' | 'team' | 'former';

export interface OfficeRegistryAgent {
  id: string;
  comingSoon: boolean;
  status: string;
}

export interface OfficeUserAgentRef {
  id: string;
  name: string;
  role: string;
  description: string;
}

export interface OfficeDesk {
  id: string;
  kind: OfficeDeskKind;
  registryId: string | null;
  userAgentId: string | null;
  vacant: boolean;
  phase: OfficeDeskPhase;
  isLastRun: boolean;
  currentRun: OfficeRun | null;
  recentRuns: OfficeRun[];
  teamRole: string | null;
  headlineRun: OfficeRun | null;
}

const ACTIVE_POLL_PHASES: ReadonlySet<OfficeDeskPhase> = new Set([
  'queued',
  'working',
  'stopping',
]);

const RECENT_PHASES: Record<string, OfficeDeskPhase> = {
  completed: 'done',
  failed: 'failed',
  cancelled: 'stopped',
  timeout: 'timedOut',
  running: 'working',
  queued: 'queued',
};

export function officeRegistryFromManifests(
  agents: readonly { id: string; status: string }[],
): OfficeRegistryAgent[] {
  return agents.map((agent) => ({
    id: agent.id,
    status: agent.status,
    comingSoon: agent.status === 'coming_soon',
  }));
}

export function activeRegistryDeskIds(
  agents: readonly { id: string; status: string }[],
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const agent of agents) {
    if (agent.status === 'active' && agent.id !== 'builder') {
      ids.add(agent.id);
    }
  }
  return ids;
}

export function presentText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function attributeDeskId(
  run: Pick<OfficeRun, 'collaborationRunId' | 'agentId'> & {
    builderProfileId?: string | null;
  },
  userAgentIds: ReadonlySet<string>,
  activeRegistryIds: ReadonlySet<string>,
): string {
  if (presentText(run.collaborationRunId)) {
    const profileId = presentText(run.builderProfileId);
    if (profileId && activeRegistryIds.has(profileId)) {
      return `registry:${profileId}`;
    }
    return TEAM_DESK_ID;
  }
  const agentId = presentText(run.agentId);
  if (!agentId) {
    return BUILDER_DESK_ID;
  }
  if (userAgentIds.has(agentId)) {
    return `user:${agentId}`;
  }
  return FORMER_DESK_ID;
}

export function phaseForRun(status: string, list: OfficeRunList): OfficeDeskPhase {
  if (list === 'active') {
    if (status === 'running') {
      return 'working';
    }
    // cancel_requested is published as cancelled and still sits in the active list.
    if (status === 'cancelled') {
      return 'stopping';
    }
    return 'queued';
  }
  return RECENT_PHASES[status] ?? 'queued';
}

export function shouldPollOffice(phases: readonly OfficeDeskPhase[]): boolean {
  return phases.some((phase) => ACTIVE_POLL_PHASES.has(phase));
}

export function activeRunsEnded(
  previous: readonly OfficeRun[],
  next: readonly OfficeRun[],
): boolean {
  const nextIds = new Set(next.map((run) => run.executionId));
  return previous.some((run) => !nextIds.has(run.executionId));
}

export function showsOutcomeUnknown(run: Pick<OfficeRun, 'status' | 'mode'>): boolean {
  return run.status === 'completed' && (run.mode === 'build' || run.mode === 'agent');
}

export function deskShowsOutcome(
  desk: Pick<OfficeDesk, 'currentRun' | 'recentRuns'>,
): boolean {
  if (desk.currentRun && showsOutcomeUnknown(desk.currentRun)) {
    return true;
  }
  return desk.recentRuns.some((run) => showsOutcomeUnknown(run));
}

export function officeModeKey(mode: string): 'ask' | 'build' | 'agent' | 'unknown' {
  if (mode === 'ask' || mode === 'build' || mode === 'agent') {
    return mode;
  }
  return 'unknown';
}

export function officeInitials(name: string): string {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
  return initials.length > 0 ? initials : '—';
}

export function officeProviderModel(
  run: Pick<OfficeRun, 'provider' | 'model'>,
): string {
  const provider = presentText(run.provider);
  const model = presentText(run.model);
  if (provider && model) {
    return `${provider} / ${model}`;
  }
  return provider ?? model ?? '—';
}

export function officeTokensText(tokensUsed: number | null): string {
  if (typeof tokensUsed !== 'number' || !Number.isFinite(tokensUsed)) {
    return '—';
  }
  return String(Math.trunc(tokensUsed));
}

export function formatDurationText(durationMs: number | null): string {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
    return '—';
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    return `${totalHours}h`;
  }
  return `${Math.floor(totalHours / 24)}d`;
}

export function formatElapsedText(startedAt: string | null, nowMs: number): string {
  if (!presentText(startedAt) || !Number.isFinite(nowMs)) {
    return '—';
  }
  const startedMs = Date.parse(startedAt as string);
  if (Number.isNaN(startedMs)) {
    return '—';
  }
  return formatDurationText(Math.max(0, nowMs - startedMs));
}

export function officeStartedClock(startedAt: string | null, locale: string): string {
  if (!presentText(startedAt)) {
    return '—';
  }
  const startedMs = Date.parse(startedAt as string);
  if (Number.isNaN(startedMs)) {
    return '—';
  }
  return new Date(startedMs).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function fillOfficeTemplate(template: string, values: Record<string, string>): string {
  let filled = template;
  for (const [key, value] of Object.entries(values)) {
    filled = filled.split(`{${key}}`).join(value);
  }
  return filled;
}

export function officeWorkspaceHref(locale: string, userAgentId: string | null): string {
  if (!userAgentId) {
    return `/${locale}/app`;
  }
  return `/${locale}/app?userAgentId=${encodeURIComponent(userAgentId)}`;
}

export function officePlatformHref(locale: string): string {
  return `/${locale}/platform`;
}

export function officeTeamHref(locale: string): string {
  return `/${locale}/collaboration`;
}

export function officeTint(phase: OfficeDeskPhase): string {
  if (phase === 'queued' || phase === 'stopping') {
    return '#fbbf24';
  }
  if (phase === 'working') {
    return '#34d399';
  }
  if (phase === 'failed' || phase === 'timedOut') {
    return '#f87171';
  }
  if (phase === 'vacant') {
    return '#64748b';
  }
  return '#94a3b8';
}

export function officeScreenOn(phase: OfficeDeskPhase): boolean {
  return phase === 'working';
}

export function officeShowTick(phase: OfficeDeskPhase): boolean {
  return phase === 'done';
}

export function deskTimeText(
  desk: Pick<OfficeDesk, 'phase' | 'headlineRun'>,
  nowMs: number,
): string | null {
  if (!desk.headlineRun) {
    return null;
  }
  if (desk.phase === 'queued' || desk.phase === 'working' || desk.phase === 'stopping') {
    return formatElapsedText(desk.headlineRun.startedAt, nowMs);
  }
  if (
    desk.phase === 'done' ||
    desk.phase === 'failed' ||
    desk.phase === 'stopped' ||
    desk.phase === 'timedOut'
  ) {
    return formatDurationText(desk.headlineRun.durationMs);
  }
  return null;
}

function readNullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

export function normalizeOfficeRun(value: unknown): OfficeRun | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const status = typeof row.status === 'string' ? row.status.trim() : '';
  const mode = readNullableString(row.mode) ?? 'unknown';
  return {
    executionId: readNullableString(row.executionId),
    status,
    sessionId: readNullableString(row.sessionId),
    provider: readNullableString(row.provider),
    model: readNullableString(row.model),
    tokensUsed: readFiniteNumber(row.tokensUsed),
    startedAt: readNullableString(row.startedAt),
    durationMs: readFiniteNumber(row.durationMs),
    mode,
    agentId: readNullableString(row.agentId),
    collaborationRunId: readNullableString(row.collaborationRunId),
    builderProfileId: readNullableString(row.builderProfileId),
  };
}

export function normalizeOfficeRuns(payload: unknown): OfficeRun[] | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const runs = (payload as { runs?: unknown }).runs;
  if (!Array.isArray(runs)) {
    return null;
  }
  const normalized: OfficeRun[] = [];
  for (const row of runs) {
    const run = normalizeOfficeRun(row);
    if (run) {
      normalized.push(run);
    }
  }
  return normalized;
}

function parseStartedAt(startedAt: string | null): number | null {
  if (!presentText(startedAt)) {
    return null;
  }
  const parsed = Date.parse(startedAt as string);
  return Number.isNaN(parsed) ? null : parsed;
}

export function sortRunsNewestFirst(runs: readonly OfficeRun[]): OfficeRun[] {
  return runs
    .map((run, index) => ({ run, index }))
    .sort((left, right) => {
      const leftTime = parseStartedAt(left.run.startedAt);
      const rightTime = parseStartedAt(right.run.startedAt);
      if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      if (leftTime !== null && rightTime === null) {
        return -1;
      }
      if (leftTime === null && rightTime !== null) {
        return 1;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.run);
}

function newestRun(runs: readonly OfficeRun[]): OfficeRun | null {
  return sortRunsNewestFirst(runs)[0] ?? null;
}

function deriveDeskActivity(
  activeRuns: readonly OfficeRun[],
  recentRuns: readonly OfficeRun[],
): Pick<OfficeDesk, 'phase' | 'isLastRun' | 'currentRun' | 'recentRuns' | 'headlineRun'> {
  const current = newestRun(activeRuns);
  const recentSorted = sortRunsNewestFirst(recentRuns);
  if (current) {
    const currentId = presentText(current.executionId);
    const filtered = currentId
      ? recentSorted.filter((run) => presentText(run.executionId) !== currentId)
      : recentSorted;
    return {
      phase: phaseForRun(current.status, 'active'),
      isLastRun: false,
      currentRun: current,
      headlineRun: current,
      recentRuns: filtered.slice(0, OFFICE_RECENT_LIMIT),
    };
  }
  const last = recentSorted[0] ?? null;
  if (!last) {
    return {
      phase: 'idle',
      isLastRun: false,
      currentRun: null,
      headlineRun: null,
      recentRuns: [],
    };
  }
  return {
    phase: phaseForRun(last.status, 'recent'),
    isLastRun: true,
    currentRun: null,
    headlineRun: last,
    recentRuns: recentSorted.slice(0, OFFICE_RECENT_LIMIT),
  };
}

function vacantDesk(id: string, registryId: string): OfficeDesk {
  return {
    id,
    kind: 'registry',
    registryId,
    userAgentId: null,
    vacant: true,
    phase: 'vacant',
    isLastRun: false,
    currentRun: null,
    recentRuns: [],
    teamRole: null,
    headlineRun: null,
  };
}

export function buildOfficeDesks(input: {
  registry: readonly OfficeRegistryAgent[];
  userAgents: readonly OfficeUserAgentRef[];
  activeRuns: readonly OfficeRun[];
  recentRuns: readonly OfficeRun[];
}): OfficeDesk[] {
  const userAgentIds = new Set(input.userAgents.map((agent) => agent.id));
  const activeRegistryIds = activeRegistryDeskIds(input.registry);
  const groups = new Map<string, { active: OfficeRun[]; recent: OfficeRun[] }>();
  const bucket = (id: string) => {
    const existing = groups.get(id);
    if (existing) {
      return existing;
    }
    const created = { active: [], recent: [] };
    groups.set(id, created);
    return created;
  };

  for (const run of input.activeRuns) {
    bucket(attributeDeskId(run, userAgentIds, activeRegistryIds)).active.push(run);
  }
  for (const run of input.recentRuns) {
    bucket(attributeDeskId(run, userAgentIds, activeRegistryIds)).recent.push(run);
  }

  const desks: OfficeDesk[] = [];
  for (const agent of input.registry) {
    const id = `registry:${agent.id}`;
    if (agent.comingSoon) {
      desks.push(vacantDesk(id, agent.id));
      continue;
    }
    const group = groups.get(id) ?? { active: [], recent: [] };
    desks.push({
      id,
      kind: 'registry',
      registryId: agent.id,
      userAgentId: null,
      vacant: false,
      teamRole: null,
      ...deriveDeskActivity(group.active, group.recent),
    });
  }

  for (const agent of input.userAgents) {
    const id = `user:${agent.id}`;
    const group = groups.get(id) ?? { active: [], recent: [] };
    desks.push({
      id,
      kind: 'user',
      registryId: null,
      userAgentId: agent.id,
      vacant: false,
      teamRole: null,
      ...deriveDeskActivity(group.active, group.recent),
    });
  }

  const team = groups.get(TEAM_DESK_ID);
  if (team && (team.active.length > 0 || team.recent.length > 0)) {
    const activity = deriveDeskActivity(team.active, team.recent);
    desks.push({
      id: TEAM_DESK_ID,
      kind: 'team',
      registryId: null,
      userAgentId: null,
      vacant: false,
      teamRole: presentText(activity.headlineRun?.builderProfileId),
      ...activity,
    });
  }

  const former = groups.get(FORMER_DESK_ID);
  if (former && (former.active.length > 0 || former.recent.length > 0)) {
    desks.push({
      id: FORMER_DESK_ID,
      kind: 'former',
      registryId: null,
      userAgentId: null,
      vacant: false,
      teamRole: null,
      ...deriveDeskActivity(former.active, former.recent),
    });
  }

  return desks;
}
