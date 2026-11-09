'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  officeRunDetailFromResponse,
  type OfficeRunDetailPhase,
  type OfficeRunDetailRequestError,
} from '@/lib/office/office.logic';

export interface UseOfficeRunDetailResult {
  phase: 'idle' | OfficeRunDetailPhase;
  output: string | null;
  error: OfficeRunDetailRequestError | null;
  retry: () => void;
}

export function useOfficeRunDetail(executionId: string | null): UseOfficeRunDetailResult {
  const [phase, setPhase] = useState<'idle' | OfficeRunDetailPhase>(
    executionId ? 'loading' : 'idle',
  );
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<OfficeRunDetailRequestError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [trackedId, setTrackedId] = useState<string | null>(executionId);
  const seq = useRef(0);

  if (executionId !== trackedId) {
    setTrackedId(executionId);
    setPhase(executionId ? 'loading' : 'idle');
    setOutput(null);
    setError(null);
  }

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!executionId) {
      return;
    }

    const token = ++seq.current;
    setPhase('loading');
    setOutput(null);
    setError(null);
    let active = true;

    const finish = (apply: () => void) => {
      if (!active || token !== seq.current) {
        return;
      }
      apply();
    };

    void (async () => {
      try {
        const response = await fetch(
          `/api/ai/executions/${encodeURIComponent(executionId)}`,
          {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          },
        );
        let payload: unknown = null;
        if (response.status !== 401 && response.status !== 404) {
          try {
            payload = await response.json();
          } catch {
            payload = null;
          }
        }
        const result = officeRunDetailFromResponse(response.status, payload);
        finish(() => {
          if (result.phase === 'output') {
            setPhase('output');
            setOutput(result.output);
            setError(null);
            return;
          }
          if (result.phase === 'empty') {
            setPhase('empty');
            setOutput(null);
            setError(null);
            return;
          }
          if (result.phase === 'notFound') {
            setPhase('notFound');
            setOutput(null);
            setError(null);
            return;
          }
          setPhase('error');
          setOutput(null);
          setError(result.error);
        });
      } catch {
        finish(() => {
          setPhase('error');
          setOutput(null);
          setError('FETCH_FAILED');
        });
      }
    })();

    return () => {
      active = false;
      seq.current += 1;
    };
  }, [executionId, attempt]);

  return { phase, output, error, retry };
}
