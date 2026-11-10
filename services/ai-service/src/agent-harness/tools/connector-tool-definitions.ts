import { AGENT_HARNESS_CONTRACT_VERSION_V1 } from '../contracts/agent-harness.contracts';
import type { AgentHarnessToolRegistryDefinitionV1 } from './tool-registry.contracts';

/**
 * CONN-GRANT-01: connector tools a signed read-profile job may be granted.
 *
 * Descriptions and input schemas are the platform's own and match the
 * CONN-02B allowlist in services/api-gateway/src/connectors/connector-servers.ts
 * (connector-tool-definitions.spec.ts compares them). No secret field is
 * model-facing: the gateway adds the owner's credentials for each call.
 *
 * These definitions are not part of AGENT_HARNESS_TOOL_DEFINITIONS_V1. The
 * worker advertises one only after registering its handler for a granted job.
 */
export const CONNECTOR_MAIL_TOOL_ID = 'mail_list_unread_metadata' as const;
export const CONNECTOR_CALENDAR_TOOL_ID = 'calendar_list_today' as const;

export type ConnectorToolId =
  | typeof CONNECTOR_MAIL_TOOL_ID
  | typeof CONNECTOR_CALENDAR_TOOL_ID;

const CONNECTOR_TOOL_TIMEOUT_MS = 25_000;
const CONNECTOR_TOOL_MAX_INPUT_BYTES = 1_024;
const CONNECTOR_TOOL_MAX_OUTPUT_BYTES = 64 * 1024;

export const CONNECTOR_TOOL_DEFINITIONS_V1: readonly AgentHarnessToolRegistryDefinitionV1[] =
  Object.freeze([
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: CONNECTOR_MAIL_TOOL_ID,
      name: CONNECTOR_MAIL_TOOL_ID,
      displayName: 'Unread Mail',
      description:
        'List unread Inbox messages for the connected mailbox: message id, sender, recipient count, subject, date, and a short plain-text excerpt of the body (at most 800 characters). At most 25 messages. Does not mark messages read and does not change the mailbox.',
      category: 'connector',
      inputSchema: {
        schemaType: 'json-schema',
        schema: {
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
      },
      riskLevel: 'low',
      requiresApproval: false,
      enabled: true,
      timeoutMs: CONNECTOR_TOOL_TIMEOUT_MS,
      maxInputBytes: CONNECTOR_TOOL_MAX_INPUT_BYTES,
      maxOutputBytes: CONNECTOR_TOOL_MAX_OUTPUT_BYTES,
      allowedModes: ['execute', 'review'],
      allowedScopes: ['session'],
      auditEventTypes: ['tool-called', 'tool-completed'],
      tags: ['connector', 'read-only'],
      implementationStatus: 'implemented',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: CONNECTOR_CALENDAR_TOOL_ID,
      name: CONNECTOR_CALENDAR_TOOL_ID,
      displayName: "Today's Calendar",
      description:
        "List today's events on the connected calendar in an IANA time zone: title, start, end, organizer, attendee count, and response status. Does not change the calendar.",
      category: 'connector',
      inputSchema: {
        schemaType: 'json-schema',
        schema: {
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
      },
      riskLevel: 'low',
      requiresApproval: false,
      enabled: true,
      timeoutMs: CONNECTOR_TOOL_TIMEOUT_MS,
      maxInputBytes: CONNECTOR_TOOL_MAX_INPUT_BYTES,
      maxOutputBytes: CONNECTOR_TOOL_MAX_OUTPUT_BYTES,
      allowedModes: ['execute', 'review'],
      allowedScopes: ['session'],
      auditEventTypes: ['tool-called', 'tool-completed'],
      tags: ['connector', 'read-only'],
      implementationStatus: 'implemented',
    },
  ]);

export const CONNECTOR_TOOL_IDS: readonly ConnectorToolId[] = Object.freeze([
  CONNECTOR_MAIL_TOOL_ID,
  CONNECTOR_CALENDAR_TOOL_ID,
]);

const CONNECTOR_TOOL_ID_SET = new Set<string>(CONNECTOR_TOOL_IDS);

export function isConnectorToolId(value: unknown): value is ConnectorToolId {
  return typeof value === 'string' && CONNECTOR_TOOL_ID_SET.has(value);
}

export function getConnectorToolDefinition(
  toolId: ConnectorToolId,
): AgentHarnessToolRegistryDefinitionV1 {
  const definition = CONNECTOR_TOOL_DEFINITIONS_V1.find((entry) => entry.id === toolId);
  if (!definition) {
    throw new Error('Unknown connector tool');
  }
  return definition;
}

/** Only the schema's own properties are passed on. The gateway checks the values. */
export function pickConnectorToolArguments(
  toolId: ConnectorToolId,
  args: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const schema = getConnectorToolDefinition(toolId).inputSchema.schema as {
    properties?: Record<string, unknown>;
  };
  const picked: Record<string, unknown> = {};
  for (const key of Object.keys(schema.properties ?? {})) {
    if (Object.prototype.hasOwnProperty.call(args, key) && args[key] !== undefined) {
      picked[key] = args[key];
    }
  }
  return picked;
}
