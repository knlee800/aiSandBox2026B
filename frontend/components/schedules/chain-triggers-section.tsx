'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Spinner from '@/components/ui/Spinner';
import { useTranslations } from '@/hooks/useTranslations';
import {
  createChainTrigger,
  deleteChainTrigger,
  loadChainTriggerRuns,
  loadChainTriggers,
  updateChainTrigger,
  type ChainTriggersFetcher,
} from './chain-triggers-api';
import {
  CHAIN_FIRES_ON,
  CHAIN_TRIGGER_TASK_MAX_CHARS,
  CHAIN_WARNING_NOTICE_KEYS,
  chainDraftSourceStatus,
  chainFiresOnRowKey,
  chainLimitReached,
  chainOutcomeKey,
  chainReasonKey,
  chainSameWorkflow,
  chainSourceName,
  chainSourceNotOn,
  chainSourceStatus,
  chainSwitchNoticeKeyFor,
  chainWouldLoop,
  draftFromChainTrigger,
  draftToBody,
  emptyChainDraft,
  type ChainTriggerDraft,
  type ChainTriggerItem,
  type ChainTriggerLastRun,
  type ChainTriggerList,
  type ChainTriggerRun,
} from './chain-triggers.logic';
import {
  browserTimeZone,
  draftTargetStatus,
  fillTemplate,
  targetNotOn,
  targetWorkflowStatus,
  taskPreview,
  type WorkflowOption,
} from './schedules.logic';

/**
 * TRIGGER-CHAIN-01 S3: the "After a workflow finishes" section of the
 * Schedules page. It loads and fails on its own, so a failure here never
 * touches the schedules above it. A chain trigger starts a run as its owner a
 * few minutes after a run of one source workflow finishes; nothing here starts
 * a run or reads an answer.
 */

export type ChainTriggersPhase = 'loading' | 'ready' | 'failed' | 'forbidden';

export interface ChainTriggerFormState {
  /** null while creating. */
  editingId: string | null;
  draft: ChainTriggerDraft;
  saving: boolean;
  errorKey: string | null;
}

export interface ChainTriggerHistoryState {
  triggerId: string;
  phase: 'loading' | 'ready' | 'failed';
  runs: ChainTriggerRun[];
}

export interface ChainTriggersSectionViewProps {
  /** Keys are inside the schedules.chain namespace. */
  t: (key: string) => string;
  locale: string;
  phase: ChainTriggersPhase;
  data: ChainTriggerList | null;
  workflows: WorkflowOption[];
  timeZones: string[];
  form: ChainTriggerFormState | null;
  noticeKey: string | null;
  rowError: { triggerId: string; errorKey: string } | null;
  busyId: string | null;
  confirmDeleteId: string | null;
  history: ChainTriggerHistoryState | null;
  onRetry: () => void;
  onNew: () => void;
  onEdit: (trigger: ChainTriggerItem) => void;
  onDraftChange: (draft: ChainTriggerDraft) => void;
  onSave: () => void;
  onCancelForm: () => void;
  onSwitch: (trigger: ChainTriggerItem) => void;
  onAskDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
  onToggleHistory: (id: string) => void;
}

const QUIET_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60';
const PRIMARY_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60';
const DANGER_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md border border-red-700/60 px-3 py-1.5 text-sm font-medium text-red-200 transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 hover:bg-red-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60';
const FIELD =
  'mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60';
const LINK =
  'text-indigo-300 underline underline-offset-2 hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

function Banner({ testId, text }: { testId: string; text: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-amber-100"
      role="status"
      data-testid={testId}
    >
      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="break-words text-sm">{text}</p>
    </div>
  );
}

function Refusal({ testId, text, id }: { testId: string; text: string; id?: string }) {
  return (
    <p id={id} className="mt-2 flex items-start gap-2 text-sm text-amber-200" role="status" data-testid={testId}>
      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="break-words">{text}</span>
    </p>
  );
}

function StatusPill({ on, t }: { on: boolean; t: (key: string) => string }) {
  return on ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
      {t('row.on')}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-slate-600 px-2 py-0.5 text-[11px] font-medium text-slate-300">
      {t('row.off')}
    </span>
  );
}

