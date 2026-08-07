'use client';

import React from 'react';
import {
  ArrowPathIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from '@/hooks/useTranslations';
import type { AdminUserCreditBalance } from './admin-user-detail-client';

export const ADMIN_CREDIT_GRANT_REASON_MAX_LENGTH = 500;

export type AdminCreditGrantPhase = 'closed' | 'form' | 'confirm' | 'submitting' | 'result';

export interface AdminCreditGrantResponse {
  grantId: string;
  status: 'granted' | 'duplicate' | 'failed';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
}

export type AdminCreditGrantValidationErrorKey =
  | 'validation.amountRequired'
  | 'validation.amountInteger'
  | 'validation.amountMin'
  | 'validation.reasonRequired'
  | 'validation.reasonMax';

export interface AdminCreditGrantValidationResult {
  amount: number | null;
  reason: string;
  errors: {
    amount?: AdminCreditGrantValidationErrorKey;
    reason?: AdminCreditGrantValidationErrorKey;
  };
}

export type AdminCreditGrantIdempotencyKeyAction = 'retain' | 'clear';

export interface AdminCreditGrantPanelProps {
  userId: string;
  targetUserEmail: string;
  creditBalance: AdminUserCreditBalance;
  onUnauthorizedStatus: (status: number) => boolean;
  onBalanceUpdated: (balanceAfter: number) => void;
}

type AdminCreditGrantErrorKey =
  | 'error.http400'
  | 'error.http404'
  | 'error.network'
  | 'error.generic';

type AdminCreditGrantResultState =
  | {
      kind: 'granted' | 'duplicate' | 'failed';
      response: AdminCreditGrantResponse;
      canRetry: false;
    }
  | {
      kind: 'error';
      errorKey: AdminCreditGrantErrorKey;
      canRetry: boolean;
    };

interface AdminCreditGrantDraft {
  amount: number;
  reason: string;
}

export function shouldShowAdminCreditGrantPanel(
  creditBalance: AdminUserCreditBalance | null,
): boolean {
  return creditBalance !== null;
}

export function buildAdminCreditGrantRequestUrl(userId: string): string {
  return `/api/admin/users/${encodeURIComponent(userId)}/credits`;
}

export function buildAdminCreditGrantRequestBody(input: {
  amount: number;
  reason: string;
  idempotencyKey: string;
}): { amount: number; reason: string; idempotencyKey: string } {
  return {
    amount: input.amount,
    reason: input.reason.trim(),
    idempotencyKey: input.idempotencyKey,
  };
}

export function validateAdminCreditGrantInput(input: {
  amount: string;
  reason: string;
}): AdminCreditGrantValidationResult {
  const amountValue = input.amount.trim();
  const reasonValue = input.reason;
  const reasonTrimmed = reasonValue.trim();
  const errors: AdminCreditGrantValidationResult['errors'] = {};

  let amount: number | null = null;
  if (!amountValue) {
    errors.amount = 'validation.amountRequired';
  } else {
    const parsed = Number(amountValue);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      errors.amount = 'validation.amountInteger';
    } else if (parsed < 1) {
      errors.amount = 'validation.amountMin';
    } else {
      amount = parsed;
    }
  }

  if (reasonValue.length > ADMIN_CREDIT_GRANT_REASON_MAX_LENGTH) {
    errors.reason = 'validation.reasonMax';
  } else if (!reasonTrimmed) {
    errors.reason = 'validation.reasonRequired';
  }

  return {
    amount,
    reason: reasonTrimmed,
    errors,
  };
}

export function calculateProjectedBalance(currentBalance: number, amount: number): number {
  return currentBalance + amount;
}

export function resolveIdempotencyKeyAction(input: {
  httpStatus?: number;
  grantStatus?: AdminCreditGrantResponse['status'];
  transportError?: boolean;
  parseError?: boolean;
}): AdminCreditGrantIdempotencyKeyAction {
  if (input.transportError || input.parseError) {
    return 'retain';
  }

  if (input.grantStatus === 'granted' || input.grantStatus === 'duplicate' || input.grantStatus === 'failed') {
    return 'clear';
  }

  if (typeof input.httpStatus === 'number') {
    if (input.httpStatus >= 500) {
      return 'retain';
    }

    if (input.httpStatus === 401 || input.httpStatus === 403) {
      return 'retain';
    }

    if (input.httpStatus === 400 || input.httpStatus === 404) {
      return 'clear';
    }

    return 'clear';
  }

  return 'retain';
}

