'use client';

import React from 'react';
import {
  PlusIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

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
}

export interface CreateAgentFormProps {
  labels: CreateAgentFormLabels;
  onSubmit: (data: { name: string; role: string; description: string }) => Promise<{ error?: string }>;
  onCancel: () => void;
}

interface FieldErrors {
  name?: string;
  role?: string;
  description?: string;
}

export default function CreateAgentForm({ labels, onSubmit, onCancel }: CreateAgentFormProps) {
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = labels.nameRequired;
    else if (name.length > 100) errors.name = labels.nameTooLong;
    if (!role.trim()) errors.role = labels.roleRequired;
    else if (role.length > 200) errors.role = labels.roleTooLong;
    if (!description.trim()) errors.description = labels.descriptionRequired;
    else if (description.length > 2000) errors.description = labels.descriptionTooLong;
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const result = await onSubmit({ name: name.trim(), role: role.trim(), description: description.trim() });
      if (result.error) {
        setSubmitError(result.error);
      } else {
        setSubmitSuccess(true);
        setTimeout(() => {
          onCancel();
        }, 1200);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputClasses =
    'block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50';
  const labelClasses = 'block text-sm font-medium text-slate-200';
  const errorClasses = 'mt-1 text-xs text-red-400';

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-testid="create-agent-form"
      noValidate
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlusIcon className="h-4 w-4 text-indigo-300" aria-hidden="true" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
            {labels.formTitle}
          </h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-600 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          aria-label={labels.cancelButton}
          data-testid="create-agent-cancel"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div>
        <label htmlFor="agent-name" className={labelClasses}>
          {labels.nameLabel}
        </label>
        <input
          id="agent-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder={labels.rolePlaceholder}
          maxLength={200}
          required
          aria-required="true"
          aria-describedby={fieldErrors.role ? 'agent-role-error' : undefined}
          disabled={submitting}
          className={inputClasses}
          data-testid="create-agent-role"
        />
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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={labels.descriptionPlaceholder}
          maxLength={2000}
          rows={4}
          required
          aria-required="true"
          aria-describedby={fieldErrors.description ? 'agent-description-error' : undefined}
          disabled={submitting}
          className={inputClasses}
          data-testid="create-agent-description"
        />
        {fieldErrors.description && (
          <p id="agent-description-error" className={errorClasses} role="alert">
            {fieldErrors.description}
          </p>
        )}
      </div>

      {submitError && (
        <div
          className="flex items-center gap-2 rounded-lg border border-red-700/50 bg-red-950/50 px-3 py-2 text-sm text-red-300"
          role="alert"
          data-testid="create-agent-error"
        >
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{labels.createError}</span>
        </div>
      )}

      {submitSuccess && (
        <div
          className="flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300"
          role="alert"
          data-testid="create-agent-success"
        >
          <CheckCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{labels.createSuccess}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-50"
        data-testid="create-agent-submit"
      >
        {submitting ? labels.submitting : labels.submitButton}
      </button>
    </form>
  );
}
