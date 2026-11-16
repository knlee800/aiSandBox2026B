'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircleIcon,
  DocumentPlusIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Spinner from '@/components/ui/Spinner';
import { useTranslations } from '@/hooks/useTranslations';
import {
  createKnowledgeTrigger,
  deleteKnowledgeTrigger,
  loadKnowledgeTriggerRuns,
  loadKnowledgeTriggers,
  updateKnowledgeTrigger,
  type KnowledgeTriggersFetcher,
} from './knowledge-triggers-api';
import {
  CHIEF_OF_STAFF_FOLDER_IDS,
  KNOWLEDGE_FOLDER_IDS,
  KNOWLEDGE_TRIGGER_TASK_MAX_CHARS,
  chiefCanReadFolder,
  chiefFolderRefused,
  draftFromKnowledgeTrigger,
  emptyKnowledgeDraft,
  knowledgeLimitReached,
  knowledgeOutcomeKey,
  knowledgeReasonKey,
  showWorkflowKnowledgeWarning,
  type KnowledgeTriggerDraft,
  type KnowledgeTriggerItem,
  type KnowledgeTriggerLastRun,
  type KnowledgeTriggerList,
  type KnowledgeTriggerRun,
  draftToBody,
} from './knowledge-triggers.logic';
import { browserTimeZone, fillTemplate, taskPreview, type WorkflowOption } from './schedules.logic';

/**
 * TRIGGER-MORE-01 S3: the "When a file is added" section of the Schedules
 * page. It loads and fails on its own, so a failure here never touches the
 * schedules above it. A knowledge trigger starts a run as its owner a few
 * minutes after files are added to or replaced in one Knowledge folder;
 * nothing here starts a run or reads a file.
 */

export type KnowledgeTriggersPhase = 'loading' | 'ready' | 'failed' | 'forbidden';

export interface KnowledgeTriggerFormState {
  /** null while creating. */
  editingId: string | null;
  draft: KnowledgeTriggerDraft;
  saving: boolean;
  errorKey: string | null;
}

export interface KnowledgeTriggerHistoryState {
  triggerId: string;
  phase: 'loading' | 'ready' | 'failed';
  runs: KnowledgeTriggerRun[];
}

