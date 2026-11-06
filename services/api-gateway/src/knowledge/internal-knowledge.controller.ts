import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  KNOWLEDGE_ERROR_CODES,
  KNOWLEDGE_ERRORS,
  isKnowledgeDocumentId,
  knowledgeBadRequest,
  knowledgeNotFound,
} from './knowledge-content';
import { KnowledgeService } from './knowledge.service';
import { findKnowledgeScope } from './knowledge-scopes';
import {
  normalizeKnowledgeSearchQuery,
  readKnowledgeSection,
  searchKnowledgeDocuments,
} from './knowledge-search';

/**
 * Internal knowledge routes for the harness.
 * POST /api/internal/knowledge/search
 * POST /api/internal/knowledge/read
 *
 * Protected by the global InternalServiceAuthGuard (X-Internal-Service-Key).
 * userId and scopes are the signed job values. Other body fields are ignored.
 */
@Controller('internal/knowledge')
export class InternalKnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@Body() body: unknown): Promise<{
    query: string;
    results: Array<{
      documentId: string;
      title: string;
      scopeId: string;
      heading: string | null;
      preview: string;
    }>;
    truncated: boolean;
  }> {
    const record = readBody(body);
    const userId = readUserId(record);
    const scopes = readScopes(record);
    const query = normalizeKnowledgeSearchQuery(record.query);
    const rows = await this.knowledgeService.findActiveForScopes(userId, scopes);
    const found = searchKnowledgeDocuments(rows, query);
    return { query, results: found.results, truncated: found.truncated };
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  async read(@Body() body: unknown): Promise<{
    documentId: string;
    title: string;
    scopeId: string;
    heading: string | null;
    content: string;
    truncated: boolean;
  }> {
    const record = readBody(body);
    const userId = readUserId(record);
    const scopes = readScopes(record);
    const documentId = record.documentId;
    if (typeof documentId !== 'string' || !isKnowledgeDocumentId(documentId)) {
      throw knowledgeNotFound();
    }
    const row = await this.knowledgeService.findActiveOwnedInScopes(
      userId,
      documentId,
      scopes,
    );
    if (!row) {
      throw knowledgeNotFound();
    }
    const heading = typeof record.heading === 'string' ? record.heading : null;
    const section = readKnowledgeSection(row.content, heading);
    if (!section) {
      throw knowledgeNotFound();
    }
    return {
      documentId: row.id,
      title: row.title,
      scopeId: row.scopeId,
      heading: section.heading,
      content: section.content,
      truncated: false,
    };
  }
}

function readBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  return body as Record<string, unknown>;
}

function readUserId(record: Record<string, unknown>): string {
  const userId = record.userId;
  if (typeof userId !== 'string' || !isKnowledgeDocumentId(userId)) {
    throw knowledgeBadRequest(
      KNOWLEDGE_ERROR_CODES.userInvalid,
      KNOWLEDGE_ERRORS.userInvalid,
    );
  }
  return userId;
}

function readScopes(record: Record<string, unknown>): string[] {
  const scopes = record.scopes;
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw knowledgeBadRequest(
      KNOWLEDGE_ERROR_CODES.scopesInvalid,
      KNOWLEDGE_ERRORS.scopesInvalid,
    );
  }
  const copied: string[] = [];
  const seen = new Set<string>();
  for (const id of scopes) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw knowledgeBadRequest(
        KNOWLEDGE_ERROR_CODES.scopesInvalid,
        KNOWLEDGE_ERRORS.scopesInvalid,
      );
    }
    if (seen.has(id)) {
      throw knowledgeBadRequest(
        KNOWLEDGE_ERROR_CODES.scopesInvalid,
        KNOWLEDGE_ERRORS.scopesInvalid,
      );
    }
    const scope = findKnowledgeScope(id);
    if (!scope) {
      throw knowledgeBadRequest(
        KNOWLEDGE_ERROR_CODES.unknownScope,
        KNOWLEDGE_ERRORS.unknownScope,
      );
    }
    seen.add(scope.id);
    copied.push(scope.id);
  }
  return copied;
}
