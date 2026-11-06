import type { ApiGatewayHttpClient } from '../../../clients/api-gateway-http.client';
import type { ToolHandler } from '../tool-dispatcher';

const KNOWLEDGE_SEARCH_FAILED = 'Knowledge search failed.';
const KNOWLEDGE_DOCUMENT_NOT_FOUND = 'Knowledge document not found.';

export interface KnowledgeToolHandlerDeps {
  readonly client: ApiGatewayHttpClient;
  readonly userId: string;
  readonly scopes: readonly string[];
}

export interface ReadKnowledgeToolHandlerDeps extends KnowledgeToolHandlerDeps {
  readonly maxToolResultBytes: number;
}

interface KnowledgeReadFields {
  readonly documentId: string;
  readonly title: string;
  readonly scopeId: string;
  readonly heading: string | null;
  readonly content: string;
  readonly truncated: boolean;
}

/**
 * Exclusive end index of a UTF-8 prefix that fits in maxBytes.
 * A multibyte character that would be split is left out.
 */
function utf8PrefixEnd(buffer: Buffer, maxBytes: number): number {
  if (maxBytes <= 0) {
    return 0;
  }
  if (buffer.length <= maxBytes) {
    return buffer.length;
  }
  let end = maxBytes;
  if ((buffer[end] & 0xc0) === 0x80) {
    while (end > 0 && (buffer[end] & 0xc0) === 0x80) {
      end -= 1;
    }
  }
  return end;
}

function sliceUtf8(value: string, maxBytes: number): string {
  const buffer = Buffer.from(value, 'utf8');
  return buffer.subarray(0, utf8PrefixEnd(buffer, maxBytes)).toString('utf8');
}

function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function fitKnowledgeRead(
  fields: Omit<KnowledgeReadFields, 'truncated'> & { truncated: boolean },
  maxBytes: number,
): KnowledgeReadFields {
  let content = fields.content;
  let truncated = fields.truncated;
  const build = (): KnowledgeReadFields => ({
    documentId: fields.documentId,
    title: fields.title,
    scopeId: fields.scopeId,
    heading: fields.heading,
    content,
    truncated,
  });
  let payload = build();
  while (utf8ByteLength(JSON.stringify(payload)) > maxBytes) {
    if (content.length === 0) {
      break;
    }
    const previous = content;
    const over = utf8ByteLength(JSON.stringify(payload)) - maxBytes;
    const contentBytes = utf8ByteLength(content);
    const target = Math.max(0, contentBytes - Math.max(over, 1));
    truncated = true;
    content = sliceUtf8(content, target);
    if (content === previous) {
      content = sliceUtf8(content, contentBytes - 1);
    }
    if (content === previous) {
      content = '';
    }
    payload = build();
  }
  return payload;
}

/**
 * Searches the signed scopes. userId and scopes come from the job, not the tool args.
 */
export function createSearchKnowledgeHandler(
  deps: KnowledgeToolHandlerDeps,
): ToolHandler {
  return async (args: Readonly<Record<string, unknown>>, signal?: AbortSignal) => {
    if (typeof args.query !== 'string' || args.query.trim().length === 0) {
      throw new Error('query is required and must be a non-empty string');
    }
    try {
      const result = await deps.client.searchKnowledge(
        {
          userId: deps.userId,
          scopes: deps.scopes,
          query: args.query,
        },
        signal,
      );
      return {
        query: result.query,
        results: result.results.map((hit) => ({
          documentId: hit.documentId,
          title: hit.title,
          scopeId: hit.scopeId,
          heading: hit.heading,
          preview: hit.preview,
        })),
        truncated: result.truncated,
      };
    } catch {
      throw new Error(KNOWLEDGE_SEARCH_FAILED);
    }
  };
}

/**
 * Reads one owned document or heading section, then slices content to the tool byte cap.
 */
export function createReadKnowledgeHandler(
  deps: ReadKnowledgeToolHandlerDeps,
): ToolHandler {
  return async (args: Readonly<Record<string, unknown>>, signal?: AbortSignal) => {
    if (typeof args.documentId !== 'string' || args.documentId.trim().length === 0) {
      throw new Error('documentId is required and must be a non-empty string');
    }
    const heading = typeof args.heading === 'string' ? args.heading : undefined;
    try {
      const result = await deps.client.readKnowledge(
        {
          userId: deps.userId,
          scopes: deps.scopes,
          documentId: args.documentId,
          ...(heading !== undefined ? { heading } : {}),
        },
        signal,
      );
      const fitted = fitKnowledgeRead(
        {
          documentId: result.documentId,
          title: result.title,
          scopeId: result.scopeId,
          heading: result.heading,
          content: result.content,
          truncated: result.truncated === true,
        },
        deps.maxToolResultBytes,
      );
      return {
        documentId: fitted.documentId,
        title: fitted.title,
        scopeId: fitted.scopeId,
        heading: fitted.heading,
        content: fitted.content,
        truncated: fitted.truncated,
      };
    } catch {
      throw new Error(KNOWLEDGE_DOCUMENT_NOT_FOUND);
    }
  };
}
