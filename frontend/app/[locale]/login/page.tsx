'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from '../../../hooks/useTranslations';
import axios from 'axios';
import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function LoginPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await axios.post('/api/auth/login', {
        email,
        password,
      }, {
        headers: {
          'Accept-Language': locale,
        },
      });
      router.push(`/${locale}/app`);
    } catch (err: any) {
      setError(err.response?.data?.message || t('loginFailed'));
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

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="email">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-base px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
              required
            />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="password">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-base px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
              required
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand py-2 text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t('loggingIn') : t('loginButton')}
          </button>

          <div className="my-4 flex items-center gap-3 text-sm text-text-secondary">
            <div className="h-px flex-1 bg-border" />
            <span>{t('orContinueWith')}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <a
            href={`/api/auth/google?locale=${locale}`}
            className="block w-full rounded-md border border-border bg-surface-base py-2 text-center text-text-primary transition-colors hover:bg-surface-raised"
          >
            {t('continueWithGoogle')}
          </a>

          <a
            href={`/api/auth/apple?locale=${locale}`}
            className="mt-3 block w-full rounded-md border border-border bg-surface-base py-2 text-center text-text-primary transition-colors hover:bg-surface-raised"
          >
            {t('continueWithApple')}
          </a>

          <p className="mt-4 text-center text-sm text-text-secondary">
            {t('needAccount')}{' '}
            <Link
              href={`/${locale}/register`}
              className="font-medium text-brand hover:text-brand-hover hover:underline"
            >
              {t('startHere')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
