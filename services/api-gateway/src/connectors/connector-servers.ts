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
/** CONN-MAIL-READ-01: a companion of MAIL_TOOL_ID (see CONNECTOR_COMPANION_TOOLS). */
export const MAIL_READ_TOOL_ID = 'mail_read_message';
/**
 * CONN-MAIL-READ-01: the child's exact answer for a message id that is not in the
 * Inbox (services/connectors-mcp/src/limits.ts). It carries no mail content; the
 * broker turns that one answer into a 404 with this same fixed text.
 */
export const MAIL_MESSAGE_NOT_FOUND_MESSAGE = 'No Inbox message has that id.';

export interface ConnectorToolDefinition {
  id: typeof MAIL_TOOL_ID | typeof CALENDAR_TOOL_ID | typeof MAIL_READ_TOOL_ID;
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
 * CONN-MAIL-READ-01: one Inbox message by its id, read or unread. A companion tool:
 * it is not in connectorToolCatalog(), not found by findAllowlistedTool() and not on
 * CONNECTOR_SERVERS, so no workflow or system agent can hold it and the picker never
 * shows it. The per-job grant adds it to a job granted MAIL_TOOL_ID
 * (withCompanionToolIds), and only a grant token that lists it lets a call through.
 */
export const MAIL_READ_TOOL: ConnectorToolDefinition = {
  id: MAIL_READ_TOOL_ID,
  kind: 'imap',
  readOnly: true,
  description:
    'Read one Inbox message of the connected mailbox by its message id, the id mail_list_unread_metadata returns or a mail trigger gives, whether the message is read or unread: message id, sender, recipient count, subject, date, and a short plain-text excerpt of the body (at most 800 characters). Does not mark the message read and does not change the mailbox.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      messageId: {
        type: 'string',
        minLength: 1,
        maxLength: 10,
        description: 'The id of the message, as mail_list_unread_metadata returns it or the mail trigger gives it, for example 4601.',
      },
    },
    required: ['messageId'],
  },
};

/**
 * CONN-MAIL-READ-01: the tools a granted tool brings with it. A companion is never
 * granted, saved or offered on its own: it reaches a job only through
 * withCompanionToolIds, when the job's grant holds the tool that brings it.
 */
const CONNECTOR_COMPANION_TOOLS: ReadonlyMap<string, readonly ConnectorToolDefinition[]> = new Map([
  [MAIL_TOOL_ID, Object.freeze([MAIL_READ_TOOL])],
]);

/** CONN-MAIL-READ-01: the companion tool with this id, or null. */
export function findCompanionTool(toolId: unknown): ConnectorToolDefinition | null {
  if (typeof toolId !== 'string') return null;
  for (const companions of CONNECTOR_COMPANION_TOOLS.values()) {
    const found = companions.find((tool) => tool.id === toolId);
    if (found) return found;
  }
  return null;
}

/** CONN-MAIL-READ-01: the allowlisted tool that brings this companion, or null. */
export function companionParentToolId(toolId: unknown): string | null {
  if (typeof toolId !== 'string') return null;
  for (const [parent, companions] of CONNECTOR_COMPANION_TOOLS) {
    if (companions.some((tool) => tool.id === toolId)) return parent;
  }
  return null;
}

/**
 * CONN-MAIL-READ-01: a tool a per-job grant may list: an allowlisted tool or a
 * companion. Only the grant token, the broker and the grant resolver use it; saved
 * workflows, system agents and the catalogue use findAllowlistedTool.
 */
export function findGrantableTool(toolId: unknown): ConnectorToolDefinition | null {
  return findAllowlistedTool(toolId) ?? findCompanionTool(toolId);
}

/**
 * CONN-MAIL-READ-01: the allowlisted ids in `toolIds` plus the companions they
 * bring, de-duplicated and sorted. Any other id, a companion included, is dropped.
 */
export function withCompanionToolIds(toolIds: readonly unknown[]): string[] {
  const out = new Set<string>();
  for (const id of toolIds) {
    const tool = findAllowlistedTool(id);
    if (!tool) continue;
    out.add(tool.id);
    for (const companion of CONNECTOR_COMPANION_TOOLS.get(tool.id) ?? []) {
      out.add(companion.id);
    }
  }
  return [...out].sort();
}

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
  MAIL_MESSAGE_NOT_FOUND_MESSAGE,
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
