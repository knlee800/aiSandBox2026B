/**
 * PROVIDER-KEY-01 (contract C2): which stored run failures the public status
 * answer may carry, and with what text.
 *
 * The AI service worker stores usage_records.metadata.executionError =
 * { code, message }. The status answer never echoes the stored text: an
 * allow-listed failure is answered with the gateway's own constant, and every
 * other failure gets no error field.
 */

export const PROVIDER_KEY_MISSING_CODE = 'provider_key_missing';
export const PROVIDER_KEY_MISSING_MESSAGE = 'AI provider is not configured';

/**
 * PROVIDER-LIMIT-MSG-01: the Anthropic adapter throws a BadRequestException
 * with this exact sentence. It has no code of its own, so the worker stores
 * it as execution_failed with the sentence unchanged.
 */
export const PROVIDER_USAGE_LIMIT_CODE = 'execution_failed';
export const PROVIDER_USAGE_LIMIT_MESSAGE = 'AI provider usage limit reached';

export interface AllowListedExecutionError {
  code: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Maps stored metadata to the status answer's error field, or undefined.
 *
 * - code provider_key_missing: always the gateway constant, whatever was stored.
 * - code execution_failed with the stored message exactly
 *   'AI provider usage limit reached': the gateway constant.
 * - anything else: undefined.
 */
export function readAllowListedExecutionError(
  metadata: unknown,
): AllowListedExecutionError | undefined {
  if (!isRecord(metadata)) {
    return undefined;
  }
  const executionError = metadata.executionError;
  if (!isRecord(executionError)) {
    return undefined;
  }
  const code = executionError.code;
  if (code === PROVIDER_KEY_MISSING_CODE) {
    return { code: PROVIDER_KEY_MISSING_CODE, message: PROVIDER_KEY_MISSING_MESSAGE };
  }
  if (
    code === PROVIDER_USAGE_LIMIT_CODE &&
    executionError.message === PROVIDER_USAGE_LIMIT_MESSAGE
  ) {
    return { code: PROVIDER_USAGE_LIMIT_CODE, message: PROVIDER_USAGE_LIMIT_MESSAGE };
  }
  return undefined;
}
