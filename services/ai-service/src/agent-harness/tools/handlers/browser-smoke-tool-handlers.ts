import type { ToolHandler } from '../tool-dispatcher';
import type { ApiGatewayHttpClient } from '../../../clients/api-gateway-http.client';

export interface BrowserSmokeToolHandlerDeps {
  readonly client: ApiGatewayHttpClient;
  readonly sessionId: string;
  readonly browserSmokeTimeoutMs: number;
}

/**
 * Creates a browser_smoke tool handler.
 * Runs browser smoke check through API Gateway → container-manager boundary.
 * Non-mutating: does not trigger pre-apply checkpoint.
 */
export function createBrowserSmokeHandler(
  deps: BrowserSmokeToolHandlerDeps,
): ToolHandler {
  return async (args: Readonly<Record<string, unknown>>) => {
    const rawUrl = args.url;
    let url = '/';

    if (rawUrl !== undefined && rawUrl !== null && rawUrl !== '') {
      if (typeof rawUrl !== 'string') {
        throw new Error('url must be a string');
      }

      const trimmed = rawUrl.trim();

      if (trimmed.includes('://')) {
        throw new Error(
          'Absolute URLs are not allowed; provide a relative path starting with /',
        );
      }

      if (!trimmed.startsWith('/')) {
        throw new Error('URL must be a relative path starting with /');
      }

      url = trimmed;
    }

    const result = await deps.client.runBrowserSmoke(
      deps.sessionId,
      url,
      deps.browserSmokeTimeoutMs,
    );

    return result as unknown as Readonly<Record<string, unknown>>;
  };
}
