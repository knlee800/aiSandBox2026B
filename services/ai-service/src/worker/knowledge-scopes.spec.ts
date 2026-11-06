import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { HARNESS_KNOWLEDGE_SCOPE_IDS } from './knowledge-scopes';

function gatewayScopesPath(): string {
  let dir = __dirname;
  for (let hop = 0; hop < 8; hop += 1) {
    const candidates = [
      join(dir, 'services', 'api-gateway', 'src', 'knowledge', 'knowledge-scopes.ts'),
      join(dir, 'api-gateway', 'src', 'knowledge', 'knowledge-scopes.ts'),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('Could not read services/api-gateway/src/knowledge/knowledge-scopes.ts');
}

function scopeIdsFromGateway(source: string): string[] {
  const block = source.match(/export const KNOWLEDGE_SCOPES[\s\S]*?\];/);
  if (!block) {
    throw new Error('KNOWLEDGE_SCOPES was not found in knowledge-scopes.ts');
  }
  return [...block[0].matchAll(/id:\s*'([^']+)'/g)].map((match) => match[1]);
}

describe('harness knowledge scope ids', () => {
  it('matches the gateway registry ids in order', () => {
    const ids = scopeIdsFromGateway(readFileSync(gatewayScopesPath(), 'utf8'));
    expect(ids.length).toBeGreaterThan(0);
    expect([...HARNESS_KNOWLEDGE_SCOPE_IDS]).toEqual(ids);
  });
});
