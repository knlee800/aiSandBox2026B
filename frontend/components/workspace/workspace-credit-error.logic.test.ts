import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, test } from 'node:test';
import { toCreditBalanceGuidance } from './workspace-credit-error.logic';

const copies = {
  exhausted:
    'Ask/Build is blocked because your credit balance is {count}. Credit balance is separate from token and session quota.',
  notProvisioned:
    'Ask/Build is blocked because a credit balance has not been provisioned for this account. Credit balance is separate from token and session quota.',
  paymentRequired:
    'Ask/Build is blocked because credit is required. Credit balance is separate from token and session quota.',
};

describe('workspace credit error logic', () => {
  test('maps 402 exhausted with current_balance 0', () => {
    const message = toCreditBalanceGuidance({
      statusCode: 402,
      payload: {
        statusCode: 402,
        message: 'Insufficient credit balance',
        details: {
          error_code: 'credit_balance_exhausted',
          current_balance: 0,
        },
      },
      copies,
    });
    assert.equal(
      message,
      'Ask/Build is blocked because your credit balance is 0. Credit balance is separate from token and session quota.',
    );
  });

  test('maps 402 exhausted with current_balance 3', () => {
    const message = toCreditBalanceGuidance({
      statusCode: 402,
      payload: {
        details: {
          error_code: 'credit_balance_exhausted',
          current_balance: 3,
        },
      },
      copies,
    });
    assert.equal(
      message,
      'Ask/Build is blocked because your credit balance is 3. Credit balance is separate from token and session quota.',
    );
  });

  test('maps 402 exhausted without current_balance to 0', () => {
    const message = toCreditBalanceGuidance({
      statusCode: 402,
      payload: {
        details: {
          error_code: 'credit_balance_exhausted',
        },
      },
      copies,
    });
    assert.equal(
      message,
      'Ask/Build is blocked because your credit balance is 0. Credit balance is separate from token and session quota.',
    );
  });

  test('maps 402 not-provisioned without count leak', () => {
    const message = toCreditBalanceGuidance({
      statusCode: 402,
      payload: {
        details: {
          error_code: 'credit_balance_not_provisioned',
        },
      },
      copies,
    });
    assert.equal(
      message,
      'Ask/Build is blocked because a credit balance has not been provisioned for this account. Credit balance is separate from token and session quota.',
    );
    assert.equal(message?.includes('{count}'), false);
  });

  test('maps 402 missing or unknown error_code to generic copy', () => {
    assert.equal(
      toCreditBalanceGuidance({
        statusCode: 402,
        payload: {
          message: 'Insufficient credit balance',
        },
        copies,
      }),
      copies.paymentRequired,
    );
    assert.equal(
      toCreditBalanceGuidance({
        statusCode: 402,
        payload: {
          details: {
            error_code: 'unknown_credit_code',
          },
        },
        copies,
      }),
      copies.paymentRequired,
    );
  });

  test('maps flattened top-level error_code', () => {
    const message = toCreditBalanceGuidance({
      statusCode: 402,
      payload: {
        error_code: 'credit_balance_exhausted',
        current_balance: 3,
      },
      copies,
    });
    assert.equal(
      message,
      'Ask/Build is blocked because your credit balance is 3. Credit balance is separate from token and session quota.',
    );
  });

  test('403 quota-like and 429 inputs return null', () => {
    assert.equal(
      toCreditBalanceGuidance({
        statusCode: 403,
        payload: { message: 'Quota exceeded for current window' },
        copies,
      }),
      null,
    );
    assert.equal(
      toCreditBalanceGuidance({
        statusCode: 429,
        payload: { message: 'Too many requests' },
        copies,
      }),
      null,
    );
  });

  test('non-402 English insufficient-credit message returns null', () => {
    assert.equal(
      toCreditBalanceGuidance({
        statusCode: 500,
        payload: { message: 'Insufficient credit balance' },
        copies,
      }),
      null,
    );
  });
});

describe('workspace credit write-set contract', () => {
  test('new credit sources stay GET-only and omit billing mutation paths', () => {
    const frontendRoot = resolve(__dirname, '../..');
    const files = [
      resolve(__dirname, '../../hooks/useCreditBalance.ts'),
      resolve(__dirname, './workspace-credit-error.logic.ts'),
      resolve(__dirname, './workspace-shell.tsx'),
      resolve(__dirname, './workspace-sidebar.tsx'),
      join(frontendRoot, 'app', '[locale]', 'app', 'page.tsx'),
    ];
    const needles = [
      ['str', 'ipe'].join(''),
      ['chec', 'kout'].join(''),
      ['top', 'Up'].join(''),
      ['top', '-up'].join(''),
      ['/api/billing/', 'subscription'].join(''),
      ['/api/admin/', 'credit'].join(''),
    ];

    for (const filePath of files) {
      const source = readFileSync(filePath, 'utf-8');
      for (const needle of needles) {
        assert.equal(
          source.toLowerCase().includes(needle.toLowerCase()),
          false,
          `${filePath} contains ${needle}`,
        );
      }
    }

    const hookSource = readFileSync(resolve(__dirname, '../../hooks/useCreditBalance.ts'), 'utf-8');
    assert.match(hookSource, /fetch\(\s*['"]\/api\/billing\/balance['"]/);
    assert.equal(/method:\s*['"]POST['"]/.test(hookSource), false);
  });
});
