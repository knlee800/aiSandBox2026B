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

describe('TestToolCapableStubAdapter write mode', () => {
  const originalEnv = process.env.AGENT_HARNESS_STUB_WRITE_MODE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AGENT_HARNESS_STUB_WRITE_MODE;
    } else {
      process.env.AGENT_HARNESS_STUB_WRITE_MODE = originalEnv;
    }
  });

  describe('write mode: iteration 0 returns write_file tool call', () => {
    it('should emit write_file on first call when AGENT_HARNESS_STUB_WRITE_MODE=true', async () => {
      process.env.AGENT_HARNESS_STUB_WRITE_MODE = 'true';
      const adapter = new TestToolCapableStubAdapter();
      const result = await adapter.executeWithTools(REQUEST);
      expect(result.finishReason).toBe('tool_calls');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].toolName).toBe('write_file');
      expect(result.toolCalls[0].providerKind).toBe('stub');
      expect(result.toolCalls[0].callId).toContain('test-harness-write-call-');
    });
  });

  describe('write mode: iteration 1 returns read_file for canary file', () => {
    it('should emit read_file for canary-write-test.md on second call', async () => {
      process.env.AGENT_HARNESS_STUB_WRITE_MODE = 'true';
      const adapter = new TestToolCapableStubAdapter();
      await adapter.executeWithTools(REQUEST);
      const result = await adapter.executeWithTools(REQUEST, { toolResults: [] });
      expect(result.finishReason).toBe('tool_calls');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].toolName).toBe('read_file');
      expect(result.toolCalls[0].arguments).toEqual({ path: 'canary-write-test.md' });
    });
  });

  describe('write mode: iteration 2 returns completed', () => {
    it('should return completed with no tool calls on third call', async () => {
      process.env.AGENT_HARNESS_STUB_WRITE_MODE = 'true';
      const adapter = new TestToolCapableStubAdapter();
      await adapter.executeWithTools(REQUEST);
      await adapter.executeWithTools(REQUEST, { toolResults: [] });
      const result = await adapter.executeWithTools(REQUEST, { toolResults: [] });
      expect(result.finishReason).toBe('completed');
      expect(result.toolCalls).toEqual([]);
      expect(result.output).toContain('write canary complete');
    });
  });

  describe('write mode: content includes timestamp and agent identifier', () => {
    it('should include ISO timestamp and agent name in write_file content', async () => {
      process.env.AGENT_HARNESS_STUB_WRITE_MODE = 'true';
      const adapter = new TestToolCapableStubAdapter();
      const result = await adapter.executeWithTools(REQUEST);
      const content = result.toolCalls[0].arguments.content as string;
      expect(content).toContain('# Write Canary');
      expect(content).toContain('Timestamp:');
      expect(content).toContain('Agent: test-harness-stub');
      expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('write mode: canary file path is canary-write-test.md', () => {
    it('should use path canary-write-test.md for write_file call', async () => {
      process.env.AGENT_HARNESS_STUB_WRITE_MODE = 'true';
      const adapter = new TestToolCapableStubAdapter();
      const result = await adapter.executeWithTools(REQUEST);
      expect(result.toolCalls[0].arguments.path).toBe('canary-write-test.md');
    });
  });

  describe('default mode: unchanged behavior when AGENT_HARNESS_STUB_WRITE_MODE is not set', () => {
    it('should emit list_files on first call when env is not set', async () => {
      delete process.env.AGENT_HARNESS_STUB_WRITE_MODE;
      const adapter = new TestToolCapableStubAdapter();
      const result = await adapter.executeWithTools(REQUEST);
      expect(result.toolCalls[0].toolName).toBe('list_files');
    });

    it('should emit list_files on first call when env is false', async () => {
      process.env.AGENT_HARNESS_STUB_WRITE_MODE = 'false';
      const adapter = new TestToolCapableStubAdapter();
      const result = await adapter.executeWithTools(REQUEST);
      expect(result.toolCalls[0].toolName).toBe('list_files');
    });
  });

  describe('write mode: zero tokens and correct model', () => {
    it('all write-mode calls should report zero tokens and correct model', async () => {
      process.env.AGENT_HARNESS_STUB_WRITE_MODE = 'true';
      const adapter = new TestToolCapableStubAdapter();
      const r0 = await adapter.executeWithTools(REQUEST);
      const r1 = await adapter.executeWithTools(REQUEST, { toolResults: [] });
      const r2 = await adapter.executeWithTools(REQUEST, { toolResults: [] });
      for (const r of [r0, r1, r2]) {
        expect(r.tokensUsed).toBe(0);
        expect(r.model).toBe('test-harness-stub');
      }
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
