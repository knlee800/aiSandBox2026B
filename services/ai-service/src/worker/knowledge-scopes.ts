export const KNOWLEDGE_SCOPES_REQUIRES_HARNESS = 'knowledge_scopes_requires_harness';
export const KNOWLEDGE_SCOPES_INVALID = 'knowledge_scopes_invalid';
export const KNOWLEDGE_SCOPES_PROFILE_CONFLICT = 'knowledge_scopes_profile_conflict';

export const KNOWLEDGE_SCOPES_REQUIRES_HARNESS_MESSAGE =
  'Knowledge scopes were set without harness v1, so this step was stopped.';
export const KNOWLEDGE_SCOPES_INVALID_MESSAGE =
  'The knowledge scope list is not valid, so this step was stopped.';
export const KNOWLEDGE_SCOPES_PROFILE_CONFLICT_MESSAGE =
  'Knowledge scopes do not match the read-only profile, so this step was stopped.';

/**
 * Registry ids from services/api-gateway/src/knowledge/knowledge-scopes.ts.
 * knowledge-scopes.spec.ts fails if the two lists diverge. No trim, case-sensitive.
 */
export const HARNESS_KNOWLEDGE_SCOPE_IDS: readonly string[] = Object.freeze([
  'company-monthly-reports',
  'three-year-goals',
  'strategy-docs',
  'policies',
  'meeting-summaries',
  'codebase-context',
  'contract-templates',
  'market-data',
  'tech-landscape',
]);

const HARNESS_KNOWLEDGE_SCOPE_ID_SET = new Set<string>(HARNESS_KNOWLEDGE_SCOPE_IDS);

export type HarnessKnowledgeProfileName = 'read' | 'review' | 'write' | 'agent-write';

export type KnowledgeScopesResolution =
  | { readonly ok: true; readonly scopes: readonly string[] }
  | { readonly ok: false; readonly code: string; readonly message: string };

const INVALID_SCOPES: KnowledgeScopesResolution = {
  ok: false,
  code: KNOWLEDGE_SCOPES_INVALID,
  message: KNOWLEDGE_SCOPES_INVALID_MESSAGE,
};

/**
 * Missing (`undefined`) is valid. A present value on a non-v1 job is rejected
 * before the list is inspected. A non-empty valid list is only valid for `read`.
 */
export function resolveKnowledgeScopes(
  job: {
    readonly knowledgeScopes?: unknown;
    readonly harnessVersion?: unknown;
  },
  profile: HarnessKnowledgeProfileName | null,
): KnowledgeScopesResolution {
  if (job.knowledgeScopes === undefined) {
    return { ok: true, scopes: [] };
  }
  if (job.harnessVersion !== 'v1') {
    return {
      ok: false,
      code: KNOWLEDGE_SCOPES_REQUIRES_HARNESS,
      message: KNOWLEDGE_SCOPES_REQUIRES_HARNESS_MESSAGE,
    };
  }
  if (
    !Array.isArray(job.knowledgeScopes) ||
    job.knowledgeScopes.length > HARNESS_KNOWLEDGE_SCOPE_IDS.length
  ) {
    return INVALID_SCOPES;
  }
  const scopes: string[] = [];
  const seen = new Set<string>();
  for (const id of job.knowledgeScopes) {
    if (typeof id !== 'string' || id.trim().length === 0 || !HARNESS_KNOWLEDGE_SCOPE_ID_SET.has(id)) {
      return INVALID_SCOPES;
    }
    if (seen.has(id)) {
      return INVALID_SCOPES;
    }
    seen.add(id);
    scopes.push(id);
  }
  if (scopes.length === 0) {
    return { ok: true, scopes: [] };
  }
  if (profile !== 'read') {
    return {
      ok: false,
      code: KNOWLEDGE_SCOPES_PROFILE_CONFLICT,
      message: KNOWLEDGE_SCOPES_PROFILE_CONFLICT_MESSAGE,
    };
  }
  return { ok: true, scopes };
}
