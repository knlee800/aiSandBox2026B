import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import {
  CONNECTOR_TOOL_DEFINITIONS_V1,
  CONNECTOR_TOOL_IDS,
  getConnectorToolDefinition,
  isConnectorToolId,
  pickConnectorToolArguments,
} from './connector-tool-definitions';
import { AGENT_HARNESS_TOOL_DEFINITIONS_V1 } from './tool-registry';

function gatewayConnectorServersPath(): string {
  let dir = __dirname;
  for (let hop = 0; hop < 8; hop += 1) {
    const candidates = [
      join(dir, 'services', 'api-gateway', 'src', 'connectors', 'connector-servers.ts'),
      join(dir, 'api-gateway', 'src', 'connectors', 'connector-servers.ts'),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not read services/api-gateway/src/connectors/connector-servers.ts');
}

function gatewayToolBlock(source: string, constName: string): string {
  const match = source.match(new RegExp(`export const ${constName}: ConnectorToolDefinition = \\{[\\s\\S]*?\\n\\};`));
  if (!match) throw new Error(`${constName} was not found in connector-servers.ts`);
  return match[0];
}

/** Collapses whitespace and trailing commas so a multi-line TS literal compares with a JSON value. */
function squash(text: string): string {
  return text.replace(/\s+/g, '').replace(/,([}\]])/g, '$1');
}

function asTsLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, '$1:');
}

describe('CONN-GRANT-01 connector tool definitions', () => {
  const gateway = readFileSync(gatewayConnectorServersPath(), 'utf8');

  it('match the CONN-02B allowlist ids, descriptions and input schemas', () => {
    const pairs: Array<[string, string]> = [
      ['MAIL_TOOL', 'mail_list_unread_metadata'],
      // CONN-MAIL-READ-01: the gateway's companion tool, after the unread tool.
      ['MAIL_READ_TOOL', 'mail_read_message'],
      ['CALENDAR_TOOL', 'calendar_list_today'],
    ];
    expect([...CONNECTOR_TOOL_IDS]).toEqual(pairs.map(([, id]) => id));
    for (const [constName, id] of pairs) {
      const block = gatewayToolBlock(gateway, constName);
      expect(gateway).toContain(`_TOOL_ID = '${id}'`);
      const definition = getConnectorToolDefinition(id as never);
      expect(definition.id).toBe(id);
      expect(definition.name).toBe(id);
      expect(block.includes(definition.description)).toBe(true);
      const schema = definition.inputSchema.schema as Record<string, unknown>;
      const gatewaySchema = block.slice(block.indexOf('inputSchema:'));
      for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
        expect(squash(gatewaySchema)).toContain(squash(`${key}: ${asTsLiteral(value).replace(/"/g, "'")}`));
      }
      expect(squash(gatewaySchema)).toContain('additionalProperties:false');
      if (schema.required) {
        expect(squash(gatewaySchema)).toContain(
          squash(`required: [${(schema.required as string[]).map((r) => `'${r}'`).join(', ')}]`),
        );
      } else {
        expect(gatewaySchema.includes('required:')).toBe(false);
      }
    }
  });

  it('have no secret fields in the model-facing schemas', () => {
    const text = JSON.stringify(CONNECTOR_TOOL_DEFINITIONS_V1).toLowerCase();
    for (const secret of ['password', 'apppassword', 'username', 'preset', 'url', 'secret', 'token', 'credential']) {
      expect(text.includes(`"${secret}"`)).toBe(false);
    }
    for (const definition of CONNECTOR_TOOL_DEFINITIONS_V1) {
      expect(definition.requiresApproval).toBe(false);
      expect(definition.tags).toContain('read-only');
      expect(definition.category).toBe('connector');
    }
  });

  it('are not part of the general harness registry', () => {
    const generalIds = AGENT_HARNESS_TOOL_DEFINITIONS_V1.map((definition) => definition.id as string);
    for (const id of CONNECTOR_TOOL_IDS) {
      expect(generalIds).not.toContain(id);
    }
  });

  it('pass only the schema arguments on', () => {
    expect(isConnectorToolId('mail_list_unread_metadata')).toBe(true);
    expect(isConnectorToolId('read_file')).toBe(false);
    expect(
      pickConnectorToolArguments('mail_list_unread_metadata', {
        limit: 3,
        userId: 'attacker',
        grantToken: 'forged',
        appPassword: 'x',
      }),
    ).toEqual({ limit: 3 });
    expect(
      pickConnectorToolArguments('calendar_list_today', { timeZone: 'Asia/Taipei', url: 'https://evil' }),
    ).toEqual({ timeZone: 'Asia/Taipei' });
    expect(
      pickConnectorToolArguments('mail_read_message', {
        messageId: '4601',
        limit: 3,
        username: 'evil@example.com',
        appPassword: 'x',
        preset: 'yahoo',
      }),
    ).toEqual({ messageId: '4601' });
  });

  it('CONN-MAIL-READ-01: mail_read_message is a read-only connector definition with the same limits as the others', () => {
    expect(isConnectorToolId('mail_read_message')).toBe(true);
    expect([...CONNECTOR_TOOL_IDS]).toEqual(['mail_list_unread_metadata', 'mail_read_message', 'calendar_list_today']);
    const read = getConnectorToolDefinition('mail_read_message');
    const unread = getConnectorToolDefinition('mail_list_unread_metadata');
    expect(read.displayName).toBe('Read one mail message');
    expect(read.category).toBe('connector');
    expect(read.tags).toEqual(['connector', 'read-only']);
    expect(read.riskLevel).toBe('low');
    expect(read.requiresApproval).toBe(false);
    for (const key of ['timeoutMs', 'maxInputBytes', 'maxOutputBytes', 'allowedModes', 'allowedScopes', 'auditEventTypes', 'enabled', 'implementationStatus'] as const) {
      expect(read[key]).toEqual(unread[key]);
    }
    const schema = read.inputSchema.schema as { properties: Record<string, unknown>; required: string[] };
    expect(Object.keys(schema.properties)).toEqual(['messageId']);
    expect(schema.required).toEqual(['messageId']);
    expect(read.description).toContain('whether the message is read or unread');
    expect(read.description).toContain('Does not mark the message read');
  });
});
