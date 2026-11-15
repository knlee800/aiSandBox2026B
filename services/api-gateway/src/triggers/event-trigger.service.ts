import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import {
  AgentEventTrigger,
  AgentEventTriggerCalendarState,
  AgentEventTriggerTargetKind,
} from '../entities/agent-event-trigger.entity';
import { AgentEventTriggerRun, AgentEventTriggerRunOutcome } from '../entities/agent-event-trigger-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { workflowStatus } from '../orchestration/collaboration-workflow';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { isEventTriggersEnabled } from './event-trigger-switch';
import {
  EVENT_TRIGGER_ERROR_CODES,
  EVENT_TRIGGERS_PER_OWNER_LIMIT,
  EventTriggerTargetInput,
  eventTriggerError,
  readEventTriggerCreate,
  readEventTriggerPatch,
} from './event-trigger-validation';
import { ScheduleTargetView, TRIGGER_AUDIT_CATEGORY } from './schedule.service';
import { isUuid } from './schedule-validation';

/** TRIGGER-EVENT-01 S2: audit_events rows (stage-start section 6); category `trigger`, as schedules. */
export const EVENT_TRIGGER_AUDIT_CATEGORY = TRIGGER_AUDIT_CATEGORY;
export const EVENT_TRIGGER_AUDIT_SUBJECT_TYPE = 'agent_event_trigger';
export const EVENT_TRIGGER_AUDIT_EVENTS = {
  created: 'event_trigger_created',
  updated: 'event_trigger_updated',
  deleted: 'event_trigger_deleted',
} as const;

/** The history rows GET /api/event-triggers/:id/runs answers. */
export const EVENT_TRIGGER_HISTORY_LIMIT = 30;

/**
 * Namespace of the per-owner transaction lock that keeps the limit of three
 * true when two creates race (pg_advisory_xact_lock(namespace, hashtext(owner))).
 * Not the schedules' 1810, so the two limits never wait on each other.
 */
export const EVENT_TRIGGER_LIMIT_LOCK_NAMESPACE = 1811;

/** The connector kind whose row means "the owner's calendar is connected". */
export const EVENT_TRIGGER_CALENDAR_CONNECTOR_KIND = 'ical';

/** The schedule target shape (stage-start section 8). */
export type EventTriggerTargetView = ScheduleTargetView;

export interface EventTriggerLastRunView {
  eventStart: string;
  localDate: string;
  outcome: AgentEventTriggerRunOutcome;
  reason: string | null;
  collaborationRunId: string | null;
  at: string;
}

export interface EventTriggerRunView extends EventTriggerLastRunView {
  id: string;
}

export interface EventTriggerView {
  id: string;
  target: EventTriggerTargetView;
  task: string;
  leadMinutes: number;
  titleFilter: string | null;
  timeZone: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRun: EventTriggerLastRunView | null;
}

export interface EventTriggerCalendarView {
  /** The owner has an iCal connector_connections row (a count only: no broker call, the stored link is never read). */
  connected: boolean;
  /** The newest calendar_state among the owner's triggers; 'ok' when none was recorded. */
  state: AgentEventTriggerCalendarState;
  /** When that state was recorded; null when none was. */
  stateAt: string | null;
}

export interface EventTriggerListView {
  /** EVENT_TRIGGERS_ENABLED, read live. The routes work either way. */
  enabled: boolean;
  /** GLOBAL_EXECUTION_ENABLED, read live (read-only). */
  runsEnabled: boolean;
  limit: number;
  calendar: EventTriggerCalendarView;
  triggers: EventTriggerView[];
}

export interface EventTriggerDeletedView {
  id: string;
  deleted: true;
}

export interface EventTriggerRunsView {
  runs: EventTriggerRunView[];
}

type WorkflowSummary = Pick<UserAgent, 'id' | 'name' | 'status'>;

/**
 * TRIGGER-EVENT-01 S2: the owner's event triggers (stage-start sections 2,
 * 6, 8 and 9).
 *
 * Every read and write is by owner: another owner's trigger, an unknown id
 * and another owner's or an unknown workflow all answer 404 and change
 * nothing. At most three triggers per owner, switched on or not (409). The
 * task and the title filter are stored and answered to their owner only:
 * they are never written to an audit row or a log line. Each write and its
 * audit row share one transaction. No timer, no calendar read and no run
 * start here (slice S3).
 */
@Injectable()
export class EventTriggerService {
  private readonly logger = new Logger(EventTriggerService.name);

  constructor(
    @InjectRepository(AgentEventTrigger)
    private readonly triggers: Repository<AgentEventTrigger>,
    @InjectRepository(AgentEventTriggerRun)
    private readonly runs: Repository<AgentEventTriggerRun>,
    @InjectRepository(UserAgent)
    private readonly workflows: Repository<UserAgent>,
    @InjectRepository(ConnectorConnection)
    private readonly connections: Repository<ConnectorConnection>,
  ) {}

