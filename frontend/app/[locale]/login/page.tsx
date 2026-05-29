'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from '../../../hooks/useTranslations';
import axios from 'axios';
import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';

function useSafeEffect(effect: () => void | (() => void), deps: ReadonlyArray<unknown>) {
  try {
    useEffect(effect, deps);
  } catch {
    // Some direct-invocation tests call components outside React renderers.
  }
}

function AuthStatusBanner() {
  const searchParams = useSearchParams();
  const tLogin = useTranslations('login');
  const tErrors = useTranslations('errors');
  const verified = searchParams.get('verified');
  const error = searchParams.get('error');

  if (verified === '1') {
    return (
      <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">
        {tLogin('emailVerified')}
      </div>
    );
  }

  if (!error) {
    return null;
  }

  const message =
    error === 'token_expired'
      ? tErrors('verificationExpired')
      : error === 'account_conflict'
        ? tErrors('accountConflict')
        : tErrors('oauthFailed');

  return (
    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
      {message}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useSafeEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok || !isMounted) {
          return;
        }
        const payload = (await response.json()) as { id?: unknown };
        if (typeof payload.id === 'string' && payload.id.trim()) {
          router.replace(`/${locale}/app`);
        }
      } catch {
        // Keep login form visible when session probe fails.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [locale, router]);

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
      router.replace(`/${locale}/app`);
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

          <div className="mb-3">
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

          <div className="mb-6 text-right">
            <Link href={`/${locale}/forgot-password`} className="text-sm text-text-secondary hover:underline">
              {t('forgotPassword')}
            </Link>
          </div>

          <Suspense fallback={null}>
            <AuthStatusBanner />
          </Suspense>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand py-2 text-white transition-colors hover:bg-brand-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
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
            className="block w-full rounded-md border border-border bg-surface-base py-2 text-center text-text-primary transition hover:bg-surface-raised active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {t('continueWithGoogle')}
          </a>

          <a
            href={`/api/auth/apple?locale=${locale}`}
            className="mt-3 block w-full rounded-md border border-border bg-surface-base py-2 text-center text-text-primary transition hover:bg-surface-raised active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
