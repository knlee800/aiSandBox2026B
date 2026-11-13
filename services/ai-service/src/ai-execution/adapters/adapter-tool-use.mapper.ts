import { InternalServerErrorException } from '@nestjs/common';
import type OpenAI from 'openai';
import { AGENT_HARNESS_TOOL_DEFINITIONS_V1 } from '../../agent-harness/tools/tool-registry';
import type { AgentHarnessToolRegistryDefinitionV1 } from '../../agent-harness/tools/tool-registry.contracts';
import type {
  AIAdapterCanonicalToolCall,
  AIAdapterCanonicalTranscriptTurn,
  AIAdapterToolCallMetadata,
  AIAdapterToolDeclaration,
  AIAdapterToolResultPayload,
  AIAdapterToolUseFinishReason,
  AIAdapterToolUseResult,
} from './adapter-tool-use.contracts';
import { MALFORMED_TOOL_ARGUMENTS_ERROR_CODE } from './adapter-tool-use.contracts';

export const HARNESS_ADVERTISABLE_TOOL_IDS = Object.freeze([
  'list_files',
  'read_file',
  'write_file',
  'delete_file',
  'run_validation',
  'search_workspace',
  'search_knowledge',
  'read_knowledge',
] as const);

export type HarnessAdvertisableToolId =
  (typeof HARNESS_ADVERTISABLE_TOOL_IDS)[number];

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

function isPermittedByHarnessAdvertisableToolIds(toolId: string): boolean {
  return (HARNESS_ADVERTISABLE_TOOL_IDS as readonly string[]).includes(toolId);
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
    case 'search_workspace':
    case 'search_knowledge':
    case 'read_knowledge':
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
  if (!isPermittedByHarnessAdvertisableToolIds(definition.id)) {
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

export interface ResponsesAdapterFunctionTool {
  readonly type: 'function';
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly strict: false;
}

export function mapAdapterToolDeclarationsToResponsesTools(
  declarations?: readonly AIAdapterToolDeclaration[],
): readonly ResponsesAdapterFunctionTool[] {
  if (!declarations || declarations.length === 0) {
    return [];
  }

  return declarations.map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
    strict: false,
  }));
}

