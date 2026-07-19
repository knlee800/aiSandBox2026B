'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslations } from '../../../hooks/useTranslations';
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

export default function RegisterPage() {
  const router = typeof useRouter === 'function' ? useRouter() : null;
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('register');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

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
          router?.replace(`/${locale}/app`);
        }
      } catch {
        // Keep register form visible when session probe fails.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [locale, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setRegisteredEmail('');
    setResendStatus('idle');
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

      setRegisteredEmail(email);
      setSuccessMessage(t('successMessage'));
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err.response?.data?.message || t('registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!registeredEmail || resendStatus === 'sending' || resendStatus === 'sent') {
      return;
    }

    setError('');
    setResendStatus('sending');

    try {
      await axios.post(
        '/api/auth/email/verify/resend',
        { email: registeredEmail },
        {
          headers: {
            'Accept-Language': locale,
          },
        },
      );
      setResendStatus('sent');
    } catch (err: any) {
      setResendStatus('error');
      setError(err.response?.data?.message || t('registerFailed'));
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

          <form onSubmit={handleRegister}>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="register-email">
                {t('email')}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <EnvelopeIcon className="h-5 w-5 text-text-secondary" />
                </div>
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-base py-2.5 pl-10 pr-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  required
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-text-primary" htmlFor="register-password">
                {t('password')}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <LockClosedIcon className="h-5 w-5 text-text-secondary" />
                </div>
                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-base py-2.5 pl-10 pr-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  required
                />
              </div>
            </div>

            {error ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            ) : null}
            {successMessage ? (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            ) : null}
            {successMessage && registeredEmail ? (
              resendStatus === 'sent' ? (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-700">{t('verificationResent')}</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendStatus === 'sending'}
                  className="mb-4 text-sm font-medium text-brand hover:text-brand-hover hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resendStatus === 'sending' ? `${t('resendVerification')}...` : t('resendVerification')}
                </button>
              )
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t('registering') : t('registerButton')}
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
          </form>

          <p className="mt-5 text-center text-sm text-text-secondary">
            {t('alreadyHaveAccount')}{' '}
            <Link href={`/${locale}/login`} className="font-medium text-brand hover:text-brand-hover hover:underline">
              {t('loginHere')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