export function getOrCreateIdempotencyKey(input: {
  existingKey: string | null;
  createKey: () => string;
}): string {
  return input.existingKey ?? input.createKey();
}

export function shouldUpdateBalanceFromGrantStatus(status: AdminCreditGrantResponse['status']): boolean {
  return status === 'granted' || status === 'duplicate';
}

function isValidGrantResponse(payload: unknown): payload is AdminCreditGrantResponse {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Partial<AdminCreditGrantResponse>;
  const validStatus =
    candidate.status === 'granted' || candidate.status === 'duplicate' || candidate.status === 'failed';

  return (
    typeof candidate.grantId === 'string' &&
    validStatus &&
    typeof candidate.amount === 'number' &&
    Number.isFinite(candidate.amount) &&
    typeof candidate.balanceBefore === 'number' &&
    Number.isFinite(candidate.balanceBefore) &&
    typeof candidate.balanceAfter === 'number' &&
    Number.isFinite(candidate.balanceAfter)
  );
}

export default function AdminCreditGrantPanel({
  userId,
  targetUserEmail,
  creditBalance,
  onUnauthorizedStatus,
  onBalanceUpdated,
}: AdminCreditGrantPanelProps) {
  const t = useTranslations('admin');
  const [phase, setPhase] = React.useState<AdminCreditGrantPhase>('closed');
  const [amountInput, setAmountInput] = React.useState('');
  const [reasonInput, setReasonInput] = React.useState('');
  const [validationErrors, setValidationErrors] = React.useState<AdminCreditGrantValidationResult['errors']>({});
  const [draft, setDraft] = React.useState<AdminCreditGrantDraft | null>(null);
  const [result, setResult] = React.useState<AdminCreditGrantResultState | null>(null);
  const activeSubmitRef = React.useRef(false);
  const retainedIdempotencyKeyRef = React.useRef<string | null>(null);

  const clearRetainedIdempotencyKey = React.useCallback(() => {
    retainedIdempotencyKeyRef.current = null;
  }, []);

  const openForm = React.useCallback(() => {
    clearRetainedIdempotencyKey();
    setResult(null);
    setValidationErrors({});
    setPhase('form');
  }, [clearRetainedIdempotencyKey]);

  const closePanel = React.useCallback(() => {
    clearRetainedIdempotencyKey();
    setPhase('closed');
    setValidationErrors({});
    setResult(null);
    setDraft(null);
  }, [clearRetainedIdempotencyKey]);

  const submitAttempt = React.useCallback(async () => {
    if (!draft || activeSubmitRef.current) {
      return;
    }

    activeSubmitRef.current = true;
    setPhase('submitting');
    setResult(null);

    const idempotencyKey = getOrCreateIdempotencyKey({
      existingKey: retainedIdempotencyKeyRef.current,
      createKey: () => crypto.randomUUID(),
    });
    retainedIdempotencyKeyRef.current = idempotencyKey;

    try {
      const response = await fetch(buildAdminCreditGrantRequestUrl(userId), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          buildAdminCreditGrantRequestBody({
            amount: draft.amount,
            reason: draft.reason,
            idempotencyKey,
          }),
        ),
      });

      if (onUnauthorizedStatus(response.status)) {
        return;
      }

      if (!response.ok) {
        const keyAction = resolveIdempotencyKeyAction({ httpStatus: response.status });
        if (keyAction === 'clear') {
          clearRetainedIdempotencyKey();
        }

        const errorKey: AdminCreditGrantErrorKey =
          response.status === 400
            ? 'error.http400'
            : response.status === 404
              ? 'error.http404'
              : response.status >= 500
                ? 'error.network'
                : 'error.generic';

        setResult({
          kind: 'error',
          errorKey,
          canRetry: keyAction === 'retain',
        });
        setPhase('result');
        return;
      }

      const payload = (await response.json()) as unknown;
      if (!isValidGrantResponse(payload)) {
        const keyAction = resolveIdempotencyKeyAction({ parseError: true });
        if (keyAction === 'clear') {
          clearRetainedIdempotencyKey();
        }

        setResult({
          kind: 'error',
          errorKey: 'error.network',
          canRetry: keyAction === 'retain',
        });
        setPhase('result');
        return;
      }

      const keyAction = resolveIdempotencyKeyAction({ grantStatus: payload.status });
      if (keyAction === 'clear') {
        clearRetainedIdempotencyKey();
      }

      if (shouldUpdateBalanceFromGrantStatus(payload.status)) {
        onBalanceUpdated(payload.balanceAfter);
      }

      setResult({
        kind: payload.status,
        response: payload,
        canRetry: false,
      });
      setPhase('result');
    } catch (error) {
      console.error('Failed to submit admin credit grant:', error);
      const keyAction = resolveIdempotencyKeyAction({ transportError: true });
      if (keyAction === 'clear') {
        clearRetainedIdempotencyKey();
      }

      setResult({
        kind: 'error',
        errorKey: 'error.network',
        canRetry: keyAction === 'retain',
      });
      setPhase('result');
    } finally {
      activeSubmitRef.current = false;
    }
  }, [clearRetainedIdempotencyKey, draft, onBalanceUpdated, onUnauthorizedStatus, userId]);

  const handleProceedToConfirm = React.useCallback(() => {
    const validation = validateAdminCreditGrantInput({
      amount: amountInput,
      reason: reasonInput,
    });
    setValidationErrors(validation.errors);

    if (validation.errors.amount || validation.errors.reason || validation.amount === null) {
      return;
    }

    setDraft({
      amount: validation.amount,
      reason: validation.reason,
    });
    setResult(null);
    setPhase('confirm');
  }, [amountInput, reasonInput]);

  const handleStartNewAttempt = React.useCallback(() => {
    clearRetainedIdempotencyKey();
    setDraft(null);
    setResult(null);
    setValidationErrors({});
    setAmountInput('');
    setReasonInput('');
    setPhase('form');
  }, [clearRetainedIdempotencyKey]);

  const reasonCountLabel = t('creditGrant.reasonCount')
    .replace('{count}', String(reasonInput.length))
    .replace('{max}', String(ADMIN_CREDIT_GRANT_REASON_MAX_LENGTH));

  const projectedBalance = draft
    ? calculateProjectedBalance(creditBalance.balance, draft.amount)
    : null;

  return (
    <section
      className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3"
      data-testid="admin-credit-grant-panel"
    >
      <div className="flex items-center gap-2">
        <BanknotesIcon className="h-4 w-4 text-gray-700" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-900">{t('creditGrant.title')}</h3>
      </div>

      {phase === 'closed' ? (
        <button
          type="button"
          onClick={openForm}
          className="mt-3 inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-100"
          data-testid="admin-credit-grant-open"
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          {t('creditGrant.addCredits')}
        </button>
      ) : null}

      {phase === 'form' ? (
        <div className="mt-3 space-y-3">
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t('creditGrant.currentPeriodNote')}
          </p>

          <label className="block text-sm text-gray-700">
            <span className="mb-1 block font-medium">{t('creditGrant.amount')}</span>
            <input
              type="number"
              min={1}
              step={1}
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              data-testid="admin-credit-grant-amount-input"
            />
          </label>
          {validationErrors.amount ? (
            <p className="text-xs text-red-700" data-testid="admin-credit-grant-amount-error">
              {t(`creditGrant.${validationErrors.amount}`)}
            </p>
          ) : null}

          <label className="block text-sm text-gray-700">
            <span className="mb-1 block font-medium">{t('creditGrant.reason')}</span>
            <textarea
              value={reasonInput}
              onChange={(event) => setReasonInput(event.target.value)}
              rows={4}
              maxLength={ADMIN_CREDIT_GRANT_REASON_MAX_LENGTH}
              placeholder={t('creditGrant.reasonPlaceholder')}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              data-testid="admin-credit-grant-reason-input"
            />
          </label>
          <p className="text-xs text-gray-500" data-testid="admin-credit-grant-reason-count">
            {reasonCountLabel}
          </p>
          {validationErrors.reason ? (
            <p className="text-xs text-red-700" data-testid="admin-credit-grant-reason-error">
              {t(`creditGrant.${validationErrors.reason}`)}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleProceedToConfirm}
              className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black sm:w-auto"
              data-testid="admin-credit-grant-proceed-confirm"
            >
              {t('creditGrant.confirm')}
            </button>
            <button
              type="button"
              onClick={closePanel}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 sm:w-auto"
              data-testid="admin-credit-grant-form-cancel"
            >
              {t('creditGrant.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'confirm' && draft ? (
        <div className="mt-3 space-y-3" data-testid="admin-credit-grant-confirmation">
          <h4 className="text-sm font-semibold text-gray-900">{t('creditGrant.confirmTitle')}</h4>
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t('creditGrant.currentPeriodNote')}
          </p>
          <dl className="grid grid-cols-1 gap-2 text-sm text-gray-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-gray-500">{t('creditGrant.targetUser')}</dt>
              <dd className="break-all text-right" data-testid="admin-credit-grant-confirm-target-user">
                {targetUserEmail}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-500">{t('creditGrant.amount')}</dt>
              <dd data-testid="admin-credit-grant-confirm-amount">{draft.amount}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-gray-500">{t('creditGrant.reason')}</dt>
              <dd className="break-all text-right" data-testid="admin-credit-grant-confirm-reason">
                {draft.reason}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-500">{t('creditGrant.balanceBefore')}</dt>
              <dd data-testid="admin-credit-grant-confirm-balance-before">{creditBalance.balance}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-500">{t('creditGrant.projectedBalance')}</dt>
              <dd data-testid="admin-credit-grant-confirm-projected-balance">{projectedBalance}</dd>
            </div>
          </dl>
          <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            {t('creditGrant.projectedBalanceNote')}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void submitAttempt()}
              className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black sm:w-auto"
              data-testid="admin-credit-grant-confirm-submit"
            >
              {t('creditGrant.confirm')}
            </button>
            <button
              type="button"
              onClick={() => setPhase('form')}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 sm:w-auto"
              data-testid="admin-credit-grant-confirm-cancel"
            >
              {t('creditGrant.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'submitting' ? (
        <p className="mt-3 inline-flex items-center gap-1 text-sm text-gray-700" data-testid="admin-credit-grant-submitting">
          <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t('creditGrant.submitting')}
        </p>
      ) : null}

      {phase === 'result' && result ? (
        <div className="mt-3 space-y-3" data-testid="admin-credit-grant-result">
          {result.kind === 'granted' ? (
            <p className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
              {t('creditGrant.granted')}
            </p>
          ) : null}

          {result.kind === 'duplicate' ? (
            <p className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              <InformationCircleIcon className="h-4 w-4" aria-hidden="true" />
              {t('creditGrant.duplicate')}
            </p>
          ) : null}

          {result.kind === 'failed' ? (
            <p className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <ExclamationTriangleIcon className="h-4 w-4" aria-hidden="true" />
              {t('creditGrant.failed')}
            </p>
          ) : null}

          {result.kind === 'error' ? (
            <p className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <ExclamationTriangleIcon className="h-4 w-4" aria-hidden="true" />
              {t(`creditGrant.${result.errorKey}`)}
            </p>
          ) : null}

          {result.kind !== 'error' ? (
            <dl className="grid grid-cols-1 gap-2 text-sm text-gray-700">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-500">{t('creditGrant.amount')}</dt>
                <dd data-testid="admin-credit-grant-result-amount">{result.response.amount}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-500">{t('creditGrant.balanceBefore')}</dt>
                <dd data-testid="admin-credit-grant-result-balance-before">{result.response.balanceBefore}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-500">{t('creditGrant.balanceAfter')}</dt>
                <dd data-testid="admin-credit-grant-result-balance-after">{result.response.balanceAfter}</dd>
              </div>
            </dl>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            {result.kind === 'error' && result.canRetry ? (
              <button
                type="button"
                onClick={() => void submitAttempt()}
                className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black sm:w-auto"
                data-testid="admin-credit-grant-retry"
              >
                {t('creditGrant.retry')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartNewAttempt}
                className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black sm:w-auto"
                data-testid="admin-credit-grant-new-attempt"
              >
                {t('creditGrant.addCredits')}
              </button>
            )}

            <button
              type="button"
              onClick={closePanel}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 sm:w-auto"
              data-testid="admin-credit-grant-close"
            >
              {t('creditGrant.cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
