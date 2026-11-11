import {
  SYSTEM_AGENT_DEFINITIONS,
  systemAgentById,
} from '../../system-agents/system-agent-registry';
import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_USER_WORKFLOW_APPROVAL_MODE,
  MAX_ROSTER_MEMBERS,
  MAX_USER_WORKFLOW_BUDGET_CREDITS,
  ROSTER_REFUSAL_CODES,
  USER_WORKFLOW_APPROVAL_MODES,
  isApprovalCreditLimit,
  isUserWorkflowApprovalMode,
  readApprovalSetting,
  USER_WORKFLOW_RULES,
  USER_WORKFLOW_TEMPLATE_IDS,
  assertRosterMemberIds,
  isUserWorkflowTemplateId,
  readRosterMemberIds,
} from '../user-workflow-rules';
import { MAX_USER_WORKFLOW_BUDGET_CREDITS as DTO_MAX_BUDGET } from '../dto/create-agent.dto';

describe('user workflow rules and templates (BIZ-USER-01A D4, DECISION B)', () => {
  it('USER_WORKFLOW_RULES equals the Chief of Staff rules part', () => {
    const chiefOfStaff = systemAgentById('chief-of-staff');
    expect(chiefOfStaff).toBeDefined();
    expect(USER_WORKFLOW_RULES).toBe(chiefOfStaff!.rules);
    expect(USER_WORKFLOW_RULES.length).toBeGreaterThan(0);
  });

  it('the template allowlist is the Chief of Staff only', () => {
    expect([...USER_WORKFLOW_TEMPLATE_IDS]).toEqual(['chief-of-staff']);
  });

  it('every template id is a system agent', () => {
    const ids = SYSTEM_AGENT_DEFINITIONS.map((definition) => definition.id);
    for (const id of USER_WORKFLOW_TEMPLATE_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('isUserWorkflowTemplateId refuses other system agents and non-strings', () => {
    expect(isUserWorkflowTemplateId('chief-of-staff')).toBe(true);
    expect(isUserWorkflowTemplateId('product-strategy')).toBe(false);
    expect(isUserWorkflowTemplateId('builder')).toBe(false);
    expect(isUserWorkflowTemplateId(undefined)).toBe(false);
    expect(isUserWorkflowTemplateId(['chief-of-staff'])).toBe(false);
  });
});

describe('USER-TEAMS-01 shared member rule (D2, DECISION D)', () => {
  const OWNER = '11111111-1111-4111-8111-111111111111';
  const OTHER = '22222222-2222-4222-8222-222222222222';
  const SELF = 'a0a0a0a0-0000-4000-8000-000000000001';
  const MINE = 'a0a0a0a0-0000-4000-8000-000000000002';
  const THEIRS = 'a0a0a0a0-0000-4000-8000-000000000003';

  const rows = new Map<string, { userId: string }>([
    [SELF, { userId: OWNER }],
    [MINE, { userId: OWNER }],
    [THEIRS, { userId: OTHER }],
  ]);
  const ownerRow = jest.fn(async (id: string) => rows.get(id) ?? null);

  async function code(ids: unknown, selfId: string | null = SELF): Promise<string | null> {
    try {
      await assertRosterMemberIds(readRosterMemberIds(ids), { userId: OWNER, ownerRow, selfId });
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      return ((error as BadRequestException).getResponse() as { code: string }).code;
    }
    return null;
  }

  beforeEach(() => ownerRow.mockClear());

  it('accepts the two advisors and the owner rows, at most 3', async () => {
    expect(MAX_ROSTER_MEMBERS).toBe(3);
    await expect(code(['product-strategy', 'technology-advisor', MINE])).resolves.toBeNull();
    await expect(code([])).resolves.toBeNull();
  });

  it('refuses the workflow itself, compared without case, before looking it up', async () => {
    await expect(code([SELF.toUpperCase()])).resolves.toBe(ROSTER_REFUSAL_CODES.self);
    expect(ownerRow).not.toHaveBeenCalled();
    await expect(code([SELF], null)).resolves.toBeNull();
  });

  it('treats a row that carries another owner as not found, and refuses the first bad id in order', async () => {
    await expect(code([THEIRS])).resolves.toBe(ROSTER_REFUSAL_CODES.notFound);
    await expect(code(['nobody', 'writer'])).resolves.toBe(ROSTER_REFUSAL_CODES.unknown);
    await expect(code(['writer', 'nobody'])).resolves.toBe(ROSTER_REFUSAL_CODES.notAllowed);
  });

  it('uses the caller message for a non-member and the roster message by default', async () => {
    const messageOf = async (notAllowedMessage?: string) => {
      try {
        await assertRosterMemberIds(['chief-of-staff'], { userId: OWNER, ownerRow, notAllowedMessage });
      } catch (error) {
        return ((error as BadRequestException).getResponse() as { message: string }).message;
      }
      return null;
    };
    await expect(messageOf()).resolves.toBe('This agent cannot be on the Chief of Staff roster');
    await expect(messageOf('This agent cannot be on a workflow team')).resolves.toBe(
      'This agent cannot be on a workflow team',
    );
  });
});

describe('approval setting (APPROVAL-SET-01 D2, fail-closed read)', () => {
  it('lists exactly every, credits and read_only, with every as the default', () => {
    expect([...USER_WORKFLOW_APPROVAL_MODES]).toEqual(['every', 'credits', 'read_only']);
    expect(DEFAULT_USER_WORKFLOW_APPROVAL_MODE).toBe('every');
  });

  it('the budget maximum is one constant, re-exported unchanged by the DTO', () => {
    expect(MAX_USER_WORKFLOW_BUDGET_CREDITS).toBe(1_000_000);
    expect(DTO_MAX_BUDGET).toBe(MAX_USER_WORKFLOW_BUDGET_CREDITS);
  });

  it.each(['every', 'credits', 'read_only'])('isUserWorkflowApprovalMode accepts %s', (mode) => {
    expect(isUserWorkflowApprovalMode(mode)).toBe(true);
  });

  it.each(['EVERY', 'readOnly', 'read-only', 'auto', '', ' every', null, undefined, 1, {}, ['every']])(
    'isUserWorkflowApprovalMode refuses %p',
    (mode) => {
      expect(isUserWorkflowApprovalMode(mode)).toBe(false);
    },
  );

  it.each([1, 50, MAX_USER_WORKFLOW_BUDGET_CREDITS])('isApprovalCreditLimit accepts %p', (limit) => {
    expect(isApprovalCreditLimit(limit)).toBe(true);
  });

  it.each([0, -1, 1.5, MAX_USER_WORKFLOW_BUDGET_CREDITS + 1, NaN, Infinity, '50', null, undefined])(
    'isApprovalCreditLimit refuses %p',
    (limit) => {
      expect(isApprovalCreditLimit(limit)).toBe(false);
    },
  );

  it('reads a valid stored setting as stored', () => {
    expect(readApprovalSetting({ approvalMode: 'every', approvalCreditLimit: null })).toEqual({
      mode: 'every',
      creditLimit: null,
    });
    expect(readApprovalSetting({ approvalMode: 'credits', approvalCreditLimit: 40 })).toEqual({
      mode: 'credits',
      creditLimit: 40,
    });
    expect(readApprovalSetting({ approvalMode: 'read_only', approvalCreditLimit: null })).toEqual({
      mode: 'read_only',
      creditLimit: null,
    });
  });

  it('ignores a limit stored beside every or read_only', () => {
    expect(readApprovalSetting({ approvalMode: 'every', approvalCreditLimit: 40 })).toEqual({
      mode: 'every',
      creditLimit: null,
    });
    expect(readApprovalSetting({ approvalMode: 'read_only', approvalCreditLimit: 40 })).toEqual({
      mode: 'read_only',
      creditLimit: null,
    });
  });

  it.each([
    ['a missing row', null],
    ['an undefined row', undefined],
    ['a row without the columns', {}],
    ['an unknown mode', { approvalMode: 'auto', approvalCreditLimit: null }],
    ['a mode in the wrong case', { approvalMode: 'READ_ONLY', approvalCreditLimit: null }],
    ['a non-string mode', { approvalMode: 1, approvalCreditLimit: 5 }],
    ['credits without a limit', { approvalMode: 'credits', approvalCreditLimit: null }],
    ['credits with a zero limit', { approvalMode: 'credits', approvalCreditLimit: 0 }],
    ['credits with a negative limit', { approvalMode: 'credits', approvalCreditLimit: -5 }],
    ['credits with a fractional limit', { approvalMode: 'credits', approvalCreditLimit: 2.5 }],
    ['credits with a text limit', { approvalMode: 'credits', approvalCreditLimit: '40' }],
    ['credits over the maximum', { approvalMode: 'credits', approvalCreditLimit: MAX_USER_WORKFLOW_BUDGET_CREDITS + 1 }],
  ])('reads %s as every with no limit', (_label, row) => {
    expect(readApprovalSetting(row as never)).toEqual({ mode: 'every', creditLimit: null });
  });
});
