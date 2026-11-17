import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { AgentChainTrigger, AgentChainTriggerTargetKind } from '../entities/agent-chain-trigger.entity';
import { AgentChainTriggerRun, AgentChainTriggerRunOutcome } from '../entities/agent-chain-trigger-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { isRunResultToolEnabled } from '../orchestration/collaboration-result-grant';
import { WorkflowStatus, workflowStatus } from '../orchestration/collaboration-workflow';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { isChainTriggersEnabled } from './chain-trigger-switch';
import {
  CHAIN_TRIGGER_ERROR_CODES,
  CHAIN_TRIGGERS_PER_OWNER_LIMIT,
  ChainTriggerTargetInput,
  assertNotSameWorkflow,
  chainTriggerError,
  closesChainCycle,
  readChainTriggerCreate,
  readChainTriggerPatch,
} from './chain-trigger-validation';
import { ScheduleTargetView, TRIGGER_AUDIT_CATEGORY } from './schedule.service';
import { isUuid } from './schedule-validation';

/** TRIGGER-CHAIN-01 S1: audit_events rows (stage-start section 4); category `trigger`, as schedules. */
export const CHAIN_TRIGGER_AUDIT_CATEGORY = TRIGGER_AUDIT_CATEGORY;
export const CHAIN_TRIGGER_AUDIT_SUBJECT_TYPE = 'agent_chain_trigger';
export const CHAIN_TRIGGER_AUDIT_EVENTS = {
  created: 'chain_trigger_created',
  updated: 'chain_trigger_updated',
  deleted: 'chain_trigger_deleted',
} as const;

/** The history rows GET /api/chain-triggers/:id/runs answers. */
export const CHAIN_TRIGGER_HISTORY_LIMIT = 30;

/**
 * Namespace of the per-owner transaction lock that keeps the limit of three
 * true when two creates race and serialises the cycle check
 * (pg_advisory_xact_lock(namespace, hashtext(owner))). Not the schedules'
 * 1810, the event triggers' 1811, the mail triggers' 1812 or the knowledge
 * triggers' 1813, so the five limits never wait on each other.
 */
export const CHAIN_TRIGGER_LIMIT_LOCK_NAMESPACE = 1814;

/** The schedule target shape (stage-start section 4). */
export type ChainTriggerTargetView = ScheduleTargetView;

/**
 * CHAIN-SOURCE-OFF-01: the source workflow, built as the target's workflow
 * view is. A trigger whose source is not active never fires; the page says so.
 */
export interface ChainTriggerSourceView {
  workflowId: string;
  /** null when the workflow is gone or no longer the owner's. */
  name: string | null;
  /** 'missing' when the workflow is gone or no longer the owner's. */
  status: WorkflowStatus | 'missing';
}

export interface ChainTriggerLastRunView {
  sourceRunId: string;
  sourceCompletedAt: string;
  localDate: string;
  depth: number;
  outcome: AgentChainTriggerRunOutcome;
  reason: string | null;
  collaborationRunId: string | null;
  at: string;
}

export interface ChainTriggerRunView extends ChainTriggerLastRunView {
  id: string;
}

export interface ChainTriggerView {
  id: string;
  sourceWorkflowId: string;
  source: ChainTriggerSourceView;
  target: ChainTriggerTargetView;
  task: string;
  timeZone: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRun: ChainTriggerLastRunView | null;
}

export interface ChainTriggerListView {
  /** CHAIN_TRIGGERS_ENABLED, read live. The routes work either way. */
  enabled: boolean;
  /** GLOBAL_EXECUTION_ENABLED, read live (read-only). */
  runsEnabled: boolean;
  /** The run result tool's switch, read live through isRunResultToolEnabled (read-only). */
  resultToolEnabled: boolean;
  limit: number;
  triggers: ChainTriggerView[];
}

export interface ChainTriggerDeletedView {
  id: string;
  deleted: true;
}

export interface ChainTriggerRunsView {
  runs: ChainTriggerRunView[];
}

type WorkflowSummary = Pick<UserAgent, 'id' | 'name' | 'status'>;

/**
 * TRIGGER-CHAIN-01 S1: the owner's chain triggers (stage-start sections 2 to
 * 4).
 *
 * Every read and write is by owner: another owner's trigger, an unknown id
 * and another owner's, a deleted or an unknown workflow (as source or
 * target) all answer 404 and change nothing. At most three chain triggers per
 * owner, switched on or not (409), counted apart from the other trigger
 * types. The target is never the source (chain_trigger_same_workflow), and a
 * save that closes a cycle among the owner's chain triggers, switched on or
 * off, is refused (chain_trigger_cycle, 409); the limit and the cycle check
 * run under one per-owner lock. The task is stored and answered to its owner
 * only: it is never written to an audit row or a log line, and no workflow
 * name is either. Each write and its audit row share one transaction. No
 * timer, no run read and no run start here (slice S2).
 */
