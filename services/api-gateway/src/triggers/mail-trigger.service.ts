import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import {
  AgentMailTrigger,
  AgentMailTriggerMailState,
  AgentMailTriggerTargetKind,
} from '../entities/agent-mail-trigger.entity';
import { AgentMailTriggerRun, AgentMailTriggerRunOutcome } from '../entities/agent-mail-trigger-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { workflowStatus } from '../orchestration/collaboration-workflow';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { isMailTriggersEnabled } from './mail-trigger-switch';
import {
  MAIL_TRIGGER_ERROR_CODES,
  MAIL_TRIGGERS_PER_OWNER_LIMIT,
  MailTriggerTargetInput,
  mailTriggerError,
  readMailTriggerCreate,
  readMailTriggerPatch,
} from './mail-trigger-validation';
import { ScheduleTargetView, TRIGGER_AUDIT_CATEGORY } from './schedule.service';
import { isUuid } from './schedule-validation';

/** TRIGGER-MAIL-01 S2: audit_events rows (stage-start section 6); category `trigger`, as schedules. */
export const MAIL_TRIGGER_AUDIT_CATEGORY = TRIGGER_AUDIT_CATEGORY;
export const MAIL_TRIGGER_AUDIT_SUBJECT_TYPE = 'agent_mail_trigger';
export const MAIL_TRIGGER_AUDIT_EVENTS = {
  created: 'mail_trigger_created',
  updated: 'mail_trigger_updated',
  deleted: 'mail_trigger_deleted',
} as const;

/** The history rows GET /api/mail-triggers/:id/runs answers. */
export const MAIL_TRIGGER_HISTORY_LIMIT = 30;

/**
 * Namespace of the per-owner transaction lock that keeps the limit of three
 * true when two creates race (pg_advisory_xact_lock(namespace, hashtext(owner))).
 * Not the schedules' 1810 or the event triggers' 1811, so the three limits
 * never wait on each other.
 */
export const MAIL_TRIGGER_LIMIT_LOCK_NAMESPACE = 1812;

/** The connector kind whose row means "the owner's mailbox is connected". */
export const MAIL_TRIGGER_MAIL_CONNECTOR_KIND = 'imap';

/** The schedule target shape (stage-start section 8). */
export type MailTriggerTargetView = ScheduleTargetView;

export interface MailTriggerLastRunView {
  arrivedAt: string;
  localDate: string;
  outcome: AgentMailTriggerRunOutcome;
  reason: string | null;
  collaborationRunId: string | null;
  at: string;
}

export interface MailTriggerRunView extends MailTriggerLastRunView {
  id: string;
}

export interface MailTriggerView {
  id: string;
  target: MailTriggerTargetView;
  task: string;
  senderFilter: string;
  subjectFilter: string | null;
  timeZone: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRun: MailTriggerLastRunView | null;
}

/**
 * CONN-MAIL-AUTH-STATE-01 D4: the mail block's public state. sign_in_refused comes
 * from the connection (sign_in_refused_at), never from a trigger row, so the
 * mail_state CHECK and AGENT_MAIL_TRIGGER_MAIL_STATES are unchanged.
 */
export type MailTriggerPublicMailState = AgentMailTriggerMailState | 'sign_in_refused';

export interface MailTriggerMailView {
  /** The owner has an imap connector_connections row (id and sign_in_refused_at only: no broker call, the secret is never read). */
  connected: boolean;
  /**
   * sign_in_refused while the owner's mail connection is marked refused; otherwise
   * the newest mail_state among the owner's triggers, 'ok' when none was recorded.
   */
  state: MailTriggerPublicMailState;
  /** When that state was recorded (for sign_in_refused, the connection's mark); null when none was. */
  stateAt: string | null;
}

