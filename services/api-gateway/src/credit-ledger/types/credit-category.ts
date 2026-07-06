/**
 * Stable credit charge categories for the credit ledger domain.
 * These values are additive foundation constants (no runtime logic).
 */
export const CREDIT_CATEGORIES = [
  'model_tokens',
  'tool_call',
  'workspace_runtime',
  'knowledge_ingestion',
  'knowledge_summarization',
  'collaboration_referral',
  'collaboration_contribution',
  'validation_action',
  'browser_action',
] as const;

export type CreditCategory = (typeof CREDIT_CATEGORIES)[number];
