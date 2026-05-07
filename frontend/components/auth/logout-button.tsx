'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from '../../hooks/useTranslations';

type AuthMeResponse = {
  email?: unknown;
};

function getCsrfTokenFromCookie(): string | null {
  const csrfCookie = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('aisandbox_csrf='));

  return csrfCookie?.slice('aisandbox_csrf='.length) || null;
}

export default function LogoutButton() {
  const router = useRouter();
  const params = useParams();
  const tAccount = useTranslations('account');
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const locale = useMemo(() => {
    const localeParam = params?.locale;
    return typeof localeParam === 'string' && localeParam.trim() ? localeParam : 'en';
  }, [params]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          router.push(`/${locale}/login`);
          return;
        }

        const me = (await response.json()) as AuthMeResponse;
        const nextEmail =
          typeof me.email === 'string' && me.email.trim().length > 0 ? me.email.trim() : null;

        if (isMounted) {
          setEmail(nextEmail);
        }
      } catch {
        router.push(`/${locale}/login`);
        return;
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [locale, router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const csrfToken = getCsrfTokenFromCookie();

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
      });
    } catch {
      // redirect even when the logout request fails locally
    }

    router.push(`/${locale}/login`);
  };

  return (
    <section
      className="mx-auto max-w-6xl px-8 pt-8"
      data-testid="account-auth-section"
    >
      <div className="rounded-lg bg-white p-6 shadow">
        <p className="text-sm font-semibold text-gray-900">Account</p>
        {loading ? (
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        ) : email ? (
          <p className="mt-2 text-sm text-gray-600" data-testid="account-auth-email">
            {email}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          className="mt-4 inline-flex rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="account-logout-button"
        >
          {isLoggingOut ? `${tAccount('logout')}...` : tAccount('logout')}
        </button>
      </div>
    </section>
  );
}
