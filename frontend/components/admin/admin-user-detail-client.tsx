'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  StopCircleIcon,
} from '@heroicons/react/24/outline';
import { useLocale, useTranslations } from '@/hooks/useTranslations';
import AdminCreditGrantPanel, {
  shouldShowAdminCreditGrantPanel,
} from './admin-credit-grant-panel';
import {
  resolveAdminAuthOutcome,
  type AdminAuthMeResponse,
  type AdminUserSummary,
} from './admin-page-client';

export interface AdminUserCreditBalance {
  balance: number;
  monthlyAllocation: number;
  rolloverBalance: number;
  planId: string;
  status: string;
}

export interface AdminUserQuotaVisibility {
  maxActiveSessions: number;
  maxSessions24h: number;
  maxTokens24h: number;
  currentActiveSessions: number;
  currentSessions24h: number;
  currentTokens24h: number;
}

export interface AdminUserDetail extends AdminUserSummary {
  quotas: AdminUserQuotaVisibility;
  creditBalance: AdminUserCreditBalance | null;
}

export interface AdminSessionVisibility {
  sessionId: string;
  userId: string;
  userEmail: string;
  status: string;
  isTerminated: boolean;
  terminationReason: string | null;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
}

interface AdminUserDetailResponse extends AdminUserDetail {}

interface AdminSessionsResponse {
  sessions?: AdminSessionVisibility[];
}

export function buildAdminUserDetailRequestUrl(userId: string): string {
  return `/api/admin/users/${encodeURIComponent(userId)}`;
}

export function buildAdminUserSessionsRequestUrl(userId: string): string {
  return `/api/admin/sessions?userId=${encodeURIComponent(userId)}`;
}

export function buildAdminSessionTerminateRequestUrl(sessionId: string): string {
  return `/api/admin/sessions/${encodeURIComponent(sessionId)}`;
}

export function shouldTreatAdminStatusAsUnauthorized(status: number): boolean {
  return status === 401 || status === 403;
}

export function applySessionTerminationUpdate(
  sessions: AdminSessionVisibility[],
  sessionId: string,
  fallbackReason: string | null = null,
): AdminSessionVisibility[] {
  return sessions.map((session) => {
    if (session.sessionId !== sessionId) {
      return session;
    }

    return {
      ...session,
      status: 'terminated',
      isTerminated: true,
      terminationReason: session.terminationReason ?? fallbackReason,
    };
  });
}

export function applyCreditBalanceAfterGrant(
  userDetail: AdminUserDetail | null,
  balanceAfter: number,
): AdminUserDetail | null {
  if (!userDetail || !userDetail.creditBalance) {
    return userDetail;
  }

  return {
    ...userDetail,
    creditBalance: {
      ...userDetail.creditBalance,
      balance: balanceAfter,
    },
  };
}

