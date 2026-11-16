import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, IsNull, LessThan, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import type { ApiKeyIdentity } from '../auth/api-key.config';
import { EntitlementService } from '../auth/entitlement.service';
import { AgentKnowledgeTrigger } from '../entities/agent-knowledge-trigger.entity';
import { AgentKnowledgeTriggerRun } from '../entities/agent-knowledge-trigger-run.entity';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { KnowledgeDocument } from '../entities/knowledge-document.entity';
import { User } from '../entities/user.entity';
import { UserAgent } from '../entities/user-agent.entity';
import {
  CollaborationStartService,
  type CollaborationStartInput,
} from '../orchestration/collaboration-start.service';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { DailyCreditCapService } from '../safety/daily-credit-cap.service';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import {
  knowledgeDocumentMatch,
  knowledgeTriggerBatch,
  knowledgeTriggerTask,
  oldestFirst,
  type KnowledgeTriggerCandidate,
  type KnowledgeTriggerDocument,
} from './knowledge-trigger-match';
import {
  KNOWLEDGE_TRIGGER_DAY_LIMIT,
  KNOWLEDGE_TRIGGER_DAY_ROW_CAP,
  KNOWLEDGE_TRIGGER_RUN_AUDIT_EVENTS,
  knowledgeTriggerCancelReason,
  type KnowledgeTriggerSkipReason,
} from './knowledge-trigger-reasons';
import { isKnowledgeTriggersEnabled } from './knowledge-trigger-switch';
import {
  KNOWLEDGE_TRIGGER_AUDIT_CATEGORY,
  KNOWLEDGE_TRIGGER_AUDIT_SUBJECT_TYPE,
} from './knowledge-trigger.service';
import { scheduleRefusalOf } from './schedule-refusal';

/** TRIGGER-MORE-01 S2 (stage-start section 4): code constants, no env knobs. */
export const KNOWLEDGE_TRIGGER_RUN_LIMITS = {
  /** Enabled triggers read per tick. */
  triggersPerTick: 300,
  /** Batches that go to the start path per tick (as mail's 5); the rest are found again next tick. */
  batchesPerTick: 5,
  /** A claimed row older than this is closed as skipped / interrupted. */
  claimTimeoutMs: 10 * 60 * 1000,
  /** History rows older than this are pruned. */
  historyRetentionMs: 90 * 24 * 60 * 60 * 1000,
  /** The prune runs at most once in this time. */
  pruneEveryMs: 60 * 60 * 1000,
} as const;

/**
 * The only knowledge_documents columns this file ever loads (stage-start
 * section 4, The read): never title, content or byte_size.
 */
export const KNOWLEDGE_TRIGGER_DOCUMENT_SELECT = ['id', 'userId', 'scopeId', 'contentHash', 'updatedAt'] as const;

/** What one tick did (counts only; for tests and the log line). */
export interface KnowledgeTriggerTickSummary {
  evaluated: number;
  started: number;
  skipped: number;
  /** Triggers waiting for 2 quiet minutes. */
  waiting: number;
  /** Document versions not written past the row cap. */
  capped: number;
  interrupted: number;
  pruned: number;
}

interface PlannedBatch {
  trigger: AgentKnowledgeTrigger;
  documents: KnowledgeTriggerCandidate[];
  localDate: string;
  oldestChangeAt: Date;
}

