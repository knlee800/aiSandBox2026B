'use client';

import React, { useState, useCallback } from 'react';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useTranslations, useLocale } from '../../hooks/useTranslations';
import { useBillingData } from '../../hooks/useBillingData';
import BillingBalanceCard from './billing-balance-card';
import BillingSubscriptionCard from './billing-subscription-card';
import BillingTopUpSection from './billing-topup-section';

export default function BillingPageClient() {
  const t = useTranslations('billing');
  const locale = useLocale();
  const { balance, subscription, loading, error, refetch } = useBillingData();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<'success' | 'cancelled' | null>(null);

  // Parse checkout result from URL query params on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const result = params.get('checkout');
      if (result === 'success') setCheckoutResult('success');
      else if (result === 'cancelled') setCheckoutResult('cancelled');
    }
  });

  const buildCheckoutUrls = useCallback(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return {
      successUrl: `${origin}/${locale}/billing?checkout=success`,
      cancelUrl: `${origin}/${locale}/billing?checkout=cancelled`,
    };
  }, [locale]);

  const handleTopUpCheckout = useCallback(
    async (topUpPackId: string) => {
      setCheckoutLoading(topUpPackId);
      setCheckoutError(null);

      try {
        const { successUrl, cancelUrl } = buildCheckoutUrls();
        const res = await fetch('/api/billing/checkout/topup', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topUpPackId, successUrl, cancelUrl }),
        });

        if (!res.ok) {
          const status = res.status;
          if (status === 503) {
            setCheckoutError('billingUnavailable');
          } else if (status === 400) {
            setCheckoutError('invalidRequest');
          } else {
            setCheckoutError('checkoutError');
          }
          return;
        }

        const data = await res.json();
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          setCheckoutError('billingUnavailable');
        }
      } catch {
        setCheckoutError('checkoutError');
      } finally {
        setCheckoutLoading(null);
      }
    },
    [buildCheckoutUrls],
  );

  const handleSubscriptionCheckout = useCallback(
    async (planId: string) => {
      setCheckoutLoading(planId);
      setCheckoutError(null);

      try {
        const { successUrl, cancelUrl } = buildCheckoutUrls();
        const res = await fetch('/api/billing/checkout/subscription', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, successUrl, cancelUrl }),
        });

        if (!res.ok) {
          const status = res.status;
          if (status === 503) {
            setCheckoutError('billingUnavailable');
          } else if (status === 409) {
            setCheckoutError('activeSubscriptionExists');
          } else if (status === 400) {
            setCheckoutError('invalidRequest');
          } else {
            setCheckoutError('checkoutError');
          }
          return;
        }

        const data = await res.json();
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          setCheckoutError('billingUnavailable');
        }
      } catch {
        setCheckoutError('checkoutError');
      } finally {
        setCheckoutLoading(null);
      }
    },
    [buildCheckoutUrls],
  );

  const isFreeUser = !subscription || subscription.planType === 'free';
  const checkoutDisabled = !!checkoutLoading;

  // Loading state
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-100 rounded-lg" />
          <div className="h-32 bg-gray-100 rounded-lg" />
          <div className="h-48 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <ExclamationTriangleIcon className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-700 mb-4">{t('loadError')}</p>
          <button
            type="button"
            onClick={refetch}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <a
          href={`/${locale}/app`}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>{t('backToWorkspace')}</span>
        </a>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('pageTitle')}</h1>

      {/* Checkout result banners */}
      {checkoutResult === 'success' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 mb-6 flex items-center gap-2">
          <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">{t('checkoutSuccess')}</p>
        </div>
      )}
      {checkoutResult === 'cancelled' && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 mb-6 flex items-center gap-2">
          <XCircleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-700">{t('checkoutCancelled')}</p>
        </div>
      )}

      {/* Checkout error */}
      {checkoutError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6 flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{t(checkoutError)}</p>
        </div>
      )}

      {/* Balance + Subscription Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <BillingBalanceCard balance={balance} t={t} />
        <BillingSubscriptionCard subscription={subscription} balance={balance} t={t} />
      </div>

      {/* Upgrade section — only for free users */}
      {isFreeUser && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-6 mb-6">
          <h2 className="text-sm font-medium text-indigo-700 mb-3">{t('upgradePlan')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['starter', 'pro', 'team'] as const).map((plan) => (
              <button
                key={plan}
                type="button"
                onClick={() => handleSubscriptionCheckout(plan)}
                disabled={checkoutDisabled}
                className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {checkoutLoading === plan
                  ? '...'
                  : t('upgradeTo').replace('{plan}', t(`plan${plan.charAt(0).toUpperCase() + plan.slice(1)}`))}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top-up section */}
      <BillingTopUpSection
        t={t}
        onCheckout={handleTopUpCheckout}
        checkoutLoading={checkoutLoading}
        disabled={checkoutDisabled}
      />

      {/* Customer Portal — disabled/coming-soon */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-600 mb-2">{t('manageSubscription')}</h2>
        <p className="text-xs text-gray-400 mb-3">{t('manageSubscriptionComingSoon')}</p>
        <button
          type="button"
          disabled
          className="rounded-md border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
        >
          {t('manageSubscription')}
        </button>
      </div>
    </div>
  );
}
