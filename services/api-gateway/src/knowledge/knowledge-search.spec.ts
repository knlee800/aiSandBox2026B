import { BadRequestException } from '@nestjs/common';
import {
  KNOWLEDGE_SEARCH_MAX_HITS,
  KNOWLEDGE_SEARCH_MAX_PREVIEW_CHARS,
  KnowledgeSearchDocument,
  normalizeKnowledgeSearchQuery,
  readKnowledgeSection,
  searchKnowledgeDocuments,
} from './knowledge-search';

function doc(
  id: string,
  overrides: Partial<KnowledgeSearchDocument> = {},
): KnowledgeSearchDocument {
  return {
    id,
    title: 'Note',
    content: 'match',
    scopeId: 'policies',
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('knowledge search', () => {
  it('returns 20 hits and truncated true when a 21st document matches', () => {
    const documents = Array.from({ length: 21 }, (_, index) => {
      const id = `d${String(index + 1).padStart(2, '0')}`;
      return doc(id, { title: `Title ${id}`, content: 'alpha match' });
    });

    const found = searchKnowledgeDocuments(documents, 'match');

    expect(KNOWLEDGE_SEARCH_MAX_HITS).toBe(20);
    expect(found.results).toHaveLength(20);
    expect(found.truncated).toBe(true);
    expect(found.results.map((hit) => hit.documentId)).toEqual(
      documents.slice(0, 20).map((document) => document.id),
    );
    expect(found.results[0]).toEqual({
      documentId: 'd01',
      title: 'Title d01',
      scopeId: 'policies',
      heading: null,
      preview: 'alpha match',
    });
    expect(found.results.some((hit) => hit.documentId === 'd21')).toBe(false);

    const twenty = searchKnowledgeDocuments(documents.slice(0, 20), 'match');
    expect(twenty.results).toHaveLength(20);
    expect(twenty.truncated).toBe(false);
  });

  it('orders by updatedAt descending and then id ascending', () => {
    const older = doc('b', { updatedAt: new Date('2026-11-01T00:00:00.000Z') });
    const newer = doc('z', {
      updatedAt: new Date('2026-11-02T00:00:00.000Z'),
      title: 'Newer',
    });
    const sameTime = doc('a', { updatedAt: older.updatedAt, title: 'Same' });
    const found = searchKnowledgeDocuments([older, newer, sameTime], 'match');
    expect(found.results.map((hit) => hit.documentId)).toEqual(['z', 'a', 'b']);
  });

  it('caps a preview at 240 characters and treats percent and underscore as literal', () => {
    const longLine = `m${'a'.repeat(KNOWLEDGE_SEARCH_MAX_PREVIEW_CHARS)}`;
    const tabbed = doc('tabs', { content: '\tmatch\there' });
    const long = doc('long', { content: longLine });
    const percent = doc('percent', { title: 'Percent', content: '100% sure' });
    const underscore = doc('under', { title: 'Under', content: 'a_b' });
    const wildcard = doc('wild', { title: 'Wild', content: '100 sure and axb' });

    const preview = searchKnowledgeDocuments([long], 'm');
    expect(preview.results[0].preview).toHaveLength(KNOWLEDGE_SEARCH_MAX_PREVIEW_CHARS);
    expect(preview.results[0].preview.endsWith('...')).toBe(true);

    const exact = searchKnowledgeDocuments(
      [doc('exact', { content: 'm'.repeat(KNOWLEDGE_SEARCH_MAX_PREVIEW_CHARS) })],
      'm',
    );
    expect(exact.results[0].preview).toHaveLength(KNOWLEDGE_SEARCH_MAX_PREVIEW_CHARS);
    expect(exact.results[0].preview.endsWith('...')).toBe(false);

    expect(searchKnowledgeDocuments([tabbed], 'match').results[0].preview).toBe(
      'match here',
    );

    const literal = searchKnowledgeDocuments(
      [percent, underscore, wildcard],
      '100%',
    );
    expect(literal.results.map((hit) => hit.documentId)).toEqual(['percent']);

    const underscored = searchKnowledgeDocuments([underscore, wildcard], 'a_b');
    expect(underscored.results.map((hit) => hit.documentId)).toEqual(['under']);
  });

  it('uses the first matching line and the nearest preceding heading', () => {
    const content = ['# Policies', 'intro', '## Leave', 'People may match here.'].join(
      '\n',
    );
    const found = searchKnowledgeDocuments(
      [doc('body', { title: 'Leave policy', content })],
      'match',
    );
    expect(found.results[0]).toEqual({
      documentId: 'body',
      title: 'Leave policy',
      scopeId: 'policies',
      heading: 'Leave',
      preview: 'People may match here.',
    });

    const titleOnly = searchKnowledgeDocuments(
      [doc('title', { title: 'Quarterly match', content: 'no hit here' })],
      'match',
    );
    expect(titleOnly.results[0]).toEqual({
      documentId: 'title',
      title: 'Quarterly match',
      scopeId: 'policies',
      heading: null,
      preview: 'Quarterly match',
    });
  });

  it('rejects a blank, control-character, or over-long query', () => {
    expect(() => normalizeKnowledgeSearchQuery('   ')).toThrow(BadRequestException);
    expect(() => normalizeKnowledgeSearchQuery('hello\n')).toThrow(BadRequestException);
    expect(() => normalizeKnowledgeSearchQuery('a'.repeat(121))).toThrow(BadRequestException);
    expect(normalizeKnowledgeSearchQuery('  hello   world  ')).toBe('hello world');
    try {
      normalizeKnowledgeSearchQuery('hello\n');
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ code: 'QUERY_UNSUPPORTED' }),
      );
    }
  });
});

describe('knowledge sections', () => {
  const content = [
    '# A',
    'keep a',
    '## B',
    'keep b',
    '### C',
    'keep c',
    '## D',
    'drop d',
    '# E',
    'end',
  ].join('\n');

  it('returns the section through the next heading of equal or higher rank', () => {
    expect(readKnowledgeSection(content, 'B')).toEqual({
      heading: 'B',
      content: ['## B', 'keep b', '### C', 'keep c'].join('\n'),
    });
    expect(readKnowledgeSection(content, 'b')?.heading).toBe('B');
    expect(readKnowledgeSection(content, '# B')?.heading).toBe('B');
    expect(readKnowledgeSection(content, '## B')?.content.startsWith('## B')).toBe(true);
    expect(readKnowledgeSection(content, 'A')?.content.endsWith('drop d')).toBe(true);
    expect(readKnowledgeSection(content, 'A')?.content).not.toContain('# E');
  });

  it('strips one ATX marker and keeps a later hash', () => {
    const hashed = '## # Leave\nbody';
    expect(readKnowledgeSection(hashed, '# # Leave')).toEqual({
      heading: '# Leave',
      content: hashed,
    });
  });

  it('returns the whole document when no heading is requested', () => {
    expect(readKnowledgeSection(content, null)).toEqual({
      heading: null,
      content,
    });
    expect(readKnowledgeSection(content, '   ')).toEqual({
      heading: null,
      content,
    });
  });

  it('returns null when the heading is missing and ignores setext headings', () => {
    expect(readKnowledgeSection(content, 'Missing')).toBeNull();
    const setext = 'Title\n=====\nbody';
    expect(readKnowledgeSection(setext, 'Title')).toBeNull();
  });

  it('uses the first matching heading', () => {
    const repeated = '## B\nfirst\n## B\nsecond';
    expect(readKnowledgeSection(repeated, 'B')).toEqual({
      heading: 'B',
      content: '## B\nfirst',
    });
  });
});
