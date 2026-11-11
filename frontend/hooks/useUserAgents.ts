'use client';

import { useState, useEffect, useCallback } from 'react';
import { readCsrfToken } from '@/lib/collaboration/api';

export type UserAgentReplyLanguage = 'owner' | 'en' | 'zh-TW' | 'zh-CN';

/** The model a workflow runs on: the server's default, or one of the platform list. */
export type UserAgentModel = { choice: 'server' } | { choice: 'platform'; id: string };

/** One line of the generated "what it can never do" list (BIZ-USER-01A). */
export interface UserAgentNeverDoItem {
  code: string;
  scopeIds?: string[];
}

/** The grants the server computed from the stored access (BIZ-USER-01A). */
export interface UserAgentGrants {
  toolProfile: string;
  knowledgeScopeIds: string[];
  connectorToolIds: string[];
  dropped?: {
    toolProfile: string | null;
    knowledgeScopeIds: string[];
    connectorToolIds: string[];
    missingConnections: { toolId: string; kind: string }[];
  };
}

/** The editable workflow fields of a user agent (BIZ-USER-01A). */
export interface UserAgentWorkflowFields {
  tone: string | null;
  replyLanguage: UserAgentReplyLanguage | null;
  purpose: string;
  procedure: string;
  result: string;
  toolProfile: string;
  knowledgeScopeIds: string[];
  connectorToolIds: string[];
  model: UserAgentModel;
  budgetPerRunCredits: number | null;
  budgetPerDayCredits: number | null;
  templateId: string | null;
  /** USER-TEAMS-01: the ids of the team this workflow leads (at most 3); empty is no team. */
  teamMemberIds: string[];
}

export interface UserAgent extends Partial<UserAgentWorkflowFields> {
  id: string;
  name: string;
  role: string;
  description: string;
  status: 'active' | 'draft' | 'disabled';
  initials: string | null;
  createdAt: string;
  updatedAt: string;
  // Derived by the server, never stored.
  neverDo?: UserAgentNeverDoItem[];
  grants?: UserAgentGrants;
  instructionsChars?: number;
  maxInstructionsChars?: number;
}

/** Body of POST /api/agents. Only name, role and description are required. */
export interface CreateAgentDto
  extends Partial<
    Pick<
      UserAgentWorkflowFields,
      | 'tone'
      | 'replyLanguage'
      | 'purpose'
      | 'procedure'
      | 'result'
      | 'knowledgeScopeIds'
      | 'connectorToolIds'
      | 'model'
      | 'budgetPerRunCredits'
      | 'budgetPerDayCredits'
      | 'teamMemberIds'
    >
  > {
  name: string;
  role: string;
  description: string;
}

/** Body of POST /api/agents/from-template. The spec is copied on the server. */
export interface CreateAgentFromTemplateDto {
  templateId: string;
  name: string;
  role: string;
  description?: string;
}

/** Body of PATCH /api/agents/:id. An absent field keeps the stored value. */
export type UpdateAgentDto = Partial<
  Pick<UserAgent, 'name' | 'role' | 'description' | 'status'> &
    Omit<UserAgentWorkflowFields, 'toolProfile' | 'templateId'>
>;

export interface UserAgentPlatformModel {
  id: string;
  provider: string;
  creditsPer1kTokens: number;
}

/** USER-TEAMS-01: one agent the workflow form may put on a team (GET /api/agents/options). */
export interface UserAgentTeamChoice {
  id: string;
  kind: 'system' | 'workflow';
  name: string;
  status: string;
}

/** GET /api/agents/options. */
export interface UserAgentOptions {
  replyLanguages: string[];
  toolProfiles: string[];
  knowledgeScopes: { id: string; type: string }[];
  connectorTools: { id: string; kind: string }[];
  connectedKinds: string[];
  models: UserAgentPlatformModel[];
  templates: string[];
  /** USER-TEAMS-01: absent from an older gateway; read as no choices. */
  teamChoices?: UserAgentTeamChoice[];
  limits: {
    maxInstructionsChars: number;
    maxToneChars: number;
    maxKnowledgeScopes: number;
    maxBudgetCredits: number;
    platformDailyCreditsPerUser: number;
  };
}

