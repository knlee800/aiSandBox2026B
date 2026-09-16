export interface CreditBalanceGuidanceCopies {
  exhausted: string;
  notProvisioned: string;
  paymentRequired: string;
}

export interface CreditBalanceGuidanceInput {
  statusCode?: number;
  payload?: unknown;
  copies: CreditBalanceGuidanceCopies;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, unknown>;
}

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readCreditBalanceErrorCode(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) {
    return null;
  }

  const details = asRecord(root.details);
  const nestedCode = details ? readTrimmedString(details.error_code) : null;
  if (nestedCode) {
    return nestedCode;
  }

  return readTrimmedString(root.error_code);
}

export function readCreditBalanceCurrentBalance(payload: unknown): number {
  const root = asRecord(payload);
  if (!root) {
    return 0;
  }

  const details = asRecord(root.details);
  const nestedBalance = details?.current_balance;
  if (typeof nestedBalance === 'number' && Number.isFinite(nestedBalance)) {
    return nestedBalance;
  }

  const topLevelBalance = root.current_balance;
  if (typeof topLevelBalance === 'number' && Number.isFinite(topLevelBalance)) {
    return topLevelBalance;
  }

  return 0;
}

function interpolateCount(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

export function toCreditBalanceGuidance(input: CreditBalanceGuidanceInput): string | null {
  if (input.statusCode !== 402) {
    return null;
  }

  const errorCode = readCreditBalanceErrorCode(input.payload);
  if (errorCode === 'credit_balance_exhausted') {
    return interpolateCount(
      input.copies.exhausted,
      readCreditBalanceCurrentBalance(input.payload),
    );
  }

  if (errorCode === 'credit_balance_not_provisioned') {
    return input.copies.notProvisioned;
  }

  return input.copies.paymentRequired;
}