export function describeChainRun(
  t: (key: string) => string,
  run: ChainTriggerLastRun,
): { outcome: string; reason: string | null; depth: string } {
  return {
    outcome: t(chainOutcomeKey(run.outcome)),
    reason: run.reason ? t(chainReasonKey(run.reason)) : null,
    depth: fillTemplate(t('row.depth'), { depth: run.depth }),
  };
}

function RunLine({
  t,
  locale,
  run,
  testId,
}: {
  t: (key: string) => string;
  locale: string;
  run: ChainTriggerLastRun;
  testId: string;
}) {
  const { outcome, reason, depth } = describeChainRun(t, run);
  return (
    <span className="min-w-0 break-words text-sm text-slate-200" data-testid={testId}>
      {run.localDate} {'·'} {outcome}
      {reason ? ` · ${reason}` : ''}
      {` · ${depth}`}
      {run.collaborationRunId ? (
        <>
          {' '}
          <Link href={`/${locale}/results`} className={LINK} data-testid={`${testId}-result`}>
            {t('row.viewResult')}
          </Link>
        </>
      ) : null}
    </span>
  );
}

function workflowLabel(t: (key: string) => string, name: string): string {
  return fillTemplate(t('target.workflowNamed'), { name });
}

function targetLabel(t: (key: string) => string, trigger: ChainTriggerItem): string {
  if (trigger.target.kind === 'chief-of-staff') return t('target.chiefOfStaff');
  if (trigger.target.missing) return t('target.workflowGone');
  return workflowLabel(t, trigger.target.name ?? '');
}

/**
 * The source's name from the trigger's `source` (or, from an older gateway,
 * the workflows the page already loads), or the deleted-workflow label.
 */
function sourceLabel(t: (key: string) => string, workflows: WorkflowOption[], trigger: ChainTriggerItem): string {
  const name = chainSourceName(trigger, workflows);
  return name !== null ? workflowLabel(t, name) : t('source.workflowGone');
}

/**
 * CHAIN-SOURCE-OFF-01: the amber line under a trigger whose source will keep it
 * from firing (deleted, switched off, or not switched on yet). Nothing for an
 * active source.
 */
function SourceStatusLine({
  t,
  trigger,
  workflows,
}: {
  t: (key: string) => string;
  trigger: ChainTriggerItem;
  workflows: WorkflowOption[];
}): React.ReactElement | null {
  const status = chainSourceStatus(trigger, workflows);
  if (status !== 'missing' && !chainSourceNotOn(status)) return null;
  const testId =
    status === 'missing' ? `chain-trigger-source-gone-${trigger.id}` : `chain-trigger-source-status-${trigger.id}`;
  const text = t(status === 'missing' ? 'source.goneNote' : status === 'disabled' ? 'source.offNote' : 'source.draftNote');
  return (
    <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-200" data-testid={testId} data-status={status}>
      <ExclamationTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{text}</span>
    </p>
  );
}

/**
 * TRIGGER-TARGET-OFF-01: the amber line under the target of a trigger whose
 * target workflow is switched off or not switched on yet. Distinct from the
 * source line above. Nothing for an active target, the Chief of Staff, or a
 * deleted workflow (its label already says so).
 */
function TargetStatusLine({
  t,
  trigger,
}: {
  t: (key: string) => string;
  trigger: ChainTriggerItem;
}): React.ReactElement | null {
  const status = targetWorkflowStatus(trigger.target);
  if (!targetNotOn(status)) return null;
  return (
    <p
      className="mt-1 flex items-start gap-1.5 text-xs text-amber-200"
      data-testid={`chain-trigger-target-status-${trigger.id}`}
      data-status={status}
    >
      <ExclamationTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{t(status === 'disabled' ? 'target.offNote' : 'target.draftNote')}</span>
    </p>
  );
}

