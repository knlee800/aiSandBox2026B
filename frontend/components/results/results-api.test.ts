import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  loadResultDetail,
  loadResults,
  loadResultsWorkflows,
  loadUnreadCount,
  markResultSeen,
  parseResultDetail,
  parseResultsPage,
  type ResultsFetcher,
} from '@/components/results/results-api';
import {
  EMPTY_RESULTS_FILTERS,
  formatResultTime,
  isResultUnread,
  localDayEndIso,
  localDayStartIso,
  resultStatusKey,
  resultTitle,
  resultsDateRangeInvalid,
  resultsFiltersActive,
  resultsPageCount,
  resultsQueryString,
  unreadBadgeText,
  withResultSeen,
  type ResultListItem,
} from '@/components/results/results.logic';

interface Call {
  path: string;
  method: string;
}

function stub(status: number, payload: unknown): { fetcher: ResultsFetcher; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher: ResultsFetcher = async (path, init = {}) => {
    calls.push({ path, method: (init.method ?? 'GET').toUpperCase() });
    if (payload === undefined) {
      return new Response(null, { status });
    }
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { fetcher, calls };
}

const throwing: ResultsFetcher = async () => {
  throw new TypeError('Failed to fetch');
};

const LIST_ITEM = {
  collaborationRunId: 'run-1',
  projectId: 'project-1',
  status: 'completed',
  createdAt: '2026-11-09T08:00:00.000Z',
  finishedAt: '2026-11-09T08:05:00.000Z',
  teamId: 'workflow',
  workflow: { id: 'w1', name: 'Morning digest', testRun: true },
  task: 'Digest',
  excerpt: 'Three emails',
  seenAt: null,
};

function listItem(overrides: Partial<ResultListItem> = {}): ResultListItem {
  return { ...(LIST_ITEM as ResultListItem), ...overrides };
}

const t = (key: string) => `T:${key}`;

describe('results logic', () => {
  test('unread means not opened and completed, failed or timed_out', () => {
    for (const status of ['completed', 'failed', 'timed_out']) {
      assert.equal(isResultUnread({ status, seenAt: null }), true, status);
      assert.equal(isResultUnread({ status, seenAt: '2026-11-09T00:00:00.000Z' }), false, status);
    }
    assert.equal(isResultUnread({ status: 'cancelled', seenAt: null }), false);
    assert.equal(isResultUnread({ status: 'active', seenAt: null }), false);
  });

  test('status keys fall back to unknown', () => {
    assert.equal(resultStatusKey('timed_out'), 'results.status.timed_out');
    assert.equal(resultStatusKey('weird'), 'results.status.unknown');
  });

  test('the title is the workflow name, else the team label', () => {
    assert.equal(resultTitle({ teamId: 'workflow', workflow: { id: 'w', name: 'Digest', testRun: false } }, t), 'Digest');
    assert.equal(resultTitle({ teamId: 'chief-of-staff', workflow: null }, t), 'T:collaboration.teamChiefOfStaff');
    assert.equal(resultTitle({ teamId: 'advisors', workflow: null }, t), 'T:collaboration.teamAdvisors');
    assert.equal(resultTitle({ teamId: 'coding', workflow: null }, t), 'T:collaboration.teamCoding');
  });

  test('local days become zoned date-times covering the whole local day', () => {
    const start = localDayStartIso('2026-11-01');
    const end = localDayEndIso('2026-11-01');
    assert.ok(start && end);
    assert.equal(new Date(start).getTime(), new Date(2026, 10, 1).getTime());
    assert.equal(new Date(end).getTime(), new Date(2026, 10, 2).getTime() - 1);
    assert.equal(localDayStartIso('2026-02-30'), null);
    assert.equal(localDayStartIso('yesterday'), null);
  });

  test('the query string leaves out empty filters and always sends the page and size', () => {
    assert.equal(resultsQueryString(EMPTY_RESULTS_FILTERS, 1), 'page=1&pageSize=20');
    const query = new URLSearchParams(
      resultsQueryString({ status: 'failed', workflowId: 'w1', from: '2026-11-01', to: '2026-11-02' }, 3),
    );
    assert.equal(query.get('status'), 'failed');
    assert.equal(query.get('workflowId'), 'w1');
    assert.equal(query.get('from'), localDayStartIso('2026-11-01'));
    assert.equal(query.get('to'), localDayEndIso('2026-11-02'));
    assert.equal(query.get('page'), '3');
    assert.equal(query.get('pageSize'), '20');
  });

  test('a From after To is refused before asking the server', () => {
    assert.equal(resultsDateRangeInvalid({ from: '2026-11-03', to: '2026-11-02' }), true);
    assert.equal(resultsDateRangeInvalid({ from: '2026-11-02', to: '2026-11-02' }), false);
    assert.equal(resultsDateRangeInvalid({ from: '', to: '2026-11-02' }), false);
  });

  test('filters active, page count and the badge text', () => {
    assert.equal(resultsFiltersActive(EMPTY_RESULTS_FILTERS), false);
    assert.equal(resultsFiltersActive({ ...EMPTY_RESULTS_FILTERS, to: '2026-11-02' }), true);
    assert.equal(resultsPageCount(0, 20), 1);
    assert.equal(resultsPageCount(41, 20), 3);
    assert.equal(unreadBadgeText(null), null);
    assert.equal(unreadBadgeText(0), null);
    assert.equal(unreadBadgeText(-1), null);
    assert.equal(unreadBadgeText(7), '7');
    assert.equal(unreadBadgeText(100), '99+');
  });

  test('opening clears only that item, only when it was unread', () => {
    const items = [listItem(), listItem({ collaborationRunId: 'run-2' })];
    const next = withResultSeen(items, 'run-1', '2026-11-10T00:00:00.000Z');
    assert.equal(next[0].seenAt, '2026-11-10T00:00:00.000Z');
    assert.equal(next[1].seenAt, null);
    const again = withResultSeen(next, 'run-1', '2026-11-11T00:00:00.000Z');
    assert.equal(again[0].seenAt, '2026-11-10T00:00:00.000Z');
  });

  test('times format in the page locale and bad input is null', () => {
    assert.ok(formatResultTime('2026-11-09T08:00:00.000Z', 'en'));
    assert.ok(formatResultTime('2026-11-09T08:00:00.000Z', 'zh-TW'));
    assert.equal(formatResultTime(null, 'en'), null);
    assert.equal(formatResultTime('nope', 'en'), null);
  });
});

describe('results api', () => {
  test('loads a page with the query and keeps the public fields', async () => {
    const { fetcher, calls } = stub(200, { results: [LIST_ITEM, { bad: true }], page: 2, pageSize: 20, total: 21 });
    const result = await loadResults({ ...EMPTY_RESULTS_FILTERS, status: 'completed' }, 2, fetcher);
    assert.deepEqual(calls, [{ path: '/api/results?status=completed&page=2&pageSize=20', method: 'GET' }]);
    assert.equal(result.type, 'ok');
    if (result.type === 'ok') {
      assert.equal(result.value.total, 21);
      assert.equal(result.value.page, 2);
      assert.deepEqual(result.value.results, [LIST_ITEM]);
    }
  });

  test('401, 403, 500, a bad body and a network failure map to page states', async () => {
    assert.deepEqual(await loadResults(EMPTY_RESULTS_FILTERS, 1, stub(401, {}).fetcher), { type: 'unauthorized' });
    assert.deepEqual(await loadResults(EMPTY_RESULTS_FILTERS, 1, stub(403, {}).fetcher), { type: 'forbidden' });
    assert.deepEqual(await loadResults(EMPTY_RESULTS_FILTERS, 1, stub(500, {}).fetcher), { type: 'failed' });
    assert.deepEqual(await loadResults(EMPTY_RESULTS_FILTERS, 1, stub(200, { nope: 1 }).fetcher), { type: 'failed' });
    assert.deepEqual(await loadResults(EMPTY_RESULTS_FILTERS, 1, throwing), { type: 'failed' });
  });

  test('parseResultsPage accepts an empty page and refuses a non-page', () => {
    assert.deepEqual(parseResultsPage({ results: [], page: 1, pageSize: 20, total: 0 }), {
      results: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
    assert.equal(parseResultsPage(null), null);
    assert.equal(parseResultsPage({ results: 'x' }), null);
  });

  test('the unread count is a number on 200 and null on anything else', async () => {
    const ok = stub(200, { count: 3 });
    assert.equal(await loadUnreadCount(ok.fetcher), 3);
    assert.deepEqual(ok.calls, [{ path: '/api/results/unread-count', method: 'GET' }]);
    assert.equal(await loadUnreadCount(stub(200, { count: 0 }).fetcher), 0);
    for (const status of [401, 403, 404, 500, 503]) {
      assert.equal(await loadUnreadCount(stub(status, { count: 9 }).fetcher), null, String(status));
    }
    assert.equal(await loadUnreadCount(stub(200, { count: -1 }).fetcher), null);
    assert.equal(await loadUnreadCount(stub(200, { count: '3' }).fetcher), null);
    assert.equal(await loadUnreadCount(stub(200, undefined).fetcher), null);
    assert.equal(await loadUnreadCount(throwing), null);
  });

  test('marking seen posts once to the run and returns the stored time', async () => {
    const ok = stub(200, { seenAt: '2026-11-10T12:00:00.000Z' });
    assert.equal(await markResultSeen('run/1', ok.fetcher), '2026-11-10T12:00:00.000Z');
    assert.deepEqual(ok.calls, [{ path: '/api/results/run%2F1/seen', method: 'POST' }]);
    assert.equal(await markResultSeen('run-1', stub(404, {}).fetcher), null);
    assert.equal(await markResultSeen('run-1', throwing), null);
  });

  test('the detail reads the unchanged run route; 404 is not found', async () => {
    const ok = stub(200, {
      run: { collaborationRunId: 'run-1', status: 'completed', createdAt: 'c', updatedAt: 'u', completedAt: 'd', failedAt: null },
      teamId: 'coding',
      team: ['lead', 'writer', 'reviewer'],
      workflow: null,
      handoffs: [{ status: 'completed', prompt: 'task', answer: 'final' }],
    });
    const result = await loadResultDetail('run-1', ok.fetcher);
    assert.deepEqual(ok.calls, [{ path: '/api/collaboration/runs/run-1', method: 'GET' }]);
    assert.equal(result.type, 'ok');
    assert.deepEqual(await loadResultDetail('run-1', stub(404, {}).fetcher), { type: 'not_found' });
    assert.deepEqual(await loadResultDetail('run-1', stub(401, {}).fetcher), { type: 'unauthorized' });
    assert.deepEqual(await loadResultDetail('run-1', stub(500, {}).fetcher), { type: 'failed' });
    assert.deepEqual(await loadResultDetail('run-1', throwing), { type: 'failed' });
  });

  test('the final answer is the last completed hand-off, with its sources (DECISION A)', () => {
    const parsed = parseResultDetail({
      run: { collaborationRunId: 'run-1', status: 'completed', createdAt: 'c', updatedAt: 'u', completedAt: 'done', failedAt: null },
      teamId: 'coding',
      workflow: null,
      handoffs: [
        { status: 'completed', prompt: 'the task', answer: 'lead plan', sources: [] },
        {
          status: 'completed',
          prompt: 'write it',
          answer: 'writer answer',
          sources: [{ documentId: 'd1', title: 'Doc', scopeId: 'company', heading: null }],
          droppedSourceCount: 1,
          showUnsourced: false,
        },
        { status: 'rejected', prompt: 'review', answer: null },
      ],
    });
    assert.ok(parsed);
    assert.equal(parsed.task, 'the task');
    assert.equal(parsed.answer, 'writer answer');
    assert.equal(parsed.sources.length, 1);
    assert.equal(parsed.droppedSourceCount, 1);
    assert.equal(parsed.finishedAt, 'done');
    assert.equal(parsed.failureReason, null);
  });

  test('a failed run shows the last hand-off failure reason; a workflow test run keeps its flag', () => {
    const parsed = parseResultDetail({
      run: { collaborationRunId: 'run-1', status: 'failed', createdAt: 'c', updatedAt: 'u', completedAt: null, failedAt: 'f' },
      teamId: 'workflow',
      workflow: { id: 'w1', name: 'Digest', testRun: true },
      handoffs: [{ status: 'failed', prompt: 'task', answer: null, failureReason: 'provider error' }],
    });
    assert.ok(parsed);
    assert.equal(parsed.answer, null);
    assert.equal(parsed.failureReason, 'provider error');
    assert.equal(parsed.finishedAt, 'f');
    assert.deepEqual(parsed.workflow, { id: 'w1', name: 'Digest', testRun: true });
    assert.equal(parseResultDetail({ run: {} }), null);
  });

  test('blank answer text counts as no answer', () => {
    const parsed = parseResultDetail({
      run: { collaborationRunId: 'run-1', status: 'completed', createdAt: 'c', updatedAt: 'u', completedAt: 'd' },
      handoffs: [{ status: 'completed', prompt: 'task', answer: '   ' }],
    });
    assert.equal(parsed?.answer, null);
  });

  test('the workflow filter options come from the workflows route; failure leaves none', async () => {
    const ok = stub(200, { workflows: [{ id: 'w1', name: 'Digest', status: 'active' }, { id: '', name: 'x' }] });
    assert.deepEqual(await loadResultsWorkflows(ok.fetcher), [{ id: 'w1', name: 'Digest' }]);
    assert.deepEqual(ok.calls, [{ path: '/api/collaboration/workflows', method: 'GET' }]);
    assert.deepEqual(await loadResultsWorkflows(stub(403, {}).fetcher), []);
    assert.deepEqual(await loadResultsWorkflows(throwing), []);
  });
});
