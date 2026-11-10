import { FindOperator, getMetadataArgsStorage } from 'typeorm';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { CollaborationRunEntity } from './collaboration-run.entity';
import {
  CollaborationResultsService,
  RESULTS_MARK_SEEN_SQL,
  RESULTS_UNREAD_STATUSES,
  RESULTS_WORKFLOW_FILTER_SQL,
  cutResultText,
  finalAnswerOf,
  orderRunReferrals,
  resultFinishedAt,
  toResultListItem,
} from './collaboration-results';
import { collaborationTeamForTarget } from './collaboration-teams';

/** RESULTS-01 service logic with mocked repositories. No database. */

const OWNER = 'owner-1';

function run(overrides: Partial<CollaborationRunEntity> = {}): CollaborationRunEntity {
  const entity = new CollaborationRunEntity();
  Object.assign(entity, {
    collaborationRunId: 'run-1',
    userId: OWNER,
    projectId: 'project-1',
    status: 'completed',
    referralIds: [],
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:30:00.000Z'),
    completedAt: null,
    failedAt: null,
    timedOutAt: null,
    cancelRequestedAt: null,
    resultSeenAt: null,
    ...overrides,
  });
  return entity;
}

function referral(overrides: Partial<CollaborationReferralEntity> = {}): CollaborationReferralEntity {
  const entity = new CollaborationReferralEntity();
  Object.assign(entity, {
    referralId: 'ref-1',
    collaborationRunId: 'run-1',
    targetBuilderProfileId: 'lead',
    status: 'completed',
    pendingJob: null,
    resultSummary: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    ...overrides,
  });
  return entity;
}

function builderMock(rows: CollaborationRunEntity[], total: number) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: Record<string, jest.Mock> = {};
  for (const method of ['where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take']) {
    builder[method] = jest.fn((...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    });
  }
  builder.getManyAndCount = jest.fn(async () => [rows, total]);
  return { builder, calls };
}

function service(runRepo: Record<string, unknown>, referralRepo: Record<string, unknown> = {}) {
  return new CollaborationResultsService(runRepo as never, referralRepo as never);
}