export interface MailTriggerListView {
  /** MAIL_TRIGGERS_ENABLED, read live. The routes work either way. */
  enabled: boolean;
  /** GLOBAL_EXECUTION_ENABLED, read live (read-only). */
  runsEnabled: boolean;
  limit: number;
  mail: MailTriggerMailView;
  triggers: MailTriggerView[];
}

export interface MailTriggerDeletedView {
  id: string;
  deleted: true;
}

export interface MailTriggerRunsView {
  runs: MailTriggerRunView[];
}

type WorkflowSummary = Pick<UserAgent, 'id' | 'name' | 'status'>;

/**
 * TRIGGER-MAIL-01 S2: the owner's mail triggers (stage-start sections 2, 6,
 * 8 and 9).
 *
 * Every read and write is by owner: another owner's trigger, an unknown id
 * and another owner's or an unknown workflow all answer 404 and change
 * nothing. At most three mail triggers per owner, switched on or not (409),
 * counted apart from schedules and event triggers. The task, the sender
 * filter and the subject filter are stored and answered to their owner only:
 * they are never written to an audit row or a log line. Each write and its
 * audit row share one transaction. No timer, no mailbox read and no run start
 * here (slice S3).
 */
@Injectable()
export class MailTriggerService {
  private readonly logger = new Logger(MailTriggerService.name);

  constructor(
    @InjectRepository(AgentMailTrigger)
    private readonly triggers: Repository<AgentMailTrigger>,
    @InjectRepository(AgentMailTriggerRun)
    private readonly runs: Repository<AgentMailTriggerRun>,
    @InjectRepository(UserAgent)
    private readonly workflows: Repository<UserAgent>,
    @InjectRepository(ConnectorConnection)
    private readonly connections: Repository<ConnectorConnection>,
  ) {}

  async list(userId: string): Promise<MailTriggerListView> {
    const rows = await this.triggers.find({ where: { userId }, order: { createdAt: 'ASC' } });
    const workflowIds = [
      ...new Set(rows.map((row) => row.workflowId).filter((id): id is string => typeof id === 'string')),
    ];
    const workflows = workflowIds.length > 0 ? await this.workflowsFor(userId, workflowIds) : new Map();
    const triggers: MailTriggerView[] = [];
    for (const row of rows) {
      triggers.push(this.view(row, workflows, await this.lastRun(row.id, userId)));
    }
    // Whether a row exists and its refusal mark (CONN-MAIL-AUTH-STATE-01 D4): only
    // id and sign_in_refused_at are read; the secret column is never read here.
    const connection = await this.connections.findOne({
      where: { userId, kind: MAIL_TRIGGER_MAIL_CONNECTOR_KIND },
      select: ['id', 'signInRefusedAt'],
    });
    const connected = !!connection;
    const refusedAt = connection ? connection.signInRefusedAt ?? null : null;
    return {
      enabled: isMailTriggersEnabled(),
      runsEnabled: KillSwitchConfig.GLOBAL_EXECUTION_ENABLED,
      limit: MAIL_TRIGGERS_PER_OWNER_LIMIT,
      mail: {
        connected,
        ...(refusedAt !== null ? { state: 'sign_in_refused' as const, stateAt: isoOf(refusedAt) } : mailStateOf(rows)),
      },
      triggers,
    };
  }

