'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import CollaborationView, {
  type CollaborationHandoffViewModel,
  type CollaborationViewLabels,
} from '@/components/collaboration/collaboration-view';
import { useTranslations } from '@/hooks/useTranslations';
import {
  collaborationFetch,
  readCollaborationFailure,
  type CollaborationHandoff,
  type CollaborationRunDetail,
  type CollaborationRunListItem,
  type CollaborationStartResult,
} from '@/lib/collaboration/api';
import {
  COLLABORATION_POLL_MS,
  collaborationMemberLabel,
  collaborationRefusalMessageKey,
  readHandoffTests,
  readStringList,
  createSingleFlight,
  fillTemplate,
  handoffIsWaiting,
  sendBackRoundNumbers,
  shouldPollCollaboration,
} from '@/lib/collaboration/logic';

const STATUS_KEYS: Record<string, string> = {
  pending_approval: 'statusPendingApproval',
  approved: 'statusApproved',
  in_progress: 'statusInProgress',
  completed: 'statusCompleted',
  failed: 'statusFailed',
  cancelled: 'statusCancelled',
  timed_out: 'statusTimedOut',
  rejected: 'statusRejected',
  active: 'statusActive',
};

export function CollaborationLoading() {
  const t = useTranslations('collaboration');
  return (
    <main className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 py-6">
      <p className="text-sm text-gray-500">{t('loading')}</p>
    </main>
  );
}

