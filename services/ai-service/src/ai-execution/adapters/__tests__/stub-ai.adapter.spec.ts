import { StubAIAdapter } from '../stub-ai.adapter';
import { AGENT_HARNESS_TOOL_DEFINITIONS_V1 } from '../../../agent-harness/tools/tool-registry';

describe('StubAIAdapter', () => {
  const adapter = new StubAIAdapter();

  it('should report tool-use support as disabled', () => {
    expect(adapter.supportsToolUse).toBe(false);
  });

  it('should return deterministic inert metadata for executeWithTools()', async () => {
    const result = await adapter.executeWithTools(
      {
        sessionId: 'session-1',
        conversationId: 'conversation-1',
        userId: 'user-1',
        prompt: 'Test prompt',
        provider: 'stub',
      },
      {
        tools: [AGENT_HARNESS_TOOL_DEFINITIONS_V1[0]],
      },
    );

    expect(result).toEqual({
      output: '[STUB] AI execution not implemented yet',
      tokensUsed: 0,
      model: 'stub',
      finishReason: 'completed',
      toolCalls: [],
    });
  });
});

