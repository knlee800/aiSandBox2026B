import { AIExecutionController } from '../ai-execution.controller';
import type { AIExecutionRequest } from '../../clients/ai-service-http.client';
import type { ApiKeyIdentity } from '../../auth/api-key.config';

describe('AIExecutionController workspaceContext forwarding', () => {
  it('forwards optional workspaceContext into queued job data', async () => {
    const usageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
    );

    const request: AIExecutionRequest = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'untrusted-user',
      prompt: 'List the files in this workspace.',
      provider: 'stub',
      workspaceContext: {
        filePaths: ['README.md', 'src/app.ts'],
        selectedFilePath: 'src/app.ts',
        selectedFileContent: 'export const app = true;',
        namedFileContents: [
          {
            path: 'src/utils.ts',
            content: 'export const util = true;',
          },
        ],
        projectName: 'Sandbox Project',
        workspaceName: 'Personal',
      },
    };
    const identity: ApiKeyIdentity = {
      userId: '33333333-3333-4333-8333-333333333333',
      apiKeyId: '44444444-4444-4444-8444-444444444444',
      scopes: ['ai:execute'],
    };

    const result = await controller.execute(request, identity);

    expect(result).toEqual({
      executionId: expect.any(String),
      status: 'queued',
    });
    expect(usageLedgerService.writeExecutionIntent).toHaveBeenCalledTimes(1);
    expect(queueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: request.sessionId,
        conversationId: request.conversationId,
        prompt: request.prompt,
        workspaceContext: request.workspaceContext,
      }),
    );
  });

  it('keeps queue payload unchanged when workspaceContext is absent', async () => {
    const usageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
    );

    const request: AIExecutionRequest = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'untrusted-user',
      prompt: 'List the files in this workspace.',
      provider: 'stub',
    };
    const identity: ApiKeyIdentity = {
      userId: '33333333-3333-4333-8333-333333333333',
      apiKeyId: '44444444-4444-4444-8444-444444444444',
      scopes: ['ai:execute'],
    };

    await controller.execute(request, identity);

    expect(queueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: request.prompt,
        workspaceContext: undefined,
      }),
    );
  });
});
