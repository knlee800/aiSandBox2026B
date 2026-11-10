import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { FindOperator } from 'typeorm';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { CollaborationRunEntity } from './collaboration-run.entity';
import {
  CollaborationResultsService,
  RESULTS_EXCERPT_MAX_CHARS,
  RESULTS_MARK_SEEN_SQL,
  RESULTS_TASK_MAX_CHARS,
  RESULTS_WORKFLOW_FILTER_SQL,
} from './collaboration-results';
import {
  CollaborationResultsController,
  readCollaborationResultsQuery,
} from './collaboration-results.controller';

/**
 * RESULTS-01 routes against in-memory repositories. The fake query builder
 * applies only the clauses CollaborationResultsService writes and throws on
 * any other, so a changed clause fails here.
 */



export interface BuilderCall {
  method: string;
  args: unknown[];
}

function matchesValue(actual: unknown, expected: unknown): boolean {
  if (expected instanceof FindOperator) {
    if (expected.type === 'isNull') {
      return actual === null || actual === undefined;
    }
    if (expected.type === 'in') {
      return (expected.value as unknown as unknown[]).includes(actual);
    }
    throw new Error(`unsupported operator ${expected.type}`);
  }
  return actual === expected;
}

function matchesWhere(row: object, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) =>
    matchesValue((row as Record<string, unknown>)[key], expected),
  );
}

export function createResultsRepoFakes() {
  const runs = new Map<string, CollaborationRunEntity>();
  const referrals = new Map<string, CollaborationReferralEntity>();
  const builderCalls: BuilderCall[] = [];
  const rawQueries: Array<{ sql: string; params: unknown[] }> = [];
  const referralFinds: Array<Record<string, unknown>> = [];
  let now = new Date('2026-11-10T12:00:00.000Z');

  function createQueryBuilder(alias: string) {
    builderCalls.push({ method: 'createQueryBuilder', args: [alias] });
    const predicates: Array<(run: CollaborationRunEntity) => boolean> = [];
    let skip = 0;
    let take = Number.MAX_SAFE_INTEGER;
    const addClause = (clause: string, params: Record<string, unknown> = {}) => {
      if (clause === 'r.userId = :userId') {
        predicates.push((run) => run.userId === params.userId);
      } else if (clause === 'r.status = :status') {
        predicates.push((run) => run.status === params.status);
      } else if (clause === RESULTS_WORKFLOW_FILTER_SQL) {
        predicates.push((run) =>
          [...referrals.values()].some(
            (referral) =>
              referral.collaborationRunId === run.collaborationRunId &&
              referral.pendingJob?.workflow?.id === params.workflowId,
          ),
        );
      } else if (clause === 'r.createdAt >= :from') {
        predicates.push((run) => run.createdAt.getTime() >= (params.from as Date).getTime());
      } else if (clause === 'r.createdAt <= :to') {
        predicates.push((run) => run.createdAt.getTime() <= (params.to as Date).getTime());
      } else {
        throw new Error(`unexpected clause: ${clause}`);
      }
    };
    const builder = {
      where(clause: string, params?: Record<string, unknown>) {
        builderCalls.push({ method: 'where', args: [clause, params] });
        addClause(clause, params);
        return builder;
      },
      andWhere(clause: string, params?: Record<string, unknown>) {
        builderCalls.push({ method: 'andWhere', args: [clause, params] });
        addClause(clause, params);
        return builder;
      },
      orderBy(...args: unknown[]) {
        builderCalls.push({ method: 'orderBy', args });
        return builder;
      },
      addOrderBy(...args: unknown[]) {
        builderCalls.push({ method: 'addOrderBy', args });
        return builder;
      },
      skip(value: number) {
        builderCalls.push({ method: 'skip', args: [value] });
        skip = value;
        return builder;
      },
      take(value: number) {
        builderCalls.push({ method: 'take', args: [value] });
        take = value;
        return builder;
      },
      async getManyAndCount(): Promise<[CollaborationRunEntity[], number]> {
        const matched = [...runs.values()]
          .filter((run) => predicates.every((predicate) => predicate(run)))
          .sort((left, right) => {
            const byTime = right.createdAt.getTime() - left.createdAt.getTime();
            return byTime !== 0
              ? byTime
              : right.collaborationRunId.localeCompare(left.collaborationRunId);
          });
        return [matched.slice(skip, skip + take).map((run) => ({ ...run })), matched.length];
      },
    };
    return builder;
  }

  const runRepo = {
    createQueryBuilder,
    async count(options: { where: Record<string, unknown> }) {
      return [...runs.values()].filter((run) => matchesWhere(run, options.where)).length;
    },
    async findOne(options: { where: Record<string, unknown> }) {
      const found = [...runs.values()].find((run) => matchesWhere(run, options.where));
      return found ? { ...found } : null;
    },
    async query(sql: string, params: unknown[]) {
      rawQueries.push({ sql, params });
      if (sql !== RESULTS_MARK_SEEN_SQL) {
        throw new Error(`unexpected SQL: ${sql}`);
      }
      const [runId, userId] = params as [string, string];
      const run = runs.get(runId);
      if (run && run.userId === userId && run.resultSeenAt === null) {
        run.resultSeenAt = new Date(now.getTime());
        return [[], 1];
      }
      return [[], 0];
    },
  };

  const referralRepo = {
    async find(options: { where: Record<string, unknown> }) {
      referralFinds.push(options.where);
      return [...referrals.values()]
        .filter((referral) => matchesWhere(referral, options.where))
        .map((referral) => ({ ...referral }));
    },
  };

  return {
    runs,
    referrals,
    builderCalls,
    rawQueries,
    referralFinds,
    runRepo,
    referralRepo,
    setNow(value: Date) {
      now = value;
    },
  };
}