@Injectable()
export class ChainTriggerService {
  private readonly logger = new Logger(ChainTriggerService.name);

  constructor(
    @InjectRepository(AgentChainTrigger)
    private readonly triggers: Repository<AgentChainTrigger>,
    @InjectRepository(AgentChainTriggerRun)
    private readonly runs: Repository<AgentChainTriggerRun>,
    @InjectRepository(UserAgent)
    private readonly workflows: Repository<UserAgent>,
  ) {}

  async list(userId: string): Promise<ChainTriggerListView> {
    const rows = await this.triggers.find({ where: { userId }, order: { createdAt: 'ASC' } });
    // CHAIN-SOURCE-OFF-01: the source and target workflows in one query.
    const workflowIds = [
      ...new Set(
        rows
          .flatMap((row) => [row.sourceWorkflowId, row.workflowId])
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
    const workflows = workflowIds.length > 0 ? await this.workflowsFor(userId, workflowIds) : new Map();
    const triggers: ChainTriggerView[] = [];
    for (const row of rows) {
      triggers.push(this.view(row, workflows, await this.lastRun(row.id, userId)));
    }
    return {
      enabled: isChainTriggersEnabled(),
      runsEnabled: KillSwitchConfig.GLOBAL_EXECUTION_ENABLED,
      resultToolEnabled: isRunResultToolEnabled(),
      limit: CHAIN_TRIGGERS_PER_OWNER_LIMIT,
      triggers,
    };
  }

  async create(userId: string, body: unknown): Promise<ChainTriggerView> {
    const input = readChainTriggerCreate(body);
    const now = new Date();
    const id = randomUUID();
    const row: AgentChainTrigger = {
      id,
      userId,
      sourceWorkflowId: input.sourceWorkflowId,
      targetKind: input.target.kind,
      workflowId: input.target.kind === 'workflow' ? input.target.workflowId : null,
      task: input.task,
      timeZone: input.timeZone,
      enabled: input.enabled,
      armedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const { source, workflow } = await this.triggers.manager.transaction(async (manager: EntityManager) => {
      await this.lockOwner(manager, userId);
      const ownedSource = await this.ownSource(manager, userId, input.sourceWorkflowId);
      const found = await this.ownTarget(manager, userId, input.target);
      const repository = manager.getRepository(AgentChainTrigger);
      const count = await repository.count({ where: { userId } });
      if (count >= CHAIN_TRIGGERS_PER_OWNER_LIMIT) {
        throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.limitReached, {
          limit: CHAIN_TRIGGERS_PER_OWNER_LIMIT,
        });
      }
      await this.assertNoCycle(manager, userId, row);
      await repository.insert(row);
      await this.audit(manager, CHAIN_TRIGGER_AUDIT_EVENTS.created, row);
      return { source: ownedSource, workflow: found };
    });
    this.logger.log(`chain trigger created ${logParts(row)}`);
    return this.view(row, workflowMap(source, workflow), null);
  }

  async update(userId: string, id: string, body: unknown): Promise<ChainTriggerView> {
    if (!isUuid(id)) {
      throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.notFound);
    }
    const patch = readChainTriggerPatch(body);
    const edgeChange = patch.sourceWorkflowId !== undefined || patch.target !== undefined;
    const { row, source, workflow } = await this.triggers.manager.transaction(async (manager: EntityManager) => {
      if (edgeChange) {
        // Stage-start section 3: the cycle check of a source or target
        // change runs under the same per-owner lock as the limit.
        await this.lockOwner(manager, userId);
      }
      const repository = manager.getRepository(AgentChainTrigger);
      const current = await repository.findOne({ where: { id, userId } });
      if (!current) {
        throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.notFound);
      }
      const sourceWorkflowId = patch.sourceWorkflowId ?? current.sourceWorkflowId;
      const target: ChainTriggerTargetInput =
        patch.target ??
        (current.targetKind === 'workflow' && current.workflowId
          ? { kind: 'workflow', workflowId: current.workflowId }
          : { kind: 'chief-of-staff' });
      // The same-workflow rule on the merged row: a source change onto the
      // stored target, or a target change onto the stored source.
      assertNotSameWorkflow(sourceWorkflowId, target);
      const ownedSource =
        patch.sourceWorkflowId !== undefined ? await this.ownSource(manager, userId, patch.sourceWorkflowId) : null;
      const found = patch.target ? await this.ownTarget(manager, userId, patch.target) : null;

      const now = new Date();
      const next: AgentChainTrigger = {
        ...current,
        sourceWorkflowId,
        targetKind: target.kind,
        workflowId: target.kind === 'workflow' ? target.workflowId : null,
        task: patch.task ?? current.task,
        timeZone: patch.timeZone ?? current.timeZone,
        enabled: patch.enabled ?? current.enabled,
        updatedAt: now,
      };
      if (edgeChange) {
        await this.assertNoCycle(manager, userId, next);
      }
      // Stage-start section 2: armed at switch-on and when the source
      // actually changes. A task, target or zone change does not re-arm.
      const rearm = next.sourceWorkflowId !== current.sourceWorkflowId || (next.enabled && !current.enabled);
      if (rearm) {
        next.armedAt = now;
      }
      await repository.update(
        { id, userId },
        {
          sourceWorkflowId: next.sourceWorkflowId,
          targetKind: next.targetKind,
          workflowId: next.workflowId,
          task: next.task,
          timeZone: next.timeZone,
          enabled: next.enabled,
          armedAt: next.armedAt,
          updatedAt: next.updatedAt,
        },
      );
      await this.audit(manager, CHAIN_TRIGGER_AUDIT_EVENTS.updated, next);
      return { row: next, source: ownedSource, workflow: found };
    });
    this.logger.log(`chain trigger updated ${logParts(row)}`);
    // The source and target the change did not check are read in one query
    // (CHAIN-SOURCE-OFF-01), so a stored source shows its status now.
    const workflows = workflowMap(source, workflow);
    const unread = [row.sourceWorkflowId, row.workflowId].filter(
      (workflowId): workflowId is string => workflowId !== null && !workflows.has(workflowId),
    );
    if (unread.length > 0) {
      for (const [workflowId, found] of await this.workflowsFor(userId, [...new Set(unread)])) {
        workflows.set(workflowId, found);
      }
    }
    return this.view(row, workflows, await this.lastRun(id, userId));
  }

