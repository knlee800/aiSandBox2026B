import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  AUTOSAVE_MIN_INTERVAL_MS,
  shouldAllowAutosaveNow,
} from './autosave-rate-limit';

describe('autosave-rate-limit', () => {
  test('returns true when no prior snapshot timestamp exists', () => {
    assert.equal(
      shouldAllowAutosaveNow({
        now: 60_000,
        lastSnapshotAt: null,
      }),
      true,
    );
  });

  test('returns false when elapsed time is less than the default interval', () => {
    assert.equal(
      shouldAllowAutosaveNow({
        now: AUTOSAVE_MIN_INTERVAL_MS - 1,
        lastSnapshotAt: 0,
      }),
      false,
    );
  });

  test('returns true when elapsed time is exactly the default interval boundary', () => {
    assert.equal(
      shouldAllowAutosaveNow({
        now: AUTOSAVE_MIN_INTERVAL_MS,
        lastSnapshotAt: 0,
      }),
      true,
    );
  });

  test('returns true when elapsed time is greater than the default interval', () => {
    assert.equal(
      shouldAllowAutosaveNow({
        now: AUTOSAVE_MIN_INTERVAL_MS + 1,
        lastSnapshotAt: 0,
      }),
      true,
    );
  });

  test('respects a custom interval override', () => {
    assert.equal(
      shouldAllowAutosaveNow({
        now: 2_999,
        lastSnapshotAt: 0,
        minIntervalMs: 3_000,
      }),
      false,
    );
    assert.equal(
      shouldAllowAutosaveNow({
        now: 3_000,
        lastSnapshotAt: 0,
        minIntervalMs: 3_000,
      }),
      true,
    );
  });

  test('treats a zero interval as immediately eligible when a prior timestamp exists', () => {
    assert.equal(
      shouldAllowAutosaveNow({
        now: 10,
        lastSnapshotAt: 10,
        minIntervalMs: 0,
      }),
      true,
    );
  });

  test('treats a negative interval as immediately eligible under the raw comparison contract', () => {
    assert.equal(
      shouldAllowAutosaveNow({
        now: 10,
        lastSnapshotAt: 10,
        minIntervalMs: -1,
      }),
      true,
    );
  });

  test('returns false for clock-skew cases where now is earlier than the last snapshot timestamp', () => {
    assert.equal(
      shouldAllowAutosaveNow({
        now: 999,
        lastSnapshotAt: 1_000,
      }),
      false,
    );
  });

  test('is deterministic for identical inputs', () => {
    const args = {
      now: 15_000,
      lastSnapshotAt: 5_000,
      minIntervalMs: 10_000,
    };

    assert.equal(shouldAllowAutosaveNow(args), true);
    assert.equal(shouldAllowAutosaveNow(args), true);
  });
});
