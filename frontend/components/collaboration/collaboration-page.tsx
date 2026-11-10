'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import CollaborationView, {
  type CollaborationHandoffViewModel,
  type CollaborationViewLabels,
  type CollaborationRosterView,
  type CollaborationWorkflowPickerView,
  type CollaborationWorkflowStartView,
} from '@/components/collaboration/collaboration-view';
import {
  collaborationWorkflowActions,
  collaborationWorkflowRefusal,
  collaborationWorkflowSpentLine,
  collaborationWorkflowStartBody,
  collaborationWorkflowSummary,
  preselectWorkflowId,
  readRunWorkflow,
  useCollaborationWorkflowList,
  type CollaborationWorkflowList,
} from '@/components/collaboration/collaboration-workflows';
import {
  ROSTER_MAX_MEMBERS,
  ROSTER_REASON_KEYS,
  collaborationChiefStartBody,
  isReportBackHandoff,
  readRunAgents,
  readStartSkipped,
  rosterPickerRows,
  useCollaborationRoster,
  type RosterSkipped,
} from '@/components/collaboration/collaboration-roster';
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
  collaborationRunEndedByReject,
  collaborationRunIsActive,
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

/** BIZ-BRIEF-01: the morning briefing preset, offered on the chief-of-staff team only. */
export const MORNING_BRIEFING_PRESET_ID = 'morning-briefing';

const IANA_TIME_ZONE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,2}$/;

/**
 * The time zone the briefing asks the calendar tool to use: the given value or
 * the browser's own, when it looks like an IANA name. UTC otherwise.
 */
