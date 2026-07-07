import { CreditCalculationService } from '../credit-calculation.service';
import {
  CREDIT_RATES,
  CREDIT_RATE_VERSION,
  CREDIT_CATEGORIES,
  type CreditCategory,
} from '../../../credit-ledger';
import type { CreditDeductionLineItem } from '../types';

describe('CreditCalculationService', () => {
  let service: CreditCalculationService;

  beforeEach(() => {
    service = new CreditCalculationService();
  });

  describe('getRateVersion', () => {
    it('returns the current rate version', () => {
      expect(service.getRateVersion()).toBe(CREDIT_RATE_VERSION);
      expect(service.getRateVersion()).toBe('2026-07-v1');
    });
  });

  describe('getRateForCategory', () => {
    it('returns a rate for every configured category', () => {
      for (const category of CREDIT_CATEGORIES) {
        const rate = service.getRateForCategory(category);
        expect(rate).toBeDefined();
        expect(rate!.category).toBe(category);
        expect(rate!.creditsPerUnit).toBeGreaterThan(0);
      }
    });

    it('returns undefined for an unknown category', () => {
      const rate = service.getRateForCategory(
        'nonexistent_category' as CreditCategory,
      );
      expect(rate).toBeUndefined();
    });
  });

  describe('calculateCredits', () => {
    it('model_tokens: 1 credit per 1K tokens', () => {
      expect(service.calculateCredits('model_tokens', 1)).toBe(1);
      expect(service.calculateCredits('model_tokens', 2.5)).toBe(2.5);
      expect(service.calculateCredits('model_tokens', 10)).toBe(10);
    });

    it('tool_call: 2 credits per call', () => {
      expect(service.calculateCredits('tool_call', 1)).toBe(2);
      expect(service.calculateCredits('tool_call', 3)).toBe(6);
      expect(service.calculateCredits('tool_call', 0.5)).toBe(1);
    });

    it('workspace_runtime: 1 credit per minute', () => {
      expect(service.calculateCredits('workspace_runtime', 5)).toBe(5);
      expect(service.calculateCredits('workspace_runtime', 60)).toBe(60);
    });

    it('knowledge_ingestion: 3 credits per item', () => {
      expect(service.calculateCredits('knowledge_ingestion', 1)).toBe(3);
      expect(service.calculateCredits('knowledge_ingestion', 4)).toBe(12);
    });

    it('knowledge_summarization: 4 credits per summary', () => {
      expect(service.calculateCredits('knowledge_summarization', 1)).toBe(4);
      expect(service.calculateCredits('knowledge_summarization', 2)).toBe(8);
    });

    it('collaboration_referral: 5 credits per event', () => {
      expect(service.calculateCredits('collaboration_referral', 1)).toBe(5);
      expect(service.calculateCredits('collaboration_referral', 3)).toBe(15);
    });

    it('collaboration_contribution: 2 credits per event', () => {
      expect(service.calculateCredits('collaboration_contribution', 1)).toBe(2);
      expect(service.calculateCredits('collaboration_contribution', 5)).toBe(10);
    });

    it('validation_action: 1 credit per action', () => {
      expect(service.calculateCredits('validation_action', 1)).toBe(1);
      expect(service.calculateCredits('validation_action', 7)).toBe(7);
    });

    it('browser_action: 2 credits per action', () => {
      expect(service.calculateCredits('browser_action', 1)).toBe(2);
      expect(service.calculateCredits('browser_action', 4)).toBe(8);
    });

    it('returns 0 for unknown category', () => {
      expect(
        service.calculateCredits('unknown' as CreditCategory, 10),
      ).toBe(0);
    });

    it('returns 0 for zero unitCount', () => {
      expect(service.calculateCredits('model_tokens', 0)).toBe(0);
    });

    it('returns 0 for negative unitCount', () => {
      expect(service.calculateCredits('model_tokens', -5)).toBe(0);
    });

    it('returns 0 for NaN unitCount', () => {
      expect(service.calculateCredits('model_tokens', NaN)).toBe(0);
    });

    it('returns 0 for Infinity unitCount', () => {
      expect(service.calculateCredits('model_tokens', Infinity)).toBe(0);
    });

    it('returns 0 for -Infinity unitCount', () => {
      expect(service.calculateCredits('model_tokens', -Infinity)).toBe(0);
    });

    it('handles fractional unitCount correctly', () => {
      expect(service.calculateCredits('model_tokens', 0.5)).toBe(0.5);
      expect(service.calculateCredits('tool_call', 1.5)).toBe(3);
    });

    it('is deterministic — same input always returns same output', () => {
      const first = service.calculateCredits('model_tokens', 7.3);
      const second = service.calculateCredits('model_tokens', 7.3);
      const third = service.calculateCredits('model_tokens', 7.3);
      expect(first).toBe(second);
      expect(second).toBe(third);
    });
  });

  describe('calculateLineItemCredits', () => {
    it('calculates from unitCount regardless of creditsRequested', () => {
      const lineItem: CreditDeductionLineItem = {
        category: 'model_tokens',
        unit: '1K_tokens',
        unitCount: 5,
        creditsRequested: 0,
      };
      expect(service.calculateLineItemCredits(lineItem)).toBe(5);
    });

    it('recalculates even when creditsRequested is non-zero', () => {
      const lineItem: CreditDeductionLineItem = {
        category: 'tool_call',
        unit: 'call',
        unitCount: 3,
        creditsRequested: 999,
      };
      expect(service.calculateLineItemCredits(lineItem)).toBe(6);
    });

    it('returns 0 for zero unitCount in line item', () => {
      const lineItem: CreditDeductionLineItem = {
        category: 'workspace_runtime',
        unit: 'minute',
        unitCount: 0,
        creditsRequested: 5,
      };
      expect(service.calculateLineItemCredits(lineItem)).toBe(0);
    });
  });

  describe('rate config integrity', () => {
    it('every CREDIT_RATES entry has a positive creditsPerUnit', () => {
      for (const rate of CREDIT_RATES) {
        expect(rate.creditsPerUnit).toBeGreaterThan(0);
      }
    });

    it('covers all known categories', () => {
      for (const category of CREDIT_CATEGORIES) {
        const rate = service.getRateForCategory(category);
        expect(rate).toBeDefined();
      }
    });
  });
});
