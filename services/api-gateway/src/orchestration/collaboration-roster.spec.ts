import { BadRequestException } from '@nestjs/common';
import * as registry from '../system-agents/system-agent-registry';
import {
  SYSTEM_AGENT_DEFINITIONS,
  systemAgentById,
} from '../system-agents/system-agent-registry';
import type { CollaborationRosterEntity } from './collaboration-roster.entity';
import {
  CollaborationRosterService,
  MAX_ROSTER_MEMBERS,
  ROSTER_REFUSAL_CODES,
  ROSTER_SYSTEM_MEMBER_TEXT,
  isRosterSystemCandidate,
  readRosterMemberIds,
  readRosterPutBody,
  readStoredRosterMemberIds,
  rosterSystemChoices,
} from './collaboration-roster';
import { renderWorkflow, type WorkflowRow } from './collaboration-workflow';
import { DEFAULT_MAX_AGENTS_PER_COLLABORATION } from './orchestration.contracts';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const WF_TESTED = 'a0a0a0a0-0000-4000-8000-000000000001';
const WF_UNTESTED = 'a0a0a0a0-0000-4000-8000-000000000002';
const WF_DRAFT = 'a0a0a0a0-0000-4000-8000-000000000003';
const WF_OFF = 'a0a0a0a0-0000-4000-8000-000000000004';
const WF_DELETED = 'a0a0a0a0-0000-4000-8000-000000000005';
const WF_INVALID = 'a0a0a0a0-0000-4000-8000-000000000006';
const WF_OTHER = 'b0b0b0b0-0000-4000-8000-000000000001';

type TestRow = WorkflowRow & { userId: string; description: string; deleted?: boolean };

function chiefOfStaff() {
  const found = systemAgentById('chief-of-staff');
  if (!found) {
    throw new Error('missing chief-of-staff');
  }
  return found;
}

function workflowRow(id: string, overrides: Partial<TestRow> = {}): TestRow {
  const cos = chiefOfStaff();
  return {
    id,
    userId: OWNER,
    name: `Workflow ${id.slice(-1)}`,
    role: 'Assistant',
    description: `Does job ${id.slice(-1)}`,
    status: 'active',
    tone: cos.tone,
    replyLanguage: cos.replyLanguage,
    purpose: cos.purpose,
    procedure: cos.procedure,
    result: cos.result,
    knowledgeScopeIds: cos.knowledgeScopes.map((scope) => scope.id),
    connectorToolIds: [...cos.connectorToolIds],
    model: { choice: 'server' },
    budgetPerRunCredits: 5,
    budgetPerDayCredits: null,
    ...overrides,
  };
}

function createFakes() {
  const rosterRows = new Map<string, CollaborationRosterEntity>();
  const agentRows = new Map<string, TestRow>();
  const tested = new Map<string, Set<string>>();

  const rosterRepo = {
    findOne: jest.fn(async ({ where }: { where: { userId: string } }) => {
      const row = rosterRows.get(where.userId);
      return row ? { ...row, memberIds: JSON.parse(JSON.stringify(row.memberIds)) } : null;
    }),
    upsert: jest.fn(
      async (values: CollaborationRosterEntity, conflictPaths: string[]) => {
        expect(conflictPaths).toEqual(['userId']);
        rosterRows.set(values.userId, { ...values, memberIds: [...values.memberIds] });
      },
    ),
  };
  const userAgents = {
    findOneByIdAndUserId: jest.fn(async (id: string, userId: string) => {
      const row = agentRows.get(id);
      return row && row.userId === userId && !row.deleted ? { ...row } : null;
    }),
    listByUserId: jest.fn(async (userId: string) =>
      [...agentRows.values()]
        .filter((row) => row.userId === userId && !row.deleted)
        .map((row) => ({ ...row })),
    ),
  };
  const workflows = {
    usageFor: jest.fn(async (userId: string, workflowId: string) => ({
      testedVersions: new Set(tested.get(`${userId}:${workflowId}`) ?? []),
      lastTestRunAt: null,
      spentTodayCredits: 0,
      lastRunCredits: null,
    })),
  };
  const service = new CollaborationRosterService(
    rosterRepo as never,
    userAgents as never,
    workflows as never,
  );

  function addRow(row: TestRow): TestRow {
    agentRows.set(row.id, row);
    return row;
  }
  function markTested(row: TestRow, userId = row.userId): void {
    const rendered = renderWorkflow(row);
    if (!rendered) {
      throw new Error('row does not render');
    }
    const key = `${userId}:${row.id}`;
    tested.set(key, new Set([...(tested.get(key) ?? []), rendered.version]));
  }
  function store(userId: string, memberIds: unknown): void {
    rosterRows.set(userId, {
      userId,
      memberIds: memberIds as string[],
      updatedAt: new Date('2026-11-10T00:00:00.000Z'),
    });
  }

  return { service, rosterRows, agentRows, rosterRepo, userAgents, workflows, addRow, markTested, store };
}

