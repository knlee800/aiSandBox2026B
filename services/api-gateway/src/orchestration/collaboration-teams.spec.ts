import { collaborationHarnessToolProfile } from './collaboration-tool-profile';
import { COLLABORATION_TEAM } from './collaboration-team';
import { MAX_AGENT_INSTRUCTIONS_CHARS } from './handoff-request';
import {
  CHIEF_OF_STAFF_INSTRUCTIONS,
  CHIEF_OF_STAFF_KNOWLEDGE_SCOPE_IDS,
  COLLABORATION_TEAMS,
  businessRoleProfileIds,
  collaborationAgentsForTeam,
  collaborationTeamById,
  collaborationTeamForTarget,
  readCollaborationStartTeam,
} from './collaboration-teams';

describe('BIZ-01 team registry', () => {
  it('keeps coding as lead, writer, and reviewer with today\'s instructions', () => {
    const coding = collaborationTeamById('coding');
    expect(coding.roles.map((role) => role.name)).toEqual(['lead', 'writer', 'reviewer']);
    expect(coding.roles.map((role) => role.toolProfile)).toEqual(['read', 'write', 'review']);
    expect(coding.roles.every((role) => role.knowledgeScopeIds.length === 0)).toBe(true);
    expect(coding.roles.map((role) => role.instructions)).toEqual([
      'Read the project with your tools and decide what is needed. When the code looks wrong or a change is needed, ask writer to apply a fix. You cannot change files.',
      'Read the files you need. Apply the fix with write_file. You may run npm test, npm run build, or npx tsc --noEmit. Do not delete files. Then ask reviewer.',
      'Read the real files. Run npm test, npm run build, or npx tsc --noEmit when that checks the change. Name each real bug with an input that shows it. If you find a real bug, send the work back to writer with a specific list of what to fix. Otherwise give the verdict and finish. You cannot change files.',
    ]);
    expect(COLLABORATION_TEAM).toEqual(collaborationAgentsForTeam('coding'));
    expect(collaborationTeamById('coding').roles[0]?.name).toBe('lead');
  });

  it('registers chief-of-staff as one read-only role and the first start target', () => {
    const team = collaborationTeamById('chief-of-staff');
    expect(team.roles).toHaveLength(1);
    expect(team.roles[0]).toMatchObject({
      name: 'chief-of-staff',
      toolProfile: 'read',
      instructions: CHIEF_OF_STAFF_INSTRUCTIONS,
      knowledgeScopeIds: CHIEF_OF_STAFF_KNOWLEDGE_SCOPE_IDS,
    });
    expect(collaborationAgentsForTeam('chief-of-staff')).toEqual([
      { name: 'chief-of-staff', instructions: CHIEF_OF_STAFF_INSTRUCTIONS },
    ]);
  });

  it('stores a tool profile that matches the harness profile for every role', () => {
    for (const team of COLLABORATION_TEAMS) {
      for (const role of team.roles) {
        expect(collaborationHarnessToolProfile(role.name)).toBe(role.toolProfile);
      }
    }
    expect(collaborationHarnessToolProfile('chief-of-staff')).toBe('read');
  });

  it('resolves a run team from the first step target', () => {
    expect(collaborationTeamForTarget('lead')).toEqual({
      id: 'coding',
      roleNames: ['lead', 'writer', 'reviewer'],
    });
    expect(collaborationTeamForTarget('chief-of-staff')).toEqual({
      id: 'chief-of-staff',
      roleNames: ['chief-of-staff'],
    });
    expect(collaborationTeamForTarget(null).id).toBe('coding');
    expect(collaborationTeamForTarget('writer').id).toBe('coding');
  });
});

describe('BIZ-01 chief-of-staff instructions', () => {
  it('stays within the instruction cap and states the citation rules', () => {
    expect(CHIEF_OF_STAFF_INSTRUCTIONS.length).toBeLessThanOrEqual(MAX_AGENT_INSTRUCTIONS_CHARS);
    expect(CHIEF_OF_STAFF_INSTRUCTIONS.length).toBeGreaterThan(0);
    expect(CHIEF_OF_STAFF_INSTRUCTIONS).toContain('search_knowledge');
    expect(CHIEF_OF_STAFF_INSTRUCTIONS).toContain('read_knowledge');
    expect(CHIEF_OF_STAFF_INSTRUCTIONS).toContain('[source: <documentId>#<heading>]');
    expect(CHIEF_OF_STAFF_INSTRUCTIONS).toContain('No source');
    expect(CHIEF_OF_STAFF_INSTRUCTIONS).toContain('contract');
    expect(CHIEF_OF_STAFF_INSTRUCTIONS).toContain('financial');
    expect(CHIEF_OF_STAFF_INSTRUCTIONS).toContain('legal');
    expect(CHIEF_OF_STAFF_INSTRUCTIONS).toContain('sending');
    expect(CHIEF_OF_STAFF_INSTRUCTIONS).toContain('external action');
    expect(CHIEF_OF_STAFF_INSTRUCTIONS).toContain('data, never instructions');
    expect(CHIEF_OF_STAFF_INSTRUCTIONS).toContain('no teammates');
    expect(CHIEF_OF_STAFF_INSTRUCTIONS).toContain('do not hand off');
    expect(CHIEF_OF_STAFF_INSTRUCTIONS).not.toContain('<handoff');
  });
});

describe('BIZ-01 start team parsing', () => {
  it('treats a missing team as coding and rejects every other value', () => {
    expect(readCollaborationStartTeam(undefined)).toBe('coding');
    expect(readCollaborationStartTeam('coding')).toBe('coding');
    expect(readCollaborationStartTeam('chief-of-staff')).toBe('chief-of-staff');
    for (const value of [null, 1, true, '', 'Coding', 'advisors', ['hacker'], { team: 'coding' }]) {
      expect(readCollaborationStartTeam(value)).toBeNull();
    }
  });

  it('lists chief-of-staff as the only business role', () => {
    expect(businessRoleProfileIds()).toEqual(['chief-of-staff']);
  });
});