let runCounter = 0;

export function makeRun(overrides: Partial<CollaborationRunEntity> = {}): CollaborationRunEntity {
  runCounter += 1;
  const id = overrides.collaborationRunId ?? `run-${String(runCounter).padStart(4, '0')}`;
  const createdAt = overrides.createdAt ?? new Date(Date.UTC(2026, 10, 1, 0, runCounter));
  const run = new CollaborationRunEntity();
  Object.assign(run, {
    collaborationRunId: id,
    userId: 'owner',
    projectId: 'project-1',
    initiatorAgentRole: 'builder',
    initiatorBuilderProfileId: 'user',
    orchestrationMode: 'read_only',
    status: 'completed',
    referralIds: [],
    activeBuilderProfileIds: ['user'],
    timeoutMs: 1000,
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
    failedAt: null,
    timedOutAt: null,
    cancelRequestedAt: null,
    cancelledByUserId: null,
    cancelReason: null,
    resultSeenAt: null,
    ...overrides,
  });
  return run;
}

export function makeReferral(
  run: CollaborationRunEntity,
  overrides: Partial<CollaborationReferralEntity> & { prompt?: string } = {},
): CollaborationReferralEntity {
  const index = run.referralIds.length;
  const referralId = overrides.referralId ?? `${run.collaborationRunId}-ref-${index}`;
  const { prompt, ...rest } = overrides;
  const referral = new CollaborationReferralEntity();
  Object.assign(referral, {
    referralId,
    collaborationRunId: run.collaborationRunId,
    referralTraceId: `${referralId}-trace`,
    parentReferralTraceId: null,
    sourceAgentRole: 'builder',
    sourceBuilderProfileId: 'user',
    targetAgentRole: 'builder',
    targetBuilderProfileId: 'lead',
    status: 'completed',
    cancelStatus: 'not_requested',
    idempotencyKey: `${referralId}-key`,
    referralChain: [],
    depth: index,
    maxDepth: 3,
    visitedBuilderProfileIds: [],
    timeoutMs: 1000,
    constraintTimeoutMs: 1000,
    constraintMaxDepth: 3,
    constraintMaxAgentsPerCollaboration: 3,
    constraintReadOnly: true,
    constraintAllowWriteTools: false,
    constraintAllowedTools: [],
    executionId: null,
    pendingJob: prompt === undefined ? null : ({ prompt } as never),
    resultStatus: 'success',
    resultSummary: null,
    resultOutputFiles: null,
    resultDurationMs: null,
    createdAt: new Date(run.createdAt.getTime() + index * 1000),
    updatedAt: new Date(run.createdAt.getTime() + index * 1000),
    completedAt: null,
    failedAt: null,
    timedOutAt: null,
    cancelRequestedAt: null,
    cancelledByUserId: null,
    cancelReason: null,
    ...rest,
  });
  run.referralIds = [...run.referralIds, referralId];
  return referral;
}

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WORKFLOW_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function workflowJob(prompt: string, testRun = false) {
  return {
    prompt,
    workflow: {
      id: WORKFLOW_ID,
      name: 'Morning digest',
      version: 'v'.repeat(64),
      knowledgeScopeIds: [],
      connectorToolIds: [],
      model: { choice: 'server' },
      testRun,
      budgetPerRunCredits: null,
      budgetPerDayCredits: null,
    },
  } as never;
}