/** The owner's six rows, each in one state, plus another owner's row. */
function seedRows(fakes: ReturnType<typeof createFakes>) {
  const tested = fakes.addRow(workflowRow(WF_TESTED));
  fakes.markTested(tested);
  fakes.addRow(workflowRow(WF_UNTESTED));
  const draft = fakes.addRow(workflowRow(WF_DRAFT, { status: 'draft' }));
  fakes.markTested(draft);
  const off = fakes.addRow(workflowRow(WF_OFF, { status: 'disabled' }));
  fakes.markTested(off);
  const deleted = fakes.addRow(workflowRow(WF_DELETED, { deleted: true }));
  fakes.markTested(deleted);
  fakes.addRow(
    workflowRow(WF_INVALID, { model: { choice: 'platform', id: 'not-a-model' } as never }),
  );
  const other = fakes.addRow(workflowRow(WF_OTHER, { userId: OTHER, name: 'Theirs' }));
  fakes.markTested(other);
}

async function refusal(promise: Promise<unknown>): Promise<Record<string, unknown>> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    const exception = error as BadRequestException;
    expect(exception.getStatus()).toBe(400);
    return exception.getResponse() as Record<string, unknown>;
  }
  throw new Error('expected a 400');
}

describe('COS-FRONTDOOR-01 roster members (D6, D7)', () => {
  it('the system candidates are the two advisors: read profile, outside coding, not a lead', () => {
    expect(rosterSystemChoices().map((definition) => definition.id)).toEqual([
      'product-strategy',
      'technology-advisor',
    ]);
    const candidates = SYSTEM_AGENT_DEFINITIONS.filter(isRosterSystemCandidate);
    for (const definition of candidates) {
      expect(definition.toolProfile).toBe('read');
      expect(definition.teamRole?.teamId).not.toBe('coding');
      expect(ROSTER_SYSTEM_MEMBER_TEXT[definition.id]).toBeDefined();
    }
    for (const id of ['chief-of-staff', 'advisors-lead', 'lead', 'writer', 'reviewer', 'builder']) {
      const definition = systemAgentById(id);
      expect(definition).toBeDefined();
      expect(isRosterSystemCandidate(definition!)).toBe(false);
    }
  });

  it('holds at most 3 members, so the Chief of Staff and the roster fit the 4-agent list', () => {
    expect(MAX_ROSTER_MEMBERS).toBe(3);
    expect(MAX_ROSTER_MEMBERS + 1).toBe(DEFAULT_MAX_AGENTS_PER_COLLABORATION);
  });

  it('readRosterMemberIds keeps the order, lower-cases UUIDs and refuses bad shapes', () => {
    expect(readRosterMemberIds([WF_TESTED.toUpperCase(), 'product-strategy'])).toEqual([
      WF_TESTED,
      'product-strategy',
    ]);
    expect(readRosterMemberIds([])).toEqual([]);
    const code = (value: unknown) => {
      try {
        readRosterMemberIds(value);
      } catch (error) {
        return ((error as BadRequestException).getResponse() as { code: string }).code;
      }
      return null;
    };
    expect(code(undefined)).toBe(ROSTER_REFUSAL_CODES.invalidBody);
    expect(code('product-strategy')).toBe(ROSTER_REFUSAL_CODES.invalidBody);
    expect(code([1])).toBe(ROSTER_REFUSAL_CODES.invalidBody);
    expect(code([''])).toBe(ROSTER_REFUSAL_CODES.invalidBody);
    expect(code(['x'.repeat(65)])).toBe(ROSTER_REFUSAL_CODES.invalidBody);
    expect(code(['a', 'b', 'c', 'd'])).toBe(ROSTER_REFUSAL_CODES.tooMany);
    expect(code([WF_TESTED, WF_TESTED.toUpperCase()])).toBe(ROSTER_REFUSAL_CODES.duplicate);
  });

  it('readRosterPutBody accepts exactly { memberIds }', () => {
    expect(readRosterPutBody({ memberIds: ['product-strategy'] })).toEqual(['product-strategy']);
    for (const body of [
      null,
      undefined,
      'x',
      [],
      {},
      { memberIds: [], userId: OTHER },
      { members: [] },
      { memberIds: [], instructions: 'x' },
    ]) {
      expect(() => readRosterPutBody(body)).toThrow(BadRequestException);
    }
  });

  it('readStoredRosterMemberIds reads a stored value fail-closed', () => {
    expect(readStoredRosterMemberIds(null)).toEqual([]);
    expect(readStoredRosterMemberIds({ 0: 'product-strategy' })).toEqual([]);
    expect(
      readStoredRosterMemberIds([
        'product-strategy',
        7,
        'product-strategy',
        WF_TESTED.toUpperCase(),
        '',
        'technology-advisor',
        WF_DRAFT,
      ]),
    ).toEqual(['product-strategy', WF_TESTED, 'technology-advisor']);
  });
});

