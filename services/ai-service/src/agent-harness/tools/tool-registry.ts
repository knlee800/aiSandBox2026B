import { DEFAULT_AGENT_HARNESS_CONFIG_V1 } from '../config/agent-harness.config';
import { AGENT_HARNESS_CONTRACT_VERSION_V1 } from '../contracts/agent-harness.contracts';
import type {
  AgentHarnessToolDefinitionMapV1,
  AgentHarnessToolRegistryDefinitionV1,
} from './tool-registry.contracts';

const DEFAULT_TOOL_TIMEOUT_MS = DEFAULT_AGENT_HARNESS_CONFIG_V1.toolTimeoutMs;
const DEFAULT_MAX_INPUT_BYTES = DEFAULT_AGENT_HARNESS_CONFIG_V1.maxFileWriteBytes;
const DEFAULT_MAX_OUTPUT_BYTES = DEFAULT_AGENT_HARNESS_CONFIG_V1.maxToolResultBytes;

/**
 * Centralized Agent Harness tool registry metadata (v1).
 *
 * This registry is intentionally data-only for contract/planning purposes:
 * - no runtime execution
 * - no dispatcher wiring
 * - no WorkerProcessor or AIExecutionService integration
 */
export const AGENT_HARNESS_TOOL_DEFINITIONS_V1: readonly AgentHarnessToolRegistryDefinitionV1[] =
  Object.freeze([
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'list_files',
      name: 'list_files',
      displayName: 'List Files',
      description: 'List workspace files for planning and scoped edits.',
      category: 'workspace',
      inputSchema: {
        schemaType: 'json-schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            path: { type: 'string' },
            recursive: { type: 'boolean' },
          },
        },
      },
      outputSchema: {
        schemaType: 'json-schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            files: { type: 'array', items: { type: 'string' } },
          },
          required: ['files'],
        },
      },
      riskLevel: 'low',
      requiresApproval: false,
      enabled: true,
      timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
      maxInputBytes: DEFAULT_MAX_INPUT_BYTES,
      maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
      allowedModes: ['execute'],
      allowedScopes: ['workspace', 'repository'],
      auditEventTypes: ['tool-called', 'tool-completed'],
      tags: ['workspace', 'read-only'],
      implementationStatus: 'implemented',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'read_file',
      name: 'read_file',
      displayName: 'Read File',
      description: 'Read file content from the workspace.',
      category: 'workspace',
      inputSchema: {
        schemaType: 'json-schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['path'],
          properties: {
            path: { type: 'string' },
            offset: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
      outputSchema: {
        schemaType: 'json-schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            content: { type: 'string' },
          },
          required: ['content'],
        },
      },
      riskLevel: 'low',
      requiresApproval: false,
      enabled: true,
      timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
      maxInputBytes: DEFAULT_MAX_INPUT_BYTES,
      maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
      allowedModes: ['execute'],
      allowedScopes: ['workspace', 'repository'],
      auditEventTypes: ['tool-called', 'tool-completed'],
      tags: ['workspace', 'read-only'],
      implementationStatus: 'implemented',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'write_file',
      name: 'write_file',
      displayName: 'Write File',
      description: 'Write content to an existing or new workspace file.',
      category: 'workspace',
      inputSchema: {
        schemaType: 'json-schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['path', 'content'],
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
          },
        },
      },
      outputSchema: {
        schemaType: 'json-schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok'],
          properties: {
            ok: { type: 'boolean' },
          },
        },
      },
      riskLevel: 'high',
      requiresApproval: true,
      enabled: true,
      timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
      maxInputBytes: DEFAULT_AGENT_HARNESS_CONFIG_V1.maxFileWriteBytes,
      maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
      allowedModes: ['execute'],
      allowedScopes: ['workspace'],
      auditEventTypes: ['tool-called', 'tool-approved', 'tool-completed'],
      tags: ['workspace', 'write', 'approval-required'],
      implementationStatus: 'implemented',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'delete_file',
      name: 'delete_file',
      displayName: 'Delete File',
      description: 'Delete a workspace file with explicit approval policy.',
      category: 'workspace',
      inputSchema: {
        schemaType: 'json-schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['path'],
          properties: {
            path: { type: 'string' },
          },
        },
      },
      outputSchema: {
        schemaType: 'json-schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok'],
          properties: {
            ok: { type: 'boolean' },
          },
        },
      },
      riskLevel: 'destructive',
      requiresApproval: true,
      enabled: true,
      timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
      maxInputBytes: DEFAULT_MAX_INPUT_BYTES,
      maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
      allowedModes: ['execute'],
      allowedScopes: ['workspace'],
      auditEventTypes: ['tool-called', 'tool-approved', 'tool-completed'],
      tags: ['workspace', 'delete', 'approval-required'],
      implementationStatus: 'implemented',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'run_validation',
      name: 'run_validation',
      displayName: 'Run Validation',
      description:
        'Run an allow-listed validation command only; arbitrary shell remains disabled.',
      category: 'validation',
      inputSchema: {
        schemaType: 'json-schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['command'],
          properties: {
            command: { type: 'string' },
          },
        },
      },
      outputSchema: {
        schemaType: 'json-schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['success', 'exitCode'],
          properties: {
            success: { type: 'boolean' },
            exitCode: { type: 'number' },
          },
        },
      },
      riskLevel: 'medium',
      requiresApproval: false,
      enabled: false,
      timeoutMs: DEFAULT_AGENT_HARNESS_CONFIG_V1.validationTimeoutMs,
      maxInputBytes: DEFAULT_MAX_INPUT_BYTES,
      maxOutputBytes: DEFAULT_AGENT_HARNESS_CONFIG_V1.maxValidationOutputBytes,
      allowedModes: ['execute'],
      allowedScopes: ['workspace', 'repository'],
      auditEventTypes: ['tool-called', 'tool-completed'],
      tags: ['planned', 'metadata-only', 'validation', 'allow-list-only'],
      implementationStatus: 'contract-only',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'start_preview',
      name: 'start_preview',
      displayName: 'Start Preview',
      description: 'Start a local preview process for verification workflows.',
      category: 'preview',
      inputSchema: {
        schemaType: 'json-schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            command: { type: 'string' },
            port: { type: 'number' },
          },
        },
      },
      riskLevel: 'medium',
      requiresApproval: false,
      enabled: false,
      timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
      maxInputBytes: DEFAULT_MAX_INPUT_BYTES,
      maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
      allowedModes: ['execute'],
      allowedScopes: ['workspace', 'session'],
      auditEventTypes: ['tool-called', 'tool-completed'],
      tags: ['planned', 'metadata-only', 'preview'],
      implementationStatus: 'planned',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'browser_smoke',
      name: 'browser_smoke',
      displayName: 'Browser Smoke',
      description: 'Run browser smoke checks when enabled in a future implementation slice.',
      category: 'browser',
      inputSchema: {
        schemaType: 'json-schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            scenario: { type: 'string' },
          },
        },
      },
      riskLevel: 'high',
      requiresApproval: true,
      enabled: false,
      timeoutMs: DEFAULT_AGENT_HARNESS_CONFIG_V1.browserSmokeTimeoutMs,
      maxInputBytes: DEFAULT_MAX_INPUT_BYTES,
      maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
      allowedModes: ['execute'],
      allowedScopes: ['workspace', 'session'],
      auditEventTypes: ['tool-called', 'tool-approved', 'tool-completed'],
      tags: ['planned', 'metadata-only', 'browser', 'approval-required'],
      implementationStatus: 'planned',
    },
    {
      contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
      id: 'search_workspace',
      name: 'search_workspace',
      displayName: 'Search Workspace',
      description:
        'Search workspace content (lexical/semantic placeholder) without implying semantic search runtime is enabled.',
      category: 'search',
      inputSchema: {
        schemaType: 'json-schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['query'],
          properties: {
            query: { type: 'string' },
            path: { type: 'string' },
          },
        },
      },
      riskLevel: 'low',
      requiresApproval: false,
      enabled: false,
      timeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
      maxInputBytes: DEFAULT_MAX_INPUT_BYTES,
      maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
      allowedModes: ['execute', 'review'],
      allowedScopes: ['workspace', 'repository'],
      auditEventTypes: ['tool-called', 'tool-completed'],
      tags: ['planned', 'metadata-only', 'search', 'semantic-disabled-by-default'],
      implementationStatus: 'planned',
    },
  ]);

