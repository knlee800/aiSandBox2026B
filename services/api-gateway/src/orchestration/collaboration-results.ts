import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { CollaborationRunEntity } from './collaboration-run.entity';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { collaborationTeamForTarget, type CollaborationRunTeamId } from './collaboration-teams';
import type { CollaborationRunStatus, ReferralPendingWorkflow } from './orchestration.contracts';

/**
 * RESULTS-01: the owner's finished runs, read state and run history.
 *
 * Reads collaboration_runs and collaboration_referrals directly; it never
 * settles, starts or changes a run (the sweep settles, D10). The only write is
 * result_seen_at, set once (D11). orchestration.service.ts is not used here.
 */

/** D3 (DECISION B): runs that count as unread until opened. Cancelled and active never do. */
export const RESULTS_UNREAD_STATUSES: readonly CollaborationRunStatus[] = Object.freeze([
  'completed',
  'failed',
  'timed_out',
]);

/** D8: the status filter values. Absent means every status. */
export const RESULTS_STATUS_FILTERS: readonly CollaborationRunStatus[] = Object.freeze([
  'completed',
  'failed',
  'timed_out',
  'cancelled',
  'active',
]);

export const RESULTS_PAGE_SIZE_DEFAULT = 20;
export const RESULTS_PAGE_SIZE_MAX = 50;
/** Paging stops here; further pages are refused as a bad value. */
export const RESULTS_PAGE_MAX = 10000;
export const RESULTS_TASK_MAX_CHARS = 200;
export const RESULTS_EXCERPT_MAX_CHARS = 240;

export interface CollaborationResultsQuery {
  status: CollaborationRunStatus | null;
  workflowId: string | null;
  /** Inclusive lower bound on created_at. */
  from: Date | null;
  /** Inclusive upper bound on created_at. */
  to: Date | null;
  page: number;
  pageSize: number;
}

export interface CollaborationResultWorkflowView {
  id: string;
  name: string;
  testRun: boolean;
}

export interface CollaborationResultListItem {
  collaborationRunId: string;
  projectId: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  teamId: CollaborationRunTeamId;
  workflow: CollaborationResultWorkflowView | null;
  task: string | null;
  excerpt: string | null;
  seenAt: string | null;
}

export interface CollaborationResultsPage {
  results: CollaborationResultListItem[];
  page: number;
  pageSize: number;
  total: number;
}

/** D9: the workflow id lives on the first hand-off's pending_job snapshot. */
export const RESULTS_WORKFLOW_FILTER_SQL = [
  'EXISTS (SELECT 1 FROM "public"."collaboration_referrals" f',
  'WHERE f.collaboration_run_id = r.collaboration_run_id',
  "AND f.pending_job #>> '{workflow,id}' = :workflowId)",
].join(' ');

/** D11: set once; a repeat call keeps the first value. */
export const RESULTS_MARK_SEEN_SQL = [
  'UPDATE "public"."collaboration_runs"',
  'SET "result_seen_at" = now()',
  'WHERE "collaboration_run_id" = $1',
  'AND "user_id" = $2',
  'AND "result_seen_at" IS NULL',
].join(' ');

