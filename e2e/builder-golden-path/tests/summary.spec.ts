import { test, expect } from '@playwright/test';
import { formatFailSummary, formatPassSummary, isConcisePassSummary } from '../lib/summary';
import {
  RETAINED_STASH_SHA,
  StagingHelper,
  StagingNotAuthorizedError,
  evaluateParity,
} from '../lib/staging';

test.describe('summary and staging helpers', () => {
  test('PASS summary is concise', () => {
    const formatted = formatPassSummary({
      verdict: 'PASS',
      projectId: 'project-1',
      sessionId: 'session-1',
      executionId: 'exec-1',
      provider: 'xai',
      model: 'grok-4.5',
      tokensUsed: 1178,
      autoApply: 'YES',
      preview: 'PASS',
      checkpointHash: 'abc123',
      confirmStatus: 200,
      confirmTriggered: true,
      deductionCount: 1,
      creditsDeducted: 1178,
      balanceBefore: 30577,
      balanceAfter: 29399,
      cleanup: 'session-stopped',
      executionGateFinal: 'restored-false',
    });
    expect(isConcisePassSummary(formatted)).toBe(true);
    expect(formatted).toContain('verdict=PASS');
    expect(formatted).not.toMatch(/pm2 logs/i);
  });

  test('FAIL summary is targeted to phase, error, and IDs', () => {
    const formatted = formatFailSummary({
      verdict: 'FAIL',
      phase: 'PREVIEW',
      error: 'Preview heading mismatch',
      projectId: 'project-1',
      sessionId: 'session-1',
      executionId: 'exec-1',
      cleanup: 'session-stopped',
      executionGateFinal: 'restored-false',
      evidence: { screenshot: 'preview-heading-mismatch.png' },
    });
    expect(formatted).toContain('verdict=FAIL');
    expect(formatted).toContain('phase=PREVIEW');
    expect(formatted).toContain('error=Preview heading mismatch');
    expect(formatted).toContain('sessionId=session-1');
    expect(formatted.split('\n').length).toBeLessThan(20);
  });

  test('staging helper stays inert in CONTRACT mode and refuses unsafe parity', async () => {
    const helper = new StagingHelper({ env: { E2E_MODE: 'contract' } });
    await expect(helper.inspectParity('abc123')).rejects.toBeInstanceOf(StagingNotAuthorizedError);
    const expectedHead = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    expect(
      evaluateParity({
        headSha: expectedHead,
        worktreeClean: true,
        stashSha: RETAINED_STASH_SHA,
        requiredHeadSha: expectedHead,
      }),
    ).toBe('PARITY_PROVEN');
    expect(
      evaluateParity({
        headSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        worktreeClean: true,
        stashSha: RETAINED_STASH_SHA,
        requiredHeadSha: expectedHead,
      }),
    ).toBe('UNSAFE_PARITY');
  });
});
