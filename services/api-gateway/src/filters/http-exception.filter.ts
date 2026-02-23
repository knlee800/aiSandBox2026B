import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * HttpExceptionFilter
 *
 * PHASE-42A-4 (HOTFIX): Preserve Quota Error Body Shape
 *
 * Global exception filter that preserves the full response body from HttpException,
 * including custom fields like 'error' and 'details' that are dropped by NestJS default behavior.
 *
 * Problem:
 * - NestJS default: HttpException(responseObject, statusCode) only preserves 'message' field
 * - Guards throw: { statusCode, error, message, details: { quota_type, ... } }
 * - Client receives: { statusCode, message } — 'error' and 'details' are dropped
 *
 * Solution:
 * - Intercept all HttpException instances
 * - Extract full response object from exception.getResponse()
 * - Return complete response body to client
 *
 * Behavior:
 * - If response is object: return as-is (preserves all fields)
 * - If response is string: wrap in { statusCode, message } (NestJS default)
 * - Preserves existing behavior for all non-HttpException errors
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // If response is an object, return it as-is (preserves all fields)
    // If response is a string, wrap it in default NestJS format
    const errorResponse =
      typeof exceptionResponse === 'object'
        ? exceptionResponse
        : {
            statusCode: status,
            message: exceptionResponse,
          };

    response.status(status).json(errorResponse);
  }
}
