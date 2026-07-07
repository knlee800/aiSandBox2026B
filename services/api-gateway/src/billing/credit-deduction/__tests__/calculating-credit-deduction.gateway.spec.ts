import { CalculatingCreditDeductionGateway } from '../calculating-credit-deduction.gateway';
import { CreditCalculationService } from '../credit-calculation.service';
import { CreditDeductionGateway } from '../credit-deduction.gateway';
import { CreditDeductionModule } from '../credit-deduction.module';
import { Test } from '@nestjs/testing';
import type { CreditDeductionEvent } from '../types';

describe('CalculatingCreditDeductionGateway', () => {
  let gateway: CalculatingCreditDeductionGateway;
  let calculationService: CreditCalculationService;

  beforeEach(() => {
    calculationService = new CreditCalculationService();
    gateway = new CalculatingCreditDeductionGateway(calculationService);
  });

  function makeEvent(
    overrides: Partial<CreditDeductionEvent> = {},
  ): CreditDeductionEvent {
    return {
      source: 'usage_ledger',
      sourceEventId: 'evt-001',
      ownerId: 'user-123',
      occurredAt: new Date('2026-07-01T00:00:00.000Z'),
      lineItems: [
        {
          category: 'model_tokens',
          unit: '1K_tokens',
          unitCount: 2.5,
          creditsRequested: 0,
        },
      ],
      ...overrides,
    };
  }

  describe('class hierarchy', () => {
    it('extends CreditDeductionGateway', () => {
      expect(gateway).toBeInstanceOf(CreditDeductionGateway);
    });

    it('is bound via CreditDeductionModule', async () => {
      const module = await Test.createTestingModule({
        imports: [CreditDeductionModule],
      }).compile();

      const resolved = module.get(CreditDeductionGateway);
      expect(resolved).toBeInstanceOf(CalculatingCreditDeductionGateway);
    });
  });

  describe('single line item — model_tokens', () => {
    it('calculates credits from unitCount × rate (1 credit/1K tokens)', () => {
      const result = gateway.applyDeduction(makeEvent());

      expect(result.totalCreditsRequested).toBe(2.5);
      expect(result.totalCreditsApplied).toBe(2.5);
      expect(result.totalCreditsOverflow).toBe(0);
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].creditsRequested).toBe(2.5);
      expect(result.lineItems[0].creditsApplied).toBe(2.5);
      expect(result.lineItems[0].creditsOverflow).toBe(0);
      expect(result.lineItems[0].skippedDuplicate).toBe(false);
    });

    it('calculates 10 credits for 10K tokens', () => {
      const event = makeEvent({
        lineItems: [
          {
            category: 'model_tokens',
            unit: '1K_tokens',
            unitCount: 10,
            creditsRequested: 0,
          },
        ],
      });

      const result = gateway.applyDeduction(event);
      expect(result.totalCreditsApplied).toBe(10);
    });
  });

  describe('single line item — tool_call', () => {
    it('calculates credits from unitCount × rate (2 credits/call)', () => {
      const event = makeEvent({
        lineItems: [
          {
            category: 'tool_call',
            unit: 'call',
            unitCount: 3,
            creditsRequested: 0,
          },
        ],
      });

      const result = gateway.applyDeduction(event);
      expect(result.totalCreditsApplied).toBe(6);
      expect(result.lineItems[0].creditsApplied).toBe(6);
    });
  });

  describe('single line item — workspace_runtime', () => {
    it('calculates credits from unitCount × rate (1 credit/minute)', () => {
      const event = makeEvent({
        lineItems: [
          {
            category: 'workspace_runtime',
            unit: 'minute',
            unitCount: 15,
            creditsRequested: 0,
          },
        ],
      });

      const result = gateway.applyDeduction(event);
      expect(result.totalCreditsApplied).toBe(15);
    });
  });

  describe('multiple line items', () => {
    it('sums credits across all line items', () => {
      const event = makeEvent({
        lineItems: [
          {
            category: 'model_tokens',
            unit: '1K_tokens',
            unitCount: 5,
            creditsRequested: 0,
          },
          {
            category: 'tool_call',
            unit: 'call',
            unitCount: 2,
            creditsRequested: 0,
          },
          {
            category: 'workspace_runtime',
            unit: 'minute',
            unitCount: 10,
            creditsRequested: 0,
          },
        ],
      });

      const result = gateway.applyDeduction(event);

      // model_tokens: 5 × 1 = 5
      // tool_call: 2 × 2 = 4
      // workspace_runtime: 10 × 1 = 10
      // total = 19
      expect(result.totalCreditsRequested).toBe(19);
      expect(result.totalCreditsApplied).toBe(19);
      expect(result.totalCreditsOverflow).toBe(0);
      expect(result.lineItems).toHaveLength(3);
      expect(result.lineItems[0].creditsApplied).toBe(5);
      expect(result.lineItems[1].creditsApplied).toBe(4);
      expect(result.lineItems[2].creditsApplied).toBe(10);
    });
  });

  describe('zero and edge cases', () => {
    it('handles zero unitCount — returns 0 credits', () => {
      const event = makeEvent({
        lineItems: [
          {
            category: 'model_tokens',
            unit: '1K_tokens',
            unitCount: 0,
            creditsRequested: 0,
          },
        ],
      });

      const result = gateway.applyDeduction(event);
      expect(result.totalCreditsApplied).toBe(0);
      expect(result.lineItems[0].creditsApplied).toBe(0);
    });

    it('handles empty lineItems array', () => {
      const event = makeEvent({ lineItems: [] });
      const result = gateway.applyDeduction(event);

      expect(result.totalCreditsRequested).toBe(0);
      expect(result.totalCreditsApplied).toBe(0);
      expect(result.lineItems).toHaveLength(0);
    });

    it('handles negative unitCount — returns 0 credits', () => {
      const event = makeEvent({
        lineItems: [
          {
            category: 'model_tokens',
            unit: '1K_tokens',
            unitCount: -5,
            creditsRequested: 0,
          },
        ],
      });

      const result = gateway.applyDeduction(event);
      expect(result.totalCreditsApplied).toBe(0);
    });
  });

  describe('source metadata preservation', () => {
    it('preserves source, sourceEventId, ownerId, occurredAt', () => {
      const occurredAt = new Date('2026-07-04T12:00:00.000Z');
      const event = makeEvent({
        source: 'token_usage',
        sourceEventId: 'tu-abc-123',
        ownerId: 'user-xyz',
        occurredAt,
      });

      const result = gateway.applyDeduction(event);

      expect(result.source).toBe('token_usage');
      expect(result.sourceEventId).toBe('tu-abc-123');
      expect(result.ownerId).toBe('user-xyz');
      expect(result.occurredAt).toBe(occurredAt);
    });
  });

  describe('no persistence / no balance', () => {
    it('returns undefined balanceAfter', () => {
      const result = gateway.applyDeduction(makeEvent());
      expect(result.balanceAfter).toBeUndefined();
    });

    it('never returns non-zero overflow', () => {
      const event = makeEvent({
        lineItems: [
          {
            category: 'model_tokens',
            unit: '1K_tokens',
            unitCount: 99999,
            creditsRequested: 0,
          },
        ],
      });

      const result = gateway.applyDeduction(event);
      expect(result.totalCreditsOverflow).toBe(0);
      expect(result.lineItems[0].creditsOverflow).toBe(0);
    });
  });

  describe('determinism and idempotency', () => {
    it('same event produces identical result', () => {
      const event = makeEvent({
        lineItems: [
          {
            category: 'model_tokens',
            unit: '1K_tokens',
            unitCount: 3.7,
            creditsRequested: 0,
          },
          {
            category: 'tool_call',
            unit: 'call',
            unitCount: 2,
            creditsRequested: 0,
          },
        ],
      });

      const first = gateway.applyDeduction(event);
      const second = gateway.applyDeduction(event);

      expect(first).toEqual(second);
    });

    it('recalculates regardless of creditsRequested in input', () => {
      const eventWithZero = makeEvent({
        lineItems: [
          {
            category: 'tool_call',
            unit: 'call',
            unitCount: 4,
            creditsRequested: 0,
          },
        ],
      });

      const eventWithPreCalc = makeEvent({
        lineItems: [
          {
            category: 'tool_call',
            unit: 'call',
            unitCount: 4,
            creditsRequested: 999,
          },
        ],
      });

      const resultZero = gateway.applyDeduction(eventWithZero);
      const resultPreCalc = gateway.applyDeduction(eventWithPreCalc);

      expect(resultZero.totalCreditsApplied).toBe(8);
      expect(resultPreCalc.totalCreditsApplied).toBe(8);
      expect(resultZero.totalCreditsApplied).toBe(
        resultPreCalc.totalCreditsApplied,
      );
    });
  });

  describe('realistic scenario: usage-ledger completion', () => {
    it('handles typical AI execution event (tokens + runtime)', () => {
      const event: CreditDeductionEvent = {
        source: 'usage_ledger',
        sourceEventId: 'exec-uuid-12345',
        ownerId: 'user-billable-001',
        occurredAt: new Date('2026-07-05T15:30:00.000Z'),
        lineItems: [
          {
            category: 'model_tokens',
            unit: '1K_tokens',
            unitCount: 4.2,
            creditsRequested: 0,
          },
          {
            category: 'workspace_runtime',
            unit: 'minute',
            unitCount: 3,
            creditsRequested: 0,
          },
        ],
        metadata: {
          model: 'gpt-4',
          sessionId: 'sess-abc',
        },
      };

      const result = gateway.applyDeduction(event);

      // model_tokens: 4.2 × 1 = 4.2
      // workspace_runtime: 3 × 1 = 3
      // total = 7.2
      expect(result.totalCreditsApplied).toBeCloseTo(7.2);
      expect(result.sourceEventId).toBe('exec-uuid-12345');
      expect(result.ownerId).toBe('user-billable-001');
      expect(result.balanceAfter).toBeUndefined();
    });
  });
});
