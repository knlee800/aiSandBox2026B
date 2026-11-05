import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { KNOWLEDGE_SCOPES } from './knowledge-scopes';

function registryPath(): string {
  let dir = __dirname;
  for (let hop = 0; hop < 8; hop += 1) {
    const candidate = join(dir, 'frontend', 'lib', 'agent-platform', 'agent-registry.ts');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('Could not read frontend/lib/agent-platform/agent-registry.ts');
}

function scopesFromRegistry(source: string): Array<{ id: string; type: 'shared' | 'specialist' }> {
  const blocks = source.match(/knowledgeScopes:\s*\[[\s\S]*?\]/g);
  if (!blocks || blocks.length === 0) {
    throw new Error('No knowledgeScopes arrays found in agent-registry.ts');
  }
  const ordered: Array<{ id: string; type: 'shared' | 'specialist' }> = [];
  const seen = new Map<string, 'shared' | 'specialist'>();
  for (const block of blocks) {
    const refs = block.matchAll(/\{\s*id:\s*'([^']+)',\s*type:\s*'(shared|specialist)'\s*\}/g);
    for (const ref of refs) {
      const id = ref[1];
      const type = ref[2] as 'shared' | 'specialist';
      const previous = seen.get(id);
      if (previous && previous !== type) {
        throw new Error(`Scope ${id} has conflicting types in agent-registry.ts`);
      }
      if (!previous) {
        seen.set(id, type);
        ordered.push({ id, type });
      }
    }
  }
  if (ordered.length === 0) {
    throw new Error('No scope refs parsed from agent-registry.ts');
  }
  return ordered;
}

describe('knowledge scope registry', () => {
  const source = readFileSync(registryPath(), 'utf8');
  const fromFrontend = scopesFromRegistry(source);

  it('equals the frontend registry ids and types in first-seen order', () => {
    expect(fromFrontend.length).toBeGreaterThan(0);
    expect(fromFrontend).toEqual(
      expect.arrayContaining([
        { id: 'company-monthly-reports', type: 'shared' },
        { id: 'tech-landscape', type: 'specialist' },
      ]),
    );
    expect(KNOWLEDGE_SCOPES.map((scope) => ({ id: scope.id, type: scope.type }))).toEqual(
      fromFrontend,
    );
  });

  it('has no duplicate server scope ids', () => {
    const ids = KNOWLEDGE_SCOPES.map((scope) => scope.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
