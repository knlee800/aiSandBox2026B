import {
  DRAFT_LABELS,
  parseDraftBlock,
  stepMayDraft,
  validateDraft,
  type DraftPart,
} from './collaboration-draft';

const WELL_FORMED = [
  'Here is a first draft of the workflow you asked for.',
  '',
  '<draft kind="workflow">',
  'name: Weekly sales digest',
  'role: Sales analyst',
  'description: Sums up the week of sales mail for the owner.',
  'tone: calm and brief',
  'reply language: zh-TW',
  'purpose: You sum up the week of sales mail for the owner.',
  'procedure: Read the unread mail.',
  'Group it by customer.',
  '',
  'Name the three largest open deals.',
  'result: A short list, most important first.',
  '</draft>',
].join('\n');

function block(lines: readonly string[], kind = 'workflow'): string {
  return ['Draft below.', `<draft kind="${kind}">`, ...lines, '</draft>'].join('\n');
}

describe('COS-DRAFTS-01 draft block parser', () => {
  it('reads the eight text parts of a well-formed block', () => {
    const draft = parseDraftBlock(WELL_FORMED);
    expect(draft).toEqual({
      kind: 'workflow',
      fields: {
        name: 'Weekly sales digest',
        role: 'Sales analyst',
        description: 'Sums up the week of sales mail for the owner.',
        tone: 'calm and brief',
        replyLanguage: 'zh-TW',
        purpose: 'You sum up the week of sales mail for the owner.',
        procedure: 'Read the unread mail.\nGroup it by customer.\n\nName the three largest open deals.',
        result: 'A short list, most important first.',
      },
      problems: [],
      invalid: null,
      unknownLabels: [],
      answerWithoutDraft: 'Here is a first draft of the workflow you asked for.',
    });
  });

  it('knows exactly the eight form labels', () => {
    expect(DRAFT_LABELS.map((entry) => entry.label)).toEqual([
      'name',
      'role',
      'description',
      'tone',
      'reply language',
      'purpose',
      'procedure',
      'result',
    ]);
  });

  it('returns null when the answer holds no draft tag', () => {
    expect(parseDraftBlock('Your calendar is clear today.')).toBeNull();
    expect(parseDraftBlock('')).toBeNull();
  });

  it('reads CRLF answers and a tag indented with spaces', () => {
    const draft = parseDraftBlock('Hi.\r\n  <draft kind="agent">\r\nname: Helper\r\n</draft>\r\n');
    expect(draft?.invalid).toBeNull();
    expect(draft?.kind).toBe('agent');
    expect(draft?.fields).toEqual({ name: 'Helper' });
    expect(draft?.answerWithoutDraft).toBe('Hi.');
  });

  it('refuses a kind other than agent or workflow', () => {
    const draft = parseDraftBlock(block(['name: X'], 'connector'));
    expect(draft).toMatchObject({ kind: null, invalid: 'invalid_kind', fields: {} });
    expect(draft?.answerWithoutDraft).toBe('Draft below.');
  });

  it('refuses a malformed opening tag', () => {
    expect(parseDraftBlock('A.\n<draft>\nname: X\n</draft>')?.invalid).toBe('malformed_tag');
    expect(parseDraftBlock('A.\n<draft kind="workflow" tools="send">\nname: X\n</draft>')?.invalid).toBe(
      'malformed_tag',
    );
    // The closing tag must be alone on its line.
    expect(parseDraftBlock('A.\n<draft kind="workflow">name: X</draft>')?.invalid).toBe('not_at_end');
    expect(parseDraftBlock('A.\n<draft kind="workflow">\nname: X\n</draft')?.invalid).toBe('malformed_tag');
    expect(parseDraftBlock('I can write a <draft kind="workflow"> for you.')?.invalid).toBe('malformed_tag');
  });

  it.each([
    ['tools'],
    ['folders'],
    ['model'],
    ['budget'],
    ['team'],
    ['approval'],
    ['status'],
    ['connector tools'],
  ])('refuses the whole draft on the label %s:', (label) => {
    const draft = parseDraftBlock(block(['name: Mail relay', `${label}: mail_send`, 'purpose: Relay.']));
    expect(draft).toEqual({
      kind: 'workflow',
      fields: {},
      problems: [],
      invalid: 'unknown_label',
      unknownLabels: [label],
      answerWithoutDraft: 'Draft below.',
    });
  });

  it('refuses a duplicate label', () => {
    expect(parseDraftBlock(block(['name: A', 'role: R', 'role: S']))?.invalid).toBe('duplicate_label');
  });

  it('refuses a draft without a name, with an empty name, or with text before the first label', () => {
    expect(parseDraftBlock(block(['role: R', 'purpose: P']))?.invalid).toBe('missing_name');
    expect(parseDraftBlock(block(['name:   ', 'role: R']))?.invalid).toBe('missing_name');
    expect(parseDraftBlock(block(['Here it is', 'name: A']))?.invalid).toBe('text_before_label');
  });

  it('refuses a name over 100 characters or with a control character', () => {
    expect(parseDraftBlock(block([`name: ${'n'.repeat(101)}`]))?.invalid).toBe('invalid_name');
    expect(parseDraftBlock(block(['name: A\u0007B']))?.invalid).toBe('invalid_name');
    expect(parseDraftBlock(block([`name: ${'n'.repeat(100)}`]))?.invalid).toBeNull();
  });

  it('refuses two blocks and a nested block', () => {
    const two = `${block(['name: A'])}\n${block(['name: B'])}`;
    expect(parseDraftBlock(two)?.invalid).toBe('multiple_blocks');
    const nested = 'X\n<draft kind="workflow">\nname: A\n<draft kind="workflow">\nname: B\n</draft>\n</draft>';
    expect(parseDraftBlock(nested)?.invalid).toBe('nested');
  });

  it('refuses a block inside a code fence and a block not at the end', () => {
    const fenced = 'X\n```\n<draft kind="workflow">\nname: A\n</draft>\n```';
    expect(parseDraftBlock(fenced)?.invalid).toBe('inside_code_fence');
    const notAtEnd = `${block(['name: A'])}\nAnything else?`;
    const draft = parseDraftBlock(notAtEnd);
    expect(draft?.invalid).toBe('not_at_end');
    expect(draft?.answerWithoutDraft).toBe(notAtEnd);
    expect(parseDraftBlock('X\nSee <draft kind="workflow">\nname: A\n</draft>')?.invalid).toBe('not_at_end');
    const handoffAfter = `${block(['name: A'])}\n<handoff to="product-strategy">Q</handoff>`;
    expect(parseDraftBlock(handoffAfter)?.invalid).toBe('not_at_end');
  });

  it('drops a role over 200 characters, names it, and keeps the rest', () => {
    const draft = parseDraftBlock(
      block(['name: Digest', `role: ${'r'.repeat(201)}`, 'description: Short.']),
    );
    expect(draft?.invalid).toBeNull();
    expect(draft?.fields).toEqual({ name: 'Digest', description: 'Short.' });
    expect(draft?.problems).toEqual([{ part: 'role', reason: 'too_long' }]);
  });

  it('drops a description over 2000, a tone over 120 and a procedure over 4000 characters', () => {
    const draft = parseDraftBlock(
      block([
        'name: Digest',
        `description: ${'d'.repeat(2001)}`,
        `tone: ${'t'.repeat(121)}`,
        `procedure: ${'p'.repeat(4001)}`,
        'result: A list.',
      ]),
    );
    expect(draft?.fields).toEqual({ name: 'Digest', result: 'A list.' });
    expect(draft?.problems).toEqual([
      { part: 'description', reason: 'too_long' },
      { part: 'tone', reason: 'too_long' },
      { part: 'procedure', reason: 'too_long' },
    ]);
  });

  it('drops a reply language outside owner, en, zh-TW and zh-CN', () => {
    const draft = parseDraftBlock(block(['name: A', 'reply language: French']));
    expect(draft?.fields).toEqual({ name: 'A' });
    expect(draft?.problems).toEqual([{ part: 'replyLanguage', reason: 'not_allowed_value' }]);
    expect(parseDraftBlock(block(['name: A', 'reply language: owner']))?.fields.replyLanguage).toBe(
      'owner',
    );
  });

  it('drops parts with control characters; a multi-line tone is dropped, a multi-line procedure kept', () => {
    const draft = parseDraftBlock(
      block([
        'name: A',
        'role: R\u0000',
        'description: D\u001b[31m',
        'tone: calm',
        'still tone',
        'purpose: P\u0008',
        'procedure: one',
        'two',
      ]),
    );
    expect(draft?.fields).toEqual({ name: 'A', procedure: 'one\ntwo' });
    expect(draft?.problems).toEqual([
      { part: 'role', reason: 'control_characters' },
      { part: 'description', reason: 'control_characters' },
      { part: 'tone', reason: 'control_characters' },
      { part: 'purpose', reason: 'control_characters' },
    ]);
  });

  it('drops purpose, procedure and result when the rendered prompt with the rules exceeds 4000', () => {
    const draft = parseDraftBlock(
      block([
        'name: Long',
        'tone: calm',
        `purpose: ${'a'.repeat(1500)}`,
        `procedure: ${'b'.repeat(1500)}`,
        `result: ${'c'.repeat(500)}`,
      ]),
    );
    expect(draft?.invalid).toBeNull();
    expect(draft?.fields).toEqual({ name: 'Long', tone: 'calm' });
    expect(draft?.problems).toEqual([
      { part: 'purpose', reason: 'prompt_too_long' },
      { part: 'procedure', reason: 'prompt_too_long' },
      { part: 'result', reason: 'prompt_too_long' },
    ]);
    // Each part alone fits; together with the platform rules they do not.
    const fits = parseDraftBlock(block(['name: Long', `purpose: ${'a'.repeat(1500)}`]));
    expect(fits?.problems).toEqual([]);
  });

  it('a kind="agent" draft keeps name, role and description and names the rest', () => {
    const draft = parseDraftBlock(
      block(['name: A', 'role: R', 'description: D', 'tone: calm', 'purpose: P'], 'agent'),
    );
    expect(draft?.fields).toEqual({ name: 'A', role: 'R', description: 'D' });
    expect(draft?.problems).toEqual([
      { part: 'tone', reason: 'not_for_agent' },
      { part: 'purpose', reason: 'not_for_agent' },
    ]);
  });

  it('a value runs to the next label; capitalised lines and lines with a colon later stay in the value', () => {
    const draft = parseDraftBlock(
      block(['name: A', 'procedure: Step 1: read.', 'Note: keep it short.', '  indented: kept', 'result: R']),
    );
    expect(draft?.fields.procedure).toBe('Step 1: read.\nNote: keep it short.\n  indented: kept');
    expect(draft?.fields.result).toBe('R');
  });

  it('returns the answer without the block, trimmed; an answer that is only the block gives empty text', () => {
    expect(parseDraftBlock(`  \n\n${block(['name: A'])}\n\n`)?.answerWithoutDraft).toBe('Draft below.');
    expect(parseDraftBlock('<draft kind="workflow">\nname: A\n</draft>')?.answerWithoutDraft).toBe('');
  });

  it('validateDraft applies the same limits to a map of parts', () => {
    const values = new Map<DraftPart, string>([
      ['name', 'A'],
      ['role', 'r'.repeat(201)],
    ]);
    expect(validateDraft('workflow', values)).toEqual({
      kind: 'workflow',
      fields: { name: 'A' },
      problems: [{ part: 'role', reason: 'too_long' }],
      invalid: null,
      unknownLabels: [],
      answerWithoutDraft: '',
    });
  });

  it('only a chief-of-staff step may draft', () => {
    expect(stepMayDraft('chief-of-staff')).toBe(true);
    for (const id of [
      'advisors-lead',
      'product-strategy',
      'technology-advisor',
      'lead',
      'writer',
      'reviewer',
      '6f1c2c1e-1d2b-4c1a-9a43-2f7f8a3e4b5c',
    ]) {
      expect(stepMayDraft(id)).toBe(false);
    }
  });
});
