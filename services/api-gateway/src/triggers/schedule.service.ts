import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { AgentSchedule, AgentScheduleTargetKind } from '../entities/agent-schedule.entity';
import { AgentScheduleRun, AgentScheduleRunOutcome } from '../entities/agent-schedule-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { workflowStatus, type WorkflowStatus } from '../orchestration/collaboration-workflow';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { isSchedulesEnabled } from './schedule-switch';
import {
  SCHEDULE_ERROR_CODES,
  SCHEDULES_PER_OWNER_LIMIT,
  ScheduleTargetInput,
  formatTimeOfDay,
  isUuid,
  maskToDays,
  readScheduleCreate,
  readSchedulePatch,
  scheduleError,
} from './schedule-validation';

/** TRIGGER-01 S1: audit_events rows (stage-start section 5). */
export const TRIGGER_AUDIT_CATEGORY = 'trigger';
export const TRIGGER_AUDIT_SUBJECT_TYPE = 'agent_schedule';
export const TRIGGER_AUDIT_EVENTS = {
  created: 'schedule_created',
  updated: 'schedule_updated',
  deleted: 'schedule_deleted',
} as const;

/** The history rows GET /api/schedules/:id/runs answers. */
export const SCHEDULE_HISTORY_LIMIT = 30;

/**
 * Namespace of the per-owner transaction lock that keeps the limit of five
 * true when two creates race (pg_advisory_xact_lock(namespace, hashtext(owner))).
 */
export const SCHEDULE_LIMIT_LOCK_NAMESPACE = 1810;

export type ScheduleTargetView =
  | { kind: 'chief-of-staff' }
  | {
      kind: 'workflow';
      workflowId: string;
      /** null when the workflow is gone or no longer the owner's. */
      name: string | null;
      /** 'missing' when the workflow is gone or no longer the owner's. */
      status: WorkflowStatus | 'missing';
    };

export interface ScheduleLastRunView {
  localDate: string;
  outcome: AgentScheduleRunOutcome;
  reason: string | null;
  collaborationRunId: string | null;
  at: string;
}

export interface ScheduleRunView extends ScheduleLastRunView {
  id: string;
}

export interface ScheduleView {
  id: string;
  target: ScheduleTargetView;
  task: string;
  timeOfDay: string;
  days: number[];
  timeZone: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRun: ScheduleLastRunView | null;
}

export interface ScheduleListView {
  /** SCHEDULES_ENABLED, read live. The routes work either way. */
  enabled: boolean;
  /** GLOBAL_EXECUTION_ENABLED, read live (read-only). */
  runsEnabled: boolean;
  limit: number;
  schedules: ScheduleView[];
}

export interface ScheduleDeletedView {
  id: string;
  deleted: true;
}

export interface ScheduleRunsView {
  runs: ScheduleRunView[];
}

type WorkflowSummary = Pick<UserAgent, 'id' | 'name' | 'status'>;

/**
 * TRIGGER-01 S1: the owner's schedules (stage-start sections 2, 7 and 9).
 *
 * Every read and write is by owner: another owner's schedule, an unknown id
 * and another owner's or an unknown workflow all answer 404 and change
 * nothing. At most five schedules per owner, switched on or not (409). The
 * task text is stored and answered to its owner only: it is never written to
 * an audit row or a log line. Each write and its audit row share one
 * transaction. No timer and no run start here (slice S2).
 */
