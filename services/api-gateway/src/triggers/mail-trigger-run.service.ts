import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, IsNull, LessThan, LessThanOrEqual, MoreThan, Not, Repository } from 'typeorm';
import type { ApiKeyIdentity } from '../auth/api-key.config';
import { EntitlementService } from '../auth/entitlement.service';
import { AgentMailTrigger } from '../entities/agent-mail-trigger.entity';
import { AgentMailTriggerRun } from '../entities/agent-mail-trigger-run.entity';
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
import { MailTriggerMailbox, type MailTriggerOwnerRead } from './mail-trigger-mailbox';
import { mailTriggerMatch, mailTriggerTask } from './mail-trigger-match';
import {
  MAIL_TRIGGER_DAY_LIMIT,
  MAIL_TRIGGER_DAY_ROW_CAP,
  MAIL_TRIGGER_RUN_AUDIT_EVENTS,
  mailTriggerCancelReason,
  type MailTriggerSkipReason,
} from './mail-trigger-reasons';
import { MAIL_TRIGGER_AUDIT_CATEGORY, MAIL_TRIGGER_AUDIT_SUBJECT_TYPE } from './mail-trigger.service';
import { scheduleRefusalOf } from './schedule-refusal';

/** TRIGGER-MAIL-01 S3 (stage-start sections 2 to 6): code constants, no env knobs. */
export const MAIL_TRIGGER_RUN_LIMITS = {
  /** Enabled triggers read per tick. */
  triggersPerTick: 300,
  /** Messages that go to the start path per tick; the rest are found again by the owner's next read. */
  startsPerTick: 5,
  /** A claimed row older than this is closed as skipped / interrupted. */
  claimTimeoutMs: 10 * 60 * 1000,
  /** History rows older than this are pruned. */
  historyRetentionMs: 90 * 24 * 60 * 60 * 1000,
  /** The prune runs at most once in this time. */
  pruneEveryMs: 60 * 60 * 1000,
} as const;

/** What one tick did (counts only; for tests and the log line). */
export interface MailTriggerTickSummary {
  evaluated: number;
  started: number;
  skipped: number;
  capped: number;
  interrupted: number;
  pruned: number;
}

interface MatchedMessage {
  trigger: AgentMailTrigger;
  uid: number;
  arrivedAt: Date;
  localDate: string;
  messageKey: string;
}

interface ClaimedMessage {
  rowId: string;
  trigger: AgentMailTrigger;
  /** Printed in the task only (stage-start D1); never logged, audited or stored on the row. */
  uid: number;
  arrivedAt: Date;
  localDate: string;
}

/** The start budget shared by all owners' reads of one tick. */
interface TickBudget {
  attempts: number;
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
 * TRIGGER-MAIL-01 S3 (stage-start sections 3 to 6): one tick of the mail
 * timer. MailTriggerTimer calls tick() only while MAIL_TRIGGERS_ENABLED is on.
 *
 * While runs are switched off (GLOBAL_EXECUTION_ENABLED not true) the tick
 * returns at once: no mailbox sign-in and nothing recorded (Keith's Q14).
 *
 * Each tick otherwise: close claims older than 10 minutes as interrupted;
 * prune history older than 90 days (at most hourly); read the enabled
 * triggers; let MailTriggerMailbox read at most 3 owners' mailboxes (each
 * every 10 minutes, hourly after three failures). Each owner's read is acted
 * on at once, in this tick (stage-start P2): no memory copy, no confirm read.
 * For every enabled trigger of that owner and every message, the match rule
 * (mail-trigger-match.ts: sender, subject word, after armed_at, not more than
 * 60 minutes old); a message that already has a row for the trigger is done.
 * Then, oldest arrival first and at most 5 a tick across all owners, in this
 * order (stage-start section 4):
 *  1. the row cap: 20 history rows for the trigger on the arrival's local
 *     day; past it nothing is written (one count-only log line a tick);
 *  2. the claim: insert (trigger_id, message_key) with outcome claimed. A
 *     unique violation means another tick or process has it: stop. Only the
 *     inserter goes on, and the claim is the message's one attempt: never a
 *     retry;
 *  3. the day limit: 5 runs started on the arrival's local day (day_limit);
 *  4. the schedule pre-checks: runs_off, inactive, not_entitled, workflow_gone
 *     (the trigger is also switched off), over_cap (DailyCreditCapService,
 *     read-only);
 *  5. the Team page's body, { team: 'chief-of-staff', task } or
 *     { workflowId, task }, read by the page's own parser; never a sessionId,
 *     never testRun, so the run is read-profile only. The task is the saved
 *     task plus the arrival time and the message's number (Keith's Q1);
 *  6. CollaborationStartService.start with the identity the session guard
 *     builds for the owner;
 *  7. approveStep for the first hand-off with the owner as decidedBy (Q2).
 * A refusal at start or approve is mapped by scheduleRefusalOf; a run that
 * was created is cancelled with mail_trigger_skipped:<reason>.
 *
 * Every skipped message has one row and one mail_run_skipped audit row; a
 * start one mail_run_started audit row. Audit payloads and log lines hold
 * ids, the local date, the target kind and a reason code only: never a
 * sender, subject, arrival time, UID, UIDVALIDITY, hash, task or filter.
 */
