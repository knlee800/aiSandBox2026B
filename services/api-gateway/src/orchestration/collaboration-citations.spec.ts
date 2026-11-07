import {
  BUSINESS_ROLE_PROFILE_IDS,
  collaborationAnswerCitations,
  parseCollaborationSourceMarkers,
  type CitationDocument,
} from './collaboration-citations';

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DOC_A = '33333333-3333-4333-8333-333333333333';
const DOC_B = '44444444-4444-4444-8444-444444444444';
const DOC_DELETED = '55555555-5555-4555-8555-555555555555';
const DOC_FOREIGN = '66666666-6666-4666-8666-666666666666';

function document(overrides: Partial<CitationDocument> & Pick<CitationDocument, 'id'>): CitationDocument {
  return {
    userId: OWNER_ID,
    title: 'Handbook',
    scopeId: 'policies',
    deletedAt: null,
    ...overrides,
  };
}

describe('parseCollaborationSourceMarkers', () => {
  it('reads a document id and heading, including a heading with spaces', () => {
    const parsed = parseCollaborationSourceMarkers(
      `Revenue rose [source: ${DOC_A}#Quarter one] after the note.`,
    );

    expect(parsed.invalidCount).toBe(0);
    expect(parsed.markers).toEqual([{ documentId: DOC_A, heading: 'Quarter one' }]);
  });

  it('keeps a marker that has no heading', () => {
    const parsed = parseCollaborationSourceMarkers(
      `See [source: ${DOC_A}] and [source:${DOC_B}].`,
    );

    expect(parsed.invalidCount).toBe(0);
    expect(parsed.markers).toEqual([
      { documentId: DOC_A, heading: null },
      { documentId: DOC_B, heading: null },
    ]);
  });

  it('drops a marker whose id is not a UUID', () => {
    const parsed = parseCollaborationSourceMarkers(
      `See [source: policies] and [source: ${DOC_A}#Quarter] and [source: ${DOC_A}#].`,
    );

    expect(parsed.markers).toEqual([{ documentId: DOC_A, heading: 'Quarter' }]);
    expect(parsed.invalidCount).toBe(2);
  });

  it('keeps the first of two identical markers and preserves first-seen order', () => {
    const parsed = parseCollaborationSourceMarkers(
      `[source: ${DOC_B}#Later] [source: ${DOC_A}] [source: ${DOC_B.toUpperCase()}#Later] [source: ${DOC_A}#Other]`,
    );

    expect(parsed.invalidCount).toBe(0);
    expect(parsed.markers).toEqual([
      { documentId: DOC_B, heading: 'Later' },
      { documentId: DOC_A, heading: null },
      { documentId: DOC_B, heading: 'Later' },
      { documentId: DOC_A, heading: 'Other' },
    ]);
  });

  it('still reads a marker that sits inside a code fence', () => {
    const parsed = parseCollaborationSourceMarkers('```\n[source: ' + DOC_A + '#Quarter]\n```');

    expect(parsed.markers).toEqual([{ documentId: DOC_A, heading: 'Quarter' }]);
    expect(parsed.invalidCount).toBe(0);
  });
});

