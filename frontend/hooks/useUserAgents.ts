'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UserAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  status: 'active' | 'draft' | 'disabled';
  initials: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentDto {
  name: string;
  role: string;
  description: string;
}

export interface UseUserAgentsResult {
  agents: UserAgent[];
  loading: boolean;
  error: string | null;
  createAgent: (dto: CreateAgentDto) => Promise<{ agent?: UserAgent; error?: string }>;
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
    async (dto: CreateAgentDto): Promise<{ agent?: UserAgent; error?: string }> => {
      try {
        const response = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: dto.name, role: dto.role, description: dto.description }),
        });

        if (response.status === 401) {
          return { error: 'AUTH_EXPIRED' };
        }

        if (response.status === 400) {
          const body = (await response.json()) as { message?: string | string[] };
          const msg = Array.isArray(body.message) ? body.message.join('; ') : (body.message ?? 'Validation failed');
          return { error: msg };
        }

        if (!response.ok) {
          return { error: 'CREATE_FAILED' };
        }

        const created = (await response.json()) as UserAgent;
        await fetchAgents();
        return { agent: created };
      } catch {
        return { error: 'CREATE_FAILED' };
      }
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

  return { agents, loading, error, createAgent, deleteAgent, refetch: fetchAgents };
}
