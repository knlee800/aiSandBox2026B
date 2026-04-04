import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('v1/docs')
export class PublicDocsController {
  @Get()
  @HttpCode(HttpStatus.OK)
  getDocs(): {
    openapi: string;
    info: { title: string; version: string };
    paths: Record<string, unknown>;
  } {
    return {
      openapi: '3.0.0',
      info: {
        title: 'AI Sandbox Public API',
        version: 'v1',
      },
      paths: {
        '/api/v1/sessions': {
          post: { summary: 'Create session (API key auth)' },
          get: { summary: 'List sessions (API key auth)' },
        },
        '/api/v1/ai/execute': {
          post: { summary: 'Queue AI execution (API key auth + scope)' },
        },
        '/api/v1/ai/executions/{executionId}': {
          get: { summary: 'Read AI execution status/result' },
        },
        '/api/v1/files/list': {
          post: { summary: 'List session files' },
        },
        '/api/v1/files/read': {
          post: { summary: 'Read session file' },
        },
        '/api/v1/files/write': {
          post: { summary: 'Write session file' },
        },
        '/api/v1/projects': {
          get: { summary: 'List projects' },
          post: { summary: 'Create project' },
        },
      },
    };
  }
}
