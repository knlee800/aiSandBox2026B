import { test, expect } from '@playwright/test';
import {
  GOLDEN_PATH_PHASES,
  PhaseOrderError,
  assertPhaseOrder,
  containsManualApply,
  isPreviewBeforeSlowEvidence,
  isPreviewImmediatelyAfterAutoApply,
} from '../lib/phases';

test.describe('golden-path phase order', () => {
  test('PREVIEW is immediately after WAIT_FOR_AUTO_APPLY', () => {
    expect(isPreviewImmediatelyAfterAutoApply(GOLDEN_PATH_PHASES)).toBe(true);
    expect(GOLDEN_PATH_PHASES.indexOf('PREVIEW')).toBe(
      GOLDEN_PATH_PHASES.indexOf('WAIT_FOR_AUTO_APPLY') + 1,
    );
  });

  test('Preview happens before slow evidence phases', () => {
    expect(isPreviewBeforeSlowEvidence(GOLDEN_PATH_PHASES)).toBe(true);
    const previewAt = GOLDEN_PATH_PHASES.indexOf('PREVIEW');
    expect(GOLDEN_PATH_PHASES.indexOf('CHECKPOINT')).toBeGreaterThan(previewAt);
    expect(GOLDEN_PATH_PHASES.indexOf('PUBLIC_CONFIRM')).toBeGreaterThan(previewAt);
    expect(GOLDEN_PATH_PHASES.indexOf('DEDUCTION')).toBeGreaterThan(previewAt);
    expect(GOLDEN_PATH_PHASES.indexOf('BALANCE')).toBeGreaterThan(previewAt);
  });

  test('auto-apply has no manual Apply phase', () => {
    expect(containsManualApply(GOLDEN_PATH_PHASES)).toBe(false);
    expect(() => assertPhaseOrder(GOLDEN_PATH_PHASES)).not.toThrow();
    expect(() =>
      assertPhaseOrder([...GOLDEN_PATH_PHASES.slice(0, 8), 'MANUAL_APPLY', ...GOLDEN_PATH_PHASES.slice(8)]),
    ).toThrow(PhaseOrderError);
  });

  test('pre-session phases complete before CREATE_SESSION', () => {
    const createAt = GOLDEN_PATH_PHASES.indexOf('CREATE_SESSION');
    expect(GOLDEN_PATH_PHASES.indexOf('PREPARE_BROWSER')).toBeLessThan(createAt);
    expect(GOLDEN_PATH_PHASES.indexOf('AUTH')).toBeLessThan(createAt);
    expect(GOLDEN_PATH_PHASES.indexOf('SAFETY')).toBeLessThan(createAt);
    expect(GOLDEN_PATH_PHASES.indexOf('STARTING_BALANCE')).toBeLessThan(createAt);
    expect(GOLDEN_PATH_PHASES.indexOf('ARM_LISTENERS')).toBeLessThan(createAt);
  });
});
