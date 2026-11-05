import { answerHandoffIdempotencyKey } from './handoff-request';
import {
  COLLABORATION_REVIEWER_PROFILE_ID,
  COLLABORATION_WRITER_PROFILE_ID,
} from './collaboration-team';

export const TESTS_NOT_PASSED_CODE = 'TESTS_NOT_PASSED';

export const TESTS_NOT_PASSED_MESSAGES = {
  failed: 'The latest validation run did not pass.',
  none: 'No validation run has passed.',
} as const;

export type CollaborationTestsGate = 'passed' | 'not_required' | 'blocked';

export type CollaborationTestsBlockReason = 'failed' | 'none';

export interface CollaborationTestsGateResult {
  readonly testsGate: CollaborationTestsGate;
  readonly testsBlockReason: CollaborationTestsBlockReason | null;
}

export interface CollaborationTestsGateReferral {
  readonly referralId: string;
  readonly referralTraceId: string;
  readonly parentReferralTraceId: string | null;
  readonly idempotencyKey: string;
  readonly sourceProfileId: string;
  readonly targetProfileId: string;
}

export interface CollaborationTestsGateWork {
  readonly changedPaths: readonly string[];
  readonly tests: readonly { readonly passed: boolean }[];
}

const NOT_REQUIRED: CollaborationTestsGateResult = {
  testsGate: 'not_required',
  testsBlockReason: null,
};

export function toTestsGateReferral(referral: {
  referralId: string;
  referralTraceId: string;
  parentReferralTraceId: string | null;
  idempotencyKey: string;
  sourceBuilder: { builderProfileId: string };
  targetBuilder: { builderProfileId: string };
}): CollaborationTestsGateReferral {
  return {
    referralId: referral.referralId,
    referralTraceId: referral.referralTraceId,
    parentReferralTraceId: referral.parentReferralTraceId,
    idempotencyKey: referral.idempotencyKey,
    sourceProfileId: referral.sourceBuilder.builderProfileId,
    targetProfileId: referral.targetBuilder.builderProfileId,
  };
}

/**
 * Writer step whose answer created this hand-off.
 * Prefer the referral whose idempotency key is answer-handoff:<that step>.
 * Otherwise walk parentReferralTraceId and take the nearest ancestor whose target is the writer.
 */
export function findProducingWriterReferral(
  handoff: CollaborationTestsGateReferral,
  referrals: readonly CollaborationTestsGateReferral[],
): CollaborationTestsGateReferral | null {
  const producedByAnswer = referrals.find(
    (referral) =>
      referral.targetProfileId === COLLABORATION_WRITER_PROFILE_ID &&
      answerHandoffIdempotencyKey(referral.referralId) === handoff.idempotencyKey,
  );
  if (producedByAnswer) {
    return producedByAnswer;
  }

  const byTrace = new Map(referrals.map((referral) => [referral.referralTraceId, referral]));
  let parentTrace = handoff.parentReferralTraceId;
  const seen = new Set<string>();
  while (parentTrace && !seen.has(parentTrace)) {
    seen.add(parentTrace);
    const parent = byTrace.get(parentTrace);
    if (!parent) {
      return null;
    }
    if (parent.targetProfileId === COLLABORATION_WRITER_PROFILE_ID) {
      return parent;
    }
    parentTrace = parent.parentReferralTraceId;
  }
  return null;
}

export function collaborationTestsGate(input: {
  sourceProfileId: string;
  targetProfileId: string;
  changedPaths: readonly string[];
  tests: readonly { readonly passed: boolean }[];
}): CollaborationTestsGateResult {
  if (
    input.sourceProfileId !== COLLABORATION_WRITER_PROFILE_ID ||
    input.targetProfileId !== COLLABORATION_REVIEWER_PROFILE_ID
  ) {
    return NOT_REQUIRED;
  }
  if (input.changedPaths.length === 0) {
    return NOT_REQUIRED;
  }
  const latest = input.tests[input.tests.length - 1];
  if (!latest) {
    return { testsGate: 'blocked', testsBlockReason: 'none' };
  }
  if (latest.passed) {
    return { testsGate: 'passed', testsBlockReason: null };
  }
  return { testsGate: 'blocked', testsBlockReason: 'failed' };
}

export function testsGateForHandoff(
  handoff: CollaborationTestsGateReferral,
  referrals: readonly CollaborationTestsGateReferral[],
  workFor: (referralId: string) => CollaborationTestsGateWork | undefined,
): CollaborationTestsGateResult {
  if (
    handoff.sourceProfileId !== COLLABORATION_WRITER_PROFILE_ID ||
    handoff.targetProfileId !== COLLABORATION_REVIEWER_PROFILE_ID
  ) {
    return NOT_REQUIRED;
  }
  const writer = findProducingWriterReferral(handoff, referrals);
  if (!writer) {
    return { testsGate: 'blocked', testsBlockReason: 'none' };
  }
  const work = workFor(writer.referralId);
  if (!work) {
    return { testsGate: 'blocked', testsBlockReason: 'none' };
  }
  return collaborationTestsGate({
    sourceProfileId: handoff.sourceProfileId,
    targetProfileId: handoff.targetProfileId,
    changedPaths: work.changedPaths,
    tests: work.tests,
  });
}
