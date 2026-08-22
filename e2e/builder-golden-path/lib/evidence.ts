export class EvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvidenceError';
  }
}

export interface CheckpointEvidence {
  commitHash: string | null;
  filesChanged: number;
  description?: string | null;
}

export interface DeductionEvidence {
  deductionCount: number;
  tokensUsed: number;
  creditsDeducted: number;
  overflowCredits?: number;
}

export interface BalanceEvidence {
  balanceBefore: number;
  balanceAfter: number;
  appliedCredits: number;
}

export function validateCheckpoint(checkpoint: CheckpointEvidence): void {
  if (!checkpoint.commitHash || !checkpoint.commitHash.trim()) {
    throw new EvidenceError('Automatic checkpoint hash must be non-null.');
  }
  if (checkpoint.filesChanged < 1) {
    throw new EvidenceError(
      `Automatic checkpoint filesChanged=${checkpoint.filesChanged}, expected >= 1.`,
    );
  }
}

export function validateDeduction(input: DeductionEvidence): void {
  if (input.deductionCount !== 1) {
    throw new EvidenceError(
      `Deduction count=${input.deductionCount}, expected exactly 1 for executionId.`,
    );
  }
  if (input.tokensUsed <= 0) {
    throw new EvidenceError(`tokens_used=${input.tokensUsed} is not a positive actual usage value.`);
  }
  if (input.creditsDeducted !== input.tokensUsed) {
    throw new EvidenceError(
      `1:1 contract mismatch: creditsDeducted=${input.creditsDeducted} tokens_used=${input.tokensUsed}.`,
    );
  }
  if ((input.overflowCredits ?? 0) !== 0) {
    throw new EvidenceError(
      `overflow_credits=${input.overflowCredits} — golden path requires a clean unclamped deduction.`,
    );
  }
}

export function expectedBalanceAfter(balanceBefore: number, appliedCredits: number): number {
  return balanceBefore - appliedCredits;
}

export function validateBalanceArithmetic(input: BalanceEvidence): void {
  const expected = expectedBalanceAfter(input.balanceBefore, input.appliedCredits);
  if (input.balanceAfter !== expected) {
    throw new EvidenceError(
      `BALANCE_AFTER mismatch: expected ${expected} (BALANCE_BEFORE ${input.balanceBefore} - APPLIED_CREDITS ${input.appliedCredits}), received ${input.balanceAfter}.`,
    );
  }
}

export function countDeductionRowsForExecution(
  psqlOutput: string,
  executionId: string,
): number {
  const lines = psqlOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes(executionId));
  return lines.length;
}

export function pickAutomaticCheckpoint(
  checkpoints: CheckpointEvidence[],
): CheckpointEvidence | undefined {
  return checkpoints.find((checkpoint) => {
    const description = (checkpoint.description ?? '').toLowerCase();
    const hash = (checkpoint.commitHash ?? '').trim();
    return (
      description.includes('applied workspace file actions') &&
      hash.length > 0 &&
      checkpoint.filesChanged >= 1
    );
  });
}