@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    @InjectRepository(AgentSchedule)
    private readonly schedules: Repository<AgentSchedule>,
    @InjectRepository(AgentScheduleRun)
    private readonly runs: Repository<AgentScheduleRun>,
    @InjectRepository(UserAgent)
    private readonly workflows: Repository<UserAgent>,
  ) {}

  async list(userId: string): Promise<ScheduleListView> {
    const rows = await this.schedules.find({ where: { userId }, order: { createdAt: 'ASC' } });
    const workflowIds = [
      ...new Set(rows.map((row) => row.workflowId).filter((id): id is string => typeof id === 'string')),
    ];
    const workflows = new Map<string, WorkflowSummary>();
    if (workflowIds.length > 0) {
      const found = await this.workflows.find({
        where: { id: In(workflowIds), userId, deletedAt: IsNull() },
        select: ['id', 'name', 'status'],
      });
      for (const workflow of found) {
        workflows.set(workflow.id, workflow);
      }
    }
    const schedules: ScheduleView[] = [];
    for (const row of rows) {
      schedules.push(this.view(row, workflows, await this.lastRun(row.id, userId)));
    }
    return {
      enabled: isSchedulesEnabled(),
      runsEnabled: KillSwitchConfig.GLOBAL_EXECUTION_ENABLED,
      limit: SCHEDULES_PER_OWNER_LIMIT,
      schedules,
    };
  }

  async create(userId: string, body: unknown): Promise<ScheduleView> {
    const input = readScheduleCreate(body);
    const now = new Date();
    const id = randomUUID();
    const row: AgentSchedule = {
      id,
      userId,
      targetKind: input.target.kind,
      workflowId: input.target.kind === 'workflow' ? input.target.workflowId : null,
      task: input.task,
      timeOfDay: input.timeOfDay,
      days: input.days,
      timeZone: input.timeZone,
      enabled: input.enabled,
      armedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const workflow = await this.schedules.manager.transaction(async (manager: EntityManager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
        SCHEDULE_LIMIT_LOCK_NAMESPACE,
        userId,
      ]);
      const found = await this.ownWorkflow(manager, userId, input.target);
      const count = await manager.getRepository(AgentSchedule).count({ where: { userId } });
      if (count >= SCHEDULES_PER_OWNER_LIMIT) {
        throw scheduleError(SCHEDULE_ERROR_CODES.limitReached, { limit: SCHEDULES_PER_OWNER_LIMIT });
      }
      await manager.getRepository(AgentSchedule).insert(row);
      await this.audit(manager, TRIGGER_AUDIT_EVENTS.created, row);
      return found;
    });
    this.logger.log(
      `schedule created userId=${userId} scheduleId=${id} targetKind=${row.targetKind}${workflowLogPart(row)}`,
    );
    return this.view(row, workflowMap(workflow), null);
  }

  async update(userId: string, id: string, body: unknown): Promise<ScheduleView> {
    if (!isUuid(id)) {
      throw scheduleError(SCHEDULE_ERROR_CODES.notFound);
    }
    const patch = readSchedulePatch(body);
    const { row, workflow } = await this.schedules.manager.transaction(async (manager: EntityManager) => {
      const repository = manager.getRepository(AgentSchedule);
      const current = await repository.findOne({ where: { id, userId } });
      if (!current) {
        throw scheduleError(SCHEDULE_ERROR_CODES.notFound);
      }
      const target: ScheduleTargetInput =
        patch.target ??
        (current.targetKind === 'workflow' && current.workflowId
          ? { kind: 'workflow', workflowId: current.workflowId }
          : { kind: 'chief-of-staff' });
      const found = patch.target ? await this.ownWorkflow(manager, userId, patch.target) : null;

      const now = new Date();
      const next: AgentSchedule = {
        ...current,
        targetKind: target.kind,
        workflowId: target.kind === 'workflow' ? target.workflowId : null,
        task: patch.task ?? current.task,
        timeOfDay: patch.timeOfDay ?? current.timeOfDay,
        days: patch.days ?? current.days,
        timeZone: patch.timeZone ?? current.timeZone,
        enabled: patch.enabled ?? current.enabled,
        updatedAt: now,
      };
      // Stage-start section 2: armed at switch-on and when time, days or
      // zone change. A task or target change does not re-arm.
      const rearm =
        next.timeOfDay !== current.timeOfDay ||
        next.days !== current.days ||
        next.timeZone !== current.timeZone ||
        (next.enabled && !current.enabled);
      if (rearm) {
        next.armedAt = now;
      }
      await repository.update(
        { id, userId },
        {
          targetKind: next.targetKind,
          workflowId: next.workflowId,
          task: next.task,
          timeOfDay: next.timeOfDay,
          days: next.days,
          timeZone: next.timeZone,
          enabled: next.enabled,
          armedAt: next.armedAt,
          updatedAt: next.updatedAt,
        },
      );
      await this.audit(manager, TRIGGER_AUDIT_EVENTS.updated, next);
      return { row: next, workflow: found };
    });
    this.logger.log(
      `schedule updated userId=${userId} scheduleId=${id} targetKind=${row.targetKind}${workflowLogPart(row)}`,
    );
    const workflows =
      workflow !== null || row.workflowId === null
        ? workflowMap(workflow)
        : await this.workflowsFor(userId, [row.workflowId]);
    return this.view(row, workflows, await this.lastRun(id, userId));
  }

  async remove(userId: string, id: string): Promise<ScheduleDeletedView> {
    if (!isUuid(id)) {
      throw scheduleError(SCHEDULE_ERROR_CODES.notFound);
    }
    const row = await this.schedules.manager.transaction(async (manager: EntityManager) => {
      const repository = manager.getRepository(AgentSchedule);
      const current = await repository.findOne({ where: { id, userId } });
      if (!current) {
        throw scheduleError(SCHEDULE_ERROR_CODES.notFound);
      }
      // The foreign key cascades too (migration 1810); deleted here as well
      // so the history goes in the same transaction whatever the schema.
      await manager.getRepository(AgentScheduleRun).delete({ scheduleId: id });
      await repository.delete({ id, userId });
      await this.audit(manager, TRIGGER_AUDIT_EVENTS.deleted, current);
      return current;
    });
    this.logger.log(
      `schedule deleted userId=${userId} scheduleId=${id} targetKind=${row.targetKind}${workflowLogPart(row)}`,
    );
    return { id, deleted: true };
  }

  async history(userId: string, id: string): Promise<ScheduleRunsView> {
    if (!isUuid(id)) {
      throw scheduleError(SCHEDULE_ERROR_CODES.notFound);
    }
    const schedule = await this.schedules.findOne({ where: { id, userId } });
    if (!schedule) {
      throw scheduleError(SCHEDULE_ERROR_CODES.notFound);
    }
    const rows = await this.runs.find({
      where: { scheduleId: id, userId },
      order: { createdAt: 'DESC' },
      take: SCHEDULE_HISTORY_LIMIT,
    });
    return { runs: rows.map((run) => ({ id: run.id, ...runView(run) })) };
  }

  /** The owner's own, not deleted workflow, or 404. null for the Chief of Staff. */
  private async ownWorkflow(
    manager: EntityManager,
    userId: string,
    target: ScheduleTargetInput,
  ): Promise<WorkflowSummary | null> {
    if (target.kind !== 'workflow') {
      return null;
    }
    const found = await manager.getRepository(UserAgent).findOne({
      where: { id: target.workflowId, userId, deletedAt: IsNull() },
      select: ['id', 'name', 'status'],
    });
    if (!found) {
      throw scheduleError(SCHEDULE_ERROR_CODES.workflowNotFound);
    }
    return found;
  }

  private async workflowsFor(userId: string, ids: string[]): Promise<Map<string, WorkflowSummary>> {
    const found = await this.workflows.find({
      where: { id: In(ids), userId, deletedAt: IsNull() },
      select: ['id', 'name', 'status'],
    });
    return new Map(found.map((workflow) => [workflow.id, workflow]));
  }

  private async lastRun(scheduleId: string, userId: string): Promise<ScheduleLastRunView | null> {
    const run = await this.runs.findOne({
      where: { scheduleId, userId },
      order: { createdAt: 'DESC' },
    });
    return run ? runView(run) : null;
  }

  private view(
    row: AgentSchedule,
    workflows: Map<string, WorkflowSummary>,
    lastRun: ScheduleLastRunView | null,
  ): ScheduleView {
    return {
      id: row.id,
      target: targetView(row.targetKind, row.workflowId, workflows),
      task: row.task,
      timeOfDay: formatTimeOfDay(row.timeOfDay),
      days: maskToDays(row.days),
      timeZone: row.timeZone,
      enabled: row.enabled,
      createdAt: isoOf(row.createdAt),
      updatedAt: isoOf(row.updatedAt),
      lastRun,
    };
  }

  /** Ids and the target kind only: never the task text. */
  private async audit(manager: EntityManager, eventType: string, row: AgentSchedule): Promise<void> {
    await manager.getRepository(AuditEventEntity).insert({
      category: TRIGGER_AUDIT_CATEGORY,
      eventType,
      subjectType: TRIGGER_AUDIT_SUBJECT_TYPE,
      subjectId: row.id,
      userId: row.userId,
      payload: {
        scheduleId: row.id,
        targetKind: row.targetKind,
        workflowId: row.workflowId,
      },
      occurredAt: new Date(),
    });
  }
}

