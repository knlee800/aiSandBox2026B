import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import { ApiKeyIdentity } from '../auth/api-key.config';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import {
  KNOWLEDGE_ERROR_CODES,
  KNOWLEDGE_ERRORS,
  decodeKnowledgeUpload,
  isKnowledgeFilename,
  knowledgeBadRequest,
  knowledgeNotFound,
} from './knowledge-content';
import { KnowledgeScope, KNOWLEDGE_SCOPES } from './knowledge-scopes';
import { KnowledgeService, KnowledgeWriteOutcome } from './knowledge.service';
import { KnowledgeUploadInterceptor } from './knowledge-upload.interceptor';

export interface KnowledgeDocumentListItem {
  id: string;
  scopeId: string;
  title: string;
  byteSize: number;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocumentDetail extends KnowledgeDocumentListItem {
  content: string;
}

export interface KnowledgeWriteResponse extends KnowledgeDocumentDetail {
  outcome: KnowledgeWriteOutcome;
}

interface KnowledgeUploadFile {
  buffer?: Buffer;
  originalname?: string;
}

@Controller('knowledge')
@UseGuards(SessionOrApiKeyAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('scopes')
  listScopes(
    @AuthenticatedUser() identity: ApiKeyIdentity,
  ): { scopes: KnowledgeScope[] } {
    this.assertEntitled(identity);
    return {
      scopes: KNOWLEDGE_SCOPES.map((scope) => ({ id: scope.id, type: scope.type })),
    };
  }

  @Get('documents')
  async listDocuments(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Query('scopeId') scopeId?: unknown,
  ): Promise<{ documents: KnowledgeDocumentListItem[] }> {
    const caller = this.assertEntitled(identity);
    const documents = await this.knowledgeService.list(
      caller.userId,
      this.parseScopeFilter(scopeId),
    );
    return { documents: documents.map((document) => toListItem(document)) };
  }

  @Get('documents/:id')
  async getDocument(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Param('id') id: string,
  ): Promise<KnowledgeDocumentDetail> {
    const caller = this.assertEntitled(identity);
    const document = await this.knowledgeService.findOwned(caller.userId, id);
    if (!document) {
      throw knowledgeNotFound();
    }
    return toDetail(document);
  }

  @Post('documents')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(KnowledgeUploadInterceptor)
  async saveDocument(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @UploadedFile() file: KnowledgeUploadFile | undefined,
    @Body() body: unknown,
  ): Promise<KnowledgeWriteResponse> {
    const caller = this.assertEntitled(identity);
    const hasFile = Boolean(file && (file.originalname || file.buffer));
    let content: unknown;
    if (hasFile) {
      const name = file?.originalname || '';
      if (!isKnowledgeFilename(name)) {
        throw knowledgeBadRequest(
          KNOWLEDGE_ERROR_CODES.wrongFileType,
          KNOWLEDGE_ERRORS.wrongFileType,
        );
      }
      content = decodeKnowledgeUpload(
        Buffer.isBuffer(file?.buffer) ? file.buffer : Buffer.alloc(0),
      );
    } else {
      content = readField(body, 'content');
    }
    const result = await this.knowledgeService.upsert(caller.userId, {
      scopeId: readField(body, 'scopeId'),
      title: readField(body, 'title'),
      content,
    });
    return {
      ...toDetail(result.document),
      outcome: result.outcome,
    };
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDocument(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Param('id') id: string,
  ): Promise<void> {
    const caller = this.assertEntitled(identity);
    await this.knowledgeService.deleteOwned(caller.userId, id);
  }

  private assertEntitled(identity: ApiKeyIdentity | undefined): ApiKeyIdentity {
    if (!identity?.userId || typeof identity.apiKeyId !== 'string' || identity.apiKeyId.length === 0) {
      throw new UnauthorizedException('Missing authentication credentials');
    }
    if (identity.harnessEntitled !== true) {
      throw new ForbiddenException('Forbidden');
    }
    return identity;
  }

  private parseScopeFilter(scopeId: unknown): string | undefined {
    if (scopeId === undefined || scopeId === '') {
      return undefined;
    }
    if (typeof scopeId !== 'string') {
      throw knowledgeBadRequest(
        KNOWLEDGE_ERROR_CODES.unknownScope,
        KNOWLEDGE_ERRORS.unknownScope,
      );
    }
    return scopeId;
  }
}

function readField(body: unknown, key: string): unknown {
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  return (body as Record<string, unknown>)[key];
}

function toListItem(document: KnowledgeDocument): KnowledgeDocumentListItem {
  return {
    id: document.id,
    scopeId: document.scopeId,
    title: document.title,
    byteSize: document.byteSize,
    contentHash: document.contentHash,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function toDetail(document: KnowledgeDocument): KnowledgeDocumentDetail {
  return {
    ...toListItem(document),
    content: document.content,
  };
}