/** Result of a save. `code` is the gateway's stable refusal code on a 400. */
export interface UserAgentSaveResult {
  agent?: UserAgent;
  error?: string;
  code?: string;
}

export interface UseUserAgentsResult {
  agents: UserAgent[];
  loading: boolean;
  error: string | null;
  createAgent: (dto: CreateAgentDto) => Promise<UserAgentSaveResult>;
  createAgentFromTemplate: (dto: CreateAgentFromTemplateDto) => Promise<UserAgentSaveResult>;
  updateAgent: (agentId: string, dto: UpdateAgentDto) => Promise<UserAgentSaveResult>;
  deleteAgent: (agentId: string) => Promise<{ error?: string }>;
  refetch: () => Promise<void>;
}

/** One workflow from GET /api/collaboration/workflows (BIZ-USER-01C), as the summary needs it. */
export interface UserWorkflowSummaryItem {
  id: string;
  status: 'active' | 'draft' | 'disabled';
  /** True when a test run passed at the workflow's current version. */
  tested: boolean;
  knowledgeScopeIds: string[];
  model: UserAgentModel | null;
  budgetPerRunCredits: number | null;
  budgetPerDayCredits: number | null;
  spentTodayCredits: number;
  lastRunCredits: number | null;
}

function summaryRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function summaryCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/** Reads the workflows list. Entries without an id are left out; an unknown status reads as disabled. */
export function readWorkflowSummaries(body: unknown): UserWorkflowSummaryItem[] {
  if (!summaryRecord(body) || !Array.isArray(body.workflows)) {
    return [];
  }
  const items: UserWorkflowSummaryItem[] = [];
  for (const entry of body.workflows) {
    if (!summaryRecord(entry) || typeof entry.id !== 'string' || entry.id.length === 0) {
      continue;
    }
    let model: UserAgentModel | null = null;
    if (summaryRecord(entry.model)) {
      if (entry.model.choice === 'server') {
        model = { choice: 'server' };
      } else if (
        entry.model.choice === 'platform' &&
        typeof entry.model.id === 'string' &&
        entry.model.id.length > 0
      ) {
        model = { choice: 'platform', id: entry.model.id };
      }
    }
    items.push({
      id: entry.id,
      status: entry.status === 'active' || entry.status === 'draft' ? entry.status : 'disabled',
      tested: entry.tested === true,
      knowledgeScopeIds: Array.isArray(entry.knowledgeScopeIds)
        ? entry.knowledgeScopeIds.filter((id): id is string => typeof id === 'string')
        : [],
      model,
      budgetPerRunCredits: summaryCount(entry.budgetPerRunCredits),
      budgetPerDayCredits: summaryCount(entry.budgetPerDayCredits),
      spentTodayCredits: summaryCount(entry.spentTodayCredits) ?? 0,
      lastRunCredits: summaryCount(entry.lastRunCredits),
    });
  }
  return items;
}

export async function fetchWorkflowSummariesRequest(): Promise<{
  items?: UserWorkflowSummaryItem[];
  error?: string;
}> {
  try {
    const response = await fetch('/api/collaboration/workflows', { credentials: 'include' });
    if (response.status === 401) {
      return { error: 'AUTH_EXPIRED' };
    }
    if (!response.ok) {
      return { error: 'SUMMARY_FAILED' };
    }
    return { items: readWorkflowSummaries(await response.json()) };
  } catch {
    return { error: 'SUMMARY_FAILED' };
  }
}

export type UserWorkflowSummaryState = 'loading' | 'failed' | 'loaded';

export interface UseWorkflowSummariesResult {
  state: UserWorkflowSummaryState;
  items: UserWorkflowSummaryItem[];
  retry: () => void;
  refetch: () => void;
}

