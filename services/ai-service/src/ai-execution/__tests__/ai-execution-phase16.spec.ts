import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AIExecutionService } from '../ai-execution.service';
import { AIAdapter } from '../adapters/ai-adapter.interface';
import { AIExecutionRequest, AIExecutionResult } from '../types';
import { Logger } from '@nestjs/common';

/**
 * PHASE 16 VERIFICATION TESTS
 *
 * Purpose:
 * Verify that AIExecutionService and adapters conform to all contracts
 * locked in Phases 12-15:
 *
 * Phase 12: AIExecutionRequest/AIExecutionResult contracts
 * Phase 13: Token recording only on success
 * Phase 15A: Execution boundaries & throw-only semantics
 * Phase 15B: Observability policy
 * Phase 15C: Failure taxonomy
 * Phase 15D: Lifecycle states
 *
 * What is tested:
 * 1. Throw-only error semantics (no error codes, no swallowing)
 * 2. Exception propagation (adapter exceptions reach caller)
 * 3. Token eligibility (success = tokens, failure = exception)
 * 4. Determinism (same failure → same exception type)
 * 5. Observability (logging behavior)
 * 6. Stateless execution (no cross-request state)
 */
describe('AIExecutionService - Phase 16 Contract Verification', () => {
  let service: AIExecutionService;
  let mockAdapter: jest.Mocked<AIAdapter>;
  let module: TestingModule;
  let loggerSpy: jest.SpyInstance;

  const mockRequest: AIExecutionRequest = {
    sessionId: 'session-123',
    conversationId: 'conv-456',
    userId: 'user-789',
    prompt: 'Test prompt',
    provider: 'stub',
  };

  beforeEach(async () => {
    // Create mock adapter
    mockAdapter = {
      model: 'test-model',
      execute: jest.fn(),
    };

    // Mock ConfigService for Phase 28
    const mockConfigService = {
      get: jest.fn(),
    };

    // Create testing module
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        AIExecutionService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AIExecutionService>(AIExecutionService);

    // Phase 28: Spy on private getAdapter method to inject mock adapter
    jest.spyOn(service as any, 'getAdapter').mockReturnValue(mockAdapter);

    // Spy on logger
    loggerSpy = jest.spyOn(Logger.prototype, 'debug');
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  describe('Phase 15A: Throw-Only Error Semantics', () => {
    it('should propagate adapter exceptions without swallowing', async () => {
      // Arrange: Adapter throws error
      const adapterError = new Error('Adapter failure');
      mockAdapter.execute.mockRejectedValue(adapterError);

      // Act & Assert: Exception propagates to caller
      await expect(service.execute(mockRequest)).rejects.toThrow(
        'Adapter failure',
      );
      await expect(service.execute(mockRequest)).rejects.toThrow(Error);
    });

    it('should never return error codes (result OR exception, never both)', async () => {
      // Phase 15A: Deterministic outcome - result OR exception, never both

      // Success case: returns result
      const successResult: AIExecutionResult = {
        output: 'Success response',
        tokensUsed: 100,
        model: 'test-model',
      };
      mockAdapter.execute.mockResolvedValue(successResult);

      const result = await service.execute(mockRequest);
      expect(result).toBeDefined();
      expect(result.output).toBe('Success response');
      expect(result.tokensUsed).toBe(100);

      // Failure case: throws exception
      mockAdapter.execute.mockRejectedValue(new Error('Failure'));
      await expect(service.execute(mockRequest)).rejects.toThrow();
    });

    it('should not catch or transform adapter exceptions', async () => {
      // Arrange: Various exception types
      const exceptions = [
        new Error('Generic error'),
        new TypeError('Type error'),
        new RangeError('Range error'),
        { message: 'Custom error object' },
      ];

      for (const exception of exceptions) {
        mockAdapter.execute.mockRejectedValue(exception);

        // Act & Assert: Original exception propagates
        await expect(service.execute(mockRequest)).rejects.toBe(exception);
      }
    });
  });

  describe('Phase 15A: Stateless Execution', () => {
    it('should not maintain state across requests', async () => {
      // Arrange: Two different requests
      const request1: AIExecutionRequest = {
        sessionId: 'session-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        prompt: 'First',
        provider: 'stub',
      };

      const request2: AIExecutionRequest = {
        sessionId: 'session-2',
        conversationId: 'conv-2',
        userId: 'user-2',
        prompt: 'Second',
        provider: 'stub',
      };

      const result1: AIExecutionResult = {
        output: 'Response 1',
        tokensUsed: 50,
        model: 'test-model',
      };

      const result2: AIExecutionResult = {
        output: 'Response 2',
        tokensUsed: 75,
        model: 'test-model',
      };

      // Act: Execute both requests
      mockAdapter.execute.mockResolvedValueOnce(result1);
      const response1 = await service.execute(request1);

      mockAdapter.execute.mockResolvedValueOnce(result2);
      const response2 = await service.execute(request2);

      // Assert: Each execution is independent
      expect(response1).not.toEqual(response2);
      expect(mockAdapter.execute).toHaveBeenCalledTimes(2);
      expect(mockAdapter.execute).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          ...request1,
          model: 'stub',
        }),
      );
      expect(mockAdapter.execute).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          ...request2,
          model: 'stub',
        }),
      );
    });

    it('should not aggregate or track execution history', async () => {
      // Arrange: Multiple executions
      const result: AIExecutionResult = {
        output: 'Response',
        tokensUsed: 10,
        model: 'test-model',
      };
      mockAdapter.execute.mockResolvedValue(result);

      // Act: Execute multiple times
      await service.execute(mockRequest);
      await service.execute(mockRequest);
      await service.execute(mockRequest);

      // Assert: Service has no memory of previous executions
      // (verified by checking that each call is independent)
      expect(mockAdapter.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('Phase 13 & 15A: Token Recording Only On Success', () => {
    it('should return tokensUsed only when execution succeeds', async () => {
      // Arrange: Successful execution
      const result: AIExecutionResult = {
        output: 'Success',
        tokensUsed: 150,
        model: 'test-model',
      };
      mockAdapter.execute.mockResolvedValue(result);

      // Act
      const response = await service.execute(mockRequest);

      // Assert: Tokens present in success result
      expect(response.tokensUsed).toBe(150);
      expect(response.tokensUsed).toBeGreaterThan(0);
    });

    it('should not return tokensUsed when execution fails', async () => {
      // Arrange: Failed execution
      mockAdapter.execute.mockRejectedValue(new Error('Provider error'));

      // Act & Assert: No tokens in exception
      await expect(service.execute(mockRequest)).rejects.toThrow();

      // Note: Exception object does not contain tokensUsed field
      // This verifies that failures produce zero tokens (implicitly)
    });

    it('should not return partial results on failure', async () => {
      // Phase 15A: Execution is atomic - result OR exception, never partial

      // Arrange: Adapter throws after some processing
      mockAdapter.execute.mockRejectedValue(new Error('Timeout'));

      // Act & Assert: No partial result returned
      await expect(service.execute(mockRequest)).rejects.toThrow();

      // The absence of a result object proves no partial data is returned
    });
  });

  describe('Phase 15C: Determinism - Same Failure → Same Exception', () => {
    it('should throw consistent exception type for same failure cause', async () => {
      // Arrange: Same error thrown multiple times
      const error = new Error('Rate limit exceeded');
      mockAdapter.execute.mockRejectedValue(error);

      // Act: Execute multiple times
      const failures: Error[] = [];
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute(mockRequest);
        } catch (e) {
          failures.push(e as Error);
        }
      }

      // Assert: All failures are the same type and message
      expect(failures).toHaveLength(3);
      failures.forEach((failure) => {
        expect(failure).toBeInstanceOf(Error);
        expect(failure.message).toBe('Rate limit exceeded');
      });
    });
  });

  describe('Phase 15B: Observability - Logging Behavior', () => {
    it('should log execution entry with adapter and session info', async () => {
      // Arrange
      const result: AIExecutionResult = {
        output: 'Response',
        tokensUsed: 10,
        model: 'test-model',
      };
      mockAdapter.execute.mockResolvedValue(result);

      // Act
      await service.execute(mockRequest);

      // Assert: Logger was called with execution details
      expect(loggerSpy).toHaveBeenCalled();
      const logCall = loggerSpy.mock.calls[0][0];
      expect(logCall).toContain('Executing AI request');
      expect(logCall).toContain('model=stub');
      expect(logCall).toContain('session=session-123');
    });

    it('should log even when execution fails', async () => {
      // Arrange
      mockAdapter.execute.mockRejectedValue(new Error('Provider error'));

      // Act
      try {
        await service.execute(mockRequest);
      } catch {
        // Exception expected
      }

      // Assert: Entry log still emitted (failure does not prevent logging)
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should NOT log prompt content (Phase 15B privacy)', async () => {
      // Arrange
      const requestWithSensitivePrompt: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'user-789',
        prompt: 'My SSN is 123-45-6789 and my password is secret123',
        provider: 'stub',
      };

      const result: AIExecutionResult = {
        output: 'Response',
        tokensUsed: 10,
        model: 'test-model',
      };
      mockAdapter.execute.mockResolvedValue(result);

      // Act
      await service.execute(requestWithSensitivePrompt);

      // Assert: Prompt content NOT in logs
      const logCalls = loggerSpy.mock.calls.flat().join(' ');
      expect(logCalls).not.toContain('SSN');
      expect(logCalls).not.toContain('123-45-6789');
      expect(logCalls).not.toContain('password');
      expect(logCalls).not.toContain('secret123');

      // Verify prompt was NOT passed to logger
      expect(logCalls).not.toContain(
        requestWithSensitivePrompt.prompt,
      );
    });

    it('should NOT log response content (Phase 15B privacy)', async () => {
      // Arrange
      const result: AIExecutionResult = {
        output:
          'Your credit card number is 4111-1111-1111-1111. Sensitive data here.',
        tokensUsed: 50,
        model: 'test-model',
      };
      mockAdapter.execute.mockResolvedValue(result);

      // Act
      await service.execute(mockRequest);

      // Assert: Response content NOT in logs
      const logCalls = loggerSpy.mock.calls.flat().join(' ');
      expect(logCalls).not.toContain('credit card');
      expect(logCalls).not.toContain('4111-1111-1111-1111');
      expect(logCalls).not.toContain('Sensitive data');
    });
  });

  describe('Phase 15D: Synchronous Execution', () => {
    it('should complete execution synchronously (no background tasks)', async () => {
      // Arrange
      const result: AIExecutionResult = {
        output: 'Response',
        tokensUsed: 10,
        model: 'test-model',
      };
      mockAdapter.execute.mockResolvedValue(result);

      // Act
      const startTime = Date.now();
      const response = await service.execute(mockRequest);
      const endTime = Date.now();

      // Assert: Response returned immediately (synchronous)
      expect(response).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Near instant for mocked adapter

      // No background tasks spawned
      expect(mockAdapter.execute).toHaveBeenCalledTimes(1);
    });

    it('should not queue or batch requests', async () => {
      // Arrange
      const result: AIExecutionResult = {
        output: 'Response',
        tokensUsed: 10,
        model: 'test-model',
      };
      mockAdapter.execute.mockResolvedValue(result);

      // Act: Execute 3 requests in parallel
      const promises = [
        service.execute(mockRequest),
        service.execute(mockRequest),
        service.execute(mockRequest),
      ];

      await Promise.all(promises);

      // Assert: All executed immediately, no batching
      expect(mockAdapter.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('Phase 12: Contract Compliance', () => {
    it('should forward requested model to adapter when request includes model', async () => {
      const requestWithModel: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'user-789',
        prompt: 'Test',
        provider: 'stub',
        model: 'gpt-4.1',
      };
      const result: AIExecutionResult = {
        output: 'Response',
        tokensUsed: 10,
        model: 'gpt-4.1',
      };
      mockAdapter.execute.mockResolvedValue(result);

      await service.execute(requestWithModel);

      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'stub',
          model: 'gpt-4.1',
        }),
      );
    });

    it('should trim requested model before forwarding it to adapter', async () => {
      const requestWithWhitespaceModel: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'user-789',
        prompt: 'Test',
        provider: 'stub',
        model: '  gpt-4.1-mini  ',
      };
      const result: AIExecutionResult = {
        output: 'Response',
        tokensUsed: 10,
        model: 'gpt-4.1-mini',
      };
      mockAdapter.execute.mockResolvedValue(result);

      await service.execute(requestWithWhitespaceModel);

      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4.1-mini',
        }),
      );
    });

    it('should accept valid AIExecutionRequest', async () => {
      // Arrange
      const validRequest: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'user-789',
        prompt: 'Test prompt',
        provider: 'stub',
        metadata: { key: 'value' },
      };

      const result: AIExecutionResult = {
        output: 'Response',
        tokensUsed: 10,
        model: 'test-model',
      };
      mockAdapter.execute.mockResolvedValue(result);

      // Act
      await service.execute(validRequest);

      // Assert: Request accepted and passed to adapter
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          ...validRequest,
          model: 'stub',
        }),
      );
    });

    it('should return valid AIExecutionResult on success', async () => {
      // Arrange
      const result: AIExecutionResult = {
        output: 'AI generated response',
        tokensUsed: 125,
        model: 'test-model',
      };
      mockAdapter.execute.mockResolvedValue(result);

      // Act
      const response = await service.execute(mockRequest);

      // Assert: Result conforms to AIExecutionResult interface
      expect(response).toHaveProperty('output');
      expect(response).toHaveProperty('tokensUsed');
      expect(response).toHaveProperty('model');
      expect(typeof response.output).toBe('string');
      expect(typeof response.tokensUsed).toBe('number');
      expect(typeof response.model).toBe('string');
    });

    it('should preserve file-action extraction behavior in execute()', async () => {
      const resultWithFileActions: AIExecutionResult = {
        output: `Applied changes.\n\n\`\`\`file-actions\n[{"action":"write","path":"src/app.ts","content":"export const ok = true;\\n"}]\n\`\`\``,
        tokensUsed: 10,
        model: 'test-model',
      };
      mockAdapter.execute.mockResolvedValue(resultWithFileActions);

      const response = await service.execute(mockRequest);

      expect(response.fileActions).toEqual([
        {
          action: 'write',
          path: 'src/app.ts',
          content: 'export const ok = true;\n',
        },
      ]);
      expect(response.output).toContain('Applied changes.');
      expect(response.output).not.toContain('```file-actions');
    });

    it('should forward metadata from request to adapter', async () => {
      // Arrange
      const requestWithMetadata: AIExecutionRequest = {
        sessionId: 'session-123',
        conversationId: 'conv-456',
        userId: 'user-789',
        prompt: 'Test',
        provider: 'stub',
        metadata: {
          temperature: 0.7,
          maxTokens: 1000,
          customField: 'custom-value',
        },
      };

      const result: AIExecutionResult = {
        output: 'Response',
        tokensUsed: 10,
        model: 'test-model',
      };
      mockAdapter.execute.mockResolvedValue(result);

      // Act
      await service.execute(requestWithMetadata);

      // Assert: Metadata forwarded to adapter
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          ...requestWithMetadata,
          model: 'stub',
        }),
      );
    });
  });

  describe('Phase 15A: No Retry Logic', () => {
    it('should not retry on adapter failure', async () => {
      // Arrange: Adapter fails
      mockAdapter.execute.mockRejectedValue(new Error('Provider timeout'));

      // Act: Execute once
      try {
        await service.execute(mockRequest);
      } catch {
        // Exception expected
      }

      // Assert: Adapter called exactly once (no automatic retry)
      expect(mockAdapter.execute).toHaveBeenCalledTimes(1);
    });

    it('should not implement circuit breaker', async () => {
      // Arrange: Multiple failures
      mockAdapter.execute.mockRejectedValue(new Error('Provider down'));

      // Act: Execute multiple times
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute(mockRequest);
        } catch {
          // Exception expected
        }
      }

      // Assert: All attempts executed (no circuit breaking)
      expect(mockAdapter.execute).toHaveBeenCalledTimes(5);
    });
  });

  describe('Phase 15A: Adapter Delegation Pattern', () => {
    it('should delegate all execution to adapter', async () => {
      // Arrange
      const result: AIExecutionResult = {
        output: 'Response',
        tokensUsed: 10,
        model: 'test-model',
      };
      mockAdapter.execute.mockResolvedValue(result);

      // Act
      await service.execute(mockRequest);

      // Assert: Service delegates to adapter
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockRequest,
          model: 'stub',
        }),
      );
      expect(mockAdapter.execute).toHaveBeenCalledTimes(1);
    });

    it('should normalize adapter result with provider and parsed file-actions', async () => {
      // Arrange
      const adapterResult: AIExecutionResult = {
        output: 'Exact adapter response',
        tokensUsed: 999,
        model: 'adapter-model',
      };
      mockAdapter.execute.mockResolvedValue(adapterResult);

      // Act
      const serviceResult = await service.execute(mockRequest);

      // Assert: Result preserves content and enriches execution metadata
      expect(serviceResult.output).toBe('Exact adapter response');
      expect(serviceResult.tokensUsed).toBe(999);
      expect(serviceResult.model).toBe('adapter-model');
      expect(serviceResult.provider).toBe('stub');
      expect(serviceResult.fileActions).toEqual([]);
    });
  });
});
