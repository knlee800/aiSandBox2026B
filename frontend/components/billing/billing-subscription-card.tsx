'use client';

import React from 'react';
import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { BillingBalance, BillingSubscription } from '../../hooks/useBillingData';

interface BillingSubscriptionCardProps {
  subscription: BillingSubscription | null;
  balance: BillingBalance | null;
  t: (key: string) => string;
}

const PLAN_LABEL_KEYS: Record<string, string> = {
  free: 'planFree',
  starter: 'planStarter',
  pro: 'planPro',
  team: 'planTeam',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  active: 'statusActive',
  trialing: 'statusTrialing',
  past_due: 'statusPastDue',
  cancelled: 'statusCancelled',
  expired: 'statusExpired',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-600',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function BillingSubscriptionCard({
  subscription,
  balance,
  t,
}: BillingSubscriptionCardProps) {
  const planType = subscription?.planType ?? balance?.planId ?? 'free';
  const status = subscription?.status ?? 'active';
  const planLabelKey = PLAN_LABEL_KEYS[planType] ?? 'planFree';
  const statusLabelKey = STATUS_LABEL_KEYS[status] ?? 'statusActive';
  const statusColor = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';

  const isFree = !subscription || planType === 'free';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-2 mb-4">
        <SparklesIcon className="h-5 w-5 text-gray-500" />
        <h2 className="text-sm font-medium text-gray-600">{t('subscription')}</h2>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <p className="text-xl font-semibold text-gray-900">{t(planLabelKey)}</p>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
          {t(statusLabelKey)}
        </span>
      </div>

      {isFree ? (
        <p className="text-sm text-gray-500">
          {t('freeCreditsNote').replace('{count}', '500')}
        </p>
      ) : (
        <div className="text-sm text-gray-500">
          {subscription?.cancelAt ? (
            <div className="flex items-center gap-1">
              <ArrowPathIcon className="h-4 w-4" />
              <span>{t('cancelledOn').replace('{date}', formatDate(subscription.cancelAt))}</span>
            </div>
          ) : subscription?.currentPeriodEnd ? (
            <div className="flex items-center gap-1">
              <ArrowPathIcon className="h-4 w-4" />
              <span>{t('renewsOn').replace('{date}', formatDate(subscription.currentPeriodEnd))}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
