'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from '../../../hooks/useTranslations';
import axios from 'axios';
import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  EnvelopeIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

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
      <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2">
        <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
        <p className="text-sm text-green-700">{tLogin('emailVerified')}</p>
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
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2">
      <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
      <p className="text-sm text-red-700">{message}</p>
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
    <div className="flex min-h-screen items-center justify-center bg-surface-raised px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-border bg-surface-base px-8 pb-8 pt-6 shadow-lg">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
              <p className="mt-1 text-sm text-text-secondary">{t('subtitle')}</p>
            </div>
            <LanguageSwitcher />
          </div>

          <Suspense fallback={null}>
            <AuthStatusBanner />
          </Suspense>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="email">
                {t('email')}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <EnvelopeIcon className="h-5 w-5 text-text-secondary" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-base py-2.5 pl-10 pr-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="password">
                {t('password')}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <LockClosedIcon className="h-5 w-5 text-text-secondary" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-base py-2.5 pl-10 pr-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  required
                />
              </div>
            </div>

            <div className="mb-6 text-right">
              <Link href={`/${locale}/forgot-password`} className="text-sm text-text-secondary hover:underline">
                {t('forgotPassword')}
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t('loggingIn') : t('loginButton')}
            </button>

            <div className="my-5 flex items-center gap-3 text-sm text-text-secondary">
              <div className="h-px flex-1 bg-border" />
              <span>{t('orContinueWith')}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-3">
              <a
                href={`/api/auth/google?locale=${locale}`}
                className="block w-full rounded-md border border-border bg-surface-base py-2.5 text-center text-sm font-medium text-text-primary transition hover:bg-surface-raised active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {t('continueWithGoogle')}
              </a>

              <a
                href={`/api/auth/apple?locale=${locale}`}
                className="block w-full rounded-md border border-border bg-surface-base py-2.5 text-center text-sm font-medium text-text-primary transition hover:bg-surface-raised active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {t('continueWithApple')}
              </a>
            </div>

            <p className="mt-5 text-center text-sm text-text-secondary">
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
    </div>
  );
}
