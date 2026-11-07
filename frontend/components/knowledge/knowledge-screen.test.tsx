import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  KNOWLEDGE_SERVER_ERROR_KEYS,
  parseKnowledgeDocuments,
  parseKnowledgeScopes,
} from '@/components/knowledge/knowledge-api';
import {
  fillKnowledgeTemplate,
  formatKnowledgeKilobytes,
  isKnowledgeUploadName,
} from '@/components/knowledge/knowledge-limits';
import {
  KnowledgeScreenView,
  type KnowledgeScreenViewProps,
} from '@/components/knowledge/knowledge-screen';
import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';

const LOCALES = [
  { code: 'en', messages: enMessages as Record<string, unknown> },
  { code: 'zh-TW', messages: zhTwMessages as Record<string, unknown> },
  { code: 'zh-CN', messages: zhCnMessages as Record<string, unknown> },
];

function readMessage(source: Record<string, unknown>, path: string): string | null {
  let current: unknown = source;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : null;
}

function leafKeys(value: unknown, prefix: string): string[] {
  if (typeof value === 'string') {
    return [prefix];
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function translator(messages: Record<string, unknown>) {
  return (key: string) => readMessage(messages, `knowledge.${key}`) ?? `knowledge.${key}`;
}

function renderKnowledge(
  overrides: Partial<KnowledgeScreenViewProps> = {},
  messages: Record<string, unknown> = enMessages as Record<string, unknown>,
): string {
  const props: KnowledgeScreenViewProps = {
    t: translator(messages),
    locale: 'en',
    phase: 'ready',
    scopes: [
      { id: 'policies', type: 'shared' },
      { id: 'tech-landscape', type: 'specialist' },
    ],
    selectedScopeId: 'policies',
    documents: [],
    usage: { count: 0, bytes: 0 },
    formMode: null,
    replaceTitle: null,
    pendingDelete: null,
    actionErrorKey: null,
    busy: false,
    onSelectScope: () => undefined,
    onRetry: () => undefined,
    onRefresh: () => undefined,
    onStartAdd: () => undefined,
    onStartReplace: () => undefined,
    onAskDelete: () => undefined,
    onCancelDelete: () => undefined,
    onConfirmDelete: () => undefined,
    onCancelForm: () => undefined,
    onSubmit: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(<KnowledgeScreenView {...props} />);
}

describe('knowledge screen states', () => {
  test('shows the loading state without the document list', () => {
    const html = renderKnowledge({ phase: 'loading' });
    const loading = readMessage(enMessages as Record<string, unknown>, 'knowledge.loading');
    assert.ok(loading);
    assert.equal(html.includes('data-testid="knowledge-loading"'), true);
    assert.equal(html.includes(loading), true);
    assert.equal(html.includes('data-testid="knowledge-add"'), false);
    assert.equal(html.includes('data-testid="knowledge-document-list"'), false);
  });

  test('shows the load error and retry action', () => {
    const html = renderKnowledge({ phase: 'error' });
    const message = readMessage(enMessages as Record<string, unknown>, 'knowledge.loadError');
    const retry = readMessage(enMessages as Record<string, unknown>, 'knowledge.retry');
    assert.ok(message && retry);
    assert.equal(html.includes('data-testid="knowledge-error"'), true);
    assert.equal(html.includes(message), true);
    assert.equal(html.includes(retry), true);
    assert.equal(html.includes('data-testid="knowledge-empty"'), false);
  });

  test('shows the forbidden state', () => {
    const html = renderKnowledge({ phase: 'forbidden' });
    const message = readMessage(enMessages as Record<string, unknown>, 'knowledge.forbidden');
    assert.ok(message);
    assert.equal(html.includes('data-testid="knowledge-forbidden"'), true);
    assert.equal(html.includes(message), true);
    assert.equal(html.includes('data-testid="knowledge-add"'), false);
  });

  test('shows an empty scope, limits and the add action', () => {
    const html = renderKnowledge({ usage: { count: 2, bytes: 2048 } });
    const messages = enMessages as Record<string, unknown>;
    const emptyTitle = readMessage(messages, 'knowledge.emptyTitle');
    const limits = fillKnowledgeTemplate(readMessage(messages, 'knowledge.limits') ?? '', {
      count: '2',
      maxDocuments: '50',
      usedKilobytes: '2',
      maxKilobytes: '4096',
    });
    const perDocument = fillKnowledgeTemplate(readMessage(messages, 'knowledge.perDocumentLimit') ?? '', {
      maxDocumentKilobytes: '200',
    });
    assert.ok(emptyTitle);
    assert.equal(html.includes('data-testid="knowledge-empty"'), true);
    assert.equal(html.includes(emptyTitle), true);
    assert.equal(html.includes('data-testid="knowledge-limits"'), true);
    assert.equal(html.includes(limits), true);
    assert.equal(html.includes(perDocument), true);
    assert.equal(html.includes(readMessage(messages, 'knowledge.addButton') ?? ''), true);
    assert.equal(html.includes('Policies'), true);
    assert.equal(html.includes('Shared'), true);
    assert.equal(html.includes('Technology landscape'), true);
    assert.equal(html.includes('Specialist'), true);
  });

  test('lists a document title and does not render stored content', () => {
    const html = renderKnowledge({
      documents: [
        {
          id: 'doc-1',
          scopeId: 'policies',
          title: 'Handbook',
          byteSize: 2048,
          updatedAt: '2026-11-05T01:02:03.000Z',
        },
      ],
      usage: { count: 2, bytes: 2048 },
    });
    assert.equal(html.includes('Handbook'), true);
    assert.equal(html.includes('data-testid="knowledge-document-doc-1"'), true);
    assert.equal(html.includes('data-testid="knowledge-replace-doc-1"'), true);
    assert.equal(html.includes('data-testid="knowledge-delete-doc-1"'), true);
    assert.equal(html.includes('INTERNAL_ONLY_CONTENT'), false);
    assert.equal(html.includes('data-testid="knowledge-empty"'), false);
    assert.equal(html.includes('2 KB'), true);
  });

  test('shows delete confirmation and the add and replace forms', () => {
    const messages = enMessages as Record<string, unknown>;
    const confirm = renderKnowledge({
      pendingDelete: { id: 'doc-1', title: 'Handbook' },
    });
    assert.equal(confirm.includes('data-testid="knowledge-delete-confirm"'), true);
    assert.equal(confirm.includes(readMessage(messages, 'knowledge.deleteConfirmTitle') ?? ''), true);
    assert.equal(confirm.includes('Handbook'), true);

    const add = renderKnowledge({ formMode: 'add' });
    assert.equal(add.includes('data-testid="knowledge-form"'), true);
    assert.equal(add.includes(readMessage(messages, 'knowledge.addTitle') ?? ''), true);
    assert.equal(add.includes('data-testid="knowledge-title"'), true);
    assert.equal(add.includes('data-testid="knowledge-content"'), true);
    assert.equal(add.includes('accept=".md,.txt"'), true);
    assert.equal(add.includes(readMessage(messages, 'knowledge.fileHint') ?? ''), true);

    const replace = renderKnowledge({
      formMode: 'replace',
      replaceTitle: 'Handbook',
    });
    assert.equal(replace.includes(readMessage(messages, 'knowledge.replaceTitle') ?? ''), true);
    assert.equal(replace.includes('value="Handbook"'), true);
    assert.equal(/readonly/i.test(replace), true);
  });

  test('shows a translated action error', () => {
    const html = renderKnowledge({ actionErrorKey: 'validationTitle' });
    const message = readMessage(enMessages as Record<string, unknown>, 'knowledge.validationTitle');
    assert.ok(message);
    assert.equal(html.includes('data-testid="knowledge-action-error"'), true);
    assert.equal(html.includes(message), true);
  });

  test('renders Traditional Chinese copy instead of the English title and add action', () => {
    const html = renderKnowledge({ phase: 'ready' }, zhTwMessages as Record<string, unknown>);
    assert.equal(html.includes('知識庫'), true);
    assert.equal(html.includes('新增文件'), true);
    assert.equal(html.includes('>Add document<'), false);
    assert.equal(html.includes('>Knowledge<'), false);
  });
});

describe('knowledge locale catalog', () => {
  test('every knowledge key exists in en, zh-TW and zh-CN', () => {
    const keySets = LOCALES.map(({ code, messages }) => ({
      code,
      keys: leafKeys(messages.knowledge, 'knowledge').sort(),
    }));
    assert.ok(keySets[0].keys.length > 0);
    for (const entry of keySets) {
      assert.deepEqual(entry.keys, keySets[0].keys, `${entry.code} knowledge keys differ`);
      for (const key of entry.keys) {
        const value = readMessage(
          LOCALES.find((locale) => locale.code === entry.code)?.messages ?? {},
          key,
        );
        assert.ok(value && value.trim().length > 0, `Empty ${key} in ${entry.code}`);
      }
    }
  });

  test('the nine scope ids have labels and Chinese copy uses 代理', () => {
    const scopeIds = [
      'company-monthly-reports',
      'three-year-goals',
      'strategy-docs',
      'policies',
      'meeting-summaries',
      'codebase-context',
      'contract-templates',
      'market-data',
      'tech-landscape',
    ];
    assert.equal(scopeIds.length, 9);
    for (const { code, messages } of LOCALES) {
      for (const id of scopeIds) {
        const value = readMessage(messages, `knowledge.scopes.${id}`);
        assert.ok(value && value.trim().length > 0, `Missing scope ${id} in ${code}`);
      }
      assert.ok(readMessage(messages, 'knowledge.scopeType.shared'));
      assert.ok(readMessage(messages, 'knowledge.scopeType.specialist'));
      assert.ok(readMessage(messages, 'platform.openKnowledge'));
    }
    for (const code of ['zh-TW', 'zh-CN'] as const) {
      const messages = LOCALES.find((locale) => locale.code === code)?.messages;
      assert.ok(messages);
      const knowledge = JSON.stringify(messages.knowledge);
      assert.equal(knowledge.includes('智能体'), false, `${code} must not use 智能体`);
      assert.equal(String(readMessage(messages, 'knowledge.subtitle')).includes('代理'), true);
    }
  });

  test('server error codes map to catalog keys', () => {
    for (const key of Object.values(KNOWLEDGE_SERVER_ERROR_KEYS)) {
      for (const { code, messages } of LOCALES) {
        const value = readMessage(messages, `knowledge.${key}`);
        assert.ok(value, `Missing ${key} in ${code}`);
      }
    }
  });
});

describe('knowledge helpers', () => {
  test('formats kilobytes and accepts only markdown or text names', () => {
    assert.equal(formatKnowledgeKilobytes(0), '0');
    assert.equal(formatKnowledgeKilobytes(2048), '2');
    assert.equal(formatKnowledgeKilobytes(1536), '1.5');
    assert.equal(formatKnowledgeKilobytes(200 * 1024), '200');
    assert.equal(formatKnowledgeKilobytes(4 * 1024 * 1024), '4096');
    assert.equal(isKnowledgeUploadName('Notes.MD'), true);
    assert.equal(isKnowledgeUploadName('plain.txt'), true);
    assert.equal(isKnowledgeUploadName('notes.pdf'), false);
  });

  test('parses scope and document payloads and drops document content', () => {
    assert.equal(parseKnowledgeScopes({ scopes: [{ id: 'policies', type: 'shared' }] })?.[0].id, 'policies');
    assert.equal(parseKnowledgeScopes({ scopes: [{ id: 'policies', type: 'other' }] }), null);
    const documents = parseKnowledgeDocuments({
      documents: [
        {
          id: 'doc-1',
          scopeId: 'policies',
          title: 'Handbook',
          byteSize: 12,
          updatedAt: '2026-11-05T00:00:00.000Z',
          content: 'secret',
        },
      ],
    });
    assert.ok(documents);
    assert.equal(documents[0].title, 'Handbook');
    assert.equal('content' in documents[0], false);
    assert.equal(parseKnowledgeDocuments({ documents: [{ id: 'x' }] }), null);
  });
});

describe('knowledge page wiring', () => {
  test('the page and screen use the knowledge catalog and the office-style auth gate', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const page = readFileSync(join(here, '../../app/[locale]/knowledge/page.tsx'), 'utf8');
    const screen = readFileSync(join(here, 'knowledge-screen.tsx'), 'utf8');
    assert.match(page, /KnowledgeScreen/);
    assert.match(screen, /useTranslations\('knowledge'\)/);
    assert.match(screen, /\/api\/auth\/me/);
    assert.match(screen, /\/\$\{locale\}\/login/);
    assert.doesNotMatch(screen, />Knowledge</);
    assert.doesNotMatch(screen, />Add document</);
  });
});
