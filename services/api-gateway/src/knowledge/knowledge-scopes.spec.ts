import { collaborationRoleKnowledgeScopes } from '../orchestration/collaboration-teams';
import { SYSTEM_AGENT_DEFINITIONS } from '../system-agents/system-agent-registry';
import {
  KNOWLEDGE_ROLE_SCOPES,
  KNOWLEDGE_SCOPES,
  findKnowledgeScope,
  knowledgeScopesForProfile,
  knowledgeScopesJobFields,
} from './knowledge-scopes';

function scopesFromRegistry(): Array<{ id: string; type: 'shared' | 'specialist' }> {
  const ordered: Array<{ id: string; type: 'shared' | 'specialist' }> = [];
  const seen = new Map<string, 'shared' | 'specialist'>();
  for (const definition of SYSTEM_AGENT_DEFINITIONS) {
    for (const scope of definition.knowledgeScopes) {
      const previous = seen.get(scope.id);
      if (previous && previous !== scope.type) {
        throw new Error(`Scope ${scope.id} has conflicting types in the system-agent registry`);
      }
      if (!previous) {
        seen.set(scope.id, scope.type);
        ordered.push({ id: scope.id, type: scope.type });
      }
    }
  }
  return ordered;
}

describe('knowledge scope registry', () => {
  const fromRegistry = scopesFromRegistry();

  it('equals the system-agent registry ids and types in first-seen order', () => {
    expect(fromRegistry.length).toBeGreaterThan(0);
    expect(fromRegistry).toEqual(
      expect.arrayContaining([
        { id: 'company-monthly-reports', type: 'shared' },
        { id: 'tech-landscape', type: 'specialist' },
      ]),
    );
    expect(KNOWLEDGE_SCOPES.map((scope) => ({ id: scope.id, type: scope.type }))).toEqual(
      fromRegistry,
    );
  });

  it('has no duplicate server scope ids', () => {
    const ids = KNOWLEDGE_SCOPES.map((scope) => scope.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('knowledge role scopes', () => {
  it('gives chief-of-staff the five shared scopes plus contract-templates', () => {
    const chiefScopes = [
      'company-monthly-reports',
      'three-year-goals',
      'strategy-docs',
      'policies',
      'meeting-summaries',
      'contract-templates',
    ];
    const shared = chiefScopes.slice(0, 5);
    expect(KNOWLEDGE_ROLE_SCOPES).toEqual({
      'chief-of-staff': chiefScopes,
      'advisors-lead': chiefScopes,
      'product-strategy': [...shared, 'market-data'],
      'technology-advisor': [...shared, 'tech-landscape'],
    });
    expect(collaborationRoleKnowledgeScopes()).toEqual(KNOWLEDGE_ROLE_SCOPES);
    expect(knowledgeScopesForProfile('chief-of-staff')).toEqual(chiefScopes);
    expect(knowledgeScopesForProfile('advisors-lead')).toEqual(chiefScopes);
    expect(knowledgeScopesForProfile('product-strategy')).toEqual([...shared, 'market-data']);
    expect(knowledgeScopesForProfile('technology-advisor')).toEqual([...shared, 'tech-landscape']);
    expect(knowledgeScopesJobFields('chief-of-staff')).toEqual({
      knowledgeScopes: chiefScopes,
    });
    for (const profileId of ['lead', 'writer', 'reviewer', 'builder']) {
      expect(knowledgeScopesForProfile(profileId)).toEqual([]);
      expect(knowledgeScopesJobFields(profileId)).toEqual({});
    }
    for (const ids of Object.values(KNOWLEDGE_ROLE_SCOPES)) {
      for (const id of ids) {
        expect(findKnowledgeScope(id)).toBeDefined();
      }
    }
  });

  it('copies an explicit scope list and throws on an unknown or duplicate id', () => {
    expect(knowledgeScopesJobFields(['policies'])).toEqual({
      knowledgeScopes: ['policies'],
    });
    expect(knowledgeScopesJobFields([])).toEqual({});
    expect(() => knowledgeScopesJobFields(['not-a-scope'])).toThrow();
    expect(() => knowledgeScopesJobFields(['policies', 'policies'])).toThrow();
  });
});
