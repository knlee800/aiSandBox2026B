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
