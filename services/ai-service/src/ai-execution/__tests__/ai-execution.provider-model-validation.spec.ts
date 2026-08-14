import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { AIExecutionService } from '../ai-execution.service';
import { AIExecutionRequest, AIExecutionResult } from '../types';
import { XAIAdapter } from '../adapters/xai-ai.adapter';
import { AnthropicAdapter } from '../adapters/anthropic-ai.adapter';

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
