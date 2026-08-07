'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRightIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useLocale, useTranslations } from '@/hooks/useTranslations';

export type AdminQuotaStatusFilter = 'ALL' | 'OK' | 'WARN' | 'EXCEEDED';
export type AdminAuthOutcome = 'authorized' | 'redirect-login' | 'redirect-platform';

export interface AdminAuthMeResponse {
  id?: unknown;
  role?: unknown;
}

export interface AdminUserSummary {
  userId: string;
  email: string;
  role: string;
  planCode: string;
  planName: string;
  planType: string;
  planStatus: string;
  isActive: boolean;
  activeSessions: number;
  totalSessions: number;
  sessionsCreated24h: number;
  tokensUsed24h: number;
  estimatedCost: number;
  quotaStatus: 'OK' | 'WARN' | 'EXCEEDED';
  createdAt: string;
}

interface AdminUsersResponse {
  users?: AdminUserSummary[];
}

export function resolveAdminAuthOutcome(input: {
  responseOk: boolean;
  payload: AdminAuthMeResponse | null;
}): AdminAuthOutcome {
  if (!input.responseOk) {
    return 'redirect-login';
  }

  const userId = input.payload?.id;
  const userRole = input.payload?.role;

  if (typeof userId !== 'string' || !userId.trim()) {
    return 'redirect-login';
  }

  if (userRole !== 'admin') {
    return 'redirect-platform';
  }

  return 'authorized';
}

export function buildAdminUsersRequestUrl(input: {
  search: string;
  quotaStatus: AdminQuotaStatusFilter;
}): string {
  const params = new URLSearchParams();
  const normalizedSearch = input.search.trim();

  if (normalizedSearch) {
    params.set('search', normalizedSearch);
  }

  if (input.quotaStatus !== 'ALL') {
    params.set('quotaStatus', input.quotaStatus);
  }

  const query = params.toString();
  return query ? `/api/admin/users?${query}` : '/api/admin/users';
}

export function buildAdminUserDetailPath(locale: string, userId: string): string {
  return `/${locale}/admin/users/${encodeURIComponent(userId)}`;
}

function formatIsoDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export default function AdminPageClient() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const [authState, setAuthState] = React.useState<'checking' | 'authorized' | 'redirecting'>(
    'checking',
  );
  const [users, setUsers] = React.useState<AdminUserSummary[]>([]);
  const [usersLoading, setUsersLoading] = React.useState(false);
  const [usersError, setUsersError] = React.useState<string | null>(null);
  const [searchInput, setSearchInput] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [quotaStatusFilter, setQuotaStatusFilter] = React.useState<AdminQuotaStatusFilter>('ALL');

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  React.useEffect(() => {
    let canceled = false;

    const redirectToUnauthorizedTarget = (target: AdminAuthOutcome): void => {
      if (canceled) {
        return;
      }

      setAuthState('redirecting');
      if (target === 'redirect-platform') {
        router.replace(`/${locale}/platform`);
        return;
      }

      router.replace(`/${locale}/login`);
    };

    void (async () => {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
        });

        const payload = response.ok
          ? ((await response.json()) as AdminAuthMeResponse)
          : null;
        const outcome = resolveAdminAuthOutcome({
          responseOk: response.ok,
          payload,
        });

        if (outcome === 'authorized') {
          if (!canceled) {
            setAuthState('authorized');
          }
          return;
        }

        redirectToUnauthorizedTarget(outcome);
      } catch {
        redirectToUnauthorizedTarget('redirect-login');
      }
    })();

    return () => {
      canceled = true;
    };
  }, [locale, router]);

  const loadUsersErrorMessage = t('error.usersLoad');

  React.useEffect(() => {
    if (authState !== 'authorized') {
      return;
    }

    let canceled = false;
    const requestUrl = buildAdminUsersRequestUrl({
      search: debouncedSearch,
      quotaStatus: quotaStatusFilter,
    });

    const handleUnauthorizedStatus = (status: number): boolean => {
      if (status !== 401 && status !== 403) {
        return false;
      }

      if (!canceled) {
        setAuthState('redirecting');
      }

      if (status === 401) {
        router.replace(`/${locale}/login`);
      } else {
        router.replace(`/${locale}/platform`);
      }
      return true;
    };

    void (async () => {
      setUsersLoading(true);
      setUsersError(null);

      try {
        const response = await fetch(requestUrl, {
          method: 'GET',
          credentials: 'include',
        });

        if (handleUnauthorizedStatus(response.status)) {
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to load admin users (${response.status})`);
        }

        const payload = (await response.json()) as AdminUsersResponse;
        const nextUsers = Array.isArray(payload.users) ? payload.users : [];
        if (!canceled) {
          setUsers(nextUsers);
        }
      } catch (error) {
        console.error('Failed to load admin users:', error);
        if (!canceled) {
          setUsers([]);
          setUsersError(loadUsersErrorMessage);
        }
      } finally {
        if (!canceled) {
          setUsersLoading(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [authState, debouncedSearch, loadUsersErrorMessage, locale, quotaStatusFilter, router]);

  if (authState === 'checking') {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6" data-testid="admin-page-auth-loading">
        <p className="text-sm text-gray-600">{t('loading.authCheck')}</p>
      </main>
    );
  }

  if (authState === 'redirecting') {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6" data-testid="admin-page-auth-redirecting">
        <p className="text-sm text-gray-600">{t('loading.redirecting')}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6" data-testid="admin-page-root">
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('nav.console')}</p>
            <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold text-gray-900">
              <ShieldCheckIcon className="h-5 w-5 text-gray-700" aria-hidden="true" />
              {t('users.title')}
            </h1>
            <p className="mt-1 text-sm text-gray-600">{t('users.subtitle')}</p>
          </div>
          <Link
            href={`/${locale}/app`}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            {t('nav.backToWorkspace')}
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative">
            <span className="sr-only">{t('users.searchLabel')}</span>
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('users.searchPlaceholder')}
              className="w-full rounded border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900"
              data-testid="admin-users-search-input"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              <UserGroupIcon className="h-4 w-4 text-gray-500" aria-hidden="true" />
              {t('users.quotaFilterLabel')}
            </span>
            <select
              value={quotaStatusFilter}
              onChange={(event) =>
                setQuotaStatusFilter(event.target.value as AdminQuotaStatusFilter)
              }
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              data-testid="admin-users-quota-filter"
            >
              <option value="ALL">{t('users.quotaFilterAll')}</option>
              <option value="OK">{t('users.quotaFilterOk')}</option>
              <option value="WARN">{t('users.quotaFilterWarn')}</option>
              <option value="EXCEEDED">{t('users.quotaFilterExceeded')}</option>
            </select>
          </label>
        </div>
      </div>

      <section className="mt-4 space-y-3" data-testid="admin-users-list-section">
        {usersLoading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4" data-testid="admin-page-users-loading">
            <p className="text-sm text-gray-600">{t('loading.users')}</p>
          </div>
        ) : null}

        {!usersLoading && usersError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4" data-testid="admin-page-users-error">
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 text-red-500" aria-hidden="true" />
              <p className="text-sm text-red-700">{usersError}</p>
            </div>
          </div>
        ) : null}

        {!usersLoading && !usersError && users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-center" data-testid="admin-page-users-empty">
            <p className="text-sm text-gray-600">{t('empty.users')}</p>
          </div>
        ) : null}

        {!usersLoading && !usersError && users.length > 0
          ? users.map((user) => (
              <button
                key={user.userId}
                type="button"
                onClick={() => router.push(buildAdminUserDetailPath(locale, user.userId))}
                className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-gray-300 hover:bg-gray-50"
                data-testid={`admin-user-card-${user.userId}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{user.email}</p>
                    <p className="text-xs text-gray-500">
                      {t('users.role')}: {user.role}
                    </p>
                  </div>
                  <ChevronRightIcon className="h-5 w-5 flex-none text-gray-400" aria-hidden="true" />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                  <p>
                    {t('users.plan')}: {user.planName || user.planCode || '-'}
                  </p>
                  <p>
                    {t('users.planStatus')}: {user.planStatus || '-'}
                  </p>
                  <p>
                    {t('users.quotaStatus')}: {user.quotaStatus}
                  </p>
                  <p>
                    {t('users.activeSessions')}: {user.activeSessions}
                  </p>
                  <p>
                    {t('users.tokensUsed24h')}: {user.tokensUsed24h}
                  </p>
                  <p>
                    {t('users.createdAt')}: {formatIsoDateTime(user.createdAt)}
                  </p>
                </div>
              </button>
            ))
          : null}
      </section>
    </main>
  );
}
