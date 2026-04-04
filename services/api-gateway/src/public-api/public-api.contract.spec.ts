import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { PublicDocsController } from './public-docs.controller';
import { PublicSessionsController } from './public-sessions.controller';
import { PublicFilesController } from './public-files.controller';
import { PublicProjectsController } from './public-projects.controller';
import { PublicAIController } from './public-ai.controller';

describe('Public API v1 contract boundaries (ADV-04-01)', () => {
  it('docs surface includes only bounded /api/v1 capability set', () => {
    const docs = new PublicDocsController().getDocs();
    const paths = Object.keys(docs.paths);

    expect(docs.openapi).toBe('3.0.0');
    expect(paths).toEqual([
      '/api/v1/sessions',
      '/api/v1/ai/execute',
      '/api/v1/ai/executions/{executionId}',
      '/api/v1/files/list',
      '/api/v1/files/read',
      '/api/v1/files/write',
      '/api/v1/projects',
    ]);
    expect(paths.some((path) => path.includes('/internal'))).toBe(false);
  });

  it('enforces api key auth guard on all exposed public controllers', () => {
    const guardedControllers = [
      PublicSessionsController,
      PublicFilesController,
      PublicProjectsController,
      PublicAIController,
    ];

    for (const controller of guardedControllers) {
      const guards = Reflect.getMetadata('__guards__', controller) ?? [];
      const guardNames = guards.map((guardRef: { name?: string }) => guardRef?.name);
      expect(guardNames).toContain(ApiKeyAuthGuard.name);
    }
  });
});
