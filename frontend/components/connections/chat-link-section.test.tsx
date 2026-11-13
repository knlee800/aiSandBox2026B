import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  cancelChatClaim,
  confirmChatLink,
  createChatCode,
  loadChatLinks,
  unlinkChat,
  type ChatLinkFetcher,
} from '@/components/connections/chat-link-api';
import { CHAT_ERROR_KEYS, type ChatLinksState } from '@/components/connections/chat-link.logic';
import {
  ChatLinkSectionView,
  type ChatLinkSectionViewProps,
} from '@/components/connections/chat-link-section';
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
const NOW = Date.parse('2026-11-13T10:00:00.000Z');
const FUTURE = '2026-11-13T10:10:00.000Z';

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
  return (key: string) => readMessage(messages, `connections.${key}`) ?? `connections.${key}`;
}

function en(key: string): string {
  const value = readMessage(EN, `connections.${key}`);
  assert.ok(value, `missing connections.${key}`);
  return value;
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

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (full, key: string) => values[key] ?? full);
}

const OFF: ChatLinksState = { enabled: false, paused: false, link: null, pending: null };
const UNLINKED: ChatLinksState = { enabled: true, paused: false, link: null, pending: null };
const CODE_MADE: ChatLinksState = {
  enabled: true,
  paused: false,
  link: null,
  pending: {
    channel: 'discord',
    claimed: false,
    expiresAt: FUTURE,
    claimedAt: null,
    displayName: null,
    externalIdLast4: null,
  },
};
const CLAIMED: ChatLinksState = {
  enabled: true,
  paused: false,
  link: null,
  pending: {
    channel: 'discord',
    claimed: true,
    expiresAt: FUTURE,
    claimedAt: '2026-11-13T10:01:00.000Z',
    displayName: 'Keith#1',
    externalIdLast4: '5432',
  },
};
const LINKED: ChatLinksState = {
  enabled: true,
  paused: false,
  link: {
    channel: 'discord',
    linkedAt: '2026-11-13T09:00:00.000Z',
    lastUsedAt: null,
    externalIdLast4: '5432',
  },
  pending: null,
};