export function normalizeUserIdParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return normalizeUserIdParam(value[0]);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function formatIsoDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export default function AdminUserDetailClient() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ userId?: string | string[] }>();
  const userId = normalizeUserIdParam(params?.userId);
  const [authState, setAuthState] = React.useState<'checking' | 'authorized' | 'redirecting'>(
    'checking',
  );
  const [userDetailLoading, setUserDetailLoading] = React.useState(false);
  const [userDetailError, setUserDetailError] = React.useState<string | null>(null);
  const [userDetail, setUserDetail] = React.useState<AdminUserDetail | null>(null);
  const [sessionsLoading, setSessionsLoading] = React.useState(false);
  const [sessionsError, setSessionsError] = React.useState<string | null>(null);
  const [sessions, setSessions] = React.useState<AdminSessionVisibility[]>([]);
  const [terminateSuccessMessage, setTerminateSuccessMessage] = React.useState<string | null>(null);
  const [terminateErrorMessage, setTerminateErrorMessage] = React.useState<string | null>(null);
  const [terminatingSessionIds, setTerminatingSessionIds] = React.useState<Set<string>>(new Set());
  const terminatingSessionIdsRef = React.useRef<Set<string>>(new Set());

  const updateTerminatingSessionIds = React.useCallback((nextSet: Set<string>) => {
    terminatingSessionIdsRef.current = nextSet;
    setTerminatingSessionIds(nextSet);
  }, []);

  const redirectForUnauthorizedStatus = React.useCallback(
    (status: number): boolean => {
      if (!shouldTreatAdminStatusAsUnauthorized(status)) {
        return false;
      }

      setAuthState('redirecting');
      if (status === 401) {
        router.replace(`/${locale}/login`);
      } else {
        router.replace(`/${locale}/platform`);
      }
      return true;
    },
    [locale, router],
  );

  React.useEffect(() => {
    let canceled = false;

    const redirectToUnauthorizedTarget = (
      target: 'redirect-login' | 'redirect-platform',
    ): void => {
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

  const userDetailLoadErrorMessage = t('error.userDetailLoad');
  const sessionsLoadErrorMessage = t('error.sessionsLoad');

  React.useEffect(() => {
    if (authState !== 'authorized') {
      return;
    }

    if (!userId) {
      setUserDetailLoading(false);
      setUserDetail(null);
      setUserDetailError(userDetailLoadErrorMessage);
      return;
    }

    let canceled = false;

    void (async () => {
      setUserDetailLoading(true);
      setUserDetailError(null);

      try {
        const response = await fetch(buildAdminUserDetailRequestUrl(userId), {
          method: 'GET',
          credentials: 'include',
        });

        if (redirectForUnauthorizedStatus(response.status)) {
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to load admin user detail (${response.status})`);
        }

        const payload = (await response.json()) as AdminUserDetailResponse;
        if (!canceled) {
          setUserDetail(payload);
        }
      } catch (error) {
        console.error('Failed to load admin user detail:', error);
        if (!canceled) {
          setUserDetail(null);
          setUserDetailError(userDetailLoadErrorMessage);
        }
      } finally {
        if (!canceled) {
          setUserDetailLoading(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [authState, redirectForUnauthorizedStatus, userDetailLoadErrorMessage, userId]);

  React.useEffect(() => {
    if (authState !== 'authorized') {
      return;
    }

    if (!userId) {
      setSessions([]);
      setSessionsLoading(false);
      setSessionsError(sessionsLoadErrorMessage);
      return;
    }

    let canceled = false;
    void (async () => {
      setSessionsLoading(true);
      setSessionsError(null);

      try {
        const response = await fetch(buildAdminUserSessionsRequestUrl(userId), {
          method: 'GET',
          credentials: 'include',
        });

        if (redirectForUnauthorizedStatus(response.status)) {
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to load admin sessions (${response.status})`);
        }

        const payload = (await response.json()) as AdminSessionsResponse;
        const nextSessions = Array.isArray(payload.sessions) ? payload.sessions : [];
        if (!canceled) {
          setSessions(nextSessions);
        }
      } catch (error) {
        console.error('Failed to load admin sessions:', error);
        if (!canceled) {
          setSessions([]);
          setSessionsError(sessionsLoadErrorMessage);
        }
      } finally {
        if (!canceled) {
          setSessionsLoading(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [authState, redirectForUnauthorizedStatus, sessionsLoadErrorMessage, userId]);

  const handleTerminateSession = React.useCallback(
    async (sessionId: string) => {
      if (terminatingSessionIdsRef.current.has(sessionId)) {
        return;
      }

      if (!window.confirm(t('confirm.terminateSession'))) {
        return;
      }

      const nextIds = new Set(terminatingSessionIdsRef.current);
      nextIds.add(sessionId);
      updateTerminatingSessionIds(nextIds);
      setTerminateSuccessMessage(null);
      setTerminateErrorMessage(null);

      try {
        const response = await fetch(buildAdminSessionTerminateRequestUrl(sessionId), {
          method: 'DELETE',
          credentials: 'include',
        });

        if (redirectForUnauthorizedStatus(response.status)) {
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to terminate admin session (${response.status})`);
        }

        setSessions((currentSessions) =>
          applySessionTerminationUpdate(currentSessions, sessionId),
        );
        setTerminateSuccessMessage(t('success.sessionTerminated'));
      } catch (error) {
        console.error('Failed to terminate admin session:', error);
        setTerminateErrorMessage(t('error.sessionTerminate'));
      } finally {
        const clearedIds = new Set(terminatingSessionIdsRef.current);
        clearedIds.delete(sessionId);
        updateTerminatingSessionIds(clearedIds);
      }
    },
    [redirectForUnauthorizedStatus, t, updateTerminatingSessionIds],
  );

  const handleCreditBalanceUpdated = React.useCallback((balanceAfter: number) => {
    setUserDetail((currentUserDetail) => applyCreditBalanceAfterGrant(currentUserDetail, balanceAfter));
  }, []);

  if (authState === 'checking') {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6" data-testid="admin-user-detail-auth-loading">
        <p className="text-sm text-gray-600">{t('loading.authCheck')}</p>
      </main>
    );
  }

  if (authState === 'redirecting') {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6" data-testid="admin-user-detail-auth-redirecting">
        <p className="text-sm text-gray-600">{t('loading.redirecting')}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6" data-testid="admin-user-detail-root">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">{t('userDetail.title')}</h1>
        <Link
          href={`/${locale}/admin`}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {t('userDetail.backToUsers')}
        </Link>
      </div>

      {userDetailLoading ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4" data-testid="admin-user-detail-loading">
          <p className="text-sm text-gray-600">{t('loading.userDetail')}</p>
        </div>
      ) : null}

      {!userDetailLoading && userDetailError ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4" data-testid="admin-user-detail-error">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 text-red-500" aria-hidden="true" />
            <p className="text-sm text-red-700">{userDetailError}</p>
          </div>
        </div>
      ) : null}

      {!userDetailLoading && !userDetailError && userDetail ? (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white p-4" data-testid="admin-user-detail-summary">
            <h2 className="text-sm font-semibold text-gray-900">{t('userDetail.summary')}</h2>
            <dl className="mt-3 space-y-2 text-sm text-gray-700">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">{t('userDetail.email')}</dt>
                <dd className="truncate text-right">{userDetail.email}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">{t('userDetail.role')}</dt>
                <dd>{userDetail.role}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">{t('userDetail.plan')}</dt>
                <dd>{userDetail.planName || userDetail.planCode || '-'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">{t('userDetail.planStatus')}</dt>
                <dd>{userDetail.planStatus || '-'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">{t('userDetail.accountStatus')}</dt>
                <dd>{userDetail.isActive ? t('userDetail.accountActive') : t('userDetail.accountInactive')}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">{t('userDetail.createdAt')}</dt>
                <dd>{formatIsoDateTime(userDetail.createdAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4" data-testid="admin-user-detail-quotas">
            <h2 className="text-sm font-semibold text-gray-900">{t('userDetail.quotas')}</h2>
            <dl className="mt-3 space-y-2 text-sm text-gray-700">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">{t('userDetail.maxActiveSessions')}</dt>
                <dd>{userDetail.quotas.maxActiveSessions}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">{t('userDetail.currentActiveSessions')}</dt>
                <dd>{userDetail.quotas.currentActiveSessions}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">{t('userDetail.maxSessions24h')}</dt>
                <dd>{userDetail.quotas.maxSessions24h}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">{t('userDetail.currentSessions24h')}</dt>
                <dd>{userDetail.quotas.currentSessions24h}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">{t('userDetail.maxTokens24h')}</dt>
                <dd>{userDetail.quotas.maxTokens24h}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">{t('userDetail.currentTokens24h')}</dt>
                <dd>{userDetail.quotas.currentTokens24h}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2" data-testid="admin-user-detail-credit-balance">
            <h2 className="text-sm font-semibold text-gray-900">{t('creditBalance.title')}</h2>
            {userDetail.creditBalance ? (
              <>
                <dl className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-gray-500">{t('creditBalance.balance')}</dt>
                    <dd>{userDetail.creditBalance.balance}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-gray-500">{t('creditBalance.monthlyAllocation')}</dt>
                    <dd>{userDetail.creditBalance.monthlyAllocation}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-gray-500">{t('creditBalance.rolloverBalance')}</dt>
                    <dd>{userDetail.creditBalance.rolloverBalance}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-gray-500">{t('creditBalance.planId')}</dt>
                    <dd>{userDetail.creditBalance.planId}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-gray-500">{t('creditBalance.status')}</dt>
                    <dd>{userDetail.creditBalance.status}</dd>
                  </div>
                </dl>
                {shouldShowAdminCreditGrantPanel(userDetail.creditBalance) ? (
                  <AdminCreditGrantPanel
                    userId={userDetail.userId}
                    targetUserEmail={userDetail.email}
                    creditBalance={userDetail.creditBalance}
                    onUnauthorizedStatus={redirectForUnauthorizedStatus}
                    onBalanceUpdated={handleCreditBalanceUpdated}
                  />
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-600" data-testid="admin-user-detail-credit-balance-empty">
                {t('empty.creditBalance')}
              </p>
            )}
          </section>
        </div>
      ) : null}

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4" data-testid="admin-user-detail-sessions">
        <h2 className="text-sm font-semibold text-gray-900">{t('sessions.title')}</h2>

        {sessionsLoading ? (
          <p className="mt-3 text-sm text-gray-600" data-testid="admin-user-detail-sessions-loading">
            {t('loading.sessions')}
          </p>
        ) : null}

        {!sessionsLoading && sessionsError ? (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-3" data-testid="admin-user-detail-sessions-error">
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 text-red-500" aria-hidden="true" />
              <p className="text-sm text-red-700">{sessionsError}</p>
            </div>
          </div>
        ) : null}

        {!sessionsLoading && !sessionsError && sessions.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600" data-testid="admin-user-detail-sessions-empty">
            {t('empty.sessions')}
          </p>
        ) : null}

        {terminateSuccessMessage ? (
          <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" data-testid="admin-user-detail-terminate-success">
            {terminateSuccessMessage}
          </p>
        ) : null}
        {terminateErrorMessage ? (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="admin-user-detail-terminate-error">
            {terminateErrorMessage}
          </p>
        ) : null}

        {!sessionsLoading && !sessionsError && sessions.length > 0 ? (
          <div className="mt-3 space-y-3">
            {sessions.map((session) => {
              const isTerminating = terminatingSessionIds.has(session.sessionId);
              const disableTerminate = session.isTerminated || isTerminating;

              return (
                <article
                  key={session.sessionId}
                  className="rounded-lg border border-gray-200 p-3"
                  data-testid={`admin-session-card-${session.sessionId}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="break-all text-xs font-medium text-gray-900">
                      {t('sessions.sessionId')}: {session.sessionId}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleTerminateSession(session.sessionId)}
                      disabled={disableTerminate}
                      className="inline-flex items-center gap-1 rounded border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      data-testid={`admin-session-terminate-${session.sessionId}`}
                    >
                      {isTerminating ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
                          {t('terminate.inProgress')}
                        </>
                      ) : (
                        <>
                          <StopCircleIcon className="h-4 w-4" aria-hidden="true" />
                          {session.isTerminated ? t('terminate.alreadyTerminated') : t('terminate.action')}
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-600 sm:grid-cols-2">
                    <p>
                      {t('sessions.status')}: {session.status}
                    </p>
                    <p>
                      {t('sessions.isTerminated')}: {session.isTerminated ? t('sessions.yes') : t('sessions.no')}
                    </p>
                    <p>
                      {t('sessions.terminationReason')}: {session.terminationReason || '-'}
                    </p>
                    <p>
                      {t('sessions.createdAt')}: {formatIsoDateTime(session.createdAt)}
                    </p>
                    <p>
                      {t('sessions.lastActivityAt')}: {formatIsoDateTime(session.lastActivityAt)}
                    </p>
                    <p>
                      {t('sessions.expiresAt')}: {formatIsoDateTime(session.expiresAt)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
