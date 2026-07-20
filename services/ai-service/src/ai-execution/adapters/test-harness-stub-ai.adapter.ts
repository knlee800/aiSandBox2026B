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
 * Default mode (AGENT_HARNESS_STUB_WRITE_MODE absent or false):
 *   iteration 0 → list_files({ path: '.' })
 *   iteration 1 → read_file({ path: 'README.md' })
 *   iteration 2+ → finishReason: 'completed', no tool calls
 *
 * Write mode (AGENT_HARNESS_STUB_WRITE_MODE=true):
 *   iteration 0 → write_file({ path: 'canary-write-test.md', content: ... })
 *   iteration 1 → read_file({ path: 'canary-write-test.md' })
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

  private readonly writeMode: boolean;
  private callIndex = 0;

  constructor() {
    this.writeMode = process.env.AGENT_HARNESS_STUB_WRITE_MODE === 'true';
  }

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

    if (this.writeMode) {
      return this.executeWriteMode(iteration);
    }

    return this.executeDefaultMode(iteration);
  }

  private executeDefaultMode(iteration: number): AIAdapterToolUseResult {
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

  private executeWriteMode(iteration: number): AIAdapterToolUseResult {
    if (iteration === 0) {
      const content = `# Write Canary\nTimestamp: ${new Date().toISOString()}\nAgent: test-harness-stub\n`;
      const toolCall: AIAdapterToolCallMetadata = {
        callId: `test-harness-write-call-${iteration}`,
        toolName: 'write_file',
        arguments: { path: 'canary-write-test.md', content },
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
        callId: `test-harness-write-call-${iteration}`,
        toolName: 'read_file',
        arguments: { path: 'canary-write-test.md' },
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
      output: '[TEST-HARNESS-STUB] write canary complete — deterministic sequence finished',
      tokensUsed: 0,
      model: this.model,
      finishReason: 'completed',
      toolCalls: [],
    };
  }
}
