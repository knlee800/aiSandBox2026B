import { AIExecutionController } from '../ai-execution.controller';

describe('AIExecutionController.getExecution fileActions', () => {
  const makeController = (executionResultService: { getExecution: jest.Mock }) =>
    new AIExecutionController(
      {} as any,
      {} as any,
      {} as any,
      executionResultService as any,
      {} as any,
    );

  it('returns additive fileActions for completed execution', async () => {
    const executionResultService = {
      getExecution: jest.fn().mockResolvedValue({
        execution_id: 'exec-1',
        execution_status: 'completed',
        provider: 'openai',
        model: 'gpt-4o',
        tokens_used: 12,
        metadata: {
          aiExecutionResult: {
            output: 'text response',
            provider: 'openai',
            model: 'gpt-4o',
            fileActions: [
              { action: 'create', path: 'src/a.ts', content: 'a' },
              { action: 'write', path: 'src/b.ts', content: 'b' },
            ],
          },
        },
      }),
    };

    const controller = makeController(executionResultService);
    const result = await controller.getExecution('exec-1');

    expect(result).toEqual({
      executionId: 'exec-1',
      status: 'completed',
      tokensUsed: 12,
      output: 'text response',
      provider: 'openai',
      model: 'gpt-4o',
      fileActions: [
        { action: 'create', path: 'src/a.ts', content: 'a' },
        { action: 'write', path: 'src/b.ts', content: 'b' },
      ],
    });
  });

  it('returns delete fileActions for completed execution without content', async () => {
    const executionResultService = {
      getExecution: jest.fn().mockResolvedValue({
        execution_id: 'exec-delete',
        execution_status: 'completed',
        tokens_used: 3,
        metadata: {
          aiExecutionResult: {
            output: 'delete response',
            fileActions: [{ action: 'delete', path: 'delete-test.html' }],
          },
        },
      }),
    };

    const controller = makeController(executionResultService);
    const result = await controller.getExecution('exec-delete');

    expect(result.fileActions).toEqual([{ action: 'delete', path: 'delete-test.html' }]);
  });

  it('returns mixed create and delete fileActions for completed execution', async () => {
    const executionResultService = {
      getExecution: jest.fn().mockResolvedValue({
        execution_id: 'exec-mixed',
        execution_status: 'completed',
        tokens_used: 7,
        metadata: {
          aiExecutionResult: {
            output: 'mixed response',
            fileActions: [
              { action: 'create', path: 'src/a.ts', content: 'a' },
              { action: 'delete', path: 'src/old.ts' },
            ],
          },
        },
      }),
    };

    const controller = makeController(executionResultService);
    const result = await controller.getExecution('exec-mixed');

    expect(result.fileActions).toEqual([
      { action: 'create', path: 'src/a.ts', content: 'a' },
      { action: 'delete', path: 'src/old.ts' },
    ]);
  });

  it('rejects non-delete fileActions without content while preserving delete actions', async () => {
    const executionResultService = {
      getExecution: jest.fn().mockResolvedValue({
        execution_id: 'exec-invalid',
        execution_status: 'completed',
        tokens_used: 2,
        metadata: {
          aiExecutionResult: {
            output: 'invalid response',
            fileActions: [
              { action: 'write', path: 'src/missing.ts' },
              { action: 'delete', path: 'src/old.ts' },
            ],
          },
        },
      }),
    };

    const controller = makeController(executionResultService);
    const result = await controller.getExecution('exec-invalid');

    expect(result.fileActions).toEqual([{ action: 'delete', path: 'src/old.ts' }]);
  });

  it('returns empty fileActions when metadata does not contain them', async () => {
    const executionResultService = {
      getExecution: jest.fn().mockResolvedValue({
        execution_id: 'exec-2',
        execution_status: 'completed',
        tokens_used: 4,
        metadata: {},
      }),
    };

    const controller = makeController(executionResultService);
    const result = await controller.getExecution('exec-2');

    expect(result.fileActions).toEqual([]);
    expect(result.tokensUsed).toBe(4);
  });
});