describe('COS-FRONTDOOR-01 CollaborationRosterService', () => {
  let fakes: ReturnType<typeof createFakes>;

  beforeEach(() => {
    fakes = createFakes();
    seedRows(fakes);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('get and view', () => {
    it('get returns an empty list for a new owner', async () => {
      await expect(fakes.service.get(OWNER)).resolves.toEqual([]);
      expect(fakes.rosterRepo.findOne).toHaveBeenCalledWith({ where: { userId: OWNER } });
    });

    it('view lists no members and, as choices, the two advisors and only the owner rows', async () => {
      const view = await fakes.service.view(OWNER);
      expect(view.members).toEqual([]);
      expect(view.choices.slice(0, 2)).toEqual([
        { id: 'product-strategy', kind: 'system', name: 'Product Strategy', usable: true, reason: null },
        { id: 'technology-advisor', kind: 'system', name: 'Technology Advisor', usable: true, reason: null },
      ]);
      const workflowChoices = view.choices.slice(2);
      expect(workflowChoices.map((choice) => choice.id).sort()).toEqual(
        [WF_TESTED, WF_UNTESTED, WF_DRAFT, WF_OFF, WF_INVALID].sort(),
      );
      const byId = new Map(workflowChoices.map((choice) => [choice.id, choice]));
      expect(byId.get(WF_TESTED)).toEqual({
        id: WF_TESTED,
        kind: 'workflow',
        name: 'Workflow 1',
        usable: true,
        reason: null,
      });
      expect(byId.get(WF_UNTESTED)?.reason).toBe('not_tested');
      expect(byId.get(WF_DRAFT)?.reason).toBe('draft');
      expect(byId.get(WF_OFF)?.reason).toBe('off');
      expect(byId.get(WF_INVALID)?.reason).toBe('invalid');
      expect(view.choices.some((choice) => choice.id === WF_OTHER)).toBe(false);
      expect(view.choices.some((choice) => choice.id === 'chief-of-staff')).toBe(false);
      expect(JSON.stringify(view)).not.toContain('instructions');
    });

    it('view shows each stored member with its state; a deleted row is missing with no name', async () => {
      fakes.store(OWNER, [WF_DELETED, 'technology-advisor', WF_DRAFT]);
      const view = await fakes.service.view(OWNER);
      expect(view.members).toEqual([
        { id: WF_DELETED, kind: 'workflow', name: null, usable: false, reason: 'missing' },
        { id: 'technology-advisor', kind: 'system', name: 'Technology Advisor', usable: true, reason: null },
        { id: WF_DRAFT, kind: 'workflow', name: 'Workflow 3', usable: false, reason: 'draft' },
      ]);
    });

    it('view never shows one owner the roster of another', async () => {
      fakes.store(OWNER, ['product-strategy', WF_TESTED]);
      const view = await fakes.service.view(OTHER);
      expect(view.members).toEqual([]);
      expect(view.choices.map((choice) => choice.id)).toEqual([
        'product-strategy',
        'technology-advisor',
        WF_OTHER,
      ]);
    });
  });

  describe('put', () => {
    it('saves at most 3 unique ids in order and answers with names and usability', async () => {
      const view = await fakes.service.put(OWNER, ['product-strategy', WF_TESTED.toUpperCase(), WF_DRAFT]);
      expect(fakes.rosterRepo.upsert).toHaveBeenCalledTimes(1);
      const saved = fakes.rosterRows.get(OWNER);
      expect(saved?.memberIds).toEqual(['product-strategy', WF_TESTED, WF_DRAFT]);
      expect(saved?.updatedAt).toBeInstanceOf(Date);
      expect(view.members).toEqual([
        { id: 'product-strategy', kind: 'system', name: 'Product Strategy', usable: true, reason: null },
        { id: WF_TESTED, kind: 'workflow', name: 'Workflow 1', usable: true, reason: null },
        { id: WF_DRAFT, kind: 'workflow', name: 'Workflow 3', usable: false, reason: 'draft' },
      ]);
      await expect(fakes.service.get(OWNER)).resolves.toEqual([
        'product-strategy',
        WF_TESTED,
        WF_DRAFT,
      ]);
    });

    it('accepts any workflow status at save time and an empty list clears the roster', async () => {
      await fakes.service.put(OWNER, [WF_OFF, WF_UNTESTED, WF_INVALID]);
      expect(fakes.rosterRows.get(OWNER)?.memberIds).toEqual([WF_OFF, WF_UNTESTED, WF_INVALID]);
      const view = await fakes.service.put(OWNER, []);
      expect(fakes.rosterRows.get(OWNER)?.memberIds).toEqual([]);
      expect(view.members).toEqual([]);
    });

    it.each([
      ['a fourth member', ['product-strategy', 'technology-advisor', WF_TESTED, WF_DRAFT], ROSTER_REFUSAL_CODES.tooMany, undefined],
      ['a duplicate', ['product-strategy', 'product-strategy'], ROSTER_REFUSAL_CODES.duplicate, 'product-strategy'],
      ['the Chief of Staff', ['chief-of-staff'], ROSTER_REFUSAL_CODES.notAllowed, 'chief-of-staff'],
      ['the advisors lead', ['advisors-lead'], ROSTER_REFUSAL_CODES.notAllowed, 'advisors-lead'],
      ['a coding lead', ['lead'], ROSTER_REFUSAL_CODES.notAllowed, 'lead'],
      ['a coding writer', ['writer'], ROSTER_REFUSAL_CODES.notAllowed, 'writer'],
      ['a coding reviewer', ['reviewer'], ROSTER_REFUSAL_CODES.notAllowed, 'reviewer'],
      ['the builder', ['builder'], ROSTER_REFUSAL_CODES.notAllowed, 'builder'],
      ['an unknown id', ['product-strategy', 'nobody'], ROSTER_REFUSAL_CODES.unknown, 'nobody'],
      ['a deleted row', [WF_DELETED], ROSTER_REFUSAL_CODES.notFound, WF_DELETED],
      ['another owner row', [WF_TESTED, WF_OTHER], ROSTER_REFUSAL_CODES.notFound, WF_OTHER],
      ['a UUID with no row', ['c0c0c0c0-0000-4000-8000-000000000009'], ROSTER_REFUSAL_CODES.notFound, 'c0c0c0c0-0000-4000-8000-000000000009'],
      ['not a list', 'product-strategy', ROSTER_REFUSAL_CODES.invalidBody, undefined],
      ['a number', [42], ROSTER_REFUSAL_CODES.invalidBody, undefined],
    ])('refuses %s with 400 and saves nothing', async (_label, memberIds, code, memberId) => {
      fakes.store(OWNER, ['technology-advisor']);
      const body = await refusal(fakes.service.put(OWNER, memberIds));
      expect(body.code).toBe(code);
      expect(body.memberId).toBe(memberId);
      expect(fakes.rosterRepo.upsert).not.toHaveBeenCalled();
      expect(fakes.rosterRows.get(OWNER)?.memberIds).toEqual(['technology-advisor']);
    });

    it('answers another owner row exactly as a UUID that does not exist', async () => {
      const theirs = await refusal(fakes.service.put(OWNER, [WF_OTHER]));
      const none = await refusal(fakes.service.put(OWNER, ['c0c0c0c0-0000-4000-8000-000000000009']));
      expect({ ...theirs, memberId: 'x' }).toEqual({ ...none, memberId: 'x' });
      expect(fakes.userAgents.findOneByIdAndUserId).toHaveBeenCalledWith(WF_OTHER, OWNER);
    });

    it('refuses a system candidate that is not active', async () => {
      const advisor = systemAgentById('product-strategy')!;
      jest
        .spyOn(registry, 'systemAgentById')
        .mockImplementation((id: string) =>
          id === 'product-strategy' ? { ...advisor, status: 'coming_soon' } : SYSTEM_AGENT_DEFINITIONS.find((d) => d.id === id),
        );
      const body = await refusal(fakes.service.put(OWNER, ['product-strategy']));
      expect(body.code).toBe(ROSTER_REFUSAL_CODES.notAllowed);
      expect(fakes.rosterRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe('membersForStart (D10)', () => {
    it('is empty with no roster', async () => {
      await expect(fakes.service.membersForStart(OWNER)).resolves.toEqual({
        agents: [],
        rosterWorkflows: [],
        used: [],
        skipped: [],
      });
    });

    it('turns usable members into agent-list entries and a workflow snapshot with testRun false', async () => {
      fakes.store(OWNER, [WF_DELETED, WF_TESTED, 'product-strategy']);
      const start = await fakes.service.membersForStart(OWNER);
      const row = fakes.agentRows.get(WF_TESTED)!;
      const rendered = renderWorkflow(row)!;
      const advisor = systemAgentById('product-strategy')!;

      expect(start.used).toEqual([WF_TESTED, 'product-strategy']);
      expect(start.skipped).toEqual([{ id: WF_DELETED, reason: 'missing' }]);
      expect(start.agents).toEqual([
        {
          name: WF_TESTED,
          instructions: rendered.instructions,
          label: 'Workflow 1',
          summary: 'Does job 1',
        },
        {
          name: 'product-strategy',
          instructions: advisor.instructions,
          label: 'Product Strategy',
          summary: ROSTER_SYSTEM_MEMBER_TEXT['product-strategy'].summary,
        },
      ]);
      expect(start.rosterWorkflows).toEqual([
        {
          id: WF_TESTED,
          name: 'Workflow 1',
          version: rendered.version,
          knowledgeScopeIds: rendered.knowledgeScopeIds,
          connectorToolIds: rendered.connectorToolIds,
          model: { choice: 'server' },
          testRun: false,
          budgetPerRunCredits: 5,
          budgetPerDayCredits: null,
        },
      ]);
      for (const agent of start.agents) {
        expect(agent.name).toMatch(/^[a-z0-9-]{1,40}$/);
      }
    });

    it('leaves out a draft, an untested and an off workflow with their reasons', async () => {
      fakes.store(OWNER, [WF_DRAFT, WF_UNTESTED, WF_OFF]);
      const start = await fakes.service.membersForStart(OWNER);
      expect(start.agents).toEqual([]);
      expect(start.rosterWorkflows).toEqual([]);
      expect(start.used).toEqual([]);
      expect(start.skipped).toEqual([
        { id: WF_DRAFT, reason: 'draft' },
        { id: WF_UNTESTED, reason: 'not_tested' },
        { id: WF_OFF, reason: 'off' },
      ]);
    });

    it('re-checks at start: a member edited after its test, then deleted, is left out', async () => {
      fakes.store(OWNER, [WF_TESTED, WF_INVALID]);
      fakes.agentRows.set(WF_TESTED, { ...fakes.agentRows.get(WF_TESTED)!, procedure: 'Changed.' });
      let start = await fakes.service.membersForStart(OWNER);
      expect(start.skipped).toEqual([
        { id: WF_TESTED, reason: 'not_tested' },
        { id: WF_INVALID, reason: 'invalid' },
      ]);
      fakes.agentRows.set(WF_TESTED, { ...fakes.agentRows.get(WF_TESTED)!, deleted: true });
      start = await fakes.service.membersForStart(OWNER);
      expect(start.skipped[0]).toEqual({ id: WF_TESTED, reason: 'missing' });
    });

    it('never resolves another owner workflow, even if its id is stored', async () => {
      fakes.store(OWNER, [WF_OTHER, 'technology-advisor']);
      const start = await fakes.service.membersForStart(OWNER);
      expect(start.used).toEqual(['technology-advisor']);
      expect(start.skipped).toEqual([{ id: WF_OTHER, reason: 'missing' }]);
      expect(fakes.userAgents.findOneByIdAndUserId).toHaveBeenCalledWith(WF_OTHER, OWNER);
      expect(start.rosterWorkflows).toEqual([]);
    });

    it('leaves out a stored id that is no longer a candidate, and a coming-soon advisor', async () => {
      fakes.store(OWNER, ['chief-of-staff', 'writer', 'product-strategy']);
      const advisor = systemAgentById('product-strategy')!;
      jest
        .spyOn(registry, 'systemAgentById')
        .mockImplementation((id: string) =>
          id === 'product-strategy' ? { ...advisor, status: 'coming_soon' } : SYSTEM_AGENT_DEFINITIONS.find((d) => d.id === id),
        );
      const start = await fakes.service.membersForStart(OWNER);
      expect(start.agents).toEqual([]);
      expect(start.skipped).toEqual([
        { id: 'chief-of-staff', reason: 'missing' },
        { id: 'writer', reason: 'missing' },
        { id: 'product-strategy', reason: 'coming_soon' },
      ]);
      const view = await fakes.service.view(OWNER);
      expect(view.members[2]).toEqual({
        id: 'product-strategy',
        kind: 'system',
        name: 'Product Strategy',
        usable: false,
        reason: 'coming_soon',
      });
    });

    it('reads a damaged stored value fail-closed, at most 3 members', async () => {
      fakes.store(OWNER, ['product-strategy', 3, 'technology-advisor', WF_TESTED, WF_DRAFT]);
      const start = await fakes.service.membersForStart(OWNER);
      expect(start.used).toEqual(['product-strategy', 'technology-advisor', WF_TESTED]);
      fakes.store(OWNER, { not: 'a list' });
      await expect(fakes.service.membersForStart(OWNER)).resolves.toEqual({
        agents: [],
        rosterWorkflows: [],
        used: [],
        skipped: [],
      });
    });
  });
});
