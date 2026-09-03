import { Test, TestingModule } from '@nestjs/testing';
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicAdapter } from '../anthropic-ai.adapter';
import { AIExecutionRequest } from '../../types';
import {
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AGENT_HARNESS_TOOL_DEFINITIONS_V1 } from '../../../agent-harness/tools/tool-registry';
import type { AIAdapterCanonicalTranscriptTurn } from '../adapter-tool-use.contracts';

// Mock the entire Anthropic SDK
jest.mock('@anthropic-ai/sdk');

/**
 * AnthropicAdapter Unit Tests
 *
 * Stage C2-H: Anthropic Adapter Implementation
 *
 * Test Strategy:
 * - SDK is fully mocked (no network calls)
 * - Tests validate request transformation logic
 * - Tests validate response transformation logic
 * - Tests validate error handling (throw-only)
 * - Tests validate token calculation
 * - No external dependencies required
 */
describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;
  let mockClient: jest.Mocked<Anthropic>;
  let mockMessagesCreate: jest.Mock;

  const validApiKey = 'test-api-key';
  const configuredModel = 'test-configured-anthropic-model';
  const mockRequest: AIExecutionRequest = {
    sessionId: 'session-123',
    conversationId: 'conv-456',
    userId: 'user-789',
    prompt: 'Hello, Claude!',
    provider: 'stub',
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create mock messages.create method
    mockMessagesCreate = jest.fn();

    // Mock Anthropic constructor
    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(
      () =>
        ({
          messages: {
            create: mockMessagesCreate,
          },
        }) as unknown as Anthropic,
    );

    // Create adapter instance
    adapter = new AnthropicAdapter(validApiKey, {
      model: configuredModel,
    });
    mockClient = (adapter as any).client;
  });

  describe('Constructor', () => {
    it('should construct successfully with valid API key and model', () => {
      const adapter = new AnthropicAdapter('valid-key', {
        model: configuredModel,
      });

      expect(adapter).toBeDefined();
      expect(adapter.model).toBe(configuredModel);
    });

    it('should throw error if API key is missing', () => {
      expect(() => new AnthropicAdapter('')).toThrow(
        'Anthropic API key is required',
      );
    });

    it('should throw error if API key is whitespace only', () => {
      expect(() => new AnthropicAdapter('   ')).toThrow(
        'Anthropic API key is required',
      );
    });

    it('should throw error if model is missing', () => {
      expect(() => new AnthropicAdapter('valid-key')).toThrow(
        'Anthropic model is required',
      );
    });

    it('should throw error if model is empty', () => {
      expect(
        () =>
          new AnthropicAdapter('valid-key', {
            model: '',
          }),
      ).toThrow('Anthropic model is required');
    });

    it('should throw error if model is whitespace only', () => {
      expect(
        () =>
          new AnthropicAdapter('valid-key', {
            model: '   ',
          }),
      ).toThrow('Anthropic model is required');
    });

    it('should trim model value', () => {
      const adapter = new AnthropicAdapter('valid-key', {
        model: '  trimmed-anthropic-model  ',
      });

      expect(adapter.model).toBe('trimmed-anthropic-model');
    });

    it('should accept custom model in options', () => {
      const adapter = new AnthropicAdapter('valid-key', {
        model: 'claude-3-opus-20240229',
      });

      expect(adapter.model).toBe('claude-3-opus-20240229');
    });

    it('should pass timeout to Anthropic client', () => {
      new AnthropicAdapter('valid-key', {
        model: configuredModel,
        timeout: 30000,
      });

      expect(Anthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'valid-key',
          timeout: 30000,
        }),
      );
    });

    it('should pass baseURL to Anthropic client', () => {
      new AnthropicAdapter('valid-key', {
        model: configuredModel,
        baseURL: 'https://custom-api.example.com',
      });

      expect(Anthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'valid-key',
          baseURL: 'https://custom-api.example.com',
        }),
      );
    });
  });

  describe('execute() - Request Mapping', () => {
    it('should transform AIExecutionRequest to Anthropic format', async () => {
      // Mock successful response
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello, human!' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await adapter.execute(mockRequest);

      // Verify SDK was called with correct format
      expect(mockMessagesCreate).toHaveBeenCalledWith(
        {
          model: configuredModel,
          max_tokens: 4096,
          temperature: 1.0,
          messages: [
            {
              role: 'user',
              content: 'Hello, Claude!',
            },
          ],
        },
        {},
      );
    });

    it('should set provider-level system field when systemPrompt is present', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello, human!' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await adapter.execute({
        ...mockRequest,
        systemPrompt: '  Follow platform rules first.  ',
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'Follow platform rules first.',
          messages: [
            {
              role: 'user',
              content: 'Hello, Claude!',
            },
          ],
        }),
        {},
      );
    });

    it('should use custom model from adapter options', async () => {
      const customAdapter = new AnthropicAdapter('valid-key', {
        model: 'claude-3-opus-20240229',
      });

      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-opus-20240229',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await customAdapter.execute(mockRequest);

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-opus-20240229',
        }),
        {},
      );
    });

    it('should use requested model when request.model is provided', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-7-sonnet-latest',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await adapter.execute({
        ...mockRequest,
        model: 'claude-3-7-sonnet-latest',
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-7-sonnet-latest',
        }),
        {},
      );
    });

    it('should map prompt to messages array with user role', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const requestWithLongPrompt: AIExecutionRequest = {
        ...mockRequest,
        prompt: 'This is a longer prompt with multiple sentences.',
        provider: 'stub',
      };

      await adapter.execute(requestWithLongPrompt);

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: 'This is a longer prompt with multiple sentences.',
            },
          ],
        }),
        {},
      );
    });
  });

  describe('execute() - Response Mapping', () => {
    it('should extract text output from single content block', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello, human!' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const result = await adapter.execute(mockRequest);

      expect(result.output).toBe('Hello, human!');
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should concatenate multiple text blocks with double newline', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'First paragraph.' },
          { type: 'text', text: 'Second paragraph.' },
          { type: 'text', text: 'Third paragraph.' },
        ],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: 15 },
      });

      const result = await adapter.execute(mockRequest);

      expect(result.output).toBe(
        'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
      );
    });

    it('should calculate tokensUsed as sum of input and output tokens', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await adapter.execute(mockRequest);

      expect(result.tokensUsed).toBe(150);
    });

    it('should return zero tokensUsed if both counts are zero', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: '' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 0, output_tokens: 0 },
      });

      const result = await adapter.execute(mockRequest);

      expect(result.tokensUsed).toBe(0);
    });

    it('should use response model field', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const result = await adapter.execute(mockRequest);

      expect(result.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should use requested model as fallback when response.model is empty', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: '',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      const result = await adapter.execute({
        ...mockRequest,
        model: 'claude-3-7-sonnet-latest',
      });

      expect(result.model).toBe('claude-3-7-sonnet-latest');
    });

    it('should return empty string for empty text content', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: '' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: 0 },
      });

      const result = await adapter.execute(mockRequest);

      expect(result.output).toBe('');
    });
  });

  describe('execute() - Error Handling: Malformed Responses', () => {
    it('should throw if response missing content field', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        // content field missing
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Malformed Anthropic response: missing content',
      );
    });

    it('should throw if content array is empty', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [], // Empty array
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Malformed Anthropic response: missing content',
      );
    });

    it('should throw if content contains no text blocks', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'image', source: {} }], // Non-text block
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Malformed Anthropic response: no text content',
      );
    });

    it('should throw if response missing usage field', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-5-sonnet-20241022',
        // usage field missing
      });

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Malformed Anthropic response: missing usage',
      );
    });

    it('should throw if usage.input_tokens is negative', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: -10, output_tokens: 5 },
      });

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'invalid token counts',
      );
    });

    it('should throw if usage.output_tokens is negative', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: -5 },
      });

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'invalid token counts',
      );
    });
  });

  describe('execute() - Error Handling: API Errors', () => {
    it('should throw UnauthorizedException for 401 errors', async () => {
      // Create a mock API error with status field
      const apiError = new Error('Invalid API key') as any;
      apiError.status = 401;
      apiError.constructor = { name: 'APIError' };
      // Make it pass instanceof check
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);

      mockMessagesCreate.mockRejectedValue(apiError);

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Invalid Anthropic API key',
      );
    });

    it('should throw BadRequestException for 400 errors', async () => {
      const apiError = new Error('Invalid request') as any;
      apiError.status = 400;
      apiError.constructor = { name: 'APIError' };
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);

      mockMessagesCreate.mockRejectedValue(apiError);

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        BadRequestException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Invalid request to Anthropic API',
      );
    });

    it('should throw ServiceUnavailableException for 429 rate limit errors', async () => {
      const apiError = new Error('Rate limit exceeded') as any;
      apiError.status = 429;
      apiError.constructor = { name: 'APIError' };
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);

      mockMessagesCreate.mockRejectedValue(apiError);

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Anthropic API rate limit exceeded',
      );
    });

    it('should throw InternalServerErrorException for 500 errors', async () => {
      const apiError = new Error('Server error') as any;
      apiError.status = 500;
      apiError.constructor = { name: 'APIError' };
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);

      mockMessagesCreate.mockRejectedValue(apiError);

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Anthropic API server error',
      );
    });

    it('should throw InternalServerErrorException for 503 errors', async () => {
      const apiError = new Error('Service unavailable') as any;
      apiError.status = 503;
      apiError.constructor = { name: 'APIError' };
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);

      mockMessagesCreate.mockRejectedValue(apiError);

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Anthropic API server error',
      );
    });

    it('should throw InternalServerErrorException for unknown API errors', async () => {
      const apiError = new Error("I'm a teapot") as any;
      apiError.status = 418;
      apiError.constructor = { name: 'APIError' };
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);

      mockMessagesCreate.mockRejectedValue(apiError);

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Anthropic API error',
      );
    });
  });

  describe('execute() - Error Handling: Network Errors', () => {
    it('should throw ServiceUnavailableException for timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockMessagesCreate.mockRejectedValue(timeoutError);

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Anthropic API timeout',
      );
    });

    it('should throw ServiceUnavailableException for ETIMEDOUT errors', async () => {
      const timeoutError = new Error('ETIMEDOUT: connection timeout');
      mockMessagesCreate.mockRejectedValue(timeoutError);

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Anthropic API timeout',
      );
    });

    it('should throw ServiceUnavailableException for ECONNREFUSED errors', async () => {
      const connError = new Error('ECONNREFUSED: connection refused');
      mockMessagesCreate.mockRejectedValue(connError);

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Anthropic API connection error',
      );
    });

    it('should throw ServiceUnavailableException for ENOTFOUND errors', async () => {
      const dnsError = new Error('ENOTFOUND: DNS lookup failed');
      mockMessagesCreate.mockRejectedValue(dnsError);

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Anthropic API connection error',
      );
    });

    it('should throw InternalServerErrorException for unknown errors', async () => {
      const unknownError = new Error('Something went wrong');
      mockMessagesCreate.mockRejectedValue(unknownError);

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Unexpected error during Anthropic API call',
      );
    });

    it('should throw InternalServerErrorException for non-Error objects', async () => {
      mockMessagesCreate.mockRejectedValue('string error');

      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.execute(mockRequest)).rejects.toThrow(
        'Unexpected error during Anthropic API call',
      );
    });
  });

  describe('executeWithTools()', () => {
    it('should map Agent Harness tool definitions to Anthropic tools', async () => {
      const toolDefinition = AGENT_HARNESS_TOOL_DEFINITIONS_V1[0];
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Mapped tool metadata only' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      await adapter.executeWithTools(mockRequest, {
        tools: [toolDefinition],
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [
            {
              name: toolDefinition.name,
              description: toolDefinition.description,
              input_schema: toolDefinition.inputSchema.schema,
            },
          ],
        }),
        {},
      );
    });

    it('should parse tool_use blocks as typed tool-call metadata without executing tools', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_abc123',
            name: 'read_file',
            input: { path: '/workspace/README.md' },
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 20, output_tokens: 10 },
        stop_reason: 'tool_use',
      });

      const result = await adapter.executeWithTools(mockRequest, {
        tools: [AGENT_HARNESS_TOOL_DEFINITIONS_V1[1]],
      });

      expect(result.finishReason).toBe('tool_calls');
      expect(result.output).toBe('');
      expect(result.toolCalls).toEqual([
        {
          callId: 'toolu_abc123',
          toolName: 'read_file',
          arguments: { path: '/workspace/README.md' },
          providerKind: 'anthropic-tool_use',
        },
      ]);
    });

    it('should safely handle missing tool definitions', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'No tools requested' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const result = await adapter.executeWithTools(mockRequest);

      expect(result.finishReason).toBe('completed');
      expect(result.toolCalls).toEqual([]);
      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({ tools: expect.anything() }),
        {},
      );
    });

    it('sends system, user, and advertised tools on the first recorded request body', async () => {
      const listFiles = AGENT_HARNESS_TOOL_DEFINITIONS_V1[0];
      const readFile = AGENT_HARNESS_TOOL_DEFINITIONS_V1[1];
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_first',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'First turn' }],
        model: configuredModel,
        usage: { input_tokens: 8, output_tokens: 4 },
        stop_reason: 'end_turn',
      });

      await adapter.executeWithTools(
        {
          ...mockRequest,
          prompt: 'List then read README.md',
          systemPrompt: 'You are a read-only assistant.',
        },
        { tools: [listFiles, readFile] },
      );

      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      const recordedBody = mockMessagesCreate.mock.calls[0][0];
      expect(recordedBody.system).toBe('You are a read-only assistant.');
      expect(recordedBody.messages).toEqual([
        { role: 'user', content: 'List then read README.md' },
      ]);
      expect(recordedBody.tools).toEqual([
        {
          name: listFiles.name,
          description: listFiles.description,
          input_schema: listFiles.inputSchema.schema,
        },
        {
          name: readFile.name,
          description: readFile.description,
          input_schema: readFile.inputSchema.schema,
        },
      ]);
    });

    it('records assistant tool_use then matching tool_result blocks on the second request body', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_second',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Done with tools.' }],
        model: configuredModel,
        usage: { input_tokens: 20, output_tokens: 6 },
        stop_reason: 'end_turn',
      });
      const tools = [
        AGENT_HARNESS_TOOL_DEFINITIONS_V1[0],
        AGENT_HARNESS_TOOL_DEFINITIONS_V1[1],
      ];
      const priorToolResults = [
        {
          callId: 'toolu_1',
          toolName: 'list_files',
          success: true,
          content: { entries: ['README.md'] },
        },
        {
          callId: 'toolu_2',
          toolName: 'read_file',
          success: true,
          content: { content: '# Title' },
        },
      ];
      const transcript: AIAdapterCanonicalTranscriptTurn[] = [
        {
          kind: 'assistant_tool_turn',
          content: 'Checking files.',
          toolCalls: [
            {
              status: 'valid',
              callId: 'toolu_1',
              toolName: 'list_files',
              arguments: { path: '.' },
              rawArguments: { path: '.' },
              providerKind: 'anthropic-tool_use',
            },
            {
              status: 'valid',
              callId: 'toolu_2',
              toolName: 'read_file',
              arguments: { path: 'README.md' },
              rawArguments: { path: 'README.md' },
              providerKind: 'anthropic-tool_use',
            },
          ],
        },
        {
          kind: 'tool_result_turn',
          results: priorToolResults,
        },
      ];

      await adapter.executeWithTools(
        {
          ...mockRequest,
          prompt: 'List then read README.md',
          systemPrompt: 'You are a read-only assistant.',
        },
        { tools, toolResults: priorToolResults, transcript },
      );

      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      const recordedBody = mockMessagesCreate.mock.calls[0][0];
      expect(recordedBody.system).toBe('You are a read-only assistant.');
      expect(recordedBody.messages).toEqual([
        { role: 'user', content: 'List then read README.md' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Checking files.' },
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'list_files',
              input: { path: '.' },
            },
            {
              type: 'tool_use',
              id: 'toolu_2',
              name: 'read_file',
              input: { path: 'README.md' },
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_1',
              content: JSON.stringify({ entries: ['README.md'] }),
            },
            {
              type: 'tool_result',
              tool_use_id: 'toolu_2',
              content: JSON.stringify({ content: '# Title' }),
            },
          ],
        },
      ]);
      expect(
        recordedBody.messages.filter(
          (message: { role: string; content: unknown }) =>
            message.role === 'user' && typeof message.content === 'string',
        ),
      ).toHaveLength(1);
      expect(recordedBody.tools).toHaveLength(2);
    });

    it('does not leak transcript state across sequential executeWithTools calls', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_iso',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'ok' }],
        model: configuredModel,
        usage: { input_tokens: 3, output_tokens: 2 },
        stop_reason: 'end_turn',
      });
      const tools = [AGENT_HARNESS_TOOL_DEFINITIONS_V1[1]];
      const firstTranscript: AIAdapterCanonicalTranscriptTurn[] = [
        {
          kind: 'assistant_tool_turn',
          content: '',
          toolCalls: [
            {
              status: 'valid',
              callId: 'secret_toolu',
              toolName: 'read_file',
              arguments: { path: 'secret.md' },
              rawArguments: { path: 'secret.md' },
              providerKind: 'anthropic-tool_use',
            },
          ],
        },
        {
          kind: 'tool_result_turn',
          results: [
            {
              callId: 'secret_toolu',
              toolName: 'read_file',
              success: true,
              content: { content: 'classified' },
            },
          ],
        },
      ];

      await adapter.executeWithTools(
        { ...mockRequest, prompt: 'first execution' },
        { tools, transcript: firstTranscript },
      );
      await adapter.executeWithTools(
        { ...mockRequest, prompt: 'second execution' },
        { tools },
      );

      const secondBody = mockMessagesCreate.mock.calls[1][0];
      expect(secondBody.messages).toEqual([
        { role: 'user', content: 'second execution' },
      ]);
      expect(JSON.stringify(secondBody.messages)).not.toContain('secret_toolu');
      expect(JSON.stringify(secondBody.messages)).not.toContain('classified');
    });

    it('extracts malformed arguments and missing IDs without inventing fallback IDs or {}', async () => {
      mockMessagesCreate.mockResolvedValue({
        id: 'msg_malformed',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_good',
            name: 'read_file',
            input: { path: '/workspace/README.md' },
          },
          {
            type: 'tool_use',
            id: 'toolu_bad',
            name: 'read_file',
            input: 'not-an-object',
          },
          {
            type: 'tool_use',
            id: '',
            name: 'list_files',
            input: { path: '.' },
          },
        ],
        model: configuredModel,
        usage: { input_tokens: 12, output_tokens: 9 },
        stop_reason: 'tool_use',
      });

      const result = await adapter.executeWithTools(mockRequest, {
        tools: [AGENT_HARNESS_TOOL_DEFINITIONS_V1[1]],
      });

      expect(result.toolCalls).toEqual([
        {
          callId: 'toolu_good',
          toolName: 'read_file',
          arguments: { path: '/workspace/README.md' },
          providerKind: 'anthropic-tool_use',
        },
      ]);
      expect(result.canonicalToolCalls).toEqual([
        {
          status: 'valid',
          callId: 'toolu_good',
          toolName: 'read_file',
          arguments: { path: '/workspace/README.md' },
          rawArguments: { path: '/workspace/README.md' },
          providerKind: 'anthropic-tool_use',
        },
        {
          status: 'malformed_arguments',
          callId: 'toolu_bad',
          toolName: 'read_file',
          rawArguments: 'not-an-object',
          providerKind: 'anthropic-tool_use',
          errorMessage: expect.stringContaining('MALFORMED_TOOL_ARGUMENTS'),
        },
        {
          status: 'missing_id',
          toolName: 'list_files',
          rawArguments: { path: '.' },
          providerKind: 'anthropic-tool_use',
        },
      ]);
      expect(JSON.stringify(result)).not.toContain('anthropic-tool-use-');
      expect(result.canonicalToolCalls?.[1]).not.toEqual(
        expect.objectContaining({ arguments: {} }),
      );
    });
  });
});
