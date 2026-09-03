import type { AIExecutionResult } from '../types';
import type {
  AgentHarnessToolImplementationStatusV1,
  AgentHarnessToolRegistryDefinitionV1,
} from '../../agent-harness/tools/tool-registry.contracts';

export type AIAdapterToolCallProviderKind =
  | 'anthropic-tool_use'
  | 'openai-tool_calls'
  | 'openai-function_call'
  | 'stub';

export type AIAdapterToolUseFinishReason =
  | 'completed'
  | 'tool_calls'
  | 'max_tokens'
  | 'stop'
  | 'unknown';

export interface AIAdapterToolDeclaration {
  readonly sourceToolId: string;
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly requiresApproval: boolean;
  readonly enabled: boolean;
  readonly implementationStatus: AgentHarnessToolImplementationStatusV1;
}

export interface AIAdapterToolCallMetadata {
  readonly callId: string;
  readonly toolName: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly providerKind: AIAdapterToolCallProviderKind;
}

export interface AIAdapterToolResultPayload {
  readonly callId: string;
  readonly toolName: string;
  readonly success: boolean;
  readonly content?: Readonly<Record<string, unknown>>;
  readonly errorMessage?: string;
}

export const MALFORMED_TOOL_ARGUMENTS_ERROR_CODE = 'MALFORMED_TOOL_ARGUMENTS' as const;

export type AIAdapterCanonicalValidToolCall = {
  readonly status: 'valid';
  readonly callId: string;
  readonly toolName: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly rawArguments: unknown;
  readonly providerKind: AIAdapterToolCallProviderKind;
};

export type AIAdapterCanonicalMalformedToolCall = {
  readonly status: 'malformed_arguments';
  readonly callId: string;
  readonly toolName: string;
  readonly rawArguments: unknown;
  readonly providerKind: AIAdapterToolCallProviderKind;
  readonly errorMessage: string;
};

export type AIAdapterCanonicalMissingIdToolCall = {
  readonly status: 'missing_id';
  readonly toolName: string;
  readonly rawArguments: unknown;
  readonly providerKind: AIAdapterToolCallProviderKind;
};

export type AIAdapterCanonicalToolCall =
  | AIAdapterCanonicalValidToolCall
  | AIAdapterCanonicalMalformedToolCall
  | AIAdapterCanonicalMissingIdToolCall;

export interface AIAdapterCanonicalAssistantToolTurn {
  readonly kind: 'assistant_tool_turn';
  readonly content: string;
  readonly toolCalls: readonly AIAdapterCanonicalToolCall[];
}

export interface AIAdapterCanonicalToolResultTurn {
  readonly kind: 'tool_result_turn';
  readonly results: readonly AIAdapterToolResultPayload[];
}

export type AIAdapterCanonicalTranscriptTurn =
  | AIAdapterCanonicalAssistantToolTurn
  | AIAdapterCanonicalToolResultTurn;

export interface AIAdapterToolUseRequestOptions {
  readonly tools?: readonly AgentHarnessToolRegistryDefinitionV1[];
  readonly toolResults?: readonly AIAdapterToolResultPayload[];
  readonly transcript?: readonly AIAdapterCanonicalTranscriptTurn[];
}

export interface AIAdapterToolUseResult extends AIExecutionResult {
  readonly finishReason: AIAdapterToolUseFinishReason;
  readonly toolCalls: readonly AIAdapterToolCallMetadata[];
  readonly canonicalToolCalls?: readonly AIAdapterCanonicalToolCall[];
}

