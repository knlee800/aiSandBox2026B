import {
  SYSTEM_AGENT_DEFINITIONS,
  systemAgentById,
} from '../../system-agents/system-agent-registry';
import { BadRequestException } from '@nestjs/common';
import {
  MAX_ROSTER_MEMBERS,
  ROSTER_REFUSAL_CODES,
  USER_WORKFLOW_RULES,
  USER_WORKFLOW_TEMPLATE_IDS,
  assertRosterMemberIds,
  isUserWorkflowTemplateId,
  readRosterMemberIds,
} from '../user-workflow-rules';

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
