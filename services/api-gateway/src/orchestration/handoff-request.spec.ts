import { DEFAULT_MAX_AGENTS_PER_COLLABORATION } from './orchestration.contracts';
import {
  MAX_AGENT_INSTRUCTIONS_CHARS,
  MAX_AGENT_LABEL_CHARS,
  MAX_AGENT_SUMMARY_CHARS,
  MAX_HANDOFF_TASK_CHARS,
  buildCollaborationProjectInstructions,
  listedAgentLine,
  parseHandoffRequest,
  readCollaborationAgents,
} from './handoff-request';

const requestLine = '<handoff to="writer">Tighten the opening.</handoff>';

describe('parseHandoffRequest', () => {
  it('reads one request on its own at the end and keeps the answer before it', () => {
    const parsed = parseHandoffRequest(`  The draft is ready.\r\n\r\n${requestLine}\n`);

    expect(parsed).toEqual({
      kind: 'request',
      to: 'writer',
      task: 'Tighten the opening.',
      answerWithoutRequest: 'The draft is ready.',
    });
  });

  it('accepts a request that is the whole answer and trims the task', () => {
    const parsed = parseHandoffRequest('  <handoff to="writer">  hello  </handoff>  ');

    expect(parsed).toEqual({
      kind: 'request',
      to: 'writer',
      task: 'hello',
      answerWithoutRequest: '',
    });
  });

  it('accepts a task of exactly 4000 characters', () => {
    const task = 'a'.repeat(MAX_HANDOFF_TASK_CHARS);
    const parsed = parseHandoffRequest(`<handoff to="writer">${task}</handoff>`);

    expect(parsed).toEqual({
      kind: 'request',
      to: 'writer',
      task,
      answerWithoutRequest: '',
    });
  });

  it('returns no request when the answer has no tag', () => {
    expect(parseHandoffRequest('The draft is ready. No handoff is required.')).toEqual({
      kind: 'none',
    });
    expect(parseHandoffRequest('   ')).toEqual({ kind: 'none' });
  });

  it('rejects a request that is not alone at the end', () => {
    expect(parseHandoffRequest(`Please ${requestLine}`)).toEqual({
      kind: 'malformed',
      reason: 'not_at_end',
    });
    expect(parseHandoffRequest(`${requestLine}\nThanks`)).toEqual({
      kind: 'malformed',
      reason: 'not_at_end',
    });
    expect(parseHandoffRequest(`Hello\n${requestLine}\nMore`)).toEqual({
      kind: 'malformed',
      reason: 'not_at_end',
    });
  });

  it('rejects a request inside a code fence', () => {
    expect(parseHandoffRequest(`\`\`\`\n${requestLine}\n\`\`\``)).toEqual({
      kind: 'malformed',
      reason: 'inside_code_fence',
    });
    expect(parseHandoffRequest(`\`\`\`\n${requestLine}`)).toEqual({
      kind: 'malformed',
      reason: 'inside_code_fence',
    });
  });

  it('rejects a second request', () => {
    expect(
      parseHandoffRequest(
        '<handoff to="writer">one</handoff>\n<handoff to="editor">two</handoff>',
      ),
    ).toEqual({ kind: 'malformed', reason: 'multiple_requests' });
  });

  it('rejects nested tags', () => {
    expect(
      parseHandoffRequest(
        '<handoff to="writer"><handoff to="editor">x</handoff></handoff>',
      ),
    ).toEqual({ kind: 'malformed', reason: 'nested' });
  });

  it('rejects an empty task', () => {
    expect(parseHandoffRequest('<handoff to="writer"></handoff>')).toEqual({
      kind: 'malformed',
      reason: 'empty_task',
    });
    expect(parseHandoffRequest('<handoff to="writer">   </handoff>')).toEqual({
      kind: 'malformed',
      reason: 'empty_task',
    });
  });

  it('rejects a malformed tag and does not treat it as a request', () => {
    expect(parseHandoffRequest('<handoff to="Writer">task</handoff>')).toEqual({
      kind: 'malformed',
      reason: 'malformed_tag',
    });
    expect(parseHandoffRequest('<handoff to=\'writer\'>task</handoff>')).toEqual({
      kind: 'malformed',
      reason: 'malformed_tag',
    });
    expect(parseHandoffRequest('</handoff>')).toEqual({
      kind: 'malformed',
      reason: 'malformed_tag',
    });
    expect(parseHandoffRequest('<handoff to="">task</handoff>')).toEqual({
      kind: 'malformed',
      reason: 'malformed_tag',
    });
  });

  it('refuses a task longer than 4000 characters', () => {
    const task = 'a'.repeat(MAX_HANDOFF_TASK_CHARS + 1);
    expect(parseHandoffRequest(`<handoff to="writer">${task}</handoff>`)).toEqual({
      kind: 'too_long',
      to: 'writer',
      taskLength: MAX_HANDOFF_TASK_CHARS + 1,
    });
  });
});

