'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  LockClosedIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';
import type { UserAgent, UserAgentOptions } from '@/hooks/useUserAgents';
import Spinner from '@/components/ui/Spinner';
import {
  APPROVAL_MODES,
  REPLY_LANGUAGE_CHOICES,
  budgetProblems,
  fillTemplate,
  neverDoLines,
  teamChoiceRows,
  teamMemberName,
  toggleId,
  toggleTeamMember,
  visibleConnectorTools,
  type InstructionsCount,
  WORKFLOW_TEAM_MAX,
  type WorkflowDraft,
  type WorkflowErrors,
} from './agent-workflow-model';

/** Looks up platform.agentWorkflow.<key> in the active language. */
export type WorkflowT = (key: string) => string;

export const workflowInputClasses =
  'block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50';
export const workflowLabelClasses = 'block text-sm font-medium text-slate-200';
const errorClasses = 'mt-1 text-xs text-red-400';
const hintClasses = 'mt-1 text-xs text-slate-400';
const sectionTitleClasses = 'text-xs font-semibold uppercase tracking-wide text-slate-300';
const checkboxClasses =
  'h-4 w-4 shrink-0 rounded border-slate-500 bg-slate-800 text-brand accent-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';

type DraftPatch = (patch: Partial<WorkflowDraft>) => void;

interface CommonProps {
  t: WorkflowT;
  draft: WorkflowDraft;
  onChange: DraftPatch;
  errors: WorkflowErrors;
  disabled: boolean;
}

function FieldError({ id, message, field }: { id: string; message: string | undefined; field: string }) {
  if (!message) return null;
  return (
    <p id={id} className={errorClasses} role="alert" data-testid={`agent-workflow-error-${field}`}>
      {message}
    </p>
  );
}

// ---- Options states -----------------------------------------------------------

export function WorkflowOptionsStatus(props: {
  t: WorkflowT;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const { t, loading, error, onRetry } = props;
  if (loading) {
    return (
      <div
        className="flex items-center gap-2 text-sm text-slate-300"
        data-testid="agent-workflow-options-loading"
      >
        <Spinner className="h-4 w-4 text-indigo-300" />
        <span>{t('optionsLoading')}</span>
      </div>
    );
  }
  if (error) {
    return (
      <div
        className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-200"
        role="alert"
        data-testid="agent-workflow-options-error"
      >
        <ExclamationTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t('optionsError')}</span>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-md border border-amber-600/60 px-2 py-1 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          data-testid="agent-workflow-options-retry"
        >
          <ArrowPathIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {t('optionsRetry')}
        </button>
      </div>
    );
  }
  return null;
}

// ---- Start chooser ----------------------------------------------------------------

