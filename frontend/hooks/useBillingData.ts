'use client';

import { useState, useEffect, useCallback } from 'react';

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

  const fetchBillingData = useCallback(async () => {
    setLoading(true);
    setError(null);

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
    } catch {
      setError('FETCH_FAILED');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  return { balance, subscription, loading, error, refetch: fetchBillingData };
}