describe('collaborationAnswerCitations', () => {
  const documents: CitationDocument[] = [
    document({ id: DOC_A, title: 'Handbook', scopeId: 'policies' }),
    document({ id: DOC_B, title: 'Goals', scopeId: 'three-year-goals' }),
    document({ id: DOC_DELETED, title: 'Old', scopeId: 'policies', deletedAt: new Date('2026-11-01T00:00:00.000Z') }),
    document({ id: DOC_FOREIGN, userId: OTHER_ID, title: 'Theirs', scopeId: 'policies' }),
  ];

  it('keeps the owner active document and drops deleted, foreign and unknown markers', () => {
    const unknown = '77777777-7777-4777-8777-777777777777';
    const result = collaborationAnswerCitations({
      completed: true,
      answer: [
        `Kept [source: ${DOC_A}#Quarter].`,
        `Again [source: ${DOC_A}#Quarter].`,
        `Gone [source: ${DOC_DELETED}].`,
        `Theirs [source: ${DOC_FOREIGN}#Note].`,
        `Missing [source: ${unknown}].`,
        'Bad [source: not-a-uuid].',
      ].join(' '),
      targetProfileId: 'lead',
      ownerId: OWNER_ID,
      documents,
    });

    expect(result.sources).toEqual([
      { documentId: DOC_A, title: 'Handbook', scopeId: 'policies', heading: 'Quarter' },
    ]);
    expect(Object.keys(result.sources[0]).sort()).toEqual([
      'documentId',
      'heading',
      'scopeId',
      'title',
    ]);
    expect(result.droppedSourceCount).toBe(4);
    expect(result.unsourced).toBe(false);
    expect(result.showUnsourced).toBe(false);
  });

  it('deduplicates by document and heading in first-seen order', () => {
    const result = collaborationAnswerCitations({
      completed: true,
      answer: `[source: ${DOC_B}] [source: ${DOC_A}#Quarter] [source: ${DOC_B}] [source: ${DOC_A}]`,
      targetProfileId: 'lead',
      ownerId: OWNER_ID,
      documents,
    });

    expect(result.sources).toEqual([
      { documentId: DOC_B, title: 'Goals', scopeId: 'three-year-goals', heading: null },
      { documentId: DOC_A, title: 'Handbook', scopeId: 'policies', heading: 'Quarter' },
      { documentId: DOC_A, title: 'Handbook', scopeId: 'policies', heading: null },
    ]);
    expect(result.droppedSourceCount).toBe(0);
    expect(result.unsourced).toBe(false);
  });

  it('leaves showUnsourced false when the caller passes an empty business-role list', () => {
    const result = collaborationAnswerCitations({
      completed: true,
      answer: 'No marker here.',
      targetProfileId: 'chief-of-staff',
      ownerId: OWNER_ID,
      documents,
      businessRoleProfileIds: [],
    });

    expect(result.sources).toEqual([]);
    expect(result.droppedSourceCount).toBe(0);
    expect(result.unsourced).toBe(true);
    expect(result.showUnsourced).toBe(false);
  });

  it('sets showUnsourced for each business role answer with no valid marker', () => {
    expect(BUSINESS_ROLE_PROFILE_IDS).toEqual([
      'chief-of-staff',
      'advisors-lead',
      'product-strategy',
      'technology-advisor',
    ]);

    for (const targetProfileId of BUSINESS_ROLE_PROFILE_IDS) {
      const result = collaborationAnswerCitations({
        completed: true,
        answer: 'No marker here.',
        targetProfileId,
        ownerId: OWNER_ID,
        documents,
      });

      expect(result.sources).toEqual([]);
      expect(result.unsourced).toBe(true);
      expect(result.showUnsourced).toBe(true);
    }
  });

  it('sets showUnsourced only for a listed business role with no valid source', () => {
    const roles = ['chief-of-staff'];
    const unsourced = collaborationAnswerCitations({
      completed: true,
      answer: 'No marker here.',
      targetProfileId: 'chief-of-staff',
      ownerId: OWNER_ID,
      documents,
      businessRoleProfileIds: roles,
    });
    const sourced = collaborationAnswerCitations({
      completed: true,
      answer: `See [source: ${DOC_A}].`,
      targetProfileId: 'chief-of-staff',
      ownerId: OWNER_ID,
      documents,
      businessRoleProfileIds: roles,
    });
    const otherTarget = collaborationAnswerCitations({
      completed: true,
      answer: 'No marker here.',
      targetProfileId: 'lead',
      ownerId: OWNER_ID,
      documents,
      businessRoleProfileIds: roles,
    });
    const waiting = collaborationAnswerCitations({
      completed: false,
      answer: '',
      targetProfileId: 'chief-of-staff',
      ownerId: OWNER_ID,
      documents,
      businessRoleProfileIds: roles,
    });

    expect(unsourced.showUnsourced).toBe(true);
    expect(unsourced.unsourced).toBe(true);
    expect(sourced.showUnsourced).toBe(false);
    expect(sourced.unsourced).toBe(false);
    expect(otherTarget.showUnsourced).toBe(false);
    expect(waiting).toEqual({
      sources: [],
      droppedSourceCount: 0,
      unsourced: false,
      showUnsourced: false,
    });
    expect(BUSINESS_ROLE_PROFILE_IDS).toEqual([
      'chief-of-staff',
      'advisors-lead',
      'product-strategy',
      'technology-advisor',
    ]);
  });
});
