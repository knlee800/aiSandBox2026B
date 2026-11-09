import React from 'react';
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  CodeBracketIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  SunIcon,
  UserGroupIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  approveWithoutPassingTestsForClick,
  collaborationFailureReason,
  collaborationProviderUsageLimitCopy,
  fillTemplate,
  formatCollaborationSource,
  type CollaborationTeamId,
} from '@/lib/collaboration/logic';

export interface CollaborationViewLabels {
  title: string;
  intro: string;
  taskLabel: string;
  taskPlaceholder: string;
  start: string;
  starting: string;
  teamHeading: string;
  teamPickerLabel: string;
  lead: string;
  writer: string;
  reviewer: string;
  leadSummary: string;
  writerSummary: string;
  reviewerSummary: string;
  fileAccessOn: string;
  chainHeading: string;
  chainEmpty: string;
  prompt: string;
  answer: string;
  note: string;
  failure: string;
  reason: string;
  decidedBy: string;
  approve: string;
  reject: string;
  rejectReasonLabel: string;
  rejectPrompt: string;
  rejectConfirm: string;
  cancelReject: string;
  editTask: string;
  editTaskLabel: string;
  saveTask: string;
  keepTask: string;
  runEndedByReject: string;
  cancelRun: string;
  cancelRunPrompt: string;
  cancelRunConfirm: string;
  cancelRunKeep: string;
  pastRuns: string;
  pastRunsEmpty: string;
  openRun: string;
  backToWorkspace: string;
  missingSession: string;
  missingProject: string;
  noAnswerYet: string;
  conversationCreated: string;
  loading: string;
  writerWarning: string;
  changedFiles: string;
  noChangedFiles: string;
  savePoint: string;
  testsHeading: string;
  testPassed: string;
  testFailed: string;
  reviewOrRevert: string;
  sendBackRound: string;
  diff: string;
  diffUnavailable: string;
  diffEmpty: string;
  testsFailedGate: string;
  testsMissingGate: string;
  approveWithoutPassingTests: string;
  sources: string;
  unsourced: string;
  droppedSources: string;
}

export interface CollaborationTeamMemberView {
  name: string;
  summary: string;
}

export interface CollaborationHandoffViewModel {
  referralId: string;
  statusLabel: string;
  asked: string;
  prompt: string | null;
  answer: string | null;
  handoffNote: string | null;
  failureReason: string | null;
  decidedBy: string | null;
  rejectReason: string | null;
  waiting: boolean;
  canChangeFiles: boolean;
  changedPaths: string[];
  savePoint: string | null;
  tests: Array<{ command: string; passed: boolean }>;
  roundLabel: string | null;
  diff: string | null;
  diffUnavailable: boolean;
  testsGate: 'passed' | 'not_required' | 'blocked';
  testsBlockReason: 'failed' | 'none' | null;
  approveWithoutTests: boolean;
  sources: Array<{
    documentId: string;
    title: string;
    scopeLabel: string;
    heading: string | null;
  }>;
  showUnsourced: boolean;
  droppedSourceCount: number;
}

export interface CollaborationPastRunView {
  id: string;
  statusLabel: string;
  when: string;
  selected: boolean;
  teamLabel?: string;
}

export interface CollaborationTeamChoice {
  id: CollaborationTeamId;
  label: string;
  hint: string;
}

export interface CollaborationRunTeamView {
  label: string;
  roles: string[];
}

/** BIZ-BRIEF-01: a ready-made request that fills the task box. It never starts a run. */
export interface CollaborationTaskPreset {
  id: string;
  label: string;
}

