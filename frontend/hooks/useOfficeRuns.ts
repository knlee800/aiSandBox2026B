'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  activeRunsEnded,
  normalizeOfficeRuns,
  OFFICE_POLL_MS,
  type OfficeRun,
} from '@/lib/office/office.logic';

export type OfficeRunsError = 'AUTH_EXPIRED' | 'FETCH_FAILED';

export interface UseOfficeRunsResult {
  activeRuns: OfficeRun[];
  recentRuns: OfficeRun[];
  settled: boolean;
  error: OfficeRunsError | null;
  stale: boolean;
  updatedAt: number | null;
  refresh: () => void;
}

type RunListResult = { runs: OfficeRun[] } | { error: OfficeRunsError };

function isRunError(result: RunListResult): result is { error: OfficeRunsError } {
  return 'error' in result;
}

async function fetchOfficeRunList(state: 'active' | 'recent'): Promise<RunListResult> {
  const response = await fetch(`/api/ai/executions?state=${state}&limit=50`, {
    credentials: 'include',
  });

  if (response.status === 401) {
    return { error: 'AUTH_EXPIRED' };
  }

  if (!response.ok) {
    return { error: 'FETCH_FAILED' };
  }

  const payload: unknown = await response.json();
  const runs = normalizeOfficeRuns(payload);
  if (!runs) {
    return { error: 'FETCH_FAILED' };
  }

  return { runs };
}

export function useOfficeRuns(enabled: boolean, poll: boolean): UseOfficeRunsResult {
  const [activeRuns, setActiveRuns] = useState<OfficeRun[]>([]);
  const [recentRuns, setRecentRuns] = useState<OfficeRun[]>([]);
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState<OfficeRunsError | null>(null);
  const [stale, setStale] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const seq = useRef(0);
  const hasData = useRef(false);
  const activeRunsRef = useRef<OfficeRun[]>([]);
  const pollRef = useRef(poll);
  pollRef.current = poll;

  const commitActive = useCallback((runs: OfficeRun[]) => {
    activeRunsRef.current = runs;
    setActiveRuns(runs);
  }, []);

  const fail = useCallback((kind: OfficeRunsError) => {
    setError(kind);
    setStale(kind === 'FETCH_FAILED' && hasData.current);
    setSettled(true);
  }, []);

  const refreshAll = useCallback(async () => {
    const token = ++seq.current;
    try {
      const [activeResult, recentResult] = await Promise.all([
        fetchOfficeRunList('active'),
        fetchOfficeRunList('recent'),
      ]);
      if (token !== seq.current) {
        return;
      }
      if (
        (isRunError(activeResult) && activeResult.error === 'AUTH_EXPIRED') ||
        (isRunError(recentResult) && recentResult.error === 'AUTH_EXPIRED')
      ) {
        fail('AUTH_EXPIRED');
        return;
      }
      if (isRunError(activeResult) || isRunError(recentResult)) {
        fail('FETCH_FAILED');
        return;
      }
      commitActive(activeResult.runs);
      setRecentRuns(recentResult.runs);
      hasData.current = true;
      setUpdatedAt(Date.now());
      setError(null);
      setStale(false);
      setSettled(true);
    } catch {
      if (token !== seq.current) {
        return;
      }
      fail('FETCH_FAILED');
    }
  }, [commitActive, fail]);

  const refreshActive = useCallback(async () => {
    const token = ++seq.current;
    try {
      const activeResult = await fetchOfficeRunList('active');
      if (token !== seq.current) {
        return;
      }
      if (isRunError(activeResult)) {
        fail(activeResult.error);
        return;
      }
      if (activeRunsEnded(activeRunsRef.current, activeResult.runs)) {
        void refreshAll();
        return;
      }
      commitActive(activeResult.runs);
      hasData.current = true;
      setUpdatedAt(Date.now());
      setError(null);
      setStale(false);
      setSettled(true);
    } catch {
      if (token !== seq.current) {
        return;
      }
      fail('FETCH_FAILED');
    }
  }, [commitActive, fail, refreshAll]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void refreshAll();
    return () => {
      seq.current += 1;
    };
  }, [enabled, refreshAll]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let timer: number | null = null;
    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const start = () => {
      stop();
      if (!pollRef.current || document.hidden) {
        return;
      }
      timer = window.setInterval(() => {
        if (document.hidden || !pollRef.current) {
          return;
        }
        void refreshActive();
      }, OFFICE_POLL_MS);
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      void refreshAll();
      start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, poll, refreshActive, refreshAll]);

  const refresh = useCallback(() => {
    void refreshAll();
  }, [refreshAll]);

  return {
    activeRuns,
    recentRuns,
    settled,
    error,
    stale,
    updatedAt,
    refresh,
  };
}
