'use client';

import React from 'react';
import {
  PlusIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type {
  CreateAgentDto,
  CreateAgentFromTemplateDto,
  UpdateAgentDto,
  UserAgent,
  UserAgentOptions,
  UserAgentSaveResult,
} from '@/hooks/useUserAgents';
import Spinner from '@/components/ui/Spinner';
import {
  WorkflowAccessFields,
  WorkflowAdvancedFields,
  WorkflowBasicFields,
  WorkflowOptionsStatus,
  WorkflowShownPanel,
  WorkflowStartChooser,
  type WorkflowT,
  type WorkflowUsageView,
} from './agent-workflow-fields';
import {
  DEFAULT_WORKFLOW_LIMITS,
  buildBlankBody,
  buildPatchBody,
  buildTemplateBody,
  checkWorkflowDraft,
  emptyWorkflowDraft,
  liveInstructionsCount,
  mapRefusal,
  templatePrefillPatch,
  workflowDraftFromAgent,
  type TemplatePrefill,
  type WorkflowDraft,
  type WorkflowErrors,
} from './agent-workflow-model';

export interface CreateAgentFormLabels {
  formTitle: string;
  nameLabel: string;
  namePlaceholder: string;
  roleLabel: string;
  rolePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  submitButton: string;
  cancelButton: string;
  submitting: string;
  nameRequired: string;
  nameTooLong: string;
  roleRequired: string;
  roleTooLong: string;
  descriptionRequired: string;
  descriptionTooLong: string;
  createError: string;
  createSuccess: string;
  /** WORKFLOW-CREATE-01: one line under Role: shown on the card, not part of the instructions. */
  roleHint?: string;
  /** WORKFLOW-CREATE-01: one line under Description, saying the same. */
  descriptionHint?: string;
}


/** What the editor asks its owner to save. The dashboard maps each kind to a hook call. */
export type WorkflowSaveRequest =
  | { kind: 'blank'; body: CreateAgentDto }
  | { kind: 'template'; body: CreateAgentFromTemplateDto }
  | { kind: 'update'; agentId: string; body: UpdateAgentDto };

/** Present when the form runs as the workflow editor (BIZ-USER-01B). Absent: the plain three-field create. */
export interface AgentWorkflowConfig {
  mode: 'create' | 'edit';
  /** Looks up platform.agentWorkflow.<key>. */
  t: WorkflowT;
  /** The display name of a Knowledge folder. */
  scopeName: (id: string) => string;
  localePrefix: string;
  options: UserAgentOptions | null;
  optionsLoading: boolean;
  optionsError: boolean;
  onRetryOptions: () => void;
  /** The workflow being edited (mode 'edit'). */
  agent?: UserAgent | null;
  /** True when this editor opened straight after a copy from a template. */
  createdNotice?: boolean;
  /** Last run and spend today for the workflow being edited (BIZ-USER-01D). */
  usage?: WorkflowUsageView | null;
  onSave: (request: WorkflowSaveRequest) => Promise<UserAgentSaveResult>;
  /** Called after a successful save with the saved row and the kind of save. */
  onSaved?: (agent: UserAgent, kind: WorkflowSaveRequest['kind']) => void;
  /**
   * WORKFLOW-CREATE-01: a template's role and description in the owner's language,
   * prefilled when the owner picks that template; null when unknown.
   */
  templatePrefill?: (templateId: string) => TemplatePrefill | null;
  /** Test seam: open the create form with this start already picked. */
  initialStart?: string;
}

export interface CreateAgentFormProps {
  labels: CreateAgentFormLabels;
  onSubmit: (data: { name: string; role: string; description: string }) => Promise<{ error?: string }>;
  onCancel: () => void;
  workflow?: AgentWorkflowConfig;
}

interface FieldErrors {
  name?: string;
  role?: string;
  description?: string;
}

export default function CreateAgentForm({ labels, onSubmit, onCancel, workflow }: CreateAgentFormProps) {
  const editing = workflow?.mode === 'edit';
  const initialStart = !editing && workflow?.initialStart ? workflow.initialStart : 'blank';
  const prefillFor = (startId: string): TemplatePrefill | null =>
    startId === 'blank' ? null : (workflow?.templatePrefill?.(startId) ?? null);
  const [draft, setDraft] = React.useState<WorkflowDraft>(() => {
    if (editing && workflow?.agent) return workflowDraftFromAgent(workflow.agent);
    const empty = emptyWorkflowDraft();
    return { ...empty, ...templatePrefillPatch(empty, null, prefillFor(initialStart)) };
  });
  const [saved, setSaved] = React.useState<UserAgent | null>(workflow?.agent ?? null);
  const [start, setStart] = React.useState<string>(initialStart);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [workflowErrors, setWorkflowErrors] = React.useState<WorkflowErrors>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const t: WorkflowT = workflow?.t ?? (() => '');
  const options = workflow?.options ?? null;
  const limits = options?.limits ?? DEFAULT_WORKFLOW_LIMITS;
  const templateMode = !editing && start !== 'blank';
  // The full workflow fields need the options route; without it the form falls back to the plain create.
  const showWorkflowFields = Boolean(workflow && options && !templateMode);
  const count = liveInstructionsCount(draft, saved, limits.maxInstructionsChars);
  const optionsPending = Boolean(workflow && !options && workflow.optionsLoading);
  const editBlocked = Boolean(editing && !options);

  const failureText =
    editing && workflow ? t('errors.saveFailed') : labels.createError;

  function patchDraft(patch: Partial<WorkflowDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setSubmitSuccess(false);
  }

  function changeStart(value: string) {
    const previous = prefillFor(start);
    const next = prefillFor(value);
    setStart(value);
    setWorkflowErrors({});
    setDraft((current) => ({ ...current, ...templatePrefillPatch(current, previous, next) }));
    setSubmitSuccess(false);
  }

  const describedBy = (...ids: Array<string | false | undefined>): string | undefined => {
    const list = ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
    return list.length > 0 ? list.join(' ') : undefined;
  };

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!draft.name.trim()) errors.name = labels.nameRequired;
    else if (draft.name.length > 100) errors.name = labels.nameTooLong;
    if (!draft.role.trim()) errors.role = labels.roleRequired;
    else if (draft.role.length > 200) errors.role = labels.roleTooLong;
    if (!draft.description.trim()) errors.description = labels.descriptionRequired;
    else if (draft.description.length > 2000) errors.description = labels.descriptionTooLong;
    return errors;
  }

  function requestFor(): WorkflowSaveRequest {
    if (editing && workflow?.agent) {
      return { kind: 'update', agentId: workflow.agent.id, body: buildPatchBody(draft) };
    }
    if (templateMode) {
      return { kind: 'template', body: buildTemplateBody(start, draft) };
    }
    return { kind: 'blank', body: buildBlankBody(draft) };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);
    setWorkflowErrors({});

    const errors = validate();
    setFieldErrors(errors);
    const workflowChecks = workflow
      ? checkWorkflowDraft({
          draft,
          limits,
          instructions: count,
          scope: showWorkflowFields || editing ? 'workflow' : 'basic',
        })
      : {};
    setWorkflowErrors(workflowChecks);
    if (Object.keys(errors).length > 0 || Object.keys(workflowChecks).length > 0) return;

    setSubmitting(true);
    try {
      if (!workflow) {
        const result = await onSubmit({
          name: draft.name.trim(),
          role: draft.role.trim(),
          description: draft.description.trim(),
        });
        if (result.error) {
          setSubmitError(labels.createError);
        } else {
          setSubmitSuccess(true);
          setTimeout(() => {
            onCancel();
          }, 1200);
        }
        return;
      }

      const request = requestFor();
      const result = await workflow.onSave(request);
      if (result.error || !result.agent) {
        const refusal = mapRefusal(result.code);
        if (refusal.field === 'form') {
          setSubmitError(result.code ? t(refusal.messageKey) : failureText);
        } else {
          setWorkflowErrors({ [refusal.field]: refusal.messageKey });
          setSubmitError(null);
        }
        return;
      }
      setSubmitSuccess(true);
      setSaved(result.agent);
      workflow.onSaved?.(result.agent, request.kind);
      if (request.kind === 'blank') {
        setTimeout(() => {
          onCancel();
        }, 1200);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputClasses =
    'block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50';
  const labelClasses = 'block text-sm font-medium text-slate-200';
  const errorClasses = 'mt-1 text-xs text-red-400';
  const hintClasses = 'mt-1 text-xs text-slate-400';

  const title = editing && workflow ? t('editTitle') : labels.formTitle;
  const TitleIcon = editing ? PencilSquareIcon : PlusIcon;
  const submitLabel = editing && workflow ? t('saveButton') : labels.submitButton;
  const submittingLabel = editing && workflow ? t('saving') : labels.submitting;
  const successText = editing && workflow ? t('saved') : labels.createSuccess;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-testid="create-agent-form"
      noValidate
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TitleIcon className="h-4 w-4 text-indigo-300" aria-hidden="true" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-600 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          aria-label={labels.cancelButton}
          data-testid="create-agent-cancel"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {workflow?.createdNotice && !submitSuccess && (
        <div
          className="flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300"
          role="status"
          data-testid="agent-workflow-copied"
        >
          <CheckCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('templateCopied')}</span>
        </div>
      )}

      {workflow ? (
        <WorkflowOptionsStatus
          t={t}
          loading={optionsPending}
          error={workflow.optionsError && !options}
          onRetry={workflow.onRetryOptions}
        />
      ) : null}

      {workflow && !editing && options && options.templates.length > 0 ? (
        <WorkflowStartChooser
          t={t}
          templates={options.templates}
          value={start}
          onChange={changeStart}
          disabled={submitting}
          error={workflowErrors.start ? t(workflowErrors.start) : undefined}
        />
      ) : null}

      <div>
        <label htmlFor="agent-name" className={labelClasses}>
          {labels.nameLabel}
        </label>
        <input
          id="agent-name"
          type="text"
          value={draft.name}
          onChange={(e) => patchDraft({ name: e.target.value })}
          placeholder={labels.namePlaceholder}
          maxLength={100}
          required
          aria-required="true"
          aria-describedby={fieldErrors.name ? 'agent-name-error' : undefined}
          disabled={submitting}
          className={inputClasses}
          data-testid="create-agent-name"
        />
        {fieldErrors.name && (
          <p id="agent-name-error" className={errorClasses} role="alert">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="agent-role" className={labelClasses}>
          {labels.roleLabel}
        </label>
        <input
          id="agent-role"
          type="text"
          value={draft.role}
          onChange={(e) => patchDraft({ role: e.target.value })}
          placeholder={labels.rolePlaceholder}
          maxLength={200}
          required
          aria-required="true"
          aria-describedby={describedBy(
            labels.roleHint && 'agent-role-hint',
            fieldErrors.role && 'agent-role-error',
          )}
          disabled={submitting}
          className={inputClasses}
          data-testid="create-agent-role"
        />
        {labels.roleHint ? (
          <p id="agent-role-hint" className={hintClasses} data-testid="create-agent-role-hint">
            {labels.roleHint}
          </p>
        ) : null}
        {fieldErrors.role && (
          <p id="agent-role-error" className={errorClasses} role="alert">
            {fieldErrors.role}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="agent-description" className={labelClasses}>
          {labels.descriptionLabel}
        </label>
        <textarea
          id="agent-description"
          value={draft.description}
          onChange={(e) => patchDraft({ description: e.target.value })}
          placeholder={labels.descriptionPlaceholder}
          maxLength={2000}
          rows={4}
          required
          aria-required="true"
          aria-describedby={describedBy(
            labels.descriptionHint && 'agent-description-hint',
            fieldErrors.description && 'agent-description-error',
          )}
          disabled={submitting}
          className={inputClasses}
          data-testid="create-agent-description"
        />
        {labels.descriptionHint ? (
          <p id="agent-description-hint" className={hintClasses} data-testid="create-agent-description-hint">
            {labels.descriptionHint}
          </p>
        ) : null}
        {fieldErrors.description && (
          <p id="agent-description-error" className={errorClasses} role="alert">
            {fieldErrors.description}
          </p>
        )}
      </div>

      {workflow && templateMode ? (
        <p
          className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300"
          data-testid="agent-workflow-template-note"
        >
          {t('templateNote')}
        </p>
      ) : null}

      {workflow && options && !templateMode ? (
        <>
          <WorkflowBasicFields
            t={t}
            draft={draft}
            onChange={patchDraft}
            errors={workflowErrors}
            disabled={submitting}
            maxToneChars={limits.maxToneChars}
            count={count}
          />
          <WorkflowAccessFields
            t={t}
            draft={draft}
            onChange={patchDraft}
            errors={workflowErrors}
            disabled={submitting}
            options={options}
            scopeName={workflow.scopeName}
            localePrefix={workflow.localePrefix}
          />
          <WorkflowAdvancedFields
            t={t}
            draft={draft}
            onChange={patchDraft}
            errors={workflowErrors}
            disabled={submitting}
            options={options}
            usage={editing ? workflow.usage : null}
          />
          <WorkflowShownPanel t={t} saved={saved} scopeName={workflow.scopeName} />
        </>
      ) : null}

      {submitError && (
        <div
          className="flex items-center gap-2 rounded-lg border border-red-700/50 bg-red-950/50 px-3 py-2 text-sm text-red-300"
          role="alert"
          data-testid="create-agent-error"
        >
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      )}

      {submitSuccess && (
        <div
          className="flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300"
          role="status"
          data-testid={editing ? 'agent-workflow-saved' : 'create-agent-success'}
        >
          <CheckCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{successText}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || optionsPending || editBlocked}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-50"
        data-testid="create-agent-submit"
      >
        {submitting ? <Spinner className="h-4 w-4" /> : null}
        {submitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