export interface KnowledgeTriggersSectionViewProps {
  /** Keys are inside the schedules.knowledge namespace. */
  t: (key: string) => string;
  /** The translated name of a Knowledge folder (knowledge.scopes.<id>). */
  folderName: (id: string) => string;
  locale: string;
  phase: KnowledgeTriggersPhase;
  data: KnowledgeTriggerList | null;
  workflows: WorkflowOption[];
  timeZones: string[];
  form: KnowledgeTriggerFormState | null;
  noticeKey: string | null;
  rowError: { triggerId: string; errorKey: string } | null;
  busyId: string | null;
  confirmDeleteId: string | null;
  history: KnowledgeTriggerHistoryState | null;
  onRetry: () => void;
  onNew: () => void;
  onEdit: (trigger: KnowledgeTriggerItem) => void;
  onDraftChange: (draft: KnowledgeTriggerDraft) => void;
  onSave: () => void;
  onCancelForm: () => void;
  onSwitch: (trigger: KnowledgeTriggerItem) => void;
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

export function describeKnowledgeRun(
  t: (key: string) => string,
  run: KnowledgeTriggerLastRun,
): { outcome: string; reason: string | null } {
  return {
    outcome: t(knowledgeOutcomeKey(run.outcome)),
    reason: run.reason ? t(knowledgeReasonKey(run.reason)) : null,
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
  run: KnowledgeTriggerLastRun;
  testId: string;
}) {
  const { outcome, reason } = describeKnowledgeRun(t, run);
  return (
    <span className="min-w-0 break-words text-sm text-slate-200" data-testid={testId}>
      {run.localDate} {'·'} {outcome}
      {reason ? ` · ${reason}` : ''}
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

function targetLabel(t: (key: string) => string, trigger: KnowledgeTriggerItem): string {
  if (trigger.target.kind === 'chief-of-staff') return t('target.chiefOfStaff');
  if (trigger.target.missing) return t('target.workflowGone');
  return fillTemplate(t('target.workflowNamed'), { name: trigger.target.name ?? '' });
}

export function KnowledgeTriggerForm(props: {
  t: (key: string) => string;
  folderName: (id: string) => string;
  form: KnowledgeTriggerFormState;
  workflows: WorkflowOption[];
  timeZones: string[];
  onDraftChange: (draft: KnowledgeTriggerDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}): React.ReactElement {
  const { t, folderName, form, workflows, timeZones, onDraftChange, onSave, onCancel } = props;
  const { draft, saving, errorKey, editingId } = form;
  const set = (patch: Partial<KnowledgeTriggerDraft>) => onDraftChange({ ...draft, ...patch });
  return (
    <form
      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5"
      aria-labelledby="knowledge-trigger-form-title"
      data-testid="knowledge-trigger-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <h3 id="knowledge-trigger-form-title" className="text-sm font-semibold text-white">
        {editingId ? t('form.editTitle') : t('form.createTitle')}
      </h3>
      <p className="text-sm text-slate-300" data-testid="knowledge-trigger-hint">
        {t('form.hint')}
      </p>

      <div>
        <label htmlFor="knowledge-trigger-target" className="text-xs font-medium text-slate-300">
          {t('form.target')}
        </label>
        <select
          id="knowledge-trigger-target"
          className={FIELD}
          value={draft.targetId}
          disabled={saving}
          onChange={(event) => set({ targetId: event.target.value })}
          data-testid="knowledge-trigger-target"
        >
          <option value="">{t('target.chiefOfStaff')}</option>
          {workflows.map((workflow) => (
            <option key={workflow.id} value={workflow.id}>
              {fillTemplate(t('target.workflowNamed'), { name: workflow.name })}
            </option>
          ))}
          {draft.targetId !== '' && !workflows.some((workflow) => workflow.id === draft.targetId) ? (
            <option value={draft.targetId}>{t('target.workflowGone')}</option>
          ) : null}
        </select>
        {showWorkflowKnowledgeWarning(draft) ? (
          <p
            className="mt-2 flex items-start gap-2 text-sm text-amber-200"
            role="status"
            data-testid="knowledge-trigger-workflow-warning"
          >
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="break-words">{t('form.workflowWarning')}</span>
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="knowledge-trigger-task" className="text-xs font-medium text-slate-300">
          {t('form.task')}
        </label>
        <textarea
          id="knowledge-trigger-task"
          className={`${FIELD} min-h-[6rem]`}
          value={draft.task}
          maxLength={KNOWLEDGE_TRIGGER_TASK_MAX_CHARS}
          disabled={saving}
          onChange={(event) => set({ task: event.target.value })}
          data-testid="knowledge-trigger-task"
        />
        <p className="mt-1 text-xs text-slate-400">
          {fillTemplate(t('form.taskCount'), { count: draft.task.length, max: KNOWLEDGE_TRIGGER_TASK_MAX_CHARS })}
        </p>
      </div>

      <div>
        <label htmlFor="knowledge-trigger-folder" className="text-xs font-medium text-slate-300">
          {t('form.folder')}
        </label>
        <select
          id="knowledge-trigger-folder"
          className={FIELD}
          value={draft.scopeId}
          disabled={saving}
          aria-describedby="knowledge-trigger-folder-rule"
          onChange={(event) => set({ scopeId: event.target.value })}
          data-testid="knowledge-trigger-folder"
        >
          {KNOWLEDGE_FOLDER_IDS.map((id) => (
            <option key={id} value={id}>
              {chiefCanReadFolder(id) ? folderName(id) : fillTemplate(t('form.folderWorkflowOnly'), { name: folderName(id) })}
            </option>
          ))}
        </select>
        <p id="knowledge-trigger-folder-rule" className="mt-1 text-xs text-slate-400" data-testid="knowledge-trigger-folder-rule">
          {fillTemplate(t('form.folderRule'), {
            folders: CHIEF_OF_STAFF_FOLDER_IDS.map((id) => folderName(id)).join(', '),
          })}
        </p>
        {chiefFolderRefused(draft) ? (
          <p
            className="mt-2 flex items-start gap-2 text-sm text-amber-200"
            role="status"
            data-testid="knowledge-trigger-folder-refusal"
          >
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="break-words">{t('errors.knowledge_trigger_folder_not_readable')}</span>
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="knowledge-trigger-zone" className="text-xs font-medium text-slate-300">
          {t('form.timeZone')}
        </label>
        <input
          id="knowledge-trigger-zone"
          type="text"
          className={FIELD}
          value={draft.timeZone}
          list="knowledge-trigger-zone-list"
          maxLength={64}
          disabled={saving}
          onChange={(event) => set({ timeZone: event.target.value })}
          data-testid="knowledge-trigger-zone"
        />
        <datalist id="knowledge-trigger-zone-list">
          {timeZones.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-200" htmlFor="knowledge-trigger-enabled">
        <input
          id="knowledge-trigger-enabled"
          type="checkbox"
          className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          checked={draft.enabled}
          disabled={saving}
          onChange={(event) => set({ enabled: event.target.checked })}
          data-testid="knowledge-trigger-enabled"
        />
        {t('form.enabled')}
      </label>

      {errorKey ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-2"
          role="alert"
          data-testid="knowledge-trigger-form-error"
        >
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
          <p className="break-words text-sm text-red-200">{t(errorKey)}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={PRIMARY_BUTTON} disabled={saving} data-testid="knowledge-trigger-save">
          {saving ? <Spinner className="h-4 w-4 text-white" /> : null}
          {saving ? t('form.saving') : t('form.save')}
        </button>
        <button
          type="button"
          className={QUIET_BUTTON}
          disabled={saving}
          onClick={onCancel}
          data-testid="knowledge-trigger-cancel"
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
  history: KnowledgeTriggerHistoryState;
}) {
  return (
    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3" data-testid="knowledge-trigger-history">
      <h4 className="text-xs font-semibold text-slate-200">{t('history.title')}</h4>
      {history.phase === 'loading' ? (
        <p className="mt-2 text-sm text-slate-300" role="status" data-testid="knowledge-trigger-history-loading">
          {t('history.loading')}
        </p>
      ) : history.phase === 'failed' ? (
        <p className="mt-2 text-sm text-red-200" role="alert" data-testid="knowledge-trigger-history-error">
          {t('history.loadError')}
        </p>
      ) : history.runs.length === 0 ? (
        <p className="mt-2 text-sm text-slate-300" data-testid="knowledge-trigger-history-empty">
          {t('history.empty')}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {history.runs.map((run) => (
            <li key={run.id}>
              <RunLine t={t} locale={locale} run={run} testId={`knowledge-trigger-history-run-${run.id}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TriggerRow(props: KnowledgeTriggersSectionViewProps & { trigger: KnowledgeTriggerItem }): React.ReactElement {
  const { t, locale, folderName, trigger, busyId, confirmDeleteId, rowError, history } = props;
  const busy = busyId === trigger.id;
  const asking = confirmDeleteId === trigger.id;
  const historyOpen = history?.triggerId === trigger.id;
  return (
    <li
      className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5"
      data-testid={`knowledge-trigger-row-${trigger.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3
            className="min-w-0 break-words text-sm font-semibold text-white"
            data-testid={`knowledge-trigger-target-${trigger.id}`}
          >
            {targetLabel(t, trigger)}
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
          data-testid={`knowledge-trigger-switch-${trigger.id}`}
        >
          {trigger.enabled ? t('row.switchOff') : t('row.switchOn')}
        </button>
      </div>
      <p className="mt-2 break-words text-sm text-slate-200" data-testid={`knowledge-trigger-task-${trigger.id}`}>
        {taskPreview(trigger.task)}
      </p>
      <dl className="mt-3 flex flex-col gap-1.5">
        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="shrink-0 text-xs font-medium text-slate-400 sm:w-32">{t('row.folder')}</dt>
          <dd className="min-w-0 break-words text-sm text-slate-100" data-testid={`knowledge-trigger-folder-${trigger.id}`}>
            {folderName(trigger.scopeId)}
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
              <RunLine t={t} locale={locale} run={trigger.lastRun} testId={`knowledge-trigger-last-${trigger.id}`} />
            ) : (
              <span className="text-sm text-slate-400" data-testid={`knowledge-trigger-last-${trigger.id}`}>
                {t('row.neverRan')}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {rowError && rowError.triggerId === trigger.id ? (
        <p className="mt-3 text-sm text-red-200" role="alert" data-testid={`knowledge-trigger-row-error-${trigger.id}`}>
          {t(rowError.errorKey)}
        </p>
      ) : null}

      {asking ? (
        <div className="mt-3 flex flex-col gap-2" data-testid={`knowledge-trigger-delete-confirm-${trigger.id}`}>
          <p className="text-sm text-slate-200">{t('row.deleteConfirm')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={DANGER_BUTTON}
              disabled={busy}
              onClick={() => props.onConfirmDelete(trigger.id)}
              data-testid={`knowledge-trigger-delete-yes-${trigger.id}`}
            >
              {t('row.deleteYes')}
            </button>
            <button
              type="button"
              className={QUIET_BUTTON}
              disabled={busy}
              onClick={props.onCancelDelete}
              data-testid={`knowledge-trigger-delete-no-${trigger.id}`}
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
            data-testid={`knowledge-trigger-edit-${trigger.id}`}
          >
            <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
            {t('row.edit')}
          </button>
          <button
            type="button"
            className={QUIET_BUTTON}
            aria-expanded={historyOpen}
            onClick={() => props.onToggleHistory(trigger.id)}
            data-testid={`knowledge-trigger-history-toggle-${trigger.id}`}
          >
            {historyOpen ? t('row.hideHistory') : t('row.history')}
          </button>
          <button
            type="button"
            className={DANGER_BUTTON}
            disabled={busy}
            onClick={() => props.onAskDelete(trigger.id)}
            data-testid={`knowledge-trigger-delete-${trigger.id}`}
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

export function KnowledgeTriggersSectionView(props: KnowledgeTriggersSectionViewProps): React.ReactElement {
  const { t, phase, data, form } = props;
  const full = data ? knowledgeLimitReached(data) : false;

  return (
    <section
      className="flex flex-col gap-4 border-t border-slate-800 pt-6"
      aria-labelledby="knowledge-triggers-title"
      data-testid="knowledge-triggers-section"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/90 text-white">
          <DocumentPlusIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 id="knowledge-triggers-title" className="text-base font-semibold text-white">
            {t('title')}
          </h2>
          <p className="text-sm text-slate-300">{t('subtitle')}</p>
        </div>
      </div>

      {phase === 'loading' ? (
        <p className="flex items-center gap-2 text-sm text-slate-300" role="status" data-testid="knowledge-triggers-loading">
          <Spinner className="h-4 w-4 text-slate-300" />
          {t('loading')}
        </p>
      ) : null}

      {phase === 'failed' ? (
        <div
          className="flex flex-col items-start gap-3 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-3"
          data-testid="knowledge-triggers-error"
        >
          <p className="text-sm text-red-200" role="alert">
            {t('loadError')}
          </p>
          <button type="button" className={QUIET_BUTTON} onClick={props.onRetry} data-testid="knowledge-triggers-retry">
            {t('retry')}
          </button>
        </div>
      ) : null}

      {phase === 'forbidden' ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5" data-testid="knowledge-triggers-forbidden">
          <h3 className="text-sm font-semibold text-white">{t('forbiddenTitle')}</h3>
          <p className="mt-2 text-sm text-slate-300">{t('forbiddenBody')}</p>
        </div>
      ) : null}

      {phase === 'ready' && data ? (
        <>
          {!data.enabled ? <Banner testId="knowledge-triggers-banner-off" text={t('banner.off')} /> : null}
          {!data.runsEnabled ? <Banner testId="knowledge-triggers-banner-runs-off" text={t('banner.runsOff')} /> : null}

          <p className="text-sm text-slate-300" data-testid="knowledge-triggers-batch-notice">
            {t('batchNotice')}
          </p>
          <p className="text-sm text-slate-300" data-testid="knowledge-triggers-privacy-notice">
            {t('privacyNotice')}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-300" data-testid="knowledge-triggers-limit">
              {fillTemplate(t('limit'), { count: data.triggers.length, limit: data.limit })}
            </p>
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={full || form !== null}
              onClick={props.onNew}
              data-testid="knowledge-triggers-new"
            >
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              {t('new')}
            </button>
          </div>
          {full ? (
            <p className="text-sm text-amber-200" role="status" data-testid="knowledge-triggers-limit-reached">
              {fillTemplate(t('limitReached'), { limit: data.limit })}
            </p>
          ) : null}

          {props.noticeKey ? (
            <p className="flex items-start gap-2 text-sm text-emerald-200" role="status" data-testid="knowledge-triggers-notice">
              <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
              <span className="break-words">{t(props.noticeKey)}</span>
            </p>
          ) : null}

          {form ? (
            <KnowledgeTriggerForm
              t={t}
              folderName={props.folderName}
              form={form}
              workflows={props.workflows}
              timeZones={props.timeZones}
              onDraftChange={props.onDraftChange}
              onSave={props.onSave}
              onCancel={props.onCancelForm}
            />
          ) : null}

          {data.triggers.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5" data-testid="knowledge-triggers-empty">
              <h3 className="text-sm font-semibold text-white">{t('emptyTitle')}</h3>
              <p className="mt-2 text-sm text-slate-300">{t('emptyBody')}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3" data-testid="knowledge-triggers-list">
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

export interface KnowledgeTriggersSectionProps {
  locale: string;
  fetcher?: KnowledgeTriggersFetcher;
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

export default function KnowledgeTriggersSection({
  locale,
  fetcher,
  workflows,
}: KnowledgeTriggersSectionProps): React.ReactElement {
  const translate = useTranslations('schedules.knowledge');
  const translateFolder = useTranslations('knowledge.scopes');
  const router = useRouter();
  const [phase, setPhase] = useState<KnowledgeTriggersPhase>('loading');
  const [data, setData] = useState<KnowledgeTriggerList | null>(null);
  const [form, setForm] = useState<KnowledgeTriggerFormState | null>(null);
  const [noticeKey, setNoticeKey] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ triggerId: string; errorKey: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [history, setHistory] = useState<KnowledgeTriggerHistoryState | null>(null);
  const timeZones = useMemo(() => listTimeZones(), []);

  const toLogin = useCallback(() => {
    router.replace(`/${locale}/login`);
  }, [locale, router]);

  const reload = useCallback(async () => {
    setPhase('loading');
    const result = await loadKnowledgeTriggers(fetcher);
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
    const parsed = draftToBody(form.draft);
    if (!parsed.ok) {
      setForm({ ...form, errorKey: parsed.errorKey });
      return;
    }
    setForm({ ...form, saving: true, errorKey: null });
    const result = form.editingId
      ? await updateKnowledgeTrigger(form.editingId, parsed.body, fetcher)
      : await createKnowledgeTrigger(parsed.body, fetcher);
    if (result.type !== 'ok') {
      const errorKey = handleFailure(result);
      if (errorKey) setForm({ ...form, saving: false, errorKey });
      return;
    }
    setForm(null);
    setNoticeKey('notice.saved');
    await reload();
  }, [fetcher, form, handleFailure, reload]);

  const onSwitch = useCallback(
    async (trigger: KnowledgeTriggerItem) => {
      setBusyId(trigger.id);
      setRowError(null);
      const result = await updateKnowledgeTrigger(trigger.id, { enabled: !trigger.enabled }, fetcher);
      setBusyId(null);
      if (result.type !== 'ok') {
        const errorKey = handleFailure(result);
        if (errorKey) setRowError({ triggerId: trigger.id, errorKey });
        return;
      }
      setNoticeKey(result.value.enabled ? 'notice.switchedOn' : 'notice.switchedOff');
      setData((current) =>
        current
          ? { ...current, triggers: current.triggers.map((entry) => (entry.id === trigger.id ? result.value : entry)) }
          : current,
      );
    },
    [fetcher, handleFailure],
  );

  const onConfirmDelete = useCallback(
    async (id: string) => {
      setBusyId(id);
      setRowError(null);
      const result = await deleteKnowledgeTrigger(id, fetcher);
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
      const result = await loadKnowledgeTriggerRuns(id, fetcher);
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
    <KnowledgeTriggersSectionView
      t={translate}
      folderName={translateFolder}
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
        setForm({ editingId: null, draft: emptyKnowledgeDraft(browserTimeZone()), saving: false, errorKey: null });
      }}
      onEdit={(trigger) => {
        setNoticeKey(null);
        setForm({ editingId: trigger.id, draft: draftFromKnowledgeTrigger(trigger), saving: false, errorKey: null });
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
