import { createHash } from 'crypto';
import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { findKnowledgeScope } from './knowledge-scopes';

export const KNOWLEDGE_MAX_DOCUMENT_BYTES = 200 * 1024;
export const KNOWLEDGE_MAX_ACTIVE_DOCUMENTS = 50;
export const KNOWLEDGE_MAX_ACCOUNT_BYTES = 4 * 1024 * 1024;
export const KNOWLEDGE_MAX_TITLE_LENGTH = 200;

export const KNOWLEDGE_ERRORS = {
  unknownScope: 'Unknown knowledge scope.',
  titleRequired: 'Title is required.',
  titleTooLong: 'Title must be 200 characters or fewer.',
  contentRequired: 'Content is required.',
  contentNotUtf8: 'Content must be UTF-8 text.',
  documentTooLarge: 'Document exceeds the 200 KB limit.',
  tooManyDocuments: 'Active document limit is 50.',
  accountTooLarge: 'Account knowledge limit is 4 MB.',
  wrongFileType: 'Only .md and .txt files are supported.',
  notFound: 'Knowledge document not found.',
  userInvalid: 'The user id is not valid.',
  scopesInvalid: 'The knowledge scope list is not valid.',
  queryRequired: 'Search query is required.',
  queryUnsupported: 'Search query contains unsupported control characters.',
  queryTooLong: 'Search query must be at most 120 characters.',
} as const;

export const KNOWLEDGE_ERROR_CODES = {
  unknownScope: 'UNKNOWN_SCOPE',
  titleRequired: 'TITLE_REQUIRED',
  titleTooLong: 'TITLE_TOO_LONG',
  contentRequired: 'CONTENT_REQUIRED',
  contentNotUtf8: 'CONTENT_NOT_UTF8',
  documentTooLarge: 'DOCUMENT_TOO_LARGE',
  tooManyDocuments: 'TOO_MANY_DOCUMENTS',
  accountTooLarge: 'ACCOUNT_TOO_LARGE',
  wrongFileType: 'WRONG_FILE_TYPE',
  notFound: 'NOT_FOUND',
  userInvalid: 'USER_INVALID',
  scopesInvalid: 'SCOPES_INVALID',
  queryRequired: 'QUERY_REQUIRED',
  queryUnsupported: 'QUERY_UNSUPPORTED',
  queryTooLong: 'QUERY_TOO_LONG',
} as const;

export type KnowledgeErrorCode =
  (typeof KNOWLEDGE_ERROR_CODES)[keyof typeof KNOWLEDGE_ERROR_CODES];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PreparedKnowledgeDocument {
  scopeId: string;
  title: string;
  content: string;
  contentHash: string;
  byteSize: number;
}

export function knowledgeBadRequest(
  code: KnowledgeErrorCode,
  message: string,
): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    message,
    error: 'Bad Request',
    code,
  });
}

export function knowledgeNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    message: KNOWLEDGE_ERRORS.notFound,
    error: 'Not Found',
    code: KNOWLEDGE_ERROR_CODES.notFound,
  });
}

export function isKnowledgeDocumentId(id: string): boolean {
  return UUID_PATTERN.test(id);
}

export function isKnowledgeFilename(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized.endsWith('.md') || normalized.endsWith('.txt');
}

export function normalizeKnowledgeContent(input: string): string {
  return input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

export function hashKnowledgeContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function knowledgeByteSize(content: string): number {
  return Buffer.byteLength(content, 'utf8');
}

export function decodeKnowledgeUpload(buffer: Buffer): string {
  if (!Buffer.isBuffer(buffer)) {
    throw knowledgeBadRequest(
      KNOWLEDGE_ERROR_CODES.contentRequired,
      KNOWLEDGE_ERRORS.contentRequired,
    );
  }
  if (buffer.byteLength > KNOWLEDGE_MAX_DOCUMENT_BYTES) {
    throw knowledgeBadRequest(
      KNOWLEDGE_ERROR_CODES.documentTooLarge,
      KNOWLEDGE_ERRORS.documentTooLarge,
    );
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw knowledgeBadRequest(
      KNOWLEDGE_ERROR_CODES.contentNotUtf8,
      KNOWLEDGE_ERRORS.contentNotUtf8,
    );
  }
}

export function prepareKnowledgeWrite(input: {
  scopeId: unknown;
  title: unknown;
  content: unknown;
}): PreparedKnowledgeDocument {
  const scopeId = typeof input.scopeId === 'string' ? input.scopeId.trim() : '';
  if (!findKnowledgeScope(scopeId)) {
    throw knowledgeBadRequest(
      KNOWLEDGE_ERROR_CODES.unknownScope,
      KNOWLEDGE_ERRORS.unknownScope,
    );
  }

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) {
    throw knowledgeBadRequest(
      KNOWLEDGE_ERROR_CODES.titleRequired,
      KNOWLEDGE_ERRORS.titleRequired,
    );
  }
  if (title.length > KNOWLEDGE_MAX_TITLE_LENGTH) {
    throw knowledgeBadRequest(
      KNOWLEDGE_ERROR_CODES.titleTooLong,
      KNOWLEDGE_ERRORS.titleTooLong,
    );
  }

  const content =
    typeof input.content === 'string' ? normalizeKnowledgeContent(input.content) : '';
  if (!content) {
    throw knowledgeBadRequest(
      KNOWLEDGE_ERROR_CODES.contentRequired,
      KNOWLEDGE_ERRORS.contentRequired,
    );
  }

  const byteSize = knowledgeByteSize(content);
  if (byteSize > KNOWLEDGE_MAX_DOCUMENT_BYTES) {
    throw knowledgeBadRequest(
      KNOWLEDGE_ERROR_CODES.documentTooLarge,
      KNOWLEDGE_ERRORS.documentTooLarge,
    );
  }

  return {
    scopeId,
    title,
    content,
    contentHash: hashKnowledgeContent(content),
    byteSize,
  };
}

export function isFileTooLargeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown; getStatus?: () => number };
  if (candidate.name === 'PayloadTooLargeException') {
    return true;
  }
  if (typeof candidate.getStatus === 'function' && candidate.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE) {
    return true;
  }
  return candidate.code === 'LIMIT_FILE_SIZE' || candidate.message === 'File too large';
}
