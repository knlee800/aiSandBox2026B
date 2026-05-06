'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslations } from '../../../hooks/useTranslations';

export default function RegisterPage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('register');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      await axios.post(
        '/api/auth/register',
        {
          email,
          password,
        },
        {
          headers: {
            'Accept-Language': locale,
          },
        },
      );

      setSuccessMessage(t('successMessage'));
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err.response?.data?.message || t('registerFailed'));
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

        <form onSubmit={handleRegister}>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="register-email">
              {t('email')}
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-base px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
              required
            />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="register-password">
              {t('password')}
            </label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-base px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
              required
            />
          </div>

          {error ? <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div> : null}
          {successMessage ? (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">{successMessage}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand py-2 text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t('registering') : t('registerButton')}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          {t('alreadyHaveAccount')}{' '}
          <Link href={`/${locale}/login`} className="font-medium text-brand hover:text-brand-hover hover:underline">
            {t('loginHere')}
          </Link>
        </p>
      </div>
    </div>
  );
}
