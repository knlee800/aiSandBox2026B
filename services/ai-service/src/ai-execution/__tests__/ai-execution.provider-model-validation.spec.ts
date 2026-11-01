import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { AIExecutionService } from '../ai-execution.service';
import { AIExecutionRequest, AIExecutionResult } from '../types';
import { XAIAdapter } from '../adapters/xai-ai.adapter';
import { AnthropicAdapter } from '../adapters/anthropic-ai.adapter';
import { OpenAIAdapter } from '../adapters/openai-ai.adapter';
import { DeepSeekAdapter } from '../adapters/deepseek-ai.adapter';

describe('AIExecutionService provider/model validation', () => {
  let service: AIExecutionService;
  let module: TestingModule;

  const baseRequest: AIExecutionRequest = {
    sessionId: 'session-validate',
    conversationId: 'conv-validate',
    userId: 'user-validate',
    prompt: 'Validation request',
    provider: 'xai',
  };

  beforeEach(async () => {
    delete process.env.XAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [AIExecutionService],
    }).compile();

    service = module.get<AIExecutionService>(AIExecutionService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await module.close();
  });

  it('rejects grok-4.20 before adapter selection/execution and does not fall back to grok-4.5', async () => {
    const getAdapterSpy = jest.spyOn(service as any, 'getAdapter');
    const executeSpy = jest.spyOn(XAIAdapter.prototype, 'execute');

    await expect(
      service.execute({
        ...baseRequest,
        provider: 'xai',
        model: 'grok-4.20',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(getAdapterSpy).not.toHaveBeenCalled();
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('accepts grok-4.5 without substituting another model', async () => {
    process.env.XAI_API_KEY = 'xai-test-key';
    const adapterResult: AIExecutionResult = {
      output: 'ok',
      tokensUsed: 1,
      model: 'grok-4.5',
    };
    const executeSpy = jest
      .spyOn(XAIAdapter.prototype, 'execute')
      .mockResolvedValue(adapterResult);

    await service.execute({
      ...baseRequest,
      provider: 'xai',
      model: 'grok-4.5',
    });

    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'xai',
        model: 'grok-4.5',
      }),
    );
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid xAI model before adapter selection/execution', async () => {
    const getAdapterSpy = jest.spyOn(service as any, 'getAdapter');
    const executeSpy = jest.spyOn(XAIAdapter.prototype, 'execute');

    await expect(
      service.execute({
        ...baseRequest,
        provider: 'xai',
        model: 'grok-3',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(getAdapterSpy).not.toHaveBeenCalled();
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('resolves omitted xAI model to grok-4.5', async () => {
    process.env.XAI_API_KEY = 'xai-test-key';
    const adapterResult: AIExecutionResult = {
      output: 'ok',
      tokensUsed: 1,
      model: 'grok-4.5',
    };
    const executeSpy = jest
      .spyOn(XAIAdapter.prototype, 'execute')
      .mockResolvedValue(adapterResult);

    await service.execute({
      ...baseRequest,
      provider: 'xai',
      model: undefined,
    });

    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'xai',
        model: 'grok-4.5',
      }),
    );
  });

  it('fails Anthropic with missing ANTHROPIC_MODEL before adapter execute', async () => {
    process.env.ANTHROPIC_API_KEY = 'anthropic-test-key';
    const executeSpy = jest.spyOn(AnthropicAdapter.prototype, 'execute');

    await expect(
      service.execute({
        ...baseRequest,
        provider: 'anthropic',
      }),
    ).rejects.toThrow(
      'ANTHROPIC_MODEL environment variable is required when provider is "anthropic"',
    );

    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('accepts each newly allowed model and passes it to the adapter', async () => {
    process.env.XAI_API_KEY = 'xai-test-key';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.DEEPSEEK_API_KEY = 'deepseek-test-key';
    process.env.ANTHROPIC_API_KEY = 'anthropic-test-key';

    const adapterResult: AIExecutionResult = {
      output: 'ok',
      tokensUsed: 1,
      model: 'accepted',
    };
    const xaiExecute = jest
      .spyOn(XAIAdapter.prototype, 'execute')
      .mockResolvedValue(adapterResult);
    const openaiExecute = jest
      .spyOn(OpenAIAdapter.prototype, 'execute')
      .mockResolvedValue(adapterResult);
    const deepseekExecute = jest
      .spyOn(DeepSeekAdapter.prototype, 'execute')
      .mockResolvedValue(adapterResult);
    const anthropicExecute = jest
      .spyOn(AnthropicAdapter.prototype, 'execute')
      .mockResolvedValue(adapterResult);

    const accepted: Array<[AIExecutionRequest['provider'], string]> = [
      ['xai', 'grok-4.7'],
      ['openai', 'gpt-6.1-sol'],
      ['openai', 'gpt-6-astra'],
      ['openai', 'gpt-6.1-terra'],
      ['openai', 'gpt-6-luna'],
      ['deepseek', 'deepseek-flash'],
      ['deepseek', 'deepseek-v4-pro'],
      ['deepseek', 'deepseek-v4-flash'],
      ['anthropic', 'claude-opus-5-5'],
      ['anthropic', 'claude-sonnet-5-5'],
      ['anthropic', 'claude-fable-5-1'],
      ['anthropic', 'claude-haiku-5-5'],
    ];

    for (const [provider, model] of accepted) {
      await service.execute({
        ...baseRequest,
        provider,
        model,
      });
    }

    expect(xaiExecute).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'xai', model: 'grok-4.7' }),
    );
    for (const model of ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6.1-terra', 'gpt-6-luna']) {
      expect(openaiExecute).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'openai', model }),
      );
    }
    for (const model of ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-v4-flash']) {
      expect(deepseekExecute).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'deepseek', model }),
      );
    }
    for (const model of [
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'claude-fable-5-1',
      'claude-haiku-5-5',
    ]) {
      expect(anthropicExecute).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'anthropic', model }),
      );
    }
  });

  it('resolves omitted DeepSeek model to deepseek-flash and still accepts deepseek-v4-flash', async () => {
    process.env.DEEPSEEK_API_KEY = 'deepseek-test-key';
    const adapterResult: AIExecutionResult = {
      output: 'ok',
      tokensUsed: 1,
      model: 'deepseek-flash',
    };
    const executeSpy = jest
      .spyOn(DeepSeekAdapter.prototype, 'execute')
      .mockResolvedValue(adapterResult);

    await service.execute({
      ...baseRequest,
      provider: 'deepseek',
      model: undefined,
    });
    await service.execute({
      ...baseRequest,
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
    });

    expect(executeSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ provider: 'deepseek', model: 'deepseek-flash' }),
    );
    expect(executeSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
      }),
    );
  });

  it('accepts a listed Anthropic model without ANTHROPIC_MODEL', async () => {
    process.env.ANTHROPIC_API_KEY = 'anthropic-test-key';
    const adapterResult: AIExecutionResult = {
      output: 'ok',
      tokensUsed: 1,
      model: 'claude-sonnet-5-5',
    };
    const executeSpy = jest
      .spyOn(AnthropicAdapter.prototype, 'execute')
      .mockResolvedValue(adapterResult);

    await service.execute({
      ...baseRequest,
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
    });

    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'anthropic',
        model: 'claude-sonnet-5-5',
      }),
    );
  });

  it('accepts an Anthropic model equal to ANTHROPIC_MODEL when it is not on the list', async () => {
    process.env.ANTHROPIC_API_KEY = 'anthropic-test-key';
    process.env.ANTHROPIC_MODEL = 'claude-env-only';
    const adapterResult: AIExecutionResult = {
      output: 'ok',
      tokensUsed: 1,
      model: 'claude-env-only',
    };
    const executeSpy = jest
      .spyOn(AnthropicAdapter.prototype, 'execute')
      .mockResolvedValue(adapterResult);

    await service.execute({
      ...baseRequest,
      provider: 'anthropic',
      model: 'claude-env-only',
    });

    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'anthropic',
        model: 'claude-env-only',
      }),
    );
  });

  it('rejects an unlisted Anthropic model and an unknown model before adapter execution', async () => {
    const anthropicExecute = jest.spyOn(AnthropicAdapter.prototype, 'execute');
    const openaiExecute = jest.spyOn(OpenAIAdapter.prototype, 'execute');

    await expect(
      service.execute({
        ...baseRequest,
        provider: 'anthropic',
        model: 'claude-other',
      }),
    ).rejects.toThrow('Model "claude-other" is not valid for provider "anthropic".');

    await expect(
      service.execute({
        ...baseRequest,
        provider: 'openai',
        model: 'unknown-model',
      }),
    ).rejects.toThrow('Model "unknown-model" is not valid for provider "openai".');

    expect(anthropicExecute).not.toHaveBeenCalled();
    expect(openaiExecute).not.toHaveBeenCalled();
  });

  it('rejects cross-provider model mismatch before adapter execution', async () => {
    const getAdapterSpy = jest.spyOn(service as any, 'getAdapter');

    await expect(
      service.execute({
        ...baseRequest,
        provider: 'xai',
        model: 'gpt-4o',
      }),
    ).rejects.toThrow('Model "gpt-4o" is not valid for provider "xai".');

    expect(getAdapterSpy).not.toHaveBeenCalled();
  });
});
