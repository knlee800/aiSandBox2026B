'use client';

import { useEffect, useReducer, useState } from 'react';
import {
  combineOfficeHandoffReads,
  OFFICE_HANDOFF_INITIAL,
  officeHandoffCollaborationRunIds,
  officeHandoffFromResponse,
  reduceOfficeHandoff,
  type OfficeHandoffRead,
  type OfficeHandoffViewState,
  type OfficeRun,
} from '@/lib/office/office.logic';

export type OfficeHandoffError = 'AUTH_EXPIRED';

export interface UseOfficeHandoffsResult extends OfficeHandoffViewState {
  error: OfficeHandoffError | null;
  retry: () => void;
}

async function readCollaborationRun(collaborationRunId: string): Promise<OfficeHandoffRead> {
  try {
    const response = await fetch(
      `/api/collaboration/runs/${encodeURIComponent(collaborationRunId)}`,
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      },
    );
    let payload: unknown = null;
    if (response.status !== 401 && response.status !== 403) {
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
    }
    return {
      collaborationRunId,
      result: officeHandoffFromResponse(response.status, payload),
    };
  } catch {
    return { collaborationRunId, result: { kind: 'error' } };
  }
}

/**
 * Reads hand-off status for active collaboration runs and for recent runs that
 * finished within 24 hours, newest first, at most five.
 * Refetches when the office run refresh time changes (visible again, Refresh,
 * or the active poll) and when Try again is pressed.
 * It does not start its own timer, and it does not start a read while the tab is hidden.
 */
export function useOfficeHandoffs(
  enabled: boolean,
  activeRuns: readonly OfficeRun[],
  recentRuns: readonly OfficeRun[],
  updatedAt: number | null,
): UseOfficeHandoffsResult {
  const [state, dispatch] = useReducer(reduceOfficeHandoff, OFFICE_HANDOFF_INITIAL);
  const [error, setError] = useState<OfficeHandoffError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const idKey = officeHandoffCollaborationRunIds({
    activeRuns,
    recentRuns,
    nowMs: Date.now(),
  }).join('\n');

  useEffect(() => {
    if (!enabled || updatedAt == null) {
      return;
    }
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    const ids = idKey.length > 0 ? idKey.split('\n') : [];
    if (ids.length === 0) {
      dispatch({ type: 'cleared' });
      return;
    }

    let active = true;
    dispatch({ type: 'fetch-start' });
    void (async () => {
      const reads = await Promise.all(ids.map((id) => readCollaborationRun(id)));
      if (!active) {
        return;
      }
      const combined = combineOfficeHandoffReads(reads);
      if (combined.type === 'auth') {
        setError('AUTH_EXPIRED');
        return;
      }
      setError(null);
      if (combined.type === 'forbidden') {
        dispatch({ type: 'forbidden' });
        return;
      }
      if (combined.type === 'error') {
        dispatch({ type: 'error', waitingRunIds: combined.waitingRunIds });
        return;
      }
      dispatch({ type: 'ready', waitingRunIds: combined.waitingRunIds });
    })();

    return () => {
      active = false;
    };
  }, [enabled, updatedAt, attempt, idKey]);

  return {
    ...state,
    error,
    retry: () => setAttempt((value) => value + 1),
  };
}
