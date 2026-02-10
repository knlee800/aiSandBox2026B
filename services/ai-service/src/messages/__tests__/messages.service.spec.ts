import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { MessagesService } from '../messages.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { QuotaService } from '../../quota/quota.service';
import { ApiGatewayHttpClient } from '../../clients/api-gateway-http.client';
import { AIExecutionService } from '../../ai-execution/ai-execution.service';
import { AIExecutionResult } from '../../ai-execution/types';

describe('MessagesService (Phase 27: ClaudeModule Removal)', () => {
  let service: MessagesService;
  let aiExecutionService: AIExecutionService;
  let conversationsService: ConversationsService;
  let quotaService: QuotaService;
  let apiGatewayClient: ApiGatewayHttpClient;

  const mockAIExecutionService = {
    execute: jest.fn(),
  };

  const mockConversationsService = {
    getConversation: jest.fn(),
    createConversation: jest.fn(),
    addMessage: jest.fn(),
    getMessages: jest.fn(),
  };

  const mockQuotaService = {
    checkQuota: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
    delete: jest.fn(),
  };

  const mockApiGatewayClient = {
    addChatMessage: jest.fn(),
    recordTokenUsage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: AIExecutionService,
          useValue: mockAIExecutionService,
        },
        {
          provide: ConversationsService,
          useValue: mockConversationsService,
        },
        {
          provide: QuotaService,
          useValue: mockQuotaService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ApiGatewayHttpClient,
          useValue: mockApiGatewayClient,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    aiExecutionService = module.get<AIExecutionService>(AIExecutionService);
    conversationsService = module.get<ConversationsService>(ConversationsService);
    quotaService = module.get<QuotaService>(QuotaService);
    apiGatewayClient = module.get<ApiGatewayHttpClient>(ApiGatewayHttpClient);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleUserMessage', () => {
    it('should use AIExecutionService instead of ClaudeService', async () => {
      // Setup
      const sessionId = 'test-session';
      const userId = 'test-user';
      const message = 'Hello AI';

      const mockSession = {
        id: sessionId,
        user_id: userId,
        status: 'running',
      };

      const mockConversation = {
        id: 'conv-123',
        session_id: sessionId,
      };

      const mockMessages = [
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous response' },
      ];

      const mockExecutionResult: AIExecutionResult = {
        output: 'AI response via adapter',
        tokensUsed: 150,
        model: 'grok-beta',
      };

      // Mock database session query
      (service as any).db = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(mockSession),
        }),
      };

      mockConversationsService.getConversation.mockResolvedValue(mockConversation);
      mockConversationsService.getMessages.mockResolvedValue(mockMessages);
      mockConversationsService.addMessage.mockResolvedValue({ messageNumber: 5 });
      mockQuotaService.checkQuota.mockResolvedValue(true);
      mockApiGatewayClient.addChatMessage.mockResolvedValue('msg-123');
      mockApiGatewayClient.recordTokenUsage.mockResolvedValue(undefined);
      mockAIExecutionService.execute.mockResolvedValue(mockExecutionResult);

      // Execute
      const result = await service.handleUserMessage(sessionId, userId, message, 'stub');

      // Verify AIExecutionService.execute was called (NOT ClaudeService)
      expect(mockAIExecutionService.execute).toHaveBeenCalledWith({
        sessionId,
        userId,
        conversationId: mockConversation.id,
        prompt: expect.stringContaining('Previous message'),
        provider: 'stub',
        metadata: expect.objectContaining({ systemPrompt: expect.any(String) }),
      });

      // Verify response format matches expected structure
      expect(result).toEqual({
        message: 'AI response via adapter',
        operations: [],
        usage: {
          input_tokens: 0,
          output_tokens: 150,
          total_tokens: 150,
        },
      });

      // Verify quota check was performed
      expect(mockQuotaService.checkQuota).toHaveBeenCalledWith(sessionId);

      // Verify messages were persisted
      expect(mockApiGatewayClient.addChatMessage).toHaveBeenCalledTimes(2);
      expect(mockApiGatewayClient.recordTokenUsage).toHaveBeenCalledWith(
        sessionId,
        0,
        150,
        'msg-123',
      );
    });

    it('should build prompt from messages array', async () => {
      // Setup
      const sessionId = 'test-session';
      const userId = 'test-user';
      const message = 'New message';

      const mockSession = {
        id: sessionId,
        user_id: userId,
        status: 'running',
      };

      const mockConversation = {
        id: 'conv-456',
        session_id: sessionId,
      };

      const mockMessages = [
        { role: 'user', content: 'First user message' },
        { role: 'assistant', content: 'First assistant response' },
        { role: 'user', content: 'Second user message' },
      ];

      const mockExecutionResult: AIExecutionResult = {
        output: 'Response',
        tokensUsed: 100,
        model: 'stub',
      };

      // Mock database
      (service as any).db = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(mockSession),
        }),
      };

      mockConversationsService.getConversation.mockResolvedValue(mockConversation);
      mockConversationsService.getMessages.mockResolvedValue(mockMessages);
      mockConversationsService.addMessage.mockResolvedValue({ messageNumber: 3 });
      mockQuotaService.checkQuota.mockResolvedValue(true);
      mockApiGatewayClient.addChatMessage.mockResolvedValue('msg-456');
      mockApiGatewayClient.recordTokenUsage.mockResolvedValue(undefined);
      mockAIExecutionService.execute.mockResolvedValue(mockExecutionResult);

      // Execute
      await service.handleUserMessage(sessionId, userId, message, 'stub');

      // Verify prompt format includes all messages with role prefixes
      const executionCall = mockAIExecutionService.execute.mock.calls[0][0];
      expect(executionCall.prompt).toContain('User: First user message');
      expect(executionCall.prompt).toContain('Assistant: First assistant response');
      expect(executionCall.prompt).toContain('User: Second user message');
      expect(executionCall.prompt).toContain('System:');
    });
  });

  describe('streamUserMessage', () => {
    it('should use AIExecutionService with onChunk callback', async () => {
      // Setup
      const sessionId = 'test-session';
      const userId = 'test-user';
      const message = 'Stream this';
      const onChunkSpy = jest.fn();

      const mockSession = {
        id: sessionId,
        user_id: userId,
        status: 'running',
      };

      const mockConversation = {
        id: 'conv-789',
        session_id: sessionId,
      };

      const mockMessages = [
        { role: 'user', content: 'Hello' },
      ];

      const mockExecutionResult: AIExecutionResult = {
        output: 'Full streaming response',
        tokensUsed: 200,
        model: 'xai-grok',
      };

      // Mock database
      (service as any).db = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(mockSession),
        }),
      };

      mockConversationsService.getConversation.mockResolvedValue(mockConversation);
      mockConversationsService.getMessages.mockResolvedValue(mockMessages);
      mockConversationsService.addMessage.mockResolvedValue({ messageNumber: 2 });
      mockQuotaService.checkQuota.mockResolvedValue(true);
      mockApiGatewayClient.addChatMessage.mockResolvedValue('msg-789');
      mockApiGatewayClient.recordTokenUsage.mockResolvedValue(undefined);
      mockAIExecutionService.execute.mockResolvedValue(mockExecutionResult);

      // Execute
      const result = await service.streamUserMessage(
        sessionId,
        userId,
        message,
        'stub',
        onChunkSpy,
      );

      // Verify AIExecutionService.execute was called
      expect(mockAIExecutionService.execute).toHaveBeenCalled();

      // Verify onChunk was called with full response (non-streaming fallback)
      expect(onChunkSpy).toHaveBeenCalledWith('Full streaming response');

      // Verify response format
      expect(result).toEqual({
        message: 'Full streaming response',
        operations: [],
        usage: {
          input_tokens: 0,
          output_tokens: 200,
          total_tokens: 200,
        },
      });
    });
  });
});
