import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, IsNull, LessThan, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import type { ApiKeyIdentity } from '../auth/api-key.config';
import { EntitlementService } from '../auth/entitlement.service';
import { AgentSchedule } from '../entities/agent-schedule.entity';
import { AgentScheduleRun } from '../entities/agent-schedule-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { User } from '../entities/user.entity';
import { UserAgent } from '../entities/user-agent.entity';
import {
  CollaborationStartService,
  type CollaborationStartInput,
} from '../orchestration/collaboration-start.service';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { DailyCreditCapService } from '../safety/daily-credit-cap.service';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { scheduleDue } from './schedule-due';
import { scheduleRefusalOf, type ScheduleSkipReason } from './schedule-refusal';
import { TRIGGER_AUDIT_CATEGORY, TRIGGER_AUDIT_SUBJECT_TYPE } from './schedule.service';

/** TRIGGER-01 S2: the timer's audit rows (stage-start section 5). */
export const TRIGGER_RUN_AUDIT_EVENTS = {
  runStarted: 'run_started',
  runSkipped: 'run_skipped',
  scheduleDisabled: 'schedule_disabled',
} as const;

/** TRIGGER-01 S2 (stage-start section 3): code constants, no env knobs. */
export const SCHEDULE_RUN_LIMITS = {
  /** Enabled schedules read per tick. */
  schedulesPerTick: 200,
  /** Occurrences that go to the start path per tick; the rest wait for the next tick. */
  startsPerTick: 5,
  /** A claimed row older than this is closed as skipped / interrupted. */
  claimTimeoutMs: 10 * 60 * 1000,
  /** History rows older than this are pruned. */
  historyRetentionMs: 90 * 24 * 60 * 60 * 1000,
  /** The prune runs at most once in this time. */
  pruneEveryMs: 60 * 60 * 1000,
} as const;

/** The cancel reason of a run that was created and then refused. */
export function scheduleCancelReason(reason: ScheduleSkipReason): string {
  return `schedule_skipped:${reason}`;
}

/** What one tick did (counts only; for tests and the log line). */
export interface ScheduleTickSummary {
  evaluated: number;
  started: number;
  skipped: number;
  interrupted: number;
  pruned: number;
}

interface ClaimedOccurrence {
  rowId: string;
  schedule: AgentSchedule;
  localDate: string;
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

/**
 * TRIGGER-01 S2 (stage-start sections 3, 4 and 5): one tick of the schedule
 * timer. ScheduleTimer calls tick() only while SCHEDULES_ENABLED is on.
 *
 * Each tick: close claims older than 10 minutes as interrupted; prune history
 * older than 90 days (at most hourly); read at most 200 enabled schedules
 * (rotating through the table when it holds more); find the due ones
 * (schedule-due.ts) that have no row for today's local date; claim each by
 * inserting (schedule_id, local_date) with outcome claimed. A unique
 * violation means another tick or process has it: stop. Only the inserter
 * goes on, and the claim is the day's one attempt: never a retry that day.
 *
 * More than 60 minutes late: skipped / missed. Otherwise, at most 5 a tick:
 *  1. pre-checks, each a skip with nothing else created: runs switched off
 *     (runs_off), owner missing or inactive (inactive), no harness access read
 *     live (not_entitled), workflow gone or not the owner's (workflow_gone; the
 *     schedule is also switched off, Keith's Q10), the owner's daily cap
 *     already reached (over_cap; DailyCreditCapService, read-only);
 *  2. the page's body, { team: 'chief-of-staff', task } or { workflowId, task },
 *     read by the page's own parser; never a sessionId, never testRun, so the
 *     run is read-profile only by the existing rule (Q2);
 *  3. CollaborationStartService.start with the identity the session guard
 *     builds for the owner (as chat-run.service.ts does);
 *  4. approveStep for the first hand-off with the owner as decidedBy (Q1).
 *     Every check in approveReferral still runs; later steps follow the
 *     existing approval rules (nothing in the approval code changes).
 * A refusal at start or approve is mapped to a reason code; a run that was
 * created is cancelled with schedule_skipped:<reason>. Otherwise the row
 * becomes started with the run id.
 *
 * Every skipped occurrence has one row and one run_skipped audit row; a start
 * one run_started audit row. Audit payloads and log lines hold ids, the local
 * date, the target kind and a reason code only: never the task text.
 */
@Injectable()
export class ScheduleRunService {
  private readonly logger = new Logger('ScheduleRuns');
  /** The last schedule id read when the table holds more than one tick's read. */
  private cursor: string | null = null;
  private lastPruneAt: number | null = null;