describe('collaboration agent list and job instructions', () => {
  const agents = [
    { name: 'lead', instructions: 'Break the work into steps.' },
    { name: 'writer', instructions: 'Write the code.\nKeep it small.' },
  ];

  it('builds the exact instructions a job receives', () => {
    expect(
      buildCollaborationProjectInstructions({
        callerInstructions: 'Be concise.',
        agents,
        agentName: 'lead',
      }),
    ).toBe(
      [
        'Be concise.',
        '',
        'You are lead.',
        'Break the work into steps.',
        '',
        'Other agents:',
        '- writer: Write the code. Keep it small.',
        '',
        'Ask another agent only when you genuinely need them. At most one request, alone at the very end of the answer, exactly <handoff to="name">task</handoff>. Otherwise no request.',
      ].join('\n'),
    );
  });

  it('omits an empty caller block', () => {
    const text = buildCollaborationProjectInstructions({
      callerInstructions: '',
      agents: [{ name: 'lead', instructions: 'Lead.' }],
      agentName: 'lead',
    });

    expect(text.startsWith('You are lead.')).toBe(true);
    expect(text).toContain('Other agents:\nnone');
  });

  it('COS-DRAFTS-01 D12: a selfLabel names the agent by its display name and keeps the id', () => {
    const id = '6f1c2c1e-1d2b-4c1a-9a43-2f7f8a3e4b5c';
    const listed = [
      { name: id, instructions: 'Sum up the sales mail.' },
      { name: 'product-strategy', instructions: 'Market.', label: 'Product Strategy', summary: 'Answers.' },
    ];
    const text = buildCollaborationProjectInstructions({
      agents: listed,
      agentName: id,
      selfLabel: 'Weekly sales\ndigest',
    });
    expect(text).toBe(
      [
        `You are Weekly sales digest (${id}).`,
        'Sum up the sales mail.',
        '',
        'Other agents:',
        '- product-strategy (Product Strategy): Answers.',
        '',
        'Ask another agent only when you genuinely need them. At most one request, alone at the very end of the answer, exactly <handoff to="name">task</handoff>. Otherwise no request.',
      ].join('\n'),
    );
    // Without a label, an empty one or one over 100 characters: today's line, byte for byte.
    const plain = buildCollaborationProjectInstructions({ agents: listed, agentName: id });
    for (const selfLabel of [null, '', '   ', 'x'.repeat(101)]) {
      expect(buildCollaborationProjectInstructions({ agents: listed, agentName: id, selfLabel })).toBe(plain);
    }
    expect(plain.startsWith(`You are ${id}.\n`)).toBe(true);
  });

  it('accepts four valid agents and rejects an invalid list', () => {
    const four = Array.from({ length: DEFAULT_MAX_AGENTS_PER_COLLABORATION }, (_, index) => ({
      name: `agent-${index}`,
      instructions: 'Do the work.',
    }));
    expect(readCollaborationAgents(four)).toEqual({ ok: true, agents: four });

    expect(readCollaborationAgents('nope').ok).toBe(false);
    expect(readCollaborationAgents([]).ok).toBe(false);
    expect(readCollaborationAgents([...four, { name: 'agent-x', instructions: 'x' }]).ok).toBe(
      false,
    );
    expect(readCollaborationAgents([{ name: 'Lead', instructions: 'x' }]).ok).toBe(false);
    expect(
      readCollaborationAgents([
        { name: 'lead', instructions: 'x' },
        { name: 'lead', instructions: 'y' },
      ]).ok,
    ).toBe(false);
    expect(
      readCollaborationAgents([
        { name: 'lead', instructions: 'x'.repeat(MAX_AGENT_INSTRUCTIONS_CHARS + 1) },
      ]).ok,
    ).toBe(false);
    expect(readCollaborationAgents([{ name: 'lead' }]).ok).toBe(false);
  });
});

