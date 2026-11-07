'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BUILDER_FALLBACK_AGENT,
  parseSystemAgents,
  type PublicSystemAgent,
} from './agent-registry';

export type SystemAgentsError = 'AUTH_EXPIRED' | 'FETCH_FAILED';

export interface SystemAgentsLoadResult {
  agents: readonly PublicSystemAgent[];
  error: SystemAgentsError | null;
}

const FALLBACK_AGENTS: readonly PublicSystemAgent[] = [BUILDER_FALLBACK_AGENT];

export async function loadSystemAgents(
  fetchImpl: typeof fetch = fetch,
): Promise<SystemAgentsLoadResult> {
  try {
    const response = await fetchImpl('/api/system-agents', { credentials: 'include' });
    if (response.status === 401) {
      return { agents: [], error: 'AUTH_EXPIRED' };
    }
    if (!response.ok) {
      return { agents: FALLBACK_AGENTS, error: 'FETCH_FAILED' };
    }
    const parsed = parseSystemAgents(await response.json());
    if (!parsed || parsed.length === 0) {
      return { agents: FALLBACK_AGENTS, error: 'FETCH_FAILED' };
    }
    return { agents: parsed, error: null };
  } catch {
    return { agents: FALLBACK_AGENTS, error: 'FETCH_FAILED' };
  }
}

export interface UseSystemAgentsResult {
  agents: readonly PublicSystemAgent[];
  loading: boolean;
  error: SystemAgentsError | null;
  refetch: () => Promise<void>;
}

export function useSystemAgents(): UseSystemAgentsResult {
  const [agents, setAgents] = useState<readonly PublicSystemAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SystemAgentsError | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await loadSystemAgents();
    setAgents(result.agents);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { agents, loading, error, refetch };
}
