import type { AgentHarnessToolRegistryDefinitionV1 } from '../../agent-harness/tools/tool-registry.contracts';
import type { AIAdapterToolDeclaration } from './adapter-tool-use.contracts';

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

