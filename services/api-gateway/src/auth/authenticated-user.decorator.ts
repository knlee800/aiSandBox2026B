import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyIdentity } from './api-key.config';

/**
 * AuthenticatedUser decorator
 *
 * Phase 20A: Extract verified user identity from request
 *
 * Extracts the ApiKeyIdentity attached by ApiKeyAuthGuard.
 * Must be used with @UseGuards(ApiKeyAuthGuard).
 *
 * Usage:
 * @UseGuards(ApiKeyAuthGuard)
 * @Post('execute')
 * async execute(
 *   @Body() request: AIExecutionRequest,
 *   @AuthenticatedUser() identity: ApiKeyIdentity
 * ) {
 *   // identity.userId is verified
 *   // identity.apiKeyId can be used for audit
 * }
 */
export const AuthenticatedUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ApiKeyIdentity => {
    const request = ctx.switchToHttp().getRequest();
    return request.apiKeyIdentity;
  },
);
