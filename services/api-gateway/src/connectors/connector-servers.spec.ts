import {
  CALENDAR_TOOL,
  CALENDAR_TOOL_ID,
  CALENDAR_WINDOW_MAX_MS,
  CALENDAR_WINDOW_TOOL,
  CALENDAR_WINDOW_TOOL_ID,
  CONNECTOR_SERVERS,
  MAIL_RECENT_MAX_LOOKBACK_MS,
  MAIL_RECENT_MAX_MESSAGES,
  MAIL_RECENT_TOOL,
  MAIL_RECENT_TOOL_ID,
  MAIL_TOOL,
  MAIL_TOOL_ID,
  connectorToolCatalog,
  findAllowlistedTool,
  isInternalConnectorTool,
  toolForKind,
  verifyArguments,
} from './connector-servers';

/**
 * APPROVAL-SET-01 D6: every connector tool declares whether it is read-only.
 * APPROVAL-SET-01B lets a hand-off run without waiting only when every tool
 * its target may hold is read-only, so this pins each current tool's flag.
 * A new tool must be added here with its own flag (a tool that sends or
 * writes is false).
 */
describe('connector tool read-only flags (APPROVAL-SET-01 D6)', () => {
  const expectedFlags: Record<string, boolean> = {
    [MAIL_TOOL_ID]: true,
    [CALENDAR_TOOL_ID]: true,
  };

  it('pins the flag of every tool in the catalogue, and the catalogue is exactly these tools', () => {
    const catalog = connectorToolCatalog();
    expect(catalog.map((tool) => tool.id)).toEqual(Object.keys(expectedFlags));
    for (const tool of catalog) {
      expect(typeof tool.readOnly).toBe('boolean');
      expect(tool.readOnly).toBe(expectedFlags[tool.id]);
    }
  });

  it('every tool on every connector server carries the same pinned flag', () => {
    const served = CONNECTOR_SERVERS.flatMap((server) => [...server.tools]);
    expect(served.map((tool) => tool.id).sort()).toEqual(Object.keys(expectedFlags).sort());
    for (const tool of served) {
      expect(tool.readOnly).toBe(expectedFlags[tool.id]);
    }
  });

  it('the mail and calendar tools are read-only', () => {
    expect(MAIL_TOOL.readOnly).toBe(true);
    expect(CALENDAR_TOOL.readOnly).toBe(true);
    expect(findAllowlistedTool(MAIL_TOOL_ID)?.readOnly).toBe(true);
    expect(findAllowlistedTool(CALENDAR_TOOL_ID)?.readOnly).toBe(true);
    expect(toolForKind('imap').readOnly).toBe(true);
    expect(toolForKind('ical').readOnly).toBe(true);
  });

  it.each(['mail_send', 'calendar_accept', '', null, undefined, 7])(
    'an id outside the allowlist (%p) has no tool, so no flag',
    (id) => {
      expect(findAllowlistedTool(id)).toBeNull();
    },
  );
});

