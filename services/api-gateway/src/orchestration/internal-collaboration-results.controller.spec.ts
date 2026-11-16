import { INestApplication, LoggerService, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { CollaborationRunEntity } from './collaboration-run.entity';
import { CollaborationResultsService } from './collaboration-results';
import { InternalCollaborationResultsController } from './internal-collaboration-results.controller';
import { OrchestrationModule } from './orchestration.module';

/** RESULT-TOOL-01 S1: the internal results read route. Mocked repositories; no database. */

const WRITE_METHODS = [
  'save',
  'insert',
  'update',
  'upsert',
  'delete',
  'remove',
  'softDelete',
  'softRemove',
  'increment',
  'decrement',
  'query',
  'createQueryBuilder',
];

const ANSWER_MARKER = 'RESULT-TEXT-MARKER-7c1f';
const TASK_MARKER = 'TASK-TEXT-MARKER-91ab';

describe('InternalCollaborationResultsController (RESULT-TOOL-01 S1)', () => {
  let app: INestApplication;
  let runs: CollaborationRunEntity[];
  let referrals: CollaborationReferralEntity[];
  let runRepo: Record<string, jest.Mock>;
  let referralRepo: Record<string, jest.Mock>;
  let logged: string[];
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  const internalKey = 'result-tool-01-internal-key';
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';
  const doneRun = 'collab_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const foreignRun = 'collab_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const noStepRun = 'collab_cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const blankRun = 'collab_dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const workflowRun = 'collab_eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const statusRuns = {
    active: 'collab_active-run',
    failed: 'collab_failed-run',
    cancelled: 'collab_cancelled-run',
    timed_out: 'collab_timed_out-run',
  } as const;
  const completedAt = new Date('2026-11-16T08:00:00.000Z');

  function run(id: string, overrides: Partial<CollaborationRunEntity> = {}): CollaborationRunEntity {
    const entity = new CollaborationRunEntity();
    Object.assign(entity, {
      collaborationRunId: id,
      userId: ownerId,
      projectId: 'project-1',
      status: 'completed',
      referralIds: [`${id}-ref`],
      createdAt: new Date('2026-11-16T07:00:00.000Z'),
      updatedAt: new Date('2026-11-16T08:05:00.000Z'),
      completedAt,
      failedAt: null,
      timedOutAt: null,
      cancelRequestedAt: null,
      resultSeenAt: null,
      ...overrides,
    });
    return entity;
  }

  function step(runId: string, overrides: Partial<CollaborationReferralEntity> = {}): CollaborationReferralEntity {
    const entity = new CollaborationReferralEntity();
    Object.assign(entity, {
      referralId: `${runId}-ref`,
      collaborationRunId: runId,
      targetBuilderProfileId: 'chief-of-staff',
      status: 'completed',
      pendingJob: { prompt: TASK_MARKER },
      resultSummary: `${ANSWER_MARKER} final answer`,
      createdAt: new Date('2026-11-16T07:00:00.000Z'),
      ...overrides,
    });
    return entity;
  }

  beforeEach(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;
    logged = [];
    runs = [
      run(doneRun),
      run(foreignRun, { userId: otherId }),
      run(noStepRun),
      run(blankRun),
      run(workflowRun),
      ...Object.entries(statusRuns).map(([status, id]) =>
        run(id, { status: status as CollaborationRunEntity['status'], completedAt: null }),
      ),
    ];
    referrals = [
      step(doneRun),
      step(foreignRun),
      step(noStepRun, { status: 'failed' }),
      step(blankRun, { resultSummary: '   ' }),
      step(workflowRun, {
        targetBuilderProfileId: 'wf-1',
        pendingJob: {
          prompt: TASK_MARKER,
          workflow: { id: 'wf-1', name: 'Morning brief', testRun: true },
        } as never,
      }),
      ...Object.values(statusRuns).map((id) => step(id)),
    ];
    runRepo = {
      findOne: jest.fn(async (options: { where: Record<string, unknown> }) => {
        return (
          runs.find((row) =>
            Object.entries(options.where).every(
              ([key, value]) => (row as unknown as Record<string, unknown>)[key] === value,
            ),
          ) ?? null
        );
      }),
    };
    referralRepo = {
      find: jest.fn(async (options: { where: { collaborationRunId: string } }) =>
        referrals.filter((row) => row.collaborationRunId === options.where.collaborationRunId),
      ),
    };
    for (const method of WRITE_METHODS) {
      runRepo[method] = jest.fn();
      referralRepo[method] = jest.fn();
    }

    const capture: LoggerService = {
      log: (...args: unknown[]) => logged.push(JSON.stringify(args)),
      error: (...args: unknown[]) => logged.push(JSON.stringify(args)),
      warn: (...args: unknown[]) => logged.push(JSON.stringify(args)),
      debug: (...args: unknown[]) => logged.push(JSON.stringify(args)),
      verbose: (...args: unknown[]) => logged.push(JSON.stringify(args)),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [InternalCollaborationResultsController],
      providers: [
        CollaborationResultsService,
        { provide: getRepositoryToken(CollaborationRunEntity), useValue: runRepo },
        { provide: getRepositoryToken(CollaborationReferralEntity), useValue: referralRepo },
        { provide: APP_GUARD, useClass: InternalServiceAuthGuard },
      ],
    })
      .setLogger(capture)
      .compile();

    app = moduleRef.createNestApplication();
    app.useLogger(capture);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    if (originalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
    }
    await app.close();
  });

  function authed() {
    return request(app.getHttpServer())
      .post('/api/internal/collaboration/results/read')
      .set('X-Internal-Service-Key', internalKey);
  }

  function expectNoWrites(): void {
    for (const method of WRITE_METHODS) {
      expect(runRepo[method]).not.toHaveBeenCalled();
      expect(referralRepo[method]).not.toHaveBeenCalled();
    }
  }

  it('sits under /api/internal/ with no second guard, and is wired into OrchestrationModule', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, 'internal-collaboration-results.controller.ts'),
      'utf8',
    ) as string;
    expect(source).toContain("@Controller('internal/collaboration/results')");
    expect(source).toContain("@Post('read')");
    expect(source).not.toContain('@UseGuards');
    expect(source).not.toContain('SessionOrApiKeyAuthGuard');
    expect(source).not.toMatch(/Logger|console\./);
    expect(source).not.toMatch(/AuditRecorder|AuditEvent|audit\./i);
    expect(Reflect.getMetadata('controllers', OrchestrationModule)).toContain(
      InternalCollaborationResultsController,
    );
  });

  it('refuses a missing or wrong internal key through the existing global guard', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/collaboration/results/read')
      .send({ userId: ownerId, runId: doneRun })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/internal/collaboration/results/read')
      .set('X-Internal-Service-Key', 'wrong-key')
      .send({ userId: ownerId, runId: doneRun })
      .expect(401);
    expect(runRepo.findOne).not.toHaveBeenCalled();
    expect(referralRepo.find).not.toHaveBeenCalled();
  });

  it("returns the owner's completed result with exactly the listed fields and writes nothing", async () => {
    const response = await authed().send({ userId: ownerId, runId: doneRun }).expect(200);
    expect(response.body).toEqual({
      runId: doneRun,
      status: 'completed',
      finishedAt: '2026-11-16T08:00:00.000Z',
      workflow: null,
      answer: `${ANSWER_MARKER} final answer`,
      truncated: false,
    });
    expect(runRepo.findOne).toHaveBeenCalledWith({
      where: { collaborationRunId: doneRun, userId: ownerId, status: 'completed' },
    });
    const text = JSON.stringify(response.body);
    expect(text).not.toContain(TASK_MARKER);
    expect(text).not.toContain(ownerId);
    expect(text).not.toContain(`${doneRun}-ref`);
    expect(text).not.toContain('project-1');
    expectNoWrites();
    const stored = runs.find((row) => row.collaborationRunId === doneRun);
    expect(stored?.resultSeenAt).toBeNull();
    expect(stored?.status).toBe('completed');
  });

  it('names the workflow and its test-run flag, and nothing else of it', async () => {
    const response = await authed().send({ userId: ownerId, runId: workflowRun }).expect(200);
    expect(response.body.workflow).toEqual({ name: 'Morning brief', testRun: true });
    expect(Object.keys(response.body).sort()).toEqual(
      ['answer', 'finishedAt', 'runId', 'status', 'truncated', 'workflow'].sort(),
    );
    expect(JSON.stringify(response.body)).not.toContain('wf-1');
  });

  it('cuts a long answer to 12,000 characters with the truncated flag', async () => {
    referrals = referrals.map((row) =>
      row.collaborationRunId === doneRun ? step(doneRun, { resultSummary: 'b'.repeat(12500) }) : row,
    );
    const response = await authed().send({ userId: ownerId, runId: doneRun }).expect(200);
    expect(response.body.answer).toBe('b'.repeat(12000));
    expect(response.body.truncated).toBe(true);
  });

  it('removes a trailing hand-off request from the answer', async () => {
    referrals = referrals.map((row) =>
      row.collaborationRunId === doneRun
        ? step(doneRun, { resultSummary: 'Summary ready.\n<handoff to="writer">tidy it</handoff>' })
        : row,
    );
    const response = await authed().send({ userId: ownerId, runId: doneRun }).expect(200);
    expect(response.body.answer).toBe('Summary ready.');
  });

  it("answers one fixed 404 for another owner's run, a missing run, each non-completed status, no completed step, a blank answer and a bad run id", async () => {
    const runIds: unknown[] = [
      foreignRun,
      'collab_ffffffff-ffff-4fff-8fff-ffffffffffff',
      ...Object.values(statusRuns),
      noStepRun,
      blankRun,
      '',
      'a'.repeat(129),
      'run 1',
      'run/1',
      '../x',
      123,
      null,
      undefined,
    ];
    const bodies = new Set<string>();
    for (const runId of runIds) {
      const response = await authed().send({ userId: ownerId, runId }).expect(404);
      expect(response.body).toEqual({
        statusCode: 404,
        message: 'Run result not found.',
        error: 'Not Found',
        code: 'NOT_FOUND',
      });
      bodies.add(JSON.stringify(response.body));
    }
    expect(bodies.size).toBe(1);
    expectNoWrites();
  });

  it('a bad run id never reaches the database', async () => {
    await authed().send({ userId: ownerId, runId: 'a'.repeat(129) }).expect(404);
    await authed().send({ userId: ownerId, runId: 'x y' }).expect(404);
    expect(runRepo.findOne).not.toHaveBeenCalled();
    await authed().send({ userId: ownerId, runId: 'a'.repeat(128) }).expect(404);
    expect(runRepo.findOne).toHaveBeenCalledTimes(1);
  });

  it('refuses a bad user id with 400 before any read', async () => {
    for (const userId of ['nope', '', 42, null, undefined, `${ownerId}x`]) {
      const response = await authed().send({ userId, runId: doneRun }).expect(400);
      expect(response.body.code).toBe('USER_INVALID');
      expect(response.body.message).toBe('The user id is not valid.');
      expect(JSON.stringify(response.body)).not.toContain(ANSWER_MARKER);
    }
    await authed().send([ownerId, doneRun]).expect(400);
    expect(runRepo.findOne).not.toHaveBeenCalled();
  });

  it('uses the body user id, ignores a query-string user id and extra body fields', async () => {
    await authed()
      .query({ userId: otherId })
      .send({ userId: ownerId, runId: doneRun, status: 'failed', markSeen: true })
      .expect(200);
    expect(runRepo.findOne).toHaveBeenCalledWith({
      where: { collaborationRunId: doneRun, userId: ownerId, status: 'completed' },
    });
    expectNoWrites();
  });

  it('logs no result or task text on a read, a miss or a refusal', async () => {
    const consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    try {
      await authed().send({ userId: ownerId, runId: doneRun }).expect(200);
      await authed().send({ userId: ownerId, runId: workflowRun }).expect(200);
      await authed().send({ userId: ownerId, runId: foreignRun }).expect(404);
      await authed().send({ userId: 'nope', runId: doneRun }).expect(400);
      await request(app.getHttpServer())
        .post('/api/internal/collaboration/results/read')
        .send({ userId: ownerId, runId: doneRun })
        .expect(401);
      const consoleText = consoleSpies.flatMap((spy) => spy.mock.calls.map((call) => JSON.stringify(call)));
      for (const line of [...logged, ...consoleText]) {
        expect(line).not.toContain(ANSWER_MARKER);
        expect(line).not.toContain(TASK_MARKER);
        expect(line).not.toContain('Morning brief');
      }
    } finally {
      for (const spy of consoleSpies) {
        spy.mockRestore();
      }
    }
  });
});