  constructor(
    @InjectRepository(AgentSchedule)
    private readonly schedules: Repository<AgentSchedule>,
    @InjectRepository(AgentScheduleRun)
    private readonly runs: Repository<AgentScheduleRun>,
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

  async tick(now: Date = new Date()): Promise<ScheduleTickSummary> {
    const summary: ScheduleTickSummary = { evaluated: 0, started: 0, skipped: 0, interrupted: 0, pruned: 0 };
    summary.interrupted = await this.closeStaleClaims(now);
    summary.pruned = await this.pruneHistory(now);

    const rows = await this.readEnabled();
    summary.evaluated = rows.length;
    const due = await this.dueNow(rows, now);

    let attempts = 0;
    for (const { schedule, localDate, late } of due) {
      if (!late && attempts >= SCHEDULE_RUN_LIMITS.startsPerTick) {
        continue;
      }
      const claimed = await this.claim(schedule, localDate, now);
      if (!claimed) {
        continue;
      }
      if (late) {
        try {
          await this.skip(claimed, 'missed', null);
          summary.skipped += 1;
        } catch (error) {
          // The claimed row stays and is closed as interrupted after 10 minutes.
          this.logger.warn(`schedule skip failed scheduleId=${schedule.id} reason=${errorName(error)}`);
        }
        continue;
      }
      attempts += 1;
      const outcome = await this.startClaimed(claimed);
      if (outcome === 'started') summary.started += 1;
      else if (outcome === 'skipped') summary.skipped += 1;
    }
    return summary;
  }

  /** At most 200 enabled schedules, by id, continuing after the last tick's read. */
  private async readEnabled(): Promise<AgentSchedule[]> {
    const limit = SCHEDULE_RUN_LIMITS.schedulesPerTick;
    const cursor = this.cursor;
    const first = await this.schedules.find({
      where: cursor ? { enabled: true, id: MoreThan(cursor) } : { enabled: true },
      order: { id: 'ASC' },
      take: limit,
    });
    let rows = first;
    if (cursor && first.length < limit) {
      const wrapped = await this.schedules.find({
        where: { enabled: true, id: LessThanOrEqual(cursor) },
        order: { id: 'ASC' },
        take: limit - first.length,
      });
      rows = first.concat(wrapped);
    }
    this.cursor = rows.length >= limit ? rows[rows.length - 1].id : null;
    return rows;
  }

  /** The due schedules that have no row for today's local date. */
  private async dueNow(
    rows: AgentSchedule[],
    now: Date,
  ): Promise<Array<{ schedule: AgentSchedule; localDate: string; late: boolean }>> {
    const candidates: Array<{ schedule: AgentSchedule; localDate: string; late: boolean }> = [];
    for (const schedule of rows) {
      const result = scheduleDue(schedule, now);
      if (result.due) {
        candidates.push({ schedule, localDate: result.localDate, late: result.late });
      }
    }
    if (candidates.length === 0) {
      return [];
    }
    const recorded = await this.runs.find({
      where: candidates.map((candidate) => ({
        scheduleId: candidate.schedule.id,
        localDate: candidate.localDate,
      })),
      select: ['scheduleId', 'localDate'],
    });
    const taken = new Set(recorded.map((row) => `${row.scheduleId}|${localDateText(row.localDate)}`));
    return candidates.filter((candidate) => !taken.has(`${candidate.schedule.id}|${candidate.localDate}`));
  }

  /** Inserts the day's row with outcome claimed; null when another tick or process has it. */
  private async claim(schedule: AgentSchedule, localDate: string, now: Date): Promise<ClaimedOccurrence | null> {
    const rowId = randomUUID();
    try {
      await this.runs.insert({
        id: rowId,
        scheduleId: schedule.id,
        userId: schedule.userId,
        localDate,
        outcome: 'claimed',
        reason: null,
        collaborationRunId: null,
        createdAt: now,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        this.logger.warn(
          `schedule claim failed scheduleId=${schedule.id} localDate=${localDate} reason=${errorName(error)}`,
        );
      }
      return null;
    }
    return { rowId, schedule, localDate };
  }

  /** Pre-checks, start and approve for one claimed occurrence. */
  private async startClaimed(claimed: ClaimedOccurrence): Promise<'started' | 'skipped' | 'error'> {
    try {
      const pre = await this.preCheck(claimed.schedule);
      if (pre) {
        if (pre === 'workflow_gone') {
          await this.switchOff(claimed, pre);
        }
        await this.skip(claimed, pre, null);
        return 'skipped';
      }

      let input: CollaborationStartInput;
      try {
        input = this.starts.readStartBody(this.startBody(claimed.schedule));
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
        started = await this.starts.start(this.identityFor(claimed.schedule.userId), input);
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
          decidedBy: claimed.schedule.userId,
          approveWithoutPassingTests: false,
        });
      } catch (error) {
        const reason = scheduleRefusalOf(error);
        await this.cancelRefused(claimed, started.collaborationRunId, reason);
        await this.skip(claimed, reason, started.collaborationRunId);
        return 'skipped';
      }

      await this.finish(claimed, 'started', null, started.collaborationRunId);
      await this.writeAudit(TRIGGER_RUN_AUDIT_EVENTS.runStarted, claimed, null, started.collaborationRunId);
      this.logger.log(
        `schedule run started scheduleId=${claimed.schedule.id} userId=${claimed.schedule.userId} localDate=${claimed.localDate} targetKind=${claimed.schedule.targetKind}${workflowLogPart(claimed.schedule)} runId=${started.collaborationRunId}`,
      );
      return 'started';
    } catch (error) {
      // The claimed row stays and is closed as interrupted after 10 minutes. Never retried today.
      this.logger.error(
        JSON.stringify({
          event: 'schedule.start_failed',
          scheduleId: claimed.schedule.id,
          localDate: claimed.localDate,
          errorName: errorName(error),
        }),
      );
      return 'error';
    }
  }

