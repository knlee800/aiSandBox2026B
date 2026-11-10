import {
  FRONT_DOOR_LEAD_ID,
  FRONT_DOOR_LEAD_LABEL,
  FRONT_DOOR_LEAD_SUMMARY,
  REPORT_BACK_ANSWER_CUT,
  REPORT_BACK_ANSWER_MAX_CHARS,
  buildReportBackPrompt,
  classifyFrontDoorEdge,
  frontDoorAgentList,
  isFrontDoorRun,
  reportBackIdempotencyKey,
  rosterMemberToListedAgent,
} from './collaboration-front-door';
import {
  DEFAULT_MAX_AGENTS_PER_COLLABORATION,
  DEFAULT_MAX_REFERRAL_DEPTH,
  MAX_FRONT_DOOR_ROUNDS,
  MAX_HANDOFFS_PER_RUN,
  MAX_SEND_BACK_ROUNDS,
} from './orchestration.contracts';

const COS = FRONT_DOOR_LEAD_ID;
const WF = 'f0f0f0f0-0000-4000-8000-000000000001';

function edge(source: string, target: string, at: number) {
  return { sourceProfileId: source, targetProfileId: target, createdAtMs: at };
}

const member = (name: string) => ({
  name,
  instructions: `${name} instructions`,
  label: `${name} label`,
  summary: `${name} summary`,
});

describe('COS-FRONTDOOR-01B front door (pure)', () => {
  it('keeps the A5 limits and pins two rounds', () => {
    expect(MAX_FRONT_DOOR_ROUNDS).toBe(2);
    expect(DEFAULT_MAX_REFERRAL_DEPTH).toBe(3);
    expect(DEFAULT_MAX_AGENTS_PER_COLLABORATION).toBe(4);
    expect(MAX_HANDOFFS_PER_RUN).toBe(8);
    expect(MAX_SEND_BACK_ROUNDS).toBe(2);
  });

  it('names the report-back key from the agent step id', () => {
    expect(reportBackIdempotencyKey('ref_1')).toBe('report-back:ref_1');
  });

  it('is a front-door run only with the Chief of Staff first and at least one member', () => {
    expect(isFrontDoorRun([{ name: COS }, { name: 'product-strategy' }])).toBe(true);
    expect(isFrontDoorRun([{ name: COS }])).toBe(false);
    expect(isFrontDoorRun([{ name: 'advisors-lead' }, { name: 'product-strategy' }])).toBe(false);
    expect(isFrontDoorRun([{ name: 'product-strategy' }, { name: COS }])).toBe(false);
    expect(isFrontDoorRun(null)).toBe(false);
    expect(isFrontDoorRun(undefined)).toBe(false);
  });

  it('builds today\'s one entry with no roster, and a labelled list with members', () => {
    expect(frontDoorAgentList('lead text', [])).toEqual([{ name: COS, instructions: 'lead text' }]);
    expect(Object.keys(frontDoorAgentList('lead text', [])[0])).toEqual(['name', 'instructions']);
    expect(frontDoorAgentList('lead text', [member('product-strategy'), member(WF)])).toEqual([
      {
        name: COS,
        instructions: 'lead text',
        label: FRONT_DOOR_LEAD_LABEL,
        summary: FRONT_DOOR_LEAD_SUMMARY,
      },
      member('product-strategy'),
      member(WF),
    ]);
    expect(rosterMemberToListedAgent(member(WF))).toEqual(member(WF));
  });

  it('writes the report-back prompt of D14 and cuts a long answer', () => {
    expect(
      buildReportBackPrompt({ ownerTask: 'What is new?', label: 'Product Strategy', answer: 'Growth.' }),
    ).toBe(
      'The owner asked:\nWhat is new?\n\nProduct Strategy answered:\nGrowth.\n\n' +
        'Write the final answer for the owner. Keep the [source: …] markers of the claims you use. ' +
        'If you still need another listed agent, end with one hand-off request; otherwise no request.',
    );
    const exact = 'a'.repeat(REPORT_BACK_ANSWER_MAX_CHARS);
    expect(buildReportBackPrompt({ ownerTask: 't', label: 'L', answer: exact })).toContain(
      `L answered:\n${exact}\n\nWrite`,
    );
    const long = `${'b'.repeat(REPORT_BACK_ANSWER_MAX_CHARS)}TAIL`;
    const cut = buildReportBackPrompt({ ownerTask: 't', label: 'L', answer: long });
    expect(cut).toContain(`${'b'.repeat(REPORT_BACK_ANSWER_MAX_CHARS)}\n${REPORT_BACK_ANSWER_CUT}\n\n`);
    expect(cut).not.toContain('TAIL');
  });

  describe('classifyFrontDoorEdge', () => {
    const start = edge('user', COS, 1);

    it('is ordinary outside a front-door run', () => {
      const existing = [start, edge(COS, 'product-strategy', 2)];
      expect(classifyFrontDoorEdge('product-strategy', COS, existing, COS, 1)).toBe('ordinary');
      expect(classifyFrontDoorEdge('product-strategy', COS, existing, 'advisors-lead', 3)).toBe(
        'ordinary',
      );
      expect(classifyFrontDoorEdge('reviewer', 'writer', existing, 'lead', 3)).toBe('ordinary');
    });

    it('keeps the first dispatch ordinary, then classifies report-back and dispatch', () => {
      expect(classifyFrontDoorEdge(COS, 'product-strategy', [start], COS, 3)).toBe('ordinary');
      const afterFirst = [start, edge(COS, 'product-strategy', 2)];
      expect(classifyFrontDoorEdge('product-strategy', COS, afterFirst, COS, 3)).toBe('report_back');
      const afterReport = [...afterFirst, edge('product-strategy', COS, 3)];
      expect(classifyFrontDoorEdge(COS, WF, afterReport, COS, 3)).toBe('dispatch');
      const afterSecond = [...afterReport, edge(COS, WF, 4)];
      expect(classifyFrontDoorEdge(WF, COS, afterSecond, COS, 3)).toBe('report_back');
      const afterSecondReport = [...afterSecond, edge(WF, COS, 5)];
      expect(classifyFrontDoorEdge(COS, 'technology-advisor', afterSecondReport, COS, 4)).toBe(
        'capped',
      );
    });

    it('never makes a second report-back, an undispatched one, or the user an exempt edge', () => {
      const afterReport = [start, edge(COS, 'product-strategy', 2), edge('product-strategy', COS, 3)];
      expect(classifyFrontDoorEdge('product-strategy', COS, afterReport, COS, 3)).toBe('ordinary');
      expect(classifyFrontDoorEdge(WF, COS, afterReport, COS, 3)).toBe('ordinary');
      expect(classifyFrontDoorEdge('user', COS, afterReport, COS, 3)).toBe('ordinary');
      expect(classifyFrontDoorEdge(COS, 'user', afterReport, COS, 3)).toBe('ordinary');
      expect(classifyFrontDoorEdge(COS, COS, afterReport, COS, 3)).toBe('ordinary');
      expect(classifyFrontDoorEdge('product-strategy', WF, afterReport, COS, 3)).toBe('ordinary');
    });
  });
});
