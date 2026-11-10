'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadResultDetail,
  loadResults,
  loadResultsWorkflows,
  markResultSeen,
  type ResultsFetcher,
  type ResultsWorkflowOption,
} from './results-api';
import {
  EMPTY_RESULTS_FILTERS,
  withResultSeen,
  type ResultDetail,
  type ResultsFilters,
  type ResultsPage,
} from './results.logic';

/**
 * RESULTS-01 D14, D16: list, filters, paging and the in-place detail.
 * Opening a result calls the seen route once, after its detail loaded, and
 * clears the item's unread mark without refetching the list.
 */

export type ResultsListPhase = 'loading' | 'ready' | 'error' | 'forbidden';
export type ResultDetailPhase = 'loading' | 'ready' | 'not_found' | 'error';

export interface ResultDetailState {
  collaborationRunId: string;
  phase: ResultDetailPhase;
  detail: ResultDetail | null;
}

export interface UseResults {
  phase: ResultsListPhase;
  page: ResultsPage | null;
  filters: ResultsFilters;
  workflows: ResultsWorkflowOption[];
  detail: ResultDetailState | null;
  applyFilters: (filters: ResultsFilters) => void;
  goToPage: (page: number) => void;
  retry: () => void;
  openResult: (collaborationRunId: string) => void;
  retryDetail: () => void;
  closeResult: () => void;
}

export function useResults(options: {
  enabled: boolean;
  onUnauthorized: () => void;
  fetcher?: ResultsFetcher;
}): UseResults {
  const { enabled, onUnauthorized, fetcher } = options;
  const [phase, setPhase] = useState<ResultsListPhase>('loading');
  const [page, setPage] = useState<ResultsPage | null>(null);
  const [filters, setFilters] = useState<ResultsFilters>(EMPTY_RESULTS_FILTERS);
  const [pageNumber, setPageNumber] = useState(1);
  const [workflows, setWorkflows] = useState<ResultsWorkflowOption[]>([]);
  const [detail, setDetail] = useState<ResultDetailState | null>(null);
  const listRequest = useRef(0);
  const detailRequest = useRef(0);
  const marked = useRef(new Set<string>());
  const pageRef = useRef<ResultsPage | null>(null);
  pageRef.current = page;

  const reload = useCallback(
    async (nextFilters: ResultsFilters, nextPage: number) => {
      const request = ++listRequest.current;
      setPhase('loading');
      const result = await loadResults(nextFilters, nextPage, fetcher);
      if (request !== listRequest.current) {
        return;
      }
      if (result.type === 'unauthorized') {
        onUnauthorized();
        return;
      }
      if (result.type === 'forbidden') {
        setPhase('forbidden');
        return;
      }
      if (result.type !== 'ok') {
        setPhase('error');
        return;
      }
      setPage(result.value);
      setPhase('ready');
    },
    [fetcher, onUnauthorized],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void reload(filters, pageNumber);
  }, [enabled, filters, pageNumber, reload]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let mounted = true;
    void loadResultsWorkflows(fetcher).then((items) => {
      if (mounted) {
        setWorkflows(items);
      }
    });
    return () => {
      mounted = false;
    };
  }, [enabled, fetcher]);

  const loadDetail = useCallback(
    async (collaborationRunId: string) => {
      const request = ++detailRequest.current;
      setDetail({ collaborationRunId, phase: 'loading', detail: null });
      const result = await loadResultDetail(collaborationRunId, fetcher);
      if (request !== detailRequest.current) {
        return;
      }
      if (result.type === 'unauthorized') {
        onUnauthorized();
        return;
      }
      if (result.type === 'not_found' || result.type === 'forbidden') {
        setDetail({ collaborationRunId, phase: 'not_found', detail: null });
        return;
      }
      if (result.type !== 'ok') {
        setDetail({ collaborationRunId, phase: 'error', detail: null });
        return;
      }
      setDetail({ collaborationRunId, phase: 'ready', detail: result.value });

      const listed = pageRef.current?.results.find(
        (item) => item.collaborationRunId === collaborationRunId,
      );
      if (marked.current.has(collaborationRunId) || (listed && listed.seenAt !== null)) {
        return;
      }
      marked.current.add(collaborationRunId);
      const seenAt = await markResultSeen(collaborationRunId, fetcher);
      if (seenAt === null) {
        marked.current.delete(collaborationRunId);
        return;
      }
      setPage((current) =>
        current ? { ...current, results: withResultSeen(current.results, collaborationRunId, seenAt) } : current,
      );
    },
    [fetcher, onUnauthorized],
  );

  return {
    phase,
    page,
    filters,
    workflows,
    detail,
    applyFilters: (next) => {
      setFilters({ ...next });
      setPageNumber(1);
    },
    goToPage: (next) => {
      setPageNumber(Math.max(1, Math.floor(next)));
    },
    retry: () => {
      void reload(filters, pageNumber);
    },
    openResult: (collaborationRunId) => {
      void loadDetail(collaborationRunId);
    },
    retryDetail: () => {
      if (detail) {
        void loadDetail(detail.collaborationRunId);
      }
    },
    closeResult: () => {
      detailRequest.current += 1;
      setDetail(null);
    },
  };
}
