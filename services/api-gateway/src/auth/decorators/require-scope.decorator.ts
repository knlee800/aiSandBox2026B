import { SetMetadata } from '@nestjs/common';

/**
 * RequireScope decorator
 *
 * Phase 20B: Declare required authorization scope for a route
 *
 * Marks a route as requiring specific permission scope(s).
 * Used by AuthorizationGuard to enforce scope-based access control.
 *
 * Usage:
 * @RequireScope('ai:execute')
 * @Post('execute')
 * async execute(...) { }
 *
 * @param scope - Required scope (e.g., 'ai:execute')
 */
export const RequireScope = (scope: string) =>
  SetMetadata('REQUIRED_SCOPES', [scope]);

/**
 * RequireScopes decorator
 *
 * Phase 20B: Declare multiple required scopes for a route
 *
 * All specified scopes must be granted (AND logic).
 *
 * Usage:
 * @RequireScopes(['ai:execute', 'admin:read'])
 * @Post('admin')
 * async adminAction(...) { }
 *
 * @param scopes - Array of required scopes
 */
export const RequireScopes = (scopes: string[]) =>
  SetMetadata('REQUIRED_SCOPES', scopes);
