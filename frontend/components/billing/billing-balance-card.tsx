'use client';

import React from 'react';
import { CreditCardIcon } from '@heroicons/react/24/outline';
import type { BillingBalance } from '../../hooks/useBillingData';

interface BillingBalanceCardProps {
  balance: BillingBalance | null;
  t: (key: string) => string;
}

export default function BillingBalanceCard({ balance, t }: BillingBalanceCardProps) {
  const creditCount = balance?.balance ?? 0;
  const monthlyAllocation = balance?.monthlyAllocation ?? 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-2 mb-4">
        <CreditCardIcon className="h-5 w-5 text-gray-500" />
        <h2 className="text-sm font-medium text-gray-600">{t('balance')}</h2>
      </div>
      <p className="text-3xl font-bold text-gray-900">
        {creditCount.toLocaleString()}
      </p>
      <p className="mt-1 text-sm text-gray-500">
        {t('monthlyAllocationValue').replace('{count}', monthlyAllocation.toLocaleString())}
      </p>
    </div>
  );
}