interface ClaimedBatch {
  rowIds: string[];
  trigger: AgentKnowledgeTrigger;
  /** Printed in the task only; never logged or audited (the rows hold them). */
  documentIds: string[];
  /** The newest change among the claimed documents (the time printed in the task). */
  changedAt: Date;
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

function timeOf(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * TRIGGER-MORE-01 S2 (stage-start sections 4 and 5): one tick of the
 * knowledge timer. KnowledgeTriggerTimer calls tick() only while
 * KNOWLEDGE_TRIGGERS_ENABLED is on; tick() reads the flag again itself, so a
 * direct call while it is off reads nothing either.
 *
 * While runs are switched off (GLOBAL_EXECUTION_ENABLED not true) or the flag
 * is off, the tick returns at once: no document read and nothing recorded
 * (Keith's Q13 and Q14).
 *
 * Each tick otherwise, in the order of stage-start section 4: close claims
 * older than 10 minutes as interrupted; prune history older than 90 days (at
 * most hourly); read the enabled triggers; read knowledge_documents once for
 * their owners and folders, selecting id, user id, folder, content hash and
 * change time only (never a title or content), compared in code. Then per
 * trigger, at most 5 batches a tick, the oldest waiting change first:
 *  1. the match (knowledge-trigger-match.ts: the folder, not deleted, after
 *     armed_at, not more than 60 minutes old) and the versions that already
 *     have a row are dropped;
 *  2. the batch (Keith's Q7): 2 quiet minutes, never past 10 minutes after
 *     the oldest, at most 10, oldest first;
 *  3. the row cap: 50 history rows for the trigger on the batch's local day;
 *     past it nothing is written (one count-only log line);
 *  4. the claims: one insert (trigger_id, document_key) with outcome claimed
 *     per document. A unique violation drops that document (another tick or
 *     process has it); an empty batch stops. The claim is the one attempt:
 *     never a retry;
 *  5. the day limit: 5 distinct runs started on the batch's local day
 *     (day_limit);
 *  6. the schedule pre-checks: runs_off, inactive, not_entitled,
 *     workflow_gone (the trigger is also switched off), over_cap
 *     (DailyCreditCapService, read-only);
 *  7. the Team page's body, { team: 'chief-of-staff', task } or
 *     { workflowId, task }, read by the page's own parser; never a sessionId,
 *     never testRun. The task is the saved task plus the folder id, the local
 *     time and the document ids (Keith's Q9);
 *  8. CollaborationStartService.start with the identity the session guard
 *     builds for the owner;
 *  9. approveStep for the first hand-off with the owner as decidedBy (Q10).
 * A refusal at start or approve is mapped by scheduleRefusalOf; a run that
 * was created is cancelled with knowledge_trigger_skipped:<reason>.
 *
 * A skip applies to the whole batch: every row of it gets the reason, and
 * the batch has one knowledge_run_skipped audit row; a start one
 * knowledge_run_started audit row. Audit payloads and log lines hold ids,
 * the local date, the target kind, the folder id, a document count and a
 * reason code only: never a title, content, a content hash, a document key,
 * the task or a document id.
 */
@Injectable()
export class KnowledgeTriggerRunService {
  private readonly logger = new Logger('KnowledgeTriggerRuns');
  /** The last trigger id read when the table holds more than one tick's read. */
  private cursor: string | null = null;
  private lastPruneAt: number | null = null;

  constructor(
    @InjectRepository(AgentKnowledgeTrigger)
    private readonly triggers: Repository<AgentKnowledgeTrigger>,
    @InjectRepository(AgentKnowledgeTriggerRun)
    private readonly runs: Repository<AgentKnowledgeTriggerRun>,
    @InjectRepository(KnowledgeDocument)
    private readonly documents: Repository<KnowledgeDocument>,
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

  async tick(now: Date = new Date()): Promise<KnowledgeTriggerTickSummary> {
    const summary: KnowledgeTriggerTickSummary = {
      evaluated: 0,
      started: 0,
      skipped: 0,
      waiting: 0,
      capped: 0,
      interrupted: 0,
      pruned: 0,
    };
    if (!KillSwitchConfig.GLOBAL_EXECUTION_ENABLED || !isKnowledgeTriggersEnabled()) {
      return summary;
    }
    summary.interrupted = await this.closeStaleClaims(now);
    summary.pruned = await this.pruneHistory(now);

    const triggers = (await this.readEnabled()).filter((row) => row.enabled === true);
    summary.evaluated = triggers.length;
    if (triggers.length === 0) {
      return summary;
    }
    const documents = await this.readDocuments(triggers);
    const plans = await this.planBatches(triggers, documents, now, summary);

    let attempts = 0;
    for (const plan of plans) {
      if (attempts >= KNOWLEDGE_TRIGGER_RUN_LIMITS.batchesPerTick) {
        break;
      }
      const claimed = await this.capAndClaim(plan, now, summary);
      if (!claimed) {
        continue;
      }
      attempts += 1;
      const outcome = await this.startClaimed(claimed);
      if (outcome === 'started') summary.started += 1;
      else if (outcome === 'skipped') summary.skipped += 1;
    }
    return summary;
  }

  /** At most 300 enabled triggers, by id, continuing after the last tick's read. */
  private async readEnabled(): Promise<AgentKnowledgeTrigger[]> {
    const limit = KNOWLEDGE_TRIGGER_RUN_LIMITS.triggersPerTick;
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
   * Stage-start section 4 (The read): one query a tick for the owners with a
   * switched-on trigger and their folders, not deleted. The select list is
   * the five columns of KNOWLEDGE_TRIGGER_DOCUMENT_SELECT: title and content
   * are never loaded. The change time is compared in code, not in SQL.
   */
  private async readDocuments(triggers: AgentKnowledgeTrigger[]): Promise<KnowledgeTriggerDocument[]> {
    const pairs = new Map<string, { userId: string; scopeId: string }>();
    for (const trigger of triggers) {
      pairs.set(`${trigger.userId}|${trigger.scopeId}`, { userId: trigger.userId, scopeId: trigger.scopeId });
    }
    const rows = await this.documents.find({
      where: [...pairs.values()].map((pair) => ({ userId: pair.userId, scopeId: pair.scopeId, deletedAt: IsNull() })),
      select: [...KNOWLEDGE_TRIGGER_DOCUMENT_SELECT],
    });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      scopeId: row.scopeId,
      contentHash: row.contentHash,
      updatedAt: row.updatedAt,
    }));
  }

  /** Every trigger's ready batch, the oldest waiting change first. */
  private async planBatches(
    triggers: AgentKnowledgeTrigger[],
    documents: KnowledgeTriggerDocument[],
    now: Date,
    summary: KnowledgeTriggerTickSummary,
  ): Promise<PlannedBatch[]> {
    const matched = new Map<string, KnowledgeTriggerCandidate[]>();
    const lookups: Array<{ triggerId: string; documentKey: string }> = [];
    for (const trigger of triggers) {
      const list: KnowledgeTriggerCandidate[] = [];
      for (const document of documents) {
        const result = knowledgeDocumentMatch(trigger, document, now);
        if (!result.match) continue;
        list.push({ documentId: result.documentId, changedAt: result.changedAt, documentKey: result.documentKey });
        lookups.push({ triggerId: trigger.id, documentKey: result.documentKey });
      }
      matched.set(trigger.id, list);
    }
    if (lookups.length === 0) {
      return [];
    }
    const recorded = await this.runs.find({ where: lookups, select: ['triggerId', 'documentKey'] });
    const taken = new Set(recorded.map((row) => `${row.triggerId}|${row.documentKey}`));

    const plans: PlannedBatch[] = [];
    for (const trigger of triggers) {
      const unrecorded = (matched.get(trigger.id) ?? []).filter(
        (candidate) => !taken.has(`${trigger.id}|${candidate.documentKey}`),
      );
      const batch = knowledgeTriggerBatch(trigger, unrecorded, now);
      if ('documents' in batch) {
        plans.push({
          trigger,
          documents: batch.documents,
          localDate: batch.localDate,
          oldestChangeAt: batch.oldestChangeAt,
        });
      } else if (batch.reason === 'quiet') {
        summary.waiting += 1;
      }
    }
    return plans.sort((a, b) => a.oldestChangeAt.getTime() - b.oldestChangeAt.getTime());
  }

  /** The row cap, then one claim insert per document. null when nothing was claimed. */
  private async capAndClaim(
    plan: PlannedBatch,
    now: Date,
    summary: KnowledgeTriggerTickSummary,
  ): Promise<ClaimedBatch | null> {
    const { trigger, localDate } = plan;
    const rowsToday = await this.runs.count({ where: { triggerId: trigger.id, localDate } });
    const room = Math.max(0, KNOWLEDGE_TRIGGER_DAY_ROW_CAP - rowsToday);
    const offered = plan.documents.slice(0, room);
    const capped = plan.documents.length - offered.length;
    if (capped > 0) {
      summary.capped += capped;
      // Counts only: no document past the cap is recorded.
      this.logger.log(
        `knowledge trigger row cap reached triggerId=${trigger.id} userId=${trigger.userId} localDate=${localDate} documents=${capped}`,
      );
    }
    if (offered.length === 0) {
      return null;
    }

    const rowIds: string[] = [];
    const claimedDocuments: KnowledgeTriggerCandidate[] = [];
    for (const document of offered) {
      const rowId = randomUUID();
      try {
        await this.runs.insert({
          id: rowId,
          triggerId: trigger.id,
          userId: trigger.userId,
          documentId: document.documentId,
          documentKey: document.documentKey,
          changedAt: document.changedAt,
          localDate,
          outcome: 'claimed',
          reason: null,
          collaborationRunId: null,
          createdAt: now,
        });
      } catch (error) {
        if (!isUniqueViolation(error)) {
          this.logger.warn(
            `knowledge trigger claim failed triggerId=${trigger.id} localDate=${localDate} reason=${errorName(error)}`,
          );
        }
        continue;
      }
      rowIds.push(rowId);
      claimedDocuments.push(document);
    }
    if (claimedDocuments.length === 0) {
      return null;
    }
    claimedDocuments.sort(oldestFirst);
    return {
      rowIds,
      trigger,
      documentIds: claimedDocuments.map((document) => document.documentId),
      changedAt: claimedDocuments[claimedDocuments.length - 1].changedAt,
      localDate,
    };
  }

  /** The day limit, the pre-checks, start and approve for one claimed batch. */
  private async startClaimed(claimed: ClaimedBatch): Promise<'started' | 'skipped' | 'error'> {
    try {
      if ((await this.startedOnDay(claimed)) >= KNOWLEDGE_TRIGGER_DAY_LIMIT) {
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
        const task = knowledgeTriggerTask(claimed.trigger.task, {
          scopeId: claimed.trigger.scopeId,
          timeZone: claimed.trigger.timeZone,
          changedAt: claimed.changedAt,
          documentIds: claimed.documentIds,
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
      await this.writeAudit(
        KNOWLEDGE_TRIGGER_RUN_AUDIT_EVENTS.runStarted,
        claimed,
        claimed.rowIds.length,
        null,
        started.collaborationRunId,
      );
      this.logger.log(
        `knowledge trigger run started ${logParts(claimed.trigger, claimed.localDate)} documents=${claimed.rowIds.length} runId=${started.collaborationRunId}`,
      );
      return 'started';
    } catch (error) {
      // The claimed rows stay and are closed as interrupted after 10 minutes. Never retried.
      this.logger.error(
        JSON.stringify({
          event: 'knowledge_trigger.start_failed',
          triggerId: claimed.trigger.id,
          localDate: claimed.localDate,
          errorName: errorName(error),
        }),
      );
      return 'error';
    }
  }

  /**
   * Keith's Q11 (stage-start section 4, the runs table): the distinct runs
   * started (or in flight in another process) for this trigger on the batch's
   * local day, not counting this batch. A started or claimed row with a run
   * id counts its run once; claimed rows without a run id yet count once per
   * claiming tick (a batch's rows share their claim time).
   */
  private async startedOnDay(claimed: ClaimedBatch): Promise<number> {
    const rows = await this.runs.find({
      where: {
        triggerId: claimed.trigger.id,
        localDate: claimed.localDate,
        outcome: In(['started', 'claimed']),
      },
      select: ['id', 'collaborationRunId', 'createdAt'],
    });
    const own = new Set(claimed.rowIds);
    const runs = new Set<string>();
    for (const row of rows) {
      if (own.has(row.id)) continue;
      runs.add(row.collaborationRunId ? `run:${row.collaborationRunId}` : `claim:${timeOf(row.createdAt)}`);
    }
    return runs.size;
  }

  /** The schedule pre-checks (stage-start section 5): each a skip with nothing else created. */
  private async preCheck(trigger: AgentKnowledgeTrigger): Promise<KnowledgeTriggerSkipReason | null> {
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
  private startBody(trigger: AgentKnowledgeTrigger, task: string): Record<string, string> {
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

  /** The run id on the claimed rows, so an interrupted claim still points at its run. */
  private async noteRun(claimed: ClaimedBatch, collaborationRunId: string): Promise<void> {
    try {
      await this.runs.update({ id: In(claimed.rowIds), outcome: 'claimed' }, { collaborationRunId });
    } catch (error) {
      this.logger.warn(`knowledge trigger run note failed triggerId=${claimed.trigger.id} reason=${errorName(error)}`);
    }
  }

  /** A skip of the whole batch: every row gets the reason; one audit row; one log line. */
  private async skip(
    claimed: ClaimedBatch,
    reason: KnowledgeTriggerSkipReason,
    collaborationRunId: string | null,
  ): Promise<void> {
    await this.finish(claimed, 'skipped', reason, collaborationRunId);
    await this.writeAudit(
      KNOWLEDGE_TRIGGER_RUN_AUDIT_EVENTS.runSkipped,
      claimed,
      claimed.rowIds.length,
      reason,
      collaborationRunId,
    );
    this.logger.log(
      `knowledge trigger run skipped ${logParts(claimed.trigger, claimed.localDate)} documents=${claimed.rowIds.length} reason=${reason}${collaborationRunId ? ` runId=${collaborationRunId}` : ''}`,
    );
  }

  /** Moves the batch's claimed rows to their outcome (only while they are still claimed). */
  private async finish(
    claimed: ClaimedBatch,
    outcome: 'started' | 'skipped',
    reason: KnowledgeTriggerSkipReason | null,
    collaborationRunId: string | null,
  ): Promise<void> {
    await this.runs.update(
      { id: In(claimed.rowIds), outcome: 'claimed' },
      { outcome, reason, ...(collaborationRunId ? { collaborationRunId } : {}) },
    );
  }

  /** A run that was created and then refused is cancelled (the page's cancel with a reason code). */
  private async cancelRefused(
    claimed: ClaimedBatch,
    collaborationRunId: string,
    reason: KnowledgeTriggerSkipReason,
  ): Promise<void> {
    try {
      await this.orchestration.cancelCollaboration({
        collaborationRunId,
        cancelledByUserId: claimed.trigger.userId,
        cancelReason: knowledgeTriggerCancelReason(reason),
      });
    } catch (error) {
      this.logger.warn(
        `knowledge trigger run cancel failed triggerId=${claimed.trigger.id} runId=${collaborationRunId} reason=${errorName(error)}`,
      );
    }
  }

  /** As a schedule (Keith's Q10 of TRIGGER-01): a trigger whose workflow is gone is switched off. */
  private async switchOff(claimed: ClaimedBatch, reason: KnowledgeTriggerSkipReason): Promise<void> {
    const result = await this.triggers.update(
      { id: claimed.trigger.id, userId: claimed.trigger.userId, enabled: true },
      { enabled: false, updatedAt: new Date() },
    );
    if ((result.affected ?? 0) > 0) {
      await this.writeAudit(
        KNOWLEDGE_TRIGGER_RUN_AUDIT_EVENTS.triggerDisabled,
        claimed,
        claimed.rowIds.length,
        reason,
        null,
      );
      this.logger.log(
        `knowledge trigger disabled triggerId=${claimed.trigger.id} userId=${claimed.trigger.userId} reason=${reason}`,
      );
    }
  }

  /**
   * Claims older than 10 minutes: skipped / interrupted. The rows of one
   * batch (same trigger, claim time and run) get one audit row. A run they
   * made is left as it is.
   */
  private async closeStaleClaims(now: Date): Promise<number> {
    const before = new Date(now.getTime() - KNOWLEDGE_TRIGGER_RUN_LIMITS.claimTimeoutMs);
    const stale = await this.runs.find({
      where: { outcome: 'claimed', createdAt: LessThan(before) },
      order: { createdAt: 'ASC' },
      take: KNOWLEDGE_TRIGGER_RUN_LIMITS.triggersPerTick,
    });
    const batches = new Map<string, AgentKnowledgeTriggerRun[]>();
    for (const row of stale) {
      const key = `${row.triggerId}|${timeOf(row.createdAt)}|${row.collaborationRunId ?? ''}`;
      const list = batches.get(key) ?? [];
      list.push(row);
      batches.set(key, list);
    }
    let closed = 0;
    for (const rows of batches.values()) {
      const first = rows[0];
      const result = await this.runs.update(
        { id: In(rows.map((row) => row.id)), outcome: 'claimed' },
        { outcome: 'skipped', reason: 'interrupted' },
      );
      const affected = result.affected ?? 0;
      if (affected === 0) {
        continue;
      }
      closed += affected;
      const trigger = await this.triggers.findOne({ where: { id: first.triggerId } });
      const claimed: ClaimedBatch = {
        rowIds: rows.map((row) => row.id),
        documentIds: [],
        changedAt: first.changedAt instanceof Date ? first.changedAt : new Date(first.changedAt),
        localDate: localDateText(first.localDate),
        trigger:
          trigger ??
          ({
            id: first.triggerId,
            userId: first.userId,
            targetKind: 'chief-of-staff',
            workflowId: null,
            scopeId: null,
          } as unknown as AgentKnowledgeTrigger),
      };
      await this.writeAudit(
        KNOWLEDGE_TRIGGER_RUN_AUDIT_EVENTS.runSkipped,
        claimed,
        affected,
        'interrupted',
        first.collaborationRunId ?? null,
      );
      this.logger.log(
        `knowledge trigger run skipped triggerId=${first.triggerId} userId=${first.userId} localDate=${claimed.localDate} documents=${affected} reason=interrupted${first.collaborationRunId ? ` runId=${first.collaborationRunId}` : ''}`,
      );
    }
    return closed;
  }

  /** History rows older than 90 days, at most once an hour. */
  private async pruneHistory(now: Date): Promise<number> {
    if (this.lastPruneAt !== null && now.getTime() - this.lastPruneAt < KNOWLEDGE_TRIGGER_RUN_LIMITS.pruneEveryMs) {
      return 0;
    }
    this.lastPruneAt = now.getTime();
    const before = new Date(now.getTime() - KNOWLEDGE_TRIGGER_RUN_LIMITS.historyRetentionMs);
    const result = await this.runs.delete({ createdAt: LessThan(before), outcome: In(['started', 'skipped']) });
    const pruned = result.affected ?? 0;
    if (pruned > 0) {
      this.logger.log(`knowledge trigger history pruned rows=${pruned}`);
    }
    return pruned;
  }

  /**
   * Stage-start section 5: the trigger id, the local date, the target kind,
   * the workflow id, the run id, the folder id, a document count and a reason
   * code only. Never a title, content, content hash, document key, document
   * id or task text.
   */
  private async writeAudit(
    eventType: string,
    claimed: ClaimedBatch,
    documentCount: number,
    reason: KnowledgeTriggerSkipReason | null,
    collaborationRunId: string | null,
  ): Promise<void> {
    const payload: Record<string, string | number | null> = {
      triggerId: claimed.trigger.id,
      localDate: claimed.localDate,
      targetKind: claimed.trigger.targetKind,
      workflowId: claimed.trigger.workflowId ?? null,
      scopeId: claimed.trigger.scopeId ?? null,
      documentCount,
    };
    if (collaborationRunId) payload.collaborationRunId = collaborationRunId;
    if (reason) payload.reason = reason;
    try {
      await this.audit.insert({
        category: KNOWLEDGE_TRIGGER_AUDIT_CATEGORY,
        eventType,
        subjectType: KNOWLEDGE_TRIGGER_AUDIT_SUBJECT_TYPE,
        subjectId: claimed.trigger.id,
        userId: claimed.trigger.userId,
        payload,
        occurredAt: new Date(),
      });
    } catch (error) {
      this.logger.warn(`knowledge trigger audit insert failed event=${eventType} reason=${errorName(error)}`);
    }
  }
}

/** Ids, the local date, the target kind and the folder id: never the task, a title or a document id. */
function logParts(trigger: AgentKnowledgeTrigger, localDate: string): string {
  const workflow = trigger.workflowId ? ` workflowId=${trigger.workflowId}` : '';
  return `triggerId=${trigger.id} userId=${trigger.userId} localDate=${localDate} targetKind=${trigger.targetKind}${workflow} scopeId=${trigger.scopeId}`;
}
