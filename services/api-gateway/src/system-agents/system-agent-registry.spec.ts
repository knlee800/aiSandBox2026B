import { createHash } from 'crypto';
import {
  CHIEF_OF_STAFF_INSTRUCTIONS,
  CHIEF_OF_STAFF_KNOWLEDGE_SCOPE_IDS,
  SYSTEM_AGENT_DEFINITIONS,
  listPublicSystemAgents,
  systemAgentById,
  systemAgentVersion,
  type SystemAgentDefinition,
} from './system-agent-registry';

const CODING_LEAD_INSTRUCTIONS =
  'Read the project with your tools and decide what is needed. When the code looks wrong or a change is needed, ask writer to apply a fix. You cannot change files.';

const CODING_WRITER_INSTRUCTIONS =
  'Read the files you need. Apply the fix with write_file. You may run npm test, npm run build, or npx tsc --noEmit. Do not delete files. Then ask reviewer.';

const CODING_REVIEWER_INSTRUCTIONS =
  'Read the real files. Run npm test, npm run build, or npx tsc --noEmit when that checks the change. Name each real bug with an input that shows it. If you find a real bug, send the work back to writer with a specific list of what to fix. Otherwise give the verdict and finish. You cannot change files.';

const SHARED_SCOPE_IDS = [
  'company-monthly-reports',
  'three-year-goals',
  'strategy-docs',
  'policies',
  'meeting-summaries',
];

/** Pins from systemAgentVersion. A covered-field edit must update the matching hex. */
const PINNED_SYSTEM_AGENT_VERSIONS: Record<string, string> = {
  builder: '63e0208809a53df6ca75b4a4ad73b5b7f6179d4e9b4f069b487da3e4a3b36d6b',
  lead: '6cb7336cd8c0bac2bfdbe852a1ac4cbd313a139624ce83ad266356235b77ace5',
  writer: 'a41b3b8d612a6605635a4e84d0b3614c35ea90c6c2dcd145c3ed34f6d8e01a32',
  reviewer: 'd3a33416bd82dd851679dec16bd149799121876e7b1fd80f76bf53dab9eac364',
  'chief-of-staff': '75d406a8be9ded67a3badb79eac210703175a71b44cf15d5eb3d299b0bc5250d',
  'product-strategy': 'd6332d3d81bf1e0d8e47c956e041623dbb7e3610dfcf8a22bbaf630b97abef05',
  'technology-advisor': '7e3615ccfb4fc0721c2ef1f5f22ccefc882d533669a425df464199ec95a51876',
};

function versionMaterial(definition: SystemAgentDefinition): string {
  const payload = {
    id: definition.id,
    instructions: definition.instructions,
    toolProfile: definition.toolProfile,
    scopes: definition.knowledgeScopes.map((scope) => ({ id: scope.id, type: scope.type })),
    modelChoice: 'server',
    teamRole: definition.teamRole
      ? { teamId: definition.teamRole.teamId, roleName: definition.teamRole.roleName }
      : null,
  };
  return JSON.stringify(payload);
}

function sha256(material: string): string {
  return createHash('sha256').update(material, 'utf8').digest('hex');
}

function definition(id: string): SystemAgentDefinition {
  const found = systemAgentById(id);
  if (!found) {
    throw new Error(`missing ${id}`);
  }
  return found;
}

