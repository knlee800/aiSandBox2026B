import { Test, TestingModule } from '@nestjs/testing';
import { AIServiceHttpClient, AIExecutionRequest, AIExecutionResult } from './ai-service-http.client';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AIServiceHttpClient (Phase 18A)', () => {
  let client: AIServiceHttpClient;
  let mockAxiosInstance: any;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [AIServiceHttpClient],
    }).compile();

    client = module.get<AIServiceHttpClient>(AIServiceHttpClient);
    await module.init(); // Trigger onModuleInit
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  it('should create axios instance with correct configuration', () => {
    expect(mockedAxios.create).toHaveBeenCalledWith({
      baseURL: 'http://localhost:4001',
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('should use AI_SERVICE_URL environment variable if provided', () => {
    // Set environment variable
    process.env.AI_SERVICE_URL = 'http://ai-service:5000';

    // Create new instance
    const newClient = new AIServiceHttpClient();

    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://ai-service:5000',
      }),
    );

    // Cleanup
    delete process.env.AI_SERVICE_URL;
  });

  describe('execute', () => {
    it('should forward request to POST /api/execute and return result', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'user-789',
        prompt: 'Test prompt',
        provider: 'stub',
      };

      const expectedResult: AIExecutionResult = {
        output: 'AI response',
        tokensUsed: 50,
        model: 'claude-3-5-sonnet-20241022',
      };

      mockAxiosInstance.post.mockResolvedValue({ data: expectedResult });

      // Act
      const result = await client.execute(request);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/execute', request);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should forward optional workspaceContext unchanged', async () => {
      const request: AIExecutionRequest = {
        sessionId: 'session-ctx',
        conversationId: 'conv-ctx',
        userId: 'user-ctx',
        prompt: 'List files',
        provider: 'stub',
        workspaceContext: {
          filePaths: ['README.md', 'src/app.ts'],
          selectedFilePath: 'src/app.ts',
          selectedFileContent: 'export const app = true;',
        },
      };

      const expectedResult: AIExecutionResult = {
        output: 'AI response',
        tokensUsed: 5,
        model: 'stub',
      };

      mockAxiosInstance.post.mockResolvedValue({ data: expectedResult });

      const result = await client.execute(request);

      expect(result).toEqual(expectedResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/execute', request);
    });

    it('should propagate HTTP errors from ai-service', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'user-789',
        prompt: 'Test prompt',
        provider: 'stub',
      };

      const axiosError: any = new Error('Request failed');
      axiosError.isAxiosError = true;
      axiosError.response = {
        status: 503,
        data: {
          message: 'AI provider unavailable',
          statusCode: 503,
        },
      };

      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(axiosError);

      // Act & Assert
      await expect(client.execute(request)).rejects.toThrow('AI provider unavailable');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should propagate network errors unchanged', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'user-789',
        prompt: 'Test prompt',
        provider: 'stub',
      };

      const networkError = new Error('Network timeout');
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(false);
      mockAxiosInstance.post.mockRejectedValue(networkError);

      // Act & Assert
      await expect(client.execute(request)).rejects.toThrow('Network timeout');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should not retry on failure', async () => {
      // Arrange
      const request: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'user-789',
        prompt: 'Test prompt',
        provider: 'stub',
      };

      const error = new Error('Service unavailable');
      mockAxiosInstance.post.mockRejectedValue(error);

      // Act & Assert
      await expect(client.execute(request)).rejects.toThrow('Service unavailable');

      // Verify no retry - only one call
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });
  });
});