/** Cuts by code point so a surrogate pair is never split. Blank text is null. */
export function cutResultText(value: string | null | undefined, maxChars: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const points = Array.from(trimmed);
  return points.length <= maxChars ? trimmed : points.slice(0, maxChars).join('');
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The time the run stopped, by its status. Active runs have none. */
export function resultFinishedAt(run: CollaborationRunEntity): string | null {
  switch (run.status) {
    case 'completed':
      return toIso(run.completedAt) ?? toIso(run.updatedAt);
    case 'failed':
      return toIso(run.failedAt) ?? toIso(run.updatedAt);
    case 'timed_out':
      return toIso(run.timedOutAt) ?? toIso(run.updatedAt);
    case 'cancelled':
      return toIso(run.cancelRequestedAt) ?? toIso(run.updatedAt);
    default:
      return null;
  }
}

/** Same rule as OrchestrationService.workflowOfEntity: the snapshot must be for the step's own target. */
function workflowOfReferral(
  referral: Pick<CollaborationReferralEntity, 'pendingJob' | 'targetBuilderProfileId'> | undefined,
): ReferralPendingWorkflow | null {
  const workflow = referral?.pendingJob?.workflow;
  if (!workflow || typeof workflow !== 'object') {
    return null;
  }
  return workflow.id === referral.targetBuilderProfileId ? workflow : null;
}

/** Hand-offs in run order (run.referralIds), then any stragglers by creation time. */
export function orderRunReferrals(
  run: Pick<CollaborationRunEntity, 'referralIds'>,
  referrals: readonly CollaborationReferralEntity[],
): CollaborationReferralEntity[] {
  const order = new Map<string, number>();
  (run.referralIds ?? []).forEach((id, index) => order.set(id, index));
  return [...referrals].sort((left, right) => {
    const leftAt = order.get(left.referralId) ?? Number.MAX_SAFE_INTEGER;
    const rightAt = order.get(right.referralId) ?? Number.MAX_SAFE_INTEGER;
    if (leftAt !== rightAt) {
      return leftAt - rightAt;
    }
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

/** D2 (DECISION A): the last completed hand-off's answer. */
export function finalAnswerOf(ordered: readonly CollaborationReferralEntity[]): string | null {
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const referral = ordered[index];
    if (referral.status === 'completed') {
      return referral.resultSummary ?? null;
    }
  }
  return null;
}

export function toResultListItem(
  run: CollaborationRunEntity,
  referrals: readonly CollaborationReferralEntity[],
): CollaborationResultListItem {
  const ordered = orderRunReferrals(run, referrals);
  const first = ordered[0];
  const workflow = workflowOfReferral(first);
  const team = collaborationTeamForTarget(first?.targetBuilderProfileId, workflow);
  return {
    collaborationRunId: run.collaborationRunId,
    projectId: run.projectId,
    status: run.status,
    createdAt: toIso(run.createdAt) ?? '',
    finishedAt: resultFinishedAt(run),
    teamId: team.id,
    workflow:
      team.id === 'workflow' && workflow
        ? { id: workflow.id, name: workflow.name, testRun: workflow.testRun === true }
        : null,
    task: cutResultText(first?.pendingJob?.prompt, RESULTS_TASK_MAX_CHARS),
    excerpt: cutResultText(finalAnswerOf(ordered), RESULTS_EXCERPT_MAX_CHARS),
    seenAt: toIso(run.resultSeenAt),
  };
}

@Injectable()
export class CollaborationResultsService {
  constructor(
    @InjectRepository(CollaborationRunEntity)
    private readonly runRepo: Repository<CollaborationRunEntity>,
    @InjectRepository(CollaborationReferralEntity)
    private readonly referralRepo: Repository<CollaborationReferralEntity>,
  ) {}

  /** D8, D9: newest first in SQL, one referral read per page. */
  async listForOwner(userId: string, query: CollaborationResultsQuery): Promise<CollaborationResultsPage> {
    const builder = this.runRepo
      .createQueryBuilder('r')
      .where('r.userId = :userId', { userId });
    if (query.status) {
      builder.andWhere('r.status = :status', { status: query.status });
    }
    if (query.workflowId) {
      builder.andWhere(RESULTS_WORKFLOW_FILTER_SQL, { workflowId: query.workflowId });
    }
    if (query.from) {
      builder.andWhere('r.createdAt >= :from', { from: query.from });
    }
    if (query.to) {
      builder.andWhere('r.createdAt <= :to', { to: query.to });
    }
    builder
      .orderBy('r.createdAt', 'DESC')
      .addOrderBy('r.collaborationRunId', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const [runs, total] = await builder.getManyAndCount();

    const ids = runs.map((run) => run.collaborationRunId);
    const referrals =
      ids.length === 0
        ? []
        : await this.referralRepo.find({ where: { collaborationRunId: In(ids) } });
    const byRun = new Map<string, CollaborationReferralEntity[]>();
    for (const referral of referrals) {
      const list = byRun.get(referral.collaborationRunId) ?? [];
      list.push(referral);
      byRun.set(referral.collaborationRunId, list);
    }

    return {
      results: runs.map((run) => toResultListItem(run, byRun.get(run.collaborationRunId) ?? [])),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /** D10: no settle on read. */
  async unreadCount(userId: string): Promise<number> {
    return this.runRepo.count({
      where: {
        userId,
        resultSeenAt: IsNull(),
        status: In([...RESULTS_UNREAD_STATUSES]),
      },
    });
  }

  /**
   * D11: null when the run does not exist or belongs to someone else (the
   * controller answers 404). Otherwise the stored first-open time.
   */
  async markSeen(userId: string, collaborationRunId: string): Promise<{ seenAt: string } | null> {
    const run = await this.runRepo.findOne({ where: { collaborationRunId } });
    if (!run || run.userId !== userId) {
      return null;
    }
    const existing = toIso(run.resultSeenAt);
    if (existing) {
      return { seenAt: existing };
    }
    await this.runRepo.query(RESULTS_MARK_SEEN_SQL, [collaborationRunId, userId]);
    const stored = await this.runRepo.findOne({ where: { collaborationRunId } });
    const seenAt = stored && stored.userId === userId ? toIso(stored.resultSeenAt) : null;
    if (!seenAt) {
      throw new Error('Could not record that the result was opened');
    }
    return { seenAt };
  }
}