export function ChainTriggerForm(props: {
  t: (key: string) => string;
  form: ChainTriggerFormState;
  triggers: ChainTriggerItem[];
  workflows: WorkflowOption[];
  timeZones: string[];
  onDraftChange: (draft: ChainTriggerDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}): React.ReactElement {
  const { t, form, triggers, workflows, timeZones, onDraftChange, onSave, onCancel } = props;
  const { draft, saving, errorKey, editingId } = form;
  const set = (patch: Partial<ChainTriggerDraft>) => onDraftChange({ ...draft, ...patch });
  const sameWorkflow = chainSameWorkflow(draft);
  const loops = chainWouldLoop(triggers, draft, editingId);
  // CHAIN-SOURCE-OFF-01: warn, not refuse, when the chosen source is not switched on.
  const saved = editingId ? triggers.find((entry) => entry.id === editingId)?.source ?? null : null;
  const sourceStatus = chainDraftSourceStatus(workflows, draft.sourceId, saved);
  const sourceWarning = chainSourceNotOn(sourceStatus)
    ? t(sourceStatus === 'disabled' ? 'form.sourceOffWarning' : 'form.sourceDraftWarning')
    : null;
  // TRIGGER-TARGET-OFF-01: the same for the chosen target workflow.
  const savedTarget = editingId ? triggers.find((entry) => entry.id === editingId)?.target ?? null : null;
  const targetStatus = draftTargetStatus(workflows, draft.targetId, savedTarget);
  const targetWarning = targetNotOn(targetStatus)
    ? t(targetStatus === 'disabled' ? 'form.targetOffWarning' : 'form.targetDraftWarning')
    : null;
  const failsOnFailed = draft.firesOn === 'failed';
  return (
    <form
      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5"
      aria-labelledby="chain-trigger-form-title"
      data-testid="chain-trigger-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <h3 id="chain-trigger-form-title" className="text-sm font-semibold text-white">
        {editingId ? t('form.editTitle') : t('form.createTitle')}
      </h3>
      <p className="text-sm text-slate-300" data-testid="chain-trigger-hint">
        {t(failsOnFailed ? 'form.hintFailed' : 'form.hint')}
      </p>

      <div>
        <label htmlFor="chain-trigger-source" className="text-xs font-medium text-slate-300">
          {t('form.source')}
        </label>
        <select
          id="chain-trigger-source"
          className={FIELD}
          value={draft.sourceId}
          disabled={saving}
          onChange={(event) => set({ sourceId: event.target.value })}
          aria-describedby={sourceWarning ? 'chain-trigger-source-help chain-trigger-source-warning' : 'chain-trigger-source-help'}
          data-testid="chain-trigger-source"
        >
          <option value="">{t('form.sourcePlaceholder')}</option>
          {workflows.map((workflow) => (
            <option key={workflow.id} value={workflow.id}>
              {workflowLabel(t, workflow.name)}
            </option>
          ))}
          {draft.sourceId !== '' && !workflows.some((workflow) => workflow.id === draft.sourceId) ? (
            <option value={draft.sourceId}>{t('source.workflowGone')}</option>
          ) : null}
        </select>
        <fieldset className="mt-3" disabled={saving} data-testid="chain-trigger-fires-on">
          <legend className="text-xs font-medium text-slate-300">{t('form.firesOn')}</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {CHAIN_FIRES_ON.map((value) => (
              <label key={value} className="inline-flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="radio"
                  name="chain-trigger-fires-on"
                  className="h-4 w-4 border-slate-600 bg-slate-950 text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  value={value}
                  checked={draft.firesOn === value}
                  onChange={() => set({ firesOn: value })}
                  aria-describedby="chain-trigger-source-help"
                  data-testid={`chain-trigger-fires-on-${value}`}
                />
                {t(value === 'failed' ? 'form.firesOnFailed' : 'form.firesOnCompleted')}
              </label>
            ))}
          </div>
        </fieldset>
        <p id="chain-trigger-source-help" className="mt-2 text-xs text-slate-400" data-testid="chain-trigger-source-help">
          {t(failsOnFailed ? 'form.firesOnFailedHelp' : 'form.sourceHelp')}
        </p>
        {sourceWarning ? (
          <Refusal id="chain-trigger-source-warning" testId="chain-trigger-source-warning" text={sourceWarning} />
        ) : null}
      </div>

      <div>
        <label htmlFor="chain-trigger-target" className="text-xs font-medium text-slate-300">
          {t('form.target')}
        </label>
        <select
          id="chain-trigger-target"
          className={FIELD}
          value={draft.targetId}
          disabled={saving}
          onChange={(event) => set({ targetId: event.target.value })}
          aria-describedby={targetWarning ? 'chain-trigger-loop-rule chain-trigger-target-warning' : 'chain-trigger-loop-rule'}
          data-testid="chain-trigger-target"
        >
          <option value="">{t('target.chiefOfStaff')}</option>
          {workflows.map((workflow) => (
            <option key={workflow.id} value={workflow.id}>
              {workflowLabel(t, workflow.name)}
            </option>
          ))}
          {draft.targetId !== '' && !workflows.some((workflow) => workflow.id === draft.targetId) ? (
            <option value={draft.targetId}>{t('target.workflowGone')}</option>
          ) : null}
        </select>
        <p id="chain-trigger-loop-rule" className="mt-1 text-xs text-slate-400" data-testid="chain-trigger-loop-rule">
          {t('form.loopRule')}
        </p>
        {targetWarning ? (
          <Refusal id="chain-trigger-target-warning" testId="chain-trigger-target-warning" text={targetWarning} />
        ) : null}
        {sameWorkflow ? (
          <Refusal testId="chain-trigger-same-refusal" text={t('errors.chain_trigger_same_workflow')} />
        ) : null}
        {loops ? <Refusal testId="chain-trigger-cycle-refusal" text={t('errors.chain_trigger_cycle')} /> : null}
      </div>

      <div>
        <label htmlFor="chain-trigger-task" className="text-xs font-medium text-slate-300">
          {t('form.task')}
        </label>
        <textarea
          id="chain-trigger-task"
          className={`${FIELD} min-h-[6rem]`}
          value={draft.task}
          maxLength={CHAIN_TRIGGER_TASK_MAX_CHARS}
          disabled={saving}
          onChange={(event) => set({ task: event.target.value })}
          data-testid="chain-trigger-task"
        />
        <p className="mt-1 text-xs text-slate-400">
          {fillTemplate(t('form.taskCount'), { count: draft.task.length, max: CHAIN_TRIGGER_TASK_MAX_CHARS })}
        </p>
      </div>

      <div>
        <label htmlFor="chain-trigger-zone" className="text-xs font-medium text-slate-300">
          {t('form.timeZone')}
        </label>
        <input
          id="chain-trigger-zone"
          type="text"
          className={FIELD}
          value={draft.timeZone}
          list="chain-trigger-zone-list"
          maxLength={64}
          disabled={saving}
          onChange={(event) => set({ timeZone: event.target.value })}
          data-testid="chain-trigger-zone"
        />
        <datalist id="chain-trigger-zone-list">
          {timeZones.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-200" htmlFor="chain-trigger-enabled">
        <input
          id="chain-trigger-enabled"
          type="checkbox"
          className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          checked={draft.enabled}
          disabled={saving}
          onChange={(event) => set({ enabled: event.target.checked })}
          data-testid="chain-trigger-enabled"
        />
        {t('form.enabled')}
      </label>

      {errorKey ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-2"
          role="alert"
          data-testid="chain-trigger-form-error"
        >
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
          <p className="break-words text-sm text-red-200">{t(errorKey)}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={PRIMARY_BUTTON} disabled={saving} data-testid="chain-trigger-save">
          {saving ? <Spinner className="h-4 w-4 text-white" /> : null}
          {saving ? t('form.saving') : t('form.save')}
        </button>
        <button
          type="button"
          className={QUIET_BUTTON}
          disabled={saving}
          onClick={onCancel}
          data-testid="chain-trigger-cancel"
        >
          {t('form.cancel')}
        </button>
      </div>
    </form>
  );
}

function HistoryPanel({
  t,
  locale,
  history,
}: {
  t: (key: string) => string;
  locale: string;
  history: ChainTriggerHistoryState;
}) {
  return (
    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3" data-testid="chain-trigger-history">
      <h4 className="text-xs font-semibold text-slate-200">{t('history.title')}</h4>
      {history.phase === 'loading' ? (
        <p className="mt-2 text-sm text-slate-300" role="status" data-testid="chain-trigger-history-loading">
          {t('history.loading')}
        </p>
      ) : history.phase === 'failed' ? (
        <p className="mt-2 text-sm text-red-200" role="alert" data-testid="chain-trigger-history-error">
          {t('history.loadError')}
        </p>
      ) : history.runs.length === 0 ? (
        <p className="mt-2 text-sm text-slate-300" data-testid="chain-trigger-history-empty">
          {t('history.empty')}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {history.runs.map((run) => (
            <li key={run.id}>
              <RunLine t={t} locale={locale} run={run} testId={`chain-trigger-history-run-${run.id}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TriggerRow(props: ChainTriggersSectionViewProps & { trigger: ChainTriggerItem }): React.ReactElement {
  const { t, locale, trigger, workflows, busyId, confirmDeleteId, rowError, history } = props;
  const busy = busyId === trigger.id;
  const asking = confirmDeleteId === trigger.id;
  const historyOpen = history?.triggerId === trigger.id;
  return (
    <li
      className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5"
      data-testid={`chain-trigger-row-${trigger.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3
            className="min-w-0 break-words text-sm font-semibold text-white"
            data-testid={`chain-trigger-source-${trigger.id}`}
          >
            {sourceLabel(t, workflows, trigger)}
          </h3>
          <StatusPill on={trigger.enabled} t={t} />
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={trigger.enabled}
          aria-label={trigger.enabled ? t('row.switchOff') : t('row.switchOn')}
          className={QUIET_BUTTON}
          disabled={busy}
          onClick={() => props.onSwitch(trigger)}
          data-testid={`chain-trigger-switch-${trigger.id}`}
        >
          {trigger.enabled ? t('row.switchOff') : t('row.switchOn')}
        </button>
      </div>
      <p
        className="mt-1 text-xs text-slate-400"
        data-testid={`chain-trigger-fires-on-${trigger.id}`}
        data-fires-on={trigger.firesOn}
      >
        {t(chainFiresOnRowKey(trigger.firesOn))}
      </p>
      <SourceStatusLine t={t} trigger={trigger} workflows={workflows} />
      <p className="mt-2 break-words text-sm text-slate-200" data-testid={`chain-trigger-task-${trigger.id}`}>
        {taskPreview(trigger.task)}
      </p>
      <dl className="mt-3 flex flex-col gap-1.5">
        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="shrink-0 text-xs font-medium text-slate-400 sm:w-32">{t('row.startsNext')}</dt>
          <dd className="min-w-0 break-words text-sm text-slate-100" data-testid={`chain-trigger-target-${trigger.id}`}>
            {targetLabel(t, trigger)}
            <TargetStatusLine t={t} trigger={trigger} />
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="shrink-0 text-xs font-medium text-slate-400 sm:w-32">{t('row.timeZone')}</dt>
          <dd className="min-w-0 break-words text-sm text-slate-100">{trigger.timeZone}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="shrink-0 text-xs font-medium text-slate-400 sm:w-32">{t('row.lastRun')}</dt>
          <dd className="min-w-0">
            {trigger.lastRun ? (
              <RunLine t={t} locale={locale} run={trigger.lastRun} testId={`chain-trigger-last-${trigger.id}`} />
            ) : (
              <span className="text-sm text-slate-400" data-testid={`chain-trigger-last-${trigger.id}`}>
                {t('row.neverRan')}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {rowError && rowError.triggerId === trigger.id ? (
        <p className="mt-3 text-sm text-red-200" role="alert" data-testid={`chain-trigger-row-error-${trigger.id}`}>
          {t(rowError.errorKey)}
        </p>
      ) : null}

      {asking ? (
        <div className="mt-3 flex flex-col gap-2" data-testid={`chain-trigger-delete-confirm-${trigger.id}`}>
          <p className="text-sm text-slate-200">{t('row.deleteConfirm')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={DANGER_BUTTON}
              disabled={busy}
              onClick={() => props.onConfirmDelete(trigger.id)}
              data-testid={`chain-trigger-delete-yes-${trigger.id}`}
            >
              {t('row.deleteYes')}
            </button>
            <button
              type="button"
              className={QUIET_BUTTON}
              disabled={busy}
              onClick={props.onCancelDelete}
              data-testid={`chain-trigger-delete-no-${trigger.id}`}
            >
              {t('form.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={QUIET_BUTTON}
            disabled={busy}
            onClick={() => props.onEdit(trigger)}
            data-testid={`chain-trigger-edit-${trigger.id}`}
          >
            <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
            {t('row.edit')}
          </button>
          <button
            type="button"
            className={QUIET_BUTTON}
            aria-expanded={historyOpen}
            onClick={() => props.onToggleHistory(trigger.id)}
            data-testid={`chain-trigger-history-toggle-${trigger.id}`}
          >
            {historyOpen ? t('row.hideHistory') : t('row.history')}
          </button>
          <button
            type="button"
            className={DANGER_BUTTON}
            disabled={busy}
            onClick={() => props.onAskDelete(trigger.id)}
            data-testid={`chain-trigger-delete-${trigger.id}`}
          >
            <TrashIcon className="h-4 w-4" aria-hidden="true" />
            {t('row.delete')}
          </button>
        </div>
      )}
      {historyOpen && history ? <HistoryPanel t={t} locale={locale} history={history} /> : null}
    </li>
  );
}

export function ChainTriggersSectionView(props: ChainTriggersSectionViewProps): React.ReactElement {
  const { t, phase, data, form } = props;
  const full = data ? chainLimitReached(data) : false;

  return (
    <section
      className="flex flex-col gap-4 border-t border-slate-800 pt-6"
      aria-labelledby="chain-triggers-title"
      data-testid="chain-triggers-section"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/90 text-white">
          <LinkIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 id="chain-triggers-title" className="text-base font-semibold text-white">
            {t('title')}
          </h2>
          <p className="text-sm text-slate-300">{t('subtitle')}</p>
        </div>
      </div>

      {phase === 'loading' ? (
        <p className="flex items-center gap-2 text-sm text-slate-300" role="status" data-testid="chain-triggers-loading">
          <Spinner className="h-4 w-4 text-slate-300" />
          {t('loading')}
        </p>
      ) : null}

      {phase === 'failed' ? (
        <div
          className="flex flex-col items-start gap-3 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-3"
          data-testid="chain-triggers-error"
        >
          <p className="text-sm text-red-200" role="alert">
            {t('loadError')}
          </p>
          <button type="button" className={QUIET_BUTTON} onClick={props.onRetry} data-testid="chain-triggers-retry">
            {t('retry')}
          </button>
        </div>
      ) : null}

      {phase === 'forbidden' ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5" data-testid="chain-triggers-forbidden">
          <h3 className="text-sm font-semibold text-white">{t('forbiddenTitle')}</h3>
          <p className="mt-2 text-sm text-slate-300">{t('forbiddenBody')}</p>
        </div>
      ) : null}

      {phase === 'ready' && data ? (
        <>
          {!data.enabled ? <Banner testId="chain-triggers-banner-off" text={t('banner.off')} /> : null}
          {!data.runsEnabled ? <Banner testId="chain-triggers-banner-runs-off" text={t('banner.runsOff')} /> : null}
          {!data.resultToolEnabled ? (
            <Banner testId="chain-triggers-banner-result-tool-off" text={t('banner.resultToolOff')} />
          ) : null}

          <p className="text-sm text-slate-300" data-testid="chain-triggers-delay-notice">
            {t('delayNotice')}
          </p>
          <p className="text-sm text-slate-300" data-testid="chain-triggers-privacy-notice">
            {t('privacyNotice')}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-300" data-testid="chain-triggers-limit">
              {fillTemplate(t('limit'), { count: data.triggers.length, limit: data.limit })}
            </p>
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={full || form !== null}
              onClick={props.onNew}
              data-testid="chain-triggers-new"
            >
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              {t('new')}
            </button>
          </div>
          {full ? (
            <p className="text-sm text-amber-200" role="status" data-testid="chain-triggers-limit-reached">
              {fillTemplate(t('limitReached'), { limit: data.limit })}
            </p>
          ) : null}

          {props.noticeKey ? (
            CHAIN_WARNING_NOTICE_KEYS.includes(props.noticeKey) ? (
              <p
                className="flex items-start gap-2 text-sm text-amber-200"
                role="status"
                data-testid="chain-triggers-notice"
                data-tone="warning"
              >
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                <span className="break-words">{t(props.noticeKey)}</span>
              </p>
            ) : (
              <p className="flex items-start gap-2 text-sm text-emerald-200" role="status" data-testid="chain-triggers-notice">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <span className="break-words">{t(props.noticeKey)}</span>
              </p>
            )
          ) : null}

          {form ? (
            <ChainTriggerForm
              t={t}
              form={form}
              triggers={data.triggers}
              workflows={props.workflows}
              timeZones={props.timeZones}
              onDraftChange={props.onDraftChange}
              onSave={props.onSave}
              onCancel={props.onCancelForm}
            />
          ) : null}

          {data.triggers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-4 sm:p-5" data-testid="chain-triggers-empty">
              <h3 className="text-sm font-semibold text-white">{t('emptyTitle')}</h3>
              <p className="mt-2 text-sm text-slate-300">{t('emptyBody')}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3" data-testid="chain-triggers-list">
              {data.triggers.map((trigger) => (
                <TriggerRow key={trigger.id} {...props} trigger={trigger} />
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}

export interface ChainTriggersSectionProps {
  locale: string;
  fetcher?: ChainTriggersFetcher;
  /** The workflow picker data the Schedules page already loads. */
  workflows: WorkflowOption[];
}

function listTimeZones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    return intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : [];
  } catch {
    return [];
  }
}

export default function ChainTriggersSection({
  locale,
  fetcher,
  workflows,
}: ChainTriggersSectionProps): React.ReactElement {
  const translate = useTranslations('schedules.chain');
  const router = useRouter();
  const [phase, setPhase] = useState<ChainTriggersPhase>('loading');
  const [data, setData] = useState<ChainTriggerList | null>(null);
  const [form, setForm] = useState<ChainTriggerFormState | null>(null);
  const [noticeKey, setNoticeKey] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ triggerId: string; errorKey: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [history, setHistory] = useState<ChainTriggerHistoryState | null>(null);
  const timeZones = useMemo(() => listTimeZones(), []);

  const toLogin = useCallback(() => {
    router.replace(`/${locale}/login`);
  }, [locale, router]);

  const reload = useCallback(async () => {
    setPhase('loading');
    const result = await loadChainTriggers(fetcher);
    if (result.type === 'unauthorized') {
      toLogin();
      return;
    }
    if (result.type === 'forbidden') {
      setPhase('forbidden');
      return;
    }
    if (result.type === 'failed') {
      setPhase('failed');
      return;
    }
    setData(result.value);
    setPhase('ready');
  }, [fetcher, toLogin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleFailure = useCallback(
    (result: { type: string; errorKey?: string }): string | null => {
      if (result.type === 'unauthorized') {
        toLogin();
        return null;
      }
      if (result.type === 'forbidden') {
        setPhase('forbidden');
        return null;
      }
      return result.errorKey ?? 'errors.generic';
    },
    [toLogin],
  );

  const onSave = useCallback(async () => {
    if (!form) return;
    const parsed = draftToBody(form.draft, { triggers: data?.triggers ?? [], editingId: form.editingId });
    if (!parsed.ok) {
      setForm({ ...form, errorKey: parsed.errorKey });
      return;
    }
    setForm({ ...form, saving: true, errorKey: null });
    const result = form.editingId
      ? await updateChainTrigger(form.editingId, parsed.body, fetcher)
      : await createChainTrigger(parsed.body, fetcher);
    if (result.type !== 'ok') {
      const errorKey = handleFailure(result);
      if (errorKey) setForm({ ...form, saving: false, errorKey });
      return;
    }
    setForm(null);
    setNoticeKey('notice.saved');
    await reload();
  }, [data, fetcher, form, handleFailure, reload]);

  const onSwitch = useCallback(
    async (trigger: ChainTriggerItem) => {
      setBusyId(trigger.id);
      setRowError(null);
      const result = await updateChainTrigger(trigger.id, { enabled: !trigger.enabled }, fetcher);
      setBusyId(null);
      if (result.type !== 'ok') {
        const errorKey = handleFailure(result);
        if (errorKey) setRowError({ triggerId: trigger.id, errorKey });
        return;
      }
      // CHAIN-SOURCE-OFF-01: switched on with a source that is not on, it still
      // switches on, and the notice says it will not fire until the source is on.
      // TRIGGER-TARGET-OFF-01: the same for the target; with both off, one combined notice.
      setNoticeKey(
        chainSwitchNoticeKeyFor(result.value.enabled, chainSourceStatus(result.value, workflows), result.value.target),
      );
      setData((current) =>
        current
          ? { ...current, triggers: current.triggers.map((entry) => (entry.id === trigger.id ? result.value : entry)) }
          : current,
      );
    },
    [fetcher, handleFailure, workflows],
  );

  const onConfirmDelete = useCallback(
    async (id: string) => {
      setBusyId(id);
      setRowError(null);
      const result = await deleteChainTrigger(id, fetcher);
      setBusyId(null);
      if (result.type !== 'ok') {
        const errorKey = handleFailure(result);
        if (errorKey) setRowError({ triggerId: id, errorKey });
        return;
      }
      setConfirmDeleteId(null);
      setHistory((current) => (current?.triggerId === id ? null : current));
      setNoticeKey('notice.deleted');
      await reload();
    },
    [fetcher, handleFailure, reload],
  );

  const onToggleHistory = useCallback(
    async (id: string) => {
      if (history?.triggerId === id) {
        setHistory(null);
        return;
      }
      setHistory({ triggerId: id, phase: 'loading', runs: [] });
      const result = await loadChainTriggerRuns(id, fetcher);
      if (result.type === 'unauthorized') {
        toLogin();
        return;
      }
      setHistory((current) =>
        current?.triggerId !== id
          ? current
          : result.type === 'ok'
            ? { triggerId: id, phase: 'ready', runs: result.value }
            : { triggerId: id, phase: 'failed', runs: [] },
      );
    },
    [fetcher, history, toLogin],
  );

  return (
    <ChainTriggersSectionView
      t={translate}
      locale={locale}
      phase={phase}
      data={data}
      workflows={workflows}
      timeZones={timeZones}
      form={form}
      noticeKey={noticeKey}
      rowError={rowError}
      busyId={busyId}
      confirmDeleteId={confirmDeleteId}
      history={history}
      onRetry={() => void reload()}
      onNew={() => {
        setNoticeKey(null);
        setForm({ editingId: null, draft: emptyChainDraft(browserTimeZone()), saving: false, errorKey: null });
      }}
      onEdit={(trigger) => {
        setNoticeKey(null);
        setForm({ editingId: trigger.id, draft: draftFromChainTrigger(trigger), saving: false, errorKey: null });
      }}
      onDraftChange={(draft) => setForm((current) => (current ? { ...current, draft } : current))}
      onSave={() => void onSave()}
      onCancelForm={() => setForm(null)}
      onSwitch={(trigger) => void onSwitch(trigger)}
      onAskDelete={(id) => {
        setRowError(null);
        setConfirmDeleteId(id);
      }}
      onCancelDelete={() => setConfirmDeleteId(null)}
      onConfirmDelete={(id) => void onConfirmDelete(id)}
      onToggleHistory={(id) => void onToggleHistory(id)}
    />
  );
}
