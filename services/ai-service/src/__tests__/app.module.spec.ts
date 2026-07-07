import * as fs from 'fs';
import * as path from 'path';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from '../app.module';

describe('AppModule (Phase 27: ClaudeModule Conditional Loading)', () => {
  const appModulePath = path.resolve(__dirname, '../app.module.ts');

  function getAppModuleImports(): readonly unknown[] {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as
      | readonly unknown[]
      | undefined;
    return imports ?? [];
  }

  function hasDirectClaudeModuleImportMetadata(): boolean {
    return getAppModuleImports().some((entry) => {
      if (typeof entry === 'function') {
        return entry.name === 'ClaudeModule';
      }
      if (entry && typeof entry === 'object' && 'module' in entry) {
        const moduleRef = (entry as { module?: unknown }).module;
        return typeof moduleRef === 'function' && moduleRef.name === 'ClaudeModule';
      }
      return false;
    });
  }

  function hasDirectClaudeModuleImportSource(): boolean {
    const source = fs.readFileSync(appModulePath, 'utf8');
    return (
      source.includes("from './claude/claude.module'") ||
      source.includes('from "./claude/claude.module"')
    );
  }

  beforeEach(() => {
    // Keep env setup deterministic for any downstream import behavior.
    process.env.INTERNAL_SERVICE_KEY = 'test-internal-key';
    process.env.API_GATEWAY_URL = 'http://localhost:4000';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  });

  it('should NOT initialize ClaudeModule when AI_PROVIDER=xai', () => {
    process.env.AI_PROVIDER = 'xai';
    process.env.XAI_API_KEY = 'test-xai-key';

    expect(hasDirectClaudeModuleImportMetadata()).toBe(false);
    expect(hasDirectClaudeModuleImportSource()).toBe(false);
  });

  it('should NOT initialize ClaudeModule when AI_PROVIDER=stub (default)', () => {
    delete process.env.AI_PROVIDER;
    delete process.env.XAI_API_KEY;

    expect(hasDirectClaudeModuleImportMetadata()).toBe(false);
    expect(hasDirectClaudeModuleImportSource()).toBe(false);
  });

  it('should NOT import ClaudeModule directly in AppModule', () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

    expect(hasDirectClaudeModuleImportMetadata()).toBe(false);
    expect(hasDirectClaudeModuleImportSource()).toBe(false);
  });
});
