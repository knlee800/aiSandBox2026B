import { DEFAULT_AGENT_HARNESS_CONFIG_V1 } from '../index';

describe('Agent Harness v1 config defaults', () => {
  it('exports a default config object', () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1).toBeDefined();
    expect(typeof DEFAULT_AGENT_HARNESS_CONFIG_V1).toBe('object');
  });

  it('uses conservative safety defaults', () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.allowArbitraryShell).toBe(false);
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableBrowserSmoke).toBe(false);
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableSemanticSearch).toBe(false);
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop).toBe(false);
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.requireApprovalForDelete).toBe(true);
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.requireApprovalForPackageInstall).toBe(
      true,
    );
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.requireApprovalForEnvFileWrite).toBe(
      true,
    );
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.requireApprovalForLargeWrite).toBe(
      true,
    );
  });

  it('keeps validation command allow-list in config data', () => {
    expect(
      Array.isArray(DEFAULT_AGENT_HARNESS_CONFIG_V1.allowedValidationCommands),
    ).toBe(true);
    expect(
      DEFAULT_AGENT_HARNESS_CONFIG_V1.allowedValidationCommands.length,
    ).toBeGreaterThan(0);
  });

  it('sets sane numeric guardrails', () => {
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.maxToolIterations).toBeGreaterThan(0);
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.maxFileReadBytes).toBeGreaterThan(0);
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.maxFileWriteBytes).toBeGreaterThan(0);
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.maxToolResultBytes).toBeGreaterThan(0);
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.maxValidationOutputBytes).toBeGreaterThan(
      0,
    );
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.toolTimeoutMs).toBeGreaterThan(0);
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.validationTimeoutMs).toBeGreaterThan(
      0,
    );
    expect(DEFAULT_AGENT_HARNESS_CONFIG_V1.browserSmokeTimeoutMs).toBeGreaterThan(
      0,
    );
  });
});
