import { TestToolCapableStubAdapter } from '../test-harness-stub-ai.adapter';
import { StubAIAdapter } from '../stub-ai.adapter';
import { AIExecutionRequest } from '../../types';
import type { AIAdapterToolUseResult } from '../adapter-tool-use.contracts';

const REQUEST: AIExecutionRequest = {
  sessionId: 'test-session-1',
  conversationId: 'test-conv-1',
  userId: 'test-user-1',
  prompt: 'canary prompt',
  provider: 'test-harness-stub',
};

describe('TestToolCapableStubAdapter', () => {
  describe('adapter identity', () => {
    it('should have model = "test-harness-stub"', () => {
      const adapter = new TestToolCapableStubAdapter();
      expect(adapter.model).toBe('test-harness-stub');
    });

    it('should have supportsToolUse = true', () => {
      const adapter = new TestToolCapableStubAdapter();
      expect(adapter.supportsToolUse).toBe(true);
    });

    it('should have executeWithTools method', () => {
      const adapter = new TestToolCapableStubAdapter();
      expect(typeof adapter.executeWithTools).toBe('function');
    });
  });

  describe('normal stub remains unchanged', () => {
    it('StubAIAdapter should still have supportsToolUse = false', () => {
      const stub = new StubAIAdapter();
      expect(stub.supportsToolUse).toBe(false);
    });

    it('StubAIAdapter.executeWithTools should still return empty toolCalls', async () => {
      const stub = new StubAIAdapter();
      const result = await stub.executeWithTools({
        sessionId: 's',
        conversationId: 'c',
        userId: 'u',
        prompt: 'p',
        provider: 'stub',
      });
      expect(result.toolCalls).toEqual([]);
      expect(result.finishReason).toBe('completed');
    });
  });

  describe('execute()', () => {
    it('should return deterministic result with zero tokens', async () => {
      const adapter = new TestToolCapableStubAdapter();
      const result = await adapter.execute(REQUEST);
      expect(result.output).toContain('TEST-HARNESS-STUB');
      expect(result.tokensUsed).toBe(0);
      expect(result.model).toBe('test-harness-stub');
    });
  });

  describe('deterministic tool-call sequence', () => {
    let adapter: TestToolCapableStubAdapter;
    let results: AIAdapterToolUseResult[];

    beforeAll(async () => {
      adapter = new TestToolCapableStubAdapter();
      results = [];
      results.push(await adapter.executeWithTools(REQUEST));
      results.push(await adapter.executeWithTools(REQUEST, { toolResults: [] }));
      results.push(await adapter.executeWithTools(REQUEST, { toolResults: [] }));
    });

    it('first call should return list_files tool call', () => {
      const r = results[0];
      expect(r.finishReason).toBe('tool_calls');
      expect(r.toolCalls).toHaveLength(1);
      expect(r.toolCalls[0].toolName).toBe('list_files');
      expect(r.toolCalls[0].arguments).toEqual({ path: '.' });
      expect(r.toolCalls[0].providerKind).toBe('stub');
      expect(r.toolCalls[0].callId).toContain('test-harness-call-');
    });

    it('second call should return read_file tool call', () => {
      const r = results[1];
      expect(r.finishReason).toBe('tool_calls');
      expect(r.toolCalls).toHaveLength(1);
      expect(r.toolCalls[0].toolName).toBe('read_file');
      expect(r.toolCalls[0].arguments).toEqual({ path: 'README.md' });
      expect(r.toolCalls[0].providerKind).toBe('stub');
    });

    it('third call should return completed with no tool calls', () => {
      const r = results[2];
      expect(r.finishReason).toBe('completed');
      expect(r.toolCalls).toEqual([]);
      expect(r.output).toContain('canary complete');
    });

    it('all calls should report zero tokens', () => {
      for (const r of results) {
        expect(r.tokensUsed).toBe(0);
      }
    });

    it('all calls should report model = test-harness-stub', () => {
      for (const r of results) {
        expect(r.model).toBe('test-harness-stub');
      }
    });
  });

  describe('beyond-sequence calls stay completed', () => {
    it('fourth and fifth calls should also return completed', async () => {
      const adapter = new TestToolCapableStubAdapter();
      await adapter.executeWithTools(REQUEST);
      await adapter.executeWithTools(REQUEST);
      await adapter.executeWithTools(REQUEST);
      const fourth = await adapter.executeWithTools(REQUEST);
      const fifth = await adapter.executeWithTools(REQUEST);
      expect(fourth.finishReason).toBe('completed');
      expect(fourth.toolCalls).toEqual([]);
      expect(fifth.finishReason).toBe('completed');
      expect(fifth.toolCalls).toEqual([]);
    });
  });

  describe('no external provider clients', () => {
    it('should not import or instantiate Anthropic client', () => {
      const adapter = new TestToolCapableStubAdapter();
      expect((adapter as any).client).toBeUndefined();
      expect((adapter as any).anthropic).toBeUndefined();
    });

    it('should not import or instantiate OpenAI client', () => {
      const adapter = new TestToolCapableStubAdapter();
      expect((adapter as any).openai).toBeUndefined();
    });

    it('should not require any API key', () => {
      expect(() => new TestToolCapableStubAdapter()).not.toThrow();
    });
  });
});

describe('Provider routing supports test-harness-stub', () => {
  it('AIExecutionService.getAdapter returns TestToolCapableStubAdapter for test-harness-stub', async () => {
    const { AIExecutionService } = await import('../../ai-execution.service');
    const mockConfigService = { get: jest.fn() } as any;
    const service = new AIExecutionService(mockConfigService);
    const adapter = service.getAdapter('test-harness-stub');
    expect(adapter).toBeInstanceOf(TestToolCapableStubAdapter);
    expect(adapter.supportsToolUse).toBe(true);
    expect(adapter.model).toBe('test-harness-stub');
  });

  it('AIExecutionService.getAdapter still returns StubAIAdapter for stub', async () => {
    const { AIExecutionService } = await import('../../ai-execution.service');
    const mockConfigService = { get: jest.fn() } as any;
    const service = new AIExecutionService(mockConfigService);
    const adapter = service.getAdapter('stub');
    expect(adapter).toBeInstanceOf(StubAIAdapter);
    expect(adapter.supportsToolUse).toBe(false);
  });
});
