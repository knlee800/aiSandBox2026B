import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResultsScreenView, type ResultsScreenViewProps } from '@/components/results/results-screen';
import {
  EMPTY_RESULTS_FILTERS,
  type ResultDetail,
  type ResultListItem,
  type ResultsPage,
} from '@/components/results/results.logic';
import type { ResultDetailState } from '@/components/results/use-results';
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';

type Messages = Record<string, unknown>;

const EN = enMessages as Messages;
const LOCALES = [
  { code: 'en', messages: EN },
  { code: 'zh-TW', messages: zhTwMessages as Messages },
  { code: 'zh-CN', messages: zhCnMessages as Messages },
];

const here = dirname(fileURLToPath(import.meta.url));

function readMessage(source: Messages, path: string): string | null {
  let current: unknown = source;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return null;
    }
    current = (current as Messages)[part];
  }
  return typeof current === 'string' ? current : null;
}

function translator(messages: Messages) {
  return (key: string) => readMessage(messages, key) ?? key;
}

function copy(messages: Messages, key: string): string {
  const value = readMessage(messages, key);
  assert.ok(value, `missing ${key}`);
  return value;
}

function leafKeys(value: unknown, prefix: string): string[] {
  if (typeof value === 'string') {
    return [prefix];
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value as Messages).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function has(html: string, text: string): boolean {
  return html.includes(escapeHtml(text));
}

function item(overrides: Partial<ResultListItem> = {}): ResultListItem {
  return {
    collaborationRunId: 'run-1',
    projectId: 'project-1',
    status: 'completed',
    createdAt: '2026-11-09T08:00:00.000Z',
    finishedAt: '2026-11-09T08:05:00.000Z',
    teamId: 'coding',
    workflow: null,
    task: 'Plan the launch',
    excerpt: 'Ship on Friday.',
    seenAt: null,
    ...overrides,
  };
}

function page(results: ResultListItem[], overrides: Partial<ResultsPage> = {}): ResultsPage {
  return { results, page: 1, pageSize: 20, total: results.length, ...overrides };
}

function detail(overrides: Partial<ResultDetail> = {}): ResultDetail {
  return {
    collaborationRunId: 'run-1',
    status: 'completed',
    createdAt: '2026-11-09T08:00:00.000Z',
    finishedAt: '2026-11-09T08:05:00.000Z',
    teamId: 'coding',
    workflow: null,
    task: 'Plan the launch',
    answer: 'Ship on Friday.',
    sources: [],
    showUnsourced: false,
    droppedSourceCount: 0,
    failureReason: null,
    ...overrides,
  };
}

function detailState(phase: ResultDetailState['phase'], value: ResultDetail | null = null): ResultDetailState {
  return { collaborationRunId: 'run-1', phase, detail: value };
}

function render(overrides: Partial<ResultsScreenViewProps> = {}, messages: Messages = EN, locale = 'en'): string {
  const props: ResultsScreenViewProps = {
    t: translator(messages),
    locale,
    authReady: true,
    phase: 'ready',
    page: page([item()]),
    filters: EMPTY_RESULTS_FILTERS,
    workflows: [],
    detail: null,
    onApplyFilters: () => undefined,
    onPage: () => undefined,
    onRetry: () => undefined,
    onOpen: () => undefined,
    onCloseDetail: () => undefined,
    onRetryDetail: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(<ResultsScreenView {...props} />);
}

describe('results list states', () => {
  test('the header has the icon, title, subtitle and the Command Center back link', () => {
    for (const { code, messages } of LOCALES) {
      const html = render({}, messages, code);
      assert.equal(html.includes('data-testid="results-back"'), true);
      assert.match(html, new RegExp(`href="/${code}/platform"`));
      assert.equal(has(html, copy(messages, 'results.title')), true, code);
      assert.equal(has(html, copy(messages, 'results.subtitle')), true, code);
      assert.equal(has(html, copy(messages, 'results.backToPlatform')), true, code);
    }
  });

  test('before sign-in is confirmed only the loading copy shows', () => {
    const html = render({ authReady: false });
    assert.match(html, /data-testid="results-auth-loading"/);
    assert.doesNotMatch(html, /data-testid="results-list"/);
    assert.equal(has(html, copy(EN, 'results.loading')), true);
  });

  test('list loading shows the spinner and the loading sentence in each language', () => {
    for (const { code, messages } of LOCALES) {
      const html = render({ phase: 'loading', page: null }, messages, code);
      assert.match(html, /data-testid="results-loading"/);
      assert.match(html, /aria-busy="true"/);
      assert.match(html, /data-testid="ui-spinner"/);
      assert.equal(has(html, copy(messages, 'results.loading')), true, code);
      assert.doesNotMatch(html, /data-testid="results-list"/);
    }
  });

  test('an empty list says no results yet and points to the Team page', () => {
    for (const { code, messages } of LOCALES) {
      const html = render({ page: page([]) }, messages, code);
      assert.match(html, /data-testid="results-empty"/);
      assert.equal(has(html, copy(messages, 'results.emptyTitle')), true, code);
      assert.equal(has(html, copy(messages, 'results.emptyBody')), true, code);
      assert.match(html, new RegExp(`href="/${code}/collaboration"`));
      assert.match(html, /data-testid="results-empty-team"/);
      assert.doesNotMatch(html, /data-testid="results-pager"/);
    }
  });

  test('an empty filtered list says so and offers Clear instead of the Team link', () => {
    const html = render({ page: page([]), filters: { ...EMPTY_RESULTS_FILTERS, status: 'failed' } });
    assert.match(html, /data-testid="results-empty-filtered"/);
    assert.equal(has(html, copy(EN, 'results.emptyFilteredTitle')), true);
    assert.match(html, /data-testid="results-filter-clear"/);
    assert.doesNotMatch(html, /data-testid="results-empty-team"/);
  });

  test('a failed load shows the error with Try again', () => {
    for (const { code, messages } of LOCALES) {
      const html = render({ phase: 'error', page: null }, messages, code);
      assert.match(html, /data-testid="results-error"/);
      assert.match(html, /role="alert"/);
      assert.match(html, /data-testid="results-retry"/);
      assert.equal(has(html, copy(messages, 'results.loadError')), true, code);
      assert.equal(has(html, copy(messages, 'results.retry')), true, code);
    }
  });

  test('403 without harness access is a calm notice with no list and no filters', () => {
    const html = render({ phase: 'forbidden', page: null });
    assert.match(html, /data-testid="results-forbidden"/);
    assert.equal(has(html, copy(EN, 'results.forbiddenTitle')), true);
    assert.doesNotMatch(html, /data-testid="results-filters"/);
    assert.doesNotMatch(html, /role="alert"/);
  });

  test('a loaded list shows title, status, task, excerpt and times; unread items carry a dot and New', () => {
    const html = render({
      page: page([
        item({ collaborationRunId: 'unread-1' }),
        item({ collaborationRunId: 'seen-1', seenAt: '2026-11-09T09:00:00.000Z', excerpt: null, status: 'failed' }),
        item({ collaborationRunId: 'cancelled-1', status: 'cancelled' }),
      ]),
    });
    assert.match(html, /data-testid="results-list"/);
    assert.match(html, /data-testid="results-item-unread-1"[^>]*data-unread="true"/);
    assert.match(html, /data-testid="results-item-seen-1"[^>]*data-unread="false"/);
    assert.match(html, /data-testid="results-item-cancelled-1"[^>]*data-unread="false"/);
    assert.equal((html.match(/data-testid="results-unread-dot"/g) ?? []).length, 1);
    assert.equal((html.match(/data-testid="results-new"/g) ?? []).length, 1);
    assert.equal(has(html, copy(EN, 'collaboration.teamCoding')), true);
    assert.equal(has(html, 'Plan the launch'), true);
    assert.equal(has(html, 'Ship on Friday.'), true);
    assert.equal(has(html, copy(EN, 'results.item.noAnswer')), true);
    assert.equal(has(html, copy(EN, 'results.status.completed')), true);
    assert.equal(has(html, copy(EN, 'results.status.failed')), true);
    assert.equal(has(html, copy(EN, 'results.status.cancelled')), true);
    assert.match(html, /Started /);
    assert.match(html, /Ended /);
  });

  test('a workflow run is titled by the workflow and a test run carries the Test run badge', () => {
    for (const { code, messages } of LOCALES) {
      const html = render(
        {
          page: page([
            item({ teamId: 'workflow', workflow: { id: 'w1', name: 'Morning digest', testRun: true } }),
            item({ collaborationRunId: 'run-2', teamId: 'chief-of-staff' }),
            item({ collaborationRunId: 'run-3', teamId: 'advisors' }),
          ]),
        },
        messages,
        code,
      );
      assert.equal(has(html, 'Morning digest'), true);
      assert.equal((html.match(/data-testid="results-test-run"/g) ?? []).length, 1);
      assert.equal(has(html, copy(messages, 'collaboration.testRunBadge')), true, code);
      assert.equal(has(html, copy(messages, 'collaboration.teamChiefOfStaff')), true, code);
      assert.equal(has(html, copy(messages, 'collaboration.teamAdvisors')), true, code);
    }
  });

  test('the pager shows the page summary and disables the ends', () => {
    const first = render({ page: page([item()], { page: 1, pageSize: 20, total: 45 }) });
    assert.match(first, /data-testid="results-pager"/);
    assert.equal(has(first, 'Page 1 of 3, 45 runs'), true);
    assert.match(first, /<button[^>]*disabled=""[^>]*data-testid="results-pager-previous"/);
    assert.doesNotMatch(first, /<button[^>]*disabled=""[^>]*data-testid="results-pager-next"/);
    const last = render({ page: page([item()], { page: 3, pageSize: 20, total: 45 }) });
    assert.match(last, /<button[^>]*disabled=""[^>]*data-testid="results-pager-next"/);
    assert.doesNotMatch(last, /<button[^>]*disabled=""[^>]*data-testid="results-pager-previous"/);
  });

  test('the filters offer every status, the workflows and the two dates, keeping the applied values', () => {
    const html = render({
      filters: { status: 'timed_out', workflowId: 'w2', from: '2026-11-01', to: '2026-11-09' },
      workflows: [
        { id: 'w1', name: 'Morning digest' },
        { id: 'w2', name: 'Weekly report' },
      ],
    });
    assert.match(html, /data-testid="results-filters"/);
    for (const status of ['completed', 'failed', 'timed_out', 'cancelled', 'active']) {
      assert.match(html, new RegExp(`<option value="${status}"`));
    }
    assert.match(html, /<option value="timed_out" selected="">/);
    assert.match(html, /<option value="w2" selected="">Weekly report<\/option>/);
    assert.match(html, /name="from"[^>]*value="2026-11-01"/);
    assert.match(html, /name="to"[^>]*value="2026-11-09"/);
    assert.equal(has(html, copy(EN, 'results.filters.workflowAll')), true);
    assert.match(html, /data-testid="results-filter-clear"/);
  });
});

describe('result detail states', () => {
  test('detail loading shows the spinner, the sentence and Back', () => {
    for (const { code, messages } of LOCALES) {
      const html = render({ detail: detailState('loading') }, messages, code);
      assert.match(html, /data-testid="results-detail-loading"/);
      assert.match(html, /aria-busy="true"/);
      assert.match(html, /data-testid="results-detail-back"/);
      assert.equal(has(html, copy(messages, 'results.detail.loading')), true, code);
      assert.equal(has(html, copy(messages, 'results.detail.back')), true, code);
      assert.doesNotMatch(html, /data-testid="results-list"/);
    }
  });

  test('a 404 detail is a not-found notice, not an error', () => {
    for (const { code, messages } of LOCALES) {
      const html = render({ detail: detailState('not_found') }, messages, code);
      assert.match(html, /data-testid="results-detail-not-found"/);
      assert.equal(has(html, copy(messages, 'results.detail.notFound')), true, code);
      assert.doesNotMatch(html, /role="alert"/);
    }
  });

  test('a failed detail shows the error with Try again', () => {
    for (const { code, messages } of LOCALES) {
      const html = render({ detail: detailState('error') }, messages, code);
      assert.match(html, /data-testid="results-detail-error"/);
      assert.match(html, /data-testid="results-detail-retry"/);
      assert.equal(has(html, copy(messages, 'results.detail.loadError')), true, code);
    }
  });

  test('the answer is plain text: line breaks kept and HTML escaped', () => {
    const answer = 'line one\nline two <script>alert(1)</script>';
    for (const { code, messages } of LOCALES) {
      const html = render({ detail: detailState('ready', detail({ answer })) }, messages, code);
      assert.match(html, /data-testid="results-detail-ready"/);
      assert.equal(has(html, copy(messages, 'results.detail.answer')), true, code);
      const at = html.indexOf('data-testid="results-detail-answer"');
      assert.ok(at > 0);
      const body = html.slice(html.indexOf('>', at) + 1, html.indexOf('</pre>', at));
      assert.equal(body.includes('line one\nline two '), true, code);
      assert.equal(body.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true, code);
      assert.doesNotMatch(body, /<script>/);
      assert.match(html, /<pre[^>]*whitespace-pre-wrap[^>]*data-testid="results-detail-answer"/);
    }
  });

  test('a run that ended without text says there is no answer', () => {
    for (const { code, messages } of LOCALES) {
      const html = render({ detail: detailState('ready', detail({ answer: null })) }, messages, code);
      assert.match(html, /data-testid="results-detail-no-answer"/);
      assert.equal(has(html, copy(messages, 'results.detail.noAnswer')), true, code);
      assert.doesNotMatch(html, /data-testid="results-detail-answer"/);
      assert.doesNotMatch(html, /data-testid="results-detail-sources"/);
    }
  });

  test('the detail shows status, times, task, the Test run badge, sources and the failure reason', () => {
    const html = render({
      detail: detailState(
        'ready',
        detail({
          status: 'failed',
          teamId: 'workflow',
          workflow: { id: 'w1', name: 'Morning digest', testRun: true },
          sources: [{ documentId: 'd1', title: 'Pricing', scopeId: 'company', heading: 'Plans' }],
          showUnsourced: false,
          droppedSourceCount: 2,
          failureReason: 'AI provider usage limit reached',
        }),
      ),
    });
    assert.equal(has(html, 'Morning digest'), true);
    assert.match(html, /data-testid="results-test-run"/);
    assert.match(html, /data-testid="results-status"[^>]*data-status="failed"/);
    assert.match(html, /data-testid="results-detail-started"/);
    assert.match(html, /data-testid="results-detail-finished"/);
    assert.match(html, /data-testid="results-detail-task"/);
    assert.match(html, /data-testid="results-detail-source-0"/);
    assert.equal(has(html, 'Pricing'), true);
    assert.equal(has(html, '2 source markers were left out.'), true);
    assert.match(html, /data-testid="results-detail-failure"/);
    assert.equal(has(html, copy(EN, 'results.detail.failure')), true);
    assert.equal(has(html, copy(EN, 'collaboration.providerUsageLimit')), true);
  });

  test('an unsourced business answer is labelled; an active run says it is still running', () => {
    const html = render({
      detail: detailState('ready', detail({ status: 'active', finishedAt: null, showUnsourced: true })),
    });
    assert.match(html, /data-testid="results-detail-unsourced"/);
    assert.equal(has(html, copy(EN, 'results.detail.notFinished')), true);
  });
});

describe('results locale catalog', () => {
  test('every results key exists and is non-empty in en, zh-TW and zh-CN', () => {
    const keySets = LOCALES.map(({ code, messages }) => ({
      code,
      messages,
      keys: leafKeys(messages.results, 'results').sort(),
    }));
    assert.ok(keySets[0].keys.length > 40);
    for (const entry of keySets) {
      assert.deepEqual(entry.keys, keySets[0].keys, `${entry.code} results keys differ`);
      for (const key of [...entry.keys, 'platform.openResults', 'platform.unreadResults']) {
        const value = readMessage(entry.messages, key);
        assert.ok(value && value.trim().length > 0, `Empty ${key} in ${entry.code}`);
      }
      for (const key of ['collaboration.teamCoding', 'collaboration.teamChiefOfStaff', 'collaboration.teamAdvisors', 'collaboration.testRunBadge']) {
        assert.ok(readMessage(entry.messages, key), `${key} in ${entry.code}`);
      }
    }
  });

  test('Chinese copy is real Chinese, and Traditional differs from Simplified', () => {
    for (const { code, messages } of LOCALES.slice(1)) {
      for (const key of [...leafKeys(messages.results, 'results'), 'platform.openResults', 'platform.unreadResults']) {
        const value = readMessage(messages, key) ?? '';
        assert.match(value, /\p{Script=Han}/u, `${key} in ${code} is not Chinese`);
        assert.notEqual(value, readMessage(EN, key), `${key} in ${code} is the English text`);
      }
    }
    assert.notEqual(
      readMessage(zhTwMessages as Messages, 'results.emptyBody'),
      readMessage(zhCnMessages as Messages, 'results.emptyBody'),
    );
  });

  test('templates keep their placeholders and no copy uses an em dash', () => {
    for (const { code, messages } of LOCALES) {
      assert.match(copy(messages, 'platform.unreadResults'), /\{count\}/, code);
      assert.match(copy(messages, 'results.item.started'), /\{time\}/, code);
      assert.match(copy(messages, 'results.item.finished'), /\{time\}/, code);
      assert.match(copy(messages, 'results.detail.droppedSources'), /\{count\}/, code);
      const summary = copy(messages, 'results.pager.summary');
      for (const name of ['{page}', '{pages}', '{total}']) {
        assert.equal(summary.includes(name), true, `${code} ${name}`);
      }
      for (const key of leafKeys(messages.results, 'results')) {
        assert.doesNotMatch(readMessage(messages, key) ?? '', /—|--/, `${key} in ${code}`);
      }
    }
  });

  test('Traditional and Simplified Chinese render instead of English', () => {
    const traditional = render({ page: page([]) }, zhTwMessages as Messages, 'zh-TW');
    const simplified = render({ page: page([]) }, zhCnMessages as Messages, 'zh-CN');
    assert.equal(has(traditional, copy(zhTwMessages as Messages, 'results.emptyTitle')), true);
    assert.equal(has(simplified, copy(zhCnMessages as Messages, 'results.emptyTitle')), true);
    assert.equal(has(traditional, copy(EN, 'results.emptyTitle')), false);
    assert.equal(has(simplified, copy(EN, 'results.emptyTitle')), false);
  });
});

describe('results page wiring', () => {
  const screen = readFileSync(join(here, 'results-screen.tsx'), 'utf8');
  const list = readFileSync(join(here, 'results-list.tsx'), 'utf8');
  const detailSource = readFileSync(join(here, 'results-detail.tsx'), 'utf8');
  const api = readFileSync(join(here, 'results-api.ts'), 'utf8');
  const hook = readFileSync(join(here, 'use-results.ts'), 'utf8');

  test('the route renders the screen with the auth gate', () => {
    const pagePath = join(here, '../../app/[locale]/results/page.tsx');
    assert.equal(existsSync(pagePath), true);
    assert.match(readFileSync(pagePath, 'utf8'), /<ResultsScreen locale=\{locale\} \/>/);
    assert.match(screen, /useTranslations\(\)/);
    assert.match(screen, /\/api\/auth\/me/);
    assert.match(screen, /\/\$\{locale\}\/login/);
  });

  test('the routes are the RESULTS-01 routes and the unchanged detail route, through collaborationFetch', () => {
    assert.match(api, /`\/api\/results\?\$\{resultsQueryString\(filters, page\)\}`/);
    assert.match(api, /'\/api\/results\/unread-count'/);
    assert.match(api, /`\/api\/results\/\$\{encodeURIComponent\(collaborationRunId\)\}\/seen`, \{\s*method: 'POST',\s*\}/);
    assert.match(api, /`\/api\/collaboration\/runs\/\$\{encodeURIComponent\(collaborationRunId\)\}`/);
    assert.match(api, /'\/api\/collaboration\/workflows'/);
    assert.match(api, /import \{ collaborationFetch \} from '@\/lib\/collaboration\/api'/);
  });

  test('nothing here starts, cancels or deploys a run', () => {
    for (const source of [screen, list, detailSource, api, hook]) {
      assert.doesNotMatch(source, /\/cancel|\/approve|\/reject|method: 'DELETE'/);
      assert.doesNotMatch(source, /'\/api\/collaboration\/runs'/);
    }
  });

  test('no browser storage, no console, no raw HTML', () => {
    for (const source of [screen, list, detailSource, api, hook]) {
      assert.doesNotMatch(source, /localStorage|sessionStorage/);
      assert.doesNotMatch(source, /console\./);
      assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
    }
  });

  test('icons are Heroicons v2 outline only', () => {
    for (const source of [screen, list, detailSource]) {
      assert.match(source, /from '@heroicons\/react\/24\/outline'/);
      assert.doesNotMatch(source, /@heroicons\/react\/(24|20|16)\/solid/);
    }
  });

  test('no hardcoded English copy in the views', () => {
    for (const source of [screen, list, detailSource]) {
      for (const text of ['No results yet', 'Try again', 'Final answer', 'Back to results', 'Previous', 'Filters']) {
        assert.equal(source.includes(`>${text}<`), false, text);
        assert.equal(source.includes(`'${text}'`), false, text);
      }
    }
  });
});