/** Loads the workflow summaries once `enabled` is true (the owner has at least one workflow). */
export function useWorkflowSummaries(enabled: boolean): UseWorkflowSummariesResult {
  const [state, setState] = useState<UserWorkflowSummaryState>('loading');
  const [items, setItems] = useState<UserWorkflowSummaryItem[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let active = true;
    void fetchWorkflowSummariesRequest().then((result) => {
      if (!active) {
        return;
      }
      if (result.items) {
        setItems(result.items);
        setState('loaded');
      } else {
        setState('failed');
      }
    });
    return () => {
      active = false;
    };
  }, [enabled, attempt]);

  // A retry shows the loading text again; a refetch after a save keeps the last answer on screen.
  const retry = useCallback(() => {
    setState('loading');
    setAttempt((current) => current + 1);
  }, []);
  const refetch = useCallback(() => setAttempt((current) => current + 1), []);

  return { state, items, retry, refetch };
}

/** The PATCH body that switches a workflow on (active) or off (disabled). */
export function userAgentSwitchBody(on: boolean): { status: 'active' | 'disabled' } {
  return { status: on ? 'active' : 'disabled' };
}

export type UserAgentDeletePhase = 'idle' | 'confirming' | 'pending';
export type UserAgentDeleteEvent = 'open' | 'cancel' | 'confirm' | 'settled';

export function shouldShowUserAgentDeleteControl(isUserCreated: boolean | undefined): boolean {
  return isUserCreated === true;
}

export function nextUserAgentDeletePhase(
  phase: UserAgentDeletePhase,
  event: UserAgentDeleteEvent,
): UserAgentDeletePhase {
  if (event === 'open') {
    return phase === 'idle' ? 'confirming' : phase;
  }
  if (event === 'cancel') {
    return phase === 'confirming' ? 'idle' : phase;
  }
  if (event === 'confirm') {
    return phase === 'confirming' ? 'pending' : phase;
  }
  if (event === 'settled') {
    return 'idle';
  }
  return phase;
}

export function canSubmitUserAgentDelete(phase: UserAgentDeletePhase): boolean {
  return phase === 'confirming';
}

export function nextSelectedUserAgentIdAfterDelete(
  selectedId: string | null,
  deletedId: string,
): string | null {
  return selectedId === deletedId ? null : selectedId;
}

export function removeUserAgentFromList<T extends { id: string }>(agents: T[], deletedId: string): T[] {
  return agents.filter((agent) => agent.id !== deletedId);
}

export async function deleteUserAgentRequest(agentId: string): Promise<{ error?: string }> {
  try {
    const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (response.status === 401) {
      return { error: 'AUTH_EXPIRED' };
    }

    if (!response.ok) {
      return { error: 'DELETE_FAILED' };
    }

    return {};
  } catch {
    return { error: 'DELETE_FAILED' };
  }
}

function jsonWriteHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const csrfToken = readCsrfToken();
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  return headers;
}