export function collaborationBriefingTimeZone(value?: string): string {
  let zone = value;
  if (zone === undefined) {
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      zone = undefined;
    }
  }
  if (typeof zone !== 'string') {
    return 'UTC';
  }
  const trimmed = zone.trim();
  return trimmed.length > 0 && trimmed.length <= 64 && IANA_TIME_ZONE.test(trimmed)
    ? trimmed
    : 'UTC';
}

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
  /** Overrides the browser time zone in the morning briefing request (tests). */
  timeZone?: string;
  /** BIZ-USER-01C: the owner's workflows. Absent: the page offers the three teams only. */
  workflows?: CollaborationWorkflowList;
  /** TEAM-PRESELECT-01: the workflowId query parameter, if any. */
  queryWorkflowId?: string;
  /** COS-FRONTDOOR-01C: load and show the chief-of-staff roster picker. Off: no picker, no request. */
  rosterEnabled?: boolean;
}) {
  const { t, locale, sessionId } = input;
  const queryWorkflowId = input.queryWorkflowId?.trim() || '';
  // TEAM-NO-SESSION-02 D10 (DECISION E): without a session, "Past runs" lists the
  // owner's business project unless the URL names a project. With a session it is ignored.
  const businessProjectId = input.workflows?.business?.projectId ?? '';
  const queryProjectId =
    sessionId.length > 0 ? input.queryProjectId : input.queryProjectId || businessProjectId;
  const translateScope = input.translateScope ?? ((scopeId: string) => scopeId);
  // useTranslations returns a new function every render. Reading it through a ref
  // keeps the latest copy without reloading when that identity changes.
  const tRef = useRef(t);
  tRef.current = t;

  const [task, setTask] = useState('');
  const [pickedTeam, setSelectedTeam] = useState<CollaborationTeamId>('coding');
  // COS-FRONTDOOR-01C: without a session only the chief-of-staff can start, so it is the team.
  const selectedTeam: CollaborationTeamId = sessionId.length === 0 ? 'chief-of-staff' : pickedTeam;
  const [rosterSkipped, setRosterSkipped] = useState<RosterSkipped[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  // TEAM-PRESELECT-01: apply ?workflowId once, when the list has loaded. A missing match or a
  // failed list preselects nothing and shows nothing; later refreshes never override the user.
  const preselectDoneRef = useRef(false);
  const preselectState = input.workflows?.state;
  const preselectItems = input.workflows?.items;
  useEffect(() => {
    if (preselectDoneRef.current || queryWorkflowId === '') {
      return;
    }
    if (preselectState === 'failed') {
      preselectDoneRef.current = true;
      return;
    }
    if (preselectState !== 'loaded') {
      return;
    }
    preselectDoneRef.current = true;
    if (preselectWorkflowId(preselectItems ?? [], queryWorkflowId) !== null) {
      setSelectedWorkflowId(queryWorkflowId);
    }
  }, [preselectState, preselectItems, queryWorkflowId]);
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
  const [editReferralId, setEditReferralId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
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

  const refusalText = useCallback((status: number, body: unknown): string => {
    const workflowRefusal = collaborationWorkflowRefusal(body);
    if (workflowRefusal) {
      return fillTemplate(tRef.current(workflowRefusal.key), workflowRefusal.values);
    }
    return tRef.current(
      collaborationRefusalMessageKey(
        collaborationRefusal(status, readErrorMessage(body), body),
      ),
    );
  }, []);

  const showRefusal = useCallback(async (response: Response) => {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    setNotice(refusalText(response.status, body));
  }, [refusalText]);

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

  // BIZ-USER-01C: when an open workflow run ends, read the workflows again
  // so the tested flag and today's spend are current.
  const workflowsStaleRef = useRef(input.workflows?.onStale);
  workflowsStaleRef.current = input.workflows?.onStale;
  const previousRunStatus = useRef<string | undefined>(undefined);
  const detailIsWorkflow =
    readRunWorkflow((detail as { workflow?: unknown } | null)?.workflow) !== null;
  useEffect(() => {
    const status = detail?.run.status;
    const previous = previousRunStatus.current;
    previousRunStatus.current = status;
    if (detailIsWorkflow && previous === 'active' && status !== undefined && status !== 'active') {
      workflowsStaleRef.current?.();
    }
  }, [detail?.run.status, detailIsWorkflow]);

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
    rejectPrompt: t('rejectPrompt'),
    rejectConfirm: t('rejectConfirm'),
    cancelReject: t('cancelReject'),
    editTask: t('editTask'),
    editTaskLabel: t('editTaskLabel'),
    saveTask: t('saveTask'),
    keepTask: t('keepTask'),
    runEndedByReject: t('runEndedByReject'),
    cancelRun: t('cancelRun'),
    cancelRunPrompt: t('cancelRunPrompt'),
    cancelRunConfirm: t('cancelRunConfirm'),
    cancelRunKeep: t('cancelRunKeep'),
    pastRuns: t('pastRuns'),
    pastRunsEmpty: t('pastRunsEmpty'),
    openRun: t('openRun'),
    backToWorkspace: t('backToWorkspace'),
    missingSession: t('missingSession'),
    startTestRun: t('startTestRun'),
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
    reportBackNoEdit: t('reportBackNoEdit'),
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
  // BIZ-USER-01C: the selected workflow, the run's workflow and their names.
  const workflowItems = input.workflows?.items ?? [];
  const selectedWorkflow =
    selectedWorkflowId !== null
      ? (workflowItems.find((item) => item.id === selectedWorkflowId) ?? null)
      : null;
  const detailWorkflow = readRunWorkflow((detail as { workflow?: unknown } | null)?.workflow);
  const workflowNames = new Map<string, string>();
  for (const item of workflowItems) {
    workflowNames.set(item.id, item.name);
  }
  if (detailWorkflow) {
    workflowNames.set(detailWorkflow.id, detailWorkflow.name);
  }
  // COS-FRONTDOOR-01C: the run's stored agent list names each member; a translated
  // system label or a workflow's own name wins, the stored label comes next.
  const agentLabels = new Map<string, string>();
  for (const agent of readRunAgents((detail as { agents?: unknown } | null)?.agents)) {
    if (agent.label !== null) {
      agentLabels.set(agent.name, agent.label);
    }
  }
  const memberLabel = (name: string) => {
    const workflowName = workflowNames.get(name);
    if (workflowName !== undefined) {
      return workflowName;
    }
    const known = collaborationMemberLabel(name, memberLabels);
    return known !== name ? known : (agentLabels.get(name) ?? name);
  };
  const workflowRoster = selectedWorkflow
    ? [
        {
          name: selectedWorkflow.name,
          summary: collaborationWorkflowSummary(selectedWorkflow, {
            folders: t('workflowFolders'),
            modelServer: t('workflowModelServer'),
            budgetPerRun: t('workflowBudgetPerRun'),
            noBudget: t('workflowNoBudget'),
          }),
        },
      ]
    : null;
  const workflowActions = selectedWorkflow ? collaborationWorkflowActions(selectedWorkflow) : null;
  const workflowHintKeys = {
    needsTest: 'workflowNeedsTest',
    draft: 'workflowDraftHint',
    off: 'workflowOffHint',
  } as const;
  const workflowStart: CollaborationWorkflowStartView | null =
    selectedWorkflow && workflowActions
      ? {
          canTest: workflowActions.canTest,
          canRun: workflowActions.canRun,
          testLabel: t('startTestRun'),
          hint: workflowActions.hint ? t(workflowHintKeys[workflowActions.hint]) : null,
          spentLine: collaborationWorkflowSpentLine(selectedWorkflow, t('workflowSpentToday')),
        }
      : null;
  const statusKeys = {
    active: 'workflowStatusActive',
    draft: 'workflowStatusDraft',
    disabled: 'workflowStatusDisabled',
  } as const;
  const workflowPicker: CollaborationWorkflowPickerView | null = input.workflows
    ? {
        state: input.workflows.state,
        labels: {
          heading: t('workflowPickerLabel'),
          loading: t('workflowsLoading'),
          empty: t('workflowsEmpty'),
          failed: t('workflowsFailed'),
          retry: t('workflowsRetry'),
        },
        items: workflowItems.map((item) => ({
          id: item.id,
          name: item.name,
          statusLabel: t(statusKeys[item.status]),
          testedLabel: item.tested ? t('workflowTested') : t('workflowNotTested'),
          selected: item.id === selectedWorkflow?.id,
        })),
        onSelect: (workflowId: string) => {
          setSelectedWorkflowId(workflowId);
        },
        onRetry: input.workflows.onRetry,
      }
    : null;
  // COS-FRONTDOOR-01C: the chief-of-staff roster. It loads the first time the chief-of-staff
  // option shows, and the picker is hidden for coding, advisors and a selected workflow.
  const rosterState = useCollaborationRoster(
    input.rosterEnabled === true && selectedTeam === 'chief-of-staff' && selectedWorkflow === null,
  );
  const rosterMax = String(ROSTER_MAX_MEMBERS);
  const rosterMessage = rosterState.limitHit
    ? fillTemplate(t('rosterLimit'), { max: rosterMax })
    : rosterState.saveErrorKey
      ? fillTemplate(t(rosterState.saveErrorKey), { max: rosterMax })
      : null;
  const rosterMemberName = (kind: 'system' | 'workflow', id: string, name: string | null) => {
    if (kind === 'system') {
      const known = collaborationMemberLabel(id, memberLabels);
      if (known !== id) {
        return known;
      }
    }
    return name ?? t('rosterMemberUnknown');
  };
  const rosterView: CollaborationRosterView | null =
    input.rosterEnabled === true
      ? {
          state: rosterState.state,
          saveState: rosterState.saveState,
          labels: {
            heading: t('rosterHeading'),
            intro: fillTemplate(t('rosterIntro'), { max: rosterMax }),
            loading: t('rosterLoading'),
            empty: t('rosterEmpty'),
            failed: t('rosterFailed'),
            retry: t('rosterRetry'),
            save: t('rosterSave'),
            saving: t('rosterSaving'),
            saved: t('rosterSaved'),
            count: fillTemplate(t('rosterCount'), {
              count: String(rosterState.selectedIds.length),
              max: rosterMax,
            }),
          },
          rows: rosterPickerRows({
            members: rosterState.members,
            choices: rosterState.choices,
          }).map((row) => {
            const checked = rosterState.selectedIds.includes(row.id);
            return {
              id: row.id,
              name: rosterMemberName(row.kind, row.id, row.name),
              kindLabel: row.kind === 'workflow' ? t('rosterKindWorkflow') : t('rosterKindSystem'),
              checked,
              canTick: row.usable || checked,
              reasonLabel: !row.usable && row.reason ? t(ROSTER_REASON_KEYS[row.reason]) : null,
            };
          }),
          message: rosterMessage,
          dirty: rosterState.dirty,
          onToggle: rosterState.onToggle,
          onSave: rosterState.onSave,
          onRetry: rosterState.onRetry,
        }
      : null;
  // COS-FRONTDOOR-01C D10: the members the server left out of the last start, by name.
  const rosterKnown = new Map<string, { kind: 'system' | 'workflow'; name: string | null }>();
  for (const entry of [...rosterState.choices, ...rosterState.members]) {
    rosterKnown.set(entry.id, { kind: entry.kind, name: entry.name });
  }
  const rosterSkippedHint =
    rosterSkipped.length > 0
      ? fillTemplate(t('rosterSkippedHint'), {
          members: rosterSkipped
            .map((entry) => {
              const known = rosterKnown.get(entry.id);
              const workflowName = workflowNames.get(entry.id);
              const name =
                workflowName ??
                rosterMemberName(known?.kind ?? 'system', entry.id, known?.name ?? null);
              return fillTemplate(t('rosterSkippedItem'), {
                name,
                reason: t(ROSTER_REASON_KEYS[entry.reason]),
              });
            })
            .join(' · '),
        })
      : null;
  const runTeamId = collaborationTeamFromDetail(detail);
  const chainTeamId = runTeamId ?? selectedTeam;
  const chainIsWorkflow = detailWorkflow !== null || (detail === null && selectedWorkflow !== null);
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
  const runTeam = detailWorkflow
    ? {
        label: detailWorkflow.name,
        roles: [],
        badge: detailWorkflow.testRun ? t('testRunBadge') : undefined,
      }
    : runTeamId
    ? {
        label: collaborationTeamTitle(runTeamId, {
          coding: t('teamCoding'),
          chiefOfStaff: t('teamChiefOfStaff'),
          advisors: t('teamAdvisors'),
        }),
        roles: readStringList(detail?.team).map((name) => memberLabel(name)),
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
      const reportBack = isReportBackHandoff(handoff.source, handoff.target);
      return {
        referralId: handoff.referralId,
        statusLabel: statusLabel(handoff.status),
        reportBack,
        asked: fillTemplate(t(reportBack ? 'reportBackStep' : 'asked'), {
          source: memberLabel(handoff.source),
          target: memberLabel(handoff.target),
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

  function startRun(testRun: boolean) {
    if (startInFlight.current) {
      return;
    }
    const workflowId = selectedWorkflow?.id ?? null;
    // TEAM-NO-SESSION-02 D6 and COS-FRONTDOOR-01C: only a workflow or the chief-of-staff
    // starts without a session.
    if (sessionId.length === 0 && workflowId === null && selectedTeam !== 'chief-of-staff') {
      return;
    }
    startInFlight.current = true;
    void (async () => {
      try {
        await runDecision(async () => {
          const response = await collaborationFetch('/api/collaboration/runs', {
            method: 'POST',
            body: JSON.stringify(
              workflowId !== null
                ? collaborationWorkflowStartBody({ sessionId, task, workflowId, testRun })
                : selectedTeam === 'chief-of-staff'
                  ? collaborationChiefStartBody({ sessionId, task })
                  : collaborationStartRequestBody({
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
          // The notice names the workspace session; a session-less run has none to name.
          setConversationCreated(started.conversationCreated === true && sessionId.length > 0);
          setRosterSkipped(readStartSkipped(started));
          setSelectedRunId(started.collaborationRunId);
          setRejectReferralId(null);
          setRejectReason('');
          setEditReferralId(null);
          setEditPrompt('');
          setConfirmingCancel(false);
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
  }

  return {
    labels,
    backHref: `/${locale}/app`,
    sessionReady: sessionId.length > 0,
    // Without a session the list is the business project's, which exists once a run started.
    projectReady: listProjectId.length > 0 || sessionId.length === 0,
    pastRunsNote: sessionId.length === 0 ? t('pastRunsBusiness') : undefined,
    loading,
    notice,
    conversationCreated,
    task,
    deciding,
    team: workflowRoster ?? team,
    selectedTeam,
    teamChoices,
    onTeamChange: (teamId: CollaborationTeamId) => {
      setSelectedTeam(teamId);
      setSelectedWorkflowId(null);
    },
    workflowPicker,
    workflowStart,
    roster: rosterView,
    rosterSkippedHint,
    chiefStartWithoutSession: true,
    accessNote:
      selectedWorkflow || selectedTeam === 'chief-of-staff'
        ? t('fileAccessReadOnly')
        : selectedTeam === 'advisors'
          ? t('fileAccessAdvisors')
          : labels.fileAccessOn,
    chainEmptyText: chainIsWorkflow
      ? t('chainEmptyWorkflow')
      : chainTeamId === 'chief-of-staff'
        ? t('chainEmptyChief')
        : chainTeamId === 'advisors'
          ? t('chainEmptyAdvisors')
          : labels.chainEmpty,
    runTeam,
    taskPresets:
      !selectedWorkflow && selectedTeam === 'chief-of-staff'
        ? [{ id: MORNING_BRIEFING_PRESET_ID, label: t('presetMorningBriefing') }]
        : [],
    taskPresetHint:
      !selectedWorkflow && selectedTeam === 'chief-of-staff' ? t('presetHint') : undefined,
    onTaskPreset: (presetId: string) => {
      if (presetId !== MORNING_BRIEFING_PRESET_ID) {
        return;
      }
      setTask(
        fillTemplate(tRef.current('presetMorningBriefingTask'), {
          timeZone: collaborationBriefingTimeZone(input.timeZone),
        }),
      );
    },
    handoffs,
    runs: runs.map((run) => {
      const listedTeamId = readCollaborationTeamId(run.teamId);
      const listedWorkflow = readRunWorkflow((run as { workflow?: unknown }).workflow);
      return {
        id: run.collaborationRunId,
        statusLabel: statusLabel(run.status),
        when: formatWhen(run.createdAt, locale),
        selected: run.collaborationRunId === selectedRunId,
        teamLabel: listedWorkflow
          ? listedWorkflow.name
          : listedTeamId
            ? collaborationTeamTitle(listedTeamId, {
                coding: t('teamCoding'),
                chiefOfStaff: t('teamChiefOfStaff'),
                advisors: t('teamAdvisors'),
              })
            : undefined,
        testRunLabel: listedWorkflow?.testRun ? t('testRunBadge') : undefined,
      };
    }),
    rejectReferralId,
    rejectReason,
    editReferralId,
    editPrompt,
    runEndedByReject: collaborationRunEndedByReject(
      detail?.run.status,
      sourceHandoffs.map((handoff) => handoff.status),
    ),
    selectedRunActive: collaborationRunIsActive(detail?.run.status),
    confirmingCancel,
    onTaskChange: setTask,
    onStartTest: () => startRun(true),
    onStart: () => startRun(false),
    onOpenRun: (runId: string) => {
      setSelectedRunId(runId);
      setRosterSkipped([]);
      setRejectReferralId(null);
      setRejectReason('');
      setEditReferralId(null);
      setEditPrompt('');
      setConfirmingCancel(false);
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
          setNotice(refusalText(response.status, body));
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
      setEditReferralId(null);
      setEditPrompt('');
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
    onBeginEdit: (referralId: string, currentPrompt: string) => {
      setRejectReferralId(null);
      setRejectReason('');
      setEditReferralId(referralId);
      setEditPrompt(currentPrompt);
    },
    onCancelEdit: () => {
      setEditReferralId(null);
      setEditPrompt('');
    },
    onEditPromptChange: setEditPrompt,
    onConfirmEdit: (referralId: string) => {
      if (!selectedRunId) {
        return;
      }
      const runId = selectedRunId;
      const prompt = editPrompt.trim();
      void runDecision(async () => {
        const response = await collaborationFetch(
          `/api/collaboration/runs/${encodeURIComponent(runId)}/referrals/${encodeURIComponent(referralId)}/prompt`,
          {
            method: 'POST',
            body: JSON.stringify({ prompt }),
          },
        );
        if (!response.ok) {
          await showRefusal(response);
          return;
        }
        setEditReferralId(null);
        setEditPrompt('');
        await refresh();
      });
    },
    onBeginCancel: () => {
      setConfirmingCancel(true);
    },
    onCancelCancel: () => {
      setConfirmingCancel(false);
    },
    onConfirmCancel: () => {
      if (!selectedRunId) {
        return;
      }
      const runId = selectedRunId;
      void runDecision(async () => {
        const response = await collaborationFetch(
          `/api/collaboration/runs/${encodeURIComponent(runId)}/cancel`,
          {
            method: 'POST',
            body: JSON.stringify({}),
          },
        );
        if (!response.ok) {
          await showRefusal(response);
          return;
        }
        setConfirmingCancel(false);
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
  const queryWorkflowId = searchParams.get('workflowId')?.trim() || '';
  const workflows = useCollaborationWorkflowList(true);
  const viewProps = useCollaborationScreen({
    t,
    translateScope: (scopeId: string) =>
      collaborationScopeLabel(scopeId, knowledgeT(`scopes.${scopeId}`)),
    locale,
    sessionId,
    queryProjectId,
    workflows,
    queryWorkflowId,
    rosterEnabled: true,
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
