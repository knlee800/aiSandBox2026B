'use client';

import { Suspense, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslations } from '../../../hooks/useTranslations';

function ResetPasswordForm({ locale }: { locale: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const t = useTranslations('resetPassword');
  const tErrors = useTranslations('errors');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError(t('passwordTooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    setLoading(true);

    try {
      await axios.post(
        '/api/auth/password-reset/confirm',
        { token, newPassword },
        {
          headers: {
            'Accept-Language': locale,
          },
        },
      );
      setSuccess(true);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 400 || status === 401) {
        setError(tErrors('tokenExpired'));
      } else {
        setError(t('resetFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{tErrors('tokenExpired')}</div>
        <p className="text-center text-sm text-text-secondary">
          <Link
            href={`/${locale}/forgot-password`}
            className="font-medium text-brand hover:text-brand-hover hover:underline"
          >
            {t('requestNew')}
          </Link>
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-green-100 text-green-700 rounded-md text-sm">{t('successMessage')}</div>
        <p className="text-center text-sm text-text-secondary">
          <Link href={`/${locale}/login`} className="font-medium text-brand hover:text-brand-hover hover:underline">
            {t('signIn')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="new-password">
          {t('newPassword')}
        </label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="w-full rounded-md border border-border bg-surface-base px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
          required
        />
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="confirm-password">
          {t('confirmPassword')}
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
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
        {loading ? t('resetting') : t('submitButton')}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('resetPassword');

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-raised">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-96 rounded-lg border border-border bg-surface-base p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-text-primary">{t('title')}</h1>
        <Suspense fallback={null}>
          <ResetPasswordForm locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
