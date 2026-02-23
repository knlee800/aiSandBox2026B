/**
 * HttpExceptionFilter Unit Tests
 *
 * PHASE-42A-4 (HOTFIX): Preserve Quota Error Body Shape
 *
 * Tests that the global exception filter preserves full response body
 * from HttpException, including custom fields like 'error' and 'details'.
 */

import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from '../http-exception.filter';

describe('HttpExceptionFilter (PHASE-42A-4)', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockArgumentsHost: any;

  beforeEach(() => {
    filter = new HttpExceptionFilter();

    // Mock Response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock ArgumentsHost
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
      }),
    };
  });

  describe('Quota Error Body Preservation', () => {
    it('should preserve full response body including error and details fields', () => {
      const quotaError = new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Quota Exceeded',
          message: 'Token quota exceeded',
          details: {
            quota_type: 'max_tokens_per_24h',
            limit: 100000,
            used: 95000,
            estimated_tokens: 8000,
            reset_at: '2026-02-24T12:00:00.000Z',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );

      filter.catch(quotaError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 429,
        error: 'Quota Exceeded',
        message: 'Token quota exceeded',
        details: {
          quota_type: 'max_tokens_per_24h',
          limit: 100000,
          used: 95000,
          estimated_tokens: 8000,
          reset_at: '2026-02-24T12:00:00.000Z',
        },
      });
    });

    it('should preserve session quota error body with details', () => {
      const sessionQuotaError = new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          message: 'Quota exceeded',
          details: {
            quota_type: 'max_active_sessions',
            limit: 5,
            current: 5,
          },
        },
        HttpStatus.FORBIDDEN,
      );

      filter.catch(sessionQuotaError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Quota exceeded',
        details: {
          quota_type: 'max_active_sessions',
          limit: 5,
          current: 5,
        },
      });
    });

    it('should preserve rolling 24h session quota error body', () => {
      const rollingQuotaError = new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          message: 'Quota exceeded',
          details: {
            quota_type: 'max_sessions_per_24h',
            limit: 20,
            current: 20,
            reset_at: '2026-02-24T12:00:00.000Z',
          },
        },
        HttpStatus.FORBIDDEN,
      );

      filter.catch(rollingQuotaError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Quota exceeded',
        details: {
          quota_type: 'max_sessions_per_24h',
          limit: 20,
          current: 20,
          reset_at: '2026-02-24T12:00:00.000Z',
        },
      });
    });
  });

  describe('Standard HttpException Handling', () => {
    it('should handle string message exceptions', () => {
      const stringException = new HttpException(
        'Not Found',
        HttpStatus.NOT_FOUND,
      );

      filter.catch(stringException, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'Not Found',
      });
    });

    it('should handle object response without details field', () => {
      const objectException = new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Validation failed',
          errors: ['field1 is required', 'field2 must be a number'],
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(objectException, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Validation failed',
        errors: ['field1 is required', 'field2 must be a number'],
      });
    });

    it('should handle internal server error', () => {
      const internalError = new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'Something went wrong',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(internalError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Something went wrong',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should preserve all custom fields in response object', () => {
      const customException = new HttpException(
        {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          error: 'Custom Error',
          message: 'Custom message',
          customField1: 'value1',
          customField2: { nested: 'value2' },
          customArray: [1, 2, 3],
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );

      filter.catch(customException, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 422,
        error: 'Custom Error',
        message: 'Custom message',
        customField1: 'value1',
        customField2: { nested: 'value2' },
        customArray: [1, 2, 3],
      });
    });

    it('should handle response object with only message field', () => {
      const minimalException = new HttpException(
        { message: 'Minimal error' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(minimalException, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Minimal error',
      });
    });
  });

  describe('Quota Error Differentiation', () => {
    it('should preserve details.quota_type for client detection', () => {
      const quotaError = new HttpException(
        {
          statusCode: 429,
          error: 'Quota Exceeded',
          message: 'Token quota exceeded',
          details: {
            quota_type: 'max_tokens_per_24h',
            limit: 100000,
            used: 95000,
          },
        },
        429,
      );

      filter.catch(quotaError, mockArgumentsHost);

      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall.details).toBeDefined();
      expect(jsonCall.details.quota_type).toBe('max_tokens_per_24h');
    });

    it('should allow clients to distinguish quota 429 from rate limit 429', () => {
      // Quota 429 (has details.quota_type)
      const quotaError = new HttpException(
        {
          statusCode: 429,
          error: 'Quota Exceeded',
          message: 'Token quota exceeded',
          details: { quota_type: 'max_tokens_per_24h' },
        },
        429,
      );

      filter.catch(quotaError, mockArgumentsHost);
      const quotaResponse = mockResponse.json.mock.calls[0][0];

      // Rate limit 429 (no details field)
      mockResponse.json.mockClear();
      const rateLimitError = new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );

      filter.catch(rateLimitError, mockArgumentsHost);
      const rateLimitResponse = mockResponse.json.mock.calls[0][0];

      // Verify differentiation
      expect(quotaResponse.details?.quota_type).toBeDefined();
      expect(rateLimitResponse.details).toBeUndefined();
    });
  });
});
