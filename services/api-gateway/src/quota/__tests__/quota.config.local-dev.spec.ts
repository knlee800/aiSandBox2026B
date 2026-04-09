describe('QuotaConfig local/dev quota source', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDefaultTokensPerDay = process.env.DEFAULT_TOKENS_PER_DAY;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDefaultTokensPerDay === undefined) {
      delete process.env.DEFAULT_TOKENS_PER_DAY;
    } else {
      process.env.DEFAULT_TOKENS_PER_DAY = originalDefaultTokensPerDay;
    }
    jest.resetModules();
  });

  it('uses DEFAULT_TOKENS_PER_DAY in non-production environments', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEFAULT_TOKENS_PER_DAY = '250000';
    jest.resetModules();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { QuotaConfig } = require('../quota.config');
    const limits = QuotaConfig.getQuotaLimits('unknown-key');

    expect(limits.tokensPerDay).toBe(250000);
  });

  it('respects explicit DEFAULT_TOKENS_PER_DAY even in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEFAULT_TOKENS_PER_DAY = '999999';
    jest.resetModules();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { QuotaConfig } = require('../quota.config');
    const limits = QuotaConfig.getQuotaLimits('unknown-key');

    expect(limits.tokensPerDay).toBe(999999);
  });

  it('falls back to production default when DEFAULT_TOKENS_PER_DAY is not set', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DEFAULT_TOKENS_PER_DAY;
    jest.resetModules();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { QuotaConfig } = require('../quota.config');
    const limits = QuotaConfig.getQuotaLimits('unknown-key');

    expect(limits.tokensPerDay).toBe(10000);
  });

  it('allows multiple estimated prompts in local/dev by default source', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEFAULT_TOKENS_PER_DAY = '250000';
    jest.resetModules();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { QuotaConfig } = require('../quota.config');
    const limits = QuotaConfig.getQuotaLimits('unknown-key');
    const estimatedPerPrompt = QuotaConfig.estimateTokens();

    expect(estimatedPerPrompt).toBe(8000);
    expect(limits.tokensPerDay).toBe(250000);
    expect(Math.floor(limits.tokensPerDay / estimatedPerPrompt)).toBeGreaterThan(1);
  });
});
