import { CreditBalance } from '../../../entities/credit-balance.entity';
import { getMetadataArgsStorage } from 'typeorm';

describe('CreditBalance entity schema', () => {
  it('is decorated as entity with table name credit_balances', () => {
    const tables = getMetadataArgsStorage().tables;
    const entry = tables.find((t) => t.target === CreditBalance);
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('credit_balances');
  });

  it('has all required columns with correct DB names', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === CreditBalance,
    );

    const columnMap = new Map(
      columns.map((c) => [
        c.propertyName,
        c.options,
      ]),
    );

    expect(columnMap.has('ownerId')).toBe(true);
    expect(columnMap.get('ownerId')?.name).toBe('owner_id');

    expect(columnMap.has('ownerType')).toBe(true);
    expect(columnMap.get('ownerType')?.name).toBe('owner_type');
    expect(columnMap.get('ownerType')?.default).toBe('user');

    expect(columnMap.has('planId')).toBe(true);
    expect(columnMap.get('planId')?.name).toBe('plan_id');
    expect(columnMap.get('planId')?.default).toBe('free');

    expect(columnMap.has('balance')).toBe(true);
    expect(columnMap.get('balance')?.type).toBe('integer');
    expect(columnMap.get('balance')?.default).toBe(0);

    expect(columnMap.has('monthlyAllocation')).toBe(true);
    expect(columnMap.get('monthlyAllocation')?.name).toBe('monthly_allocation');

    expect(columnMap.has('rolloverBalance')).toBe(true);
    expect(columnMap.get('rolloverBalance')?.name).toBe('rollover_balance');

    expect(columnMap.has('status')).toBe(true);
    expect(columnMap.get('status')?.default).toBe('active');

    expect(columnMap.has('periodStart')).toBe(true);
    expect(columnMap.get('periodStart')?.name).toBe('period_start');

    expect(columnMap.has('periodEnd')).toBe(true);
    expect(columnMap.get('periodEnd')?.name).toBe('period_end');

    expect(columnMap.has('resetAt')).toBe(true);
    expect(columnMap.get('resetAt')?.name).toBe('reset_at');
    expect(columnMap.get('resetAt')?.nullable).toBe(true);
  });

  it('has UUID primary generated column', () => {
    const generatedColumns = getMetadataArgsStorage().generations.filter(
      (g) => g.target === CreditBalance,
    );
    expect(generatedColumns.length).toBe(1);
    expect(generatedColumns[0].propertyName).toBe('id');
    expect(generatedColumns[0].strategy).toBe('uuid');
  });

  it('has CreateDateColumn for createdAt and UpdateDateColumn for updatedAt', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === CreditBalance,
    );

    const createdAt = columns.find((c) => c.propertyName === 'createdAt');
    expect(createdAt).toBeDefined();
    expect(createdAt!.mode).toBe('createDate');

    const updatedAt = columns.find((c) => c.propertyName === 'updatedAt');
    expect(updatedAt).toBeDefined();
    expect(updatedAt!.mode).toBe('updateDate');
  });

  it('has unique index on (ownerId, ownerType)', () => {
    const indices = getMetadataArgsStorage().indices.filter(
      (i) => i.target === CreditBalance,
    );

    const ownerIdx = indices.find(
      (i) => (i as any).name === 'idx_credit_balances_owner',
    );
    expect(ownerIdx).toBeDefined();
    expect(ownerIdx!.unique).toBe(true);
  });

  it('has check constraints for balance and period', () => {
    const checks = getMetadataArgsStorage().checks.filter(
      (c) => c.target === CreditBalance,
    );

    const balanceCheck = checks.find(
      (c) => (c as any).name === 'chk_credit_balances_balance_non_negative',
    );
    expect(balanceCheck).toBeDefined();

    const periodCheck = checks.find(
      (c) => (c as any).name === 'chk_credit_balances_period_valid',
    );
    expect(periodCheck).toBeDefined();
  });

  it('can be instantiated with defaults', () => {
    const entity = new CreditBalance();
    expect(entity).toBeInstanceOf(CreditBalance);
    expect(entity.id).toBeUndefined();
    expect(entity.resetAt).toBeUndefined();
  });
});
