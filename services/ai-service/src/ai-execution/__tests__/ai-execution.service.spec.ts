import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  AIExecutionService,
  KEYED_PROVIDER_IDS,
  KeyedProviderId,
} from '../ai-execution.service';
import { ProviderKeyMissingError } from '../provider-key-missing.error';
import { StubAIAdapter } from '../adapters/stub-ai.adapter';
import { AnthropicAdapter } from '../adapters/anthropic-ai.adapter';
import { OpenAIAdapter } from '../adapters/openai-ai.adapter';
import { GroqAdapter } from '../adapters/groq-ai.adapter';
import { XAIAdapter } from '../adapters/xai-ai.adapter';
import { DeepSeekAdapter } from '../adapters/deepseek-ai.adapter';
import { AIExecutionModule } from '../ai-execution.module';
import { AIExecutionRequest } from '../types';

/**
 * Stage C2-E: Verification Harness for AIExecutionService
 *
 * Purpose:
 * Verify that AIExecutionService correctly delegates to the injected adapter.
 *
 * What is verified:
 * 1. AIExecutionService can be resolved by NestJS DI
 * 2. execute() correctly delegates to the injected adapter
 * 3. The stub adapter is actually used at runtime
 * 4. Returned result matches the expected stub output
 *
 * This is a verification test only - no production behavior is added.
 */
describe('AIExecutionService (Stage C2-E Verification)', () => {
  let service: AIExecutionService;
  let module: TestingModule;

  beforeAll(async () => {
    // Create testing module with AIExecutionModule and ConfigModule
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AIExecutionModule,
      ],
    }).compile();

    // Resolve AIExecutionService from DI container
    service = module.get<AIExecutionService>(AIExecutionService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('execute()', () => {
    it('should delegate to stub adapter and return deterministic result', async () => {
      // Arrange: Create a mock AIExecutionRequest
      const request: AIExecutionRequest = {
        sessionId: 'test-session-123',
        conversationId: 'test-conversation-456',
        userId: 'test-user-789',
        prompt: 'Test prompt for verification',
        provider: 'stub',
        metadata: { test: true },
      };

      // Act: Call execute()
      const result = await service.execute(request);

      // Assert: Verify stub adapter response
      expect(result).toBeDefined();
      expect(result.model).toBe('stub');
      expect(result.tokensUsed).toBe(0);
      expect(result.output).toContain('[STUB]');
      expect(result.output).toBe('[STUB] AI execution not implemented yet');
    });

    it('should return consistent results across multiple calls', async () => {
      // Arrange: Create two identical requests
      const request1: AIExecutionRequest = {
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        prompt: 'First prompt',
        provider: 'stub',
      };

      const request2: AIExecutionRequest = {
        sessionId: 'session-2',
        conversationId: 'conv-2',
        userId: 'user-2',
        prompt: 'Second prompt',
        provider: 'stub',
      };

      // Act: Call execute() twice
      const result1 = await service.execute(request1);
      const result2 = await service.execute(request2);

      // Assert: Both results should be identical (deterministic stub)
      expect(result1.model).toBe(result2.model);
      expect(result1.tokensUsed).toBe(result2.tokensUsed);
      expect(result1.output).toBe(result2.output);

      // Assert: All stub characteristics present
      expect(result1.model).toBe('stub');
      expect(result2.model).toBe('stub');
      expect(result1.tokensUsed).toBe(0);
      expect(result2.tokensUsed).toBe(0);
    });
  });
});

describe('AIExecutionService provider keys (PROVIDER-KEY-01)', () => {
  const keyed: Array<{ provider: KeyedProviderId; variable: string; adapter: Function }> = [
    { provider: 'xai', variable: 'XAI_API_KEY', adapter: XAIAdapter },
    { provider: 'groq', variable: 'GROQ_API_KEY', adapter: GroqAdapter },
    { provider: 'deepseek', variable: 'DEEPSEEK_API_KEY', adapter: DeepSeekAdapter },
    { provider: 'openai', variable: 'OPENAI_API_KEY', adapter: OpenAIAdapter },
    { provider: 'anthropic', variable: 'ANTHROPIC_API_KEY', adapter: AnthropicAdapter },
  ];
  const marker = 'provider-key-01-marker-value-zzz';

  function serviceWith(values: Record<string, unknown>): AIExecutionService {
    // The Anthropic default model comes from ANTHROPIC_MODEL; it is not a key.
    const all: Record<string, unknown> = { ANTHROPIC_MODEL: 'claude-test-model', ...values };
    const config = { get: jest.fn((name: string) => all[name]) } as unknown as ConfigService;
    return new AIExecutionService(config);
  }

  describe.each(keyed)('$provider', ({ provider, variable, adapter }) => {
    it.each([
      ['no key', undefined],
      ['an empty key', ''],
      ['a blank key', '   '],
      ['a non-string key', 42],
    ])('throws ProviderKeyMissingError with %s', (_label, value) => {
      const service = serviceWith(value === undefined ? {} : { [variable]: value });
      let thrown: unknown;
      try {
        service.getAdapter(provider);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(ProviderKeyMissingError);
      const typed = thrown as ProviderKeyMissingError;
      expect(typed.code).toBe('provider_key_missing');
      expect(typed.message).toBe('AI provider is not configured');
      expect(typed.message).not.toContain(variable);
      expect(typed.message).not.toMatch(/key/i);
    });

    it('fails before any provider call when execute names it without a key', async () => {
      const service = serviceWith({});
      await expect(
        service.execute({
          sessionId: 's',
          conversationId: 'c',
          userId: 'u',
          prompt: 'p',
          provider,
        }),
      ).rejects.toBeInstanceOf(ProviderKeyMissingError);
    });

    it('builds the adapter as before when the key is set', () => {
      const service = serviceWith({ [variable]: marker });
      expect(service.getAdapter(provider)).toBeInstanceOf(adapter);
    });
  });

  it('builds the stub adapter with no keys at all', () => {
    expect(serviceWith({}).getAdapter('stub')).toBeInstanceOf(StubAIAdapter);
  });

  it('answers availability as booleans that follow the configured keys, in fixed order', () => {
    const service = serviceWith({
      XAI_API_KEY: marker,
      GROQ_API_KEY: '',
      DEEPSEEK_API_KEY: '   ',
      ANTHROPIC_API_KEY: marker,
    });
    const availability = service.getProviderKeyAvailability();
    expect(availability).toEqual({
      xai: true,
      groq: false,
      deepseek: false,
      openai: false,
      anthropic: true,
    });
    expect(Object.keys(availability)).toEqual([...KEYED_PROVIDER_IDS]);
    expect(Object.keys(availability)).not.toContain('stub');
    for (const value of Object.values(availability)) {
      expect(typeof value).toBe('boolean');
    }
    expect(JSON.stringify(availability)).not.toContain(marker);
  });

  it('answers all false with no keys', () => {
    expect(Object.values(serviceWith({}).getProviderKeyAvailability())).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});
