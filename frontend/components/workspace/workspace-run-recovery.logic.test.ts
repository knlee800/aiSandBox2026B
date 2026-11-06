import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';
import {
  appendRecoveredRunNotice,
  parsePendingRun,
  parseRunListResponse,
  pendingRunStorageKey,
  recoveredRunNeedsNotAppliedNotice,
  selectRecoverableRun,
  serializePendingRun,
  type ActiveRunRow,
  type PendingRunRecord,
} from './workspace-run-recovery.logic';

const MINUTE_MS = 60 * 1000;
const NOW = Date.parse('2026-11-02T12:00:00.000Z');
const FIFTEEN_MINUTES_MS = 15 * MINUTE_MS;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * MINUTE_MS;

function isoAt(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

function activeRun(
  executionId: string,
  mode: ActiveRunRow['mode'],
  startedAt: string | null,
): ActiveRunRow {
  return { executionId, mode, startedAt };
}

function pendingRun(
  executionId: string,
  mode: PendingRunRecord['mode'],
  startedAt: string,
): PendingRunRecord {
  return { executionId, mode, startedAt };
}

describe('workspace run recovery logic', () => {
  test('pendingRunStorageKey is stable and includes the session id', () => {
    assert.equal(pendingRunStorageKey('session-a'), 'workspace_pending_run_session-a');
    assert.equal(pendingRunStorageKey('session-b'), 'workspace_pending_run_session-b');
    assert.notEqual(pendingRunStorageKey('session-a'), pendingRunStorageKey('session-b'));
  });

  test('serializePendingRun writes executionId, mode, and startedAt', () => {
    const startedAt = isoAt(-MINUTE_MS);
    const serialized = serializePendingRun({
      executionId: 'exec-1',
      mode: 'agent',
      startedAt,
    });
    assert.deepEqual(JSON.parse(serialized), {
      executionId: 'exec-1',
      mode: 'agent',
      startedAt,
    });
  });

  test('parsePendingRun round-trips a serialized record and drops extra fields', () => {
    const startedAt = isoAt(-MINUTE_MS);
    const parsed = parsePendingRun(
      serializePendingRun({
        executionId: ' exec-1 ',
        mode: 'ask',
        startedAt,
      }),
    );
    assert.deepEqual(parsed, {
      executionId: 'exec-1',
      mode: 'ask',
      startedAt,
    });

    const withExtra = parsePendingRun(
      JSON.stringify({
        executionId: 'exec-2',
        mode: 'unknown',
        startedAt,
        extra: true,
      }),
    );
    assert.deepEqual(withExtra, {
      executionId: 'exec-2',
      mode: 'unknown',
      startedAt,
    });
  });

  test('parsePendingRun returns null for missing or invalid data', () => {
    const startedAt = isoAt(-MINUTE_MS);
    assert.equal(parsePendingRun(null), null);
    assert.equal(parsePendingRun(undefined), null);
    assert.equal(parsePendingRun(''), null);
    assert.equal(parsePendingRun('   '), null);
    assert.equal(parsePendingRun('not-json'), null);
    assert.equal(parsePendingRun('null'), null);
    assert.equal(parsePendingRun('[]'), null);
    assert.equal(parsePendingRun('42'), null);
    assert.equal(parsePendingRun('{}'), null);
    assert.equal(
      parsePendingRun(JSON.stringify({ mode: 'ask', startedAt })),
      null,
    );
    assert.equal(
      parsePendingRun(JSON.stringify({ executionId: '   ', mode: 'ask', startedAt })),
      null,
    );
    assert.equal(
      parsePendingRun(JSON.stringify({ executionId: 'exec-1', mode: 'plan', startedAt })),
      null,
    );
    assert.equal(
      parsePendingRun(JSON.stringify({ executionId: 'exec-1', mode: 'build' })),
      null,
    );
    assert.equal(
      parsePendingRun(
        JSON.stringify({ executionId: 'exec-1', mode: 'build', startedAt: 'yesterday' }),
      ),
      null,
    );
    assert.equal(
      parsePendingRun(
        JSON.stringify({ executionId: 'exec-1', mode: 'build', startedAt: '' }),
      ),
      null,
    );
  });

  test('parseRunListResponse reads run rows and ignores malformed rows', () => {
    const startedAt = '2026-11-02T07:01:02.000Z';
    assert.deepEqual(parseRunListResponse(null), []);
    assert.deepEqual(parseRunListResponse(undefined), []);
    assert.deepEqual(parseRunListResponse('runs'), []);
    assert.deepEqual(parseRunListResponse([]), []);
    assert.deepEqual(parseRunListResponse({}), []);
    assert.deepEqual(parseRunListResponse({ runs: null }), []);
    assert.deepEqual(parseRunListResponse({ runs: {} }), []);

    assert.deepEqual(
      parseRunListResponse({
        runs: [
          {
            executionId: ' exec-ok ',
            status: 'running',
            mode: 'ask',
            startedAt,
            model: 'stub-model',
          },
          { executionId: 'exec-agent', mode: 'agent' },
          { executionId: 'exec-null-start', mode: 'build', startedAt: null },
          null,
          'exec-bad',
          { mode: 'ask', startedAt },
          { executionId: '   ', mode: 'ask', startedAt },
          { executionId: 'exec-bad-mode', mode: 'plan', startedAt },
          { executionId: 'exec-bad-time', mode: 'build', startedAt: 5 },
          { executionId: 'exec-bad-time-object', mode: 'unknown', startedAt: { at: startedAt } },
        ],
      }),
      [
        { executionId: 'exec-ok', mode: 'ask', startedAt },
        { executionId: 'exec-agent', mode: 'agent', startedAt: null },
        { executionId: 'exec-null-start', mode: 'build', startedAt: null },
      ],
    );
  });

  test('selectRecoverableRun chooses the newest active run under 15 minutes', () => {
    const selected = selectRecoverableRun({
      activeRuns: [
        activeRun('older', 'ask', isoAt(-10 * MINUTE_MS)),
        activeRun('newer', 'agent', isoAt(-MINUTE_MS)),
        activeRun('stale-but-listed-last', 'build', isoAt(-16 * MINUTE_MS)),
      ],
      pendingRun: pendingRun('pending-newer', 'build', isoAt(-30 * 1000)),
      now: NOW,
    });
    assert.deepEqual(selected, { executionId: 'newer', mode: 'agent' });
  });

  test('selectRecoverableRun keeps the first active run when start times tie', () => {
    const startedAt = isoAt(-2 * MINUTE_MS);
    const selected = selectRecoverableRun({
      activeRuns: [
        activeRun('first', 'ask', startedAt),
        activeRun('second', 'build', startedAt),
      ],
      pendingRun: null,
      now: NOW,
    });
    assert.deepEqual(selected, { executionId: 'first', mode: 'ask' });
  });

  test('selectRecoverableRun rejects an active run at exactly 15 minutes and a future start', () => {
    const exactly = selectRecoverableRun({
      activeRuns: [activeRun('exact', 'build', isoAt(-FIFTEEN_MINUTES_MS))],
      pendingRun: null,
      now: NOW,
    });
    assert.equal(exactly, null);

    const justUnder = selectRecoverableRun({
      activeRuns: [activeRun('just-under', 'unknown', isoAt(-FIFTEEN_MINUTES_MS + 1))],
      pendingRun: null,
      now: NOW,
    });
    assert.deepEqual(justUnder, { executionId: 'just-under', mode: 'unknown' });

    const future = selectRecoverableRun({
      activeRuns: [activeRun('future', 'agent', isoAt(1000))],
      pendingRun: pendingRun('pending', 'ask', isoAt(-MINUTE_MS)),
      now: NOW,
    });
    assert.deepEqual(future, { executionId: 'pending', mode: 'ask' });
  });

  test('selectRecoverableRun skips an active run with an unusable start time', () => {
    const selected = selectRecoverableRun({
      activeRuns: [
        activeRun('missing', 'agent', null),
        activeRun('blank', 'build', '   '),
        activeRun('garbage', 'ask', 'not-a-time'),
        activeRun('usable', 'build', isoAt(-3 * MINUTE_MS)),
      ],
      pendingRun: null,
      now: NOW,
    });
    assert.deepEqual(selected, { executionId: 'usable', mode: 'build' });

    const onlyUnusable = selectRecoverableRun({
      activeRuns: [
        activeRun('missing', 'agent', null),
        activeRun('garbage', 'ask', 'yesterday'),
      ],
      pendingRun: pendingRun('pending', 'unknown', isoAt(-2 * 60 * MINUTE_MS)),
      now: NOW,
    });
    assert.deepEqual(onlyUnusable, { executionId: 'pending', mode: 'unknown' });
  });

  test('selectRecoverableRun uses a pending run when no active run is eligible', () => {
    const selected = selectRecoverableRun({
      activeRuns: [activeRun('stale', 'agent', isoAt(-20 * MINUTE_MS))],
      pendingRun: pendingRun('pending', 'build', isoAt(-2 * 60 * MINUTE_MS)),
      now: NOW,
    });
    assert.deepEqual(selected, { executionId: 'pending', mode: 'build' });

    assert.equal(
      selectRecoverableRun({
        activeRuns: [],
        pendingRun: null,
        now: NOW,
      }),
      null,
    );
  });

  test('selectRecoverableRun returns null for a pending run older than 24 hours', () => {
    const exactly = selectRecoverableRun({
      activeRuns: [],
      pendingRun: pendingRun('exact-day', 'ask', isoAt(-TWENTY_FOUR_HOURS_MS)),
      now: NOW,
    });
    assert.deepEqual(exactly, { executionId: 'exact-day', mode: 'ask' });

    const older = selectRecoverableRun({
      activeRuns: [activeRun('stale', 'build', isoAt(-30 * MINUTE_MS))],
      pendingRun: pendingRun('old', 'build', isoAt(-TWENTY_FOUR_HOURS_MS - 1)),
      now: NOW,
    });
    assert.equal(older, null);
  });

  test('appendRecoveredRunNotice returns only the notice for build and unknown', () => {
    const answer = 'I have added a button.';
    const notice = 'File changes were not applied.';
    assert.equal(appendRecoveredRunNotice(answer, 'build', notice), notice);
    assert.equal(appendRecoveredRunNotice(answer, 'unknown', notice), notice);
    assert.equal(appendRecoveredRunNotice('', 'build', notice), notice);
    assert.equal(appendRecoveredRunNotice('', 'unknown', notice), notice);
    assert.equal(appendRecoveredRunNotice(answer, 'ask', notice), answer);
    assert.equal(appendRecoveredRunNotice(answer, 'agent', notice), answer);
  });

  test('recoveredRunNeedsNotAppliedNotice is true for build and unknown only', () => {
    assert.equal(recoveredRunNeedsNotAppliedNotice('build'), true);
    assert.equal(recoveredRunNeedsNotAppliedNotice('unknown'), true);
    assert.equal(recoveredRunNeedsNotAppliedNotice('ask'), false);
    assert.equal(recoveredRunNeedsNotAppliedNotice('agent'), false);
  });

  test('run recovery messages exist and are non-empty in en, zh-TW, and zh-CN', () => {
    const locales = [enMessages.ai, zhTwMessages.ai, zhCnMessages.ai];
    for (const messages of locales) {
      assert.equal(typeof messages.runRecovering, 'string');
      assert.equal(typeof messages.runRecoveredBuildNotApplied, 'string');
      assert.ok(messages.runRecovering.trim().length > 0);
      assert.ok(messages.runRecoveredBuildNotApplied.trim().length > 0);
    }
    assert.equal(enMessages.ai.runRecovering, 'Reconnected to your run...');
    assert.equal(
      enMessages.ai.runRecoveredBuildNotApplied,
      'This run finished while the page was closed, so its file changes were not applied. Ask again to apply them.',
    );
    assert.notEqual(zhTwMessages.ai.runRecovering, enMessages.ai.runRecovering);
    assert.notEqual(
      zhTwMessages.ai.runRecoveredBuildNotApplied,
      enMessages.ai.runRecoveredBuildNotApplied,
    );
    assert.notEqual(zhCnMessages.ai.runRecovering, enMessages.ai.runRecovering);
    assert.notEqual(
      zhCnMessages.ai.runRecoveredBuildNotApplied,
      enMessages.ai.runRecoveredBuildNotApplied,
    );
    assert.notEqual(zhTwMessages.ai.runRecovering, zhCnMessages.ai.runRecovering);
    assert.notEqual(
      zhTwMessages.ai.runRecoveredBuildNotApplied,
      zhCnMessages.ai.runRecoveredBuildNotApplied,
    );
  });
});