function render(overrides: Partial<ChatLinkSectionViewProps> = {}, messages: Messages = EN): string {
  const props: ChatLinkSectionViewProps = {
    t: translator(messages),
    locale: 'en',
    now: NOW,
    phase: 'ready',
    state: UNLINKED,
    code: null,
    ticked: false,
    busy: 'idle',
    errorKey: null,
    errorRetryAfterSeconds: null,
    noticeKey: null,
    confirmUnlink: false,
    onTick: () => undefined,
    onCreateCode: () => undefined,
    onConfirm: () => undefined,
    onCancel: () => undefined,
    onAskUnlink: () => undefined,
    onCancelUnlink: () => undefined,
    onConfirmUnlink: () => undefined,
    onRetry: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(<ChatLinkSectionView {...props} />);
}

function buttonTag(html: string, testId: string): string {
  const match = html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`));
  assert.ok(match, `button ${testId} missing`);
  return match[0];
}

describe('chat link section states', () => {
  test('loading and load failure show translated text', () => {
    const loading = render({ phase: 'loading', state: null });
    assert.equal(loading.includes('data-testid="chat-link-loading"'), true);
    assert.equal(has(loading, en('chat.loading')), true);
    const failed = render({ phase: 'error', state: null, errorKey: 'chat.errors.network' });
    assert.equal(has(failed, en('chat.errors.network')), true);
    assert.equal(has(failed, en('chat.retry')), true);
    assert.equal(failed.includes('data-testid="chat-link-create"'), false);
  });

  test('switched off shows one translated line and no actions', () => {
    const html = render({ state: OFF });
    assert.equal(html.includes('data-testid="chat-link-unavailable"'), true);
    assert.equal(has(html, en('chat.unavailable')), true);
    assert.equal(html.includes('<button'), false);
    assert.equal(html.includes('<input'), false);
    assert.equal(render({ state: null }).includes('data-testid="chat-link-unavailable"'), true);
  });

  test('not linked shows the data statement and Create code is disabled until it is ticked', () => {
    const html = render();
    for (const key of ['sent', 'kept', 'unlink', 'checkbox']) {
      assert.equal(has(html, en(`chat.consent.${key}`)), true, key);
    }
    assert.match(en('chat.consent.sent'), /Discord, a company outside Singapore/);
    assert.match(buttonTag(html, 'chat-link-create'), /disabled=""/);
    const ticked = render({ ticked: true });
    assert.doesNotMatch(buttonTag(ticked, 'chat-link-create'), /disabled=""/);
    assert.match(ticked, /data-testid="chat-link-consent-box"[^>]*checked=""|checked=""[^>]*data-testid="chat-link-consent-box"/);
    assert.equal(html.includes('data-testid="chat-link-code"'), false);
  });

  test('Create code stays disabled while paused or busy even when ticked', () => {
    assert.match(buttonTag(render({ ticked: true, state: { ...UNLINKED, paused: true } }), 'chat-link-create'), /disabled=""/);
    assert.match(buttonTag(render({ ticked: true, busy: 'creating' }), 'chat-link-create'), /disabled=""/);
    assert.equal(has(render({ state: { ...UNLINKED, paused: true } }), en('chat.paused')), true);
  });

  test('a made code is shown as XXXX-XXXX with its expiry and the /link instruction', () => {
    const html = render({ state: CODE_MADE, code: { code: 'ABCD-2345', expiresAt: FUTURE } });
    assert.match(html, /data-testid="chat-link-code"[^>]*>ABCD-2345</);
    assert.equal(has(html, en('chat.code.instruction')), true);
    assert.match(en('chat.code.instruction'), /\/link/);
    assert.equal(html.includes('data-testid="chat-link-code-expiry"'), true);
    assert.equal(has(html, en('chat.code.waiting')), true);
    assert.equal(html.includes('data-testid="chat-link-consent"'), false);
  });

  test('after a reload the code is not shown again', () => {
    const html = render({ state: CODE_MADE, code: null });
    assert.equal(html.includes('data-testid="chat-link-code"'), false);
    assert.equal(has(html, en('chat.code.hidden')), true);
  });

  test('an expired code is not shown', () => {
    const html = render({ state: CODE_MADE, code: { code: 'ABCD-2345', expiresAt: '2026-11-13T09:00:00.000Z' }, now: NOW });
    assert.equal(html.includes('ABCD-2345'), false);
  });

  test('a claim shows the Discord name and the id ending with Confirm and Cancel', () => {
    const html = render({ state: CLAIMED });
    assert.equal(
      has(html, fill(en('chat.claim.named'), { name: 'Keith#1', last4: '5432' })),
      true,
    );
    assert.equal(html.includes('5432'), true);
    assert.equal(has(html, en('chat.confirm')), true);
    assert.equal(has(html, en('chat.cancel')), true);
    assert.equal(html.includes('data-testid="chat-link-confirm"'), true);
    assert.equal(html.includes('data-testid="chat-link-cancel-claim"'), true);
    const nameless = render({
      state: { ...CLAIMED, pending: { ...CLAIMED.pending!, displayName: null } },
    });
    assert.equal(has(nameless, fill(en('chat.claim.unnamed'), { last4: '5432' })), true);
  });

  test('linked shows since date, id ending and Unlink; unlink asks first', () => {
    const html = render({ state: LINKED });
    assert.equal(html.includes('data-testid="chat-link-status-linked"'), true);
    assert.match(html, /data-testid="chat-link-id-ending"[^>]*>5432</);
    assert.equal(html.includes('data-testid="chat-link-linked-at"'), true);
    assert.equal(has(html, en('chat.linked.neverUsed')), true);
    assert.equal(html.includes('data-testid="chat-link-unlink"'), true);
    assert.equal(html.includes('data-testid="chat-link-unlink-yes"'), false);
    assert.equal(html.includes('data-testid="chat-link-consent"'), false);
    const asking = render({ state: LINKED, confirmUnlink: true });
    assert.equal(has(asking, en('chat.unlinkConfirm')), true);
    assert.equal(asking.includes('data-testid="chat-link-unlink-yes"'), true);
    assert.equal(asking.includes('data-testid="chat-link-unlink-no"'), true);
    assert.equal(asking.includes('data-testid="chat-link-unlink"'), false);
  });

  test('notices and errors are translated, and the rate limit shows the wait', () => {
    assert.equal(has(render({ noticeKey: 'chat.notice.expired' }), en('chat.notice.expired')), true);
    for (const key of Object.values(CHAT_ERROR_KEYS)) {
      if (key === 'chat.errors.rateLimited') continue;
      assert.equal(has(render({ errorKey: key }), en(key)), true, key);
    }
    const limited = render({ errorKey: 'chat.errors.rateLimited', errorRetryAfterSeconds: 1500 });
    assert.equal(has(limited, fill(en('chat.errors.rateLimited'), { minutes: '25' })), true);
    assert.equal(limited.includes('{minutes}'), false);
  });

  test('every state renders in all three languages with catalog text only', () => {
    const states: Array<Partial<ChatLinkSectionViewProps>> = [
      { state: OFF },
      { state: UNLINKED, ticked: true },
      { state: CODE_MADE, code: { code: 'ABCD-2345', expiresAt: FUTURE } },
      { state: CODE_MADE, code: null },
      { state: CLAIMED },
      { state: LINKED },
      { state: LINKED, confirmUnlink: true },
      { state: UNLINKED, errorKey: 'chat.errors.taken', noticeKey: 'chat.notice.cancelled' },
      { phase: 'loading', state: null },
      { phase: 'error', state: null, errorKey: 'chat.errors.generic' },
    ];
    for (const { code, messages } of LOCALES) {
      for (const [index, overrides] of states.entries()) {
        const html = render(overrides, messages);
        assert.equal(html.includes('connections.chat.'), false, `${code} state ${index} shows a raw key`);
        assert.equal(/connections\.chat/.test(html), false);
        assert.equal(html.includes('{name}') || html.includes('{last4}') || html.includes('{time}'), false, `${code} ${index}`);
      }
    }
  });
});

describe('chat link catalog', () => {
  const source = readFileSync(join(here, 'chat-link-section.tsx'), 'utf8');
  const logic = readFileSync(join(here, 'chat-link.logic.ts'), 'utf8');
  const keys = new Set<string>([
    ...[...source.matchAll(/'(chat\.[A-Za-z.]+)'/g)].map((m) => m[1]),
    ...[...logic.matchAll(/'(chat\.[A-Za-z.]+)'/g)].map((m) => m[1]),
    ...Object.values(CHAT_ERROR_KEYS),
  ]);

  test('every chat key the code uses exists in en, zh-TW and zh-CN', () => {
    assert.ok(keys.size > 8);
    for (const { code, messages } of LOCALES) {
      for (const key of keys) {
        assert.ok(readMessage(messages, `connections.${key}`), `${key} missing in ${code}`);
      }
    }
    for (const stem of [
      'consent.title', 'consent.sent', 'consent.kept', 'consent.unlink', 'consent.checkbox',
      'code.title', 'code.instruction', 'code.expires', 'code.waiting', 'code.hidden',
      'claim.title', 'claim.named', 'claim.unnamed', 'claim.warning',
      'linked.since', 'linked.lastUsed', 'linked.neverUsed', 'linked.idEnding', 'linked.notice',
      'notice.unlinked', 'notice.cancelled', 'notice.expired',
    ]) {
      for (const { code, messages } of LOCALES) {
        assert.ok(readMessage(messages, `connections.chat.${stem}`), `chat.${stem} missing in ${code}`);
      }
    }
  });

  test('zh-TW and zh-CN chat copy differs from English and from each other', () => {
    const tw = zhTwMessages as Messages;
    const cn = zhCnMessages as Messages;
    for (const key of ['chat.consent.sent', 'chat.consent.checkbox', 'chat.claim.named', 'chat.createCode', 'chat.unlinkConfirm']) {
      const path = `connections.${key}`;
      assert.notEqual(readMessage(tw, path), readMessage(EN, path), `${key} tw = en`);
      assert.notEqual(readMessage(cn, path), readMessage(EN, path), `${key} cn = en`);
      assert.notEqual(readMessage(tw, path), readMessage(cn, path), `${key} tw = cn`);
    }
  });

  test('placeholders stay in every language', () => {
    for (const { code, messages } of LOCALES) {
      assert.match(readMessage(messages, 'connections.chat.claim.named') ?? '', /\{name\}.*\{last4\}|\{last4\}.*\{name\}/, code);
      assert.match(readMessage(messages, 'connections.chat.claim.unnamed') ?? '', /\{last4\}/, code);
      assert.match(readMessage(messages, 'connections.chat.code.expires') ?? '', /\{time\}/, code);
      assert.match(readMessage(messages, 'connections.chat.errors.rateLimited') ?? '', /\{minutes\}/, code);
    }
  });
});

describe('chat link source rules', () => {
  const files = ['chat-link-section.tsx', 'chat-link-api.ts', 'chat-link.logic.ts'].map((name) =>
    readFileSync(join(here, name), 'utf8'),
  );

  test('the code is never kept in browser storage, cookies or the console', () => {
    for (const source of files) {
      assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|indexedDB|console\./);
    }
  });

  test('no hardcoded visible text in the section source', () => {
    const lines = files[0].split(/\r?\n/);
    const bare = lines.filter(
      (line) =>
        /^\s+[A-Z][a-z]+( [A-Za-z]+)*[.!?]?$/.test(line) &&
        !/^\s+(return|const|else|import|export|default|case|break|void|let)\b/.test(line),
    );
    assert.deepEqual(bare, []);
    assert.equal(/>\s*[A-Z][a-z]+(\s+[A-Za-z]+)*\s*<\//.test(files[0]), false);
  });

  test('icons are Heroicons v2 outline only', () => {
    assert.match(files[0], /from '@heroicons\/react\/24\/outline'/);
    assert.doesNotMatch(files[0], /@heroicons\/react\/(24|20|16)\/solid/);
  });

  test('the section is mounted from the Connections page', () => {
    const screen = readFileSync(join(here, 'connections-screen.tsx'), 'utf8');
    assert.match(screen, /<ChatLinkSection t=\{t\} locale=\{locale\} \/>/);
  });
});

interface Call {
  path: string;
  method: string;
  body: unknown;
}

function stub(status: number, payload: unknown): { fetcher: ChatLinkFetcher; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher: ChatLinkFetcher = async (path, init = {}) => {
    calls.push({
      path,
      method: (init.method ?? 'GET').toUpperCase(),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
    });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { fetcher, calls };
}

const throwing: ChatLinkFetcher = async () => {
  throw new TypeError('Failed to fetch');
};

describe('chat link api', () => {
  test('load reads the state and maps 401, 403 and the switch-off 503', async () => {
    const ok = stub(200, { enabled: true, paused: false, discord: { link: null, pending: null } });
    const loaded = await loadChatLinks(ok.fetcher);
    assert.equal(loaded.type, 'ok');
    assert.deepEqual(ok.calls[0], { path: '/api/chat-links', method: 'GET', body: undefined });
    assert.equal((await loadChatLinks(stub(401, { statusCode: 401 }).fetcher)).type, 'unauthorized');
    assert.equal((await loadChatLinks(stub(403, { statusCode: 403 }).fetcher)).type, 'forbidden');
    assert.equal(
      (await loadChatLinks(stub(503, { statusCode: 503, code: 'chat_link_unavailable' }).fetcher)).type,
      'unavailable',
    );
    assert.deepEqual(await loadChatLinks(throwing), {
      type: 'failed',
      errorKey: 'chat.errors.network',
      retryAfterSeconds: null,
    });
    assert.equal((await loadChatLinks(stub(200, { nope: true }).fetcher)).type, 'failed');
  });

  test('create code posts the locale and returns the code formatted', async () => {
    const made = stub(201, { channel: 'discord', code: 'abcd2345', expiresAt: FUTURE });
    const result = await createChatCode('zh-TW', made.fetcher);
    assert.deepEqual(result, { type: 'ok', value: { code: 'ABCD-2345', expiresAt: FUTURE } });
    assert.deepEqual(made.calls[0], {
      path: '/api/chat-links/discord/code',
      method: 'POST',
      body: { locale: 'zh-TW' },
    });
    const other = stub(201, { code: 'ABCD-2345', expiresAt: FUTURE });
    await createChatCode('fr', other.fetcher);
    assert.deepEqual(other.calls[0].body, {});
  });

  test('create code maps rate limit with its wait, paused and exists', async () => {
    assert.deepEqual(
      await createChatCode('en', stub(429, { code: 'chat_link_rate_limited', retryAfterSeconds: 1500 }).fetcher),
      { type: 'failed', errorKey: 'chat.errors.rateLimited', retryAfterSeconds: 1500 },
    );
    const paused = await createChatCode('en', stub(503, { code: 'chat_link_paused' }).fetcher);
    assert.equal(paused.type === 'failed' && paused.errorKey, 'chat.errors.paused');
    const exists = await createChatCode('en', stub(409, { code: 'chat_link_exists' }).fetcher);
    assert.equal(exists.type === 'failed' && exists.errorKey, 'chat.errors.exists');
  });

  test('confirm, cancel and unlink use the frozen routes and map their errors', async () => {
    const link = { channel: 'discord', linkedAt: '2026-11-13T09:00:00.000Z', lastUsedAt: null, externalIdLast4: '5432' };
    const confirm = stub(200, link);
    assert.equal((await confirmChatLink(confirm.fetcher)).type, 'ok');
    assert.deepEqual(
      { path: confirm.calls[0].path, method: confirm.calls[0].method },
      { path: '/api/chat-links/discord/confirm', method: 'POST' },
    );
    const none = await confirmChatLink(stub(404, { code: 'chat_link_no_pending_claim' }).fetcher);
    assert.equal(none.type === 'failed' && none.errorKey, 'chat.errors.noPending');
    const taken = await confirmChatLink(stub(409, { code: 'chat_link_taken' }).fetcher);
    assert.equal(taken.type === 'failed' && taken.errorKey, 'chat.errors.taken');

    const cancel = stub(200, { channel: 'discord', cancelled: true });
    assert.equal((await cancelChatClaim(cancel.fetcher)).type, 'ok');
    assert.deepEqual(
      { path: cancel.calls[0].path, method: cancel.calls[0].method },
      { path: '/api/chat-links/discord/cancel', method: 'POST' },
    );

    const unlink = stub(200, { channel: 'discord', removed: true });
    assert.equal((await unlinkChat(unlink.fetcher)).type, 'ok');
    assert.deepEqual(
      { path: unlink.calls[0].path, method: unlink.calls[0].method },
      { path: '/api/chat-links/discord', method: 'DELETE' },
    );
    assert.equal((await unlinkChat(throwing)).type, 'failed');
  });

  test('writes go through knowledgeFetch so the CSRF header is sent', () => {
    const api = readFileSync(join(here, 'chat-link-api.ts'), 'utf8');
    assert.match(api, /import \{ knowledgeFetch \} from '@\/components\/knowledge\/knowledge-api'/);
    assert.match(api, /fetcher: ChatLinkFetcher = knowledgeFetch/);
  });
});