describe('the gateway-only calendar window tool (TRIGGER-EVENT-01 S1)', () => {
  it('is an internal read-only calendar tool', () => {
    expect(CALENDAR_WINDOW_TOOL_ID).toBe('calendar_list_window');
    expect(CALENDAR_WINDOW_TOOL).toEqual({ id: 'calendar_list_window', kind: 'ical', readOnly: true });
    expect(CALENDAR_WINDOW_MAX_MS).toBe(3 * 60 * 60 * 1000);
    expect(isInternalConnectorTool(CALENDAR_WINDOW_TOOL_ID)).toBe(true);
    for (const other of [MAIL_TOOL_ID, CALENDAR_TOOL_ID, 'calendar_list_window ', '', null, undefined]) {
      expect(isInternalConnectorTool(other)).toBe(false);
    }
  });

  it('is absent from the catalogue, the allowlist lookup and every connector server', () => {
    expect(connectorToolCatalog().map((tool) => tool.id)).toEqual([MAIL_TOOL_ID, CALENDAR_TOOL_ID]);
    expect(JSON.stringify(connectorToolCatalog()).includes(CALENDAR_WINDOW_TOOL_ID)).toBe(false);
    expect(findAllowlistedTool(CALENDAR_WINDOW_TOOL_ID)).toBeNull();
    expect(findAllowlistedTool(CALENDAR_WINDOW_TOOL)).toBeNull();
    const served = CONNECTOR_SERVERS.flatMap((server) => [...server.tools]);
    expect(served.some((tool) => (tool.id as string) === CALENDAR_WINDOW_TOOL_ID)).toBe(false);
  });

  it('leaves calendar_list_today, its description and its schema byte for byte unchanged', () => {
    expect(JSON.stringify(CALENDAR_TOOL)).toBe(
      '{"id":"calendar_list_today","kind":"ical","readOnly":true,"description":"List today\'s events on the connected calendar in an IANA time zone: title, start, end, organizer, attendee count, and response status. Does not change the calendar.","inputSchema":{"type":"object","additionalProperties":false,"properties":{"timeZone":{"type":"string","minLength":1,"description":"IANA time zone used to decide which events are today."}},"required":["timeZone"]}}',
    );
    expect(toolForKind('ical')).toBe(CALENDAR_TOOL);
    expect(findAllowlistedTool(CALENDAR_TOOL_ID)).toBe(CALENDAR_TOOL);
  });
});

describe('the gateway-only recent-mail tool (TRIGGER-MAIL-01 S1)', () => {
  it('is an internal read-only mail tool', () => {
    expect(MAIL_RECENT_TOOL_ID).toBe('mail_list_recent');
    expect(MAIL_RECENT_TOOL).toEqual({ id: 'mail_list_recent', kind: 'imap', readOnly: true });
    expect(MAIL_RECENT_MAX_LOOKBACK_MS).toBe(2 * 60 * 60 * 1000);
    expect(MAIL_RECENT_MAX_MESSAGES).toBe(25);
    expect(isInternalConnectorTool(MAIL_RECENT_TOOL_ID)).toBe(true);
    expect(isInternalConnectorTool(CALENDAR_WINDOW_TOOL_ID)).toBe(true);
    for (const other of [MAIL_TOOL_ID, CALENDAR_TOOL_ID, 'mail_list_recent ', 'MAIL_LIST_RECENT', '', null, undefined, MAIL_RECENT_TOOL]) {
      expect(isInternalConnectorTool(other)).toBe(false);
    }
  });

  it('is absent from the catalogue, the allowlist lookup and every connector server', () => {
    expect(connectorToolCatalog().map((tool) => tool.id)).toEqual([MAIL_TOOL_ID, CALENDAR_TOOL_ID]);
    expect(JSON.stringify(connectorToolCatalog()).includes(MAIL_RECENT_TOOL_ID)).toBe(false);
    expect(findAllowlistedTool(MAIL_RECENT_TOOL_ID)).toBeNull();
    expect(findAllowlistedTool(MAIL_RECENT_TOOL)).toBeNull();
    const served = CONNECTOR_SERVERS.flatMap((server) => [...server.tools]);
    expect(served.some((tool) => (tool.id as string) === MAIL_RECENT_TOOL_ID)).toBe(false);
    expect(toolForKind('imap')).toBe(MAIL_TOOL);
  });

  it('leaves mail_list_unread_metadata, its description and its schema byte for byte unchanged', () => {
    expect(JSON.stringify(MAIL_TOOL)).toBe(
      '{"id":"mail_list_unread_metadata","kind":"imap","readOnly":true,"description":"List unread Inbox messages for the connected mailbox: message id, sender, recipient count, subject, date, and a short plain-text excerpt of the body (at most 800 characters). At most 25 messages. Does not mark messages read and does not change the mailbox.","inputSchema":{"type":"object","additionalProperties":false,"properties":{"limit":{"type":"integer","minimum":1,"maximum":25,"description":"Maximum unread messages to return. Defaults to 25."}}}}',
    );
    expect(findAllowlistedTool(MAIL_TOOL_ID)).toBe(MAIL_TOOL);
    expect(verifyArguments('imap')).toEqual({ limit: 1 });
  });
});
