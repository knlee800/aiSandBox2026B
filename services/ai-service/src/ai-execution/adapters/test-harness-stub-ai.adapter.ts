import { Logger } from '@nestjs/common';
import { AIAdapter } from './ai-adapter.interface';
import { AIExecutionRequest, AIExecutionResult } from '../types';
import type {
  AIAdapterToolUseRequestOptions,
  AIAdapterToolUseResult,
  AIAdapterToolCallMetadata,
} from './adapter-tool-use.contracts';

/**
 * TestToolCapableStubAdapter
 *
 * AGENT-HARNESS-06D: Test-only adapter with `supportsToolUse = true`.
 *
 * Returns a deterministic tool-call sequence:
 *   iteration 0 → list_files({ path: '.' })
 *   iteration 1 → read_file({ path: 'README.md' })
 *   iteration 2+ → finishReason: 'completed', no tool calls
 *
 * Makes zero external API calls. Zero billing. Zero network I/O.
 * Exists solely so the live Worker → Harness → ToolDispatcher path
 * can be exercised without touching a paid provider.
 */
export class TestToolCapableStubAdapter implements AIAdapter {
  private readonly logger = new Logger(TestToolCapableStubAdapter.name);

  readonly model = 'test-harness-stub';
  readonly supportsToolUse = true;

  private callIndex = 0;

  async execute(request: AIExecutionRequest): Promise<AIExecutionResult> {
    this.logger.debug(
      `TestToolCapableStubAdapter.execute() called for session=${request.sessionId}`,
    );
    return {
      output: '[TEST-HARNESS-STUB] deterministic stub — no external API call',
      tokensUsed: 0,
      model: this.model,
    };
  }

  async executeWithTools(
    request: AIExecutionRequest,
    _options?: AIAdapterToolUseRequestOptions,
  ): Promise<AIAdapterToolUseResult> {
    const iteration = this.callIndex++;

    if (iteration === 0) {
      const toolCall: AIAdapterToolCallMetadata = {
        callId: `test-harness-call-${iteration}`,
        toolName: 'list_files',
        arguments: { path: '.' },
        providerKind: 'stub',
      };
      return {
        output: '',
        tokensUsed: 0,
        model: this.model,
        finishReason: 'tool_calls',
        toolCalls: [toolCall],
      };
    }

    if (iteration === 1) {
      const toolCall: AIAdapterToolCallMetadata = {
        callId: `test-harness-call-${iteration}`,
        toolName: 'read_file',
        arguments: { path: 'README.md' },
        providerKind: 'stub',
      };
      return {
        output: '',
        tokensUsed: 0,
        model: this.model,
        finishReason: 'tool_calls',
        toolCalls: [toolCall],
      };
    }

    return {
      output: '[TEST-HARNESS-STUB] canary complete — deterministic sequence finished',
      tokensUsed: 0,
      model: this.model,
      finishReason: 'completed',
      toolCalls: [],
    };
  }
}
