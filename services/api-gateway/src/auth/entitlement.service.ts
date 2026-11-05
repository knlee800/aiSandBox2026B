import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { User } from '../entities/user.entity';
import { UserEntitlementEntity } from '../entities/user-entitlement.entity';

const TRACKED_FIELDS = [
  'harnessEnabled',
  'agentWriteEnabled',
  'planOverride',
  'dailyTokenLimitOverride',
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

export interface EntitlementPatch {
  harnessEnabled?: boolean;
  agentWriteEnabled?: boolean;
  planOverride?: string | null;
  dailyTokenLimitOverride?: number | null;
  reason: string;
}

export interface EntitlementRowView {
  userId: string;
  harnessEnabled: boolean;
  agentWriteEnabled: boolean;
  planOverride: string | null;
  dailyTokenLimitOverride: number | null;
  updatedBy: string;
  updatedAt: string;
}

export interface SetEntitlementsResult {
  userId: string;
  before: EntitlementRowView | null;
  after: EntitlementRowView;
  auditEventId: string;
}

/**
 * ACCESS-01B: table read for browser-session harness entitlement, and the
 * admin upsert that writes one audit_events row in the same transaction.
 * plan_override and daily_token_limit_override are stored and returned.
 * ACCESS-01C reads agent_write_enabled for the signed Agent tool profile.
 */
@Injectable()
export class EntitlementService {
  private readonly logger = new Logger(EntitlementService.name);

  constructor(
    @InjectRepository(UserEntitlementEntity)
    private readonly entitlements: Repository<UserEntitlementEntity>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /**
   * Table read only. No row, a false row, or a repository error is false.
   * The warn line carries the userId and not the repository error.
   */
  async resolveHarnessEntitled(userId: string): Promise<boolean> {
    try {
      const row = await this.entitlements.findOne({
        where: { userId },
        select: ['harnessEnabled'],
      });
      if (!row) {
        return false;
      }
      return row.harnessEnabled === true;
    } catch {
      this.logger.warn(userId);
      return false;
    }
  }

  /**
   * Table read only. No row, a false row, or a repository error is false.
   * The warn line carries the userId and not the repository error.
   */
  async resolveAgentWriteEnabled(userId: string): Promise<boolean> {
    try {
      const row = await this.entitlements.findOne({
        where: { userId },
        select: ['agentWriteEnabled'],
      });
      if (!row) {
        return false;
      }
      return row.agentWriteEnabled === true;
    } catch {
      this.logger.warn(userId);
      return false;
    }
  }

  async setEntitlements(
    targetUserId: string,
    actorUserId: string,
    patch: EntitlementPatch,
  ): Promise<SetEntitlementsResult> {
    const target = await this.users.findOne({
      where: { id: targetUserId },
      select: ['id'],
    });
    if (!target) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    return this.entitlements.manager.transaction(async (manager: EntityManager) => {
      const entitlementRepo = manager.getRepository(UserEntitlementEntity);
      const auditRepo = manager.getRepository(AuditEventEntity);
      const existing = await entitlementRepo.findOne({
        where: { userId: targetUserId },
      });
      const now = new Date();
      const next: UserEntitlementEntity = {
        userId: targetUserId,
        harnessEnabled:
          patch.harnessEnabled !== undefined
            ? patch.harnessEnabled
            : (existing?.harnessEnabled ?? false),
        agentWriteEnabled:
          patch.agentWriteEnabled !== undefined
            ? patch.agentWriteEnabled
            : (existing?.agentWriteEnabled ?? false),
        planOverride:
          patch.planOverride !== undefined
            ? patch.planOverride
            : (existing?.planOverride ?? null),
        dailyTokenLimitOverride:
          patch.dailyTokenLimitOverride !== undefined
            ? patch.dailyTokenLimitOverride
            : (existing?.dailyTokenLimitOverride ?? null),
        updatedBy: actorUserId,
        updatedAt: now,
      };
      const before = existing ? this.toRowView(existing) : null;
      const after = this.toRowView(next);
      await entitlementRepo.save(next);

      const savedAudit = await auditRepo.save({
        category: 'entitlement',
        eventType: 'entitlement.updated',
        subjectType: 'user',
        subjectId: targetUserId,
        userId: actorUserId,
        payload: {
          targetUserId,
          actorUserId,
          reason: patch.reason,
          before,
          after,
          changedFields: this.changedFieldNames(before, after),
        },
        occurredAt: now,
      });

      return {
        userId: targetUserId,
        before,
        after,
        auditEventId: savedAudit.id,
      };
    });
  }

  private toRowView(row: UserEntitlementEntity): EntitlementRowView {
    return {
      userId: row.userId,
      harnessEnabled: row.harnessEnabled,
      agentWriteEnabled: row.agentWriteEnabled,
      planOverride: row.planOverride,
      dailyTokenLimitOverride: row.dailyTokenLimitOverride,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private changedFieldNames(
    before: EntitlementRowView | null,
    after: EntitlementRowView,
  ): TrackedField[] {
    const previous: Pick<EntitlementRowView, TrackedField> = {
      harnessEnabled: before?.harnessEnabled ?? false,
      agentWriteEnabled: before?.agentWriteEnabled ?? false,
      planOverride: before?.planOverride ?? null,
      dailyTokenLimitOverride: before?.dailyTokenLimitOverride ?? null,
    };
    return TRACKED_FIELDS.filter((field) => previous[field] !== after[field]);
  }
}
