'use client';

import React from 'react';
import { BanknotesIcon } from '@heroicons/react/24/outline';

interface BillingTopUpSectionProps {
  t: (key: string) => string;
  onCheckout: (topUpPackId: string) => void;
  checkoutLoading: string | null;
  disabled: boolean;
}

const TOP_UP_PACKS = [
  { id: 'topup_1000', credits: 1000 },
  { id: 'topup_5000', credits: 5000 },
  { id: 'topup_20000', credits: 20000 },
] as const;

export default function BillingTopUpSection({
  t,
  onCheckout,
  checkoutLoading,
  disabled,
}: BillingTopUpSectionProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-2 mb-4">
        <BanknotesIcon className="h-5 w-5 text-gray-500" />
        <h2 className="text-sm font-medium text-gray-600">{t('topUp')}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TOP_UP_PACKS.map((pack) => (
          <div
            key={pack.id}
            className="rounded-lg border border-gray-100 bg-gray-50 p-4 flex flex-col items-center"
          >
            <p className="text-lg font-semibold text-gray-900 mb-1">
              {t('topUpPack').replace('{count}', pack.credits.toLocaleString())}
            </p>
            <button
              type="button"
              onClick={() => onCheckout(pack.id)}
              disabled={disabled || checkoutLoading === pack.id}
              className="mt-3 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {checkoutLoading === pack.id
                ? '...'
                : t('buyCredits').replace('{count}', pack.credits.toLocaleString())}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
