import {
  CALENDAR_TOOL,
  CALENDAR_TOOL_ID,
  CONNECTOR_SERVERS,
  MAIL_TOOL,
  MAIL_TOOL_ID,
  connectorToolCatalog,
  findAllowlistedTool,
  toolForKind,
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
