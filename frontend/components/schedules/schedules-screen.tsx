'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Spinner from '@/components/ui/Spinner';
import { useTranslations } from '@/hooks/useTranslations';
import {
  createSchedule,
  deleteSchedule,
  loadScheduleRuns,
  loadSchedules,
  loadWorkflowOptions,
  updateSchedule,
  type SchedulesFetcher,
} from './schedules-api';
import {
  SCHEDULE_DAY_NUMBERS,
  SCHEDULE_TASK_MAX_CHARS,
  browserTimeZone,
  draftFromSchedule,
  draftToBody,
  emptyDraft,
  fillTemplate,
  limitReached,
  outcomeKey,
  reasonKey,
  taskPreview,
  toggleDay,
  type ScheduleDraft,
  type ScheduleItem,
  type ScheduleLastRun,
  type ScheduleRun,
  type SchedulesList,
  type WorkflowOption,
} from './schedules.logic';

/**
 * TRIGGER-UI-01: the Schedules page. Header like the Connections page, then
 * the switched-off and runs-off banners, the create/edit form and the list.
 * A schedule starts a read-only run as its owner; nothing here starts a run.
 */

export type SchedulesPhase = 'loading' | 'ready' | 'failed' | 'forbidden';

export interface ScheduleFormState {
  /** null while creating. */
  editingId: string | null;
  draft: ScheduleDraft;
  saving: boolean;
  errorKey: string | null;
}

export interface ScheduleHistoryState {
  scheduleId: string;
  phase: 'loading' | 'ready' | 'failed';
  runs: ScheduleRun[];
}

export interface SchedulesScreenViewProps {
  t: (key: string) => string;
  locale: string;
  authReady: boolean;
  phase: SchedulesPhase;
  data: SchedulesList | null;
  workflows: WorkflowOption[];
  timeZones: string[];
  form: ScheduleFormState | null;
  /** The notice key (saved, deleted, switchedOn, switchedOff) or null. */
  noticeKey: string | null;
  rowError: { scheduleId: string; errorKey: string } | null;
  busyId: string | null;
  confirmDeleteId: string | null;
  history: ScheduleHistoryState | null;
  onRetry: () => void;
  onNew: () => void;
  onEdit: (schedule: ScheduleItem) => void;
  onDraftChange: (draft: ScheduleDraft) => void;
  onSave: () => void;
  onCancelForm: () => void;
  onSwitch: (schedule: ScheduleItem) => void;
  onAskDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
  onToggleHistory: (id: string) => void;
}

const QUIET_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60';
const PRIMARY_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60';
const DANGER_BUTTON =
  'inline-flex items-center gap-1.5 rounded-md border border-red-700/60 px-3 py-1.5 text-sm font-medium text-red-200 transition-colors hover:bg-red-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60';
const FIELD =
  'mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60';

