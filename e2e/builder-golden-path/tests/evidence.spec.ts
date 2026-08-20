import { test, expect } from '@playwright/test';
import {
  EvidenceError,
  countDeductionRowsForExecution,
  expectedBalanceAfter,
  pickAutomaticCheckpoint,
  validateBalanceArithmetic,
  validateCheckpoint,
  validateDeduction,
} from '../lib/evidence';
import { assertPreviewHtml, PreviewAssertionError } from '../lib/preview';
import { FROZEN_HTML, PREVIEW_HEADING } from '../lib/constants';

test.describe('evidence and preview helpers', () => {
  test('balance arithmetic is BALANCE_AFTER = BALANCE_BEFORE - APPLIED_CREDITS', () => {
    expect(expectedBalanceAfter(30577, 1178)).toBe(29399);
    expect(() =>
      validateBalanceArithmetic({
        balanceBefore: 30577,
        appliedCredits: 1178,
        balanceAfter: 29399,
      }),
    ).not.toThrow();
    expect(() =>
      validateBalanceArithmetic({
        balanceBefore: 30577,
        appliedCredits: 1178,
        balanceAfter: 3278,
      }),
    ).toThrow(EvidenceError);
  });

  test('checkpoint and exactly-one deduction contracts', () => {
    expect(() =>
      validateCheckpoint({ commitHash: '3373a244d2ab43a9a76113fc356b25b94adf5abc', filesChanged: 1 }),
    ).not.toThrow();
    expect(() => validateCheckpoint({ commitHash: null, filesChanged: 1 })).toThrow(EvidenceError);
    expect(() =>
      validateDeduction({ deductionCount: 1, tokensUsed: 1178, creditsDeducted: 1178 }),
    ).not.toThrow();
    expect(() =>
      validateDeduction({ deductionCount: 2, tokensUsed: 1178, creditsDeducted: 1178 }),
    ).toThrow(/exactly 1/);
    expect(
      countDeductionRowsForExecution(
        'source_event_id | applied_credits\n d3b8409f-18c8-42e4-a9fc-e8fcb7574494 | 1178\n(1 row)',
        'd3b8409f-18c8-42e4-a9fc-e8fcb7574494',
      ),
    ).toBe(1);
    const picked = pickAutomaticCheckpoint([
      {
        commitHash: '3373a244d2ab43a9a76113fc356b25b94adf5abc',
        filesChanged: 1,
        description: 'AI: applied workspace file actions',
      },
    ]);
    expect(picked.commitHash).toBeTruthy();
  });

  test('preview helper asserts frozen heading and paragraph', () => {
    expect(() => assertPreviewHtml(FROZEN_HTML)).not.toThrow();
    expect(() => assertPreviewHtml('<html><body>nope</body></html>')).toThrow(
      PreviewAssertionError,
    );
    expect(FROZEN_HTML).toContain(PREVIEW_HEADING);
  });
});
