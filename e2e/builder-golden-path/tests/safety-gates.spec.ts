import { test, expect } from '@playwright/test';
import {
  ExecutionGateTracker,
  ProviderCallGuard,
  ProviderRetryError,
  SessionHeadroomError,
  assertSafeHeadroomBeforeProvider,
  createProviderCallGuardFromEnv,
} from '../lib/safety-gates';
import { createRecordingAdapters, runGoldenPath } from '../lib/runner';

test.describe('safety gates', () => {
  test('no provider retry after the single authorized call', () => {
    const guard = new ProviderCallGuard(1);
    expect(() => new ProviderCallGuard(2)).toThrow(/exactly 1/);
    expect(() => createProviderCallGuardFromEnv('2')).toThrow(/exactly 1/);
    guard.authorizeCall();
    expect(guard.usedCount).toBe(1);
    expect(() => guard.authorizeCall()).toThrow(ProviderRetryError);
  });

  test('fails before provider execution when session headroom is unsafe', () => {
    expect(() =>
      assertSafeHeadroomBeforeProvider({
        sessionCreatedAt: 0,
        now: 1_300_000,
        idleTimeoutMs: 1_800_000,
        safeMinimumHeadroomMs: 600_000,
      }),
    ).toThrow(SessionHeadroomError);
    expect(
      assertSafeHeadroomBeforeProvider({
        sessionCreatedAt: 0,
        now: 10_000,
        idleTimeoutMs: 1_800_000,
        safeMinimumHeadroomMs: 600_000,
      }),
    ).toBeGreaterThan(600_000);
  });

  test('cleanup and gate restoration are finally-style on PASS and FAIL', async () => {
    const pass = createRecordingAdapters({ enableGate: true });
    const passResult = await runGoldenPath({
      mode: 'contract',
      adapters: pass.adapters,
      gateTracker: pass.gateTracker,
    });
    expect(passResult.summary.verdict).toBe('PASS');
    expect(pass.calls.at(-1)).toBe('CLEANUP');
    if (passResult.summary.verdict === 'PASS') {
      expect(passResult.summary.executionGateFinal).toBe('restored-false');
    }

    const fail = createRecordingAdapters({ failAt: 'PREVIEW', enableGate: true });
    const failResult = await runGoldenPath({
      mode: 'contract',
      adapters: fail.adapters,
      gateTracker: fail.gateTracker,
    });
    expect(failResult.summary.verdict).toBe('FAIL');
    if (failResult.summary.verdict === 'FAIL') {
      expect(failResult.summary.phase).toBe('PREVIEW');
      expect(failResult.summary.cleanup).toBe('session-stopped');
      expect(failResult.summary.executionGateFinal).toBe('restored-false');
    }
    expect(fail.calls).toContain('CLEANUP');
    expect(fail.calls).not.toContain('CHECKPOINT');
    expect(fail.calls.indexOf('CLEANUP')).toBe(fail.calls.length - 1);

    const unchanged = new ExecutionGateTracker();
    expect(unchanged.describeRestore(null)).toBe('not-attempted-no-authority');
    unchanged.recordAuthorityWithoutChange();
    expect(unchanged.describeRestore(null)).toBe('not-changed-by-runner');
  });
});
