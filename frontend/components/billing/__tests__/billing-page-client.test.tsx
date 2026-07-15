import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BillingBalanceCard from '../billing-balance-card';
import BillingSubscriptionCard from '../billing-subscription-card';
import BillingTopUpSection from '../billing-topup-section';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const messagesDir = resolve(__dirname, '../../../messages');
const enMessages = JSON.parse(readFileSync(resolve(messagesDir, 'en.json'), 'utf-8'));
const zhTWMessages = JSON.parse(readFileSync(resolve(messagesDir, 'zh-TW.json'), 'utf-8'));
const zhCNMessages = JSON.parse(readFileSync(resolve(messagesDir, 'zh-CN.json'), 'utf-8'));

function tFactory(msgs: Record<string, any>, namespace: string) {
  return (key: string) => {
    const ns = msgs[namespace];
    return ns?.[key] ?? `${namespace}.${key}`;
  };
}

const tEn = tFactory(enMessages, 'billing');
const tZhTW = tFactory(zhTWMessages, 'billing');
const tZhCN = tFactory(zhCNMessages, 'billing');

// ---------------------------------------------------------------------------
// Translation key presence tests
// ---------------------------------------------------------------------------

describe('Translation keys', () => {
  const requiredKeys = [
    'pageTitle', 'balance', 'balanceCredits', 'monthlyAllocation',
    'monthlyAllocationValue', 'subscription', 'currentPlan',
    'planFree', 'planStarter', 'planPro', 'planTeam',
    'statusActive', 'statusTrialing', 'statusPastDue',
    'statusCancelled', 'statusExpired', 'renewsOn', 'cancelledOn',
    'upgradePlan', 'upgradeTo', 'topUp', 'topUpPack', 'buyCredits',
    'checkoutSuccess', 'checkoutCancelled', 'manageSubscription',
    'manageSubscriptionComingSoon', 'billingUnavailable',
    'billingUnavailableDetail', 'loadError', 'retry', 'loading',
    'noSubscription', 'freeCreditsNote', 'activeSubscriptionExists',
    'invalidRequest', 'checkoutError', 'backToWorkspace',
  ];

  test('en.json has all billing keys', () => {
    for (const key of requiredKeys) {
      assert.ok(
        enMessages.billing?.[key],
        `Missing en.json billing.${key}`,
      );
    }
  });

  test('zh-TW.json has all billing keys', () => {
    for (const key of requiredKeys) {
      assert.ok(
        zhTWMessages.billing?.[key],
        `Missing zh-TW.json billing.${key}`,
      );
    }
  });

  test('zh-CN.json has all billing keys', () => {
    for (const key of requiredKeys) {
      assert.ok(
        zhCNMessages.billing?.[key],
        `Missing zh-CN.json billing.${key}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// BillingBalanceCard rendering
// ---------------------------------------------------------------------------

describe('BillingBalanceCard', () => {
  test('renders balance value when data exists', () => {
    const html = renderToStaticMarkup(
      <BillingBalanceCard
        balance={{
          balance: 12345,
          monthlyAllocation: 25000,
          planId: 'pro',
          periodStart: '2026-07-01T00:00:00.000Z',
          periodEnd: '2026-08-01T00:00:00.000Z',
          status: 'active',
        }}
        t={tEn}
      />,
    );
    assert.ok(html.includes('12,345'), 'Should render formatted balance');
    assert.ok(html.includes('25,000'), 'Should render monthly allocation');
  });

  test('renders zero when balance is null (empty state)', () => {
    const html = renderToStaticMarkup(
      <BillingBalanceCard balance={null} t={tEn} />,
    );
    assert.ok(html.includes('0'), 'Should render 0 for null balance');
  });

  test('uses Heroicons CreditCardIcon', () => {
    const html = renderToStaticMarkup(
      <BillingBalanceCard balance={null} t={tEn} />,
    );
    assert.ok(html.includes('svg'), 'Should contain SVG icon');
  });
});

// ---------------------------------------------------------------------------
// BillingSubscriptionCard rendering
// ---------------------------------------------------------------------------

describe('BillingSubscriptionCard', () => {
  test('renders free plan state when no subscription', () => {
    const html = renderToStaticMarkup(
      <BillingSubscriptionCard subscription={null} balance={null} t={tEn} />,
    );
    assert.ok(html.includes('Free'), 'Should show Free plan');
    assert.ok(html.includes('500'), 'Should show free plan credit note');
  });

  test('renders active subscription plan and status', () => {
    const html = renderToStaticMarkup(
      <BillingSubscriptionCard
        subscription={{
          planType: 'pro',
          status: 'active',
          currentPeriodStart: '2026-07-01T00:00:00.000Z',
          currentPeriodEnd: '2026-08-01T00:00:00.000Z',
          cancelAt: null,
        }}
        balance={null}
        t={tEn}
      />,
    );
    assert.ok(html.includes('Pro'), 'Should show Pro plan');
    assert.ok(html.includes('Active'), 'Should show Active status');
  });

  test('renders cancelled subscription with cancel date', () => {
    const html = renderToStaticMarkup(
      <BillingSubscriptionCard
        subscription={{
          planType: 'starter',
          status: 'active',
          currentPeriodStart: '2026-07-01T00:00:00.000Z',
          currentPeriodEnd: '2026-08-01T00:00:00.000Z',
          cancelAt: '2026-08-01T00:00:00.000Z',
        }}
        balance={null}
        t={tEn}
      />,
    );
    assert.ok(html.includes('Cancelled'), 'Should include cancelled text');
  });

  test('renders all plan types correctly', () => {
    for (const plan of ['starter', 'pro', 'team']) {
      const html = renderToStaticMarkup(
        <BillingSubscriptionCard
          subscription={{
            planType: plan,
            status: 'active',
            currentPeriodStart: '2026-07-01T00:00:00.000Z',
            currentPeriodEnd: '2026-08-01T00:00:00.000Z',
            cancelAt: null,
          }}
          balance={null}
          t={tEn}
        />,
      );
      const expectedLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
      assert.ok(html.includes(expectedLabel), `Should render ${expectedLabel}`);
    }
  });

  test('renders all status types correctly', () => {
    for (const status of ['active', 'trialing', 'past_due']) {
      const html = renderToStaticMarkup(
        <BillingSubscriptionCard
          subscription={{
            planType: 'pro',
            status,
            currentPeriodStart: '2026-07-01T00:00:00.000Z',
            currentPeriodEnd: '2026-08-01T00:00:00.000Z',
            cancelAt: null,
          }}
          balance={null}
          t={tEn}
        />,
      );
      assert.ok(html.includes('svg'), `Should contain status for ${status}`);
    }
  });
});

// ---------------------------------------------------------------------------
// BillingTopUpSection rendering
// ---------------------------------------------------------------------------

describe('BillingTopUpSection', () => {
  test('renders 3 top-up packages', () => {
    const html = renderToStaticMarkup(
      <BillingTopUpSection
        t={tEn}
        onCheckout={() => {}}
        checkoutLoading={null}
        disabled={false}
      />,
    );
    assert.ok(html.includes('1,000'), 'Should render 1,000 pack');
    assert.ok(html.includes('5,000'), 'Should render 5,000 pack');
    assert.ok(html.includes('20,000'), 'Should render 20,000 pack');
  });

  test('renders buy buttons for each pack', () => {
    const html = renderToStaticMarkup(
      <BillingTopUpSection
        t={tEn}
        onCheckout={() => {}}
        checkoutLoading={null}
        disabled={false}
      />,
    );
    assert.ok(html.includes('Buy'), 'Should contain Buy button text');
  });

  test('renders disabled buttons when disabled=true', () => {
    const html = renderToStaticMarkup(
      <BillingTopUpSection
        t={tEn}
        onCheckout={() => {}}
        checkoutLoading={null}
        disabled={true}
      />,
    );
    assert.ok(html.includes('disabled'), 'Should have disabled attribute');
  });

  test('renders loading state for specific pack', () => {
    const html = renderToStaticMarkup(
      <BillingTopUpSection
        t={tEn}
        onCheckout={() => {}}
        checkoutLoading="topup_1000"
        disabled={true}
      />,
    );
    assert.ok(html.includes('...'), 'Should show loading indicator');
  });
});

// ---------------------------------------------------------------------------
// Heroicons-only usage check
// ---------------------------------------------------------------------------

describe('Heroicons-only usage', () => {
  test('billing components do not import Lucide/FontAwesome/Material', () => {
    const componentFiles = [
      resolve(__dirname, '../billing-page-client.tsx'),
      resolve(__dirname, '../billing-balance-card.tsx'),
      resolve(__dirname, '../billing-subscription-card.tsx'),
      resolve(__dirname, '../billing-topup-section.tsx'),
    ];

    for (const filePath of componentFiles) {
      const content = readFileSync(filePath, 'utf-8');
      assert.ok(
        !content.includes('lucide-react'),
        `${filePath} must not import lucide-react`,
      );
      assert.ok(
        !content.includes('font-awesome'),
        `${filePath} must not import font-awesome`,
      );
      assert.ok(
        !content.includes('@mui/icons'),
        `${filePath} must not import @mui/icons`,
      );
      assert.ok(
        content.includes('@heroicons/react/24/outline') || !content.includes('Icon'),
        `${filePath} should only use @heroicons/react/24/outline`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// No provider/customer portal API calls check
// ---------------------------------------------------------------------------

describe('No provider/portal calls', () => {
  test('billing components do not call Stripe or customer portal APIs', () => {
    const componentFiles = [
      resolve(__dirname, '../billing-page-client.tsx'),
      resolve(__dirname, '../billing-balance-card.tsx'),
      resolve(__dirname, '../billing-subscription-card.tsx'),
      resolve(__dirname, '../billing-topup-section.tsx'),
    ];

    for (const filePath of componentFiles) {
      const content = readFileSync(filePath, 'utf-8');
      assert.ok(
        !content.includes('createBillingPortalSession'),
        `${filePath} must not call createBillingPortalSession`,
      );
      assert.ok(
        !content.includes('stripe.com'),
        `${filePath} must not reference stripe.com`,
      );
      assert.ok(
        !content.includes('customer-portal'),
        `${filePath} must not reference customer-portal`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Customer portal disabled state
// ---------------------------------------------------------------------------

describe('Customer portal disabled state', () => {
  test('billing-page-client renders disabled manage subscription button', () => {
    const content = readFileSync(resolve(__dirname, '../billing-page-client.tsx'), 'utf-8');
    assert.ok(
      content.includes('disabled'),
      'Should have disabled customer portal button',
    );
    assert.ok(
      content.includes('manageSubscriptionComingSoon'),
      'Should reference coming soon key',
    );
  });
});

// ---------------------------------------------------------------------------
// Checkout URL generation
// ---------------------------------------------------------------------------

describe('Checkout URL generation', () => {
  test('billing-page-client builds success/cancel URLs from origin and locale', () => {
    const content = readFileSync(resolve(__dirname, '../billing-page-client.tsx'), 'utf-8');
    assert.ok(
      content.includes('window.location.origin'),
      'Should use window.location.origin for URL base',
    );
    assert.ok(
      content.includes('checkout=success'),
      'Should include checkout=success param',
    );
    assert.ok(
      content.includes('checkout=cancelled'),
      'Should include checkout=cancelled param',
    );
    assert.ok(
      content.includes('/${locale}/billing'),
      'Should build URL with locale',
    );
  });
});

// ---------------------------------------------------------------------------
// Checkout request payloads
// ---------------------------------------------------------------------------

describe('Checkout request payloads', () => {
  test('top-up checkout sends topUpPackId, successUrl, cancelUrl', () => {
    const content = readFileSync(resolve(__dirname, '../billing-page-client.tsx'), 'utf-8');
    assert.ok(content.includes('topUpPackId'), 'Should send topUpPackId');
    assert.ok(content.includes('successUrl'), 'Should send successUrl');
    assert.ok(content.includes('cancelUrl'), 'Should send cancelUrl');
    assert.ok(
      content.includes('/api/billing/checkout/topup'),
      'Should call topup endpoint',
    );
  });

  test('subscription checkout sends planId, successUrl, cancelUrl', () => {
    const content = readFileSync(resolve(__dirname, '../billing-page-client.tsx'), 'utf-8');
    assert.ok(content.includes('planId'), 'Should send planId');
    assert.ok(
      content.includes('/api/billing/checkout/subscription'),
      'Should call subscription endpoint',
    );
  });
});

// ---------------------------------------------------------------------------
// No hardcoded English copy in components
// ---------------------------------------------------------------------------

describe('No hardcoded English copy', () => {
  test('components use translation keys for user-facing text', () => {
    const componentFiles = [
      resolve(__dirname, '../billing-balance-card.tsx'),
      resolve(__dirname, '../billing-subscription-card.tsx'),
      resolve(__dirname, '../billing-topup-section.tsx'),
    ];

    const hardcodedPatterns = [
      /['"]Credit Balance['"]/,
      /['"]Monthly Allowance['"]/,
      /['"]Top Up Credits['"]/,
      /['"]Buy \d+ Credits['"]/,
      /['"]Subscription['"]/,
      /['"]Manage Subscription['"]/,
    ];

    for (const filePath of componentFiles) {
      const content = readFileSync(filePath, 'utf-8');
      for (const pattern of hardcodedPatterns) {
        assert.ok(
          !pattern.test(content),
          `${filePath} should not have hardcoded: ${pattern}`,
        );
      }
    }
  });
});
