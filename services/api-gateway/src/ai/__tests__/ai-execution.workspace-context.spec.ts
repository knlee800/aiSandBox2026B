import { NotFoundException } from '@nestjs/common';
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
    const userAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue(null),
    };
    const projectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue(null),
    };
    const sessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: '33333333-3333-4333-8333-333333333333',
        projectId: null,
      }),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
      userAiInstructionsService as any,
      projectAiContextService as any,
      sessionService as any,
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
        searchResults: {
          query: 'login',
          results: [{ path: 'src/app.ts', line: 12, preview: 'const login = true;' }],
          truncated: false,
        },
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
    const userAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue(null),
    };
    const projectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue(null),
    };
    const sessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: '33333333-3333-4333-8333-333333333333',
        projectId: null,
      }),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
      userAiInstructionsService as any,
      projectAiContextService as any,
      sessionService as any,
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

  it('includes trimmed globalInstructions in queued payload when user instructions exist', async () => {
    const usageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    const userAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue('  Use concise responses.  '),
    };
    const projectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue(null),
    };
    const sessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: '33333333-3333-4333-8333-333333333333',
        projectId: null,
      }),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
      userAiInstructionsService as any,
      projectAiContextService as any,
      sessionService as any,
    );

    const request: AIExecutionRequest = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'untrusted-user',
      prompt: 'Explain this file.',
      provider: 'stub',
    };
    const identity: ApiKeyIdentity = {
      userId: '33333333-3333-4333-8333-333333333333',
      apiKeyId: '44444444-4444-4444-8444-444444444444',
      scopes: ['ai:execute'],
    };

    await controller.execute(request, identity);

    expect(userAiInstructionsService.getByUserId).toHaveBeenCalledWith(
      identity.userId,
    );
    expect(queueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        globalInstructions: 'Use concise responses.',
      }),
    );
  });

  it('omits globalInstructions in queued payload when user instructions are null or whitespace', async () => {
    const usageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    const userAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue('   '),
    };
    const projectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue(null),
    };
    const sessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: '33333333-3333-4333-8333-333333333333',
        projectId: null,
      }),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
      userAiInstructionsService as any,
      projectAiContextService as any,
      sessionService as any,
    );

    const request: AIExecutionRequest = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'untrusted-user',
      prompt: 'Explain this file.',
      provider: 'stub',
    };
    const identity: ApiKeyIdentity = {
      userId: '33333333-3333-4333-8333-333333333333',
      apiKeyId: '44444444-4444-4444-8444-444444444444',
      scopes: ['ai:execute'],
    };

    await controller.execute(request, identity);

    expect(queueService.enqueueExecution).toHaveBeenCalledWith(
      expect.not.objectContaining({
        globalInstructions: expect.any(String),
      }),
    );
  });

  it('session-based identity (browser-session) fetches global instructions for the session user', async () => {
    const usageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    const userAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue('Always respond in JSON.'),
    };
    const projectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue(null),
    };
    const sessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: '4329e051-ce13-46b5-83ef-357faf749d90',
        projectId: null,
      }),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
      userAiInstructionsService as any,
      projectAiContextService as any,
      sessionService as any,
    );

    const request: AIExecutionRequest = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'untrusted-user',
      prompt: 'Generate a React component.',
      provider: 'stub',
    };
    const sessionIdentity: ApiKeyIdentity = {
      userId: '4329e051-ce13-46b5-83ef-357faf749d90',
      apiKeyId: 'browser-session',
      scopes: ['ai:execute'],
      isInternal: true,
    };

    await controller.execute(request, sessionIdentity);

    expect(userAiInstructionsService.getByUserId).toHaveBeenCalledWith(
      '4329e051-ce13-46b5-83ef-357faf749d90',
    );
    expect(queueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        globalInstructions: 'Always respond in JSON.',
        userId: '4329e051-ce13-46b5-83ef-357faf749d90',
      }),
    );
  });

  it('includes trimmed projectInstructions in queued payload when project instructions exist', async () => {
    const usageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    const userAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue(null),
    };
    const projectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue('  For this project only.  '),
    };
    const sessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: '33333333-3333-4333-8333-333333333333',
        projectId: 'project-1',
      }),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
      userAiInstructionsService as any,
      projectAiContextService as any,
      sessionService as any,
    );

    const request: AIExecutionRequest = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'untrusted-user',
      prompt: 'Explain this file.',
      provider: 'stub',
    };
    const identity: ApiKeyIdentity = {
      userId: '33333333-3333-4333-8333-333333333333',
      apiKeyId: '44444444-4444-4444-8444-444444444444',
      scopes: ['ai:execute'],
    };

    await controller.execute(request, identity);

    expect(sessionService.getSessionById).toHaveBeenCalledWith(request.sessionId);
    expect(projectAiContextService.getByProjectId).toHaveBeenCalledWith('project-1');
    expect(queueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        projectInstructions: 'For this project only.',
      }),
    );
  });

  it('omits projectInstructions in queued payload when project instructions are null/empty/whitespace', async () => {
    const usageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    const userAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue(null),
    };
    const projectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue('   '),
    };
    const sessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: '33333333-3333-4333-8333-333333333333',
        projectId: 'project-1',
      }),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
      userAiInstructionsService as any,
      projectAiContextService as any,
      sessionService as any,
    );

    const request: AIExecutionRequest = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'untrusted-user',
      prompt: 'Explain this file.',
      provider: 'stub',
    };
    const identity: ApiKeyIdentity = {
      userId: '33333333-3333-4333-8333-333333333333',
      apiKeyId: '44444444-4444-4444-8444-444444444444',
      scopes: ['ai:execute'],
    };

    await controller.execute(request, identity);

    expect(projectAiContextService.getByProjectId).toHaveBeenCalledWith('project-1');
    expect(queueService.enqueueExecution).toHaveBeenCalledWith(
      expect.not.objectContaining({
        projectInstructions: expect.any(String),
      }),
    );
  });

  it('does not fetch project instructions when no project ID can be resolved from session', async () => {
    const usageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    const userAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue(null),
    };
    const projectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue('Should not be called'),
    };
    const sessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: '33333333-3333-4333-8333-333333333333',
        projectId: null,
      }),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
      userAiInstructionsService as any,
      projectAiContextService as any,
      sessionService as any,
    );

    const request: AIExecutionRequest = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'untrusted-user',
      prompt: 'Explain this file.',
      provider: 'stub',
    };
    const identity: ApiKeyIdentity = {
      userId: '33333333-3333-4333-8333-333333333333',
      apiKeyId: '44444444-4444-4444-8444-444444444444',
      scopes: ['ai:execute'],
    };

    await controller.execute(request, identity);

    expect(projectAiContextService.getByProjectId).not.toHaveBeenCalled();
    expect(queueService.enqueueExecution).toHaveBeenCalledWith(
      expect.not.objectContaining({
        projectInstructions: expect.any(String),
      }),
    );
  });

  it('adds repoDocContents to queued workspaceContext when registered docs are readable', async () => {
    const usageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    const userAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue('  Use concise responses.  '),
    };
    const projectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue('  Project-only context.  '),
    };
    const sessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: '33333333-3333-4333-8333-333333333333',
        projectId: 'project-1',
      }),
    };
    const projectRepoDocsService = {
      listByProjectId: jest.fn().mockResolvedValue([{ path: 'README.md', mode: 'always' }]),
    };
    const containerManagerHttpClient = {
      readSessionFile: jest.fn().mockResolvedValue({
        path: 'README.md',
        content: '  Repository context content.  ',
      }),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
      userAiInstructionsService as any,
      projectAiContextService as any,
      sessionService as any,
      projectRepoDocsService as any,
      containerManagerHttpClient as any,
    );

    const request: AIExecutionRequest = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'untrusted-user',
      prompt: 'Explain this repository.',
      provider: 'stub',
      workspaceContext: {
        filePaths: ['README.md'],
        namedFileContents: [{ path: 'src/app.ts', content: 'export const app = true;' }],
      },
    };
    const identity: ApiKeyIdentity = {
      userId: '33333333-3333-4333-8333-333333333333',
      apiKeyId: '44444444-4444-4444-8444-444444444444',
      scopes: ['ai:execute'],
    };

    await controller.execute(request, identity);

    expect(projectRepoDocsService.listByProjectId).toHaveBeenCalledWith('project-1');
    expect(containerManagerHttpClient.readSessionFile).toHaveBeenCalledWith(
      request.sessionId,
      'README.md',
    );
    expect(queueService.enqueueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        globalInstructions: 'Use concise responses.',
        projectInstructions: 'Project-only context.',
        workspaceContext: expect.objectContaining({
          namedFileContents: request.workspaceContext?.namedFileContents,
          repoDocContents: [
            {
              path: 'README.md',
              content: 'Repository context content.',
            },
          ],
        }),
      }),
    );
  });

  it('skips unreadable repo docs while keeping readable docs', async () => {
    const usageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    const userAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue(null),
    };
    const projectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue(null),
    };
    const sessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: '33333333-3333-4333-8333-333333333333',
        projectId: 'project-1',
      }),
    };
    const projectRepoDocsService = {
      listByProjectId: jest
        .fn()
        .mockResolvedValue([{ path: 'README.md', mode: 'always' }, { path: 'docs/ARCHITECTURE.md', mode: 'always' }]),
    };
    const containerManagerHttpClient = {
      readSessionFile: jest.fn().mockImplementation((_: string, path: string) => {
        if (path === 'README.md') {
          throw new Error('File not found');
        }
        return Promise.resolve({
          path,
          content: 'Architecture content',
        });
      }),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
      userAiInstructionsService as any,
      projectAiContextService as any,
      sessionService as any,
      projectRepoDocsService as any,
      containerManagerHttpClient as any,
    );

    const request: AIExecutionRequest = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'untrusted-user',
      prompt: 'Explain docs.',
      provider: 'stub',
      workspaceContext: { filePaths: [] },
    };
    const identity: ApiKeyIdentity = {
      userId: '33333333-3333-4333-8333-333333333333',
      apiKeyId: '44444444-4444-4444-8444-444444444444',
      scopes: ['ai:execute'],
    };

    await controller.execute(request, identity);

    const enqueuePayload = queueService.enqueueExecution.mock.calls[0][0];
    expect(enqueuePayload.workspaceContext.repoDocContents).toEqual([
      { path: 'docs/ARCHITECTURE.md', content: 'Architecture content' },
    ]);
  });

  it('omits repoDocContents when session projectId is null', async () => {
    const usageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    const userAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue(null),
    };
    const projectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue(null),
    };
    const sessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: '33333333-3333-4333-8333-333333333333',
        projectId: null,
      }),
    };
    const projectRepoDocsService = {
      listByProjectId: jest.fn().mockResolvedValue([{ path: 'README.md', mode: 'always' }]),
    };
    const containerManagerHttpClient = {
      readSessionFile: jest.fn(),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
      userAiInstructionsService as any,
      projectAiContextService as any,
      sessionService as any,
      projectRepoDocsService as any,
      containerManagerHttpClient as any,
    );

    const request: AIExecutionRequest = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'untrusted-user',
      prompt: 'Explain docs.',
      provider: 'stub',
      workspaceContext: { filePaths: ['README.md'] },
    };
    const identity: ApiKeyIdentity = {
      userId: '33333333-3333-4333-8333-333333333333',
      apiKeyId: '44444444-4444-4444-8444-444444444444',
      scopes: ['ai:execute'],
    };

    await controller.execute(request, identity);

    expect(projectRepoDocsService.listByProjectId).not.toHaveBeenCalled();
    expect(containerManagerHttpClient.readSessionFile).not.toHaveBeenCalled();
    const enqueuePayload = queueService.enqueueExecution.mock.calls[0][0];
    expect(enqueuePayload.workspaceContext.repoDocContents).toBeUndefined();
  });

  it('rejects cross-user session before workspace-context enrichment (AGENT-HARNESS-05C5)', async () => {
    const usageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      reuseExecutionIntent: jest.fn().mockResolvedValue('exec-id'),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    const userAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue(null),
    };
    const projectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue(null),
    };
    const sessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        projectId: 'project-1',
      }),
    };
    const projectRepoDocsService = {
      listByProjectId: jest.fn().mockResolvedValue([{ path: 'README.md', mode: 'always' }]),
    };
    const containerManagerHttpClient = {
      readSessionFile: jest.fn(),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
      userAiInstructionsService as any,
      projectAiContextService as any,
      sessionService as any,
      projectRepoDocsService as any,
      containerManagerHttpClient as any,
    );

    const request: AIExecutionRequest = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'untrusted-user',
      prompt: 'Explain docs.',
      provider: 'stub',
      workspaceContext: { filePaths: ['README.md'] },
    };
    const identity: ApiKeyIdentity = {
      userId: '33333333-3333-4333-8333-333333333333',
      apiKeyId: '44444444-4444-4444-8444-444444444444',
      scopes: ['ai:execute'],
    };

    const error = await controller.execute(request, identity).catch((e) => e);

    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.message).toBe(
      `Session with ID ${request.sessionId} not found`,
    );
    expect(error.message).not.toContain('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    expect(projectRepoDocsService.listByProjectId).not.toHaveBeenCalled();
    expect(containerManagerHttpClient.readSessionFile).not.toHaveBeenCalled();
    expect(userAiInstructionsService.getByUserId).not.toHaveBeenCalled();
    expect(projectAiContextService.getByProjectId).not.toHaveBeenCalled();
    expect(usageLedgerService.reuseExecutionIntent).not.toHaveBeenCalled();
    expect(usageLedgerService.writeExecutionIntent).not.toHaveBeenCalled();
    expect(queueService.enqueueExecution).not.toHaveBeenCalled();
  });

  it('omits repoDocContents when project has no registered repo docs', async () => {
    const usageLedgerService = {
      findByRequestId: jest.fn().mockResolvedValue(null),
      writeExecutionIntent: jest.fn().mockResolvedValue(undefined),
    };
    const queueService = {
      enqueueExecution: jest.fn().mockResolvedValue(undefined),
    };
    const userAiInstructionsService = {
      getByUserId: jest.fn().mockResolvedValue(null),
    };
    const projectAiContextService = {
      getByProjectId: jest.fn().mockResolvedValue(null),
    };
    const sessionService = {
      getSessionById: jest.fn().mockResolvedValue({
        userId: '33333333-3333-4333-8333-333333333333',
        projectId: 'project-1',
      }),
    };
    const projectRepoDocsService = {
      listByProjectId: jest.fn().mockResolvedValue([]),
    };
    const containerManagerHttpClient = {
      readSessionFile: jest.fn(),
    };
    const controller = new AIExecutionController(
      usageLedgerService as any,
      {} as any,
      queueService as any,
      {} as any,
      {} as any,
      userAiInstructionsService as any,
      projectAiContextService as any,
      sessionService as any,
      projectRepoDocsService as any,
      containerManagerHttpClient as any,
    );

    const request: AIExecutionRequest = {
      sessionId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      userId: 'untrusted-user',
      prompt: 'Explain docs.',
      provider: 'stub',
      workspaceContext: { filePaths: [] },
    };
    const identity: ApiKeyIdentity = {
      userId: '33333333-3333-4333-8333-333333333333',
      apiKeyId: '44444444-4444-4444-8444-444444444444',
      scopes: ['ai:execute'],
    };

    await controller.execute(request, identity);

    expect(projectRepoDocsService.listByProjectId).toHaveBeenCalledWith('project-1');
    expect(containerManagerHttpClient.readSessionFile).not.toHaveBeenCalled();
    const enqueuePayload = queueService.enqueueExecution.mock.calls[0][0];
    expect(enqueuePayload.workspaceContext.repoDocContents).toBeUndefined();
  });
});