export default function CollaborationView(props: {
  labels: CollaborationViewLabels;
  backHref: string;
  sessionReady: boolean;
  projectReady: boolean;
  loading: boolean;
  notice: string | null;
  conversationCreated: boolean;
  task: string;
  deciding: boolean;
  team: CollaborationTeamMemberView[];
  selectedTeam?: CollaborationTeamId;
  teamChoices?: CollaborationTeamChoice[];
  onTeamChange?: (teamId: CollaborationTeamId) => void;
  accessNote?: string;
  chainEmptyText?: string;
  runTeam?: CollaborationRunTeamView | null;
  taskPresets?: CollaborationTaskPreset[];
  taskPresetHint?: string;
  onTaskPreset?: (presetId: string) => void;
  handoffs: CollaborationHandoffViewModel[];
  runs: CollaborationPastRunView[];
  rejectReferralId: string | null;
  rejectReason: string;
  runEndedByReject: boolean;
  onTaskChange: (value: string) => void;
  onStart: () => void;
  onOpenRun: (runId: string) => void;
  onApprove: (referralId: string, approveWithoutPassingTests?: boolean) => void;
  onApproveWithoutTestsChange: (referralId: string, checked: boolean) => void;
  onBeginReject: (referralId: string) => void;
  onCancelReject: () => void;
  onConfirmReject: (referralId: string) => void;
  onRejectReasonChange: (value: string) => void;
  editReferralId: string | null;
  editPrompt: string;
  onBeginEdit: (referralId: string, currentPrompt: string) => void;
  onCancelEdit: () => void;
  onEditPromptChange: (value: string) => void;
  onConfirmEdit: (referralId: string) => void;
  selectedRunActive: boolean;
  confirmingCancel: boolean;
  onBeginCancel: () => void;
  onCancelCancel: () => void;
  onConfirmCancel: () => void;
}) {
  const { labels } = props;
  const canStart = props.sessionReady && props.task.trim().length > 0 && !props.deciding;
  const teamChoices = props.teamChoices ?? [];
  const selectedTeam = props.selectedTeam ?? 'coding';
  const taskPresets = props.taskPresets ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 py-6 text-gray-900">
      <a
        href={props.backHref}
        className="text-sm font-medium text-indigo-700 hover:underline"
        data-testid="collaboration-back"
      >
        {labels.backToWorkspace}
      </a>
      <div className="mt-3 flex min-w-0 items-center gap-2">
        <UserGroupIcon className="h-6 w-6 shrink-0 text-indigo-700" aria-hidden="true" />
        <h1 className="truncate text-2xl font-semibold">{labels.title}</h1>
      </div>
      <p className="mt-2 text-sm text-gray-600">{labels.intro}</p>

      {props.notice ? (
        <p
          className="mt-4 break-words rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          data-testid="collaboration-notice"
          role="alert"
        >
          {props.notice}
        </p>
      ) : null}
      {props.conversationCreated ? (
        <p className="mt-4 break-words rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          {labels.conversationCreated}
        </p>
      ) : null}
      {props.loading ? <p className="mt-4 text-sm text-gray-500">{labels.loading}</p> : null}

      {!props.sessionReady ? (
        <p className="mt-4 text-sm text-gray-700" data-testid="collaboration-missing-session">
          {labels.missingSession}
        </p>
      ) : (
        <form
          className="mt-4 min-w-0"
          onSubmit={(event) => {
            event.preventDefault();
            if (canStart) {
              props.onStart();
            }
          }}
        >
          {teamChoices.length > 0 ? (
            <fieldset className="min-w-0" data-testid="collaboration-team-picker">
              <legend className="text-sm font-medium text-gray-800">{labels.teamPickerLabel}</legend>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {teamChoices.map((choice) => {
                  const selected = selectedTeam === choice.id;
                  return (
                    <label
                      key={choice.id}
                      data-testid={`collaboration-team-option-${choice.id}`}
                      className={`flex min-w-0 cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${
                        selected
                          ? 'border-indigo-300 bg-indigo-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="collaboration-team"
                        value={choice.id}
                        checked={selected}
                        onChange={() => props.onTeamChange?.(choice.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900">{choice.label}</span>
                        <span className="block break-words text-sm text-gray-600">{choice.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          <label
            htmlFor="collaboration-task"
            className={`text-sm font-medium text-gray-800 ${teamChoices.length > 0 ? 'mt-4 block' : ''}`}
          >
            {labels.taskLabel}
          </label>
          {taskPresets.length > 0 ? (
            <div
              className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
              data-testid="collaboration-presets"
            >
              {taskPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`collaboration-preset-${preset.id}`}
                  disabled={props.deciding}
                  onClick={() => props.onTaskPreset?.(preset.id)}
                  aria-describedby={props.taskPresetHint ? 'collaboration-preset-hint' : undefined}
                  className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition-transform duration-150 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-[0.97]"
                >
                  <SunIcon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                  <span className="break-words">{preset.label}</span>
                </button>
              ))}
              {props.taskPresetHint ? (
                <span
                  id="collaboration-preset-hint"
                  className="min-w-0 break-words text-xs text-gray-500"
                  data-testid="collaboration-preset-hint"
                >
                  {props.taskPresetHint}
                </span>
              ) : null}
            </div>
          ) : null}
          <textarea
            id="collaboration-task"
            data-testid="collaboration-task"
            value={props.task}
            onChange={(event) => props.onTaskChange(event.target.value)}
            placeholder={labels.taskPlaceholder}
            rows={4}
            className="mt-1 w-full max-w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            data-testid="collaboration-start"
            disabled={!canStart}
            className="mt-2 inline-flex items-center rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {props.deciding ? labels.starting : labels.start}
          </button>
        </form>
      )}

      <section className="mt-6 min-w-0">
        <h2 className="text-sm font-semibold text-gray-800">{labels.teamHeading}</h2>
        <p className="mt-1 text-sm text-gray-600">{props.accessNote ?? labels.fileAccessOn}</p>
        <ul className="mt-2 space-y-2">
          {props.team.map((member) => (
            <li
              key={member.name}
              className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <p className="text-sm font-medium text-gray-900">{member.name}</p>
              <p className="break-words text-sm text-gray-600">{member.summary}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 min-w-0" data-testid="collaboration-chain">
        <h2 className="text-sm font-semibold text-gray-800">{labels.chainHeading}</h2>
        {props.runTeam ? (
          <p className="mt-1 break-words text-sm text-gray-800" data-testid="collaboration-run-team">
            <span className="font-medium">{props.runTeam.label}</span>
            {props.runTeam.roles.length > 0 ? (
              <span className="text-gray-600">{` · ${props.runTeam.roles.join(' · ')}`}</span>
            ) : null}
          </p>
        ) : null}
        {props.runEndedByReject ? (
          <p
            className="mt-2 text-sm text-gray-500"
            data-testid="collaboration-run-ended-by-reject"
          >
            {labels.runEndedByReject}
          </p>
        ) : null}
        {props.selectedRunActive ? (
          <div className="mt-3">
            {props.confirmingCancel ? (
              <div className="flex min-w-0 w-full flex-col gap-2">
                <p className="text-sm text-gray-700">{labels.cancelRunPrompt}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="collaboration-cancel-confirm"
                    disabled={props.deciding}
                    onClick={props.onConfirmCancel}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircleIcon className="h-4 w-4" aria-hidden="true" />
                    {labels.cancelRunConfirm}
                  </button>
                  <button
                    type="button"
                    data-testid="collaboration-cancel-keep"
                    disabled={props.deciding}
                    onClick={props.onCancelCancel}
                    className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    {labels.cancelRunKeep}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                data-testid="collaboration-cancel-run"
                disabled={props.deciding}
                onClick={props.onBeginCancel}
                className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <XCircleIcon className="h-4 w-4" aria-hidden="true" />
                {labels.cancelRun}
              </button>
            )}
          </div>
        ) : null}
        {props.handoffs.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{props.chainEmptyText ?? labels.chainEmpty}</p>
        ) : (
          <ol className="mt-2 space-y-3">
            {props.handoffs.map((handoff) => {
              const rejecting = props.rejectReferralId === handoff.referralId;
              const editing = props.editReferralId === handoff.referralId;
              const canEditTask = handoff.prompt !== null && handoff.prompt.length > 0;
              const showWork =
                !handoff.waiting &&
                (handoff.canChangeFiles ||
                  handoff.changedPaths.length > 0 ||
                  handoff.savePoint !== null ||
                  handoff.tests.length > 0);
              return (
                <li
                  key={handoff.referralId}
                  className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-3"
                  data-testid={`collaboration-handoff-${handoff.referralId}`}
                >
                  <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                    <p className="min-w-0 break-words text-sm font-medium text-gray-900">
                      {handoff.asked}
                    </p>
                    <p className="text-xs font-medium text-gray-500">{handoff.statusLabel}</p>
                  </div>
                  {handoff.roundLabel ? (
                    <p
                      className="mt-1 flex min-w-0 items-center gap-1 text-sm font-medium text-indigo-800"
                      data-testid={`collaboration-round-${handoff.referralId}`}
                    >
                      <ArrowPathIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="break-words">{handoff.roundLabel}</span>
                    </p>
                  ) : null}
                  {handoff.diff !== null || handoff.diffUnavailable ? (
                    <details
                      className="mt-2 min-w-0 max-w-full"
                      data-testid={`collaboration-diff-${handoff.referralId}`}
                    >
                      <summary className="flex min-w-0 cursor-pointer items-center gap-1 text-sm text-gray-600">
                        <CodeBracketIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="break-words">{labels.diff}</span>
                      </summary>
                      <pre
                        className="mt-1 max-h-60 w-full max-w-full overflow-auto whitespace-pre rounded-lg bg-gray-50 p-2 font-mono text-xs text-gray-800"
                        data-testid={`collaboration-diff-text-${handoff.referralId}`}
                      >
                        {handoff.diffUnavailable || handoff.diff === null
                          ? labels.diffUnavailable
                          : handoff.diff.length === 0
                            ? labels.diffEmpty
                            : handoff.diff}
                      </pre>
                    </details>
                  ) : null}
                  {handoff.prompt !== null ? (
                    <details className="mt-2 min-w-0">
                      <summary className="cursor-pointer text-sm text-gray-600">{labels.prompt}</summary>
                      <pre className="mt-1 max-w-full whitespace-pre-wrap break-words font-sans text-sm text-gray-800">
                        {handoff.prompt}
                      </pre>
                    </details>
                  ) : null}
                  {handoff.answer !== null ? (
                    <div className="mt-2 min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        {labels.answer}
                      </p>
                      <pre
                        className="mt-1 max-w-full whitespace-pre-wrap break-words font-sans text-sm text-gray-800"
                        data-testid={`collaboration-answer-${handoff.referralId}`}
                      >
                        {handoff.answer}
                      </pre>
                    </div>
                  ) : !handoff.waiting && !handoff.failureReason ? (
                    <p className="mt-2 text-sm text-gray-500">{labels.noAnswerYet}</p>
                  ) : null}
                  {!handoff.waiting &&
                  handoff.answer !== null &&
                  (handoff.sources.length > 0 ||
                    handoff.showUnsourced ||
                    handoff.droppedSourceCount > 0) ? (
                    <div
                      className="mt-2 min-w-0"
                      data-testid={`collaboration-sources-${handoff.referralId}`}
                    >
                      {handoff.sources.length > 0 ? (
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            {labels.sources}
                          </p>
                          <ul className="mt-1 space-y-1">
                            {handoff.sources.map((source, index) => (
                              <li
                                key={`${handoff.referralId}-source-${index}`}
                                className="break-words text-sm text-gray-800"
                                data-testid={`collaboration-source-${handoff.referralId}-${index}`}
                              >
                                {formatCollaborationSource(source)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {handoff.showUnsourced ? (
                        <p
                          className="mt-1 text-sm font-medium text-amber-800"
                          data-testid={`collaboration-unsourced-${handoff.referralId}`}
                        >
                          {labels.unsourced}
                        </p>
                      ) : null}
                      {handoff.droppedSourceCount > 0 ? (
                        <p
                          className="mt-1 break-words text-sm text-gray-600"
                          data-testid={`collaboration-dropped-sources-${handoff.referralId}`}
                        >
                          {fillTemplate(labels.droppedSources, {
                            count: String(handoff.droppedSourceCount),
                          })}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {handoff.failureReason ? (
                    <p className="mt-2 break-words text-sm text-red-700">
                      <span className="font-medium">{labels.failure}: </span>
                      {collaborationFailureReason(
                        handoff.failureReason,
                        collaborationProviderUsageLimitCopy(props.backHref),
                      )}
                    </p>
                  ) : null}
                  {handoff.rejectReason ? (
                    <p className="mt-2 break-words text-sm text-gray-700">
                      <span className="font-medium">{labels.reason}: </span>
                      {handoff.rejectReason}
                    </p>
                  ) : null}
                  {handoff.handoffNote ? (
                    <p className="mt-2 break-words text-sm text-gray-600">
                      <span className="font-medium">{labels.note}: </span>
                      {handoff.handoffNote}
                    </p>
                  ) : null}
                  {showWork ? (
                    <div
                      className="mt-3 min-w-0 max-w-full space-y-2"
                      data-testid={`collaboration-work-${handoff.referralId}`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                          {labels.changedFiles}
                        </p>
                        {handoff.changedPaths.length === 0 ? (
                          <p className="mt-1 text-sm text-gray-600">{labels.noChangedFiles}</p>
                        ) : (
                          <ul className="mt-1 space-y-1">
                            {handoff.changedPaths.map((path, index) => (
                              <li
                                key={`${handoff.referralId}-path-${index}`}
                                className="break-all text-sm text-gray-800"
                                data-testid={`collaboration-changed-${handoff.referralId}-${index}`}
                              >
                                {path}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {handoff.savePoint ? (
                        <p
                          className="break-all text-sm text-gray-800"
                          data-testid={`collaboration-save-point-${handoff.referralId}`}
                        >
                          <span className="font-medium text-gray-600">{labels.savePoint}: </span>
                          {handoff.savePoint}
                        </p>
                      ) : null}
                      {handoff.tests.length > 0 ? (
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            {labels.testsHeading}
                          </p>
                          <ul className="mt-1 space-y-1">
                            {handoff.tests.map((test, index) => (
                              <li
                                key={`${handoff.referralId}-test-${index}`}
                                className="break-words text-sm text-gray-800"
                                data-testid={`collaboration-test-${handoff.referralId}-${index}`}
                              >
                                {test.command} {test.passed ? labels.testPassed : labels.testFailed}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <a
                        href={props.backHref}
                        className="inline-flex max-w-full items-center break-words text-sm font-medium text-indigo-700 hover:underline"
                        data-testid={`collaboration-workspace-${handoff.referralId}`}
                      >
                        <ArrowUturnLeftIcon
                          className="mr-1 h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        {labels.reviewOrRevert}
                      </a>
                    </div>
                  ) : null}
                  {handoff.decidedBy ? (
                    <p className="mt-2 break-all text-xs text-gray-500">
                      {labels.decidedBy}: {handoff.decidedBy}
                    </p>
                  ) : null}
                  {handoff.waiting && handoff.canChangeFiles ? (
                    <p
                      className="mt-3 flex min-w-0 max-w-full items-start gap-2 break-words rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                      data-testid={`collaboration-write-warning-${handoff.referralId}`}
                      role="alert"
                    >
                      <ExclamationTriangleIcon
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{labels.writerWarning}</span>
                    </p>
                  ) : null}
                  {handoff.waiting && handoff.testsGate === 'blocked' ? (
                    <div
                      className="mt-3 min-w-0 max-w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                      data-testid={`collaboration-tests-gate-${handoff.referralId}`}
                      role="status"
                    >
                      <p className="flex min-w-0 items-start gap-2 break-words text-sm text-amber-950">
                        <ExclamationTriangleIcon
                          className="mt-0.5 h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          {handoff.testsBlockReason === 'failed'
                            ? labels.testsFailedGate
                            : labels.testsMissingGate}
                        </span>
                      </p>
                      <label className="mt-2 flex min-w-0 items-start gap-2 text-sm text-amber-950">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          data-testid={`collaboration-approve-without-tests-${handoff.referralId}`}
                          checked={handoff.approveWithoutTests}
                          onChange={(event) =>
                            props.onApproveWithoutTestsChange(
                              handoff.referralId,
                              event.target.checked,
                            )
                          }
                        />
                        <span>{labels.approveWithoutPassingTests}</span>
                      </label>
                    </div>
                  ) : null}
                  {handoff.waiting ? (
                    <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                      {editing ? (
                        <div className="flex min-w-0 w-full flex-col gap-2">
                          <label
                            htmlFor={`collaboration-edit-task-input-${handoff.referralId}`}
                            className="text-sm text-gray-700"
                          >
                            {labels.editTaskLabel}
                          </label>
                          <textarea
                            id={`collaboration-edit-task-input-${handoff.referralId}`}
                            data-testid="collaboration-edit-task-input"
                            value={props.editPrompt}
                            autoFocus
                            rows={4}
                            onChange={(event) => props.onEditPromptChange(event.target.value)}
                            className="w-full max-w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-300 focus:bg-white focus:outline-none"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid="collaboration-edit-task-save"
                              disabled={props.deciding || props.editPrompt.trim().length === 0}
                              onClick={() => props.onConfirmEdit(handoff.referralId)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                            >
                              {labels.saveTask}
                            </button>
                            <button
                              type="button"
                              data-testid="collaboration-edit-task-keep"
                              onClick={props.onCancelEdit}
                              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                            >
                              {labels.keepTask}
                            </button>
                          </div>
                        </div>
                      ) : rejecting ? (
                        <div className="flex min-w-0 w-full flex-col gap-2">
                          <p className="text-sm text-gray-700">{labels.rejectPrompt}</p>
                          <label
                            htmlFor={`collaboration-reject-reason-${handoff.referralId}`}
                            className="text-sm text-gray-700"
                          >
                            {labels.rejectReasonLabel}
                          </label>
                          <input
                            id={`collaboration-reject-reason-${handoff.referralId}`}
                            data-testid={`collaboration-reject-reason-${handoff.referralId}`}
                            value={props.rejectReason}
                            autoFocus
                            onChange={(event) => props.onRejectReasonChange(event.target.value)}
                            onKeyDown={(event) => {
                              const native = event.nativeEvent;
                              if (
                                event.key !== 'Enter' ||
                                props.deciding ||
                                native.isComposing ||
                                native.keyCode === 229
                              ) {
                                return;
                              }
                              event.preventDefault();
                              props.onConfirmReject(handoff.referralId);
                            }}
                            className="w-full max-w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`collaboration-reject-confirm-${handoff.referralId}`}
                              disabled={props.deciding}
                              onClick={() => props.onConfirmReject(handoff.referralId)}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                              {labels.rejectConfirm}
                            </button>
                            <button
                              type="button"
                              onClick={props.onCancelReject}
                              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                            >
                              {labels.cancelReject}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            data-testid={`collaboration-approve-${handoff.referralId}`}
                            disabled={
                              props.deciding ||
                              (handoff.testsGate === 'blocked' && !handoff.approveWithoutTests)
                            }
                            onClick={() =>
                              props.onApprove(
                                handoff.referralId,
                                approveWithoutPassingTestsForClick({
                                  testsGate: handoff.testsGate,
                                  approveWithoutTests: handoff.approveWithoutTests,
                                }),
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                          >
                            <CheckIcon className="h-4 w-4" aria-hidden="true" />
                            {labels.approve}
                          </button>
                          <button
                            type="button"
                            data-testid={`collaboration-reject-${handoff.referralId}`}
                            disabled={props.deciding}
                            onClick={() => props.onBeginReject(handoff.referralId)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                            {labels.reject}
                          </button>
                          {canEditTask ? (
                            <button
                              type="button"
                              data-testid="collaboration-edit-task"
                              disabled={props.deciding}
                              onClick={() =>
                                props.onBeginEdit(handoff.referralId, handoff.prompt ?? '')
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                              {labels.editTask}
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mt-6 min-w-0">
        <h2 className="text-sm font-semibold text-gray-800">{labels.pastRuns}</h2>
        {!props.projectReady ? (
          <p className="mt-2 text-sm text-gray-600" data-testid="collaboration-missing-project">
            {labels.missingProject}
          </p>
        ) : props.runs.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{labels.pastRunsEmpty}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {props.runs.map((run) => (
              <li key={run.id}>
                <button
                  type="button"
                  data-testid={`collaboration-open-run-${run.id}`}
                  aria-current={run.selected ? 'true' : undefined}
                  onClick={() => props.onOpenRun(run.id)}
                  className={`flex w-full min-w-0 flex-wrap items-baseline justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                    run.selected
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <span className="font-medium text-gray-900">{labels.openRun}</span>
                  <span className="break-words text-gray-600">{run.statusLabel}</span>
                  {run.teamLabel ? (
                    <span className="w-full break-words text-xs text-gray-500">{run.teamLabel}</span>
                  ) : null}
                  <span className="w-full break-words text-xs text-gray-500">{run.when}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
