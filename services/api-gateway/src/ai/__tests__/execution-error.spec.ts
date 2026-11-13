import {
  PROVIDER_KEY_MISSING_CODE,
  PROVIDER_KEY_MISSING_MESSAGE,
  PROVIDER_USAGE_LIMIT_CODE,
  PROVIDER_USAGE_LIMIT_MESSAGE,
  readAllowListedExecutionError,
} from '../execution-error';

describe('readAllowListedExecutionError (PROVIDER-KEY-01 C2)', () => {
  it('keeps the contract constants', () => {
    expect(PROVIDER_KEY_MISSING_CODE).toBe('provider_key_missing');
    expect(PROVIDER_KEY_MISSING_MESSAGE).toBe('AI provider is not configured');
    expect(PROVIDER_USAGE_LIMIT_CODE).toBe('execution_failed');
    expect(PROVIDER_USAGE_LIMIT_MESSAGE).toBe('AI provider usage limit reached');
  });

  it('returns provider_key_missing with the gateway constant', () => {
    expect(
      readAllowListedExecutionError({
        executionError: { code: 'provider_key_missing', message: 'AI provider is not configured' },
      }),
    ).toEqual({ code: 'provider_key_missing', message: 'AI provider is not configured' });
  });

  it('never echoes a different stored message for provider_key_missing', () => {
    for (const message of [
      'XAI_API_KEY=sk-abcdefghijklmnop is missing',
      'This step failed.',
      '',
      undefined,
      42,
    ]) {
      const result = readAllowListedExecutionError({
        executionError: { code: 'provider_key_missing', message },
      });
      expect(result).toEqual({
        code: 'provider_key_missing',
        message: 'AI provider is not configured',
      });
      expect(JSON.stringify(result)).not.toContain('sk-');
    }
  });

  it('returns the usage-limit entry for execution_failed with exactly the stored sentence', () => {
    expect(
      readAllowListedExecutionError({
        executionError: { code: 'execution_failed', message: 'AI provider usage limit reached' },
      }),
    ).toEqual({ code: 'execution_failed', message: 'AI provider usage limit reached' });
  });

  it('returns nothing for execution_failed with any other sentence', () => {
    for (const message of [
      'This step failed.',
      'AI provider usage limit reached.',
      ' AI provider usage limit reached',
      'ai provider usage limit reached',
      'AI provider usage limit reached for sk-abcdefghijklmnop',
      'Invalid request to Anthropic API',
      '',
      undefined,
    ]) {
      expect(
        readAllowListedExecutionError({ executionError: { code: 'execution_failed', message } }),
      ).toBeUndefined();
    }
  });

  it('returns nothing for the usage-limit sentence under any other code', () => {
    for (const code of ['provider_unavailable', 'harness_tool_loop_disabled', 'EXECUTION_FAILED', undefined]) {
      expect(
        readAllowListedExecutionError({
          executionError: { code, message: 'AI provider usage limit reached' },
        }),
      ).toBeUndefined();
    }
  });

  it('returns nothing for other codes, a missing error or malformed metadata', () => {
    expect(
      readAllowListedExecutionError({
        executionError: { code: 'file_action_contract_failure', message: 'Builder execution produced no valid file actions' },
      }),
    ).toBeUndefined();
    expect(readAllowListedExecutionError({ executionError: { code: 'harness_entitlement_proof_missing', message: 'x' } })).toBeUndefined();
    expect(readAllowListedExecutionError({})).toBeUndefined();
    expect(readAllowListedExecutionError({ executionError: 'provider_key_missing' })).toBeUndefined();
    expect(readAllowListedExecutionError({ executionError: ['provider_key_missing'] })).toBeUndefined();
    expect(readAllowListedExecutionError(null)).toBeUndefined();
    expect(readAllowListedExecutionError(undefined)).toBeUndefined();
    expect(readAllowListedExecutionError('provider_key_missing')).toBeUndefined();
  });
});
