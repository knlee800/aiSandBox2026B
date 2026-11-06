export const KNOWLEDGE_SCOPE_TYPES = ['shared', 'specialist'] as const;
export type KnowledgeScopeType = (typeof KNOWLEDGE_SCOPE_TYPES)[number];

export interface KnowledgeScope {
  id: string;
  type: KnowledgeScopeType;
}

/**
 * Unique scope ids and types from frontend/lib/agent-platform/agent-registry.ts,
 * in first-seen order. knowledge-scopes.spec.ts fails if the two lists diverge.
 * legal-contracts is not in the registry, so it is not registered here.
 */
export const KNOWLEDGE_SCOPES: readonly KnowledgeScope[] = [
  { id: 'company-monthly-reports', type: 'shared' },
  { id: 'three-year-goals', type: 'shared' },
  { id: 'strategy-docs', type: 'shared' },
  { id: 'policies', type: 'shared' },
  { id: 'meeting-summaries', type: 'shared' },
  { id: 'codebase-context', type: 'specialist' },
  { id: 'contract-templates', type: 'specialist' },
  { id: 'market-data', type: 'specialist' },
  { id: 'tech-landscape', type: 'specialist' },
];

export const KNOWLEDGE_SCOPE_ID_VALUES: string[] = KNOWLEDGE_SCOPES.map(
  (scope) => scope.id,
);

const SCOPE_BY_ID = new Map(KNOWLEDGE_SCOPES.map((scope) => [scope.id, scope]));

export function findKnowledgeScope(id: string): KnowledgeScope | undefined {
  return SCOPE_BY_ID.get(id);
}

/**
 * Role id to signed scope list. Empty until BIZ-01. A bad id cannot be signed.
 */
export const KNOWLEDGE_ROLE_SCOPES: Readonly<Record<string, readonly string[]>> = {};

function copyValidatedKnowledgeScopeIds(ids: readonly string[]): string[] {
  const copied: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const scope = findKnowledgeScope(id);
    if (!scope || seen.has(scope.id)) {
      throw new Error(`Invalid knowledge scope: ${String(id)}`);
    }
    seen.add(scope.id);
    copied.push(scope.id);
  }
  return copied;
}

export function knowledgeScopesForProfile(profileId: string): readonly string[] {
  return copyValidatedKnowledgeScopeIds(KNOWLEDGE_ROLE_SCOPES[profileId] ?? []);
}

/**
 * {} when the list is empty. Otherwise { knowledgeScopes } with registry ids copied.
 * A string looks up KNOWLEDGE_ROLE_SCOPES. An array is an explicit list.
 */
export function knowledgeScopesJobFields(
  profileIdOrScopes: string | readonly string[],
): { knowledgeScopes?: readonly string[] } {
  const scopes = typeof profileIdOrScopes === 'string'
    ? knowledgeScopesForProfile(profileIdOrScopes)
    : copyValidatedKnowledgeScopeIds(profileIdOrScopes);
  if (scopes.length === 0) {
    return {};
  }
  return { knowledgeScopes: scopes };
}
