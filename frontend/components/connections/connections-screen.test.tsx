import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CONNECTION_SERVER_MESSAGE_KEYS,
  CONNECTIONS_NOT_CONFIGURED_MESSAGE,
  connectCalendar,
  connectMail,
  disconnectConnection,
  loadConnections,
  parseConnections,
  verifyConnection,
  type ConnectionsFetcher,
  type ConnectionsState,
} from '@/components/connections/connections-api';
import {
  ConnectionsScreenView,
  IDLE_CARD_STATUS,
  type ConnectionsScreenViewProps,
} from '@/components/connections/connections-screen';
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

function en(key: string): string {
  const value = readMessage(EN, `connections.${key}`);
  assert.ok(value, `missing connections.${key} in en`);
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

function translator(messages: Messages) {
  return (key: string) => readMessage(messages, `connections.${key}`) ?? `connections.${key}`;
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

const NO_CONNECTIONS: ConnectionsState = { imap: null, ical: null };
const CONNECTED: ConnectionsState = {
  imap: {
    kind: 'imap',
    preset: 'gmail',
    username: 'owner@gmail.com',
    createdAt: '2026-11-09T08:00:00.000Z',
    updatedAt: '2026-11-09T08:00:00.000Z',
    lastVerifiedAt: null,
  },
  ical: {
    kind: 'ical',
    createdAt: '2026-11-09T08:05:00.000Z',
    updatedAt: '2026-11-09T08:05:00.000Z',
    lastVerifiedAt: '2026-11-09T09:00:00.000Z',
  },
};

function render(overrides: Partial<ConnectionsScreenViewProps> = {}, messages: Messages = EN): string {
  const props: ConnectionsScreenViewProps = {
    t: translator(messages),
    locale: 'en',
    phase: 'ready',
    connections: NO_CONNECTIONS,
    mail: IDLE_CARD_STATUS,
    calendar: IDLE_CARD_STATUS,
    mailPreset: 'gmail',
    onMailPresetChange: () => undefined,
    onRetry: () => undefined,
    onConnectMail: () => undefined,
    onConnectCalendar: () => undefined,
    onVerify: () => undefined,
    onAskDisconnect: () => undefined,
    onCancelDisconnect: () => undefined,
    onConfirmDisconnect: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(<ConnectionsScreenView {...props} />);
}

interface Call {
  path: string;
  method: string;
  body: unknown;
}

function stubFetcher(
  status: number,
  payload: unknown,
): { fetcher: ConnectionsFetcher; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher: ConnectionsFetcher = async (path, init = {}) => {
    calls.push({
      path,
      method: (init.method ?? 'GET').toUpperCase(),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
    });
    if (payload === null) {
      return new Response(null, { status });
    }
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { fetcher, calls };
}

const throwingFetcher: ConnectionsFetcher = async () => {
  throw new TypeError('Failed to fetch');
};

function nestError(status: number, message: string) {
  return { statusCode: status, message, error: 'Error' };
}

describe('connections screen states', () => {
  test('loading the list shows only the loading copy', () => {
    const html = render({ phase: 'loading' });
    assert.equal(html.includes('data-testid="connections-loading"'), true);
    assert.equal(has(html, en('loading')), true);
    assert.equal(html.includes('data-testid="connections-mail-form"'), false);
    assert.equal(html.includes('data-testid="connections-data-statement"'), false);
  });

  test('no connections shows both setup forms, Gmail steps and the notes', () => {
    const html = render();
    assert.equal(html.includes('data-testid="connections-mail-form"'), true);
    assert.equal(html.includes('data-testid="connections-calendar-form"'), true);
    assert.equal(html.includes('data-testid="connections-status-connected"'), false);
    assert.equal(has(html, en('status.notConnected')), true);
    for (const step of ['one', 'two', 'three']) {
      assert.equal(has(html, en(`steps.gmail.${step}`)), true, `gmail step ${step}`);
    }
    assert.equal(has(html, en('mail.noteAdvancedProtection')), true);
    assert.equal(has(html, en('mail.noteOutlook')), true);
    for (const key of ['calendar.stepOne', 'calendar.stepTwo', 'calendar.stepThree', 'calendar.noteAdmin']) {
      assert.equal(has(html, en(key)), true, key);
    }
    assert.equal(html.includes('data-testid="connections-mail-verify"'), false);
    assert.equal(html.includes('data-testid="connections-mail-disconnect"'), false);
  });

  test('the data statement is shown before either Connect button', () => {
    const html = render();
    const statement = html.indexOf('data-testid="connections-data-statement"');
    const mailConnect = html.indexOf('data-testid="connections-mail-connect"');
    const calendarConnect = html.indexOf('data-testid="connections-calendar-connect"');
    assert.ok(statement >= 0 && mailConnect > statement && calendarConnect > statement);
    for (const key of ['sentToProvider', 'mailAndCalendarRead', 'noChanges', 'stored']) {
      assert.equal(has(html, en(`dataStatement.${key}`)), true, key);
    }
    assert.match(en('dataStatement.mailAndCalendarRead'), /excerpt/);
    assert.match(en('mail.intro'), /excerpt/);
  });

  test('the three presets are offered and each has its own setup steps', () => {
    for (const preset of ['gmail', 'yahoo', 'icloud'] as const) {
      const html = render({ mailPreset: preset });
      assert.match(html, new RegExp(`data-testid="connections-mail-preset-${preset}" data-selected="true"`));
      assert.equal(has(html, en(`steps.${preset}.two`)), true, `${preset} steps`);
      assert.equal(has(html, en(`presets.${preset}`)), true);
    }
    const html = render({ mailPreset: 'icloud' });
    assert.equal(has(html, en('steps.gmail.two')), false);
    assert.equal((html.match(/type="radio"/g) ?? []).length, 3);
  });

  test('the app password is a password field that never carries a value', () => {
    const html = render();
    const field = html.match(/<input[^>]*data-testid="connections-mail-app-password"[^>]*>/)?.[0];
    assert.ok(field);
    assert.match(field, /type="password"/);
    assert.match(field, /autoComplete="off"|autocomplete="off"/);
    assert.doesNotMatch(field, /\svalue=/);
    const url = html.match(/<input[^>]*data-testid="connections-calendar-url"[^>]*>/)?.[0];
    assert.ok(url);
    assert.doesNotMatch(url, /\svalue=/);
  });

  test('connected cards show provider, address and dates with Verify and Disconnect, and no setup form', () => {
    const html = render({ connections: CONNECTED });
    assert.equal((html.match(/data-testid="connections-status-connected"/g) ?? []).length, 2);
    assert.equal(has(html, en('presets.gmail')), true);
    assert.equal(has(html, 'owner@gmail.com'), true);
    assert.equal(has(html, en('fields.notCheckedYet')), true);
    assert.equal(has(html, new Date(CONNECTED.imap!.createdAt).toLocaleString('en')), true);
    assert.equal(has(html, new Date(CONNECTED.ical!.lastVerifiedAt!).toLocaleString('en')), true);
    assert.equal(has(html, en('calendar.source')), true);
    assert.equal(html.includes('data-testid="connections-mail-verify"'), true);
    assert.equal(html.includes('data-testid="connections-calendar-disconnect"'), true);
    assert.equal(html.includes('data-testid="connections-mail-form"'), false);
    assert.equal(html.includes('type="password"'), false);
  });

  test('connect in progress disables the form and says so', () => {
    const html = render({ mail: { ...IDLE_CARD_STATUS, busy: 'connecting' } });
    assert.equal(has(html, en('mail.connecting')), true);
    assert.match(html, /<fieldset disabled=""/);
    const calendar = render({ calendar: { ...IDLE_CARD_STATUS, busy: 'connecting' } });
    assert.equal(has(calendar, en('calendar.connecting')), true);
  });

  test('a refused connect shows the backend fixed message as translated copy', () => {
    const html = render({ mail: { ...IDLE_CARD_STATUS, errorKey: 'errors.appPassword' } });
    assert.equal(html.includes('data-testid="connections-mail-error"'), true);
    assert.equal(has(html, 'App password must be 8 to 64 characters.'), true);
    assert.match(html, /role="alert"/);
    const calendar = render({ calendar: { ...IDLE_CARD_STATUS, errorKey: 'errors.icalUrl' } });
    assert.equal(has(calendar, 'Calendar link must be an https URL with a host name.'), true);
  });

  test('503 not configured is a calm notice, not an error', () => {
    const html = render({ phase: 'unavailable' });
    assert.equal(html.includes('data-testid="connections-unavailable"'), true);
    assert.equal(has(html, en('unavailableTitle')), true);
    assert.equal(has(html, en('unavailableBody')), true);
    assert.equal(html.includes('role="alert"'), false);
    assert.equal(html.includes('data-testid="connections-mail-form"'), false);
  });

  test('403 without harness access is a calm not-available notice without errors', () => {
    const html = render({ phase: 'forbidden' });
    assert.equal(html.includes('data-testid="connections-forbidden"'), true);
    assert.equal(has(html, en('forbiddenTitle')), true);
    assert.equal(html.includes('role="alert"'), false);
    assert.equal(html.includes('data-testid="connections-error"'), false);
    assert.equal(html.includes('data-testid="connections-data-statement"'), false);
  });

  test('verify in progress, success with the time, and failure', () => {
    const running = render({ connections: CONNECTED, mail: { ...IDLE_CARD_STATUS, busy: 'verifying' } });
    assert.equal(has(running, en('actions.verifying')), true);

    const at = '2026-11-09T10:15:00.000Z';
    const ok = render({ connections: CONNECTED, mail: { ...IDLE_CARD_STATUS, verifiedAt: at } });
    assert.equal(ok.includes('data-testid="connections-mail-verify-ok"'), true);
    assert.equal(
      has(ok, en('actions.verifyOk').replace('{when}', new Date(at).toLocaleString('en'))),
      true,
    );

    const failed = render({
      connections: CONNECTED,
      calendar: { ...IDLE_CARD_STATUS, errorKey: 'errors.calendarVerifyFailed' },
    });
    assert.equal(failed.includes('data-testid="connections-calendar-error"'), true);
    assert.equal(has(failed, en('errors.calendarVerifyFailed')), true);
    assert.equal(failed.includes('data-testid="connections-calendar-verify-ok"'), false);
  });

  test('disconnect asks to confirm, then shows the done notice', () => {
    const confirm = render({ connections: CONNECTED, mail: { ...IDLE_CARD_STATUS, confirmDisconnect: true } });
    assert.equal(confirm.includes('data-testid="connections-mail-disconnect-confirm"'), true);
    assert.match(confirm, /role="alertdialog"/);
    assert.equal(has(confirm, en('mail.disconnectTitle')), true);
    assert.equal(has(confirm, en('mail.disconnectBody')), true);
    assert.equal(confirm.includes('data-testid="connections-mail-disconnect-cancel"'), true);
    assert.equal(confirm.includes('data-testid="connections-mail-verify"'), false);

    const running = render({
      connections: CONNECTED,
      calendar: { ...IDLE_CARD_STATUS, confirmDisconnect: true, busy: 'disconnecting' },
    });
    assert.equal(has(running, en('actions.disconnecting')), true);

    const done = render({ mail: { ...IDLE_CARD_STATUS, disconnected: true } });
    assert.equal(done.includes('data-testid="connections-mail-disconnected"'), true);
    assert.equal(has(done, en('mail.disconnected')), true);
    assert.equal(done.includes('data-testid="connections-mail-form"'), true);
  });

  test('a network failure loading the list shows the error with retry', () => {
    const html = render({ phase: 'error' });
    assert.equal(html.includes('data-testid="connections-error"'), true);
    assert.equal(html.includes('data-testid="connections-retry"'), true);
    assert.equal(has(html, en('loadError')), true);
    assert.equal(has(html, en('retry')), true);
    const action = render({ mail: { ...IDLE_CARD_STATUS, errorKey: 'errors.network' } });
    assert.equal(has(action, en('errors.network')), true);
  });

  test('Traditional and Simplified Chinese render instead of English', () => {
    const tw = render({}, zhTwMessages as Messages);
    assert.equal(tw.includes('連線'), true);
    assert.equal(tw.includes('連接郵件'), true);
    assert.equal(tw.includes('>Connect mail<'), false);
    const cn = render({ connections: CONNECTED }, zhCnMessages as Messages);
    assert.equal(cn.includes('验证'), true);
    assert.equal(cn.includes('>Verify<'), false);
  });
});

describe('connections api', () => {
  test('loads the list and keeps only public fields', async () => {
    const { fetcher, calls } = stubFetcher(200, {
      connections: [
        { ...CONNECTED.imap, secretCiphertext: 'v1.x', appPassword: 'abcd efgh' },
        { ...CONNECTED.ical, url: 'https://calendar.example/secret.ics' },
      ],
    });
    const result = await loadConnections(fetcher);
    assert.equal(calls[0].path, '/api/connectors');
    assert.equal(calls[0].method, 'GET');
    assert.equal(result.type, 'ok');
    assert.ok(result.type === 'ok');
    assert.deepEqual(result.value, CONNECTED);
    assert.equal(JSON.stringify(result.value).includes('secret'), false);
    assert.equal(JSON.stringify(result.value).includes('abcd'), false);
  });

  test('an empty list is valid and a malformed list is a load error', async () => {
    assert.deepEqual(parseConnections({ connections: [] }), NO_CONNECTIONS);
    assert.equal(parseConnections({ connections: [{ kind: 'imap', preset: 'outlook' }] }), null);
    assert.equal(parseConnections({}), null);
    const result = await loadConnections(stubFetcher(200, { connections: 'x' }).fetcher);
    assert.deepEqual(result, { type: 'failed', errorKey: 'loadError' });
  });

  test('401, 403 and 503 not configured map to page states', async () => {
    assert.deepEqual(await loadConnections(stubFetcher(401, nestError(401, 'Missing')).fetcher), {
      type: 'unauthorized',
    });
    assert.deepEqual(await loadConnections(stubFetcher(403, nestError(403, 'Forbidden')).fetcher), {
      type: 'forbidden',
    });
    assert.deepEqual(
      await loadConnections(stubFetcher(503, nestError(503, CONNECTIONS_NOT_CONFIGURED_MESSAGE)).fetcher),
      { type: 'unavailable' },
    );
    assert.deepEqual(
      await connectMail(
        { preset: 'gmail', username: 'a@b.co', appPassword: 'abcdefgh' },
        stubFetcher(503, nestError(503, CONNECTIONS_NOT_CONFIGURED_MESSAGE)).fetcher,
      ),
      { type: 'unavailable' },
    );
  });

  test('a network failure is a load error that can be retried', async () => {
    assert.deepEqual(await loadConnections(throwingFetcher), { type: 'failed', errorKey: 'loadError' });
    assert.deepEqual(await verifyConnection('imap', throwingFetcher), {
      type: 'failed',
      errorKey: 'errors.network',
    });
  });

  test('connect mail posts the preset, trimmed address and app password once', async () => {
    const { fetcher, calls } = stubFetcher(200, CONNECTED.imap);
    const result = await connectMail(
      { preset: 'gmail', username: '  owner@gmail.com ', appPassword: 'abcd efgh ijkl mnop' },
      fetcher,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, '/api/connectors/imap');
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(calls[0].body, {
      preset: 'gmail',
      username: 'owner@gmail.com',
      appPassword: 'abcd efgh ijkl mnop',
    });
    assert.deepEqual(result, { type: 'ok', value: CONNECTED.imap });
  });

  test('connect calendar posts the link', async () => {
    const { fetcher, calls } = stubFetcher(200, CONNECTED.ical);
    const result = await connectCalendar(' https://calendar.google.com/calendar/ical/x/private-y/basic.ics ', fetcher);
    assert.equal(calls[0].path, '/api/connectors/ical');
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(calls[0].body, {
      url: 'https://calendar.google.com/calendar/ical/x/private-y/basic.ics',
    });
    assert.deepEqual(result, { type: 'ok', value: CONNECTED.ical });
  });

  test('a refused connect maps the backend fixed 400 message to its key', async () => {
    const cases: Array<[string, string]> = [
      ['Preset must be gmail, yahoo, or icloud.', 'errors.preset'],
      ['Username must be an email address.', 'errors.username'],
      ['App password must be 8 to 64 characters.', 'errors.appPassword'],
      ['Connector request is invalid.', 'errors.invalid'],
    ];
    for (const [message, key] of cases) {
      const result = await connectMail(
        { preset: 'gmail', username: 'x', appPassword: 'y' },
        stubFetcher(400, nestError(400, message)).fetcher,
      );
      assert.deepEqual(result, { type: 'failed', errorKey: key }, message);
    }
    assert.deepEqual(
      await connectCalendar(
        'http://x',
        stubFetcher(400, nestError(400, 'Calendar link must be an https URL with a host name.')).fetcher,
      ),
      { type: 'failed', errorKey: 'errors.icalUrl' },
    );
    assert.deepEqual(
      await connectMail(
        { preset: 'gmail', username: 'x', appPassword: 'y' },
        stubFetcher(400, nestError(400, 'Something new.')).fetcher,
      ),
      { type: 'failed', errorKey: 'errors.connectFailed' },
    );
  });

  test('verify success returns the time; failures map the fixed messages', async () => {
    const { fetcher, calls } = stubFetcher(200, { ok: true, lastVerifiedAt: '2026-11-09T10:00:00.000Z' });
    assert.deepEqual(await verifyConnection('imap', fetcher), {
      type: 'ok',
      value: { lastVerifiedAt: '2026-11-09T10:00:00.000Z' },
    });
    assert.equal(calls[0].path, '/api/connectors/imap/verify');
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(
      await verifyConnection('imap', stubFetcher(502, nestError(502, 'could not reach the mail server')).fetcher),
      { type: 'failed', errorKey: 'errors.mailVerifyFailed' },
    );
    assert.deepEqual(
      await verifyConnection('ical', stubFetcher(502, nestError(502, 'the calendar link could not be read')).fetcher),
      { type: 'failed', errorKey: 'errors.calendarVerifyFailed' },
    );
    assert.deepEqual(
      await verifyConnection('ical', stubFetcher(404, nestError(404, 'Connection not found.')).fetcher),
      { type: 'failed', errorKey: 'errors.notFound' },
    );
    assert.deepEqual(
      await verifyConnection('imap', stubFetcher(503, nestError(503, 'The connector service is busy.')).fetcher),
      { type: 'failed', errorKey: 'errors.mailVerifyFailed' },
    );
  });

  test('disconnect sends DELETE and treats 204 as done', async () => {
    const { fetcher, calls } = stubFetcher(204, null);
    assert.deepEqual(await disconnectConnection('ical', fetcher), { type: 'ok', value: null });
    assert.equal(calls[0].path, '/api/connectors/ical');
    assert.equal(calls[0].method, 'DELETE');
    assert.deepEqual(
      await disconnectConnection('imap', stubFetcher(500, nestError(500, 'Could not delete the connection.')).fetcher),
      { type: 'failed', errorKey: 'errors.deleteFailed' },
    );
    assert.deepEqual(await disconnectConnection('imap', throwingFetcher), {
      type: 'failed',
      errorKey: 'errors.network',
    });
  });
});

describe('connections locale catalog', () => {
  test('every connections key exists and is non-empty in en, zh-TW and zh-CN', () => {
    const keySets = LOCALES.map(({ code, messages }) => ({
      code,
      messages,
      keys: leafKeys(messages.connections, 'connections').sort(),
    }));
    assert.ok(keySets[0].keys.length > 50);
    for (const entry of keySets) {
      assert.deepEqual(entry.keys, keySets[0].keys, `${entry.code} connections keys differ`);
      for (const key of entry.keys) {
        const value = readMessage(entry.messages, key);
        assert.ok(value && value.trim().length > 0, `Empty ${key} in ${entry.code}`);
      }
      assert.ok(readMessage(entry.messages, 'platform.openConnections'), `${entry.code} header link`);
    }
  });

  test('Chinese copy is real Chinese apart from brand names and placeholders', () => {
    const latinOnly = new Set([
      'connections.presets.gmail',
      'connections.presets.yahoo',
      'connections.presets.icloud',
      'connections.mail.emailPlaceholder',
      'connections.calendar.linkPlaceholder',
    ]);
    for (const { code, messages } of LOCALES.slice(1)) {
      for (const key of leafKeys(messages.connections, 'connections')) {
        if (latinOnly.has(key)) continue;
        const value = readMessage(messages, key) ?? '';
        assert.match(value, /[一-鿿]/, `${key} in ${code} is not Chinese`);
        assert.notEqual(value, readMessage(EN, key), `${key} in ${code} is the English text`);
      }
    }
    assert.notEqual(
      readMessage(zhTwMessages as Messages, 'connections.dataStatement.sentToProvider'),
      readMessage(zhCnMessages as Messages, 'connections.dataStatement.sentToProvider'),
    );
  });

  test('every mapped server message and fallback has catalog copy', () => {
    const keys = new Set([
      ...Object.values(CONNECTION_SERVER_MESSAGE_KEYS),
      'loadError',
      'errors.connectFailed',
      'errors.disconnectFailed',
      'errors.network',
    ]);
    for (const { code, messages } of LOCALES) {
      for (const key of keys) {
        assert.ok(readMessage(messages, `connections.${key}`), `${key} missing in ${code}`);
      }
    }
    for (const message of [
      'Preset must be gmail, yahoo, or icloud.',
      'Username must be an email address.',
      'App password must be 8 to 64 characters.',
      'Calendar link must be an https URL with a host name.',
    ]) {
      assert.equal(en(CONNECTION_SERVER_MESSAGE_KEYS[message]), message, 'en shows the fixed 400 text');
    }
  });
});

describe('connections page wiring', () => {
  const screen = readFileSync(join(here, 'connections-screen.tsx'), 'utf8');
  const api = readFileSync(join(here, 'connections-api.ts'), 'utf8');

  test('the route renders the screen with the connections catalog and the auth gate', () => {
    const pagePath = join(here, '../../app/[locale]/connections/page.tsx');
    assert.equal(existsSync(pagePath), true);
    assert.match(readFileSync(pagePath, 'utf8'), /<ConnectionsScreen locale=\{locale\} \/>/);
    assert.match(screen, /useTranslations\('connections'\)/);
    assert.match(screen, /\/api\/auth\/me/);
    assert.match(screen, /\/\$\{locale\}\/login/);
    assert.doesNotMatch(screen, />Connect mail</);
    assert.doesNotMatch(screen, />Disconnect</);
  });

  test('the backend routes match CONN-02A and CONN-02B', () => {
    assert.match(api, /'\/api\/connectors'/);
    assert.match(api, /'\/api\/connectors\/imap'/);
    assert.match(api, /'\/api\/connectors\/ical'/);
    assert.match(api, /`\/api\/connectors\/\$\{kind\}\/verify`/);
    assert.match(api, /`\/api\/connectors\/\$\{kind\}`, \{ method: 'DELETE' \}/);
    assert.match(api, /knowledgeFetch/);
  });

  test('secrets are never logged or stored in the browser, and the field is cleared on submit', () => {
    for (const source of [screen, api]) {
      assert.doesNotMatch(source, /console\./);
      assert.doesNotMatch(source, /localStorage|sessionStorage/);
    }
    assert.match(screen, /clearField\(form, 'appPassword'\)/);
    assert.match(screen, /clearField\(form, 'url'\)/);
    assert.doesNotMatch(screen, /useState<[^>]*appPassword/);
  });

  test('icons are Heroicons v2 outline only', () => {
    assert.match(screen, /from '@heroicons\/react\/24\/outline'/);
    assert.doesNotMatch(screen, /@heroicons\/react\/(24|20|16)\/solid/);
  });

  test('the platform header links to connections beside Knowledge', () => {
    const dashboard = readFileSync(join(here, '../platform/platform-dashboard.tsx'), 'utf8');
    assert.match(dashboard, /platform\.openConnections/);
    assert.match(dashboard, /href=\{`\$\{localePrefix\}\/connections`\}/);
    const knowledge = dashboard.indexOf('data-testid="platform-open-knowledge"');
    const connections = dashboard.indexOf('data-testid="platform-open-connections"');
    const workspace = dashboard.indexOf('data-testid="platform-back-to-workspace"');
    assert.ok(knowledge > 0 && connections > knowledge && workspace > connections);
    assert.doesNotMatch(dashboard, /@heroicons\/react\/24\/solid/);
  });
});
