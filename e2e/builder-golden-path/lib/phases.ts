export const GOLDEN_PATH_PHASES = [
  'PREPARE_BROWSER',
  'AUTH',
  'SAFETY',
  'STARTING_BALANCE',
  'ARM_LISTENERS',
  'CREATE_SESSION',
  'BUILD',
  'WAIT_FOR_AUTO_APPLY',
  'PREVIEW',
  'CHECKPOINT',
  'PUBLIC_CONFIRM',
  'DEDUCTION',
  'BALANCE',
  'CLEANUP',
] as const;

export type GoldenPathPhase = (typeof GOLDEN_PATH_PHASES)[number];

export const PRE_SESSION_PHASES = [
  'PREPARE_BROWSER',
  'AUTH',
  'SAFETY',
  'STARTING_BALANCE',
  'ARM_LISTENERS',
] as const satisfies readonly GoldenPathPhase[];

export const SLOW_EVIDENCE_PHASES = [
  'CHECKPOINT',
  'PUBLIC_CONFIRM',
  'DEDUCTION',
  'BALANCE',
] as const satisfies readonly GoldenPathPhase[];

export const FORBIDDEN_PHASES = ['MANUAL_APPLY'] as const;

export class PhaseOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhaseOrderError';
  }
}

export function isGoldenPathPhase(value: string): value is GoldenPathPhase {
  return (GOLDEN_PATH_PHASES as readonly string[]).includes(value);
}

export function previewIndex(phases: readonly string[]): number {
  return phases.indexOf('PREVIEW');
}

export function autoApplyIndex(phases: readonly string[]): number {
  return phases.indexOf('WAIT_FOR_AUTO_APPLY');
}

export function isPreviewImmediatelyAfterAutoApply(phases: readonly string[]): boolean {
  const applyAt = autoApplyIndex(phases);
  const previewAt = previewIndex(phases);
  return applyAt >= 0 && previewAt === applyAt + 1;
}

export function isPreviewBeforeSlowEvidence(phases: readonly string[]): boolean {
  const previewAt = previewIndex(phases);
  if (previewAt < 0) {
    return false;
  }
  return SLOW_EVIDENCE_PHASES.every((phase) => {
    const index = phases.indexOf(phase);
    return index === -1 || index > previewAt;
  });
}

export function containsManualApply(phases: readonly string[]): boolean {
  return phases.includes('MANUAL_APPLY');
}

export function assertPhaseOrder(phases: readonly string[]): void {
  if (containsManualApply(phases)) {
    throw new PhaseOrderError(
      'Golden path forbids a MANUAL_APPLY phase. Non-risky one-file Builder flow is AUTO_APPLY.',
    );
  }

  const expected = GOLDEN_PATH_PHASES as readonly string[];
  for (let i = 0; i < expected.length; i += 1) {
    if (phases[i] !== expected[i]) {
      throw new PhaseOrderError(
        `Phase order mismatch at index ${i}: expected ${expected[i]}, received ${phases[i] ?? '<missing>'}.`,
      );
    }
  }

  if (phases.length !== expected.length) {
    throw new PhaseOrderError(
      `Phase list length ${phases.length} does not match required ${expected.length}.`,
    );
  }

  if (!isPreviewImmediatelyAfterAutoApply(phases)) {
    throw new PhaseOrderError('PREVIEW must occur immediately after WAIT_FOR_AUTO_APPLY.');
  }

  if (!isPreviewBeforeSlowEvidence(phases)) {
    throw new PhaseOrderError(
      'PREVIEW must occur before slow evidence phases (CHECKPOINT, PUBLIC_CONFIRM, DEDUCTION, BALANCE).',
    );
  }

  for (const phase of PRE_SESSION_PHASES) {
    if (phases.indexOf(phase) >= phases.indexOf('CREATE_SESSION')) {
      throw new PhaseOrderError(`${phase} must complete before CREATE_SESSION.`);
    }
  }
}

export function nextRequiredPhase(
  completed: readonly string[],
): GoldenPathPhase | undefined {
  return GOLDEN_PATH_PHASES[completed.length];
}
