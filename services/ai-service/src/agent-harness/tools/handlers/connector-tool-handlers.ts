import type { ApiGatewayHttpClient } from '../../../clients/api-gateway-http.client';
import type { ToolHandler } from '../tool-dispatcher';
import {
  CONNECTOR_MAIL_READ_TOOL_ID,
  type ConnectorToolId,
  pickConnectorToolArguments,
} from '../connector-tool-definitions';

export const CONNECTOR_CALL_FAILED_MESSAGE = 'The connector call failed.';
export const CONNECTOR_CALL_NOT_GRANTED_MESSAGE = 'The connector call is not granted.';
/**
 * CONN-MAIL-READ-01: the gateway's fixed 404 text for a mail_read_message id
 * that is not in the Inbox. It carries no mail content; the model sees it as is.
 */
export const CONNECTOR_MAIL_MESSAGE_NOT_FOUND_MESSAGE = 'No Inbox message has that id.';

export interface ConnectorToolHandlerDeps {
  readonly client: Pick<ApiGatewayHttpClient, 'callConnectorTool'>;
  readonly toolId: ConnectorToolId;
  readonly userId: string;
  readonly executionId: string;
  readonly grantToken: string;
}

/**
 * Wraps a connector result for the model as data. <, > and & inside the JSON
 * are written as JSON unicode escapes, so text in a mail subject or event
 * title cannot close the tag or open a new one.
 */
export function wrapConnectorResult(toolId: ConnectorToolId, result: unknown): string {
  let json: string | undefined;
  try {
    json = JSON.stringify(result ?? null);
  } catch {
    json = undefined;
  }
  const safe = (json ?? 'null')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<connector_result tool="${toolId}">${safe}</connector_result>`;
}

/**
 * One granted connector tool. userId, executionId and the grant token come
 * from the signed job, never from the tool arguments; only the schema's own
 * arguments are passed on. Errors use fixed messages.
 */
export function createConnectorToolHandler(deps: ConnectorToolHandlerDeps): ToolHandler {
  return async (args: Readonly<Record<string, unknown>>, signal?: AbortSignal) => {
    let result: unknown;
    try {
      result = await deps.client.callConnectorTool(
        {
          userId: deps.userId,
          toolId: deps.toolId,
          arguments: pickConnectorToolArguments(deps.toolId, args ?? {}),
          executionId: deps.executionId,
          grantToken: deps.grantToken,
        },
        signal,
      );
    } catch (error) {
      const status = responseStatus(error);
      if (status === 403) {
        throw new Error(CONNECTOR_CALL_NOT_GRANTED_MESSAGE);
      }
      // CONN-MAIL-READ-01: only the gateway's exact not-found text is passed on.
      if (
        deps.toolId === CONNECTOR_MAIL_READ_TOOL_ID &&
        status === 404 &&
        responseMessage(error) === CONNECTOR_MAIL_MESSAGE_NOT_FOUND_MESSAGE
      ) {
        throw new Error(CONNECTOR_MAIL_MESSAGE_NOT_FOUND_MESSAGE);
      }
      throw new Error(CONNECTOR_CALL_FAILED_MESSAGE);
    }
    return {
      tool: deps.toolId,
      connectorResult: wrapConnectorResult(deps.toolId, result),
    };
  };
}

function responseStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const response = (error as { response?: unknown }).response;
  if (!response || typeof response !== 'object') return undefined;
  const status = (response as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

/** The `message` of the gateway's JSON error body, when it is a string. */
function responseMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const response = (error as { response?: unknown }).response;
  if (!response || typeof response !== 'object') return undefined;
  const data = (response as { data?: unknown }).data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const message = (data as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}
