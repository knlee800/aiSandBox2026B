import { AIExecutionController } from '../ai-execution.controller';

describe('AIExecutionController provider/model selection (ADV-01-01)', () => {
  const makeController = (overrides?: {
    writeExecutionIntent?: jest.Mock;
    enqueueExecution?: jest.Mock;
  }) => {
    const usageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      reuseExecutionIntent: jest.fn(),
      writeExecutionIntent:
        overrides?.writeExecutionIntent ?? jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution:
        overrides?.enqueueExecution ?? jest.fn().mockResolvedValue(undefined),
    };

    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
      { getByUserId: jest.fn().mockResolvedValue(null) } as any,
    );

    return { controller, usageLedgerService, queueService };
  };

  it('routes execution using request-selected provider/model', async () => {
    const { controller, usageLedgerService, queueService } = makeController();
    const identity = {
      userId: 'user-1',
      apiKeyId: 'key-1',
      scopes: ['ai:execute'],
    };

    const result = await controller.execute(
      {
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'untrusted',
        prompt: 'hello',
        provider: 'openai',
        model: 'gpt-4o',
      },
      identity as any,
    );

    expect(result.status).toBe('queued');
    expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        adapter: 'openai',
      }),
    );
    expect(queueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        adapter: 'openai',
        model: 'gpt-4o',
      }),
    );
  });

  it('keeps default single-model behavior when provider/model are omitted', async () => {
    const previous = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = 'xai';
    const { controller, queueService } = makeController();
    const identity = {
      userId: 'user-1',
      apiKeyId: 'key-1',
      scopes: ['ai:execute'],
    };

    await controller.execute(
      {
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'untrusted',
        prompt: 'hello',
      },
      identity as any,
    );

    expect(queueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'xai',
        model: undefined,
      }),
    );
    process.env.AI_PROVIDER = previous;
  });
});
