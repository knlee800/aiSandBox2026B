import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import {
  AgentKnowledgeTrigger,
  AgentKnowledgeTriggerTargetKind,
} from '../entities/agent-knowledge-trigger.entity';
import {
  AgentKnowledgeTriggerRun,
  AgentKnowledgeTriggerRunOutcome,
} from '../entities/agent-knowledge-trigger-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { workflowStatus } from '../orchestration/collaboration-workflow';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { isKnowledgeTriggersEnabled } from './knowledge-trigger-switch';
import {
  KNOWLEDGE_TRIGGER_ERROR_CODES,
  KNOWLEDGE_TRIGGERS_PER_OWNER_LIMIT,
  KnowledgeTriggerTargetInput,
  assertTargetCanReadFolder,
  knowledgeTriggerError,
  readKnowledgeTriggerCreate,
  readKnowledgeTriggerPatch,
} from './knowledge-trigger-validation';
import { ScheduleTargetView, TRIGGER_AUDIT_CATEGORY } from './schedule.service';
import { isUuid } from './schedule-validation';

/** TRIGGER-MORE-01 S1: audit_events rows (stage-start section 5); category `trigger`, as schedules. */
export const KNOWLEDGE_TRIGGER_AUDIT_CATEGORY = TRIGGER_AUDIT_CATEGORY;
export const KNOWLEDGE_TRIGGER_AUDIT_SUBJECT_TYPE = 'agent_knowledge_trigger';
export const KNOWLEDGE_TRIGGER_AUDIT_EVENTS = {
  created: 'knowledge_trigger_created',
  updated: 'knowledge_trigger_updated',
  deleted: 'knowledge_trigger_deleted',
} as const;

/** The history rows GET /api/knowledge-triggers/:id/runs answers. */
export const KNOWLEDGE_TRIGGER_HISTORY_LIMIT = 30;

/**
 * Namespace of the per-owner transaction lock that keeps the limit of three
 * true when two creates race (pg_advisory_xact_lock(namespace, hashtext(owner))).
 * Not the schedules' 1810, the event triggers' 1811 or the mail triggers'
 * 1812, so the four limits never wait on each other.
 */
export const KNOWLEDGE_TRIGGER_LIMIT_LOCK_NAMESPACE = 1813;

/** The schedule target shape (stage-start section 5). */
export type KnowledgeTriggerTargetView = ScheduleTargetView;

export interface KnowledgeTriggerLastRunView {
  documentId: string;
  changedAt: string;
  localDate: string;
  outcome: AgentKnowledgeTriggerRunOutcome;
  reason: string | null;
  collaborationRunId: string | null;
  at: string;
}

export interface KnowledgeTriggerRunView extends KnowledgeTriggerLastRunView {
  id: string;
}

export interface KnowledgeTriggerView {
  id: string;
  target: KnowledgeTriggerTargetView;
  task: string;
  scopeId: string;
  timeZone: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRun: KnowledgeTriggerLastRunView | null;
}

export interface KnowledgeTriggerListView {
  /** KNOWLEDGE_TRIGGERS_ENABLED, read live. The routes work either way. */
  enabled: boolean;
  /** GLOBAL_EXECUTION_ENABLED, read live (read-only). */
  runsEnabled: boolean;
  limit: number;
  triggers: KnowledgeTriggerView[];
}

export interface KnowledgeTriggerDeletedView {
  id: string;
  deleted: true;
}

export interface KnowledgeTriggerRunsView {
  runs: KnowledgeTriggerRunView[];
}

type WorkflowSummary = Pick<UserAgent, 'id' | 'name' | 'status'>;

/**
 * TRIGGER-MORE-01 S1: the owner's knowledge triggers (stage-start sections 4
 * and 5).
 *
 * Every read and write is by owner: another owner's trigger, an unknown id
 * and another owner's or an unknown workflow all answer 404 and change
 * nothing. At most three knowledge triggers per owner, switched on or not
 * (409), counted apart from schedules, event triggers and mail triggers. A
 * Chief of Staff trigger only on a folder the Chief of Staff reads. The task
 * is stored and answered to its owner only: it is never written to an audit
 * row or a log line. Each write and its audit row share one transaction. No
 * timer, no knowledge document read and no run start here (slice S2).
 */
@Injectable()
export class KnowledgeTriggerService {
  private readonly logger = new Logger(KnowledgeTriggerService.name);

  constructor(
    @InjectRepository(AgentKnowledgeTrigger)
    private readonly triggers: Repository<AgentKnowledgeTrigger>,
    @InjectRepository(AgentKnowledgeTriggerRun)
    private readonly runs: Repository<AgentKnowledgeTriggerRun>,
    @InjectRepository(UserAgent)
    private readonly workflows: Repository<UserAgent>,
  ) {}

