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
  Pick<UserAgent, 'name' | 'role' | 'description'> &
    Omit<UserAgentWorkflowFields, 'toolProfile' | 'templateId'>
>;

export interface UserAgentPlatformModel {
  id: string;
  provider: string;
  creditsPer1kTokens: number;
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
