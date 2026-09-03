import { AGENT_HARNESS_TOOL_DEFINITIONS_V1 } from '../../agent-harness/tools/tool-registry';
import type { AgentHarnessToolRegistryDefinitionV1 } from '../../agent-harness/tools/tool-registry.contracts';
import type {
  AIAdapterCanonicalToolCall,
  AIAdapterCanonicalTranscriptTurn,
  AIAdapterToolDeclaration,
  AIAdapterToolResultPayload,
} from './adapter-tool-use.contracts';
import { MALFORMED_TOOL_ARGUMENTS_ERROR_CODE } from './adapter-tool-use.contracts';

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

export type ToolArgumentParseResult =
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly errorMessage: string };

export function parseToolArgumentsToObject(
  rawArguments: unknown,
): ToolArgumentParseResult {
  if (isRecord(rawArguments)) {
    return { ok: true, value: rawArguments };
  }

  if (typeof rawArguments !== 'string' || rawArguments.trim().length === 0) {
    return {
      ok: false,
      errorMessage: `${MALFORMED_TOOL_ARGUMENTS_ERROR_CODE}: arguments are not a JSON object`,
    };
  }

  try {
    const parsed = JSON.parse(rawArguments);
    if (isRecord(parsed)) {
      return { ok: true, value: parsed };
    }
    return {
      ok: false,
      errorMessage: `${MALFORMED_TOOL_ARGUMENTS_ERROR_CODE}: arguments are not a JSON object`,
    };
  } catch {
    return {
      ok: false,
      errorMessage: `${MALFORMED_TOOL_ARGUMENTS_ERROR_CODE}: arguments are not valid JSON object`,
    };
  }
}

export function tryParseToolArgumentsToObject(
  rawArguments: unknown,
): Readonly<Record<string, unknown>> | undefined {
  const parsed = parseToolArgumentsToObject(rawArguments);
  return parsed.ok ? parsed.value : undefined;
}

export interface OpenAINativeTranscriptToolCall {
  readonly id: string;
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
}

export interface OpenAINativeAssistantTranscriptMessage {
  readonly role: 'assistant';
  readonly content: string | null;
  readonly tool_calls?: readonly OpenAINativeTranscriptToolCall[];
}

export interface OpenAINativeToolTranscriptMessage {
  readonly role: 'tool';
  readonly tool_call_id: string;
  readonly content: string;
}

export type OpenAINativeTranscriptMessage =
  | OpenAINativeAssistantTranscriptMessage
  | OpenAINativeToolTranscriptMessage;

export interface AnthropicNativeTextBlock {
  readonly type: 'text';
  readonly text: string;
}

export interface AnthropicNativeToolUseBlock {
  readonly type: 'tool_use';
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

export interface AnthropicNativeToolResultBlock {
  readonly type: 'tool_result';
  readonly tool_use_id: string;
  readonly content: string;
  readonly is_error?: true;
}

export interface AnthropicNativeAssistantTranscriptMessage {
  readonly role: 'assistant';
  readonly content: readonly (AnthropicNativeTextBlock | AnthropicNativeToolUseBlock)[];
}

export interface AnthropicNativeUserToolResultMessage {
  readonly role: 'user';
  readonly content: readonly AnthropicNativeToolResultBlock[];
}

export type AnthropicNativeTranscriptMessage =
  | AnthropicNativeAssistantTranscriptMessage
  | AnthropicNativeUserToolResultMessage;

function serializeToolResultContent(result: AIAdapterToolResultPayload): string {
  if (!result.success) {
    return result.errorMessage ?? `${MALFORMED_TOOL_ARGUMENTS_ERROR_CODE}: tool failed`;
  }
  return JSON.stringify(result.content ?? {});
}

function nativeOpenAIArgumentString(call: AIAdapterCanonicalToolCall): string {
  if (typeof call.rawArguments === 'string') {
    return call.rawArguments;
  }
  if (call.status === 'valid') {
    return JSON.stringify(call.arguments);
  }
  return JSON.stringify(call.rawArguments ?? {});
}

function nativeAnthropicToolUseInput(call: AIAdapterCanonicalToolCall): unknown {
  if (call.status === 'valid') {
    return call.arguments;
  }
  return call.rawArguments;
}

function correlatableToolCalls(
  toolCalls: readonly AIAdapterCanonicalToolCall[],
): Exclude<AIAdapterCanonicalToolCall, { status: 'missing_id' }>[] {
  return toolCalls.filter(
    (call): call is Exclude<AIAdapterCanonicalToolCall, { status: 'missing_id' }> =>
      call.status !== 'missing_id',
  );
}

export function mapCanonicalTranscriptToOpenAIMessages(
  transcript: readonly AIAdapterCanonicalTranscriptTurn[] = [],
): readonly OpenAINativeTranscriptMessage[] {
  const messages: OpenAINativeTranscriptMessage[] = [];

  for (const turn of transcript) {
    if (turn.kind === 'assistant_tool_turn') {
      const toolCalls = correlatableToolCalls(turn.toolCalls).map((call) => ({
        id: call.callId,
        type: 'function' as const,
        function: {
          name: call.toolName,
          arguments: nativeOpenAIArgumentString(call),
        },
      }));
      const content =
        turn.content.trim().length > 0 ? turn.content : toolCalls.length > 0 ? null : '';
      messages.push(
        toolCalls.length > 0
          ? { role: 'assistant', content, tool_calls: toolCalls }
          : { role: 'assistant', content: turn.content },
      );
      continue;
    }

    for (const result of turn.results) {
      messages.push({
        role: 'tool',
        tool_call_id: result.callId,
        content: serializeToolResultContent(result),
      });
    }
  }

  return messages;
}

export function mapCanonicalTranscriptToAnthropicMessages(
  transcript: readonly AIAdapterCanonicalTranscriptTurn[] = [],
): readonly AnthropicNativeTranscriptMessage[] {
  const messages: AnthropicNativeTranscriptMessage[] = [];

  for (const turn of transcript) {
    if (turn.kind === 'assistant_tool_turn') {
      const content: Array<AnthropicNativeTextBlock | AnthropicNativeToolUseBlock> = [];
      if (turn.content.trim().length > 0) {
        content.push({ type: 'text', text: turn.content });
      }
      for (const call of correlatableToolCalls(turn.toolCalls)) {
        content.push({
          type: 'tool_use',
          id: call.callId,
          name: call.toolName,
          input: nativeAnthropicToolUseInput(call),
        });
      }
      messages.push({
        role: 'assistant',
        content,
      });
      continue;
    }

    messages.push({
      role: 'user',
      content: turn.results.map((result) => {
        const block: AnthropicNativeToolResultBlock = {
          type: 'tool_result',
          tool_use_id: result.callId,
          content: serializeToolResultContent(result),
        };
        return result.success ? block : { ...block, is_error: true as const };
      }),
    });
  }

  return messages;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

