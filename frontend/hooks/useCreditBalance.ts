'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type CreditBalanceFetchError = 'FETCH_FAILED';

export interface CreditBalanceFields {
  balance: number;
  monthlyAllocation: number;
  planId: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
}

export interface UseCreditBalanceResult {
  balance: number | null;
  loading: boolean;
  error: CreditBalanceFetchError | null;
  refetch: () => Promise<void>;
}

function readNumericBalance(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const balance = (payload as CreditBalanceFields).balance;
  if (typeof balance !== 'number' || !Number.isFinite(balance)) {
    return null;
  }

  return balance;
}

export function useCreditBalance(): UseCreditBalanceResult {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<CreditBalanceFetchError | null>(null);
  const inFlightRef = useRef(false);

  const fetchCreditBalance = useCallback(async (options?: { silent?: boolean }) => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;

    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await fetch('/api/billing/balance', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('FETCH_FAILED');
      }

      const payload: unknown = await response.json();
      const nextBalance = readNumericBalance(payload);
      if (nextBalance === null) {
        throw new Error('FETCH_FAILED');
      }

      setBalance(nextBalance);
      setError(null);
    } catch {
      setError('FETCH_FAILED');
      setBalance(null);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => fetchCreditBalance(), [fetchCreditBalance]);

  useEffect(() => {
    void fetchCreditBalance();

    const handleFocus = () => {
      void fetchCreditBalance({ silent: true });
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchCreditBalance]);

  return { balance, loading, error, refetch };
}
