import {
  ChargeReadinessService,
  SystemChargeReadiness,
} from '../charge-readiness.service';
import { ReconciliationService } from '../reconciliation.service';
import { StripePaymentProvider } from '../../payments/providers/stripe-payment.provider';
import type { ProviderMode } from '../../payments/interfaces/payment-provider.interface';

function createMockReconciliationService(): jest.Mocked<
  Pick<ReconciliationService, 'getInvoiceDriftReport'>
> {
  return {
    getInvoiceDriftReport: jest.fn(),
  };
}

function createMockStripeProvider(
  overrides: {
    mode?: ProviderMode;
    configValid?: boolean;
  } = {},
): jest.Mocked<
  Pick<
    StripePaymentProvider,
    'validateConfiguration' | 'getProviderMode' | 'getProviderName'
  >
> {
  return {
    validateConfiguration: jest.fn().mockReturnValue(overrides.configValid ?? false),
    getProviderMode: jest.fn().mockReturnValue(overrides.mode ?? 'disabled'),
    getProviderName: jest.fn().mockReturnValue('stripe'),
  };
}

function buildService(
  chargesEnabled: boolean,
  providerOverrides: { mode?: ProviderMode; configValid?: boolean } = {},
): {
  service: ChargeReadinessService;
  reconciliation: ReturnType<typeof createMockReconciliationService>;
  provider: ReturnType<typeof createMockStripeProvider>;
} {
  const originalEnv = process.env.BILLING_CHARGES_ENABLED;
  process.env.BILLING_CHARGES_ENABLED = chargesEnabled ? 'true' : 'false';

  const reconciliation = createMockReconciliationService();
  const provider = createMockStripeProvider(providerOverrides);

  const service = new ChargeReadinessService(
    reconciliation as unknown as ReconciliationService,
    provider as unknown as StripePaymentProvider,
  );

  process.env.BILLING_CHARGES_ENABLED = originalEnv;

  return { service, reconciliation, provider };
}

describe('ChargeReadinessService (BILLING-READY-05A)', () => {
  // -----------------------------------------------------------------------
  // isChargingEnabledAtSystemLevel (kill-switch)
  // -----------------------------------------------------------------------

  describe('isChargingEnabledAtSystemLevel', () => {
    it('returns false when BILLING_CHARGES_ENABLED=false', () => {
      const { service } = buildService(false);
      expect(service.isChargingEnabledAtSystemLevel()).toBe(false);
    });

    it('returns true when BILLING_CHARGES_ENABLED=true', () => {
      const { service } = buildService(true, {
        mode: 'stub',
        configValid: true,
      });
      expect(service.isChargingEnabledAtSystemLevel()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getSystemChargeReadiness — extended fields
  // -----------------------------------------------------------------------

  describe('getSystemChargeReadiness', () => {
    it('includes providerMode field', () => {
      const { service } = buildService(false, {
        mode: 'disabled',
        configValid: false,
      });
      const result: SystemChargeReadiness = service.getSystemChargeReadiness();
      expect(result).toHaveProperty('providerMode');
      expect(result.providerMode).toBe('disabled');
    });

    it('includes providerModeValid field', () => {
      const { service } = buildService(false, {
        mode: 'disabled',
        configValid: false,
      });
      const result = service.getSystemChargeReadiness();
      expect(result).toHaveProperty('providerModeValid');
    });

    it('reports providerModeValid=false when provider is disabled', () => {
      const { service } = buildService(false, {
        mode: 'disabled',
        configValid: false,
      });
      const result = service.getSystemChargeReadiness();
      expect(result.providerModeValid).toBe(false);
      expect(result.paymentProviderConfigured).toBe(false);
    });

    it('reports providerModeValid=true when provider is stub', () => {
      const { service } = buildService(false, {
        mode: 'stub',
        configValid: true,
      });
      const result = service.getSystemChargeReadiness();
      expect(result.providerModeValid).toBe(true);
      expect(result.paymentProviderConfigured).toBe(true);
    });

    it('reports providerMode=test when provider resolves to test', () => {
      const { service } = buildService(true, {
        mode: 'test',
        configValid: true,
      });
      const result = service.getSystemChargeReadiness();
      expect(result.providerMode).toBe('test');
      expect(result.providerModeValid).toBe(true);
    });

    it('blocks when BILLING_CHARGES_ENABLED=false regardless of provider mode', () => {
      const { service } = buildService(false, {
        mode: 'stub',
        configValid: true,
      });
      const result = service.getSystemChargeReadiness();
      expect(result.ready).toBe(false);
      expect(result.blockingReasons).toContain('BILLING_CHARGES_ENABLED=false');
    });

    it('blocks when provider is disabled even if charges enabled', () => {
      const { service } = buildService(true, {
        mode: 'disabled',
        configValid: false,
      });
      const result = service.getSystemChargeReadiness();
      expect(result.ready).toBe(false);
      expect(result.blockingReasons).toContain(
        'Payment provider not configured',
      );
    });

    it('preserves chargesEnabledAtSystemLevel field', () => {
      const { service } = buildService(true, {
        mode: 'stub',
        configValid: true,
      });
      const result = service.getSystemChargeReadiness();
      expect(result.chargesEnabledAtSystemLevel).toBe(true);
    });

    it('ready=true only when charges enabled and provider configured', () => {
      const { service } = buildService(true, {
        mode: 'stub',
        configValid: true,
      });
      const result = service.getSystemChargeReadiness();
      expect(result.ready).toBe(true);
      expect(result.blockingReasons).toHaveLength(0);
    });

    it('blockingReasons includes provider mode disabled reason', () => {
      const { service } = buildService(true, {
        mode: 'disabled',
        configValid: false,
      });
      const result = service.getSystemChargeReadiness();
      expect(
        result.blockingReasons.some(
          (r) =>
            r.includes('not configured') || r.includes('disabled'),
        ),
      ).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // checkInvoiceChargeReadiness (existing behavior preserved)
  // -----------------------------------------------------------------------

  describe('checkInvoiceChargeReadiness', () => {
    it('blocks when BILLING_CHARGES_ENABLED=false', async () => {
      const { service, reconciliation } = buildService(false, {
        mode: 'stub',
        configValid: true,
      });
      reconciliation.getInvoiceDriftReport.mockResolvedValue({
        invoice: { status: 'finalized' },
        status: 'OK',
        flags: { highRiskDrift: false },
      } as any);

      const result = await service.checkInvoiceChargeReadiness(1);
      expect(result.ready).toBe(false);
      expect(result.blockingReasons).toContain(
        'BILLING_CHARGES_ENABLED=false (charging disabled at system level)',
      );
    });

    it('blocks when payment provider configuration is invalid', async () => {
      const { service, reconciliation } = buildService(true, {
        mode: 'disabled',
        configValid: false,
      });
      reconciliation.getInvoiceDriftReport.mockResolvedValue({
        invoice: { status: 'finalized' },
        status: 'OK',
        flags: { highRiskDrift: false },
      } as any);

      const result = await service.checkInvoiceChargeReadiness(1);
      expect(result.ready).toBe(false);
      expect(
        result.blockingReasons.some((r) =>
          r.includes('configuration invalid'),
        ),
      ).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // No secret leakage in readiness results
  // -----------------------------------------------------------------------

  describe('no secrets in results', () => {
    it('readiness result contains no secret values', () => {
      const { service } = buildService(false, {
        mode: 'disabled',
        configValid: false,
      });
      const result = service.getSystemChargeReadiness();
      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(/sk_test_/);
      expect(serialized).not.toMatch(/sk_live_/);
      expect(serialized).not.toMatch(/whsec_/);
    });
  });
});
