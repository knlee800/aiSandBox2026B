import { NoOpCreditDeductionGateway } from '../noop-credit-deduction.gateway';
import type { CreditDeductionEvent } from '../types';

describe('NoOpCreditDeductionGateway', () => {
  let gateway: NoOpCreditDeductionGateway;

  beforeEach(() => {
    gateway = new NoOpCreditDeductionGateway();
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
          creditsRequested: 2.5,
        },
      ],
      ...overrides,
    };
  }

  it('returns zero credits applied for every line item', () => {
    const result = gateway.applyDeduction(makeEvent());

    expect(result.totalCreditsApplied).toBe(0);
    expect(result.totalCreditsOverflow).toBe(0);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].creditsApplied).toBe(0);
    expect(result.lineItems[0].creditsRequested).toBe(2.5);
    expect(result.lineItems[0].skippedDuplicate).toBe(false);
  });

  it('preserves source metadata in the result', () => {
    const event = makeEvent({
      source: 'token_usage',
      sourceEventId: 'tu-999',
      ownerId: 'user-456',
    });

    const result = gateway.applyDeduction(event);

    expect(result.source).toBe('token_usage');
    expect(result.sourceEventId).toBe('tu-999');
    expect(result.ownerId).toBe('user-456');
  });

  it('sums totalCreditsRequested across multiple line items', () => {
    const event = makeEvent({
      lineItems: [
        {
          category: 'model_tokens',
          unit: '1K_tokens',
          unitCount: 1,
          creditsRequested: 1,
        },
        {
          category: 'workspace_runtime',
          unit: 'minute',
          creditsRequested: 3,
          unitCount: 3,
        },
        {
          category: 'tool_call',
          unit: 'call',
          creditsRequested: 4,
          unitCount: 2,
        },
      ],
    });

    const result = gateway.applyDeduction(event);

    expect(result.totalCreditsRequested).toBe(8);
    expect(result.totalCreditsApplied).toBe(0);
    expect(result.lineItems).toHaveLength(3);
  });

  it('handles an event with zero line items', () => {
    const event = makeEvent({ lineItems: [] });
    const result = gateway.applyDeduction(event);

    expect(result.totalCreditsRequested).toBe(0);
    expect(result.totalCreditsApplied).toBe(0);
    expect(result.lineItems).toHaveLength(0);
  });

  it('returns undefined balanceAfter (no balance tracking in no-op)', () => {
    const result = gateway.applyDeduction(makeEvent());
    expect(result.balanceAfter).toBeUndefined();
  });

  it('is deterministic — same input produces same output', () => {
    const event = makeEvent();
    const first = gateway.applyDeduction(event);
    const second = gateway.applyDeduction(event);

    expect(first).toEqual(second);
  });
});