export function useCollaborationScreen(input: {
  t: (key: string) => string;
  locale: string;
  sessionId: string;
  queryProjectId: string;
}) {
  const { t, locale, sessionId, queryProjectId } = input;
  // useTranslations returns a new function every render. Reading it through a ref
  // keeps the latest copy without reloading when that identity changes.
  const tRef = useRef(t);
  tRef.current = t;

  const [task, setTask] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [conversationCreated, setConversationCreated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [runs, setRuns] = useState<CollaborationRunListItem[]>([]);
  const [detail, setDetail] = useState<CollaborationRunDetail | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [listProjectId, setListProjectId] = useState(queryProjectId);
  const [rejectReferralId, setRejectReferralId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const flight = useRef(createSingleFlight());
  const listProjectRef = useRef(listProjectId);
  const selectedRef = useRef(selectedRunId);
  listProjectRef.current = listProjectId;
  selectedRef.current = selectedRunId;

  const showRefusal = useCallback(async (response: Response) => {
    const refusal = await readCollaborationFailure(response);
    setNotice(tRef.current(collaborationRefusalMessageKey(refusal)));
  }, []);

  const loadList = useCallback(
    async (projectId: string) => {
      const response = await collaborationFetch(
        `/api/collaboration/runs?projectId=${encodeURIComponent(projectId)}`,
      );
      if (!response.ok) {
        await showRefusal(response);
        return;
      }
      const body = (await response.json()) as { runs?: CollaborationRunListItem[] };
      setRuns(Array.isArray(body.runs) ? body.runs : []);
    },
    [showRefusal],
  );

  const loadDetail = useCallback(
    async (runId: string) => {
      const response = await collaborationFetch(`/api/collaboration/runs/${encodeURIComponent(runId)}`);
      if (!response.ok) {
        await showRefusal(response);
        return;
      }
      const body = (await response.json()) as CollaborationRunDetail;
      setDetail(body);
      if (body.run?.projectId) {
        setListProjectId(body.run.projectId);
      }
    },
    [showRefusal],
  );

  const refresh = useCallback(async () => {
    const projectId = listProjectRef.current;
    const runId = selectedRef.current;
    if (projectId) {
      await loadList(projectId);
    }
    if (runId) {
      await loadDetail(runId);
    }
  }, [loadDetail, loadList]);

  const loadListRef = useRef(loadList);
  const loadDetailRef = useRef(loadDetail);
  const refreshRef = useRef(refresh);
  loadListRef.current = loadList;
  loadDetailRef.current = loadDetail;
  refreshRef.current = refresh;

  useEffect(() => {
    setListProjectId(queryProjectId);
  }, [queryProjectId]);

  useEffect(() => {
    if (!queryProjectId) {
      setRuns([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadListRef.current(queryProjectId)
      .catch(() => {
        if (!cancelled) {
          setNotice(tRef.current('refusalGeneric'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [queryProjectId]);

  useEffect(() => {
    if (!selectedRunId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    loadDetailRef.current(selectedRunId).catch(() => {
      if (!cancelled) {
        setNotice(tRef.current('refusalGeneric'));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  useEffect(() => {
    if (
      !shouldPollCollaboration({
        runStatus: detail?.run.status,
        documentHidden: false,
      })
    ) {
      return;
    }
    let timer: number | null = null;
    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const start = () => {
      stop();
      timer = window.setInterval(() => {
        if (document.visibilityState === 'hidden') {
          return;
        }
        void refreshRef.current();
      }, COLLABORATION_POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stop();
        return;
      }
      void refreshRef.current();
      start();
    };
    if (document.visibilityState !== 'hidden') {
      start();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [detail?.run.status]);

  async function runDecision(action: () => Promise<void>) {
    if (!flight.current.tryBegin()) {
      return;
    }
    setDeciding(true);
    setNotice(null);
    try {
      await action();
    } catch {
      setNotice(tRef.current('refusalGeneric'));
    } finally {
      flight.current.end();
      setDeciding(false);
    }
  }

  const labels: CollaborationViewLabels = {
    title: t('title'),
    intro: t('intro'),
    taskLabel: t('taskLabel'),
    taskPlaceholder: t('taskPlaceholder'),
    start: t('start'),
    starting: t('starting'),
    teamHeading: t('teamHeading'),
    lead: t('lead'),
    writer: t('writer'),
    reviewer: t('reviewer'),
    leadSummary: t('leadSummary'),
    writerSummary: t('writerSummary'),
    reviewerSummary: t('reviewerSummary'),
    fileAccessOn: t('fileAccessOn'),
    chainHeading: t('chainHeading'),
    chainEmpty: t('chainEmpty'),
    prompt: t('prompt'),
    answer: t('answer'),
    note: t('note'),
    failure: t('failure'),
    reason: t('reason'),
    decidedBy: t('decidedBy'),
    approve: t('approve'),
    reject: t('reject'),
    rejectReasonLabel: t('rejectReasonLabel'),
    rejectConfirm: t('rejectConfirm'),
    cancelReject: t('cancelReject'),
    pastRuns: t('pastRuns'),
    pastRunsEmpty: t('pastRunsEmpty'),
    openRun: t('openRun'),
    backToWorkspace: t('backToWorkspace'),
    missingSession: t('missingSession'),
    missingProject: t('missingProject'),
    noAnswerYet: t('noAnswerYet'),
    conversationCreated: t('conversationCreated'),
    loading: t('loading'),
    writerWarning: t('writerWarning'),
    changedFiles: t('changedFiles'),
    noChangedFiles: t('noChangedFiles'),
    savePoint: t('savePoint'),
    testsHeading: t('testsHeading'),
    testPassed: t('testPassed'),
    testFailed: t('testFailed'),
    reviewOrRevert: t('reviewOrRevert'),
    sendBackRound: t('sendBackRound'),
    diff: t('diff'),
    diffUnavailable: t('diffUnavailable'),
    diffEmpty: t('diffEmpty'),
  };

  const memberLabels = useMemo(
    () => ({
      you: t('you'),
      lead: t('lead'),
      writer: t('writer'),
      reviewer: t('reviewer'),
    }),
    [t],
  );

  function statusLabel(status: string): string {
    const key = STATUS_KEYS[status];
    return key ? t(key) : status;
  }

  const team = [
    { name: labels.lead, summary: labels.leadSummary },
    { name: labels.writer, summary: labels.writerSummary },
    { name: labels.reviewer, summary: labels.reviewerSummary },
  ];

  const sourceHandoffs = detail?.handoffs ?? [];
  const roundNumbers = sendBackRoundNumbers(sourceHandoffs);
  const handoffs: CollaborationHandoffViewModel[] = sourceHandoffs.map(
    (handoff: CollaborationHandoff, index) => ({
      referralId: handoff.referralId,
      statusLabel: statusLabel(handoff.status),
      asked: fillTemplate(t('asked'), {
        source: collaborationMemberLabel(handoff.source, memberLabels),
        target: collaborationMemberLabel(handoff.target, memberLabels),
      }),
      prompt: handoff.prompt,
      answer: handoff.answer,
      handoffNote: handoff.handoffNote,
      failureReason: handoff.failureReason,
      decidedBy: handoff.decidedBy,
      rejectReason: handoff.rejectReason,
      waiting: handoffIsWaiting(handoff.status),
      canChangeFiles: handoff.canChangeFiles === true,
      changedPaths: readStringList(handoff.changedPaths),
      savePoint:
        typeof handoff.savePoint === 'string' && handoff.savePoint.trim().length > 0
          ? handoff.savePoint
          : null,
      tests: readHandoffTests(handoff.tests),
      roundLabel:
        typeof roundNumbers[index] === 'number'
          ? fillTemplate(t('sendBackRound'), { round: String(roundNumbers[index]) })
          : null,
      diff: typeof handoff.diff === 'string' ? handoff.diff : null,
      diffUnavailable: handoff.diffUnavailable === true,
    }),
  );

  return {
    labels,
    backHref: `/${locale}/app`,
    sessionReady: sessionId.length > 0,
    projectReady: listProjectId.length > 0,
    loading,
    notice,
    conversationCreated,
    task,
    deciding,
    team,
    handoffs,
    runs: runs.map((run) => ({
      id: run.collaborationRunId,
      statusLabel: statusLabel(run.status),
      when: formatWhen(run.createdAt, locale),
      selected: run.collaborationRunId === selectedRunId,
    })),
    rejectReferralId,
    rejectReason,
    onTaskChange: setTask,
    onStart: () => {
      void runDecision(async () => {
        const response = await collaborationFetch('/api/collaboration/runs', {
          method: 'POST',
          body: JSON.stringify({ sessionId, task: task.trim() }),
        });
        if (!response.ok) {
          await showRefusal(response);
          return;
        }
        const started = (await response.json()) as CollaborationStartResult;
        setConversationCreated(started.conversationCreated === true);
        setSelectedRunId(started.collaborationRunId);
        setRejectReferralId(null);
        setRejectReason('');
        if (started.projectId) {
          setListProjectId(started.projectId);
          listProjectRef.current = started.projectId;
        }
        selectedRef.current = started.collaborationRunId;
        await refresh();
      });
    },
    onOpenRun: (runId: string) => {
      setSelectedRunId(runId);
      setRejectReferralId(null);
      setRejectReason('');
    },
    onApprove: (referralId: string) => {
      if (!selectedRunId) {
        return;
      }
      const runId = selectedRunId;
      void runDecision(async () => {
        const response = await collaborationFetch(
          `/api/collaboration/runs/${encodeURIComponent(runId)}/referrals/${encodeURIComponent(referralId)}/approve`,
          { method: 'POST', body: JSON.stringify({}) },
        );
        if (!response.ok) {
          await showRefusal(response);
          return;
        }
        await refresh();
      });
    },
    onBeginReject: (referralId: string) => {
      setRejectReferralId(referralId);
      setRejectReason('');
    },
    onCancelReject: () => {
      setRejectReferralId(null);
      setRejectReason('');
    },
    onRejectReasonChange: setRejectReason,
    onConfirmReject: (referralId: string) => {
      if (!selectedRunId) {
        return;
      }
      const runId = selectedRunId;
      const reason = rejectReason.trim();
      void runDecision(async () => {
        const response = await collaborationFetch(
          `/api/collaboration/runs/${encodeURIComponent(runId)}/referrals/${encodeURIComponent(referralId)}/reject`,
          {
            method: 'POST',
            body: JSON.stringify(reason.length > 0 ? { reason } : {}),
          },
        );
        if (!response.ok) {
          await showRefusal(response);
          return;
        }
        setRejectReferralId(null);
        setRejectReason('');
        await refresh();
      });
    },
  };
}

export default function CollaborationPageClient() {
  const t = useTranslations('collaboration');
  const params = useParams<{ locale: string }>();
  const searchParams = useSearchParams();
  const locale = typeof params?.locale === 'string' ? params.locale : 'en';
  const sessionId = searchParams.get('sessionId')?.trim() || '';
  const queryProjectId = searchParams.get('projectId')?.trim() || '';
  const viewProps = useCollaborationScreen({
    t,
    locale,
    sessionId,
    queryProjectId,
  });
  return <CollaborationView {...viewProps} />;
}

function formatWhen(value: string, locale: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    return value;
  }
  return new Date(time).toLocaleString(locale);
}
