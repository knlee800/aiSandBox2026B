'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface BillingBalance {
  balance: number;
  monthlyAllocation: number;
  planId: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
}

export interface BillingSubscription {
  planType: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAt: string | null;
}

export interface BillingData {
  balance: BillingBalance | null;
  subscription: BillingSubscription | null;
  loading: boolean;
  error: string | null;
}

export function useBillingData() {
  const [balance, setBalance] = useState<BillingBalance | null>(null);
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const fetchBillingData = useCallback(async (options?: { silent?: boolean }) => {
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
      const [balanceRes, subscriptionRes] = await Promise.all([
        fetch('/api/billing/balance', { credentials: 'include' }),
        fetch('/api/billing/subscription', { credentials: 'include' }),
      ]);

      if (!balanceRes.ok || !subscriptionRes.ok) {
        throw new Error('FETCH_FAILED');
      }

      const balanceData = await balanceRes.json();
      const subscriptionData = await subscriptionRes.json();

      setBalance(balanceData);
      setSubscription(subscriptionData);
      setError(null);
    } catch {
      setError('FETCH_FAILED');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => fetchBillingData(), [fetchBillingData]);

  useEffect(() => {
    void fetchBillingData();

    const handleFocus = () => {
      void fetchBillingData({ silent: true });
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchBillingData]);

  return { balance, subscription, loading, error, refetch };
}
