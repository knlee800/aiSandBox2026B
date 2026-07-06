import {
  parseStrictBooleanEnv,
  createAgentHarnessConfigV1,
  DEFAULT_AGENT_HARNESS_CONFIG_V1,
} from './agent-harness.config';

describe('parseStrictBooleanEnv', () => {
  const VAR = 'AGENT_HARNESS_ENABLE_TOOL_LOOP';

  it('returns false for undefined', () => {
    expect(parseStrictBooleanEnv(VAR, undefined, false)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(parseStrictBooleanEnv(VAR, '', false)).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(parseStrictBooleanEnv(VAR, '   ', false)).toBe(false);
  });

  it('returns false for "false"', () => {
    expect(parseStrictBooleanEnv(VAR, 'false', false)).toBe(false);
  });

  it('returns true for "true"', () => {
    expect(parseStrictBooleanEnv(VAR, 'true', false)).toBe(true);
  });

  it('returns true for " true " (trimmed)', () => {
    expect(parseStrictBooleanEnv(VAR, ' true ', false)).toBe(true);
  });

  it('returns false for " false " (trimmed)', () => {
    expect(parseStrictBooleanEnv(VAR, ' false ', false)).toBe(false);
  });

  it('returns true for "TRUE" (case-insensitive)', () => {
    expect(parseStrictBooleanEnv(VAR, 'TRUE', false)).toBe(true);
  });

  it('returns false for "FALSE" (case-insensitive)', () => {
    expect(parseStrictBooleanEnv(VAR, 'FALSE', false)).toBe(false);
  });

  it('throws for "1"', () => {
    expect(() => parseStrictBooleanEnv(VAR, '1', false)).toThrow();
  });

  it('throws for "0"', () => {
    expect(() => parseStrictBooleanEnv(VAR, '0', false)).toThrow();
  });

  it('throws for "yes"', () => {
    expect(() => parseStrictBooleanEnv(VAR, 'yes', false)).toThrow();
  });

  it('throws for "no"', () => {
    expect(() => parseStrictBooleanEnv(VAR, 'no', false)).toThrow();
  });

  it('throws for "maybe"', () => {
    expect(() => parseStrictBooleanEnv(VAR, 'maybe', false)).toThrow();
  });

  it('error message contains the variable name', () => {
    expect(() => parseStrictBooleanEnv(VAR, 'invalid', false)).toThrow(
      /AGENT_HARNESS_ENABLE_TOOL_LOOP/,
    );
  });

  it('error message does not contain the invalid raw value', () => {
    const invalidValue = 'xyzzy_sentinel_12345';
    try {
      parseStrictBooleanEnv(VAR, invalidValue, false);
      fail('Expected to throw');
    } catch (e: unknown) {
      expect((e as Error).message).not.toContain(invalidValue);
    }
  });
});

describe('createAgentHarnessConfigV1', () => {
  it('returns enableToolLoop false when env is empty', () => {
    const config = createAgentHarnessConfigV1({});
    expect(config.enableToolLoop).toBe(false);
    expect(config.enableWriteTools).toBe(false);
    expect(config.enableValidationTools).toBe(false);
  });

  it('returns enableToolLoop true when AGENT_HARNESS_ENABLE_TOOL_LOOP is "true"', () => {
    const config = createAgentHarnessConfigV1({
      AGENT_HARNESS_ENABLE_TOOL_LOOP: 'true',
    });
    expect(config.enableToolLoop).toBe(true);
  });

  it('returns a frozen config object', () => {
    const config = createAgentHarnessConfigV1({});
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('returns frozen allowedValidationCommands', () => {
    const config = createAgentHarnessConfigV1({});
    if (Array.isArray(config.allowedValidationCommands)) {
      expect(Object.isFrozen(config.allowedValidationCommands)).toBe(true);
    }
  });

  it('keeps enableBrowserSmoke false', () => {
    const config = createAgentHarnessConfigV1({
      AGENT_HARNESS_ENABLE_TOOL_LOOP: 'true',
    });
    expect(config.enableBrowserSmoke).toBe(false);
  });

  it('parses enableWriteTools and enableValidationTools true', () => {
    const config = createAgentHarnessConfigV1({
      AGENT_HARNESS_ENABLE_WRITE_TOOLS: 'true',
      AGENT_HARNESS_ENABLE_VALIDATION_TOOLS: 'true',
    });
    expect(config.enableWriteTools).toBe(true);
    expect(config.enableValidationTools).toBe(true);
  });

  it('parses enableWriteTools and enableValidationTools false', () => {
    const config = createAgentHarnessConfigV1({
      AGENT_HARNESS_ENABLE_WRITE_TOOLS: 'false',
      AGENT_HARNESS_ENABLE_VALIDATION_TOOLS: 'false',
    });
    expect(config.enableWriteTools).toBe(false);
    expect(config.enableValidationTools).toBe(false);
  });

  it('throws for invalid AGENT_HARNESS_ENABLE_WRITE_TOOLS value', () => {
    expect(() =>
      createAgentHarnessConfigV1({
        AGENT_HARNESS_ENABLE_WRITE_TOOLS: '1',
      }),
    ).toThrow(/AGENT_HARNESS_ENABLE_WRITE_TOOLS/);
  });

  it('throws for invalid AGENT_HARNESS_ENABLE_VALIDATION_TOOLS value', () => {
    expect(() =>
      createAgentHarnessConfigV1({
        AGENT_HARNESS_ENABLE_VALIDATION_TOOLS: 'yes',
      }),
    ).toThrow(/AGENT_HARNESS_ENABLE_VALIDATION_TOOLS/);
  });
});

describe('DEFAULT_AGENT_HARNESS_CONFIG_V1', () => {
  it('has enableToolLoop false in normal test environment', () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop).toBe(false);
  });

  it('defaults enableWriteTools and enableValidationTools to false', () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableWriteTools).toBe(false);
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableValidationTools).toBe(false);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_AGENT_HARNESS_CONFIG_V1)).toBe(true);
  });
});
