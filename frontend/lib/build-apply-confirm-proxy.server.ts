// COOKIE-PREFIX-01: the gateway uses __Host-aisandbox_session in secure mode
// (https or production) and aisandbox_session on local http. The prefixed
// name is tried first; the token is re-sent under the name it was found by.
export const SESSION_COOKIE_NAMES = ['__Host-aisandbox_session', 'aisandbox_session'] as const;
const INTERNAL_SERVICE_KEY_HEADER = 'X-Internal-Service-Key';
const DEFAULT_API_GATEWAY_URL = 'http://localhost:4000';

export interface BuildApplyConfirmationProxyPayload {
  applyStatus: 'applied';
  totalActions: number;
  successCount: number;
}

export interface BuildApplyConfirmationProxyResult {
  status: number;
  body: Record<string, unknown>;
}

export interface ProxyConfirmBuildApplyArgs {
  executionId: string;
  cookieHeader: string | null;
  incomingInternalServiceKeyHeader: string | null;
  payload: unknown;
  fetchImpl?: typeof fetch;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function getApiGatewayBaseUrl(): string {
  const configured = process.env.API_GATEWAY_URL;
  if (typeof configured === 'string' && configured.trim()) {
    return configured.replace(/\/+$/, '');
  }
  return DEFAULT_API_GATEWAY_URL;
}

export function readInternalServiceKeyFromEnv(): string | null {
  const key = process.env.INTERNAL_SERVICE_KEY;
  if (typeof key !== 'string' || key.trim().length === 0) {
    return null;
  }
  return key;
}

export interface SessionCookieFromHeader {
  name: (typeof SESSION_COOKIE_NAMES)[number];
  token: string;
}

/**
 * The session cookie from a Cookie header: the prefixed name first, then the
 * old one; exact-name match; the first pair with that name. Null when absent
 * or empty.
 */
export function readSessionCookieFromCookieHeader(
  cookieHeader: string | null,
): SessionCookieFromHeader | null {
  if (typeof cookieHeader !== 'string' || cookieHeader.trim().length === 0) {
    return null;
  }

  const parts = cookieHeader.split(';');
  for (const name of SESSION_COOKIE_NAMES) {
    for (const part of parts) {
      const separator = part.indexOf('=');
      if (separator < 0 || part.slice(0, separator).trim() !== name) {
        continue;
      }
      const value = part.slice(separator + 1).trim();
      if (value.length > 0) {
        return { name, token: value };
      }
      break;
    }
  }

  return null;
}

export function readSessionTokenFromCookieHeader(cookieHeader: string | null): string | null {
  return readSessionCookieFromCookieHeader(cookieHeader)?.token ?? null;
}

export function parseBuildApplyConfirmationProxyPayload(
  value: unknown,
): BuildApplyConfirmationProxyPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    applyStatus?: unknown;
    totalActions?: unknown;
    successCount?: unknown;
  };
  if (
    candidate.applyStatus !== 'applied' ||
    !isNonNegativeInteger(candidate.totalActions) ||
    !isNonNegativeInteger(candidate.successCount)
  ) {
    return null;
  }

  return {
    applyStatus: 'applied',
    totalActions: candidate.totalActions,
    successCount: candidate.successCount,
  };
}

function readAuthMeUserId(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as { id?: unknown; userId?: unknown };
  if (typeof candidate.id === 'string' && candidate.id.trim()) {
    return candidate.id;
  }
  if (typeof candidate.userId === 'string' && candidate.userId.trim()) {
    return candidate.userId;
  }
  return null;
}

function jsonWithoutInternalKey(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (key === INTERNAL_SERVICE_KEY_HEADER || key === 'INTERNAL_SERVICE_KEY') {
      continue;
    }
    sanitized[key] = entry;
  }
  return sanitized;
}

async function readJsonSafe(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw.trim()) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function proxyConfirmBuildApply(
  args: ProxyConfirmBuildApplyArgs,
): Promise<BuildApplyConfirmationProxyResult> {
  const executionId = args.executionId.trim();
  if (!executionId) {
    return { status: 400, body: { error: 'invalid_execution_id' } };
  }

  const sessionCookie = readSessionCookieFromCookieHeader(args.cookieHeader);
  if (!sessionCookie) {
    return { status: 401, body: { error: 'unauthenticated' } };
  }

  const payload = parseBuildApplyConfirmationProxyPayload(args.payload);
  if (!payload) {
    return { status: 400, body: { error: 'malformed_payload' } };
  }

  const internalServiceKey = readInternalServiceKeyFromEnv();
  if (!internalServiceKey) {
    return { status: 500, body: { error: 'confirmation_unavailable' } };
  }

  const fetchImpl = args.fetchImpl ?? fetch;
  const gatewayBaseUrl = getApiGatewayBaseUrl();
  const sessionCookieHeader = `${sessionCookie.name}=${sessionCookie.token}`;

  const authResponse = await fetchImpl(`${gatewayBaseUrl}/api/auth/me`, {
    method: 'GET',
    headers: {
      Cookie: sessionCookieHeader,
    },
  });
  if (authResponse.status === 401 || authResponse.status === 403) {
    return { status: 401, body: { error: 'unauthenticated' } };
  }
  if (!authResponse.ok) {
    return { status: 502, body: { error: 'auth_lookup_failed' } };
  }

  const authenticatedUserId = readAuthMeUserId(await readJsonSafe(authResponse));
  if (!authenticatedUserId) {
    return { status: 401, body: { error: 'unauthenticated' } };
  }

  const executionResponse = await fetchImpl(
    `${gatewayBaseUrl}/api/ai/executions/${encodeURIComponent(executionId)}`,
    {
      method: 'GET',
      headers: {
        Cookie: sessionCookieHeader,
      },
    },
  );
  if (executionResponse.status === 401 || executionResponse.status === 403) {
    return { status: 401, body: { error: 'unauthenticated' } };
  }
  if (executionResponse.status === 404) {
    return { status: 404, body: { error: 'execution_not_found' } };
  }
  if (!executionResponse.ok) {
    return { status: 502, body: { error: 'execution_lookup_failed' } };
  }

  // Browser-supplied internal keys are ignored. Only the server env key is used.
  void args.incomingInternalServiceKeyHeader;
  void authenticatedUserId;

  const confirmResponse = await fetchImpl(
    `${gatewayBaseUrl}/api/internal/executions/${encodeURIComponent(executionId)}/confirm-build-apply`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [INTERNAL_SERVICE_KEY_HEADER]: internalServiceKey,
      },
      body: JSON.stringify({
        applyStatus: payload.applyStatus,
        totalActions: payload.totalActions,
        successCount: payload.successCount,
      }),
    },
  );

  const confirmBody = jsonWithoutInternalKey(await readJsonSafe(confirmResponse));
  if (!confirmResponse.ok) {
    return {
      status: confirmResponse.status >= 400 && confirmResponse.status < 600
        ? confirmResponse.status
        : 502,
      body: Object.keys(confirmBody).length > 0
        ? confirmBody
        : { error: 'confirmation_upstream_failed' },
    };
  }

  return {
    status: 200,
    body: {
      executionId:
        typeof confirmBody.executionId === 'string' ? confirmBody.executionId : executionId,
      triggered: confirmBody.triggered === true,
      reason: typeof confirmBody.reason === 'string' ? confirmBody.reason : 'ok',
    },
  };
}
