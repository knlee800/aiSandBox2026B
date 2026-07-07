import { CreditDeductionRecord } from '../../../entities/credit-deduction-record.entity';
import { getMetadataArgsStorage } from 'typeorm';

describe('CreditDeductionRecord entity schema', () => {
  it('is decorated as entity with table name credit_deduction_records', () => {
    const tables = getMetadataArgsStorage().tables;
    const entry = tables.find((t) => t.target === CreditDeductionRecord);
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('credit_deduction_records');
  });

  it('has all required columns with correct DB names', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === CreditDeductionRecord,
    );

    const columnMap = new Map(
      columns.map((c) => [c.propertyName, c.options]),
    );

    expect(columnMap.has('ownerId')).toBe(true);
    expect(columnMap.get('ownerId')?.name).toBe('owner_id');

    expect(columnMap.has('sourceEventId')).toBe(true);
    expect(columnMap.get('sourceEventId')?.name).toBe('source_event_id');
    expect(columnMap.get('sourceEventId')?.length).toBe(255);

    expect(columnMap.has('sourceEventType')).toBe(true);
    expect(columnMap.get('sourceEventType')?.name).toBe('source_event_type');

    expect(columnMap.has('requestedCredits')).toBe(true);
    expect(columnMap.get('requestedCredits')?.name).toBe('requested_credits');
    expect(columnMap.get('requestedCredits')?.type).toBe('integer');

    expect(columnMap.has('appliedCredits')).toBe(true);
    expect(columnMap.get('appliedCredits')?.name).toBe('applied_credits');

    expect(columnMap.has('overflowCredits')).toBe(true);
    expect(columnMap.get('overflowCredits')?.name).toBe('overflow_credits');

    expect(columnMap.has('balanceBefore')).toBe(true);
    expect(columnMap.get('balanceBefore')?.name).toBe('balance_before');

    expect(columnMap.has('balanceAfter')).toBe(true);
    expect(columnMap.get('balanceAfter')?.name).toBe('balance_after');

    expect(columnMap.has('lineItems')).toBe(true);
    expect(columnMap.get('lineItems')?.type).toBe('jsonb');
    expect(columnMap.get('lineItems')?.name).toBe('line_items');

    expect(columnMap.has('metadata')).toBe(true);
    expect(columnMap.get('metadata')?.type).toBe('jsonb');
    expect(columnMap.get('metadata')?.nullable).toBe(true);

    expect(columnMap.has('status')).toBe(true);
    expect(columnMap.get('status')?.default).toBe('applied');
  });

  it('has nullable optional columns', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === CreditDeductionRecord,
    );

    const columnMap = new Map(
      columns.map((c) => [c.propertyName, c.options]),
    );

    expect(columnMap.get('agentId')?.nullable).toBe(true);
    expect(columnMap.get('sessionId')?.nullable).toBe(true);
    expect(columnMap.get('executionId')?.nullable).toBe(true);
    expect(columnMap.get('modelId')?.nullable).toBe(true);
    expect(columnMap.get('metadata')?.nullable).toBe(true);
  });

  it('has UUID primary generated column', () => {
    const generatedColumns = getMetadataArgsStorage().generations.filter(
      (g) => g.target === CreditDeductionRecord,
    );
    expect(generatedColumns.length).toBe(1);
    expect(generatedColumns[0].propertyName).toBe('id');
    expect(generatedColumns[0].strategy).toBe('uuid');
  });

  it('has CreateDateColumn for createdAt (no UpdateDateColumn — immutable)', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === CreditDeductionRecord,
    );

    const createdAt = columns.find((c) => c.propertyName === 'createdAt');
    expect(createdAt).toBeDefined();
    expect(createdAt!.mode).toBe('createDate');

    const updatedAt = columns.find((c) => c.propertyName === 'updatedAt');
    expect(updatedAt).toBeUndefined();
  });

  it('has unique index on sourceEventId for idempotency', () => {
    const indices = getMetadataArgsStorage().indices.filter(
      (i) => i.target === CreditDeductionRecord,
    );

    const sourceEventIdx = indices.find(
      (i) =>
        (i as any).name === 'idx_credit_deduction_records_source_event',
    );
    expect(sourceEventIdx).toBeDefined();
    expect(sourceEventIdx!.unique).toBe(true);
  });

  it('has check constraints for credits and balance consistency', () => {
    const checks = getMetadataArgsStorage().checks.filter(
      (c) => c.target === CreditDeductionRecord,
    );

    const creditsCheck = checks.find(
      (c) =>
        (c as any).name ===
        'chk_credit_deduction_records_credits_non_negative',
    );
    expect(creditsCheck).toBeDefined();

    const balanceCheck = checks.find(
      (c) =>
        (c as any).name ===
        'chk_credit_deduction_records_balance_consistency',
    );
    expect(balanceCheck).toBeDefined();
  });

  it('has required indexes for query patterns', () => {
    const indices = getMetadataArgsStorage().indices.filter(
      (i) => i.target === CreditDeductionRecord,
    );

    const indexNames = indices.map((i) => (i as any).name);
    expect(indexNames).toContain('idx_credit_deduction_records_owner_created');
    expect(indexNames).toContain('idx_credit_deduction_records_owner_status');
    expect(indexNames).toContain('idx_credit_deduction_records_session');
    expect(indexNames).toContain('idx_credit_deduction_records_execution');
    expect(indexNames).toContain('idx_credit_deduction_records_created_at');
  });

  it('can be instantiated with defaults', () => {
    const entity = new CreditDeductionRecord();
    expect(entity).toBeInstanceOf(CreditDeductionRecord);
    expect(entity.id).toBeUndefined();
    expect(entity.agentId).toBeUndefined();
    expect(entity.sessionId).toBeUndefined();
    expect(entity.executionId).toBeUndefined();
    expect(entity.modelId).toBeUndefined();
    expect(entity.metadata).toBeUndefined();
  });
});
