import { answerHandoffIdempotencyKey } from './handoff-request';
import {
  collaborationTestsGate,
  findProducingWriterReferral,
  testsGateForHandoff,
  TESTS_NOT_PASSED_CODE,
  type CollaborationTestsGateReferral,
} from './collaboration-tests-gate';

function referral(
  overrides: Partial<CollaborationTestsGateReferral> &
    Pick<CollaborationTestsGateReferral, 'referralId' | 'referralTraceId'>,
): CollaborationTestsGateReferral {
  return {
    parentReferralTraceId: null,
    idempotencyKey: `key:${overrides.referralId}`,
    sourceProfileId: 'lead',
    targetProfileId: 'writer',
    ...overrides,
  };
}

describe('collaborationTestsGate', () => {
  const writerToReviewer = {
    sourceProfileId: 'writer',
    targetProfileId: 'reviewer',
  };

  it('blocks when the latest run failed, including after an earlier pass', () => {
    expect(
      collaborationTestsGate({
        ...writerToReviewer,
        changedPaths: ['src/form.ts'],
        tests: [
          { passed: true },
          { passed: false },
        ],
      }),
    ).toEqual({ testsGate: 'blocked', testsBlockReason: 'failed' });
  });

  it('blocks when the writer changed files and no run is recorded', () => {
    expect(
      collaborationTestsGate({
        ...writerToReviewer,
        changedPaths: ['src/form.ts'],
        tests: [],
      }),
    ).toEqual({ testsGate: 'blocked', testsBlockReason: 'none' });
  });

  it('passes when the latest run passed', () => {
    expect(
      collaborationTestsGate({
        ...writerToReviewer,
        changedPaths: ['src/form.ts'],
        tests: [
          { passed: false },
          { passed: true },
        ],
      }),
    ).toEqual({ testsGate: 'passed', testsBlockReason: null });
  });

  it('does not require a gate when no files changed or the hand-off is not writer to reviewer', () => {
    expect(
      collaborationTestsGate({
        ...writerToReviewer,
        changedPaths: [],
        tests: [{ passed: false }],
      }),
    ).toEqual({ testsGate: 'not_required', testsBlockReason: null });
    expect(
      collaborationTestsGate({
        sourceProfileId: 'lead',
        targetProfileId: 'writer',
        changedPaths: ['src/form.ts'],
        tests: [],
      }),
    ).toEqual({ testsGate: 'not_required', testsBlockReason: null });
    expect(
      collaborationTestsGate({
        sourceProfileId: 'reviewer',
        targetProfileId: 'writer',
        changedPaths: ['src/form.ts'],
        tests: [{ passed: false }],
      }),
    ).toEqual({ testsGate: 'not_required', testsBlockReason: null });
    expect(TESTS_NOT_PASSED_CODE).toBe('TESTS_NOT_PASSED');
  });
});

describe('findProducingWriterReferral', () => {
  it('uses the writer whose answer created the hand-off, ahead of an older parent', () => {
    const earlier = referral({
      referralId: 'writer-earlier',
      referralTraceId: 'trace-earlier',
      targetProfileId: 'writer',
    });
    const producer = referral({
      referralId: 'writer-producer',
      referralTraceId: 'trace-producer',
      parentReferralTraceId: 'trace-earlier',
      targetProfileId: 'writer',
    });
    const other = referral({
      referralId: 'writer-other',
      referralTraceId: 'trace-other',
      targetProfileId: 'writer',
    });
    const handoff = referral({
      referralId: 'review-1',
      referralTraceId: 'trace-review',
      parentReferralTraceId: 'trace-other',
      idempotencyKey: answerHandoffIdempotencyKey('writer-producer'),
      sourceProfileId: 'writer',
      targetProfileId: 'reviewer',
    });

    expect(findProducingWriterReferral(handoff, [earlier, producer, other, handoff])?.referralId).toBe(
      'writer-producer',
    );
  });

  it('walks parentReferralTraceId to the nearest writer when the answer key is absent', () => {
    const earlier = referral({
      referralId: 'writer-earlier',
      referralTraceId: 'trace-earlier',
      targetProfileId: 'writer',
    });
    const middle = referral({
      referralId: 'lead-middle',
      referralTraceId: 'trace-middle',
      parentReferralTraceId: 'trace-earlier',
      sourceProfileId: 'writer',
      targetProfileId: 'lead',
    });
    const producer = referral({
      referralId: 'writer-producer',
      referralTraceId: 'trace-producer',
      parentReferralTraceId: 'trace-middle',
      targetProfileId: 'writer',
    });
    const handoff = referral({
      referralId: 'review-1',
      referralTraceId: 'trace-review',
      parentReferralTraceId: 'trace-producer',
      idempotencyKey: 'not-an-answer-key',
      sourceProfileId: 'writer',
      targetProfileId: 'reviewer',
    });

    expect(findProducingWriterReferral(handoff, [earlier, middle, producer, handoff])?.referralId).toBe(
      'writer-producer',
    );

    const work = new Map([
      ['writer-earlier', { changedPaths: ['old.ts'], tests: [{ passed: false }] }],
      ['writer-producer', { changedPaths: ['src/form.ts'], tests: [{ passed: false }] }],
    ]);
    expect(testsGateForHandoff(handoff, [earlier, middle, producer, handoff], (id) => work.get(id))).toEqual({
      testsGate: 'blocked',
      testsBlockReason: 'failed',
    });
  });

  it('blocks when the writer step cannot be found', () => {
    const handoff = referral({
      referralId: 'review-1',
      referralTraceId: 'trace-review',
      parentReferralTraceId: 'trace-missing',
      idempotencyKey: 'not-an-answer-key',
      sourceProfileId: 'writer',
      targetProfileId: 'reviewer',
    });
    expect(testsGateForHandoff(handoff, [handoff], () => ({ changedPaths: [], tests: [] }))).toEqual({
      testsGate: 'blocked',
      testsBlockReason: 'none',
    });
  });

  it('blocks when the writer step has no work record', () => {
    const writer = referral({
      referralId: 'writer-1',
      referralTraceId: 'trace-writer',
      targetProfileId: 'writer',
    });
    const handoff = referral({
      referralId: 'review-1',
      referralTraceId: 'trace-review',
      parentReferralTraceId: 'trace-writer',
      idempotencyKey: 'not-an-answer-key',
      sourceProfileId: 'writer',
      targetProfileId: 'reviewer',
    });
    expect(testsGateForHandoff(handoff, [writer, handoff], () => undefined)).toEqual({
      testsGate: 'blocked',
      testsBlockReason: 'none',
    });
  });

  it('does not require a gate when the work record exists and no files changed', () => {
    const writer = referral({
      referralId: 'writer-1',
      referralTraceId: 'trace-writer',
      targetProfileId: 'writer',
    });
    const handoff = referral({
      referralId: 'review-1',
      referralTraceId: 'trace-review',
      parentReferralTraceId: 'trace-writer',
      idempotencyKey: 'not-an-answer-key',
      sourceProfileId: 'writer',
      targetProfileId: 'reviewer',
    });
    expect(
      testsGateForHandoff(handoff, [writer, handoff], () => ({
        changedPaths: [],
        tests: [{ passed: false }],
      })),
    ).toEqual({ testsGate: 'not_required', testsBlockReason: null });
  });
});
