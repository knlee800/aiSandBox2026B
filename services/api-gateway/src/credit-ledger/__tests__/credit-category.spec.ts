import { CREDIT_CATEGORIES } from '../types/credit-category';

describe('credit-category', () => {
  const expectedCategories = [
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

  it('contains all expected categories', () => {
    expect(CREDIT_CATEGORIES).toEqual(expectedCategories);
  });

  it('has no duplicate categories', () => {
    expect(new Set(CREDIT_CATEGORIES).size).toBe(CREDIT_CATEGORIES.length);
  });

  it('uses stable string category values', () => {
    for (const category of CREDIT_CATEGORIES) {
      expect(typeof category).toBe('string');
      expect(category).toBe(category.toLowerCase());
      expect(category).not.toMatch(/\s/);
    }
  });
});