describe('system agent registry', () => {
  it('lists the seven definitions in order', () => {
    expect(SYSTEM_AGENT_DEFINITIONS.map((agent) => agent.id)).toEqual([
      'builder',
      'lead',
      'writer',
      'reviewer',
      'chief-of-staff',
      'product-strategy',
      'technology-advisor',
    ]);
    for (const agent of SYSTEM_AGENT_DEFINITIONS) {
      expect(agent.modelChoice).toBe('server');
    }
  });

  it('keeps the public rows, team roles, tool profiles, and scopes', () => {
    const builder = definition('builder');
    expect(builder.status).toBe('active');
    expect(builder.enabled).toBe(true);
    expect(builder.toolProfile).toBeNull();
    expect(builder.teamRole).toBeNull();
    expect(builder.nameKey).toBe('agents.builder.name');
    expect(builder.knowledgeScopes.map((scope) => scope.id)).toEqual([
      ...SHARED_SCOPE_IDS,
      'codebase-context',
    ]);
    expect(builder.knowledgeScopes.map((scope) => scope.type)).toEqual([
      'shared',
      'shared',
      'shared',
      'shared',
      'shared',
      'specialist',
    ]);

    expect(definition('lead')).toMatchObject({
      nameKey: null,
      roleKey: null,
      descriptionKey: null,
      status: null,
      enabled: false,
      toolProfile: 'read',
      teamRole: { teamId: 'coding', roleName: 'lead' },
      knowledgeScopes: [],
    });
    expect(definition('writer').toolProfile).toBe('write');
    expect(definition('writer').teamRole).toEqual({ teamId: 'coding', roleName: 'writer' });
    expect(definition('reviewer').toolProfile).toBe('review');
    expect(definition('reviewer').teamRole).toEqual({ teamId: 'coding', roleName: 'reviewer' });

    const chief = definition('chief-of-staff');
    expect(chief.status).toBe('active');
    expect(chief.enabled).toBe(false);
    expect(chief.toolProfile).toBe('read');
    expect(chief.teamRole).toEqual({ teamId: 'chief-of-staff', roleName: 'chief-of-staff' });
    expect(chief.nameKey).toBe('agents.chiefOfStaff.name');
    expect(chief.knowledgeScopes.map((scope) => scope.id)).toEqual([
      ...SHARED_SCOPE_IDS,
      'contract-templates',
    ]);
    expect(CHIEF_OF_STAFF_KNOWLEDGE_SCOPE_IDS).toEqual(
      chief.knowledgeScopes.map((scope) => scope.id),
    );

    expect(definition('product-strategy')).toMatchObject({
      status: 'coming_soon',
      enabled: false,
      toolProfile: null,
      teamRole: null,
      nameKey: 'agents.productStrategy.name',
    });
    expect(definition('product-strategy').knowledgeScopes.map((scope) => scope.id)).toEqual([
      ...SHARED_SCOPE_IDS,
      'market-data',
    ]);
    expect(definition('technology-advisor')).toMatchObject({
      status: 'coming_soon',
      enabled: false,
      toolProfile: null,
      teamRole: null,
      nameKey: 'agents.technologyAdvisor.name',
    });
    expect(definition('technology-advisor').knowledgeScopes.map((scope) => scope.id)).toEqual([
      ...SHARED_SCOPE_IDS,
      'tech-landscape',
    ]);
  });

  it('pins the seven instruction strings', () => {
    expect(definition('builder').instructions).toBe('');
    expect(definition('lead').instructions).toBe(CODING_LEAD_INSTRUCTIONS);
    expect(definition('writer').instructions).toBe(CODING_WRITER_INSTRUCTIONS);
    expect(definition('reviewer').instructions).toBe(CODING_REVIEWER_INSTRUCTIONS);
    expect(definition('chief-of-staff').instructions).toBe(CHIEF_OF_STAFF_INSTRUCTIONS);
    expect(definition('product-strategy').instructions).toBe('');
    expect(definition('technology-advisor').instructions).toBe('');
    expect(CHIEF_OF_STAFF_INSTRUCTIONS).toContain('search_knowledge');
  });

  it('pins the seven version hashes', () => {
    const actual: Record<string, string> = {};
    for (const agent of SYSTEM_AGENT_DEFINITIONS) {
      const material = versionMaterial(agent);
      const parsed = JSON.parse(material) as Record<string, unknown>;
      expect(Object.keys(parsed)).toEqual([
        'id',
        'instructions',
        'toolProfile',
        'scopes',
        'modelChoice',
        'teamRole',
      ]);
      expect(material).not.toContain('"status"');
      expect(material).not.toContain('"enabled"');
      expect(material).not.toContain('"nameKey"');
      expect(agent.version).toBe(systemAgentVersion(agent.id));
      expect(agent.version).toBe(sha256(material));
      expect(agent.version).toMatch(/^[0-9a-f]{64}$/);
      actual[agent.id] = agent.version;
    }
    expect(actual).toEqual(PINNED_SYSTEM_AGENT_VERSIONS);
  });

  it('publishes builder, chief of staff, product strategy, and technology advisor only', () => {
    const agents = listPublicSystemAgents();
    expect(agents.map((agent) => agent.id)).toEqual([
      'builder',
      'chief-of-staff',
      'product-strategy',
      'technology-advisor',
    ]);
    for (const agent of agents) {
      expect(agent.version).toBe(systemAgentVersion(agent.id));
      expect(Object.keys(agent).sort()).toEqual([
        'descriptionKey',
        'enabled',
        'id',
        'knowledgeScopes',
        'nameKey',
        'roleKey',
        'status',
        'version',
      ]);
    }
  });
});
