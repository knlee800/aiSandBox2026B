import type { ToolHandler } from '../tool-dispatcher';
import type { ApiGatewayHttpClient } from '../../../clients/api-gateway-http.client';

const PATH_TRAVERSAL_PATTERN = /(^|[\\/])\.\.($|[\\/])/;

/**
 * Validates and normalizes a workspace-relative file path.
 * Rejects path traversal, empty paths, and absolute paths.
 * Returns a normalized relative path string.
 */
export function validateAndNormalizePath(rawPath: unknown): string {
  if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
    throw new Error('path is required and must be a non-empty string');
  }

  const trimmed = rawPath.trim();

  if (PATH_TRAVERSAL_PATTERN.test(trimmed)) {
    throw new Error('path contains unsafe traversal pattern (..)');
  }

  const normalized = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;

  if (normalized.length === 0) {
    return '/';
  }

  return normalized;
}

export interface FileToolHandlerDeps {
  readonly client: ApiGatewayHttpClient;
  readonly sessionId: string;
  readonly maxFileReadBytes: number;
}

/**
 * Creates a read_file tool handler.
 * Reads file content from workspace through API Gateway boundary.
 * Truncates content exceeding maxFileReadBytes.
 */
export function createReadFileHandler(deps: FileToolHandlerDeps): ToolHandler {
  return async (args: Readonly<Record<string, unknown>>) => {
    const normalizedPath = validateAndNormalizePath(args.path);

    const result = await deps.client.readWorkspaceFile(
      deps.sessionId,
      normalizedPath,
    );

    let content = result.content;
    let truncated = false;

    if (Buffer.byteLength(content, 'utf-8') > deps.maxFileReadBytes) {
      const buf = Buffer.from(content, 'utf-8');
      content = buf.slice(0, deps.maxFileReadBytes).toString('utf-8');
      content += `\n[...truncated at ${deps.maxFileReadBytes} bytes]`;
      truncated = true;
    }

    return { content, truncated };
  };
}

export interface ListToolHandlerDeps {
  readonly client: ApiGatewayHttpClient;
  readonly sessionId: string;
}

/**
 * Creates a list_files tool handler.
 * Lists directory entries from workspace through API Gateway boundary.
 */
export function createListFilesHandler(deps: ListToolHandlerDeps): ToolHandler {
  return async (args: Readonly<Record<string, unknown>>) => {
    const rawPath = args.path;
    const normalizedPath =
      rawPath === undefined || rawPath === null || rawPath === ''
        ? '/'
        : validateAndNormalizePath(rawPath);

    const result = await deps.client.listWorkspaceDirectory(
      deps.sessionId,
      normalizedPath,
    );

    const files: string[] = result.entries.map((entry) => {
      const suffix = entry.type === 'dir' ? '/' : '';
      return `${entry.name}${suffix}`;
    });

    return { files };
  };
}

export interface WriteToolHandlerDeps {
  readonly client: ApiGatewayHttpClient;
  readonly sessionId: string;
  readonly maxFileWriteBytes: number;
}

/**
 * Creates a write_file tool handler.
 * Writes file content to workspace through API Gateway boundary.
 * Rejects content exceeding maxFileWriteBytes before the HTTP call.
 */
export function createWriteFileHandler(deps: WriteToolHandlerDeps): ToolHandler {
  return async (args: Readonly<Record<string, unknown>>) => {
    const normalizedPath = validateAndNormalizePath(args.path);

    if (typeof args.content !== 'string') {
      throw new Error('content is required and must be a string');
    }

    const contentBytes = Buffer.byteLength(args.content, 'utf-8');
    if (contentBytes > deps.maxFileWriteBytes) {
      throw new Error(
        `content exceeds maximum write size (${contentBytes} bytes > ${deps.maxFileWriteBytes} bytes)`,
      );
    }

    await deps.client.writeWorkspaceFile(
      deps.sessionId,
      normalizedPath,
      args.content,
    );

    return { ok: true, path: normalizedPath, bytesWritten: contentBytes };
  };
}

export interface DeleteToolHandlerDeps {
  readonly client: ApiGatewayHttpClient;
  readonly sessionId: string;
}

const UNSAFE_DELETE_TARGETS = new Set(['', '.', '/']);
const GLOB_LIKE_PATTERN = /[*?]/;

/**
 * Creates a delete_file tool handler.
 * Deletes a single file from workspace through API Gateway boundary.
 * Rejects root, broad, directory, and glob-like targets.
 */
export function createDeleteFileHandler(deps: DeleteToolHandlerDeps): ToolHandler {
  return async (args: Readonly<Record<string, unknown>>) => {
    const normalizedPath = validateAndNormalizePath(args.path);

    if (UNSAFE_DELETE_TARGETS.has(normalizedPath)) {
      throw new Error('delete target is unsafe: root or workspace-root path');
    }

    if (normalizedPath.endsWith('/')) {
      throw new Error('delete target must be a file, not a directory');
    }

    if (GLOB_LIKE_PATTERN.test(normalizedPath)) {
      throw new Error('delete target must not contain glob patterns');
    }

    await deps.client.deleteWorkspaceFile(deps.sessionId, normalizedPath);

    return { ok: true, path: normalizedPath };
  };
}
