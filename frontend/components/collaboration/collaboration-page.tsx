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
  type CollaborationHandoff,
  type CollaborationRunDetail,
  type CollaborationRunListItem,
  type CollaborationStartResult,
} from '@/lib/collaboration/api';
import {
  COLLABORATION_POLL_MS,
  approveRequestBody,
  collaborationMemberLabel,
  collaborationRefusal,
  collaborationRefusalMessageKey,
  collaborationRoster,
  collaborationStartRequestBody,
  collaborationTeamFromDetail,
  collaborationTeamTitle,
  readCollaborationTeamId,
  readStringList,
  readErrorMessage,
  readHandoffTests,
  collaborationScopeLabel,
  readCollaborationSources,
  readDroppedSourceCount,
  readTestsBlockReason,
  readTestsGate,
  readTestsNotPassed,
  createSingleFlight,
  fillTemplate,
  handoffIsWaiting,
  sendBackRoundNumbers,
  shouldPollCollaboration,
  type CollaborationTeamId,
  type CollaborationTestsBlockReason,
  type CollaborationTestsGate,
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
  translateScope?: (scopeId: string) => string;
  locale: string;
  sessionId: string;
  queryProjectId: string;
}) {
  const { t, locale, sessionId, queryProjectId } = input;
  const translateScope = input.translateScope ?? ((scopeId: string) => scopeId);
  // useTranslations returns a new function every render. Reading it through a ref
  // keeps the latest copy without reloading when that identity changes.
  const tRef = useRef(t);
  tRef.current = t;

  const [task, setTask] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<CollaborationTeamId>('coding');
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
  const [approveWithoutTests, setApproveWithoutTests] = useState<Record<string, boolean>>({});
  const [forcedTestsBlock, setForcedTestsBlock] = useState<
    Record<string, CollaborationTestsBlockReason>
  >({});
  const flight = useRef(createSingleFlight());
  // Takes effect in this turn, before deciding re-renders and disables Start.
  const startInFlight = useRef(false);
  const listProjectRef = useRef(listProjectId);
  const selectedRef = useRef(selectedRunId);
  listProjectRef.current = listProjectId;
  selectedRef.current = selectedRunId;

  const showRefusal = useCallback(async (response: Response) => {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    setNotice(
      tRef.current(
        collaborationRefusalMessageKey(
          collaborationRefusal(response.status, readErrorMessage(body), body),
        ),
      ),
    );
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
    teamPickerLabel: t('teamPickerLabel'),
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
    testsFailedGate: t('testsFailedGate'),
    testsMissingGate: t('testsMissingGate'),
    approveWithoutPassingTests: t('approveWithoutPassingTests'),
    sources: t('sources'),
    unsourced: t('unsourced'),
    droppedSources: t('droppedSources'),
  };

  const memberLabels = useMemo(
    () => ({
      you: t('you'),
      lead: t('lead'),
      writer: t('writer'),
      reviewer: t('reviewer'),
      chiefOfStaff: t('chiefOfStaff'),
      productStrategy: t('productStrategy'),
      technologyAdvisor: t('technologyAdvisor'),
    }),
    [t],
  );

  function statusLabel(status: string): string {
    const key = STATUS_KEYS[status];
    return key ? t(key) : status;
  }

  const team = collaborationRoster(selectedTeam, {
    lead: labels.lead,
    writer: labels.writer,
    reviewer: labels.reviewer,
    chiefOfStaff: t('chiefOfStaff'),
    productStrategy: t('productStrategy'),
    technologyAdvisor: t('technologyAdvisor'),
    leadSummary: labels.leadSummary,
    writerSummary: labels.writerSummary,
    reviewerSummary: labels.reviewerSummary,
    chiefOfStaffSummary: t('chiefOfStaffSummary'),
    advisorsLeadSummary: t('advisorsLeadSummary'),
    productStrategySummary: t('productStrategySummary'),
    technologyAdvisorSummary: t('technologyAdvisorSummary'),
  });
  const runTeamId = collaborationTeamFromDetail(detail);
  const chainTeamId = runTeamId ?? selectedTeam;
  const teamChoices = [
    { id: 'coding' as const, label: t('teamCoding'), hint: t('teamCodingHint') },
    {
      id: 'chief-of-staff' as const,
      label: t('teamChiefOfStaff'),
      hint: t('teamChiefOfStaffHint'),
    },
    {
      id: 'advisors' as const,
      label: t('teamAdvisors'),
      hint: t('teamAdvisorsHint'),
    },
  ];
  const runTeam = runTeamId
    ? {
        label: collaborationTeamTitle(runTeamId, {
          coding: t('teamCoding'),
          chiefOfStaff: t('teamChiefOfStaff'),
          advisors: t('teamAdvisors'),
        }),
        roles: readStringList(detail?.team).map((name) =>
          collaborationMemberLabel(name, memberLabels),
        ),
      }
    : null;

  const sourceHandoffs = detail?.handoffs ?? [];
  const roundNumbers = sendBackRoundNumbers(sourceHandoffs);
  const handoffs: CollaborationHandoffViewModel[] = sourceHandoffs.map(
    (handoff: CollaborationHandoff, index) => {
      const forced = forcedTestsBlock[handoff.referralId];
      const testsGate: CollaborationTestsGate = forced ? 'blocked' : readTestsGate(handoff.testsGate);
      const testsBlockReason =
        testsGate === 'blocked'
          ? (forced ?? readTestsBlockReason(handoff.testsBlockReason) ?? 'none')
          : null;
      return {
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
        testsGate,
        testsBlockReason,
        approveWithoutTests: approveWithoutTests[handoff.referralId] === true,
        sources: readCollaborationSources(handoff.sources).map((source) => ({
          documentId: source.documentId,
          title: source.title,
          scopeLabel: translateScope(source.scopeId),
          heading: source.heading,
        })),
        showUnsourced: handoff.showUnsourced === true,
        droppedSourceCount: readDroppedSourceCount(handoff.droppedSourceCount),
      };
    },
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
    selectedTeam,
    teamChoices,
    onTeamChange: (teamId: CollaborationTeamId) => {
      setSelectedTeam(teamId);
    },
    accessNote:
      selectedTeam === 'chief-of-staff'
        ? t('fileAccessReadOnly')
        : selectedTeam === 'advisors'
          ? t('fileAccessAdvisors')
          : labels.fileAccessOn,
    chainEmptyText:
      chainTeamId === 'chief-of-staff'
        ? t('chainEmptyChief')
        : chainTeamId === 'advisors'
          ? t('chainEmptyAdvisors')
          : labels.chainEmpty,
    runTeam,
    handoffs,
    runs: runs.map((run) => {
      const listedTeamId = readCollaborationTeamId(run.teamId);
      return {
        id: run.collaborationRunId,
        statusLabel: statusLabel(run.status),
        when: formatWhen(run.createdAt, locale),
        selected: run.collaborationRunId === selectedRunId,
        teamLabel: listedTeamId
          ? collaborationTeamTitle(listedTeamId, {
              coding: t('teamCoding'),
              chiefOfStaff: t('teamChiefOfStaff'),
              advisors: t('teamAdvisors'),
            })
          : undefined,
      };
    }),
    rejectReferralId,
    rejectReason,
    onTaskChange: setTask,
    onStart: () => {
      if (startInFlight.current) {
        return;
      }
      startInFlight.current = true;
      void (async () => {
        try {
          await runDecision(async () => {
            const response = await collaborationFetch('/api/collaboration/runs', {
              method: 'POST',
              body: JSON.stringify(
                collaborationStartRequestBody({
                  sessionId,
                  task,
                  team: selectedTeam,
                }),
              ),
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
            setTask('');
            await refresh();
          });
        } finally {
          startInFlight.current = false;
        }
      })();
    },
    onOpenRun: (runId: string) => {
      setSelectedRunId(runId);
      setRejectReferralId(null);
      setRejectReason('');
      setApproveWithoutTests({});
      setForcedTestsBlock({});
    },
    onApproveWithoutTestsChange: (referralId: string, checked: boolean) => {
      setApproveWithoutTests((prev) => ({ ...prev, [referralId]: checked }));
    },
    onApprove: (referralId: string, approveWithoutPassingTests = false) => {
      if (!selectedRunId) {
        return;
      }
      const runId = selectedRunId;
      void runDecision(async () => {
        const response = await collaborationFetch(
          `/api/collaboration/runs/${encodeURIComponent(runId)}/referrals/${encodeURIComponent(referralId)}/approve`,
          {
            method: 'POST',
            body: JSON.stringify(approveRequestBody(approveWithoutPassingTests === true)),
          },
        );
        if (!response.ok) {
          let body: unknown = null;
          try {
            body = await response.json();
          } catch {
            body = null;
          }
          const testsBlock = readTestsNotPassed(response.status, body);
          if (testsBlock) {
            setForcedTestsBlock((prev) => ({ ...prev, [referralId]: testsBlock }));
            setApproveWithoutTests((prev) => ({ ...prev, [referralId]: false }));
            return;
          }
          setNotice(
            tRef.current(
              collaborationRefusalMessageKey(
                collaborationRefusal(response.status, readErrorMessage(body), body),
              ),
            ),
          );
          return;
        }
        setForcedTestsBlock((prev) => {
          if (!(referralId in prev)) {
            return prev;
          }
          const next = { ...prev };
          delete next[referralId];
          return next;
        });
        setApproveWithoutTests((prev) => {
          if (!(referralId in prev)) {
            return prev;
          }
          const next = { ...prev };
          delete next[referralId];
          return next;
        });
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
  const knowledgeT = useTranslations('knowledge');
  const params = useParams<{ locale: string }>();
  const searchParams = useSearchParams();
  const locale = typeof params?.locale === 'string' ? params.locale : 'en';
  const sessionId = searchParams.get('sessionId')?.trim() || '';
  const queryProjectId = searchParams.get('projectId')?.trim() || '';
  const viewProps = useCollaborationScreen({
    t,
    translateScope: (scopeId: string) =>
      collaborationScopeLabel(scopeId, knowledgeT(`scopes.${scopeId}`)),
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
