import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, IsNull, LessThan, LessThanOrEqual, MoreThan, MoreThanOrEqual, Not, Repository } from 'typeorm';
import type { ApiKeyIdentity } from '../auth/api-key.config';
import { EntitlementService } from '../auth/entitlement.service';
import { AgentChainTrigger } from '../entities/agent-chain-trigger.entity';
import { AgentChainTriggerRun } from '../entities/agent-chain-trigger-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { User } from '../entities/user.entity';
import { UserAgent } from '../entities/user-agent.entity';
import { CollaborationReferralEntity } from '../orchestration/collaboration-referral.entity';
import { isRunResultToolEnabled } from '../orchestration/collaboration-result-grant';
import { CollaborationRunEntity } from '../orchestration/collaboration-run.entity';
import {
  CollaborationStartService,
  type CollaborationStartInput,
} from '../orchestration/collaboration-start.service';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { DailyCreditCapService } from '../safety/daily-credit-cap.service';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import {
  CHAIN_TRIGGER_LOOKBACK_MS,
  chainDepthOf,
  chainRunMatch,
  chainTriggerTask,
  isPastChainDepth,
  type ChainTriggerFinishedRun,
  type ChainTriggerFirstStep,
} from './chain-trigger-match';
import {
  CHAIN_TRIGGER_DAY_LIMIT,
  CHAIN_TRIGGER_DAY_ROW_CAP,
  CHAIN_TRIGGER_RUN_AUDIT_EVENTS,
  chainTriggerCancelReason,
  type ChainTriggerSkipReason,
} from './chain-trigger-reasons';
import { isChainTriggersEnabled } from './chain-trigger-switch';
import { CHAIN_TRIGGER_AUDIT_CATEGORY, CHAIN_TRIGGER_AUDIT_SUBJECT_TYPE } from './chain-trigger.service';
import { scheduleRefusalOf } from './schedule-refusal';

/** TRIGGER-CHAIN-01 S2 (stage-start sections 2 to 4): code constants, no env knobs. */
export const CHAIN_TRIGGER_RUN_LIMITS = {
  /** Enabled triggers read per tick. */
  triggersPerTick: 300,
  /** Claims that go to the start path per tick; the rest are found again next tick. */
  startsPerTick: 5,
  /** Finished runs read per tick, the oldest completion first. */
  runsPerRead: 500,
  /** A claimed row older than this is closed as skipped / interrupted. */
  claimTimeoutMs: 10 * 60 * 1000,
  /** History rows older than this are pruned. */
  historyRetentionMs: 90 * 24 * 60 * 60 * 1000,
  /** The prune runs at most once in this time. */
  pruneEveryMs: 60 * 60 * 1000,
} as const;

/**
 * The only collaboration_runs columns this file ever loads (stage-start
 * section 2, The read): the run id, the owner, the status, two times and the
 * hand-off ids. Never the task, an answer or any other text.
 */
export const CHAIN_TRIGGER_RUN_SELECT = [
  'collaborationRunId',
  'userId',
  'status',
  'createdAt',
  'completedAt',
  'referralIds',
] as const;

/**
 * The only read of collaboration_referrals (stage-start section 2, The read):
 * for the runs' first hand-offs, the hand-off id, its run id, its target id
 * and the two JSON paths workflow.id and workflow.testRun of its pending_job.
 * The pending_job column itself (it holds the task) and the answer column
 * are never selected.
 */
export const CHAIN_TRIGGER_FIRST_STEP_SQL = [
  'SELECT f.referral_id AS "referralId",',
  'f.collaboration_run_id AS "collaborationRunId",',
  'f.target_builder_profile_id AS "targetId",',
  `f.pending_job #>> '{workflow,id}' AS "workflowId",`,
  `f.pending_job #>> '{workflow,testRun}' AS "testRun"`,
  'FROM "public"."collaboration_referrals" f',
  'WHERE f.referral_id = ANY($1::text[])',
].join(' ');