@Injectable()
export class MailTriggerRunService {
  private readonly logger = new Logger('MailTriggerRuns');
  /** The last trigger id read when the table holds more than one tick's read. */
  private cursor: string | null = null;
  private lastPruneAt: number | null = null;

  constructor(
    @InjectRepository(AgentMailTrigger)
    private readonly triggers: Repository<AgentMailTrigger>,
    @InjectRepository(AgentMailTriggerRun)
    private readonly runs: Repository<AgentMailTriggerRun>,
    @InjectRepository(UserAgent)
    private readonly workflows: Repository<UserAgent>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(AuditEventEntity)
    private readonly audit: Repository<AuditEventEntity>,
    private readonly mailbox: MailTriggerMailbox,
    private readonly starts: CollaborationStartService,
    private readonly orchestration: OrchestrationService,
    private readonly entitlements: EntitlementService,
    private readonly caps: DailyCreditCapService,
  ) {}

  async tick(now: Date = new Date()): Promise<MailTriggerTickSummary> {
    const summary: MailTriggerTickSummary = {
      evaluated: 0,
      started: 0,
      skipped: 0,
      capped: 0,
      interrupted: 0,
      pruned: 0,
    };
    if (!KillSwitchConfig.GLOBAL_EXECUTION_ENABLED) {
      return summary;
    }
    summary.interrupted = await this.closeStaleClaims(now);
    summary.pruned = await this.pruneHistory(now);

    const rows = await this.readEnabled();
    summary.evaluated = rows.length;
    const byOwner = new Map<string, AgentMailTrigger[]>();
    for (const row of rows) {
      const list = byOwner.get(row.userId) ?? [];
      list.push(row);
      byOwner.set(row.userId, list);
    }
    const budget: TickBudget = { attempts: 0 };
    // With no enabled trigger this only forgets the owners' pace.
    await this.mailbox.refresh(rows, now, (read) =>
      this.actOn(byOwner.get(read.userId) ?? [], read, now, budget, summary),
    );
    return summary;
  }