export function WorkflowStartChooser(props: {
  t: WorkflowT;
  templates: readonly string[];
  value: 'blank' | string;
  onChange: (value: 'blank' | string) => void;
  disabled: boolean;
  error?: string;
}) {
  const { t, templates, value, onChange, disabled, error } = props;
  const choices: { id: string; label: string; hint: string }[] = [
    { id: 'blank', label: t('startBlank'), hint: t('startBlankHint') },
    ...templates.map((id) => ({
      id,
      label: fillTemplate(t('startTemplate'), { name: t(`templates.${id}`) }),
      hint: t('startTemplateHint'),
    })),
  ];
  return (
    <fieldset className="space-y-2" data-testid="agent-workflow-start">
      <legend className={workflowLabelClasses}>{t('startLabel')}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((choice) => {
          const selected = value === choice.id;
          return (
            <label
              key={choice.id}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-brand ${
                selected
                  ? 'border-indigo-400 bg-indigo-950/40 text-slate-100'
                  : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                name="agent-workflow-start"
                value={choice.id}
                checked={selected}
                onChange={() => onChange(choice.id)}
                disabled={disabled}
                className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-500"
                data-testid={`agent-workflow-start-${choice.id}`}
              />
              <span>
                <span className="block font-medium">{choice.label}</span>
                <span className="block text-xs text-slate-400">{choice.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
      <FieldError id="agent-workflow-start-error" message={error} field="start" />
    </fieldset>
  );
}

// ---- Basic parts ---------------------------------------------------------------------

export function WorkflowBasicFields(props: CommonProps & {
  maxToneChars: number;
  count: InstructionsCount;
}) {
  const { t, draft, onChange, errors, disabled, maxToneChars, count } = props;
  const counterText = fillTemplate(t(count.exact ? 'instructionsCounter' : 'instructionsCounterTyped'), {
    used: count.used,
    max: count.max,
  });
  const partRows: { key: 'purpose' | 'procedure' | 'result'; rows: number }[] = [
    { key: 'purpose', rows: 3 },
    { key: 'procedure', rows: 5 },
    { key: 'result', rows: 3 },
  ];
  return (
    <div className="space-y-4" data-testid="agent-workflow-basic">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="agent-workflow-tone" className={workflowLabelClasses}>
            {t('toneLabel')}
          </label>
          <input
            id="agent-workflow-tone"
            type="text"
            value={draft.tone}
            onChange={(e) => onChange({ tone: e.target.value })}
            placeholder={t('tonePlaceholder')}
            disabled={disabled}
            aria-describedby={errors.tone ? 'agent-workflow-tone-error' : undefined}
            className={workflowInputClasses}
            data-testid="agent-workflow-tone"
          />
          <p className={hintClasses} data-testid="agent-workflow-tone-count">
            {fillTemplate(t('toneCount'), { used: draft.tone.length, max: maxToneChars })}
          </p>
          <FieldError id="agent-workflow-tone-error" message={errors.tone ? t(errors.tone) : undefined} field="tone" />
        </div>
        <div>
          <label htmlFor="agent-workflow-reply-language" className={workflowLabelClasses}>
            {t('replyLanguageLabel')}
          </label>
          <select
            id="agent-workflow-reply-language"
            value={draft.replyLanguage}
            onChange={(e) => onChange({ replyLanguage: e.target.value as WorkflowDraft['replyLanguage'] })}
            disabled={disabled}
            className={workflowInputClasses}
            data-testid="agent-workflow-reply-language"
          >
            <option value="">{t('replyLanguage.unset')}</option>
            {REPLY_LANGUAGE_CHOICES.map((code) => (
              <option key={code} value={code}>
                {t(`replyLanguage.${code}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {partRows.map(({ key, rows }) => (
        <div key={key}>
          <label htmlFor={`agent-workflow-${key}`} className={workflowLabelClasses}>
            {t(`${key}Label`)}
          </label>
          <textarea
            id={`agent-workflow-${key}`}
            value={draft[key]}
            onChange={(e) => onChange({ [key]: e.target.value } as Partial<WorkflowDraft>)}
            placeholder={t(`${key}Placeholder`)}
            rows={rows}
            disabled={disabled}
            aria-describedby="agent-workflow-instructions-counter"
            className={workflowInputClasses}
            data-testid={`agent-workflow-${key}`}
          />
        </div>
      ))}

      <div>
        <p
          id="agent-workflow-instructions-counter"
          className={`text-xs ${count.over ? 'font-medium text-red-400' : 'text-slate-400'}`}
          data-testid="agent-workflow-instructions-counter"
        >
          {counterText}
        </p>
        <p className={hintClasses}>{t(count.exact ? 'instructionsCounterNote' : 'instructionsCounterNoteNew')}</p>
        <FieldError
          id="agent-workflow-instructions-error"
          message={errors.instructions ? t(errors.instructions) : undefined}
          field="instructions"
        />
      </div>
    </div>
  );
}

// ---- Access --------------------------------------------------------------------------------

export function WorkflowAccessFields(props: CommonProps & {
  options: UserAgentOptions;
  scopeName: (id: string) => string;
  localePrefix: string;
}) {
  const { t, draft, onChange, errors, disabled, options, scopeName, localePrefix } = props;
  const { rows, hiddenKinds } = visibleConnectorTools(options, draft.connectorToolIds);
  return (
    <div className="space-y-4" data-testid="agent-workflow-access">
      <h4 className={sectionTitleClasses}>{t('sectionAccess')}</h4>

      <fieldset>
        <legend className={workflowLabelClasses}>{t('knowledgeLabel')}</legend>
        <p className={hintClasses}>{t('knowledgeHint')}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {options.knowledgeScopes.map((scope) => (
            <label key={scope.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={draft.knowledgeScopeIds.includes(scope.id)}
                onChange={() => onChange({ knowledgeScopeIds: toggleId(draft.knowledgeScopeIds, scope.id) })}
                disabled={disabled}
                className={checkboxClasses}
                data-testid={`agent-workflow-scope-${scope.id}`}
              />
              <span>{scopeName(scope.id)}</span>
            </label>
          ))}
        </div>
        <FieldError
          id="agent-workflow-knowledge-error"
          message={errors.knowledge ? t(errors.knowledge) : undefined}
          field="knowledge"
        />
      </fieldset>

      <fieldset>
        <legend className={workflowLabelClasses}>{t('connectorsLabel')}</legend>
        {rows.length > 0 ? (
          <div className="mt-2 space-y-2">
            {rows.map((row) => (
              <label key={row.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={draft.connectorToolIds.includes(row.id)}
                  onChange={() => onChange({ connectorToolIds: toggleId(draft.connectorToolIds, row.id) })}
                  disabled={disabled}
                  className={checkboxClasses}
                  data-testid={`agent-workflow-tool-${row.id}`}
                />
                <span>{t(`tools.${row.id}`)}</span>
                {row.connected ? null : (
                  <span
                    className="rounded-full border border-amber-700/60 px-2 py-0.5 text-[11px] font-medium text-amber-200"
                    data-testid={`agent-workflow-tool-${row.id}-not-connected`}
                  >
                    {t('connectorsNotConnected')}
                  </span>
                )}
              </label>
            ))}
          </div>
        ) : null}
        {hiddenKinds.length > 0 ? (
          <p className="mt-2 flex items-start gap-2 text-xs text-slate-300" data-testid="agent-workflow-connect-hint">
            <InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" aria-hidden="true" />
            <span>
              {t('connectorsConnectHint')}{' '}
              <Link
                href={`${localePrefix}/connections`}
                className="font-medium text-indigo-300 underline underline-offset-2 hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                data-testid="agent-workflow-connections-link"
              >
                {t('connectorsLink')}
              </Link>
            </span>
          </p>
        ) : null}
        <FieldError
          id="agent-workflow-connectors-error"
          message={errors.connectors ? t(errors.connectors) : undefined}
          field="connectors"
        />
      </fieldset>

      <div data-testid="agent-workflow-tool-profile">
        <p className={workflowLabelClasses}>{t('toolProfileLabel')}</p>
        <p className="mt-1 inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-200">
          <LockClosedIcon className="h-4 w-4 text-slate-300" aria-hidden="true" />
          <span data-testid="agent-workflow-tool-profile-value">{t('toolProfileRead')}</span>
        </p>
        <p className={hintClasses}>{t('toolProfileHint')}</p>
      </div>
    </div>
  );
}

// ---- Advanced: model and budget ------------------------------------------------------------------

export function modelCostText(t: WorkflowT, creditsPer1kTokens: number): string {
  return fillTemplate(t(creditsPer1kTokens === 1 ? 'modelCostOne' : 'modelCostMany'), {
    count: creditsPer1kTokens,
  });
}

/** What the editor shows under the budget fields for a saved workflow (BIZ-USER-01D). */
export type WorkflowUsageView =
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'loaded'; line: string };

export function WorkflowAdvancedFields(
  props: CommonProps & {
    options: UserAgentOptions;
    usage?: WorkflowUsageView | null;
    /** The workflow being edited, left out of the Team list; null on create. */
    selfId?: string | null;
  },
) {
  const { t, draft, onChange, errors, disabled, options, usage, selfId = null } = props;
  const [teamLimitHit, setTeamLimitHit] = React.useState(false);
  const teamRows = teamChoiceRows(options, draft.teamMemberIds, selfId);
  const open =
    draft.modelChoice !== 'server' ||
    draft.budgetPerRun !== '' ||
    draft.budgetPerDay !== '' ||
    draft.teamMemberIds.length > 0 ||
    draft.approvalMode !== 'every';
  const toggleTeam = (id: string) => {
    const next = toggleTeamMember(draft.teamMemberIds, id);
    setTeamLimitHit(next.limitHit);
    if (!next.limitHit) onChange({ teamMemberIds: next.ids });
  };
  const selectedModel = options.models.find((model) => model.id === draft.modelChoice);
  const maxBudget = options.limits.maxBudgetCredits;
  const budget = budgetProblems(draft, maxBudget);
  const budgetMessage = (field: 'budgetPerRun' | 'budgetPerDay'): string | undefined => {
    const key = errors[field];
    if (key) return t(key);
    if (field === 'budgetPerRun' && budget.includes('perRunInvalid')) return t('errors.budgetPerRunInvalid');
    if (field === 'budgetPerDay' && budget.includes('perDayInvalid')) return t('errors.budgetPerDayInvalid');
    if (field === 'budgetPerDay' && budget.includes('order')) return t('errors.budgetOrder');
    return undefined;
  };
  return (
    <details className="rounded-lg border border-slate-700 px-3 py-2" open={open} data-testid="agent-workflow-advanced">
      <summary className="cursor-pointer text-sm font-medium text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        {t('sectionAdvanced')}
      </summary>
      <div className="mt-3 space-y-4">
        <div>
          <label htmlFor="agent-workflow-model" className={workflowLabelClasses}>
            {t('modelLabel')}
          </label>
          <select
            id="agent-workflow-model"
            value={draft.modelChoice}
            onChange={(e) => onChange({ modelChoice: e.target.value })}
            disabled={disabled}
            className={workflowInputClasses}
            data-testid="agent-workflow-model"
          >
            <option value="server">{t('modelServer')}</option>
            {options.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.id} ({modelCostText(t, model.creditsPer1kTokens)})
              </option>
            ))}
          </select>
          <p className={hintClasses} data-testid="agent-workflow-model-cost">
            {selectedModel
              ? `${selectedModel.id}: ${modelCostText(t, selectedModel.creditsPer1kTokens)}`
              : t('modelServerHint')}
          </p>
          <FieldError id="agent-workflow-model-error" message={errors.model ? t(errors.model) : undefined} field="model" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="agent-workflow-budget-run" className={workflowLabelClasses}>
              {t('budgetPerRunLabel')}
            </label>
            <input
              id="agent-workflow-budget-run"
              type="text"
              inputMode="numeric"
              value={draft.budgetPerRun}
              onChange={(e) => onChange({ budgetPerRun: e.target.value })}
              placeholder={t('budgetPlaceholder')}
              disabled={disabled}
              aria-describedby={budgetMessage('budgetPerRun') ? 'agent-workflow-budget-run-error' : undefined}
              className={workflowInputClasses}
              data-testid="agent-workflow-budget-run"
            />
            <FieldError id="agent-workflow-budget-run-error" message={budgetMessage('budgetPerRun')} field="budgetPerRun" />
          </div>
          <div>
            <label htmlFor="agent-workflow-budget-day" className={workflowLabelClasses}>
              {t('budgetPerDayLabel')}
            </label>
            <input
              id="agent-workflow-budget-day"
              type="text"
              inputMode="numeric"
              value={draft.budgetPerDay}
              onChange={(e) => onChange({ budgetPerDay: e.target.value })}
              placeholder={t('budgetPlaceholder')}
              disabled={disabled}
              aria-describedby={budgetMessage('budgetPerDay') ? 'agent-workflow-budget-day-error' : undefined}
              className={workflowInputClasses}
              data-testid="agent-workflow-budget-day"
            />
            <FieldError id="agent-workflow-budget-day-error" message={budgetMessage('budgetPerDay')} field="budgetPerDay" />
          </div>
        </div>
        <p className={hintClasses} data-testid="agent-workflow-budget-hint">
          {t('budgetHint')}{' '}
          {fillTemplate(t('budgetPlatformDaily'), { count: options.limits.platformDailyCreditsPerUser })}
        </p>
        {usage ? (
          <p className={hintClasses} role="status" data-testid="agent-workflow-budget-usage">
            {usage.state === 'loaded'
              ? usage.line
              : usage.state === 'loading'
                ? t('summary.usageLoading')
                : t('summary.usageFailed')}
          </p>
        ) : null}
        <FieldError id="agent-workflow-budget-error" message={errors.budget ? t(errors.budget) : undefined} field="budget" />

        <fieldset data-testid="agent-workflow-team">
          <legend className={workflowLabelClasses}>{t('teamLabel')}</legend>
          <p className={hintClasses}>{t('teamHint')}</p>
          {teamRows.length > 0 ? (
            <div className="mt-2 space-y-2">
              {teamRows.map((row) => {
                const checked = draft.teamMemberIds.includes(row.id);
                return (
                  <label
                    key={row.id}
                    className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-200"
                    data-testid={`agent-workflow-team-option-${row.id}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTeam(row.id)}
                      disabled={disabled}
                      className={checkboxClasses}
                      data-testid={`agent-workflow-team-${row.id}`}
                    />
                    <span className="min-w-0 break-words">{teamMemberName(t, row)}</span>
                    <span className="text-xs text-slate-400">
                      {row.kind === 'workflow' ? t('teamKindWorkflow') : t('teamKindSystem')}
                    </span>
                    {row.note ? (
                      <span
                        className="rounded-full border border-amber-700/60 px-2 py-0.5 text-[11px] font-medium text-amber-200"
                        data-testid={`agent-workflow-team-note-${row.id}`}
                      >
                        {row.note === 'draft' ? t('teamNoteDraft') : t('teamNoteOff')}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          ) : (
            <p className={hintClasses} data-testid="agent-workflow-team-empty">
              {t('teamEmpty')}
            </p>
          )}
          <p className={hintClasses} role="status" data-testid="agent-workflow-team-count">
            {fillTemplate(t('teamCount'), { count: draft.teamMemberIds.length, max: WORKFLOW_TEAM_MAX })}
          </p>
          {teamLimitHit ? (
            <p className="mt-1 flex items-start gap-2 text-xs text-amber-200" role="status" data-testid="agent-workflow-team-limit">
              <InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{fillTemplate(t('teamLimit'), { max: WORKFLOW_TEAM_MAX })}</span>
            </p>
          ) : null}
          <p className={hintClasses} data-testid="agent-workflow-team-approval">
            {t(draft.approvalMode === 'every' ? 'teamApprovalHint' : 'teamApprovalHintAuto')}
          </p>
          <FieldError id="agent-workflow-team-error" message={errors.team ? t(errors.team) : undefined} field="team" />
        </fieldset>

        <fieldset data-testid="agent-workflow-approval">
          <legend className={workflowLabelClasses}>{t('approvalLabel')}</legend>
          <div className="mt-2 space-y-2">
            {APPROVAL_MODES.map((mode) => {
              const selected = draft.approvalMode === mode;
              const text =
                mode === 'every' ? t('approvalEvery') : mode === 'read_only' ? t('approvalReadOnly') : t('approvalCredits');
              return (
                <label
                  key={mode}
                  className={`flex items-center gap-2 py-0.5 text-sm text-slate-200 ${
                    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  }`}
                  data-testid={`agent-workflow-approval-option-${mode}`}
                >
                  <input
                    type="radio"
                    name="agent-workflow-approval"
                    value={mode}
                    checked={selected}
                    onChange={() => onChange({ approvalMode: mode })}
                    disabled={disabled}
                    className="h-4 w-4 shrink-0 accent-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    data-testid={`agent-workflow-approval-${mode}`}
                  />
                  <span className="min-w-0 break-words">{text}</span>
                </label>
              );
            })}
          </div>
          {draft.approvalMode === 'credits' ? (
            <div className="mt-2 sm:max-w-xs">
              <label htmlFor="agent-workflow-approval-limit" className={workflowLabelClasses}>
                {t('approvalCreditsLimit')}
              </label>
              <input
                id="agent-workflow-approval-limit"
                type="text"
                inputMode="numeric"
                value={draft.approvalCreditLimit}
                onChange={(e) => onChange({ approvalCreditLimit: e.target.value })}
                placeholder={t('approvalLimitPlaceholder')}
                disabled={disabled}
                aria-invalid={errors.approval ? true : undefined}
                aria-describedby={errors.approval ? 'agent-workflow-approval-error' : undefined}
                className={workflowInputClasses}
                data-testid="agent-workflow-approval-limit"
              />
            </div>
          ) : null}
          <p className={hintClasses} data-testid="agent-workflow-approval-never">
            {t('approvalNever')}
          </p>
          <p className={hintClasses} data-testid="agent-workflow-approval-first">
            {t('approvalHint')}
          </p>
          {draft.approvalMode !== 'every' && draft.teamMemberIds.length === 0 ? (
            <p className="mt-1 flex items-start gap-2 text-xs text-amber-200" role="status" data-testid="agent-workflow-approval-no-team">
              <InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t('approvalNoTeam')}</span>
            </p>
          ) : null}
          <FieldError
            id="agent-workflow-approval-error"
            message={errors.approval ? t(errors.approval) : undefined}
            field="approval"
          />
        </fieldset>
      </div>
    </details>
  );
}

// ---- Shown, not set: never-do list and grants ----------------------------------------------------------

export function WorkflowShownPanel(props: {
  t: WorkflowT;
  saved: UserAgent | null;
  scopeName: (id: string) => string;
}) {
  const { t, saved, scopeName } = props;
  const lines = neverDoLines(saved?.neverDo);
  return (
    <section className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3" data-testid="agent-workflow-shown">
      <div>
        <h4 className={`${sectionTitleClasses} flex items-center gap-2`}>
          <NoSymbolIcon className="h-4 w-4 text-slate-300" aria-hidden="true" />
          {t('neverDoTitle')}
        </h4>
        <p className={hintClasses}>{t('neverDoHint')}</p>
        {lines.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400" data-testid="agent-workflow-never-do-pending">
            {t('shownPending')}
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-200" data-testid="agent-workflow-never-do">
            {lines.map((line) => (
              <li key={line.code} className="flex items-start gap-2" data-testid={`agent-workflow-never-do-${line.code}`}>
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
                <span>
                  {fillTemplate(t(line.messageKey), {
                    folders: line.scopeIds.map((id) => scopeName(id)).join(', '),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {saved?.grants ? (
        <div data-testid="agent-workflow-grants">
          <h4 className={sectionTitleClasses}>{t('grantsTitle')}</h4>
          <dl className="mt-2 space-y-1 text-sm text-slate-200">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-slate-400">{t('grantsProfile')}</dt>
              <dd data-testid="agent-workflow-grants-profile">{t('toolProfileRead')}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-slate-400">{t('grantsFolders')}</dt>
              <dd data-testid="agent-workflow-grants-folders">
                {saved.grants.knowledgeScopeIds.length > 0
                  ? saved.grants.knowledgeScopeIds.map((id) => scopeName(id)).join(', ')
                  : t('grantsNone')}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-slate-400">{t('grantsTools')}</dt>
              <dd data-testid="agent-workflow-grants-tools">
                {saved.grants.connectorToolIds.length > 0
                  ? saved.grants.connectorToolIds.map((id) => t(`tools.${id}`)).join(', ')
                  : t('grantsNone')}
              </dd>
            </div>
          </dl>
          {(saved.grants.dropped?.missingConnections.length ?? 0) > 0 ? (
            <p className="mt-2 text-xs text-amber-200" data-testid="agent-workflow-grants-missing">
              {t('grantsMissingConnection')}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
