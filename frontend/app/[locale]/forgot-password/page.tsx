'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslations } from '../../../hooks/useTranslations';

export default function ForgotPasswordPage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('forgotPassword');
  const tErrors = useTranslations('errors');

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await axios.post(
        '/api/auth/password-reset/request',
        { email },
        {
          headers: {
            'Accept-Language': locale,
          },
        },
      );
      setSent(true);
    } catch {
      setError(tErrors('network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-raised">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-96 rounded-lg border border-border bg-surface-base p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-text-primary">{t('title')}</h1>

        {sent ? (
          <div className="space-y-4">
            <div className="p-3 bg-green-100 text-green-700 rounded-md text-sm">{t('sentMessage')}</div>
            <p className="text-center text-sm text-text-secondary">
              <Link
                href={`/${locale}/login`}
                className="font-medium text-brand hover:text-brand-hover hover:underline"
              >
                {t('backToLogin')}
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="forgot-password-email">
                {t('email')}
              </label>
              <input
                id="forgot-password-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-md border border-border bg-surface-base px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                required
              />
            </div>

            {error ? <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand py-2 text-white transition-colors hover:bg-brand-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t('sending') : t('submitButton')}
            </button>

            <p className="mt-4 text-center text-sm text-text-secondary">
              <Link
                href={`/${locale}/login`}
                className="font-medium text-brand hover:text-brand-hover hover:underline"
              >
                {t('backToLogin')}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
