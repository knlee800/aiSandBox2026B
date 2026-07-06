import {
  CREDIT_CATEGORIES,
  type CreditCategory,
  type CreditRate,
} from '../types';

/**
 * Versioned placeholder credit rates.
 * These are foundation values for deterministic testing and future tuning.
 */
export const CREDIT_RATE_VERSION = '2026-07-v1';

const CREDIT_RATE_BY_CATEGORY: Readonly<Record<CreditCategory, CreditRate>> = {
  model_tokens: {
    category: 'model_tokens',
    unit: '1K_tokens',
    creditsPerUnit: 1,
    description: 'Placeholder rate for model token usage.',
  },
  tool_call: {
    category: 'tool_call',
    unit: 'call',
    creditsPerUnit: 2,
    description: 'Placeholder rate for tool invocation.',
  },
  workspace_runtime: {
    category: 'workspace_runtime',
    unit: 'minute',
    creditsPerUnit: 1,
    description: 'Placeholder rate for workspace runtime.',
  },
  knowledge_ingestion: {
    category: 'knowledge_ingestion',
    unit: 'item',
    creditsPerUnit: 3,
    description: 'Placeholder rate for knowledge ingestion.',
  },
  knowledge_summarization: {
    category: 'knowledge_summarization',
    unit: 'summary',
    creditsPerUnit: 4,
    description: 'Placeholder rate for knowledge summarization.',
  },
  collaboration_referral: {
    category: 'collaboration_referral',
    unit: 'event',
    creditsPerUnit: 5,
    description: 'Placeholder rate for collaboration referral events.',
  },
  collaboration_contribution: {
    category: 'collaboration_contribution',
    unit: 'event',
    creditsPerUnit: 2,
    description: 'Placeholder rate for collaboration contribution events.',
  },
  validation_action: {
    category: 'validation_action',
    unit: 'action',
    creditsPerUnit: 1,
    description: 'Placeholder rate for validation actions.',
  },
  browser_action: {
    category: 'browser_action',
    unit: 'action',
    creditsPerUnit: 2,
    description: 'Placeholder rate for browser actions.',
  },
};

export const CREDIT_RATES: readonly CreditRate[] = CREDIT_CATEGORIES.map(
  (category) => CREDIT_RATE_BY_CATEGORY[category],
);