  async remove(userId: string, id: string): Promise<ChainTriggerDeletedView> {
    if (!isUuid(id)) {
      throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.notFound);
    }
    const row = await this.triggers.manager.transaction(async (manager: EntityManager) => {
      const repository = manager.getRepository(AgentChainTrigger);
      const current = await repository.findOne({ where: { id, userId } });
      if (!current) {
        throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.notFound);
      }
      // The foreign key cascades too (migration 1814); deleted here as well
      // so the history goes in the same transaction whatever the schema.
      await manager.getRepository(AgentChainTriggerRun).delete({ triggerId: id });
      await repository.delete({ id, userId });
      await this.audit(manager, CHAIN_TRIGGER_AUDIT_EVENTS.deleted, current);
      return current;
    });
    this.logger.log(`chain trigger deleted ${logParts(row)}`);
    return { id, deleted: true };
  }

  async history(userId: string, id: string): Promise<ChainTriggerRunsView> {
    if (!isUuid(id)) {
      throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.notFound);
    }
    const trigger = await this.triggers.findOne({ where: { id, userId } });
    if (!trigger) {
      throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.notFound);
    }
    const rows = await this.runs.find({
      where: { triggerId: id, userId },
      order: { createdAt: 'DESC' },
      take: CHAIN_TRIGGER_HISTORY_LIMIT,
    });
    return { runs: rows.map((run) => ({ id: run.id, ...runView(run) })) };
  }

  private async lockOwner(manager: EntityManager, userId: string): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
      CHAIN_TRIGGER_LIMIT_LOCK_NAMESPACE,
      userId,
    ]);
  }

  /** Refuses a save that closes a cycle among all the owner's chain triggers, switched on or off. */
  private async assertNoCycle(manager: EntityManager, userId: string, candidate: AgentChainTrigger): Promise<void> {
    if (candidate.targetKind !== 'workflow') {
      return;
    }
    const stored = await manager.getRepository(AgentChainTrigger).find({
      where: { userId },
      select: ['id', 'sourceWorkflowId', 'targetKind', 'workflowId'],
    });
    if (closesChainCycle(stored, candidate)) {
      throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.cycle);
    }
  }

  /**
   * The owner's own, not deleted workflow as the source, or 404. Any status is
   * accepted (CHAIN-SOURCE-OFF-01: a switched-off source is warned about on
   * the page, not refused); the summary feeds the answer's source view.
   */
  private async ownSource(manager: EntityManager, userId: string, workflowId: string): Promise<WorkflowSummary> {
    return this.ownWorkflow(manager, userId, workflowId);
  }

  /** The owner's own, not deleted workflow as the target, or 404. null for the Chief of Staff. */
  private async ownTarget(
    manager: EntityManager,
    userId: string,
    target: ChainTriggerTargetInput,
  ): Promise<WorkflowSummary | null> {
    return target.kind === 'workflow' ? this.ownWorkflow(manager, userId, target.workflowId) : null;
  }

  private async ownWorkflow(manager: EntityManager, userId: string, workflowId: string): Promise<WorkflowSummary> {
    const found = await manager.getRepository(UserAgent).findOne({
      where: { id: workflowId, userId, deletedAt: IsNull() },
      select: ['id', 'name', 'status'],
    });
    if (!found) {
      throw chainTriggerError(CHAIN_TRIGGER_ERROR_CODES.workflowNotFound);
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

  private async lastRun(triggerId: string, userId: string): Promise<ChainTriggerLastRunView | null> {
    const run = await this.runs.findOne({
      where: { triggerId, userId },
      order: { createdAt: 'DESC' },
    });
    return run ? runView(run) : null;
  }

  private view(
    row: AgentChainTrigger,
    workflows: Map<string, WorkflowSummary>,
    lastRun: ChainTriggerLastRunView | null,
  ): ChainTriggerView {
    return {
      id: row.id,
      sourceWorkflowId: row.sourceWorkflowId,
      source: sourceView(row.sourceWorkflowId, workflows),
      target: targetView(row.targetKind, row.workflowId, workflows),
      task: row.task,
      timeZone: row.timeZone,
      enabled: row.enabled,
      createdAt: isoOf(row.createdAt),
      updatedAt: isoOf(row.updatedAt),
      lastRun,
    };
  }

  /** Ids and the target kind only: never the task or a workflow name. */
  private async audit(manager: EntityManager, eventType: string, row: AgentChainTrigger): Promise<void> {
    await manager.getRepository(AuditEventEntity).insert({
      category: CHAIN_TRIGGER_AUDIT_CATEGORY,
      eventType,
      subjectType: CHAIN_TRIGGER_AUDIT_SUBJECT_TYPE,
      subjectId: row.id,
      userId: row.userId,
      payload: {
        triggerId: row.id,
        targetKind: row.targetKind,
        sourceWorkflowId: row.sourceWorkflowId,
        workflowId: row.workflowId,
      },
      occurredAt: new Date(),
    });
  }
}

/** The source workflow's id, name and status; name null and status 'missing' when it is gone. */
function sourceView(workflowId: string, workflows: Map<string, WorkflowSummary>): ChainTriggerSourceView {
  const workflow = workflows.get(workflowId);
  return {
    workflowId,
    name: workflow ? workflow.name : null,
    status: workflow ? workflowStatus(workflow.status) : 'missing',
  };
}

function targetView(
  kind: AgentChainTriggerTargetKind,
  workflowId: string | null,
  workflows: Map<string, WorkflowSummary>,
): ChainTriggerTargetView {
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

/** Ids, times, a date, the depth and codes only. */
function runView(run: AgentChainTriggerRun): ChainTriggerLastRunView {
  return {
    sourceRunId: run.sourceRunId,
    sourceCompletedAt: isoOf(run.sourceCompletedAt),
    localDate: localDateOf(run.localDate),
    depth: Number(run.depth),
    outcome: run.outcome,
    reason: run.reason ?? null,
    collaborationRunId: run.collaborationRunId ?? null,
    at: isoOf(run.createdAt),
  };
}

function workflowMap(...found: Array<WorkflowSummary | null>): Map<string, WorkflowSummary> {
  const map = new Map<string, WorkflowSummary>();
  for (const workflow of found) {
    if (workflow) map.set(workflow.id, workflow);
  }
  return map;
}

/** The ids and the target kind: never the task or a workflow name. */
function logParts(row: AgentChainTrigger): string {
  const workflow = row.workflowId ? ` workflowId=${row.workflowId}` : '';
  return `userId=${row.userId} triggerId=${row.id} targetKind=${row.targetKind} sourceWorkflowId=${row.sourceWorkflowId}${workflow}`;
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
