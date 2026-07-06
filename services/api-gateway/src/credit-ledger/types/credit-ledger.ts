import type { CreditCategory } from './credit-category';

/**
 * Conceptual credit amount in ledger units.
 */
export type CreditAmount = number;

/**
 * Conceptual resulting balance in ledger units.
 */
export type CreditBalance = number;

export type CreditLedgerEntryType =
  | 'allocation'
  | 'deduction'
  | 'adjustment'
  | 'expiration'
  | 'reversal';

export type CreditLedgerEntryStatus = 'pending' | 'posted' | 'voided';

/**
 * Conceptual ledger entry shape.
 * This is a domain model only (not a persistence entity).
 */
export interface CreditLedgerEntry {
  entryId: string;
  userId: string;
  category: CreditCategory;
  entryType: CreditLedgerEntryType;
  status: CreditLedgerEntryStatus;
  creditsDelta: CreditAmount;
  unitCount: number;
  unit: string;
  description: string;
  occurredAt: Date;
  metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Conceptual billing cycle shape.
 * This is a domain model only (not a persistence entity).
 */
export interface BillingCycle {
  cycleId: string;
  userId: string;
  planId: string;
  startsAt: Date;
  endsAt: Date;
  allocatedCredits: CreditAmount;
  consumedCredits: CreditAmount;
  remainingCredits: CreditBalance;
  rolloverCredits: CreditAmount;
}
