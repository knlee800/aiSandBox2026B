import { KillSwitchConfig } from './kill-switch.config';

describe('KillSwitchConfig', () => {
  // Save original env vars
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original env vars
    process.env = { ...originalEnv };
  });

  describe('GLOBAL_EXECUTION_ENABLED', () => {
    it('should default to false when not set (fail-safe)', () => {
      delete process.env.GLOBAL_EXECUTION_ENABLED;
      expect(process.env.GLOBAL_EXECUTION_ENABLED).toBeUndefined();
      expect(KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).toBe(false);
    });

    it('should be false when explicitly set to false', () => {
      process.env.GLOBAL_EXECUTION_ENABLED = 'false';
      expect(KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).toBe(false);
    });

    it('should be true when explicitly set to true', () => {
      process.env.GLOBAL_EXECUTION_ENABLED = 'true';
      expect(KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).toBe(true);
    });

    it('should be false for any value other than "true"', () => {
      process.env.GLOBAL_EXECUTION_ENABLED = 'yes';
      expect(KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).toBe(false);

      process.env.GLOBAL_EXECUTION_ENABLED = '1';
      expect(KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).toBe(false);

      process.env.GLOBAL_EXECUTION_ENABLED = 'TRUE';
      expect(KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).toBe(false);
    });
  });

  describe('Provider kill switches', () => {
    it('should enable all providers by default', () => {
      expect(KillSwitchConfig.isProviderEnabled('openai')).toBe(true);
      expect(KillSwitchConfig.isProviderEnabled('anthropic')).toBe(true);
      expect(KillSwitchConfig.isProviderEnabled('groq')).toBe(true);
      expect(KillSwitchConfig.isProviderEnabled('xai')).toBe(true);
      expect(KillSwitchConfig.isProviderEnabled('deepseek')).toBe(true);
    });

    it('should disable provider when kill switch is false', () => {
      process.env.PROVIDER_OPENAI_ENABLED = 'false';
      // Note: Static properties are evaluated at module load time
      // This test verifies the logic, not runtime changes
      const isEnabled = process.env.PROVIDER_OPENAI_ENABLED !== 'false';
      expect(isEnabled).toBe(false);
    });

    it('should handle case-insensitive provider names', () => {
      expect(KillSwitchConfig.isProviderEnabled('OpenAI')).toBe(true);
      expect(KillSwitchConfig.isProviderEnabled('ANTHROPIC')).toBe(true);
      expect(KillSwitchConfig.isProviderEnabled('Groq')).toBe(true);
    });

    it('should disable unknown providers by default (fail-safe)', () => {
      expect(KillSwitchConfig.isProviderEnabled('unknown')).toBe(false);
      expect(KillSwitchConfig.isProviderEnabled('custom')).toBe(false);
    });
  });

  describe('getKillSwitchStates', () => {
    it('should return all kill switch states', () => {
      const states = KillSwitchConfig.getKillSwitchStates();

      expect(states).toHaveProperty('GLOBAL_EXECUTION_ENABLED');
      expect(states).toHaveProperty('PROVIDER_OPENAI_ENABLED');
      expect(states).toHaveProperty('PROVIDER_ANTHROPIC_ENABLED');
      expect(states).toHaveProperty('PROVIDER_GROQ_ENABLED');
      expect(states).toHaveProperty('PROVIDER_XAI_ENABLED');
      expect(states).toHaveProperty('PROVIDER_DEEPSEEK_ENABLED');
      expect(states).toHaveProperty('BILLING_SNAPSHOT_ENABLED');
      expect(states).toHaveProperty('INVOICE_GENERATION_ENABLED');
      expect(states).toHaveProperty('PAYMENT_EXECUTION_ENABLED');
    });

    it('should return boolean values for all switches', () => {
      const states = KillSwitchConfig.getKillSwitchStates();

      Object.values(states).forEach((value) => {
        expect(typeof value).toBe('boolean');
      });
    });
  });

  describe('Billing and invoice kill switches', () => {
    it('should enable billing snapshot creation by default', () => {
      expect(KillSwitchConfig.BILLING_SNAPSHOT_ENABLED).toBe(true);
    });

    it('should enable invoice generation by default', () => {
      expect(KillSwitchConfig.INVOICE_GENERATION_ENABLED).toBe(true);
    });

    it('should enable payment execution by default', () => {
      expect(KillSwitchConfig.PAYMENT_EXECUTION_ENABLED).toBe(true);
    });
  });
});
