'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, InboxIcon } from '@heroicons/react/24/outline';
import Spinner from '@/components/ui/Spinner';
import { useTranslations } from '@/hooks/useTranslations';
import { ResultDetailView } from './results-detail';
import { ResultsListView, type ResultsListViewProps } from './results-list';
import { useResults, type ResultDetailState } from './use-results';

/**
 * RESULTS-01 D14: the Results page. Header like the Connections page, then
 * filters, the list and a pager; opening an item shows its detail in place.
 * Nothing here starts, cancels or deploys a run.
 */

export interface ResultsScreenViewProps extends ResultsListViewProps {
  authReady: boolean;
  detail: ResultDetailState | null;
  onCloseDetail: () => void;
  onRetryDetail: () => void;
}

export function ResultsScreenView(props: ResultsScreenViewProps): React.ReactElement {
  const { t, locale, authReady, detail, onCloseDetail, onRetryDetail } = props;

  if (!authReady) {
    return (
      <div
        className="flex min-h-screen items-center justify-center gap-2 bg-slate-950 px-6"
        data-testid="results-auth-loading"
      >
        <Spinner className="h-4 w-4 text-slate-300" />
        <p className="text-sm font-medium text-slate-200" role="status">
          {t('results.loading')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950" data-testid="results-screen">
      <header className="border-b border-slate-800 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/90 text-white">
              <InboxIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-white">{t('results.title')}</h1>
              <p className="text-sm text-slate-300">{t('results.subtitle')}</p>
            </div>
          </div>
          <Link
            href={`/${locale}/platform`}
            className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:self-auto"
            data-testid="results-back"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            {t('results.backToPlatform')}
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {detail ? (
            <ResultDetailView t={t} locale={locale} state={detail} onBack={onCloseDetail} onRetry={onRetryDetail} />
          ) : (
            <ResultsListView {...props} />
          )}
        </div>
      </main>
    </div>
  );
}

export interface ResultsScreenProps {
  locale: string;
}

export default function ResultsScreen({ locale }: ResultsScreenProps): React.ReactElement {
  const t = useTranslations();
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);

  const toLogin = useCallback(() => {
    router.replace(`/${locale}/login`);
  }, [locale, router]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!mounted) {
          return;
        }
        if (!response.ok) {
          toLogin();
          return;
        }
        const payload = (await response.json()) as { id?: unknown };
        if (!mounted) {
          return;
        }
        if (typeof payload.id !== 'string' || payload.id.trim().length === 0) {
          toLogin();
          return;
        }
        setAuthReady(true);
      } catch {
        if (mounted) {
          toLogin();
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [toLogin]);

  const results = useResults({ enabled: authReady, onUnauthorized: toLogin });

  return (
    <ResultsScreenView
      t={t}
      locale={locale}
      authReady={authReady}
      phase={results.phase}
      page={results.page}
      filters={results.filters}
      workflows={results.workflows}
      detail={results.detail}
      onApplyFilters={results.applyFilters}
      onPage={results.goToPage}
      onRetry={results.retry}
      onOpen={results.openResult}
      onCloseDetail={results.closeResult}
      onRetryDetail={results.retryDetail}
    />
  );
}