  async create(userId: string, body: unknown): Promise<MailTriggerView> {
    const input = readMailTriggerCreate(body);
    const now = new Date();
    const id = randomUUID();
    const row: AgentMailTrigger = {
      id,
      userId,
      targetKind: input.target.kind,
      workflowId: input.target.kind === 'workflow' ? input.target.workflowId : null,
      task: input.task,
      senderFilter: input.senderFilter,
      subjectFilter: input.subjectFilter,
      timeZone: input.timeZone,
      enabled: input.enabled,
      armedAt: now,
      mailState: 'ok',
      mailStateAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const workflow = await this.triggers.manager.transaction(async (manager: EntityManager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
        MAIL_TRIGGER_LIMIT_LOCK_NAMESPACE,
        userId,
      ]);
      const found = await this.ownWorkflow(manager, userId, input.target);
      const count = await manager.getRepository(AgentMailTrigger).count({ where: { userId } });
      if (count >= MAIL_TRIGGERS_PER_OWNER_LIMIT) {
        throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.limitReached, { limit: MAIL_TRIGGERS_PER_OWNER_LIMIT });
      }
      await manager.getRepository(AgentMailTrigger).insert(row);
      await this.audit(manager, MAIL_TRIGGER_AUDIT_EVENTS.created, row);
      return found;
    });
    this.logger.log(
      `mail trigger created userId=${userId} triggerId=${id} targetKind=${row.targetKind}${workflowLogPart(row)}`,
    );
    return this.view(row, workflowMap(workflow), null);
  }

  async update(userId: string, id: string, body: unknown): Promise<MailTriggerView> {
    if (!isUuid(id)) {
      throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.notFound);
    }
    const patch = readMailTriggerPatch(body);
    const { row, workflow } = await this.triggers.manager.transaction(async (manager: EntityManager) => {
      const repository = manager.getRepository(AgentMailTrigger);
      const current = await repository.findOne({ where: { id, userId } });
      if (!current) {
        throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.notFound);
      }
      const target: MailTriggerTargetInput =
        patch.target ??
        (current.targetKind === 'workflow' && current.workflowId
          ? { kind: 'workflow', workflowId: current.workflowId }
          : { kind: 'chief-of-staff' });
      const found = patch.target ? await this.ownWorkflow(manager, userId, patch.target) : null;

      const now = new Date();
      const next: AgentMailTrigger = {
        ...current,
        targetKind: target.kind,
        workflowId: target.kind === 'workflow' ? target.workflowId : null,
        task: patch.task ?? current.task,
        senderFilter: patch.senderFilter ?? current.senderFilter,
        // null is a value here (clear the filter); undefined means not sent.
        subjectFilter: patch.subjectFilter !== undefined ? patch.subjectFilter : current.subjectFilter ?? null,
        timeZone: patch.timeZone ?? current.timeZone,
        enabled: patch.enabled ?? current.enabled,
        updatedAt: now,
      };
      // Stage-start section 2: armed at switch-on and when the sender, the
      // subject or the zone actually change. A task or target change does
      // not re-arm.
      const rearm =
        next.senderFilter !== current.senderFilter ||
        next.subjectFilter !== (current.subjectFilter ?? null) ||
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
          senderFilter: next.senderFilter,
          subjectFilter: next.subjectFilter,
          timeZone: next.timeZone,
          enabled: next.enabled,
          armedAt: next.armedAt,
          updatedAt: next.updatedAt,
        },
      );
      await this.audit(manager, MAIL_TRIGGER_AUDIT_EVENTS.updated, next);
      return { row: next, workflow: found };
    });
    this.logger.log(
      `mail trigger updated userId=${userId} triggerId=${id} targetKind=${row.targetKind}${workflowLogPart(row)}`,
    );
    const workflows =
      workflow !== null || row.workflowId === null
        ? workflowMap(workflow)
        : await this.workflowsFor(userId, [row.workflowId]);
    return this.view(row, workflows, await this.lastRun(id, userId));
  }

  async remove(userId: string, id: string): Promise<MailTriggerDeletedView> {
    if (!isUuid(id)) {
      throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.notFound);
    }
    const row = await this.triggers.manager.transaction(async (manager: EntityManager) => {
      const repository = manager.getRepository(AgentMailTrigger);
      const current = await repository.findOne({ where: { id, userId } });
      if (!current) {
        throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.notFound);
      }
      // The foreign key cascades too (migration 1812); deleted here as well
      // so the history goes in the same transaction whatever the schema.
      await manager.getRepository(AgentMailTriggerRun).delete({ triggerId: id });
      await repository.delete({ id, userId });
      await this.audit(manager, MAIL_TRIGGER_AUDIT_EVENTS.deleted, current);
      return current;
    });
    this.logger.log(
      `mail trigger deleted userId=${userId} triggerId=${id} targetKind=${row.targetKind}${workflowLogPart(row)}`,
    );
    return { id, deleted: true };
  }

  async history(userId: string, id: string): Promise<MailTriggerRunsView> {
    if (!isUuid(id)) {
      throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.notFound);
    }
    const trigger = await this.triggers.findOne({ where: { id, userId } });
    if (!trigger) {
      throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.notFound);
    }
    const rows = await this.runs.find({
      where: { triggerId: id, userId },
      order: { createdAt: 'DESC' },
      take: MAIL_TRIGGER_HISTORY_LIMIT,
    });
    return { runs: rows.map((run) => ({ id: run.id, ...runView(run) })) };
  }

  /** The owner's own, not deleted workflow, or 404. null for the Chief of Staff. */
  private async ownWorkflow(
    manager: EntityManager,
    userId: string,
    target: MailTriggerTargetInput,
  ): Promise<WorkflowSummary | null> {
    if (target.kind !== 'workflow') {
      return null;
    }
    const found = await manager.getRepository(UserAgent).findOne({
      where: { id: target.workflowId, userId, deletedAt: IsNull() },
      select: ['id', 'name', 'status'],
    });
    if (!found) {
      throw mailTriggerError(MAIL_TRIGGER_ERROR_CODES.workflowNotFound);
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

  private async lastRun(triggerId: string, userId: string): Promise<MailTriggerLastRunView | null> {
    const run = await this.runs.findOne({
      where: { triggerId, userId },
      order: { createdAt: 'DESC' },
    });
    return run ? runView(run) : null;
  }

  private view(
    row: AgentMailTrigger,
    workflows: Map<string, WorkflowSummary>,
    lastRun: MailTriggerLastRunView | null,
  ): MailTriggerView {
    return {
      id: row.id,
      target: targetView(row.targetKind, row.workflowId, workflows),
      task: row.task,
      senderFilter: row.senderFilter,
      subjectFilter: row.subjectFilter ?? null,
      timeZone: row.timeZone,
      enabled: row.enabled,
      createdAt: isoOf(row.createdAt),
      updatedAt: isoOf(row.updatedAt),
      lastRun,
    };
  }

  /** Ids and the target kind only: never the task, the sender filter or the subject filter. */
  private async audit(manager: EntityManager, eventType: string, row: AgentMailTrigger): Promise<void> {
    await manager.getRepository(AuditEventEntity).insert({
      category: MAIL_TRIGGER_AUDIT_CATEGORY,
      eventType,
      subjectType: MAIL_TRIGGER_AUDIT_SUBJECT_TYPE,
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
 * The owner has one mailbox, so the page shows one state: the newest one
 * recorded on any of the owner's triggers (slice S3 records it), or 'ok'
 * with no time when none was recorded.
 */
function mailStateOf(rows: AgentMailTrigger[]): { state: AgentMailTriggerMailState; stateAt: string | null } {
  let newest: AgentMailTrigger | null = null;
  for (const row of rows) {
    if (row.mailStateAt === null || row.mailStateAt === undefined) continue;
    if (newest === null || timeOf(row.mailStateAt) > timeOf(newest.mailStateAt!)) {
      newest = row;
    }
  }
  if (newest === null) {
    return { state: 'ok', stateAt: null };
  }
  return { state: newest.mailState, stateAt: isoOf(newest.mailStateAt!) };
}

function targetView(
  kind: AgentMailTriggerTargetKind,
  workflowId: string | null,
  workflows: Map<string, WorkflowSummary>,
): MailTriggerTargetView {
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

function runView(run: AgentMailTriggerRun): MailTriggerLastRunView {
  return {
    arrivedAt: isoOf(run.arrivedAt),
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

function workflowLogPart(row: AgentMailTrigger): string {
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