async function saveUserAgentRequest(
  path: string,
  method: 'POST' | 'PATCH',
  body: unknown,
  failure: string,
): Promise<UserAgentSaveResult> {
  try {
    const response = await fetch(path, {
      method,
      headers: jsonWriteHeaders(),
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (response.status === 401) {
      return { error: 'AUTH_EXPIRED' };
    }

    if (response.status === 400) {
      const parsed = (await response.json()) as { message?: string | string[]; code?: unknown };
      const msg = Array.isArray(parsed.message)
        ? parsed.message.join('; ')
        : (parsed.message ?? 'Validation failed');
      return typeof parsed.code === 'string' ? { error: msg, code: parsed.code } : { error: msg };
    }

    // WORKFLOW-STATUS-03: a 409 refusal (WORKFLOW_NOT_TESTED, WORKFLOW_INVALID) carries the
    // server's code like a 400 does, so the panel can name the reason at once. A 409
    // without a code stays the generic failure.
    if (response.status === 409) {
      const parsed = (await response.json()) as { message?: string | string[]; code?: unknown };
      if (typeof parsed.code !== 'string') {
        return { error: failure };
      }
      const msg = Array.isArray(parsed.message)
        ? parsed.message.join('; ')
        : (parsed.message ?? failure);
      return { error: msg, code: parsed.code };
    }

    if (response.status === 404) {
      return { error: 'NOT_FOUND' };
    }

    if (!response.ok) {
      return { error: failure };
    }

    return { agent: (await response.json()) as UserAgent };
  } catch {
    return { error: failure };
  }
}

export function createUserAgentRequest(dto: CreateAgentDto): Promise<UserAgentSaveResult> {
  return saveUserAgentRequest('/api/agents', 'POST', dto, 'CREATE_FAILED');
}

export function createUserAgentFromTemplateRequest(
  dto: CreateAgentFromTemplateDto,
): Promise<UserAgentSaveResult> {
  return saveUserAgentRequest('/api/agents/from-template', 'POST', dto, 'CREATE_FAILED');
}

export function updateUserAgentRequest(
  agentId: string,
  dto: UpdateAgentDto,
): Promise<UserAgentSaveResult> {
  return saveUserAgentRequest(
    `/api/agents/${encodeURIComponent(agentId)}`,
    'PATCH',
    dto,
    'UPDATE_FAILED',
  );
}

export async function fetchUserAgentOptionsRequest(): Promise<{
  options?: UserAgentOptions;
  error?: string;
}> {
  try {
    const response = await fetch('/api/agents/options', { credentials: 'include' });
    if (response.status === 401) {
      return { error: 'AUTH_EXPIRED' };
    }
    if (!response.ok) {
      return { error: 'OPTIONS_FAILED' };
    }
    return { options: (await response.json()) as UserAgentOptions };
  } catch {
    return { error: 'OPTIONS_FAILED' };
  }
}

export interface UseUserAgentOptionsResult {
  options: UserAgentOptions | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/** Loads the editor's options once `enabled` is true (the form is open). */
export function useUserAgentOptions(enabled: boolean): UseUserAgentOptionsResult {
  const [options, setOptions] = useState<UserAgentOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void fetchUserAgentOptionsRequest().then((result) => {
      if (!active) {
        return;
      }
      if (result.options) {
        setOptions(result.options);
      } else {
        setError(result.error ?? 'OPTIONS_FAILED');
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [enabled, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return { options, loading, error, retry };
}

export function useUserAgents(): UseUserAgentsResult {
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agents', { credentials: 'include' });

      if (response.status === 401) {
        setError('AUTH_EXPIRED');
        return;
      }

      if (!response.ok) {
        throw new Error('FETCH_FAILED');
      }

      const data = (await response.json()) as { agents: UserAgent[] };
      setAgents(data.agents);
    } catch {
      setError('FETCH_FAILED');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const createAgent = useCallback(
    async (dto: CreateAgentDto): Promise<UserAgentSaveResult> => {
      const result = await createUserAgentRequest(dto);
      if (result.agent) {
        await fetchAgents();
      }
      return result;
    },
    [fetchAgents],
  );

  const createAgentFromTemplate = useCallback(
    async (dto: CreateAgentFromTemplateDto): Promise<UserAgentSaveResult> => {
      const result = await createUserAgentFromTemplateRequest(dto);
      if (result.agent) {
        await fetchAgents();
      }
      return result;
    },
    [fetchAgents],
  );

  const updateAgent = useCallback(
    async (agentId: string, dto: UpdateAgentDto): Promise<UserAgentSaveResult> => {
      const result = await updateUserAgentRequest(agentId, dto);
      if (result.agent) {
        await fetchAgents();
      }
      return result;
    },
    [fetchAgents],
  );

  const deleteAgent = useCallback(async (agentId: string): Promise<{ error?: string }> => {
    const result = await deleteUserAgentRequest(agentId);
    if (!result.error) {
      setAgents((current) => removeUserAgentFromList(current, agentId));
    }
    return result;
  }, []);

  return {
    agents,
    loading,
    error,
    createAgent,
    createAgentFromTemplate,
    updateAgent,
    deleteAgent,
    refetch: fetchAgents,
  };
}