  /** At most 300 enabled triggers, by id, continuing after the last tick's read. */
  private async readEnabled(): Promise<AgentMailTrigger[]> {
    const limit = MAIL_TRIGGER_RUN_LIMITS.triggersPerTick;
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

  /** One owner's read, in the tick that made it: match, row cap, claim and start. Nothing of it is kept. */
  private async actOn(
    triggers: AgentMailTrigger[],
    read: MailTriggerOwnerRead,
    now: Date,
    budget: TickBudget,
    summary: MailTriggerTickSummary,
  ): Promise<void> {
    const matched = await this.newMatches(triggers, read, now);
    const dayRows = new Map<string, number>();
    const capped = new Map<string, { trigger: AgentMailTrigger; localDate: string; count: number }>();
    for (const message of matched) {
      if (budget.attempts >= MAIL_TRIGGER_RUN_LIMITS.startsPerTick) {
        break;
      }
      const dayKey = `${message.trigger.id}|${message.localDate}`;
      let rowsToday = dayRows.get(dayKey);
      if (rowsToday === undefined) {
        rowsToday = await this.runs.count({
          where: { triggerId: message.trigger.id, localDate: message.localDate },
        });
      }
      if (rowsToday >= MAIL_TRIGGER_DAY_ROW_CAP) {
        dayRows.set(dayKey, rowsToday);
        const entry = capped.get(dayKey) ?? { trigger: message.trigger, localDate: message.localDate, count: 0 };
        entry.count += 1;
        capped.set(dayKey, entry);
        summary.capped += 1;
        continue;
      }
      const claimed = await this.claim(message, now);
      if (!claimed) {
        dayRows.delete(dayKey);
        continue;
      }
      dayRows.set(dayKey, rowsToday + 1);
      budget.attempts += 1;
      const outcome = await this.startClaimed(claimed);
      if (outcome === 'started') summary.started += 1;
      else if (outcome === 'skipped') summary.skipped += 1;
    }
    for (const entry of capped.values()) {
      // Counts only: no message is recorded past the cap.
      this.logger.log(
        `mail trigger row cap reached triggerId=${entry.trigger.id} userId=${entry.trigger.userId} localDate=${entry.localDate} matches=${entry.count}`,
      );
    }
  }

  /** The matches of this read that have no row yet, oldest arrival first. */
  private async newMatches(
    triggers: AgentMailTrigger[],
    read: MailTriggerOwnerRead,
    now: Date,
  ): Promise<MatchedMessage[]> {
    const candidates: MatchedMessage[] = [];
    for (const trigger of triggers) {
      if (trigger.enabled !== true || trigger.userId !== read.userId) continue;
      const seen = new Set<string>();
      for (const message of read.messages) {
        const result = mailTriggerMatch(trigger, message, read.uidValidity, now);
        if (!result.match || seen.has(result.messageKey)) {
          continue;
        }
        seen.add(result.messageKey);
        candidates.push({
          trigger,
          uid: result.uid,
          arrivedAt: result.arrivedAt,
          localDate: result.localDate,
          messageKey: result.messageKey,
        });
      }
    }
    if (candidates.length === 0) {
      return [];
    }
    const recorded = await this.runs.find({
      where: candidates.map((candidate) => ({
        triggerId: candidate.trigger.id,
        messageKey: candidate.messageKey,
      })),
      select: ['triggerId', 'messageKey'],
    });
    const taken = new Set(recorded.map((row) => `${row.triggerId}|${row.messageKey}`));
    return candidates
      .filter((candidate) => !taken.has(`${candidate.trigger.id}|${candidate.messageKey}`))
      .sort((a, b) => a.arrivedAt.getTime() - b.arrivedAt.getTime());
  }

  /** Inserts the message's row with outcome claimed; null when another tick or process has it. */
  private async claim(message: MatchedMessage, now: Date): Promise<ClaimedMessage | null> {
    const rowId = randomUUID();
    try {
      await this.runs.insert({
        id: rowId,
        triggerId: message.trigger.id,
        userId: message.trigger.userId,
        messageKey: message.messageKey,
        arrivedAt: message.arrivedAt,
        localDate: message.localDate,
        outcome: 'claimed',
        reason: null,
        collaborationRunId: null,
        createdAt: now,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        this.logger.warn(
          `mail trigger claim failed triggerId=${message.trigger.id} localDate=${message.localDate} reason=${errorName(error)}`,
        );
      }
      return null;
    }
    return {
      rowId,
      trigger: message.trigger,
      uid: message.uid,
      arrivedAt: message.arrivedAt,
      localDate: message.localDate,
    };
  }

  /** The day limit, the pre-checks, start and approve for one claimed message. */
  private async startClaimed(claimed: ClaimedMessage): Promise<'started' | 'skipped' | 'error'> {
    try {
      if ((await this.startedOnDay(claimed)) >= MAIL_TRIGGER_DAY_LIMIT) {
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

      const task = mailTriggerTask(claimed.trigger.task, {
        arrivedAt: claimed.arrivedAt,
        timeZone: claimed.trigger.timeZone,
        uid: claimed.uid,
      });
      let input: CollaborationStartInput;
      try {
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
      await this.writeAudit(MAIL_TRIGGER_RUN_AUDIT_EVENTS.runStarted, claimed, null, started.collaborationRunId);
      this.logger.log(
        `mail trigger run started triggerId=${claimed.trigger.id} userId=${claimed.trigger.userId} localDate=${claimed.localDate} targetKind=${claimed.trigger.targetKind}${workflowLogPart(claimed.trigger)} runId=${started.collaborationRunId}`,
      );
      return 'started';
    } catch (error) {
      // The claimed row stays and is closed as interrupted after 10 minutes. Never retried.
      this.logger.error(
        JSON.stringify({
          event: 'mail_trigger.start_failed',
          triggerId: claimed.trigger.id,
          localDate: claimed.localDate,
          errorName: errorName(error),
        }),
      );
      return 'error';
    }
  }

  /**
   * Keith's Q7: runs started (or in flight in another process) for this
   * trigger on the arrival's local day, not counting this claim.
   */
  private async startedOnDay(claimed: ClaimedMessage): Promise<number> {
    return this.runs.count({
      where: {
        triggerId: claimed.trigger.id,
        localDate: claimed.localDate,
        outcome: In(['started', 'claimed']),
        id: Not(claimed.rowId),
      },
    });
  }

  /** The schedule pre-checks (stage-start section 6): each a skip with nothing else created. */
  private async preCheck(trigger: AgentMailTrigger): Promise<MailTriggerSkipReason | null> {
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
    if (trigger.targetKind === 'workflow') {
      if (!trigger.workflowId) {
        return 'workflow_gone';
      }
      const workflow = await this.workflows.findOne({
        where: { id: trigger.workflowId, userId: trigger.userId, deletedAt: IsNull() },
        select: ['id'],
      });
      if (!workflow) {
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

  /** The Team page's body (no sessionId, no testRun). */
  private startBody(trigger: AgentMailTrigger, task: string): Record<string, string> {
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

  /** The run id on the claimed row, so an interrupted claim still points at its run. */
  private async noteRun(claimed: ClaimedMessage, collaborationRunId: string): Promise<void> {
    try {
      await this.runs.update({ id: claimed.rowId, outcome: 'claimed' }, { collaborationRunId });
    } catch (error) {
      this.logger.warn(`mail trigger run note failed triggerId=${claimed.trigger.id} reason=${errorName(error)}`);
    }
  }

  private async skip(
    claimed: ClaimedMessage,
    reason: MailTriggerSkipReason,
    collaborationRunId: string | null,
  ): Promise<void> {
    await this.finish(claimed, 'skipped', reason, collaborationRunId);
    await this.writeAudit(MAIL_TRIGGER_RUN_AUDIT_EVENTS.runSkipped, claimed, reason, collaborationRunId);
    this.logger.log(
      `mail trigger run skipped triggerId=${claimed.trigger.id} userId=${claimed.trigger.userId} localDate=${claimed.localDate} targetKind=${claimed.trigger.targetKind}${workflowLogPart(claimed.trigger)} reason=${reason}${collaborationRunId ? ` runId=${collaborationRunId}` : ''}`,
    );
  }

  /** Moves the claimed row to its outcome (only while it is still claimed). */
  private async finish(
    claimed: ClaimedMessage,
    outcome: 'started' | 'skipped',
    reason: MailTriggerSkipReason | null,
    collaborationRunId: string | null,
  ): Promise<void> {
    await this.runs.update(
      { id: claimed.rowId, outcome: 'claimed' },
      { outcome, reason, ...(collaborationRunId ? { collaborationRunId } : {}) },
    );
  }

  /** A run that was created and then refused is cancelled (the page's cancel with a reason code). */
  private async cancelRefused(
    claimed: ClaimedMessage,
    collaborationRunId: string,
    reason: MailTriggerSkipReason,
  ): Promise<void> {
    try {
      await this.orchestration.cancelCollaboration({
        collaborationRunId,
        cancelledByUserId: claimed.trigger.userId,
        cancelReason: mailTriggerCancelReason(reason),
      });
    } catch (error) {
      this.logger.warn(
        `mail trigger run cancel failed triggerId=${claimed.trigger.id} runId=${collaborationRunId} reason=${errorName(error)}`,
      );
    }
  }

  /** As a schedule (Keith's Q10 of TRIGGER-01): a trigger whose workflow is gone is switched off. */
  private async switchOff(claimed: ClaimedMessage, reason: MailTriggerSkipReason): Promise<void> {
    const result = await this.triggers.update(
      { id: claimed.trigger.id, userId: claimed.trigger.userId, enabled: true },
      { enabled: false, updatedAt: new Date() },
    );
    if ((result.affected ?? 0) > 0) {
      await this.writeAudit(MAIL_TRIGGER_RUN_AUDIT_EVENTS.triggerDisabled, claimed, reason, null);
      this.logger.log(
        `mail trigger disabled triggerId=${claimed.trigger.id} userId=${claimed.trigger.userId} reason=${reason}`,
      );
    }
  }

  /** Claims older than 10 minutes: skipped / interrupted, one audit row each. A run they made is left as it is. */
  private async closeStaleClaims(now: Date): Promise<number> {
    const before = new Date(now.getTime() - MAIL_TRIGGER_RUN_LIMITS.claimTimeoutMs);
    const stale = await this.runs.find({
      where: { outcome: 'claimed', createdAt: LessThan(before) },
      order: { createdAt: 'ASC' },
      take: MAIL_TRIGGER_RUN_LIMITS.triggersPerTick,
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
      const claimed: ClaimedMessage = {
        rowId: row.id,
        uid: 0,
        arrivedAt: row.arrivedAt instanceof Date ? row.arrivedAt : new Date(row.arrivedAt),
        localDate: localDateText(row.localDate),
        trigger:
          trigger ??
          ({ id: row.triggerId, userId: row.userId, targetKind: 'chief-of-staff', workflowId: null } as AgentMailTrigger),
      };
      await this.writeAudit(MAIL_TRIGGER_RUN_AUDIT_EVENTS.runSkipped, claimed, 'interrupted', row.collaborationRunId ?? null);
      this.logger.log(
        `mail trigger run skipped triggerId=${row.triggerId} userId=${row.userId} localDate=${claimed.localDate} reason=interrupted${row.collaborationRunId ? ` runId=${row.collaborationRunId}` : ''}`,
      );
    }
    return closed;
  }

  /** History rows older than 90 days, at most once an hour. */
  private async pruneHistory(now: Date): Promise<number> {
    if (this.lastPruneAt !== null && now.getTime() - this.lastPruneAt < MAIL_TRIGGER_RUN_LIMITS.pruneEveryMs) {
      return 0;
    }
    this.lastPruneAt = now.getTime();
    const before = new Date(now.getTime() - MAIL_TRIGGER_RUN_LIMITS.historyRetentionMs);
    const result = await this.runs.delete({ createdAt: LessThan(before), outcome: In(['started', 'skipped']) });
    const pruned = result.affected ?? 0;
    if (pruned > 0) {
      this.logger.log(`mail trigger history pruned rows=${pruned}`);
    }
    return pruned;
  }

  /** Ids, the local date, the target kind and a reason code only: never a sender, subject, arrival, number, hash, task or filter. */
  private async writeAudit(
    eventType: string,
    claimed: ClaimedMessage,
    reason: MailTriggerSkipReason | null,
    collaborationRunId: string | null,
  ): Promise<void> {
    const payload: Record<string, string | null> = {
      triggerId: claimed.trigger.id,
      localDate: claimed.localDate,
      targetKind: claimed.trigger.targetKind,
      workflowId: claimed.trigger.workflowId ?? null,
    };
    if (collaborationRunId) payload.collaborationRunId = collaborationRunId;
    if (reason) payload.reason = reason;
    try {
      await this.audit.insert({
        category: MAIL_TRIGGER_AUDIT_CATEGORY,
        eventType,
        subjectType: MAIL_TRIGGER_AUDIT_SUBJECT_TYPE,
        subjectId: claimed.trigger.id,
        userId: claimed.trigger.userId,
        payload,
        occurredAt: new Date(),
      });
    } catch (error) {
      this.logger.warn(`mail trigger audit insert failed event=${eventType} reason=${errorName(error)}`);
    }
  }
}

function workflowLogPart(trigger: Pick<AgentMailTrigger, 'workflowId'>): string {
  return trigger.workflowId ? ` workflowId=${trigger.workflowId}` : '';
}