describe('CollaborationResultsController (RESULTS-01)', () => {
  let app: INestApplication;
  let fakes: ReturnType<typeof createResultsRepoFakes>;

  function addRun(
    overrides: Partial<CollaborationRunEntity>,
    steps: Array<Partial<CollaborationReferralEntity> & { prompt?: string }> = [],
  ): CollaborationRunEntity {
    const run = makeRun({ userId: OWNER_ID, ...overrides });
    for (const step of steps) {
      const referral = makeReferral(run, step);
      fakes.referrals.set(referral.referralId, referral);
    }
    fakes.runs.set(run.collaborationRunId, run);
    return run;
  }

  beforeEach(async () => {
    fakes = createResultsRepoFakes();
    const module = await Test.createTestingModule({
      controllers: [CollaborationResultsController],
      providers: [
        CollaborationResultsService,
        { provide: getRepositoryToken(CollaborationRunEntity), useValue: fakes.runRepo },
        { provide: getRepositoryToken(CollaborationReferralEntity), useValue: fakes.referralRepo },
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          if (req.header('x-test-anonymous') === '1') {
            return true;
          }
          req.apiKeyIdentity = {
            userId: req.header('x-test-user') || OWNER_ID,
            apiKeyId: 'browser-session',
            scopes: ['ai:execute'],
            harnessEntitled: req.header('x-test-entitled') === '0' ? false : true,
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  function http(options: { userId?: string; entitled?: boolean; anonymous?: boolean } = {}) {
    const server = request(app.getHttpServer());
    const headers = (req: request.Test) => {
      req.set('x-test-user', options.userId ?? OWNER_ID);
      req.set('x-test-entitled', options.entitled === false ? '0' : '1');
      if (options.anonymous) {
        req.set('x-test-anonymous', '1');
      }
      return req;
    };
    return {
      get: (path: string) => headers(server.get(path)),
      post: (path: string) => headers(server.post(path)),
    };
  }

  describe('401 and 403', () => {
    it('answers 401 on every route without an identity', async () => {
      const run = addRun({ status: 'completed' });
      await http({ anonymous: true }).get('/api/results').expect(401);
      await http({ anonymous: true }).get('/api/results/unread-count').expect(401);
      await http({ anonymous: true }).post(`/api/results/${run.collaborationRunId}/seen`).expect(401);
      expect(fakes.builderCalls).toEqual([]);
      expect(fakes.rawQueries).toEqual([]);
    });

    it('answers 403 on every route without harness access and reads nothing', async () => {
      const run = addRun({ status: 'completed' });
      await http({ entitled: false }).get('/api/results').expect(403);
      await http({ entitled: false }).get('/api/results/unread-count').expect(403);
      await http({ entitled: false })
        .post(`/api/results/${run.collaborationRunId}/seen`)
        .expect(403);
      expect(fakes.builderCalls).toEqual([]);
      expect(fakes.rawQueries).toEqual([]);
      expect(fakes.runs.get(run.collaborationRunId)?.resultSeenAt).toBeNull();
    });
  });

  describe('GET /api/results', () => {
    it('lists only the owner runs, newest first, with task, excerpt and read state', async () => {
      const older = addRun(
        { status: 'failed', createdAt: new Date('2026-11-01T08:00:00.000Z'), failedAt: new Date('2026-11-01T08:05:00.000Z') },
        [{ prompt: 'Summarise the board', status: 'failed', resultSummary: 'provider error' }],
      );
      const newer = addRun(
        {
          status: 'completed',
          createdAt: new Date('2026-11-02T08:00:00.000Z'),
          completedAt: new Date('2026-11-02T08:09:00.000Z'),
          resultSeenAt: new Date('2026-11-02T09:00:00.000Z'),
        },
        [
          { prompt: 'Plan the launch', status: 'completed', resultSummary: 'Lead plan' },
          { targetBuilderProfileId: 'writer', status: 'completed', resultSummary: 'Writer final answer' },
          { targetBuilderProfileId: 'reviewer', status: 'rejected', resultSummary: null },
        ],
      );
      addRun({ userId: OTHER_ID, status: 'completed' }, [{ prompt: 'not yours' }]);

      const response = await http().get('/api/results').expect(200);
      expect(response.body).toEqual({
        page: 1,
        pageSize: 20,
        total: 2,
        results: [
          {
            collaborationRunId: newer.collaborationRunId,
            projectId: 'project-1',
            status: 'completed',
            createdAt: '2026-11-02T08:00:00.000Z',
            finishedAt: '2026-11-02T08:09:00.000Z',
            teamId: 'coding',
            workflow: null,
            task: 'Plan the launch',
            excerpt: 'Writer final answer',
            seenAt: '2026-11-02T09:00:00.000Z',
          },
          {
            collaborationRunId: older.collaborationRunId,
            projectId: 'project-1',
            status: 'failed',
            createdAt: '2026-11-01T08:00:00.000Z',
            finishedAt: '2026-11-01T08:05:00.000Z',
            teamId: 'coding',
            workflow: null,
            task: 'Summarise the board',
            excerpt: null,
            seenAt: null,
          },
        ],
      });
      expect(JSON.stringify(response.body)).not.toContain('not yours');
    });

    it('reads the referrals once per page, not per run, and not at all for an empty page', async () => {
      for (let index = 0; index < 3; index += 1) {
        addRun({}, [{ prompt: `task ${index}`, resultSummary: `answer ${index}` }]);
      }
      await http().get('/api/results').expect(200);
      expect(fakes.referralFinds).toHaveLength(1);
      const where = fakes.referralFinds[0].collaborationRunId as FindOperator<string[]>;
      expect(where).toBeInstanceOf(FindOperator);
      expect(where.type).toBe('in');
      expect(where.value).toHaveLength(3);

      await http({ userId: OTHER_ID }).get('/api/results').expect(200);
      expect(fakes.referralFinds).toHaveLength(1);
    });

    it('cuts the task to 200 and the excerpt to 240 characters by code point', async () => {
      const task = `${'t'.repeat(RESULTS_TASK_MAX_CHARS - 1)}😀tail`;
      const answer = `${'a'.repeat(RESULTS_EXCERPT_MAX_CHARS - 1)}😀more text`;
      addRun({}, [{ prompt: task, resultSummary: answer }]);
      const response = await http().get('/api/results').expect(200);
      const [item] = response.body.results;
      expect(Array.from(item.task)).toHaveLength(RESULTS_TASK_MAX_CHARS);
      expect(item.task.endsWith('😀')).toBe(true);
      expect(Array.from(item.excerpt)).toHaveLength(RESULTS_EXCERPT_MAX_CHARS);
      expect(item.excerpt.endsWith('😀')).toBe(true);
    });

    it('shows a workflow run with its name and the test-run flag', async () => {
      addRun({ status: 'completed' }, [
        {
          targetBuilderProfileId: WORKFLOW_ID,
          pendingJob: workflowJob('Digest my inbox', true),
          resultSummary: 'Three emails need you.',
        },
      ]);
      const response = await http().get('/api/results').expect(200);
      expect(response.body.results[0]).toMatchObject({
        teamId: 'workflow',
        workflow: { id: WORKFLOW_ID, name: 'Morning digest', testRun: true },
        task: 'Digest my inbox',
        excerpt: 'Three emails need you.',
      });
    });

    it('pages with skip and take, and a page past the end is empty with the total', async () => {
      const ids: string[] = [];
      for (let index = 0; index < 5; index += 1) {
        ids.push(
          addRun({ createdAt: new Date(Date.UTC(2026, 10, 1 + index)) }).collaborationRunId,
        );
      }
      const newestFirst = [...ids].reverse();

      const second = await http().get('/api/results?page=2&pageSize=2').expect(200);
      expect(second.body.total).toBe(5);
      expect(second.body.page).toBe(2);
      expect(second.body.pageSize).toBe(2);
      expect(second.body.results.map((item: { collaborationRunId: string }) => item.collaborationRunId)).toEqual(
        newestFirst.slice(2, 4),
      );
      expect(fakes.builderCalls).toEqual(
        expect.arrayContaining([
          { method: 'skip', args: [2] },
          { method: 'take', args: [2] },
          { method: 'orderBy', args: ['r.createdAt', 'DESC'] },
          { method: 'addOrderBy', args: ['r.collaborationRunId', 'DESC'] },
        ]),
      );

      const past = await http().get('/api/results?page=4&pageSize=2').expect(200);
      expect(past.body).toEqual({ results: [], page: 4, pageSize: 2, total: 5 });

      await http().get('/api/results?pageSize=50').expect(200);
      expect(fakes.builderCalls).toContainEqual({ method: 'take', args: [50] });
    });

    it('filters by status', async () => {
      addRun({ status: 'completed' });
      const failed = addRun({ status: 'failed' });
      addRun({ status: 'cancelled' });
      const response = await http().get('/api/results?status=failed').expect(200);
      expect(response.body.total).toBe(1);
      expect(response.body.results[0].collaborationRunId).toBe(failed.collaborationRunId);
      expect(fakes.builderCalls).toContainEqual({
        method: 'andWhere',
        args: ['r.status = :status', { status: 'failed' }],
      });
    });

    it('filters by workflow through the first hand-off snapshot, lower-cased', async () => {
      const match = addRun({}, [
        { targetBuilderProfileId: WORKFLOW_ID, pendingJob: workflowJob('Digest') },
      ]);
      addRun({}, [{ prompt: 'coding task' }]);
      const response = await http()
        .get(`/api/results?workflowId=${WORKFLOW_ID.toUpperCase()}`)
        .expect(200);
      expect(response.body.total).toBe(1);
      expect(response.body.results[0].collaborationRunId).toBe(match.collaborationRunId);
      expect(fakes.builderCalls).toContainEqual({
        method: 'andWhere',
        args: [RESULTS_WORKFLOW_FILTER_SQL, { workflowId: WORKFLOW_ID }],
      });
      expect(RESULTS_WORKFLOW_FILTER_SQL).toBe(
          'EXISTS (SELECT 1 FROM "public"."collaboration_referrals" f WHERE f.collaboration_run_id = r.collaboration_run_id AND f.pending_job #>> \'{workflow,id}\' = :workflowId)',
      );
    });

    it('filters by created date, a day bound covering the whole UTC day', async () => {
      addRun({ createdAt: new Date('2026-10-31T23:59:59.999Z') });
      const first = addRun({ createdAt: new Date('2026-11-01T00:00:00.000Z') });
      const last = addRun({ createdAt: new Date('2026-11-02T23:59:59.999Z') });
      addRun({ createdAt: new Date('2026-11-03T00:00:00.000Z') });
      const response = await http().get('/api/results?from=2026-11-01&to=2026-11-02').expect(200);
      expect(response.body.results.map((item: { collaborationRunId: string }) => item.collaborationRunId)).toEqual([
        last.collaborationRunId,
        first.collaborationRunId,
      ]);

      const timed = await http()
        .get('/api/results?from=2026-11-01T00:00:00Z&to=2026-11-02T12:00:00%2B08:00')
        .expect(200);
      expect(timed.body.results.map((item: { collaborationRunId: string }) => item.collaborationRunId)).toEqual([
        first.collaborationRunId,
      ]);
    });

    it.each([
      ['status=bogus', /status must be/],
      ['status=completed&status=failed', /status must be given once/],
      ['status=', /status must be/],
      ['workflowId=not-a-uuid', /workflowId must be a valid UUID/],
      ['from=yesterday', /from must be an ISO date/],
      ['from=2026-02-30', /from must be an ISO date/],
      ['to=2026-11-01T10:00:00', /to must be an ISO date/],
      ['from=2026-11-02&to=2026-11-01', /from must not be after to/],
      ['page=0', /page must be a whole number from 1 to 10000/],
      ['page=-1', /page must be a whole number/],
      ['page=1.5', /page must be a whole number/],
      ['page=abc', /page must be a whole number/],
      ['page=10001', /page must be a whole number from 1 to 10000/],
      ['pageSize=0', /pageSize must be a whole number from 1 to 50/],
      ['pageSize=51', /pageSize must be a whole number from 1 to 50/],
      ['pageSize=ten', /pageSize must be a whole number/],
    ])('answers 400 for %s and reads nothing', async (query, message) => {
      const response = await http().get(`/api/results?${query}`).expect(400);
      expect(JSON.stringify(response.body)).toMatch(message);
      expect(fakes.builderCalls).toEqual([]);
    });
  });

  describe('GET /api/results/unread-count', () => {
    it('counts the owner finished runs not yet opened: completed, failed and timed_out only', async () => {
      addRun({ status: 'completed' });
      addRun({ status: 'failed' });
      addRun({ status: 'timed_out' });
      addRun({ status: 'cancelled' });
      addRun({ status: 'active' });
      addRun({ status: 'completed', resultSeenAt: new Date('2026-11-05T00:00:00.000Z') });
      addRun({ userId: OTHER_ID, status: 'completed' });
      const response = await http().get('/api/results/unread-count').expect(200);
      expect(response.body).toEqual({ count: 3 });
      const other = await http({ userId: OTHER_ID }).get('/api/results/unread-count').expect(200);
      expect(other.body).toEqual({ count: 1 });
    });
  });

  describe('POST /api/results/:runId/seen', () => {
    it('answers 404 for another owner run and a missing run, and writes nothing', async () => {
      const other = addRun({ userId: OTHER_ID, status: 'completed' });
      await http().post(`/api/results/${other.collaborationRunId}/seen`).expect(404);
      await http().post('/api/results/missing-run/seen').expect(404);
      expect(fakes.rawQueries).toEqual([]);
      expect(fakes.runs.get(other.collaborationRunId)?.resultSeenAt).toBeNull();
    });

    it('sets the mark once and a repeat call returns the first time', async () => {
      const run = addRun({ status: 'completed' });
      fakes.setNow(new Date('2026-11-10T12:00:00.000Z'));
      const first = await http().post(`/api/results/${run.collaborationRunId}/seen`).expect(200);
      expect(first.body).toEqual({ seenAt: '2026-11-10T12:00:00.000Z' });
      expect(fakes.rawQueries).toEqual([
        { sql: RESULTS_MARK_SEEN_SQL, params: [run.collaborationRunId, OWNER_ID] },
      ]);

      fakes.setNow(new Date('2026-11-10T13:00:00.000Z'));
      const again = await http().post(`/api/results/${run.collaborationRunId}/seen`).expect(200);
      expect(again.body).toEqual({ seenAt: '2026-11-10T12:00:00.000Z' });
      expect(fakes.rawQueries).toHaveLength(1);
    });

    it('opening a result lowers the unread count', async () => {
      const run = addRun({ status: 'failed' });
      addRun({ status: 'completed' });
      await http().get('/api/results/unread-count').expect(200, { count: 2 });
      await http().post(`/api/results/${run.collaborationRunId}/seen`).expect(200);
      await http().get('/api/results/unread-count').expect(200, { count: 1 });
    });

    it('an active run may be marked; it then never counts as unread when it finishes', async () => {
      const run = addRun({ status: 'active' });
      await http().post(`/api/results/${run.collaborationRunId}/seen`).expect(200);
      fakes.runs.get(run.collaborationRunId)!.status = 'completed';
      await http().get('/api/results/unread-count').expect(200, { count: 0 });
    });
  });

  describe('readCollaborationResultsQuery', () => {
    it('defaults to page 1 of 20, every status, no workflow and no dates', () => {
      expect(readCollaborationResultsQuery({})).toEqual({
        status: null,
        workflowId: null,
        from: null,
        to: null,
        page: 1,
        pageSize: 20,
      });
      expect(readCollaborationResultsQuery(undefined).pageSize).toBe(20);
    });

    it('turns a day bound into the start and end of that UTC day', () => {
      const parsed = readCollaborationResultsQuery({ from: '2026-11-01', to: '2026-11-01' });
      expect(parsed.from?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
      expect(parsed.to?.toISOString()).toBe('2026-11-01T23:59:59.999Z');
    });

    it('accepts every status filter value', () => {
      for (const status of ['completed', 'failed', 'timed_out', 'cancelled', 'active']) {
        expect(readCollaborationResultsQuery({ status }).status).toBe(status);
      }
    });
  });
});