function targetView(
  kind: AgentScheduleTargetKind,
  workflowId: string | null,
  workflows: Map<string, WorkflowSummary>,
): ScheduleTargetView {
  if (kind !== 'workflow' || workflowId === null) {
    return { kind: 'chief-of-staff' };
  }
  const workflow = workflows.get(workflowId);
  return {
    kind: 'workflow',
    workflowId,
    name: workflow ? workflow.name : null,
    status: workflow ? workflowStatus(workflow.status) : 'missing',
  };
}

function runView(run: AgentScheduleRun): ScheduleLastRunView {
  return {
    localDate: localDateOf(run.localDate),
    outcome: run.outcome,
    reason: run.reason ?? null,
    collaborationRunId: run.collaborationRunId ?? null,
    at: isoOf(run.createdAt),
  };
}

function workflowMap(workflow: WorkflowSummary | null): Map<string, WorkflowSummary> {
  return workflow ? new Map([[workflow.id, workflow]]) : new Map();
}

function workflowLogPart(row: AgentSchedule): string {
  return row.workflowId ? ` workflowId=${row.workflowId}` : '';
}

function isoOf(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * TypeORM hydrates a date column as 'YYYY-MM-DD'. A Date (the pg driver's own
 * parse, local midnight) is read with local getters, as TypeORM's
 * DateUtils.mixedDateToDateString does.
 */
function localDateOf(value: string | Date): string {
  if (!(value instanceof Date)) {
    return String(value);
  }
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}
