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
  /**
   * APPROVAL-SET-01 D6: true only for a tool that cannot send, write or
   * delete. APPROVAL-SET-01B lets a hand-off run without waiting only when
   * every connector tool its target may hold carries true; a tool that sends
   * or writes is registered with false. A constant: nothing reads it at run
   * time in slice 01A.
   */
  readonly readOnly: boolean;
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
  readOnly: true,
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
  readOnly: true,
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

/**
 * TRIGGER-EVENT-01 S1: the gateway-only calendar window read. Only the gateway's
 * event-trigger timer calls it, through ConnectorBroker.readCalendarWindow. It is
 * deliberately not a ConnectorToolDefinition: it is not in connectorToolCatalog(),
 * not found by findAllowlistedTool() and not on CONNECTOR_SERVERS, so no workflow
 * can tick it, no grant token can name it, POST /api/internal/connectors/call
 * refuses it and no model ever sees it.
 */
export const CALENDAR_WINDOW_TOOL_ID = 'calendar_list_window';
/** A window read covers at most 3 hours (the child refuses a longer one too). */
export const CALENDAR_WINDOW_MAX_MS = 3 * 60 * 60 * 1000;

/**
 * TRIGGER-MAIL-01 S1: the gateway-only recent-mail read. Only the gateway's mail
 * triggers call it, through ConnectorBroker.readRecentMail. Like the calendar window
 * read it is not a ConnectorToolDefinition: it is not in connectorToolCatalog(), not
 * found by findAllowlistedTool() and not on CONNECTOR_SERVERS, so no workflow can
 * tick it, no grant token can name it, POST /api/internal/connectors/call refuses it
 * and no model ever sees it.
 */
export const MAIL_RECENT_TOOL_ID = 'mail_list_recent';
/** `since` may be at most 2 hours before the read (the child refuses an older one too). */
export const MAIL_RECENT_MAX_LOOKBACK_MS = 2 * 60 * 60 * 1000;
/** The child returns at most this many messages; a longer list is refused as not ours. */
export const MAIL_RECENT_MAX_MESSAGES = 25;

export interface InternalConnectorToolDefinition {
  readonly id: typeof CALENDAR_WINDOW_TOOL_ID | typeof MAIL_RECENT_TOOL_ID;
  readonly kind: ConnectorKind;
  readonly readOnly: true;
}

export const CALENDAR_WINDOW_TOOL: InternalConnectorToolDefinition = {
  id: CALENDAR_WINDOW_TOOL_ID,
  kind: 'ical',
  readOnly: true,
};

export const MAIL_RECENT_TOOL: InternalConnectorToolDefinition = {
  id: MAIL_RECENT_TOOL_ID,
  kind: 'imap',
  readOnly: true,
};

/** True only for a tool the gateway calls itself and never offers. */
export function isInternalConnectorTool(toolId: unknown): boolean {
  return toolId === CALENDAR_WINDOW_TOOL_ID || toolId === MAIL_RECENT_TOOL_ID;
}

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
