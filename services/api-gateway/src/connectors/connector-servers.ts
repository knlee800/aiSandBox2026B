import { ConnectorKind } from './connector-rules';

export const CONNECTOR_SERVER_ID = 'connectors-mcp';
export const CONNECTOR_MCP_COMMAND = 'node';
export const CONNECTOR_MCP_ENTRY = '/opt/aisandbox/services/connectors-mcp/dist/main.js';

export const CONNECTOR_MAX_IN_FLIGHT = 4;
export const CONNECTOR_CALL_TIMEOUT_MS = 25_000;
export const CONNECTOR_IDLE_MS = 5 * 60 * 1000;
export const CONNECTOR_MAX_RESULT_BYTES = 64 * 1024;

export const CONNECTOR_TOOL_MESSAGE = 'Unknown connector tool.';
export const CONNECTOR_TOOL_MISSING_MESSAGE = 'The connector tool is unavailable.';
export const CONNECTOR_SERVER_MESSAGE = 'Unknown connector server.';
export const CONNECTOR_ARGUMENTS_MESSAGE = 'Connector arguments are invalid.';
export const CONNECTOR_BUSY_MESSAGE = 'The connector service is busy.';
export const CONNECTOR_UNAVAILABLE_MESSAGE = 'The connector service is unavailable.';
export const CONNECTOR_TIMEOUT_MESSAGE = 'The connector service timed out.';
export const CONNECTOR_RESULT_MESSAGE = 'The connector result could not be read.';
export const MAIL_VERIFY_FAILED_MESSAGE = 'could not reach the mail server';
export const CALENDAR_VERIFY_FAILED_MESSAGE = 'the calendar link could not be read';

export const MAIL_TOOL_ID = 'mail_list_unread_metadata';
export const CALENDAR_TOOL_ID = 'calendar_list_today';

export interface ConnectorToolDefinition {
  id: typeof MAIL_TOOL_ID | typeof CALENDAR_TOOL_ID;
  kind: ConnectorKind;
  description: string;
  inputSchema: {
    type: 'object';
    additionalProperties: false;
    properties: Record<string, object>;
    required?: readonly string[];
  };
}

export const MAIL_TOOL: ConnectorToolDefinition = {
  id: MAIL_TOOL_ID,
  kind: 'imap',
  description:
    'List unread Inbox messages for the connected mailbox: message id, sender, recipient count, subject, date, and a short plain-text excerpt of the body (at most 800 characters). At most 25 messages. Does not mark messages read and does not change the mailbox.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 25,
        description: 'Maximum unread messages to return. Defaults to 25.',
      },
    },
  },
};

export const CALENDAR_TOOL: ConnectorToolDefinition = {
  id: CALENDAR_TOOL_ID,
  kind: 'ical',
  description:
    "List today's events on the connected calendar in an IANA time zone: title, start, end, organizer, attendee count, and response status. Does not change the calendar.",
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      timeZone: {
        type: 'string',
        minLength: 1,
        description: 'IANA time zone used to decide which events are today.',
      },
    },
    required: ['timeZone'],
  },
};

export const CONNECTOR_SERVERS = [
  {
    id: CONNECTOR_SERVER_ID,
    command: CONNECTOR_MCP_COMMAND,
    args: [CONNECTOR_MCP_ENTRY],
    tools: [MAIL_TOOL, CALENDAR_TOOL],
  },
] as const;

const FIXED_MESSAGES = new Set<string>([
  CONNECTOR_TOOL_MESSAGE,
  CONNECTOR_TOOL_MISSING_MESSAGE,
  CONNECTOR_SERVER_MESSAGE,
  CONNECTOR_ARGUMENTS_MESSAGE,
  CONNECTOR_BUSY_MESSAGE,
  CONNECTOR_UNAVAILABLE_MESSAGE,
  CONNECTOR_TIMEOUT_MESSAGE,
  CONNECTOR_RESULT_MESSAGE,
]);

export function connectorToolCatalog(): ConnectorToolDefinition[] {
  return [MAIL_TOOL, CALENDAR_TOOL];
}

export function findAllowlistedTool(toolId: unknown): ConnectorToolDefinition | null {
  if (toolId === MAIL_TOOL.id) return MAIL_TOOL;
  if (toolId === CALENDAR_TOOL.id) return CALENDAR_TOOL;
  return null;
}

export function toolForKind(kind: ConnectorKind): ConnectorToolDefinition {
  return kind === 'imap' ? MAIL_TOOL : CALENDAR_TOOL;
}

export function verifyArguments(kind: ConnectorKind): Record<string, unknown> {
  return kind === 'imap' ? { limit: 1 } : { timeZone: 'UTC' };
}

export function isFixedConnectorFailure(message: string): boolean {
  return FIXED_MESSAGES.has(message);
}

export function scrubSecrets(text: string, secrets: readonly string[]): string {
  const unique = [...new Set(secrets.filter((secret) => secret.length > 0))].sort(
    (left, right) => right.length - left.length,
  );
  let out = text;
  for (const secret of unique) {
    if (!out.includes(secret)) continue;
    out = out.split(secret).join('[redacted]');
  }
  return out;
}