  /** Stage-start section 4 step 2: each a skip with nothing else created. */
  private async preCheck(schedule: AgentSchedule): Promise<ScheduleSkipReason | null> {
    if (!KillSwitchConfig.GLOBAL_EXECUTION_ENABLED) {
      return 'runs_off';
    }
    const owner = await this.users.findOne({ where: { id: schedule.userId }, select: ['id', 'isActive'] });
    if (!owner || owner.isActive !== true) {
      return 'inactive';
    }
    if (!(await this.entitlements.resolveHarnessEntitled(schedule.userId))) {
      return 'not_entitled';
    }
    if (schedule.targetKind === 'workflow') {
      if (!schedule.workflowId) {
        return 'workflow_gone';
      }
      const workflow = await this.workflows.findOne({
        where: { id: schedule.workflowId, userId: schedule.userId, deletedAt: IsNull() },
        select: ['id'],
      });
      if (!workflow) {
        return 'workflow_gone';
      }
    } else if (schedule.targetKind !== 'chief-of-staff') {
      return 'refused';
    }
    try {
      await this.caps.assertWithinDailyCap(schedule.userId);
    } catch (error) {
      return scheduleRefusalOf(error);
    }
    return null;
  }

  /** The Team page's body (no sessionId, no testRun). */
  private startBody(schedule: AgentSchedule): Record<string, string> {
    return schedule.targetKind === 'workflow' && schedule.workflowId
      ? { workflowId: schedule.workflowId, task: schedule.task }
      : { team: 'chief-of-staff', task: schedule.task };
  }

  /** The identity the session guard builds for the owner (as chat-run.service.ts), harness access read just before. */
  private identityFor(userId: string): ApiKeyIdentity {
    return {
      userId,
      apiKeyId: 'browser-session',
      scopes: ['ai:execute'],
      isInternal: true,
      harnessEntitled: true,
    };
  }

  /** The run id on the claimed row, so an interrupted claim still points at its run. */
  private async noteRun(claimed: ClaimedOccurrence, collaborationRunId: string): Promise<void> {
    try {
      await this.runs.update({ id: claimed.rowId, outcome: 'claimed' }, { collaborationRunId });
    } catch (error) {
      this.logger.warn(`schedule run note failed scheduleId=${claimed.schedule.id} reason=${errorName(error)}`);
    }
  }

  private async skip(
    claimed: ClaimedOccurrence,
    reason: ScheduleSkipReason,
    collaborationRunId: string | null,
  ): Promise<void> {
    await this.finish(claimed, 'skipped', reason, collaborationRunId);
    await this.writeAudit(TRIGGER_RUN_AUDIT_EVENTS.runSkipped, claimed, reason, collaborationRunId);
    this.logger.log(
      `schedule run skipped scheduleId=${claimed.schedule.id} userId=${claimed.schedule.userId} localDate=${claimed.localDate} targetKind=${claimed.schedule.targetKind}${workflowLogPart(claimed.schedule)} reason=${reason}${collaborationRunId ? ` runId=${collaborationRunId}` : ''}`,
    );
  }

  /** Moves the claimed row to its outcome (only while it is still claimed). */
  private async finish(
    claimed: ClaimedOccurrence,
    outcome: 'started' | 'skipped',
    reason: ScheduleSkipReason | null,
    collaborationRunId: string | null,
  ): Promise<void> {
    await this.runs.update(
      { id: claimed.rowId, outcome: 'claimed' },
      { outcome, reason, ...(collaborationRunId ? { collaborationRunId } : {}) },
    );
  }

