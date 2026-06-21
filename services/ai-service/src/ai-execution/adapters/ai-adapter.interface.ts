import { AIExecutionRequest, AIExecutionResult } from '../types';
import type {
  AIAdapterToolUseRequestOptions,
  AIAdapterToolUseResult,
} from './adapter-tool-use.contracts';

/**
 * AIAdapter
 *
 * Stage C2-D: Adapter Interface
 *
 * Abstract interface for AI execution providers.
 * Implementations provide the actual AI execution logic.
 *
 * Design:
 * - Provider-agnostic contract
 * - No SDK dependencies at interface level
 * - Adapters implement model-specific logic
 */
export interface AIAdapter {
  /**
   * Model identifier
   * Examples: 'stub', 'claude-sonnet-4', 'gpt-4'
   */
  readonly model: string;
  readonly supportsToolUse?: boolean;

  /**
   * Execute AI request
   *
   * @param request - AI execution request
   * @returns AI execution result
   * @throws Error if execution fails
   */
  execute(request: AIExecutionRequest): Promise<AIExecutionResult>;

  /**
   * Execute AI request with tool metadata support.
   *
   * This method is contract-only in AGENT-HARNESS-02A:
   * - maps tool declarations for provider APIs
   * - parses provider tool call metadata
   * - does NOT execute tools or run a loop
   */
  executeWithTools?(
    request: AIExecutionRequest,
    options?: AIAdapterToolUseRequestOptions,
  ): Promise<AIAdapterToolUseResult>;
}
