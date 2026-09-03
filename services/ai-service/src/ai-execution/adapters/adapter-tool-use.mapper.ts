import { AGENT_HARNESS_TOOL_DEFINITIONS_V1 } from '../../agent-harness/tools/tool-registry';
import type { AgentHarnessToolRegistryDefinitionV1 } from '../../agent-harness/tools/tool-registry.contracts';
import type { AIAdapterToolDeclaration } from './adapter-tool-use.contracts';

export const FIRST_READ_ONLY_HARNESS_ADVERTISED_TOOL_IDS = Object.freeze([
  'list_files',
  'read_file',
] as const);

export type FirstReadOnlyHarnessAdvertisedToolId =
  (typeof FIRST_READ_ONLY_HARNESS_ADVERTISED_TOOL_IDS)[number];

export interface AgentHarnessToolAdvertisementFilterInput {
  readonly registeredHandlerNames: Iterable<string>;
  readonly enableWriteTools?: boolean;
  readonly enableValidationTools?: boolean;
  readonly enableBrowserSmoke?: boolean;
  readonly definitions?: readonly AgentHarnessToolRegistryDefinitionV1[];
}

function toHandlerNameSet(names: Iterable<string>): ReadonlySet<string> {
  return names instanceof Set ? names : new Set(names);
}

function isPermittedByFirstReadOnlyHarnessSlice(toolId: string): boolean {
  return (FIRST_READ_ONLY_HARNESS_ADVERTISED_TOOL_IDS as readonly string[]).includes(
    toolId,
  );
}

function passesFirstSliceRuntimeGate(
  definition: AgentHarnessToolRegistryDefinitionV1,
  input: {
    readonly enableWriteTools: boolean;
    readonly enableValidationTools: boolean;
    readonly enableBrowserSmoke: boolean;
  },
): boolean {
  switch (definition.id) {
    case 'list_files':
    case 'read_file':
      return true;
    case 'write_file':
    case 'delete_file':
      return input.enableWriteTools === true;
    case 'run_validation':
      return input.enableValidationTools === true;
    case 'browser_smoke':
      return input.enableBrowserSmoke === true;
    default:
      return false;
  }
}

export function isAgentHarnessToolEligibleForAdvertisement(
  definition: AgentHarnessToolRegistryDefinitionV1,
  input: {
    readonly registeredHandlerNames: ReadonlySet<string>;
    readonly enableWriteTools: boolean;
    readonly enableValidationTools: boolean;
    readonly enableBrowserSmoke: boolean;
  },
): boolean {
  if (definition.implementationStatus !== 'implemented') {
    return false;
  }
  if (definition.enabled !== true) {
    return false;
  }
  if (
    !input.registeredHandlerNames.has(definition.name) &&
    !input.registeredHandlerNames.has(definition.id)
  ) {
    return false;
  }
  if (!isPermittedByFirstReadOnlyHarnessSlice(definition.id)) {
    return false;
  }
  return passesFirstSliceRuntimeGate(definition, input);
}

export function selectAdvertisedAgentHarnessTools(
  input: AgentHarnessToolAdvertisementFilterInput,
): readonly AgentHarnessToolRegistryDefinitionV1[] {
  const definitions = input.definitions ?? AGENT_HARNESS_TOOL_DEFINITIONS_V1;
  const registeredHandlerNames = toHandlerNameSet(input.registeredHandlerNames);
  const eligibilityInput = {
    registeredHandlerNames,
    enableWriteTools: input.enableWriteTools === true,
    enableValidationTools: input.enableValidationTools === true,
    enableBrowserSmoke: input.enableBrowserSmoke === true,
  };

  return definitions.filter((definition) =>
    isAgentHarnessToolEligibleForAdvertisement(definition, eligibilityInput),
  );
}

export interface AnthropicAdapterToolDeclaration {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Readonly<Record<string, unknown>>;
}

export interface OpenAIAdapterToolDeclaration {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Readonly<Record<string, unknown>>;
  };
}

export function mapAgentHarnessToolDefinitionToAdapterToolDeclaration(
  definition: AgentHarnessToolRegistryDefinitionV1,
): AIAdapterToolDeclaration {
  return {
    sourceToolId: definition.id,
    name: definition.name,
    description: definition.description,
    inputSchema: definition.inputSchema.schema,
    requiresApproval: definition.requiresApproval,
    enabled: definition.enabled,
    implementationStatus: definition.implementationStatus,
  };
}

export function mapAgentHarnessToolDefinitionsToAdapterToolDeclarations(
  definitions?: readonly AgentHarnessToolRegistryDefinitionV1[],
): readonly AIAdapterToolDeclaration[] {
  if (!definitions || definitions.length === 0) {
    return [];
  }

  return definitions.map(mapAgentHarnessToolDefinitionToAdapterToolDeclaration);
}

export function mapAdapterToolDeclarationsToAnthropicTools(
  declarations?: readonly AIAdapterToolDeclaration[],
): readonly AnthropicAdapterToolDeclaration[] {
  if (!declarations || declarations.length === 0) {
    return [];
  }

  return declarations.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

export function mapAgentHarnessToolDefinitionsToAnthropicTools(
  definitions?: readonly AgentHarnessToolRegistryDefinitionV1[],
): readonly AnthropicAdapterToolDeclaration[] {
  return mapAdapterToolDeclarationsToAnthropicTools(
    mapAgentHarnessToolDefinitionsToAdapterToolDeclarations(definitions),
  );
}

export function mapAdapterToolDeclarationsToOpenAITools(
  declarations?: readonly AIAdapterToolDeclaration[],
): readonly OpenAIAdapterToolDeclaration[] {
  if (!declarations || declarations.length === 0) {
    return [];
  }

  return declarations.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

export function mapAgentHarnessToolDefinitionsToOpenAITools(
  definitions?: readonly AgentHarnessToolRegistryDefinitionV1[],
): readonly OpenAIAdapterToolDeclaration[] {
  return mapAdapterToolDeclarationsToOpenAITools(
    mapAgentHarnessToolDefinitionsToAdapterToolDeclarations(definitions),
  );
}

export function tryParseToolArgumentsToObject(
  rawArguments: unknown,
): Readonly<Record<string, unknown>> {
  if (isRecord(rawArguments)) {
    return rawArguments;
  }

  if (typeof rawArguments !== 'string' || rawArguments.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawArguments);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