  /** A run that was created and then refused is cancelled (the page's cancel with a reason code). */
  private async cancelRefused(
    claimed: ClaimedOccurrence,
    collaborationRunId: string,
    reason: ScheduleSkipReason,
  ): Promise<void> {
    try {
      await this.orchestration.cancelCollaboration({
        collaborationRunId,
        cancelledByUserId: claimed.schedule.userId,
        cancelReason: scheduleCancelReason(reason),
      });
    } catch (error) {
      this.logger.warn(
        `schedule run cancel failed scheduleId=${claimed.schedule.id} runId=${collaborationRunId} reason=${errorName(error)}`,
      );
    }
  }

  /** Keith's Q10: a schedule whose workflow is gone is switched off, so it does not skip every day. */
  private async switchOff(claimed: ClaimedOccurrence, reason: ScheduleSkipReason): Promise<void> {
    const result = await this.schedules.update(
      { id: claimed.schedule.id, userId: claimed.schedule.userId, enabled: true },
      { enabled: false, updatedAt: new Date() },
    );
    if ((result.affected ?? 0) > 0) {
      await this.writeAudit(TRIGGER_RUN_AUDIT_EVENTS.scheduleDisabled, claimed, reason, null);
      this.logger.log(
        `schedule disabled scheduleId=${claimed.schedule.id} userId=${claimed.schedule.userId} reason=${reason}`,
      );
    }
  }

  /** Claims older than 10 minutes: skipped / interrupted, one audit row each. A run they made is left as it is. */
  private async closeStaleClaims(now: Date): Promise<number> {
    const before = new Date(now.getTime() - SCHEDULE_RUN_LIMITS.claimTimeoutMs);
    const stale = await this.runs.find({
      where: { outcome: 'claimed', createdAt: LessThan(before) },
      order: { createdAt: 'ASC' },
      take: SCHEDULE_RUN_LIMITS.schedulesPerTick,
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
      const schedule = await this.schedules.findOne({ where: { id: row.scheduleId } });
      const claimed: ClaimedOccurrence = {
        rowId: row.id,
        localDate: localDateText(row.localDate),
        schedule:
          schedule ??
          ({ id: row.scheduleId, userId: row.userId, targetKind: 'chief-of-staff', workflowId: null } as AgentSchedule),
      };
      await this.writeAudit(TRIGGER_RUN_AUDIT_EVENTS.runSkipped, claimed, 'interrupted', row.collaborationRunId ?? null);
      this.logger.log(
        `schedule run skipped scheduleId=${row.scheduleId} userId=${row.userId} localDate=${claimed.localDate} reason=interrupted${row.collaborationRunId ? ` runId=${row.collaborationRunId}` : ''}`,
      );
    }
    return closed;
  }

  /** History rows older than 90 days, at most once an hour. */
  private async pruneHistory(now: Date): Promise<number> {
    if (this.lastPruneAt !== null && now.getTime() - this.lastPruneAt < SCHEDULE_RUN_LIMITS.pruneEveryMs) {
      return 0;
    }
    this.lastPruneAt = now.getTime();
    const before = new Date(now.getTime() - SCHEDULE_RUN_LIMITS.historyRetentionMs);
    const result = await this.runs.delete({ createdAt: LessThan(before), outcome: In(['started', 'skipped']) });
    const pruned = result.affected ?? 0;
    if (pruned > 0) {
      this.logger.log(`schedule history pruned rows=${pruned}`);
    }
    return pruned;
  }

  /** Ids, the local date, the target kind and a reason code only: never the task text. */
  private async writeAudit(
    eventType: string,
    claimed: ClaimedOccurrence,
    reason: ScheduleSkipReason | null,
    collaborationRunId: string | null,
  ): Promise<void> {
    const payload: Record<string, string | null> = {
      scheduleId: claimed.schedule.id,
      localDate: claimed.localDate,
      targetKind: claimed.schedule.targetKind,
      workflowId: claimed.schedule.workflowId ?? null,
    };
    if (collaborationRunId) payload.collaborationRunId = collaborationRunId;
    if (reason) payload.reason = reason;
    try {
      await this.audit.insert({
        category: TRIGGER_AUDIT_CATEGORY,
        eventType,
        subjectType: TRIGGER_AUDIT_SUBJECT_TYPE,
        subjectId: claimed.schedule.id,
        userId: claimed.schedule.userId,
        payload,
        occurredAt: new Date(),
      });
    } catch (error) {
      this.logger.warn(`schedule audit insert failed event=${eventType} reason=${errorName(error)}`);
    }
  }
}

function workflowLogPart(schedule: Pick<AgentSchedule, 'workflowId'>): string {
  return schedule.workflowId ? ` workflowId=${schedule.workflowId}` : '';
}