describe('COS-FRONTDOOR-01B agent labels (D13)', () => {
  it('keeps label and summary only when sent, and refuses bad ones', () => {
    const plain = readCollaborationAgents([{ name: 'lead', instructions: 'Lead.' }]);
    expect(plain).toEqual({ ok: true, agents: [{ name: 'lead', instructions: 'Lead.' }] });
    if (plain.ok) {
      expect(Object.keys(plain.agents[0])).toEqual(['name', 'instructions']);
    }

    expect(
      readCollaborationAgents([
        { name: 'chief-of-staff', instructions: 'Lead.', label: 'Chief of Staff', summary: 'Leads.' },
        { name: 'product-strategy', instructions: 'PS.', label: 'Product Strategy' },
      ]),
    ).toEqual({
      ok: true,
      agents: [
        { name: 'chief-of-staff', instructions: 'Lead.', label: 'Chief of Staff', summary: 'Leads.' },
        { name: 'product-strategy', instructions: 'PS.', label: 'Product Strategy' },
      ],
    });

    for (const bad of [
      { label: 1 },
      { label: 'x'.repeat(MAX_AGENT_LABEL_CHARS + 1) },
      { summary: null },
      { summary: 'x'.repeat(MAX_AGENT_SUMMARY_CHARS + 1) },
    ]) {
      expect(readCollaborationAgents([{ name: 'lead', instructions: 'Lead.', ...bad }]).ok).toBe(
        false,
      );
    }
  });

  it('reads a labelled agent as name (label): summary, and an unlabelled one as before', () => {
    expect(listedAgentLine({ name: 'writer', instructions: 'Apply\n the  fix.' })).toBe(
      '- writer: Apply the fix.',
    );
    expect(
      listedAgentLine({
        name: 'product-strategy',
        instructions: 'Long prompt.',
        label: 'Product Strategy',
        summary: 'Answers\nmarket questions.',
      }),
    ).toBe('- product-strategy (Product Strategy): Answers market questions.');
    expect(
      listedAgentLine({ name: 'wf-1', instructions: 'Long prompt.', label: 'Mail digest', summary: '' }),
    ).toBe('- wf-1 (Mail digest)');
    expect(listedAgentLine({ name: 'wf-1', instructions: 'Prompt.', label: ' ' })).toBe(
      '- wf-1: Prompt.',
    );
  });

  it('lists labelled members to the Chief of Staff and leaves an unlabelled brief byte-identical', () => {
    const coding = buildCollaborationProjectInstructions({
      agents: [
        { name: 'lead', instructions: 'Lead.' },
        { name: 'writer', instructions: 'Write.' },
      ],
      agentName: 'lead',
    });
    expect(coding).toBe(
      'You are lead.\nLead.\n\nOther agents:\n- writer: Write.\n\n' +
        'Ask another agent only when you genuinely need them. At most one request, alone at the very end of the answer, exactly <handoff to="name">task</handoff>. Otherwise no request.',
    );

    const brief = buildCollaborationProjectInstructions({
      agents: [
        { name: 'chief-of-staff', instructions: 'Lead.', label: 'Chief of Staff', summary: 'Leads.' },
        { name: 'product-strategy', instructions: 'PS.', label: 'Product Strategy', summary: 'Market.' },
      ],
      agentName: 'chief-of-staff',
    });
    expect(brief).toContain('Other agents:\n- product-strategy (Product Strategy): Market.\n\n');
    expect(brief).not.toContain('PS.');
  });
});
