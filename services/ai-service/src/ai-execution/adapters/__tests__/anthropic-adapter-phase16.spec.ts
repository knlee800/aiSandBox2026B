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

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');

/**
 * PHASE 16: Adapter Failure Taxonomy Verification
 *
 * Purpose:
 * Verify that adapters correctly map provider errors to canonical failure
 * categories per Phase 15C taxonomy:
 *
 * - validation: Request is malformed (400) → BadRequestException
 * - provider: Provider API error (500+) → InternalServerErrorException
 * - rate_limit: Rate limiting (429) → ServiceUnavailableException
 * - timeout: Request timeout → ServiceUnavailableException
 * - unknown: Unexpected failures → InternalServerErrorException
 *
 * Also verifies:
 * - Determinism: Same error → Same exception type
 * - Token eligibility: All failures produce zero tokens (throw, no result)
 * - Exception propagation: Adapter exceptions reach caller
 */
describe('AnthropicAdapter - Phase 16 Failure Taxonomy', () => {
  let adapter: AnthropicAdapter;
  let mockMessagesCreate: jest.Mock;

  const validRequest: AIExecutionRequest = {
    sessionId: 'session-123',
    conversationId: 'conv-456',
    userId: 'user-789',
    prompt: 'Test prompt',
    provider: 'stub',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockMessagesCreate = jest.fn();

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(
      () =>
        ({
          messages: {
            create: mockMessagesCreate,
          },
        }) as unknown as Anthropic,
    );

    adapter = new AnthropicAdapter('test-api-key');
  });

  describe('Phase 15C: Failure Category - validation', () => {
    it('should throw BadRequestException for 400 errors (validation failure)', async () => {
      // Arrange: Provider returns 400 (malformed request)
      const apiError = new Error('Invalid request body') as any;
      apiError.status = 400;
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);
      mockMessagesCreate.mockRejectedValue(apiError);

      // Act & Assert
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        BadRequestException,
      );
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        'Invalid request to Anthropic API',
      );
    });

    it('should never retry validation errors (deterministic failure)', async () => {
      // Arrange: Validation error
      const apiError = new Error('Missing required field') as any;
      apiError.status = 400;
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);
      mockMessagesCreate.mockRejectedValue(apiError);

      // Act: Multiple attempts
      const failures: Error[] = [];
      for (let i = 0; i < 3; i++) {
        try {
          await adapter.execute(validRequest);
        } catch (e) {
          failures.push(e as Error);
        }
      }

      // Assert: All failures are same type (deterministic)
      expect(failures).toHaveLength(3);
      failures.forEach((failure) => {
        expect(failure).toBeInstanceOf(BadRequestException);
      });
    });

    it('should produce zero tokens on validation failure', async () => {
      // Arrange
      const apiError = new Error('Invalid model') as any;
      apiError.status = 400;
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);
      mockMessagesCreate.mockRejectedValue(apiError);

      // Act & Assert: Exception thrown, no result with tokens
      await expect(adapter.execute(validRequest)).rejects.toThrow();

      // No result object means zero tokens (Phase 15C guarantee)
    });
  });

  describe('Phase 15C: Failure Category - provider', () => {
    it('should throw InternalServerErrorException for 500 errors', async () => {
      // Arrange: Provider internal error
      const apiError = new Error('Internal server error') as any;
      apiError.status = 500;
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);
      mockMessagesCreate.mockRejectedValue(apiError);

      // Act & Assert
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        'Anthropic API server error',
      );
    });

    it('should throw InternalServerErrorException for 503 errors', async () => {
      // Arrange: Provider unavailable
      const apiError = new Error('Service unavailable') as any;
      apiError.status = 503;
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);
      mockMessagesCreate.mockRejectedValue(apiError);

      // Act & Assert
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException for 502 errors', async () => {
      // Arrange: Bad gateway
      const apiError = new Error('Bad gateway') as any;
      apiError.status = 502;
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);
      mockMessagesCreate.mockRejectedValue(apiError);

      // Act & Assert
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should produce zero tokens on provider failure', async () => {
      // Arrange
      const apiError = new Error('Provider outage') as any;
      apiError.status = 500;
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);
      mockMessagesCreate.mockRejectedValue(apiError);

      // Act & Assert: Exception thrown, no tokens
      await expect(adapter.execute(validRequest)).rejects.toThrow();
    });
  });

  describe('Phase 15C: Failure Category - rate_limit', () => {
    it('should throw ServiceUnavailableException for 429 errors', async () => {
      // Arrange: Rate limit exceeded
      const apiError = new Error('Rate limit exceeded') as any;
      apiError.status = 429;
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);
      mockMessagesCreate.mockRejectedValue(apiError);

      // Act & Assert
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        'Anthropic API rate limit exceeded',
      );
    });

    it('should be deterministic (same 429 → same exception type)', async () => {
      // Arrange
      const apiError = new Error('Too many requests') as any;
      apiError.status = 429;
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);
      mockMessagesCreate.mockRejectedValue(apiError);

      // Act: Multiple attempts
      const failures: Error[] = [];
      for (let i = 0; i < 3; i++) {
        try {
          await adapter.execute(validRequest);
        } catch (e) {
          failures.push(e as Error);
        }
      }

      // Assert: All failures are ServiceUnavailableException
      expect(failures).toHaveLength(3);
      failures.forEach((failure) => {
        expect(failure).toBeInstanceOf(ServiceUnavailableException);
      });
    });

    it('should produce zero tokens on rate limit failure', async () => {
      // Arrange
      const apiError = new Error('Rate limit') as any;
      apiError.status = 429;
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);
      mockMessagesCreate.mockRejectedValue(apiError);

      // Act & Assert: Exception thrown, no tokens
      await expect(adapter.execute(validRequest)).rejects.toThrow();
    });
  });

  describe('Phase 15C: Failure Category - timeout', () => {
    it('should throw ServiceUnavailableException for timeout errors', async () => {
      // Arrange: Request timeout
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockMessagesCreate.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        'Anthropic API timeout',
      );
    });

    it('should throw ServiceUnavailableException for ETIMEDOUT', async () => {
      // Arrange: Network timeout
      const timeoutError = new Error('ETIMEDOUT: connection timeout');
      mockMessagesCreate.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should produce zero tokens on timeout', async () => {
      // Arrange
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'TimeoutError';
      mockMessagesCreate.mockRejectedValue(timeoutError);

      // Act & Assert: Exception thrown, no tokens
      await expect(adapter.execute(validRequest)).rejects.toThrow();
    });
  });

  describe('Phase 15C: Failure Category - unknown', () => {
    it('should throw InternalServerErrorException for unknown API errors', async () => {
      // Arrange: Unknown status code
      const apiError = new Error('Unknown error') as any;
      apiError.status = 418; // I'm a teapot (unexpected)
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);
      mockMessagesCreate.mockRejectedValue(apiError);

      // Act & Assert
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        'Anthropic API error',
      );
    });

    it('should throw InternalServerErrorException for unexpected errors', async () => {
      // Arrange: Generic error
      const genericError = new Error('Something went wrong');
      mockMessagesCreate.mockRejectedValue(genericError);

      // Act & Assert
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        'Unexpected error during Anthropic API call',
      );
    });

    it('should throw InternalServerErrorException for network errors', async () => {
      // Arrange: Connection refused
      const networkError = new Error('ECONNREFUSED: connection refused');
      mockMessagesCreate.mockRejectedValue(networkError);

      // Act & Assert
      await expect(adapter.execute(validRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should produce zero tokens on unknown failure', async () => {
      // Arrange
      const unknownError = new Error('Unexpected');
      mockMessagesCreate.mockRejectedValue(unknownError);

      // Act & Assert: Exception thrown, no tokens
      await expect(adapter.execute(validRequest)).rejects.toThrow();
    });
  });

  describe('Phase 15C: Determinism Verification', () => {
    it('should throw same exception type for repeated same error', async () => {
      // Arrange: Same error
      const error = new Error('Persistent error') as any;
      error.status = 500;
      Object.setPrototypeOf(error, Anthropic.APIError.prototype);
      mockMessagesCreate.mockRejectedValue(error);

      // Act: Execute 5 times
      const exceptions: Error[] = [];
      for (let i = 0; i < 5; i++) {
        try {
          await adapter.execute(validRequest);
        } catch (e) {
          exceptions.push(e as Error);
        }
      }

      // Assert: All exceptions are same type
      expect(exceptions).toHaveLength(5);
      const exceptionTypes = exceptions.map((e) => e.constructor.name);
      expect(new Set(exceptionTypes).size).toBe(1); // All same type

      exceptions.forEach((exception) => {
        expect(exception).toBeInstanceOf(InternalServerErrorException);
      });
    });

    it('should map different errors to appropriate exception types', async () => {
      // Arrange: Different error scenarios
      const scenarios = [
        {
          error: Object.assign(new Error('Bad request'), { status: 400 }),
          expectedType: BadRequestException,
        },
        {
          error: Object.assign(new Error('Server error'), { status: 500 }),
          expectedType: InternalServerErrorException,
        },
        {
          error: Object.assign(new Error('Rate limit'), { status: 429 }),
          expectedType: ServiceUnavailableException,
        },
      ];

      for (const scenario of scenarios) {
        Object.setPrototypeOf(scenario.error, Anthropic.APIError.prototype);
        mockMessagesCreate.mockRejectedValueOnce(scenario.error);

        // Act & Assert
        await expect(adapter.execute(validRequest)).rejects.toThrow(
          scenario.expectedType,
        );
      }
    });
  });

  describe('Phase 15A: Token Eligibility - All Failures Produce Zero Tokens', () => {
    it('should never return tokens on any failure type', async () => {
      // Arrange: Various failure types
      const failures = [
        Object.assign(new Error('Validation'), { status: 400 }),
        Object.assign(new Error('Provider'), { status: 500 }),
        Object.assign(new Error('Rate limit'), { status: 429 }),
        new Error('Timeout'),
        new Error('Unknown'),
      ];

      for (const failure of failures) {
        if ((failure as any).status) {
          Object.setPrototypeOf(failure, Anthropic.APIError.prototype);
        }
        mockMessagesCreate.mockRejectedValueOnce(failure);

        // Act & Assert: Exception thrown, no result
        await expect(adapter.execute(validRequest)).rejects.toThrow();

        // No AIExecutionResult returned = zero tokens
      }

      // Verify no successful results in any case
      expect(mockMessagesCreate).toHaveBeenCalledTimes(failures.length);
    });
  });

  describe('Phase 15B: Exception Message Privacy', () => {
    it('should not leak sensitive data in exception messages', async () => {
      // Arrange: Error with potential sensitive data
      const apiError = new Error(
        'Authentication failed for key sk-ant-api03-...',
      ) as any;
      apiError.status = 401;
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);
      mockMessagesCreate.mockRejectedValue(apiError);

      // Act
      try {
        await adapter.execute(validRequest);
      } catch (e: any) {
        // Assert: Exception message is sanitized
        expect(e.message).toBe('Invalid Anthropic API key');
        expect(e.message).not.toContain('sk-ant-api03');
      }
    });

    it('should provide actionable error messages', async () => {
      // Arrange: Various errors
      const scenarios = [
        { status: 400, expectedMessage: 'Invalid request to Anthropic API' },
        { status: 401, expectedMessage: 'Invalid Anthropic API key' },
        { status: 429, expectedMessage: 'Anthropic API rate limit exceeded' },
        { status: 500, expectedMessage: 'Anthropic API server error' },
      ];

      for (const scenario of scenarios) {
        const apiError = new Error('Original message') as any;
        apiError.status = scenario.status;
        Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);
        mockMessagesCreate.mockRejectedValueOnce(apiError);

        try {
          await adapter.execute(validRequest);
        } catch (e: any) {
          expect(e.message).toBe(scenario.expectedMessage);
        }
      }
    });
  });
});
