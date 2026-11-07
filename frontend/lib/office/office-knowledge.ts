export interface KnowledgeBadgeDocument {
  scopeId: string;
  status: string | null;
}

export function readKnowledgeBadgeDocuments(payload: unknown): KnowledgeBadgeDocument[] | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !('documents' in payload)) {
    return null;
  }
  const documents = (payload as { documents?: unknown }).documents;
  if (!Array.isArray(documents)) {
    return null;
  }
  const parsed: KnowledgeBadgeDocument[] = [];
  for (const entry of documents) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return null;
    }
    const scopeId = (entry as { scopeId?: unknown }).scopeId;
    if (typeof scopeId !== 'string' || scopeId.trim().length === 0) {
      return null;
    }
    const statusValue = (entry as { status?: unknown }).status;
    parsed.push({
      scopeId,
      status: typeof statusValue === 'string' ? statusValue : null,
    });
  }
  return parsed;
}

export function countActiveKnowledgeDocuments(
  documents: readonly { scopeId: string; status?: string | null }[],
  scopeIds: readonly string[],
): number {
  const scopes = new Set(scopeIds);
  let count = 0;
  for (const document of documents) {
    if (!scopes.has(document.scopeId)) {
      continue;
    }
    if (document.status != null && document.status !== 'active') {
      continue;
    }
    count += 1;
  }
  return count;
}

export function knowledgeBadgeMessageKey(count: number): 'knowledgeBadge' | 'knowledgeBadgeOne' {
  return count === 1 ? 'knowledgeBadgeOne' : 'knowledgeBadge';
}
