import { Logger, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { UserEntitlementEntity } from '../entities/user-entitlement.entity';
import { AuthModule } from './auth.module';
import { EntitlementService } from './entitlement.service';

const TARGET_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';

describe('EntitlementService resolveHarnessEntitled', () => {
  function readService(findOne: jest.Mock): EntitlementService {
    return new EntitlementService(
      { findOne, manager: { transaction: jest.fn() } } as never,
      { findOne: jest.fn() } as never,
    );
  }

  it('selects only harnessEnabled and returns false when no row exists', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const service = readService(findOne);

    await expect(service.resolveHarnessEntitled(TARGET_ID)).resolves.toBe(false);
    expect(findOne).toHaveBeenCalledWith({
      where: { userId: TARGET_ID },
      select: ['harnessEnabled'],
    });
  });

  it('returns true only when the row harnessEnabled is true', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValueOnce({ harnessEnabled: true })
      .mockResolvedValueOnce({ harnessEnabled: false });
    const service = readService(findOne);

    await expect(service.resolveHarnessEntitled(TARGET_ID)).resolves.toBe(true);
    await expect(service.resolveHarnessEntitled(TARGET_ID)).resolves.toBe(false);
  });

  it('logs the userId only and returns false when the repository throws', async () => {
    const findOne = jest.fn().mockRejectedValue(new Error('secret sql'));
    const service = readService(findOne);
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    try {
      await expect(service.resolveHarnessEntitled(TARGET_ID)).resolves.toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(TARGET_ID);
      expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('secret sql');
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('EntitlementService setEntitlements', () => {
  function existingRow(
    overrides: Partial<UserEntitlementEntity> = {},
  ): UserEntitlementEntity {
    return {
      userId: TARGET_ID,
      harnessEnabled: false,
      agentWriteEnabled: true,
      planOverride: 'pro',
      dailyTokenLimitOverride: 1000,
      updatedBy: '33333333-3333-4333-8333-333333333333',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  function setup(options: {
    user: { id: string } | null;
    existing: UserEntitlementEntity | null;
    auditError?: Error;
  }) {
    const persisted: UserEntitlementEntity[] = [];
    const saveCalls: UserEntitlementEntity[] = [];
    const auditRows: Array<Record<string, unknown>> = [];
    let committed = false;
    let rolledBack = false;

    const txEntitlements = {
      findOne: jest.fn(async () => options.existing),
      save: jest.fn(async (row: UserEntitlementEntity) => {
        saveCalls.push(row);
        persisted.push(row);
        return row;
      }),
    };
    const txAudit = {
      save: jest.fn(async (row: Record<string, unknown>) => {
        if (options.auditError) {
          throw options.auditError;
        }
        const saved = { ...row, id: 'audit-1' };
        auditRows.push(saved);
        return saved;
      }),
    };
    const entitlements = {
      findOne: jest.fn(),
      manager: {
        transaction: jest.fn(async (callback: (manager: unknown) => Promise<unknown>) => {
          const manager = {
            getRepository: (entity: unknown) => {
              if (entity === UserEntitlementEntity) {
                return txEntitlements;
              }
              if (entity === AuditEventEntity) {
                return txAudit;
              }
              throw new Error('unexpected repository');
            },
          };
          try {
            const result = await callback(manager);
            committed = true;
            return result;
          } catch (error) {
            rolledBack = true;
            persisted.splice(0, persisted.length);
            throw error;
          }
        }),
      },
    };
    const users = {
      findOne: jest.fn(async () => options.user),
    };
    const service = new EntitlementService(entitlements as never, users as never);
    return {
      service,
      users,
      entitlements,
      txEntitlements,
      auditRows,
      saveCalls,
      persisted,
      flags: () => ({ committed, rolledBack }),
    };
  }

  it('upserts from no row and writes one audit row for the actor', async () => {
    const { service, users, entitlements, txEntitlements, auditRows, flags } = setup({
      user: { id: TARGET_ID },
      existing: null,
    });

    const result = await service.setEntitlements(TARGET_ID, ACTOR_ID, {
      harnessEnabled: true,
      reason: 'seed',
    });

    expect(users.findOne).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      select: ['id'],
    });
    expect(entitlements.findOne).not.toHaveBeenCalled();
    expect(txEntitlements.findOne).toHaveBeenCalledWith({
      where: { userId: TARGET_ID },
    });
    expect(flags().committed).toBe(true);
    expect(result.userId).toBe(TARGET_ID);
    expect(result.before).toBeNull();
    expect(result.auditEventId).toBe('audit-1');
    expect(result.after).toEqual({
      userId: TARGET_ID,
      harnessEnabled: true,
      agentWriteEnabled: false,
      planOverride: null,
      dailyTokenLimitOverride: null,
      updatedBy: ACTOR_ID,
      updatedAt: result.after.updatedAt,
    });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      id: 'audit-1',
      category: 'entitlement',
      eventType: 'entitlement.updated',
      subjectType: 'user',
      subjectId: TARGET_ID,
      userId: ACTOR_ID,
    });
    expect(auditRows[0].occurredAt).toEqual(new Date(result.after.updatedAt));
    expect(auditRows[0].payload).toEqual({
      targetUserId: TARGET_ID,
      actorUserId: ACTOR_ID,
      reason: 'seed',
      before: null,
      after: result.after,
      changedFields: ['harnessEnabled'],
    });
  });

  it('keeps omitted fields on a partial update', async () => {
    const { service, auditRows } = setup({
      user: { id: TARGET_ID },
      existing: existingRow(),
    });

    const result = await service.setEntitlements(TARGET_ID, ACTOR_ID, {
      harnessEnabled: true,
      reason: 'enable harness',
    });

    expect(result.before).toMatchObject({
      harnessEnabled: false,
      agentWriteEnabled: true,
      planOverride: 'pro',
      dailyTokenLimitOverride: 1000,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.after).toMatchObject({
      harnessEnabled: true,
      agentWriteEnabled: true,
      planOverride: 'pro',
      dailyTokenLimitOverride: 1000,
      updatedBy: ACTOR_ID,
    });
    expect(auditRows[0].payload).toMatchObject({
      changedFields: ['harnessEnabled'],
    });
  });

  it('clears overrides when the patch sends null', async () => {
    const { service, auditRows } = setup({
      user: { id: TARGET_ID },
      existing: existingRow(),
    });

    const result = await service.setEntitlements(TARGET_ID, ACTOR_ID, {
      planOverride: null,
      dailyTokenLimitOverride: null,
      reason: 'clear overrides',
    });

    expect(result.after.planOverride).toBeNull();
    expect(result.after.dailyTokenLimitOverride).toBeNull();
    expect(result.after.harnessEnabled).toBe(false);
    expect(result.after.agentWriteEnabled).toBe(true);
    expect((auditRows[0].payload as { changedFields: string[] }).changedFields).toEqual([
      'planOverride',
      'dailyTokenLimitOverride',
    ]);
  });

  it('records a no-op with empty changedFields', async () => {
    const { service, auditRows } = setup({
      user: { id: TARGET_ID },
      existing: existingRow({ harnessEnabled: true }),
    });

    const result = await service.setEntitlements(TARGET_ID, ACTOR_ID, {
      harnessEnabled: true,
      reason: 'repeat',
    });

    expect(result.after.harnessEnabled).toBe(true);
    expect(result.after.updatedBy).toBe(ACTOR_ID);
    expect((auditRows[0].payload as { changedFields: string[] }).changedFields).toEqual([]);
    expect(auditRows).toHaveLength(1);
  });

  it('rolls back the entitlement change when the audit insert fails', async () => {
    const { service, saveCalls, persisted, flags } = setup({
      user: { id: TARGET_ID },
      existing: null,
      auditError: new Error('audit insert failed'),
    });

    await expect(
      service.setEntitlements(TARGET_ID, ACTOR_ID, {
        harnessEnabled: true,
        reason: 'seed',
      }),
    ).rejects.toThrow('audit insert failed');

    expect(saveCalls).toHaveLength(1);
    expect(persisted).toHaveLength(0);
    expect(flags()).toEqual({ committed: false, rolledBack: true });
  });

  it('writes actor equal to subject when an admin changes their own row', async () => {
    const { service, auditRows } = setup({
      user: { id: ACTOR_ID },
      existing: null,
    });

    const result = await service.setEntitlements(ACTOR_ID, ACTOR_ID, {
      harnessEnabled: true,
      reason: 'seed myself',
    });

    expect(result.userId).toBe(ACTOR_ID);
    expect(result.after.updatedBy).toBe(ACTOR_ID);
    expect(auditRows[0].userId).toBe(ACTOR_ID);
    expect(auditRows[0].subjectId).toBe(ACTOR_ID);
    expect(auditRows[0].payload).toMatchObject({
      targetUserId: ACTOR_ID,
      actorUserId: ACTOR_ID,
    });
  });

  it('throws NotFoundException and does not open a transaction when the user is missing', async () => {
    const { service, entitlements } = setup({
      user: null,
      existing: null,
    });

    await expect(
      service.setEntitlements(TARGET_ID, ACTOR_ID, {
        harnessEnabled: true,
        reason: 'missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(entitlements.manager.transaction).not.toHaveBeenCalled();
  });
});

describe('AuthModule entitlement wiring', () => {
  it('provides and exports EntitlementService and registers both entities', () => {
    const providers = Reflect.getMetadata('providers', AuthModule) as unknown[];
    const exported = Reflect.getMetadata('exports', AuthModule) as unknown[];
    expect(providers).toContain(EntitlementService);
    expect(exported).toContain(EntitlementService);

    const imports = Reflect.getMetadata('imports', AuthModule) as Array<{
      providers?: Array<{ provide?: unknown }>;
    }>;
    const entitlementToken = getRepositoryToken(UserEntitlementEntity);
    const auditToken = getRepositoryToken(AuditEventEntity);
    const feature = imports.find(
      (candidate) =>
        Array.isArray(candidate?.providers) &&
        candidate.providers.some((provider) => provider?.provide === entitlementToken) &&
        candidate.providers.some((provider) => provider?.provide === auditToken),
    );
    expect(feature).toBeDefined();
  });
});