export function mapAgentHarnessToolDefinitionsToResponsesTools(
  definitions?: readonly AgentHarnessToolRegistryDefinitionV1[],
): readonly ResponsesAdapterFunctionTool[] {
  return mapAdapterToolDeclarationsToResponsesTools(
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
  readonly reasoning_content?: string;
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
  readonly content: readonly unknown[];
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

function openAIDeepSeekReasoningContent(providerState: unknown): string | undefined {
  if (!isRecord(providerState) || providerState.kind !== 'deepseek-reasoning') {
    return undefined;
  }
  if (typeof providerState.reasoningContent !== 'string') {
    return undefined;
  }
  return providerState.reasoningContent;
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
      const reasoningContent = openAIDeepSeekReasoningContent(turn.providerState);
      const reasoningField =
        reasoningContent !== undefined
          ? { reasoning_content: reasoningContent }
          : {};
      messages.push(
        toolCalls.length > 0
          ? { role: 'assistant', content, tool_calls: toolCalls, ...reasoningField }
          : { role: 'assistant', content: turn.content, ...reasoningField },
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

/**
 * ACCESS-01J: OpenAI and xAI tool runs are stateless (store: false, no
 * previous_response_id). Every continuation step replays the whole
 * conversation, so each earlier assistant turn must carry the output items the
 * provider returned. Anything missing or malformed fails closed with this
 * message (plus a short detail with no content); a partial history is never
 * sent.
 */
export const RESPONSES_CONTINUATION_INVALID_HISTORY_MESSAGE =
  'Responses tool continuation requires providerState { kind: "responses", outputItems } on every earlier assistant turn, each function_call paired with its function_call_output';

/**
 * Requested on every stateless Responses call so reasoning items come back
 * with encrypted_content and can be replayed on the next step.
 */
export const RESPONSES_STATELESS_INCLUDE = Object.freeze([
  'reasoning.encrypted_content',
] as const);

export interface ResponsesUserMessageInput {
  readonly role: 'user';
  readonly content: string;
}

export interface ResponsesFunctionCallOutputInput {
  readonly type: 'function_call_output';
  readonly call_id: string;
  readonly output: string;
}

/** A function_call output item, replayed exactly as the provider returned it. */
export interface ResponsesReplayFunctionCallItem {
  readonly type: 'function_call';
  readonly call_id: string;
  readonly name: string;
  readonly arguments: string;
}

/** An assistant message output item, replayed exactly as returned. */
export interface ResponsesReplayMessageItem {
  readonly type: 'message';
  readonly role: 'assistant';
  readonly content: readonly unknown[];
}

/** A reasoning output item (with encrypted_content when present), replayed exactly as returned. */
export interface ResponsesReplayReasoningItem {
  readonly type: 'reasoning';
  readonly summary: readonly unknown[];
  readonly encrypted_content?: string | null;
}

export type ResponsesReplayOutputItem =
  | ResponsesReplayFunctionCallItem
  | ResponsesReplayMessageItem
  | ResponsesReplayReasoningItem;

export type ResponsesToolInputItem =
  | ResponsesUserMessageInput
  | ResponsesReplayOutputItem
  | ResponsesFunctionCallOutputInput;

/** Adapter-owned providerState for one Responses assistant turn (opaque to the loop). */
export interface ResponsesProviderState {
  readonly kind: 'responses';
  readonly outputItems: readonly unknown[];
}

export interface ResponsesToolRequest {
  readonly input: readonly ResponsesToolInputItem[];
  readonly instructions?: string;
}

export interface ResponsesToolRequestSource {
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly transcript?: readonly AIAdapterCanonicalTranscriptTurn[];
}

export interface ResponsesToolUseResponseSource {
  readonly id?: unknown;
  readonly model?: unknown;
  readonly status?: unknown;
  readonly output?: readonly unknown[] | null;
  readonly usage?: { readonly total_tokens?: unknown } | null;
  readonly incomplete_details?: { readonly reason?: unknown } | null;
}

export function buildResponsesToolRequest(
  source: ResponsesToolRequestSource,
): ResponsesToolRequest {
  const normalizedSystemPrompt =
    typeof source.systemPrompt === 'string' ? source.systemPrompt.trim() : '';
  const transcript = source.transcript ?? [];
  const instructions =
    normalizedSystemPrompt.length > 0 ? normalizedSystemPrompt : undefined;

  if (transcript.length === 0) {
    return {
      input: [{ role: 'user', content: source.prompt }],
      ...(instructions !== undefined ? { instructions } : {}),
    };
  }

  return {
    input: [
      { role: 'user', content: source.prompt },
      ...replayResponsesTranscript(transcript),
    ],
    ...(instructions !== undefined ? { instructions } : {}),
  };
}

/**
 * Converts the mapper's input items to the SDK's Responses input items.
 * Replayed output items are the provider's own output items
 * (ResponseOutputMessage | ResponseFunctionToolCall | ResponseReasoningItem),
 * which the Responses API accepts back as input. They were checked by type
 * and key fields in replayResponsesTranscript and are passed on verbatim, so
 * the one narrow assertion below only widens their nested content arrays.
 */
export function toResponsesSdkInput(
  items: readonly ResponsesToolInputItem[],
): OpenAI.Responses.ResponseInputItem[] {
  return items.map((item): OpenAI.Responses.ResponseInputItem => {
    if ('role' in item && item.role === 'user') {
      return { role: 'user', content: item.content };
    }
    if (item.type === 'function_call_output') {
      return {
        type: 'function_call_output',
        call_id: item.call_id,
        output: item.output,
      };
    }
    // Narrow assertion: a validated provider output item replayed unchanged.
    return item as OpenAI.Responses.ResponseInputItem;
  });
}

function failResponsesContinuation(detail: string): never {
  throw new InternalServerErrorException(
    `${RESPONSES_CONTINUATION_INVALID_HISTORY_MESSAGE} (${detail})`,
  );
}

function replayResponsesTranscript(
  transcript: readonly AIAdapterCanonicalTranscriptTurn[],
): ResponsesToolInputItem[] {
  if (transcript.length % 2 !== 0) {
    failResponsesContinuation('transcript does not end with tool results');
  }

  const replay: ResponsesToolInputItem[] = [];
  for (let index = 0; index < transcript.length; index += 2) {
    const assistantTurn = transcript[index];
    const resultTurn = transcript[index + 1];
    if (assistantTurn.kind !== 'assistant_tool_turn') {
      failResponsesContinuation(`turn ${index} is not an assistant turn`);
    }
    if (resultTurn.kind !== 'tool_result_turn') {
      failResponsesContinuation(`turn ${index + 1} is not a tool result turn`);
    }

    const outputItems = readResponsesReplayItems(assistantTurn.providerState, index);
    const callIds = outputItems.flatMap((item) =>
      item.type === 'function_call' ? [item.call_id] : [],
    );
    if (callIds.length === 0) {
      failResponsesContinuation(`turn ${index} has no function_call item`);
    }
    if (new Set(callIds).size !== callIds.length) {
      failResponsesContinuation(`turn ${index} repeats a call_id`);
    }
    const canonicalIds = assistantTurn.toolCalls.map((call) =>
      call.status === 'missing_id' ? undefined : call.callId,
    );
    if (
      canonicalIds.length !== callIds.length ||
      canonicalIds.some((callId, position) => callId !== callIds[position])
    ) {
      failResponsesContinuation(
        `turn ${index} providerState does not match its tool calls`,
      );
    }
    const resultIds = resultTurn.results.map((result) => result.callId);
    const callIdSet = new Set(callIds);
    if (
      resultIds.length !== callIds.length ||
      new Set(resultIds).size !== resultIds.length ||
      resultIds.some((callId) => !callIdSet.has(callId))
    ) {
      failResponsesContinuation(
        `turn ${index + 1} results are not paired one to one with the function calls`,
      );
    }

    replay.push(...outputItems);
    for (const result of resultTurn.results) {
      replay.push({
        type: 'function_call_output',
        call_id: result.callId,
        output: serializeToolResultContent(result),
      });
    }
  }
  return replay;
}

function readResponsesReplayItems(
  providerState: unknown,
  turnIndex: number,
): readonly ResponsesReplayOutputItem[] {
  if (
    !isRecord(providerState) ||
    providerState.kind !== 'responses' ||
    !Array.isArray(providerState.outputItems) ||
    providerState.outputItems.length === 0
  ) {
    failResponsesContinuation(`turn ${turnIndex} has no Responses providerState`);
  }
  return providerState.outputItems.map(
    (item: unknown, position: number): ResponsesReplayOutputItem => {
      if (!isResponsesReplayItem(item)) {
        failResponsesContinuation(
          `turn ${turnIndex} output item ${position} is malformed or unsupported`,
        );
      }
      return item;
    },
  );
}

function isResponsesReplayItem(item: unknown): item is ResponsesReplayOutputItem {
  if (!isRecord(item)) {
    return false;
  }
  switch (item.type) {
    case 'function_call':
      return (
        typeof item.call_id === 'string' &&
        item.call_id.trim().length > 0 &&
        typeof item.name === 'string' &&
        typeof item.arguments === 'string'
      );
    case 'message':
      return item.role === 'assistant' && Array.isArray(item.content);
    case 'reasoning':
      return (
        Array.isArray(item.summary) &&
        (item.encrypted_content === undefined ||
          item.encrypted_content === null ||
          typeof item.encrypted_content === 'string')
      );
    default:
      return false;
  }
}

/**
 * A JSON copy of every output item the provider returned, kept so the next
 * step can replay them. Nothing is dropped here: an item that cannot be
 * replayed makes the next step fail closed instead of sending a partial history.
 */
function copyResponsesOutputItems(
  outputItems: readonly unknown[],
): readonly unknown[] {
  return outputItems.map((item): unknown =>
    item === undefined ? null : (JSON.parse(JSON.stringify(item)) as unknown),
  );
}

export type ResponsesToolFailureProviderName = 'OpenAI' | 'xAI';

function malformedResponsesMessage(
  providerName: ResponsesToolFailureProviderName,
  detail: string,
): string {
  return `Malformed ${providerName} response: ${detail}`;
}

export function parseResponsesToolUseResponse(
  response: ResponsesToolUseResponseSource,
  fallbackModel: string,
  providerName: ResponsesToolFailureProviderName = 'OpenAI',
): AIAdapterToolUseResult {
  if (!response.usage || typeof response.usage.total_tokens !== 'number') {
    throw new InternalServerErrorException(
      malformedResponsesMessage(providerName, 'missing usage'),
    );
  }
  if (response.usage.total_tokens < 0) {
    throw new InternalServerErrorException(
      malformedResponsesMessage(providerName, 'invalid token count'),
    );
  }

  const textParts: string[] = [];
  const canonicalToolCalls: AIAdapterCanonicalToolCall[] = [];
  const toolCalls: AIAdapterToolCallMetadata[] = [];
  const outputItems = Array.isArray(response.output) ? response.output : [];

  for (const item of outputItems) {
    if (!isRecord(item)) {
      continue;
    }
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (
          isRecord(part) &&
          part.type === 'output_text' &&
          typeof part.text === 'string'
        ) {
          textParts.push(part.text);
        }
      }
      continue;
    }
    if (item.type === 'function_call') {
      appendResponsesFunctionCall(item, canonicalToolCalls, toolCalls);
    }
  }

  const output = textParts.join('');
  if (output.trim().length === 0 && canonicalToolCalls.length === 0) {
    throw new InternalServerErrorException(
      malformedResponsesMessage(providerName, 'missing content'),
    );
  }

  const model =
    typeof response.model === 'string' && response.model.length > 0
      ? response.model
      : fallbackModel;
  const finishReason = mapResponsesFinishReason(response, canonicalToolCalls);

  return {
    output,
    tokensUsed: response.usage.total_tokens,
    model,
    finishReason,
    toolCalls,
    canonicalToolCalls,
    ...(canonicalToolCalls.length > 0
      ? {
          providerState: {
            kind: 'responses',
            outputItems: copyResponsesOutputItems(outputItems),
          } satisfies ResponsesProviderState,
        }
      : {}),
  };
}

function appendResponsesFunctionCall(
  item: Record<string, unknown>,
  canonicalToolCalls: AIAdapterCanonicalToolCall[],
  toolCalls: AIAdapterToolCallMetadata[],
): void {
  const rawArguments = item.arguments;
  const parsed = parseToolArgumentsToObject(rawArguments);
  const toolName = typeof item.name === 'string' ? item.name : '';
  const usableCallId =
    typeof item.call_id === 'string' && item.call_id.trim().length > 0
      ? item.call_id
      : undefined;
  const providerKind = 'openai-function_call' as const;

  if (!usableCallId) {
    canonicalToolCalls.push({
      status: 'missing_id',
      toolName,
      rawArguments,
      providerKind,
    });
    return;
  }

  if (parsed.ok === false) {
    canonicalToolCalls.push({
      status: 'malformed_arguments',
      callId: usableCallId,
      toolName,
      rawArguments,
      providerKind,
      errorMessage: parsed.errorMessage,
    });
    return;
  }

  canonicalToolCalls.push({
    status: 'valid',
    callId: usableCallId,
    toolName,
    arguments: parsed.value,
    rawArguments,
    providerKind,
  });
  toolCalls.push({
    callId: usableCallId,
    toolName,
    arguments: parsed.value,
    providerKind,
  });
}

function mapResponsesFinishReason(
  response: ResponsesToolUseResponseSource,
  toolCalls: readonly AIAdapterCanonicalToolCall[],
): AIAdapterToolUseFinishReason {
  if (toolCalls.length > 0) {
    return 'tool_calls';
  }
  if (
    isRecord(response.incomplete_details) &&
    response.incomplete_details.reason === 'max_output_tokens'
  ) {
    return 'max_tokens';
  }
  if (response.status === 'completed') {
    return 'completed';
  }
  return 'unknown';
}

function anthropicOpaqueAssistantContent(
  providerState: unknown,
): readonly unknown[] | undefined {
  if (!isRecord(providerState)) {
    return undefined;
  }
  if (
    providerState.kind !== 'anthropic-content' ||
    !Array.isArray(providerState.content)
  ) {
    return undefined;
  }
  return providerState.content;
}

export function mapCanonicalTranscriptToAnthropicMessages(
  transcript: readonly AIAdapterCanonicalTranscriptTurn[] = [],
): readonly AnthropicNativeTranscriptMessage[] {
  const messages: AnthropicNativeTranscriptMessage[] = [];

  for (const turn of transcript) {
    if (turn.kind === 'assistant_tool_turn') {
      const opaqueContent = anthropicOpaqueAssistantContent(turn.providerState);
      if (opaqueContent !== undefined) {
        messages.push({
          role: 'assistant',
          content: opaqueContent,
        });
        continue;
      }

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