function Banner({ tone, testId, text }: { tone: 'amber' | 'slate'; testId: string; text: string }) {
  const classes =
    tone === 'amber'
      ? 'border-amber-500/40 bg-amber-950/30 text-amber-100'
      : 'border-slate-700 bg-slate-900/70 text-slate-200';
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${classes}`}
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

export function describeRun(
  t: (key: string) => string,
  run: ScheduleLastRun,
): { outcome: string; reason: string | null } {
  return {
    outcome: t(outcomeKey(run.outcome)),
    reason: run.reason ? t(reasonKey(run.reason)) : null,
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
  run: ScheduleLastRun;
  testId: string;
}) {
  const { outcome, reason } = describeRun(t, run);
  return (
    <span className="min-w-0 break-words text-sm text-slate-200" data-testid={testId}>
      {run.localDate} {'·'} {outcome}
      {reason ? ` · ${reason}` : ''}
      {run.collaborationRunId ? (
        <>
          {' '}
          <Link
            href={`/${locale}/results`}
            className="text-indigo-300 underline underline-offset-2 hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            data-testid={`${testId}-result`}
          >
            {t('row.viewResult')}
          </Link>
        </>
      ) : null}
    </span>
  );
}

function targetLabel(t: (key: string) => string, schedule: ScheduleItem): string {
  if (schedule.target.kind === 'chief-of-staff') return t('target.chiefOfStaff');
  if (schedule.target.missing) return t('target.workflowGone');
  return fillTemplate(t('target.workflowNamed'), { name: schedule.target.name ?? '' });
}

function daysLabel(t: (key: string) => string, days: number[]): string {
  return days.map((day) => t(`days.${day}`)).join(', ');
}

export function ScheduleForm(props: {
  t: (key: string) => string;
  form: ScheduleFormState;
  workflows: WorkflowOption[];
  timeZones: string[];
  onDraftChange: (draft: ScheduleDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}): React.ReactElement {
  const { t, form, workflows, timeZones, onDraftChange, onSave, onCancel } = props;
  const { draft, saving, errorKey, editingId } = form;
  const set = (patch: Partial<ScheduleDraft>) => onDraftChange({ ...draft, ...patch });
  // A workflow the owner no longer has stays selectable only while it is the saved target.
  return (
    <form
      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5"
      aria-labelledby="schedule-form-title"
      data-testid="schedule-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <h2 id="schedule-form-title" className="text-sm font-semibold text-white">
        {editingId ? t('form.editTitle') : t('form.createTitle')}
      </h2>
      <p className="text-sm text-slate-300" data-testid="schedule-readonly-hint">
        {t('form.readOnlyHint')}
      </p>

      <div>
        <label htmlFor="schedule-target" className="text-xs font-medium text-slate-300">
          {t('form.target')}
        </label>
        <select
          id="schedule-target"
          className={FIELD}
          value={draft.targetId}
          disabled={saving}
          onChange={(event) => set({ targetId: event.target.value })}
          data-testid="schedule-target"
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
      </div>

      <div>
        <label htmlFor="schedule-task" className="text-xs font-medium text-slate-300">
          {t('form.task')}
        </label>
        <textarea
          id="schedule-task"
          className={`${FIELD} min-h-[6rem]`}
          value={draft.task}
          maxLength={SCHEDULE_TASK_MAX_CHARS}
          disabled={saving}
          onChange={(event) => set({ task: event.target.value })}
          data-testid="schedule-task"
        />
        <p className="mt-1 text-xs text-slate-400">
          {fillTemplate(t('form.taskCount'), { count: draft.task.length, max: SCHEDULE_TASK_MAX_CHARS })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="schedule-time" className="text-xs font-medium text-slate-300">
            {t('form.time')}
          </label>
          <input
            id="schedule-time"
            type="time"
            className={FIELD}
            value={draft.timeOfDay}
            disabled={saving}
            onChange={(event) => set({ timeOfDay: event.target.value })}
            data-testid="schedule-time"
          />
        </div>
        <div>
          <label htmlFor="schedule-zone" className="text-xs font-medium text-slate-300">
            {t('form.timeZone')}
          </label>
          <input
            id="schedule-zone"
            type="text"
            className={FIELD}
            value={draft.timeZone}
            list="schedule-zone-list"
            maxLength={64}
            disabled={saving}
            onChange={(event) => set({ timeZone: event.target.value })}
            data-testid="schedule-zone"
          />
          <datalist id="schedule-zone-list">
            {timeZones.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </div>
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-slate-300">{t('form.days')}</legend>
        <div className="mt-2 flex flex-wrap gap-3" data-testid="schedule-days">
          {SCHEDULE_DAY_NUMBERS.map((day) => (
            <label key={day} className="inline-flex items-center gap-1.5 text-sm text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                checked={draft.days.includes(day)}
                disabled={saving}
                onChange={() => set({ days: toggleDay(draft.days, day) })}
                data-testid={`schedule-day-${day}`}
              />
              {t(`days.${day}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="inline-flex items-center gap-2 text-sm text-slate-200" htmlFor="schedule-enabled">
        <input
          id="schedule-enabled"
          type="checkbox"
          className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          checked={draft.enabled}
          disabled={saving}
          onChange={(event) => set({ enabled: event.target.checked })}
          data-testid="schedule-enabled"
        />
        {t('form.enabled')}
      </label>

      {errorKey ? (
        <div
          className="flex items-start gap-2 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-2"
          role="alert"
          data-testid="schedule-form-error"
        >
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
          <p className="break-words text-sm text-red-200">{t(errorKey)}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={PRIMARY_BUTTON} disabled={saving} data-testid="schedule-save">
          {saving ? <Spinner className="h-4 w-4 text-white" /> : null}
          {saving ? t('form.saving') : t('form.save')}
        </button>
        <button type="button" className={QUIET_BUTTON} disabled={saving} onClick={onCancel} data-testid="schedule-cancel">
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
  history: ScheduleHistoryState;
}) {
  return (
    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3" data-testid="schedule-history">
      <h3 className="text-xs font-semibold text-slate-200">{t('history.title')}</h3>
      {history.phase === 'loading' ? (
        <p className="mt-2 text-sm text-slate-300" role="status" data-testid="schedule-history-loading">
          {t('history.loading')}
        </p>
      ) : history.phase === 'failed' ? (
        <p className="mt-2 text-sm text-red-200" role="alert" data-testid="schedule-history-error">
          {t('history.loadError')}
        </p>
      ) : history.runs.length === 0 ? (
        <p className="mt-2 text-sm text-slate-300" data-testid="schedule-history-empty">
          {t('history.empty')}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {history.runs.map((run) => (
            <li key={run.id}>
              <RunLine t={t} locale={locale} run={run} testId={`schedule-history-run-${run.id}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScheduleRow(props: SchedulesScreenViewProps & { schedule: ScheduleItem }): React.ReactElement {
  const { t, locale, schedule, busyId, confirmDeleteId, rowError, history } = props;
  const busy = busyId === schedule.id;
  const asking = confirmDeleteId === schedule.id;
  const historyOpen = history?.scheduleId === schedule.id;
  return (
    <li
      className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5"
      data-testid={`schedule-row-${schedule.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="min-w-0 break-words text-sm font-semibold text-white" data-testid={`schedule-target-${schedule.id}`}>
            {targetLabel(t, schedule)}
          </h2>
          <StatusPill on={schedule.enabled} t={t} />
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={schedule.enabled}
          aria-label={schedule.enabled ? t('row.switchOff') : t('row.switchOn')}
          className={QUIET_BUTTON}
          disabled={busy}
          onClick={() => props.onSwitch(schedule)}
          data-testid={`schedule-switch-${schedule.id}`}
        >
          {schedule.enabled ? t('row.switchOff') : t('row.switchOn')}
        </button>
      </div>
      <p className="mt-2 break-words text-sm text-slate-200" data-testid={`schedule-task-${schedule.id}`}>
        {taskPreview(schedule.task)}
      </p>
      <dl className="mt-3 flex flex-col gap-1.5">
        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="shrink-0 text-xs font-medium text-slate-400 sm:w-32">{t('row.when')}</dt>
          <dd className="min-w-0 break-words text-sm text-slate-100" data-testid={`schedule-when-${schedule.id}`}>
            {fillTemplate(t('row.whenValue'), {
              time: schedule.timeOfDay,
              days: daysLabel(t, schedule.days),
              zone: schedule.timeZone,
            })}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="shrink-0 text-xs font-medium text-slate-400 sm:w-32">{t('row.lastRun')}</dt>
          <dd className="min-w-0">
            {schedule.lastRun ? (
              <RunLine t={t} locale={locale} run={schedule.lastRun} testId={`schedule-last-${schedule.id}`} />
            ) : (
              <span className="text-sm text-slate-400" data-testid={`schedule-last-${schedule.id}`}>
                {t('row.neverRan')}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {rowError && rowError.scheduleId === schedule.id ? (
        <p className="mt-3 text-sm text-red-200" role="alert" data-testid={`schedule-row-error-${schedule.id}`}>
          {t(rowError.errorKey)}
        </p>
      ) : null}

      {asking ? (
        <div className="mt-3 flex flex-col gap-2" data-testid={`schedule-delete-confirm-${schedule.id}`}>
          <p className="text-sm text-slate-200">{t('row.deleteConfirm')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={DANGER_BUTTON}
              disabled={busy}
              onClick={() => props.onConfirmDelete(schedule.id)}
              data-testid={`schedule-delete-yes-${schedule.id}`}
            >
              {t('row.deleteYes')}
            </button>
            <button
              type="button"
              className={QUIET_BUTTON}
              disabled={busy}
              onClick={props.onCancelDelete}
              data-testid={`schedule-delete-no-${schedule.id}`}
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
            onClick={() => props.onEdit(schedule)}
            data-testid={`schedule-edit-${schedule.id}`}
          >
            <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
            {t('row.edit')}
          </button>
          <button
            type="button"
            className={QUIET_BUTTON}
            aria-expanded={historyOpen}
            onClick={() => props.onToggleHistory(schedule.id)}
            data-testid={`schedule-history-toggle-${schedule.id}`}
          >
            {historyOpen ? t('row.hideHistory') : t('row.history')}
          </button>
          <button
            type="button"
            className={DANGER_BUTTON}
            disabled={busy}
            onClick={() => props.onAskDelete(schedule.id)}
            data-testid={`schedule-delete-${schedule.id}`}
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

export function SchedulesScreenView(props: SchedulesScreenViewProps): React.ReactElement {
  const { t, locale, authReady, phase, data, form } = props;

  if (!authReady) {
    return (
      <div
        className="flex min-h-screen items-center justify-center gap-2 bg-slate-950 px-6"
        data-testid="schedules-auth-loading"
      >
        <Spinner className="h-4 w-4 text-slate-300" />
        <p className="text-sm font-medium text-slate-200" role="status">
          {t('loading')}
        </p>
      </div>
    );
  }

  const full = data ? limitReached(data) : false;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950" data-testid="schedules-screen">
      <header className="border-b border-slate-800 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/90 text-white">
              <ClockIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-white">{t('title')}</h1>
              <p className="text-sm text-slate-300">{t('subtitle')}</p>
            </div>
          </div>
          <Link
            href={`/${locale}/platform`}
            className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:self-auto"
            data-testid="schedules-back"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            {t('backToPlatform')}
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {phase === 'loading' ? (
            <p className="flex items-center gap-2 text-sm text-slate-300" role="status" data-testid="schedules-loading">
              <Spinner className="h-4 w-4 text-slate-300" />
              {t('loading')}
            </p>
          ) : null}

          {phase === 'failed' ? (
            <div
              className="flex flex-col items-start gap-3 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-3"
              data-testid="schedules-error"
            >
              <p className="text-sm text-red-200" role="alert">
                {t('loadError')}
              </p>
              <button type="button" className={QUIET_BUTTON} onClick={props.onRetry} data-testid="schedules-retry">
                {t('retry')}
              </button>
            </div>
          ) : null}

          {phase === 'forbidden' ? (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5" data-testid="schedules-forbidden">
              <h2 className="text-sm font-semibold text-white">{t('forbiddenTitle')}</h2>
              <p className="mt-2 text-sm text-slate-300">{t('forbiddenBody')}</p>
            </section>
          ) : null}

          {phase === 'ready' && data ? (
            <>
              {!data.enabled ? <Banner tone="amber" testId="schedules-banner-off" text={t('banner.off')} /> : null}
              {!data.runsEnabled ? <Banner tone="amber" testId="schedules-banner-runs-off" text={t('banner.runsOff')} /> : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-300" data-testid="schedules-limit">
                  {fillTemplate(t('limit'), { count: data.schedules.length, limit: data.limit })}
                </p>
                <button
                  type="button"
                  className={PRIMARY_BUTTON}
                  disabled={full || form !== null}
                  onClick={props.onNew}
                  data-testid="schedules-new"
                >
                  <PlusIcon className="h-4 w-4" aria-hidden="true" />
                  {t('new')}
                </button>
              </div>
              {full ? (
                <p className="text-sm text-amber-200" role="status" data-testid="schedules-limit-reached">
                  {fillTemplate(t('limitReached'), { limit: data.limit })}
                </p>
              ) : null}

              {props.noticeKey ? (
                <p className="flex items-start gap-2 text-sm text-emerald-200" role="status" data-testid="schedules-notice">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                  <span className="break-words">{t(props.noticeKey)}</span>
                </p>
              ) : null}

              {form ? (
                <ScheduleForm
                  t={t}
                  form={form}
                  workflows={props.workflows}
                  timeZones={props.timeZones}
                  onDraftChange={props.onDraftChange}
                  onSave={props.onSave}
                  onCancel={props.onCancelForm}
                />
              ) : null}

              {data.schedules.length === 0 ? (
                <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5" data-testid="schedules-empty">
                  <h2 className="text-sm font-semibold text-white">{t('emptyTitle')}</h2>
                  <p className="mt-2 text-sm text-slate-300">{t('emptyBody')}</p>
                </section>
              ) : (
                <ul className="flex flex-col gap-3" data-testid="schedules-list">
                  {data.schedules.map((schedule) => (
                    <ScheduleRow key={schedule.id} {...props} schedule={schedule} />
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export interface SchedulesScreenProps {
  locale: string;
  fetcher?: SchedulesFetcher;
}

function listTimeZones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    return intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : [];
  } catch {
    return [];
  }
}

export default function SchedulesScreen({ locale, fetcher }: SchedulesScreenProps): React.ReactElement {
  const translate = useTranslations('schedules');
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [phase, setPhase] = useState<SchedulesPhase>('loading');
  const [data, setData] = useState<SchedulesList | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
  const [form, setForm] = useState<ScheduleFormState | null>(null);
  const [noticeKey, setNoticeKey] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ scheduleId: string; errorKey: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [history, setHistory] = useState<ScheduleHistoryState | null>(null);
  const timeZones = useMemo(() => listTimeZones(), []);

  const toLogin = useCallback(() => {
    router.replace(`/${locale}/login`);
  }, [locale, router]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!mounted) return;
        if (!response.ok) {
          toLogin();
          return;
        }
        const payload = (await response.json()) as { id?: unknown };
        if (!mounted) return;
        if (typeof payload.id !== 'string' || payload.id.trim().length === 0) {
          toLogin();
          return;
        }
        setAuthReady(true);
      } catch {
        if (mounted) toLogin();
      }
    })();
    return () => {
      mounted = false;
    };
  }, [toLogin]);

  const reload = useCallback(async () => {
    setPhase('loading');
    const result = await loadSchedules(fetcher);
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
    if (!authReady) return;
    void reload();
    void loadWorkflowOptions(fetcher).then(setWorkflows);
  }, [authReady, reload, fetcher]);

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
      ? await updateSchedule(form.editingId, parsed.body, fetcher)
      : await createSchedule(parsed.body, fetcher);
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
    async (schedule: ScheduleItem) => {
      setBusyId(schedule.id);
      setRowError(null);
      const result = await updateSchedule(schedule.id, { enabled: !schedule.enabled }, fetcher);
      setBusyId(null);
      if (result.type !== 'ok') {
        const errorKey = handleFailure(result);
        if (errorKey) setRowError({ scheduleId: schedule.id, errorKey });
        return;
      }
      setNoticeKey(result.value.enabled ? 'notice.switchedOn' : 'notice.switchedOff');
      setData((current) =>
        current
          ? { ...current, schedules: current.schedules.map((entry) => (entry.id === schedule.id ? result.value : entry)) }
          : current,
      );
    },
    [fetcher, handleFailure],
  );

  const onConfirmDelete = useCallback(
    async (id: string) => {
      setBusyId(id);
      setRowError(null);
      const result = await deleteSchedule(id, fetcher);
      setBusyId(null);
      if (result.type !== 'ok') {
        const errorKey = handleFailure(result);
        if (errorKey) setRowError({ scheduleId: id, errorKey });
        return;
      }
      setConfirmDeleteId(null);
      setHistory((current) => (current?.scheduleId === id ? null : current));
      setNoticeKey('notice.deleted');
      await reload();
    },
    [fetcher, handleFailure, reload],
  );

  const onToggleHistory = useCallback(
    async (id: string) => {
      if (history?.scheduleId === id) {
        setHistory(null);
        return;
      }
      setHistory({ scheduleId: id, phase: 'loading', runs: [] });
      const result = await loadScheduleRuns(id, fetcher);
      if (result.type === 'unauthorized') {
        toLogin();
        return;
      }
      setHistory((current) =>
        current?.scheduleId !== id
          ? current
          : result.type === 'ok'
            ? { scheduleId: id, phase: 'ready', runs: result.value }
            : { scheduleId: id, phase: 'failed', runs: [] },
      );
    },
    [fetcher, history, toLogin],
  );

  return (
    <SchedulesScreenView
      t={translate}
      locale={locale}
      authReady={authReady}
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
        setForm({ editingId: null, draft: emptyDraft(browserTimeZone()), saving: false, errorKey: null });
      }}
      onEdit={(schedule) => {
        setNoticeKey(null);
        setForm({ editingId: schedule.id, draft: draftFromSchedule(schedule), saving: false, errorKey: null });
      }}
      onDraftChange={(draft) => setForm((current) => (current ? { ...current, draft } : current))}
      onSave={() => void onSave()}
      onCancelForm={() => setForm(null)}
      onSwitch={(schedule) => void onSwitch(schedule)}
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