  async list(userId: string): Promise<KnowledgeTriggerListView> {
    const rows = await this.triggers.find({ where: { userId }, order: { createdAt: 'ASC' } });
    const workflowIds = [
      ...new Set(rows.map((row) => row.workflowId).filter((id): id is string => typeof id === 'string')),
    ];
    const workflows = workflowIds.length > 0 ? await this.workflowsFor(userId, workflowIds) : new Map();
    const triggers: KnowledgeTriggerView[] = [];
    for (const row of rows) {
      triggers.push(this.view(row, workflows, await this.lastRun(row.id, userId)));
    }
    return {
      enabled: isKnowledgeTriggersEnabled(),
      runsEnabled: KillSwitchConfig.GLOBAL_EXECUTION_ENABLED,
      limit: KNOWLEDGE_TRIGGERS_PER_OWNER_LIMIT,
      triggers,
    };
  }

  async create(userId: string, body: unknown): Promise<KnowledgeTriggerView> {
    const input = readKnowledgeTriggerCreate(body);
    const now = new Date();
    const id = randomUUID();
    const row: AgentKnowledgeTrigger = {
      id,
      userId,
      targetKind: input.target.kind,
      workflowId: input.target.kind === 'workflow' ? input.target.workflowId : null,
      task: input.task,
      scopeId: input.scopeId,
      timeZone: input.timeZone,
      enabled: input.enabled,
      armedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const workflow = await this.triggers.manager.transaction(async (manager: EntityManager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
        KNOWLEDGE_TRIGGER_LIMIT_LOCK_NAMESPACE,
        userId,
      ]);
      const found = await this.ownWorkflow(manager, userId, input.target);
      const count = await manager.getRepository(AgentKnowledgeTrigger).count({ where: { userId } });
      if (count >= KNOWLEDGE_TRIGGERS_PER_OWNER_LIMIT) {
        throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.limitReached, {
          limit: KNOWLEDGE_TRIGGERS_PER_OWNER_LIMIT,
        });
      }
      await manager.getRepository(AgentKnowledgeTrigger).insert(row);
      await this.audit(manager, KNOWLEDGE_TRIGGER_AUDIT_EVENTS.created, row);
      return found;
    });
    this.logger.log(`knowledge trigger created ${logParts(row)}`);
    return this.view(row, workflowMap(workflow), null);
  }

  async update(userId: string, id: string, body: unknown): Promise<KnowledgeTriggerView> {
    if (!isUuid(id)) {
      throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.notFound);
    }
    const patch = readKnowledgeTriggerPatch(body);
    const { row, workflow } = await this.triggers.manager.transaction(async (manager: EntityManager) => {
      const repository = manager.getRepository(AgentKnowledgeTrigger);
      const current = await repository.findOne({ where: { id, userId } });
      if (!current) {
        throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.notFound);
      }
      const target: KnowledgeTriggerTargetInput =
        patch.target ??
        (current.targetKind === 'workflow' && current.workflowId
          ? { kind: 'workflow', workflowId: current.workflowId }
          : { kind: 'chief-of-staff' });
      const scopeId = patch.scopeId ?? current.scopeId;
      // The folder rule on the merged row: a target change to the Chief of
      // Staff, or a folder change on a Chief of Staff trigger.
      assertTargetCanReadFolder(target.kind, scopeId);
      const found = patch.target ? await this.ownWorkflow(manager, userId, patch.target) : null;

      const now = new Date();
      const next: AgentKnowledgeTrigger = {
        ...current,
        targetKind: target.kind,
        workflowId: target.kind === 'workflow' ? target.workflowId : null,
        task: patch.task ?? current.task,
        scopeId,
        timeZone: patch.timeZone ?? current.timeZone,
        enabled: patch.enabled ?? current.enabled,
        updatedAt: now,
      };
      // Stage-start section 4: armed at switch-on and when the folder or the
      // zone actually change. A task or target change does not re-arm.
      const rearm =
        next.scopeId !== current.scopeId ||
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
          scopeId: next.scopeId,
          timeZone: next.timeZone,
          enabled: next.enabled,
          armedAt: next.armedAt,
          updatedAt: next.updatedAt,
        },
      );
      await this.audit(manager, KNOWLEDGE_TRIGGER_AUDIT_EVENTS.updated, next);
      return { row: next, workflow: found };
    });
    this.logger.log(`knowledge trigger updated ${logParts(row)}`);
    const workflows =
      workflow !== null || row.workflowId === null
        ? workflowMap(workflow)
        : await this.workflowsFor(userId, [row.workflowId]);
    return this.view(row, workflows, await this.lastRun(id, userId));
  }

  async remove(userId: string, id: string): Promise<KnowledgeTriggerDeletedView> {
    if (!isUuid(id)) {
      throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.notFound);
    }
    const row = await this.triggers.manager.transaction(async (manager: EntityManager) => {
      const repository = manager.getRepository(AgentKnowledgeTrigger);
      const current = await repository.findOne({ where: { id, userId } });
      if (!current) {
        throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.notFound);
      }
      // The foreign key cascades too (migration 1813); deleted here as well
      // so the history goes in the same transaction whatever the schema.
      await manager.getRepository(AgentKnowledgeTriggerRun).delete({ triggerId: id });
      await repository.delete({ id, userId });
      await this.audit(manager, KNOWLEDGE_TRIGGER_AUDIT_EVENTS.deleted, current);
      return current;
    });
    this.logger.log(`knowledge trigger deleted ${logParts(row)}`);
    return { id, deleted: true };
  }

  async history(userId: string, id: string): Promise<KnowledgeTriggerRunsView> {
    if (!isUuid(id)) {
      throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.notFound);
    }
    const trigger = await this.triggers.findOne({ where: { id, userId } });
    if (!trigger) {
      throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.notFound);
    }
    const rows = await this.runs.find({
      where: { triggerId: id, userId },
      order: { createdAt: 'DESC' },
      take: KNOWLEDGE_TRIGGER_HISTORY_LIMIT,
    });
    return { runs: rows.map((run) => ({ id: run.id, ...runView(run) })) };
  }

  /** The owner's own, not deleted workflow, or 404. null for the Chief of Staff. */
  private async ownWorkflow(
    manager: EntityManager,
    userId: string,
    target: KnowledgeTriggerTargetInput,
  ): Promise<WorkflowSummary | null> {
    if (target.kind !== 'workflow') {
      return null;
    }
    const found = await manager.getRepository(UserAgent).findOne({
      where: { id: target.workflowId, userId, deletedAt: IsNull() },
      select: ['id', 'name', 'status'],
    });
    if (!found) {
      throw knowledgeTriggerError(KNOWLEDGE_TRIGGER_ERROR_CODES.workflowNotFound);
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

  private async lastRun(triggerId: string, userId: string): Promise<KnowledgeTriggerLastRunView | null> {
    const run = await this.runs.findOne({
      where: { triggerId, userId },
      order: { createdAt: 'DESC' },
    });
    return run ? runView(run) : null;
  }

  private view(
    row: AgentKnowledgeTrigger,
    workflows: Map<string, WorkflowSummary>,
    lastRun: KnowledgeTriggerLastRunView | null,
  ): KnowledgeTriggerView {
    return {
      id: row.id,
      target: targetView(row.targetKind, row.workflowId, workflows),
      task: row.task,
      scopeId: row.scopeId,
      timeZone: row.timeZone,
      enabled: row.enabled,
      createdAt: isoOf(row.createdAt),
      updatedAt: isoOf(row.updatedAt),
      lastRun,
    };
  }

  /** Ids, the target kind and the folder id only: never the task. */
  private async audit(manager: EntityManager, eventType: string, row: AgentKnowledgeTrigger): Promise<void> {
    await manager.getRepository(AuditEventEntity).insert({
      category: KNOWLEDGE_TRIGGER_AUDIT_CATEGORY,
      eventType,
      subjectType: KNOWLEDGE_TRIGGER_AUDIT_SUBJECT_TYPE,
      subjectId: row.id,
      userId: row.userId,
      payload: {
        triggerId: row.id,
        targetKind: row.targetKind,
        workflowId: row.workflowId,
        scopeId: row.scopeId,
      },
      occurredAt: new Date(),
    });
  }
}

function targetView(
  kind: AgentKnowledgeTriggerTargetKind,
  workflowId: string | null,
  workflows: Map<string, WorkflowSummary>,
): KnowledgeTriggerTargetView {
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

/** Ids, a time, a date and codes: never the document key (a hash). */
function runView(run: AgentKnowledgeTriggerRun): KnowledgeTriggerLastRunView {
  return {
    documentId: run.documentId,
    changedAt: isoOf(run.changedAt),
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

/** The ids, the target kind and the folder id: never the task. */
function logParts(row: AgentKnowledgeTrigger): string {
  const workflow = row.workflowId ? ` workflowId=${row.workflowId}` : '';
  return `userId=${row.userId} triggerId=${row.id} targetKind=${row.targetKind}${workflow} scopeId=${row.scopeId}`;
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