describe('collaboration results logic (RESULTS-01)', () => {
  describe('cutResultText', () => {
    it('trims, keeps short text whole and makes blank text null', () => {
      expect(cutResultText('  hello  ', 10)).toBe('hello');
      expect(cutResultText('   ', 10)).toBeNull();
      expect(cutResultText(null, 10)).toBeNull();
      expect(cutResultText(undefined, 10)).toBeNull();
    });

    it('cuts by code point, never splitting a surrogate pair', () => {
      expect(cutResultText('ab😀cd', 3)).toBe('ab😀');
      expect(cutResultText('一二三四五', 2)).toBe('一二');
    });
  });

  describe('resultFinishedAt', () => {
    it('takes the stop time of the status, and null while active', () => {
      expect(resultFinishedAt(run({ status: 'completed', completedAt: new Date('2026-11-01T00:10:00.000Z') }))).toBe(
        '2026-11-01T00:10:00.000Z',
      );
      expect(resultFinishedAt(run({ status: 'failed', failedAt: new Date('2026-11-01T00:11:00.000Z') }))).toBe(
        '2026-11-01T00:11:00.000Z',
      );
      expect(resultFinishedAt(run({ status: 'timed_out', timedOutAt: new Date('2026-11-01T00:12:00.000Z') }))).toBe(
        '2026-11-01T00:12:00.000Z',
      );
      expect(
        resultFinishedAt(run({ status: 'cancelled', cancelRequestedAt: new Date('2026-11-01T00:13:00.000Z') })),
      ).toBe('2026-11-01T00:13:00.000Z');
      expect(resultFinishedAt(run({ status: 'cancelled' }))).toBe('2026-11-01T00:30:00.000Z');
      expect(resultFinishedAt(run({ status: 'active', completedAt: new Date() }))).toBeNull();
    });
  });

  describe('orderRunReferrals and finalAnswerOf', () => {
    it('orders by the run list and takes the last completed answer (DECISION A)', () => {
      const lead = referral({ referralId: 'a', resultSummary: 'lead answer' });
      const writer = referral({ referralId: 'b', resultSummary: 'writer answer' });
      const reviewer = referral({ referralId: 'c', status: 'failed', resultSummary: 'boom' });
      const ordered = orderRunReferrals(run({ referralIds: ['a', 'b', 'c'] }), [reviewer, writer, lead]);
      expect(ordered.map((entry) => entry.referralId)).toEqual(['a', 'b', 'c']);
      expect(finalAnswerOf(ordered)).toBe('writer answer');
    });

    it('puts a hand-off missing from the run list last, by creation time', () => {
      const listed = referral({ referralId: 'a', createdAt: new Date('2026-11-02T00:00:00.000Z') });
      const lateEarly = referral({ referralId: 'x', createdAt: new Date('2026-11-01T00:00:00.000Z') });
      const lateLate = referral({ referralId: 'y', createdAt: new Date('2026-11-03T00:00:00.000Z') });
      const ordered = orderRunReferrals(run({ referralIds: ['a'] }), [lateLate, lateEarly, listed]);
      expect(ordered.map((entry) => entry.referralId)).toEqual(['a', 'x', 'y']);
    });

    it('has no answer when nothing completed', () => {
      expect(finalAnswerOf([referral({ status: 'failed', resultSummary: 'x' })])).toBeNull();
      expect(finalAnswerOf([])).toBeNull();
    });
  });

  describe('toResultListItem', () => {
    it('names the team the same way the run detail does', () => {
      for (const target of ['lead', 'chief-of-staff', 'advisors-lead', 'unknown-profile']) {
        const item = toResultListItem(run({ referralIds: ['ref-1'] }), [
          referral({ targetBuilderProfileId: target }),
        ]);
        expect(item.teamId).toBe(collaborationTeamForTarget(target, null).id);
        expect(item.workflow).toBeNull();
      }
    });

    it('ignores a workflow snapshot that is not for the step target, like the detail', () => {
      const item = toResultListItem(run({ referralIds: ['ref-1'] }), [
        referral({
          targetBuilderProfileId: 'lead',
          pendingJob: { prompt: 'task', workflow: { id: 'wf-1', name: 'n', testRun: false } } as never,
        }),
      ]);
      expect(item.teamId).toBe('coding');
      expect(item.workflow).toBeNull();
      expect(item.task).toBe('task');
    });

    it('a run without hand-offs has no task and no excerpt', () => {
      const item = toResultListItem(run({ status: 'cancelled' }), []);
      expect(item.task).toBeNull();
      expect(item.excerpt).toBeNull();
      expect(item.teamId).toBe('coding');
    });
  });

  describe('CollaborationResultsService', () => {
    it('listForOwner writes the owner, filters, order and paging in SQL', async () => {
      const { builder, calls } = builderMock([], 0);
      const runRepo = { createQueryBuilder: jest.fn(() => builder) };
      const referralRepo = { find: jest.fn() };
      const from = new Date('2026-11-01T00:00:00.000Z');
      const to = new Date('2026-11-02T23:59:59.999Z');
      const result = await service(runRepo, referralRepo).listForOwner(OWNER, {
        status: 'completed',
        workflowId: 'wf-1',
        from,
        to,
        page: 3,
        pageSize: 10,
      });
      expect(runRepo.createQueryBuilder).toHaveBeenCalledWith('r');
      expect(calls).toEqual([
        ['where', 'r.userId = :userId', { userId: OWNER }],
        ['andWhere', 'r.status = :status', { status: 'completed' }],
        ['andWhere', RESULTS_WORKFLOW_FILTER_SQL, { workflowId: 'wf-1' }],
        ['andWhere', 'r.createdAt >= :from', { from }],
        ['andWhere', 'r.createdAt <= :to', { to }],
        ['orderBy', 'r.createdAt', 'DESC'],
        ['addOrderBy', 'r.collaborationRunId', 'DESC'],
        ['skip', 20],
        ['take', 10],
      ]);
      expect(referralRepo.find).not.toHaveBeenCalled();
      expect(result).toEqual({ results: [], page: 3, pageSize: 10, total: 0 });
    });

    it('listForOwner without filters scopes by owner only', async () => {
      const { builder, calls } = builderMock([], 0);
      await service({ createQueryBuilder: () => builder }).listForOwner(OWNER, {
        status: null,
        workflowId: null,
        from: null,
        to: null,
        page: 1,
        pageSize: 20,
      });
      expect(calls.filter(([method]) => method === 'where' || method === 'andWhere')).toEqual([
        ['where', 'r.userId = :userId', { userId: OWNER }],
      ]);
      expect(calls).toContainEqual(['skip', 0]);
    });

    it('listForOwner reads the page referrals in one find with In', async () => {
      const rows = [run({ collaborationRunId: 'run-1', referralIds: ['r1'] }), run({ collaborationRunId: 'run-2' })];
      const { builder } = builderMock(rows, 7);
      const referralRepo = {
        find: jest.fn(async () => [
          referral({ referralId: 'r1', collaborationRunId: 'run-1', pendingJob: { prompt: 'task one' } as never, resultSummary: 'done' }),
        ]),
      };
      const result = await service({ createQueryBuilder: () => builder }, referralRepo).listForOwner(OWNER, {
        status: null,
        workflowId: null,
        from: null,
        to: null,
        page: 1,
        pageSize: 2,
      });
      expect(referralRepo.find).toHaveBeenCalledTimes(1);
      const where = (referralRepo.find.mock.calls[0] as unknown as [{ where: { collaborationRunId: FindOperator<string[]> } }])[0]
        .where.collaborationRunId;
      expect(where.type).toBe('in');
      expect(where.value).toEqual(['run-1', 'run-2']);
      expect(result.total).toBe(7);
      expect(result.results.map((item) => [item.collaborationRunId, item.task, item.excerpt])).toEqual([
        ['run-1', 'task one', 'done'],
        ['run-2', null, null],
      ]);
    });

    it('unreadCount counts null seen marks for completed, failed and timed_out', async () => {
      const runRepo = { count: jest.fn(async () => 4) };
      await expect(service(runRepo).unreadCount(OWNER)).resolves.toBe(4);
      const [{ where }] = runRepo.count.mock.calls[0] as unknown as [{ where: Record<string, unknown> }];
      expect(where.userId).toBe(OWNER);
      expect((where.resultSeenAt as FindOperator<unknown>).type).toBe('isNull');
      expect((where.status as FindOperator<string[]>).type).toBe('in');
      expect((where.status as FindOperator<string[]>).value).toEqual([...RESULTS_UNREAD_STATUSES]);
      expect(RESULTS_UNREAD_STATUSES).toEqual(['completed', 'failed', 'timed_out']);
    });

    it('markSeen sets the mark with one guarded UPDATE that keeps the first value', async () => {
      const seenAt = new Date('2026-11-10T12:00:00.000Z');
      const runRepo = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(run())
          .mockResolvedValueOnce(run({ resultSeenAt: seenAt })),
        query: jest.fn(async () => [[], 1]),
      };
      await expect(service(runRepo).markSeen(OWNER, 'run-1')).resolves.toEqual({
        seenAt: '2026-11-10T12:00:00.000Z',
      });
      expect(runRepo.query).toHaveBeenCalledWith(RESULTS_MARK_SEEN_SQL, ['run-1', OWNER]);
      expect(RESULTS_MARK_SEEN_SQL).toBe(
        'UPDATE "public"."collaboration_runs" SET "result_seen_at" = now() WHERE "collaboration_run_id" = $1 AND "user_id" = $2 AND "result_seen_at" IS NULL',
      );
    });

    it('markSeen returns the stored mark without writing when already seen', async () => {
      const runRepo = {
        findOne: jest.fn(async () => run({ resultSeenAt: new Date('2026-11-09T00:00:00.000Z') })),
        query: jest.fn(),
      };
      await expect(service(runRepo).markSeen(OWNER, 'run-1')).resolves.toEqual({
        seenAt: '2026-11-09T00:00:00.000Z',
      });
      expect(runRepo.query).not.toHaveBeenCalled();
    });

    it('markSeen is null for a missing run or another owner run, without writing', async () => {
      const runRepo = {
        findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(run({ userId: 'someone-else' })),
        query: jest.fn(),
      };
      await expect(service(runRepo).markSeen(OWNER, 'run-1')).resolves.toBeNull();
      await expect(service(runRepo).markSeen(OWNER, 'run-1')).resolves.toBeNull();
      expect(runRepo.query).not.toHaveBeenCalled();
    });

    it('markSeen fails loudly when the mark did not stick', async () => {
      const runRepo = { findOne: jest.fn(async () => run()), query: jest.fn(async () => [[], 0]) };
      await expect(service(runRepo).markSeen(OWNER, 'run-1')).rejects.toThrow(
        /Could not record that the result was opened/,
      );
    });
  });

  it('the entity never writes result_seen_at from an ordinary save (update: false)', () => {
    const column = getMetadataArgsStorage().columns.find(
      (entry) => entry.target === CollaborationRunEntity && entry.propertyName === 'resultSeenAt',
    );
    expect(column?.options.update).toBe(false);
  });
});