/** What one tick did (counts only; for tests and the log line). */
export interface ChainTriggerTickSummary {
  evaluated: number;
  started: number;
  skipped: number;
  /** Finished runs not written past the row cap. */
  capped: number;
  interrupted: number;
  pruned: number;
}

interface PlannedStart {
  trigger: AgentChainTrigger;
  sourceRunId: string;
  completedAt: Date;
  localDate: string;
}

interface ClaimedStart {
  rowId: string;
  trigger: AgentChainTrigger;
  sourceRunId: string;
  /** The finished run's completion (settle) time: the time printed in the task. */
  completedAt: Date;
  localDate: string;
  depth: number;
}

interface FirstStepRow {
  referralId: string;
  collaborationRunId: string;
  targetId: string | null;
  workflowId: string | null;
  testRun: string | boolean | null;
}

function errorName(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error';
  return /^[A-Za-z0-9_]{1,64}$/.test(name) ? name : 'Error';
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: unknown; driverError?: { code?: unknown } } | null;
  return candidate?.code === '23505' || candidate?.driverError?.code === '23505';
}

function localDateText(value: string | Date): string {
  if (!(value instanceof Date)) {
    return String(value);
  }
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

function dateOf(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * TRIGGER-CHAIN-01 S2 (stage-start sections 2 to 5): one tick of the chain
 * timer. ChainTriggerTimer calls tick() only while CHAIN_TRIGGERS_ENABLED is
 * on; tick() reads it again itself, so a direct call while it is off reads
 * nothing either.
 *
 * Unless CHAIN_TRIGGERS_ENABLED, runs (GLOBAL_EXECUTION_ENABLED) and the run
 * result tool's switch (read through isRunResultToolEnabled, imported) are
 * all on, the tick returns at once: no run read and nothing recorded (Keith's
 * Q1; without the tool a started run could not read the finished run).
 *
 * Each tick otherwise, in the order of stage-start section 2: close claims
 * older than 10 minutes as interrupted; prune history older than 90 days (at
 * most hourly); read the enabled triggers; read collaboration_runs once for
 * their owners (completed, completed in the last 60 minutes; the columns of
 * CHAIN_TRIGGER_RUN_SELECT only) and the runs' first hand-offs once
 * (CHAIN_TRIGGER_FIRST_STEP_SQL: a target id and two JSON paths; never the
 * pending_job column or the answer). Then per matching (trigger, run),
 * oldest completion first, at most 5 claims a tick:
 *  1. the match (chain-trigger-match.ts), and the pairs that already have a
 *     row are dropped;
 *  2. the row cap: 20 history rows for the trigger on the run's local day;
 *     past it nothing is written (one count-only log line);
 *  3. the depth (stage-start section 3): 1 plus the depth of the owner's
 *     chain row that started the finished run, or 1;
 *  4. the claim: one insert (trigger_id, source_run_id) with outcome claimed.
 *     A unique violation drops it (another tick or process has it). The
 *     claim is the one attempt: never a retry;
 *  5. past depth 3: chain_depth;
 *  6. the day limit: 5 runs started on the run's local day (day_limit);
 *  7. the schedule pre-checks: runs_off, inactive, not_entitled,
 *     workflow_gone (the source or the target workflow is gone; the trigger
 *     is also switched off), over_cap (DailyCreditCapService, read-only);
 *  8. the Team page's body, { team: 'chief-of-staff', task } or
 *     { workflowId, task }, read by the page's own parser; never a sessionId,
 *     never testRun. The task is the saved task plus the completion time and
 *     the finished run's id (Keith's Q2);
 *  9. CollaborationStartService.start with the identity the session guard
 *     builds for the owner;
 * 10. approveStep for the first hand-off with the owner as decidedBy (Q7).
 * A refusal at start or approve is mapped by scheduleRefusalOf; a run that
 * was created is cancelled with chain_trigger_skipped:<reason>.
 *
 * A start writes one chain_run_started audit row, a skip one
 * chain_run_skipped row. Audit payloads and log lines hold ids, the local
 * date, the target kind, the depth and a reason code only: never the task, a
 * workflow name or any answer text.
 */
@Injectable()
export class ChainTriggerRunService {
  private readonly logger = new Logger('ChainTriggerRuns');
  /** The last trigger id read when the table holds more than one tick's read. */
  private cursor: string | null = null;
  private lastPruneAt: number | null = null;

  constructor(
    @InjectRepository(AgentChainTrigger)
    private readonly triggers: Repository<AgentChainTrigger>,
    @InjectRepository(AgentChainTriggerRun)
    private readonly runs: Repository<AgentChainTriggerRun>,
    @InjectRepository(CollaborationRunEntity)
    private readonly collaborationRuns: Repository<CollaborationRunEntity>,
    @InjectRepository(CollaborationReferralEntity)
    private readonly referrals: Repository<CollaborationReferralEntity>,
    @InjectRepository(UserAgent)
    private readonly workflows: Repository<UserAgent>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(AuditEventEntity)
    private readonly audit: Repository<AuditEventEntity>,
    private readonly starts: CollaborationStartService,
    private readonly orchestration: OrchestrationService,
    private readonly entitlements: EntitlementService,
    private readonly caps: DailyCreditCapService,
  ) {}

  async tick(now: Date = new Date()): Promise<ChainTriggerTickSummary> {
    const summary: ChainTriggerTickSummary = {
      evaluated: 0,
      started: 0,
      skipped: 0,
      capped: 0,
      interrupted: 0,
      pruned: 0,
    };
    if (!KillSwitchConfig.GLOBAL_EXECUTION_ENABLED || !isChainTriggersEnabled() || !isRunResultToolEnabled()) {
      return summary;
    }
    summary.interrupted = await this.closeStaleClaims(now);
    summary.pruned = await this.pruneHistory(now);

    // TRIGGER-CHAIN-FAILED-01 S1: only triggers that fire on a completed run,
    // until S2 builds the failed-run read; a row without the value (none in
    // the table: NOT NULL, default completed) reads as completed.
    const triggers = (await this.readEnabled()).filter(
      (row) => row.enabled === true && (row.firesOn ?? 'completed') === 'completed',
    );
    summary.evaluated = triggers.length;
    if (triggers.length === 0) {
      return summary;
    }
    const finished = await this.readFinishedRuns(triggers, now);
    if (finished.length === 0) {
      return summary;
    }
    const plans = await this.planStarts(triggers, finished, now);

    const capped = new Map<string, { trigger: AgentChainTrigger; localDate: string; runs: number }>();
    let attempts = 0;
    for (const plan of plans) {
      if (attempts >= CHAIN_TRIGGER_RUN_LIMITS.startsPerTick) {
        break;
      }
      const claimed = await this.capAndClaim(plan, now, summary, capped);
      if (!claimed) {
        continue;
      }
      attempts += 1;
      const outcome = await this.startClaimed(claimed);
      if (outcome === 'started') summary.started += 1;
      else if (outcome === 'skipped') summary.skipped += 1;
    }
    for (const entry of capped.values()) {
      // Counts only: no finished run past the cap is recorded.
      this.logger.log(
        `chain trigger row cap reached triggerId=${entry.trigger.id} userId=${entry.trigger.userId} localDate=${entry.localDate} runs=${entry.runs}`,
      );
    }
    return summary;
  }

  /** At most 300 enabled triggers, by id, continuing after the last tick's read. */
  private async readEnabled(): Promise<AgentChainTrigger[]> {
    const limit = CHAIN_TRIGGER_RUN_LIMITS.triggersPerTick;
    const cursor = this.cursor;
    const first = await this.triggers.find({
      where: cursor ? { enabled: true, id: MoreThan(cursor) } : { enabled: true },
      order: { id: 'ASC' },
      take: limit,
    });
    let rows = first;
    if (cursor && first.length < limit) {
      const wrapped = await this.triggers.find({
        where: { enabled: true, id: LessThanOrEqual(cursor) },
        order: { id: 'ASC' },
        take: limit - first.length,
      });
      rows = first.concat(wrapped);
    }
    this.cursor = rows.length >= limit ? rows[rows.length - 1].id : null;
    return rows;
  }

  /**
   * Stage-start section 2 (The read): one read of collaboration_runs a tick
   * for the owners with a switched-on trigger, completed in the last 60
   * minutes, selecting CHAIN_TRIGGER_RUN_SELECT only; then one read of those
   * runs' first hand-offs (referral_ids[0]) by CHAIN_TRIGGER_FIRST_STEP_SQL.
   * A first hand-off counts only when it belongs to the same run. Nothing
   * under orchestration/ is called: these are this service's own
   * repositories.
   */
  private async readFinishedRuns(triggers: AgentChainTrigger[], now: Date): Promise<ChainTriggerFinishedRun[]> {
    const owners = [...new Set(triggers.map((trigger) => trigger.userId))];
    const since = new Date(now.getTime() - CHAIN_TRIGGER_LOOKBACK_MS);
    const rows = await this.collaborationRuns.find({
      where: { userId: In(owners), status: 'completed', completedAt: MoreThanOrEqual(since) },
      select: [...CHAIN_TRIGGER_RUN_SELECT],
      order: { completedAt: 'ASC' },
      take: CHAIN_TRIGGER_RUN_LIMITS.runsPerRead,
    });
    const firstIds = new Map<string, string>();
    for (const row of rows) {
      const first = Array.isArray(row.referralIds) ? row.referralIds[0] : undefined;
      if (typeof first === 'string' && first.length > 0) {
        firstIds.set(row.collaborationRunId, first);
      }
    }
    const steps = new Map<string, FirstStepRow>();
    if (firstIds.size > 0) {
      const found = (await this.referrals.query(CHAIN_TRIGGER_FIRST_STEP_SQL, [
        [...new Set(firstIds.values())],
      ])) as FirstStepRow[];
      for (const step of found ?? []) {
        if (step && typeof step.referralId === 'string') {
          steps.set(step.referralId, step);
        }
      }
    }
    return rows.map((row) => {
      const referralId = firstIds.get(row.collaborationRunId);
      const step = referralId ? steps.get(referralId) : undefined;
      const firstStep: ChainTriggerFirstStep | null =
        step && step.collaborationRunId === row.collaborationRunId
          ? {
              targetId: textOrNull(step.targetId),
              workflowId: textOrNull(step.workflowId),
              testRun: step.testRun ?? null,
            }
          : null;
      return {
        runId: row.collaborationRunId,
        userId: row.userId,
        status: row.status,
        createdAt: row.createdAt,
        completedAt: row.completedAt,
        firstStep,
      };
    });
  }

  /** Every (trigger, finished run) pair that matches and has no row yet, the oldest completion first. */
  private async planStarts(
    triggers: AgentChainTrigger[],
    finished: ChainTriggerFinishedRun[],
    now: Date,
  ): Promise<PlannedStart[]> {
    const matched: PlannedStart[] = [];
    for (const trigger of triggers) {
      for (const run of finished) {
        const result = chainRunMatch(trigger, run, now);
        if (!result.match) continue;
        matched.push({
          trigger,
          sourceRunId: result.runId,
          completedAt: result.completedAt,
          localDate: result.localDate,
        });
      }
    }
    if (matched.length === 0) {
      return [];
    }
    const recorded = await this.runs.find({
      where: matched.map((plan) => ({ triggerId: plan.trigger.id, sourceRunId: plan.sourceRunId })),
      select: ['triggerId', 'sourceRunId'],
    });
    const taken = new Set(recorded.map((row) => `${row.triggerId}|${row.sourceRunId}`));
    return matched
      .filter((plan) => !taken.has(`${plan.trigger.id}|${plan.sourceRunId}`))
      .sort((a, b) => {
        const diff = a.completedAt.getTime() - b.completedAt.getTime();
        if (diff !== 0) return diff;
        if (a.sourceRunId !== b.sourceRunId) return a.sourceRunId < b.sourceRunId ? -1 : 1;
        return a.trigger.id < b.trigger.id ? -1 : a.trigger.id > b.trigger.id ? 1 : 0;
      });
  }

  /** The row cap, the depth, then the one claim insert. null when nothing was claimed. */
  private async capAndClaim(
    plan: PlannedStart,
    now: Date,
    summary: ChainTriggerTickSummary,
    capped: Map<string, { trigger: AgentChainTrigger; localDate: string; runs: number }>,
  ): Promise<ClaimedStart | null> {
    const { trigger, localDate } = plan;
    const rowsToday = await this.runs.count({ where: { triggerId: trigger.id, localDate } });
    if (rowsToday >= CHAIN_TRIGGER_DAY_ROW_CAP) {
      summary.capped += 1;
      const key = `${trigger.id}|${localDate}`;
      const entry = capped.get(key) ?? { trigger, localDate, runs: 0 };
      entry.runs += 1;
      capped.set(key, entry);
      return null;
    }

    const depth = await this.depthFor(trigger.userId, plan.sourceRunId);
    const rowId = randomUUID();
    try {
      await this.runs.insert({
        id: rowId,
        triggerId: trigger.id,
        userId: trigger.userId,
        sourceRunId: plan.sourceRunId,
        sourceCompletedAt: plan.completedAt,
        localDate,
        depth,
        outcome: 'claimed',
        reason: null,
        collaborationRunId: null,
        createdAt: now,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        this.logger.warn(
          `chain trigger claim failed triggerId=${trigger.id} localDate=${localDate} reason=${errorName(error)}`,
        );
      }
      return null;
    }
    return {
      rowId,
      trigger,
      sourceRunId: plan.sourceRunId,
      completedAt: plan.completedAt,
      localDate,
      depth,
    };
  }

  /**
   * Stage-start section 3, bound 2: the owner's chain rows (started, or
   * claimed and holding a run id) that started the finished run. Read from
   * this trigger type's own table; nothing is written on a run.
   */
  private async depthFor(userId: string, sourceRunId: string): Promise<number> {
    const parents = await this.runs.find({
      where: { userId, collaborationRunId: sourceRunId, outcome: In(['started', 'claimed']) },
      select: ['depth'],
    });
    return chainDepthOf(parents.map((row) => row.depth));
  }

  /** The depth, the day limit, the pre-checks, start and approve for one claim. */
  private async startClaimed(claimed: ClaimedStart): Promise<'started' | 'skipped' | 'error'> {
    try {
      if (isPastChainDepth(claimed.depth)) {
        await this.skip(claimed, 'chain_depth', null);
        return 'skipped';
      }

      if ((await this.startedOnDay(claimed)) >= CHAIN_TRIGGER_DAY_LIMIT) {
        await this.skip(claimed, 'day_limit', null);
        return 'skipped';
      }

      const pre = await this.preCheck(claimed.trigger);
      if (pre) {
        if (pre === 'workflow_gone') {
          await this.switchOff(claimed, pre);
        }
        await this.skip(claimed, pre, null);
        return 'skipped';
      }

      let input: CollaborationStartInput;
      try {
        const task = chainTriggerTask(claimed.trigger.task, {
          sourceRunId: claimed.sourceRunId,
          timeZone: claimed.trigger.timeZone,
          completedAt: claimed.completedAt,
        });
        input = this.starts.readStartBody(this.startBody(claimed.trigger, task));
      } catch (error) {
        await this.skip(claimed, scheduleRefusalOf(error), null);
        return 'skipped';
      }
      if (input.sessionId !== undefined || ('testRun' in input && input.testRun !== false)) {
        await this.skip(claimed, 'refused', null);
        return 'skipped';
      }

      let started: { collaborationRunId: string; referralId: string };
      try {
        started = await this.starts.start(this.identityFor(claimed.trigger.userId), input);
      } catch (error) {
        const reason = scheduleRefusalOf(error);
        if (reason === 'workflow_gone') {
          await this.switchOff(claimed, reason);
        }
        await this.skip(claimed, reason, null);
        return 'skipped';
      }
      await this.noteRun(claimed, started.collaborationRunId);

      try {
        await this.starts.approveStep({
          collaborationRunId: started.collaborationRunId,
          referralId: started.referralId,
          decidedBy: claimed.trigger.userId,
          approveWithoutPassingTests: false,
        });
      } catch (error) {
        const reason = scheduleRefusalOf(error);
        await this.cancelRefused(claimed, started.collaborationRunId, reason);
        await this.skip(claimed, reason, started.collaborationRunId);
        return 'skipped';
      }

      await this.finish(claimed, 'started', null, started.collaborationRunId);
      await this.writeAudit(CHAIN_TRIGGER_RUN_AUDIT_EVENTS.runStarted, claimed, null, started.collaborationRunId);
      this.logger.log(`chain trigger run started ${logParts(claimed)} runId=${started.collaborationRunId}`);
      return 'started';
    } catch (error) {
      // The claimed row stays and is closed as interrupted after 10 minutes. Never retried.
      this.logger.error(
        JSON.stringify({
          event: 'chain_trigger.start_failed',
          triggerId: claimed.trigger.id,
          localDate: claimed.localDate,
          errorName: errorName(error),
        }),
      );
      return 'error';
    }
  }

  /**
   * Keith's Q3 (stage-start section 3, bound 3): the runs started (or in
   * flight in another process) for this trigger on the finished run's local
   * day, not counting this claim. Each started or claimed row is one run.
   */
  private async startedOnDay(claimed: ClaimedStart): Promise<number> {
    return this.runs.count({
      where: {
        triggerId: claimed.trigger.id,
        localDate: claimed.localDate,
        outcome: In(['started', 'claimed']),
        id: Not(claimed.rowId),
      },
    });
  }

  /** The schedule pre-checks (stage-start section 3, bound 5): each a skip with nothing else created. */
  private async preCheck(trigger: AgentChainTrigger): Promise<ChainTriggerSkipReason | null> {
    if (!KillSwitchConfig.GLOBAL_EXECUTION_ENABLED) {
      return 'runs_off';
    }
    const owner = await this.users.findOne({ where: { id: trigger.userId }, select: ['id', 'isActive'] });
    if (!owner || owner.isActive !== true) {
      return 'inactive';
    }
    if (!(await this.entitlements.resolveHarnessEntitled(trigger.userId))) {
      return 'not_entitled';
    }
    if (!(await this.ownWorkflowExists(trigger.userId, trigger.sourceWorkflowId))) {
      return 'workflow_gone';
    }
    if (trigger.targetKind === 'workflow') {
      if (!(await this.ownWorkflowExists(trigger.userId, trigger.workflowId))) {
        return 'workflow_gone';
      }
    } else if (trigger.targetKind !== 'chief-of-staff') {
      return 'refused';
    }
    try {
      await this.caps.assertWithinDailyCap(trigger.userId);
    } catch (error) {
      return scheduleRefusalOf(error);
    }
    return null;
  }

  /** The owner's workflow, not deleted (its id only; never its name). */
  private async ownWorkflowExists(userId: string, workflowId: string | null): Promise<boolean> {
    if (!workflowId) {
      return false;
    }
    const workflow = await this.workflows.findOne({
      where: { id: workflowId, userId, deletedAt: IsNull() },
      select: ['id'],
    });
    return Boolean(workflow);
  }

  /** The Team page's body (no sessionId, no testRun). */
  private startBody(trigger: AgentChainTrigger, task: string): Record<string, string> {
    return trigger.targetKind === 'workflow' && trigger.workflowId
      ? { workflowId: trigger.workflowId, task }
      : { team: 'chief-of-staff', task };
  }

  /** The identity the session guard builds for the owner (as schedule-run.service.ts), harness access read just before. */
  private identityFor(userId: string): ApiKeyIdentity {
    return {
      userId,
      apiKeyId: 'browser-session',
      scopes: ['ai:execute'],
      isInternal: true,
      harnessEntitled: true,
    };
  }

  /** The run id on the claimed row, so an interrupted claim still points at its run (and counts for the depth). */
  private async noteRun(claimed: ClaimedStart, collaborationRunId: string): Promise<void> {
    try {
      await this.runs.update({ id: claimed.rowId, outcome: 'claimed' }, { collaborationRunId });
    } catch (error) {
      this.logger.warn(`chain trigger run note failed triggerId=${claimed.trigger.id} reason=${errorName(error)}`);
    }
  }

  /** A skip: the row gets the reason; one audit row; one log line. */
  private async skip(
    claimed: ClaimedStart,
    reason: ChainTriggerSkipReason,
    collaborationRunId: string | null,
  ): Promise<void> {
    await this.finish(claimed, 'skipped', reason, collaborationRunId);
    await this.writeAudit(CHAIN_TRIGGER_RUN_AUDIT_EVENTS.runSkipped, claimed, reason, collaborationRunId);
    this.logger.log(
      `chain trigger run skipped ${logParts(claimed)} reason=${reason}${collaborationRunId ? ` runId=${collaborationRunId}` : ''}`,
    );
  }

  /** Moves the claimed row to its outcome (only while it is still claimed). */
  private async finish(
    claimed: ClaimedStart,
    outcome: 'started' | 'skipped',
    reason: ChainTriggerSkipReason | null,
    collaborationRunId: string | null,
  ): Promise<void> {
    await this.runs.update(
      { id: claimed.rowId, outcome: 'claimed' },
      { outcome, reason, ...(collaborationRunId ? { collaborationRunId } : {}) },
    );
  }

  /** A run that was created and then refused is cancelled (the page's cancel with a reason code). */
  private async cancelRefused(
    claimed: ClaimedStart,
    collaborationRunId: string,
    reason: ChainTriggerSkipReason,
  ): Promise<void> {
    try {
      await this.orchestration.cancelCollaboration({
        collaborationRunId,
        cancelledByUserId: claimed.trigger.userId,
        cancelReason: chainTriggerCancelReason(reason),
      });
    } catch (error) {
      this.logger.warn(
        `chain trigger run cancel failed triggerId=${claimed.trigger.id} runId=${collaborationRunId} reason=${errorName(error)}`,
      );
    }
  }

  /** As a schedule (Keith's Q10 of TRIGGER-01): a trigger whose source or target workflow is gone is switched off. */
  private async switchOff(claimed: ClaimedStart, reason: ChainTriggerSkipReason): Promise<void> {
    const result = await this.triggers.update(
      { id: claimed.trigger.id, userId: claimed.trigger.userId, enabled: true },
      { enabled: false, updatedAt: new Date() },
    );
    if ((result.affected ?? 0) > 0) {
      await this.writeAudit(CHAIN_TRIGGER_RUN_AUDIT_EVENTS.triggerDisabled, claimed, reason, null);
      this.logger.log(
        `chain trigger disabled triggerId=${claimed.trigger.id} userId=${claimed.trigger.userId} reason=${reason}`,
      );
    }
  }

  /**
   * Claims older than 10 minutes: skipped / interrupted, one audit row each.
   * A run they made is left as it is.
   */
  private async closeStaleClaims(now: Date): Promise<number> {
    const before = new Date(now.getTime() - CHAIN_TRIGGER_RUN_LIMITS.claimTimeoutMs);
    const stale = await this.runs.find({
      where: { outcome: 'claimed', createdAt: LessThan(before) },
      order: { createdAt: 'ASC' },
      take: CHAIN_TRIGGER_RUN_LIMITS.triggersPerTick,
    });
    let closed = 0;
    for (const row of stale) {
      const result = await this.runs.update(
        { id: row.id, outcome: 'claimed' },
        { outcome: 'skipped', reason: 'interrupted' },
      );
      if ((result.affected ?? 0) === 0) {
        continue;
      }
      closed += 1;
      const trigger = await this.triggers.findOne({ where: { id: row.triggerId } });
      const claimed: ClaimedStart = {
        rowId: row.id,
        sourceRunId: row.sourceRunId,
        completedAt: dateOf(row.sourceCompletedAt),
        localDate: localDateText(row.localDate),
        depth: Number(row.depth),
        trigger:
          trigger ??
          ({
            id: row.triggerId,
            userId: row.userId,
            sourceWorkflowId: null,
            targetKind: 'chief-of-staff',
            workflowId: null,
          } as unknown as AgentChainTrigger),
      };
      await this.writeAudit(
        CHAIN_TRIGGER_RUN_AUDIT_EVENTS.runSkipped,
        claimed,
        'interrupted',
        row.collaborationRunId ?? null,
      );
      this.logger.log(
        `chain trigger run skipped ${logParts(claimed)} reason=interrupted${row.collaborationRunId ? ` runId=${row.collaborationRunId}` : ''}`,
      );
    }
    return closed;
  }

  /** History rows older than 90 days, at most once an hour. */
  private async pruneHistory(now: Date): Promise<number> {
    if (this.lastPruneAt !== null && now.getTime() - this.lastPruneAt < CHAIN_TRIGGER_RUN_LIMITS.pruneEveryMs) {
      return 0;
    }
    this.lastPruneAt = now.getTime();
    const before = new Date(now.getTime() - CHAIN_TRIGGER_RUN_LIMITS.historyRetentionMs);
    const result = await this.runs.delete({ createdAt: LessThan(before), outcome: In(['started', 'skipped']) });
    const pruned = result.affected ?? 0;
    if (pruned > 0) {
      this.logger.log(`chain trigger history pruned rows=${pruned}`);
    }
    return pruned;
  }

  /**
   * Stage-start section 4 (Audit): the trigger id, the local date, the target
   * kind, the source and target workflow ids, the finished and the started
   * run ids, the depth and a reason code only. Never the task, a workflow
   * name or any answer text.
   */
  private async writeAudit(
    eventType: string,
    claimed: ClaimedStart,
    reason: ChainTriggerSkipReason | null,
    collaborationRunId: string | null,
  ): Promise<void> {
    const payload: Record<string, string | number | null> = {
      triggerId: claimed.trigger.id,
      localDate: claimed.localDate,
      targetKind: claimed.trigger.targetKind,
      sourceWorkflowId: claimed.trigger.sourceWorkflowId ?? null,
      workflowId: claimed.trigger.workflowId ?? null,
      sourceRunId: claimed.sourceRunId,
      depth: claimed.depth,
    };
    if (collaborationRunId) payload.collaborationRunId = collaborationRunId;
    if (reason) payload.reason = reason;
    try {
      await this.audit.insert({
        category: CHAIN_TRIGGER_AUDIT_CATEGORY,
        eventType,
        subjectType: CHAIN_TRIGGER_AUDIT_SUBJECT_TYPE,
        subjectId: claimed.trigger.id,
        userId: claimed.trigger.userId,
        payload,
        occurredAt: new Date(),
      });
    } catch (error) {
      this.logger.warn(`chain trigger audit insert failed event=${eventType} reason=${errorName(error)}`);
    }
  }
}

/** Ids, the local date, the target kind and the depth: never the task or a workflow name. */
function logParts(claimed: ClaimedStart): string {
  const trigger = claimed.trigger;
  const workflow = trigger.workflowId ? ` workflowId=${trigger.workflowId}` : '';
  return `triggerId=${trigger.id} userId=${trigger.userId} localDate=${claimed.localDate} targetKind=${trigger.targetKind}${workflow} sourceWorkflowId=${trigger.sourceWorkflowId} sourceRunId=${claimed.sourceRunId} depth=${claimed.depth}`;
}
