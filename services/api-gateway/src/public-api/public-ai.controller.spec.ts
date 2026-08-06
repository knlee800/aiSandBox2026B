import { PublicAIController } from './public-ai.controller';
import { NotFoundException } from '@nestjs/common';

describe('PublicAIController', () => {
  const buildController = () => {
    const usageLedgerService = {
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    const executionResultService = {
      getExecution: jest.fn(),
    };

    return {
      controller: new PublicAIController(
        usageLedgerService as any,
        queueService as any,
        executionResultService as any,
      ),
      usageLedgerService,
      queueService,
      executionResultService,
    };
  };

  it('queues execution through dedicated public controller path', async () => {
    const { controller, usageLedgerService, queueService } = buildController();
    const identity = { userId: 'user-1', apiKeyId: 'key-1', scopes: ['ai:execute'] };

    const result = await controller.execute(
      {
        sessionId: 'session-1',
        conversationId: 'conv-1',
        prompt: 'Build a todo app',
        provider: 'openai',
        model: 'gpt-4o',
      } as any,
      identity as any,
    );

    expect(result.status).toBe('queued');
    expect(result.executionId).toBeDefined();
    expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        apiKeyId: 'key-1',
        provider: 'openai',
        adapter: 'openai',
      }),
    );
    expect(queueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        provider: 'openai',
        model: 'gpt-4o',
      }),
    );
  });

  it('returns deterministic execution contract for owned execution', async () => {
    const { controller, executionResultService } = buildController();
    executionResultService.getExecution.mockResolvedValue({
      execution_id: 'exec-1',
      execution_status: 'completed',
      user_id: 'user-1',
      provider: 'openai',
      model: 'gpt-4o',
      tokens_used: 99,
      metadata: {
        aiExecutionResult: {
          output: 'ok',
          provider: 'openai',
          model: 'gpt-4o',
        },
      },
    });

    const result = await controller.getExecution('exec-1', {
      userId: 'user-1',
      apiKeyId: 'key-1',
      scopes: ['ai:execute'],
    } as any);

    expect(result).toEqual({
      executionId: 'exec-1',
      status: 'completed',
      output: 'ok',
      provider: 'openai',
      model: 'gpt-4o',
      tokensUsed: 99,
    });
  });

  it('does not expose execution across users', async () => {
    const { controller, executionResultService } = buildController();
    executionResultService.getExecution.mockResolvedValue({
      execution_id: 'exec-1',
      execution_status: 'completed',
      user_id: 'other-user',
    });

    await expect(
      controller.getExecution('exec-1', {
        userId: 'user-1',
        apiKeyId: 'key-1',
        scopes: ['ai:execute'],
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('resolves omitted xAI model to grok-4.5', async () => {
    const { controller, queueService } = buildController();
    const identity = { userId: 'user-1', apiKeyId: 'key-1', scopes: ['ai:execute'] };

    await controller.execute(
      {
        sessionId: 'session-1',
        conversationId: 'conv-1',
        prompt: 'Build a todo app',
        provider: 'xai',
      } as any,
      identity as any,
    );

    expect(queueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'xai',
        model: 'grok-4.5',
      }),
    );
  });

  it('rejects unsupported model/provider pairs before queueing', async () => {
    const { controller, usageLedgerService, queueService } = buildController();
    const identity = { userId: 'user-1', apiKeyId: 'key-1', scopes: ['ai:execute'] };

    await expect(
      controller.execute(
        {
          sessionId: 'session-1',
          conversationId: 'conv-1',
          prompt: 'Build a todo app',
          provider: 'xai',
          model: 'grok-3',
        } as any,
        identity as any,
      ),
    ).rejects.toThrow('Model "grok-3" is not valid for provider "xai".');

    expect(usageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(queueService.enqueueExecution).not.toHaveBeenCalled();
  });
});