  async list(userId: string): Promise<EventTriggerListView> {
    const rows = await this.triggers.find({ where: { userId }, order: { createdAt: 'ASC' } });
    const workflowIds = [
      ...new Set(rows.map((row) => row.workflowId).filter((id): id is string => typeof id === 'string')),
    ];
    const workflows = workflowIds.length > 0 ? await this.workflowsFor(userId, workflowIds) : new Map();
    const triggers: EventTriggerView[] = [];
    for (const row of rows) {
      triggers.push(this.view(row, workflows, await this.lastRun(row.id, userId)));
    }
    // Whether a row exists only: the secret column is never read here.
    const connected =
      (await this.connections.count({ where: { userId, kind: EVENT_TRIGGER_CALENDAR_CONNECTOR_KIND } })) > 0;
    return {
      enabled: isEventTriggersEnabled(),
      runsEnabled: KillSwitchConfig.GLOBAL_EXECUTION_ENABLED,
      limit: EVENT_TRIGGERS_PER_OWNER_LIMIT,
      calendar: { connected, ...calendarStateOf(rows) },
      triggers,
    };
  }

  async create(userId: string, body: unknown): Promise<EventTriggerView> {
    const input = readEventTriggerCreate(body);
    const now = new Date();
    const id = randomUUID();
    const row: AgentEventTrigger = {
      id,
      userId,
      targetKind: input.target.kind,
      workflowId: input.target.kind === 'workflow' ? input.target.workflowId : null,
      task: input.task,
      leadMinutes: input.leadMinutes,
      titleFilter: input.titleFilter,
      timeZone: input.timeZone,
      enabled: input.enabled,
      armedAt: now,
      calendarState: 'ok',
      calendarStateAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const workflow = await this.triggers.manager.transaction(async (manager: EntityManager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
        EVENT_TRIGGER_LIMIT_LOCK_NAMESPACE,
        userId,
      ]);
      const found = await this.ownWorkflow(manager, userId, input.target);
      const count = await manager.getRepository(AgentEventTrigger).count({ where: { userId } });
      if (count >= EVENT_TRIGGERS_PER_OWNER_LIMIT) {
        throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.limitReached, { limit: EVENT_TRIGGERS_PER_OWNER_LIMIT });
      }
      await manager.getRepository(AgentEventTrigger).insert(row);
      await this.audit(manager, EVENT_TRIGGER_AUDIT_EVENTS.created, row);
      return found;
    });
    this.logger.log(
      `event trigger created userId=${userId} triggerId=${id} targetKind=${row.targetKind}${workflowLogPart(row)}`,
    );
    return this.view(row, workflowMap(workflow), null);
  }

  async update(userId: string, id: string, body: unknown): Promise<EventTriggerView> {
    if (!isUuid(id)) {
      throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.notFound);
    }
    const patch = readEventTriggerPatch(body);
    const { row, workflow } = await this.triggers.manager.transaction(async (manager: EntityManager) => {
      const repository = manager.getRepository(AgentEventTrigger);
      const current = await repository.findOne({ where: { id, userId } });
      if (!current) {
        throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.notFound);
      }
      const target: EventTriggerTargetInput =
        patch.target ??
        (current.targetKind === 'workflow' && current.workflowId
          ? { kind: 'workflow', workflowId: current.workflowId }
          : { kind: 'chief-of-staff' });
      const found = patch.target ? await this.ownWorkflow(manager, userId, patch.target) : null;

      const now = new Date();
      const next: AgentEventTrigger = {
        ...current,
        targetKind: target.kind,
        workflowId: target.kind === 'workflow' ? target.workflowId : null,
        task: patch.task ?? current.task,
        leadMinutes: patch.leadMinutes ?? current.leadMinutes,
        // null is a value here (clear the filter); undefined means not sent.
        titleFilter: patch.titleFilter !== undefined ? patch.titleFilter : current.titleFilter ?? null,
        timeZone: patch.timeZone ?? current.timeZone,
        enabled: patch.enabled ?? current.enabled,
        updatedAt: now,
      };
      // Stage-start section 2: armed at switch-on and when lead, filter or
      // zone actually change. A task or target change does not re-arm.
      const rearm =
        next.leadMinutes !== current.leadMinutes ||
        next.titleFilter !== (current.titleFilter ?? null) ||
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
          leadMinutes: next.leadMinutes,
          titleFilter: next.titleFilter,
          timeZone: next.timeZone,
          enabled: next.enabled,
          armedAt: next.armedAt,
          updatedAt: next.updatedAt,
        },
      );
      await this.audit(manager, EVENT_TRIGGER_AUDIT_EVENTS.updated, next);
      return { row: next, workflow: found };
    });
    this.logger.log(
      `event trigger updated userId=${userId} triggerId=${id} targetKind=${row.targetKind}${workflowLogPart(row)}`,
    );
    const workflows =
      workflow !== null || row.workflowId === null
        ? workflowMap(workflow)
        : await this.workflowsFor(userId, [row.workflowId]);
    return this.view(row, workflows, await this.lastRun(id, userId));
  }

  async remove(userId: string, id: string): Promise<EventTriggerDeletedView> {
    if (!isUuid(id)) {
      throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.notFound);
    }
    const row = await this.triggers.manager.transaction(async (manager: EntityManager) => {
      const repository = manager.getRepository(AgentEventTrigger);
      const current = await repository.findOne({ where: { id, userId } });
      if (!current) {
        throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.notFound);
      }
      // The foreign key cascades too (migration 1811); deleted here as well
      // so the history goes in the same transaction whatever the schema.
      await manager.getRepository(AgentEventTriggerRun).delete({ triggerId: id });
      await repository.delete({ id, userId });
      await this.audit(manager, EVENT_TRIGGER_AUDIT_EVENTS.deleted, current);
      return current;
    });
    this.logger.log(
      `event trigger deleted userId=${userId} triggerId=${id} targetKind=${row.targetKind}${workflowLogPart(row)}`,
    );
    return { id, deleted: true };
  }

  async history(userId: string, id: string): Promise<EventTriggerRunsView> {
    if (!isUuid(id)) {
      throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.notFound);
    }
    const trigger = await this.triggers.findOne({ where: { id, userId } });
    if (!trigger) {
      throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.notFound);
    }
    const rows = await this.runs.find({
      where: { triggerId: id, userId },
      order: { createdAt: 'DESC' },
      take: EVENT_TRIGGER_HISTORY_LIMIT,
    });
    return { runs: rows.map((run) => ({ id: run.id, ...runView(run) })) };
  }

  /** The owner's own, not deleted workflow, or 404. null for the Chief of Staff. */
  private async ownWorkflow(
    manager: EntityManager,
    userId: string,
    target: EventTriggerTargetInput,
  ): Promise<WorkflowSummary | null> {
    if (target.kind !== 'workflow') {
      return null;
    }
    const found = await manager.getRepository(UserAgent).findOne({
      where: { id: target.workflowId, userId, deletedAt: IsNull() },
      select: ['id', 'name', 'status'],
    });
    if (!found) {
      throw eventTriggerError(EVENT_TRIGGER_ERROR_CODES.workflowNotFound);
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

  private async lastRun(triggerId: string, userId: string): Promise<EventTriggerLastRunView | null> {
    const run = await this.runs.findOne({
      where: { triggerId, userId },
      order: { createdAt: 'DESC' },
    });
    return run ? runView(run) : null;
  }

  private view(
    row: AgentEventTrigger,
    workflows: Map<string, WorkflowSummary>,
    lastRun: EventTriggerLastRunView | null,
  ): EventTriggerView {
    return {
      id: row.id,
      target: targetView(row.targetKind, row.workflowId, workflows),
      task: row.task,
      leadMinutes: row.leadMinutes,
      titleFilter: row.titleFilter ?? null,
      timeZone: row.timeZone,
      enabled: row.enabled,
      createdAt: isoOf(row.createdAt),
      updatedAt: isoOf(row.updatedAt),
      lastRun,
    };
  }

  /** Ids and the target kind only: never the task or the filter text. */
  private async audit(manager: EntityManager, eventType: string, row: AgentEventTrigger): Promise<void> {
    await manager.getRepository(AuditEventEntity).insert({
      category: EVENT_TRIGGER_AUDIT_CATEGORY,
      eventType,
      subjectType: EVENT_TRIGGER_AUDIT_SUBJECT_TYPE,
      subjectId: row.id,
      userId: row.userId,
      payload: {
        triggerId: row.id,
        targetKind: row.targetKind,
        workflowId: row.workflowId,
      },
      occurredAt: new Date(),
    });
  }
}

/**
 * The owner has one calendar, so the page shows one state: the newest one
 * recorded on any of the owner's triggers (slice S3 records it), or 'ok'
 * with no time when none was recorded.
 */
function calendarStateOf(
  rows: AgentEventTrigger[],
): { state: AgentEventTriggerCalendarState; stateAt: string | null } {
  let newest: AgentEventTrigger | null = null;
  for (const row of rows) {
    if (row.calendarStateAt === null || row.calendarStateAt === undefined) continue;
    if (newest === null || timeOf(row.calendarStateAt) > timeOf(newest.calendarStateAt!)) {
      newest = row;
    }
  }
  if (newest === null) {
    return { state: 'ok', stateAt: null };
  }
  return { state: newest.calendarState, stateAt: isoOf(newest.calendarStateAt!) };
}

function targetView(
  kind: AgentEventTriggerTargetKind,
  workflowId: string | null,
  workflows: Map<string, WorkflowSummary>,
): EventTriggerTargetView {
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

function runView(run: AgentEventTriggerRun): EventTriggerLastRunView {
  return {
    eventStart: isoOf(run.eventStart),
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

function workflowLogPart(row: AgentEventTrigger): string {
  return row.workflowId ? ` workflowId=${row.workflowId}` : '';
}

function timeOf(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function isoOf(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * TypeORM hydrates a date column as 'YYYY-MM-DD'. A Date (the pg driver's own
 * parse, local midnight) is read with local getters, as TypeORM's
 * DateUtils.mixedDateToDateString does (the schedule service's rule).
 */
function localDateOf(value: string | Date): string {
  if (!(value instanceof Date)) {
    return String(value);
  }
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}