const definitionsById: Record<string, AgentHarnessToolRegistryDefinitionV1> = {};
for (const definition of AGENT_HARNESS_TOOL_DEFINITIONS_V1) {
  definitionsById[definition.id] = definition;
}

export const AGENT_HARNESS_TOOL_DEFINITION_MAP_V1: AgentHarnessToolDefinitionMapV1 =
  Object.freeze(definitionsById);

export function listAgentHarnessToolDefinitions(): readonly AgentHarnessToolRegistryDefinitionV1[] {
  return AGENT_HARNESS_TOOL_DEFINITIONS_V1;
}

export function listEnabledAgentHarnessToolDefinitions(): readonly AgentHarnessToolRegistryDefinitionV1[] {
  return AGENT_HARNESS_TOOL_DEFINITIONS_V1.filter((definition) => definition.enabled);
}

export function getAgentHarnessToolDefinition(
  toolId: string,
): AgentHarnessToolRegistryDefinitionV1 | undefined {
  return AGENT_HARNESS_TOOL_DEFINITION_MAP_V1[toolId];
}

export function isAgentHarnessToolEnabled(toolId: string): boolean {
  const definition = getAgentHarnessToolDefinition(toolId);
  return definition?.enabled === true;
}

export function doesAgentHarnessToolRequireApproval(toolId: string): boolean {
  const definition = getAgentHarnessToolDefinition(toolId);
  return definition?.requiresApproval === true;
}
