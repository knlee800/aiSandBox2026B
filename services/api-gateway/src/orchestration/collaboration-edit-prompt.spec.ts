import {
  ConflictException,
  ExecutionContext,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { ExecutionResultService } from '../ai/execution-result.service';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { AbortConfig } from '../abort/abort.config';
import { AbortGuard } from '../abort/abort.guard';
import { CreditBalanceGuard } from '../billing/credit-balance.guard';
import { UserRole } from '../entities/user-role.enum';
import { QueueService } from '../queue/queue.service';
import { TokenQuotaGuard } from '../quota/token-quota.guard';
import { ExecutionSafetyGuard } from '../safety/execution-safety.guard';
import { GlobalSafetyLimitService } from '../safety/global-safety-limit.service';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { ConversationService } from '../conversations/conversation.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { SessionService } from '../sessions/session.service';
import { CollaborationController } from './collaboration.controller';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { CollaborationRunEntity } from './collaboration-run.entity';
import { OrchestrationService } from './orchestration.service';

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CONVERSATION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TASK = 'PROMPT_SHOULD_NOT_LEAK';
const EDITED = 'EDITED_PROMPT_TEXT_SHOULD_NOT_LEAK';
const HARNESS_SECRET = 'collaboration-screen-test-secret';

type FakeSession = {
  id: string;
  userId: string;
  projectId: string | null;
  status: 'active';
  terminatedAt: Date | null;
  expiresAt: Date;
};

function cloneRow<T>(row: T): T {
  const copy = { ...(row as Record<string, unknown>) };
  for (const key of Object.keys(copy)) {
    const value = copy[key];
    if (value instanceof Date) {
      copy[key] = new Date(value.getTime());
    } else if (Array.isArray(value)) {
      copy[key] = [...value];
    } else if (key === 'pendingJob' && value && typeof value === 'object') {
      copy[key] = JSON.parse(JSON.stringify(value));
    }
  }
  return copy as T;
}

function matchesWhere(row: unknown, where?: Record<string, unknown>): boolean {
  if (!where) {
    return true;
  }
  const record = row as Record<string, unknown>;
  return Object.entries(where).every(([key, expected]) => record[key] === expected);
}

function createOrchestrationRepoFakes() {
  const runs = new Map<string, CollaborationRunEntity>();
  const referrals = new Map<string, CollaborationReferralEntity>();

  const createRepo = <T>(store: Map<string, T>, pk: string) => {
    const repo: {
      findOne: (opts: { where: Record<string, unknown> }) => Promise<T | null>;
      find: (opts?: { where?: Record<string, unknown> }) => Promise<T[]>;
      save: (entity: T) => Promise<T>;
      update: (
        criteria: Record<string, unknown>,
        partial: Record<string, unknown>,
      ) => Promise<{ affected: number; raw: unknown[]; generatedMaps: unknown[] }>;
      manager: {
        transaction: <R>(cb: (em: unknown) => Promise<R>) => Promise<R>;
        getRepository: (entity: unknown) => unknown;
      };
    } = {
      findOne: async ({ where }) => {
        for (const row of store.values()) {
          if (matchesWhere(row, where)) {
            return cloneRow(row);
          }
        }
        return null;
      },
      find: async (opts = {}) =>
        [...store.values()]
          .filter((row) => matchesWhere(row, opts.where))
          .map((row) => cloneRow(row)),
      save: async (entity) => {
        const copy = cloneRow(entity);
        store.set(String((copy as Record<string, unknown>)[pk]), copy);
        return cloneRow(copy);
      },
      update: async (criteria, partial) => {
        let affected = 0;
        for (const [key, row] of store) {
          if (matchesWhere(row, criteria)) {
            const next = cloneRow(row);
            Object.assign(next as Record<string, unknown>, partial);
            store.set(key, next);
            affected += 1;
          }
        }
        return { affected, raw: [], generatedMaps: [] };
      },
      manager: {
        transaction: async <R>(cb: (em: unknown) => Promise<R>) => cb(undefined),
        getRepository: () => undefined,
      },
    };
    return repo;
  };

  const runRepo = createRepo(runs, 'collaborationRunId');
  const referralRepo = createRepo(referrals, 'referralId');
  const manager = {
    transaction: async <R>(cb: (em: typeof manager) => Promise<R>) => cb(manager),
    getRepository: (entity: unknown) => {
      if (entity === CollaborationRunEntity) {
        return runRepo;
      }
      if (entity === CollaborationReferralEntity) {
        return referralRepo;
      }
      throw new Error('Unknown orchestration entity');
    },
  };
  runRepo.manager = manager;
  referralRepo.manager = manager;
  return { runRepo, referralRepo, runs, referrals };
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe('COLLAB-EDIT-01 updatePendingReferralPrompt', () => {
  const originalGlobal = process.env.GLOBAL_EXECUTION_ENABLED;
  const originalProvider = process.env.AI_PROVIDER;
  const originalAbort = process.env.ABORT_MODE;
  const originalSecret = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;

  let app: INestApplication;
  let service: OrchestrationService;
  let queue: { enqueueExecution: jest.Mock };
  let referrals: Map<string, CollaborationReferralEntity>;
  let referralRepo: ReturnType<typeof createOrchestrationRepoFakes>['referralRepo'];

  beforeEach(async () => {
    process.env.GLOBAL_EXECUTION_ENABLED = 'true';
    process.env.AI_PROVIDER = 'stub';
    process.env.ABORT_MODE = 'NONE';
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
    AbortConfig.initialize();

    const fakes = createOrchestrationRepoFakes();
    referrals = fakes.referrals;
    referralRepo = fakes.referralRepo;
    const sessions = new Map<string, FakeSession>([
      [
        SESSION_ID,
        {
          id: SESSION_ID,
          userId: OWNER_ID,
          projectId: PROJECT_ID,
          status: 'active',
          terminatedAt: null,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      ],
    ]);
    const conversations = new Map([[SESSION_ID, { id: CONVERSATION_ID, sessionId: SESSION_ID }]]);
    queue = { enqueueExecution: jest.fn().mockResolvedValue(undefined) };
    const creditGuard = new CreditBalanceGuard(
      { findByOwner: async () => ({ balance: 25 }) } as never,
      { findOne: async () => ({ role: UserRole.USER }) } as never,
    );
    const tokenGuard = new TokenQuotaGuard({
      createQueryRunner: () => ({
        connect: async () => undefined,
        startTransaction: async () => undefined,
        commitTransaction: async () => undefined,
        rollbackTransaction: async () => undefined,
        release: async () => undefined,
        query: async (sql: string) => {
          if (sql.includes('SUM(tokens_used)')) {
            return [{ total: 0 }];
          }
          if (sql.includes('ORDER BY timestamp')) {
            return [{ timestamp: new Date() }];
          }
          return [];
        },
      }),
    } as never);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollaborationController],
      providers: [
        OrchestrationService,
        ExecutionSafetyGuard,
        GlobalSafetyLimitService,
        AbortGuard,
        { provide: CreditBalanceGuard, useValue: creditGuard },
        { provide: TokenQuotaGuard, useValue: tokenGuard },
        { provide: getRepositoryToken(CollaborationRunEntity), useValue: fakes.runRepo },
        {
          provide: getRepositoryToken(CollaborationReferralEntity),
          useValue: fakes.referralRepo,
        },
        { provide: QueueService, useValue: queue },
        {
          provide: ExecutionResultService,
          useValue: { requestCancel: jest.fn(), getExecution: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: ContainerManagerHttpClient,
          useValue: {
            getWorkingTreeDiff: jest.fn().mockResolvedValue({
              commitHash: 'abc123abc123abc123abc123abc123abc123abcd',
              diff: '',
              truncated: false,
            }),
          },
        },
        {
          provide: UsageLedgerService,
          useValue: { writeExecutionIntent: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: SessionService,
          useValue: {
            getSessionById: async (sessionId: string) => {
              const session = sessions.get(sessionId);
              if (!session) {
                throw new NotFoundException(`Session with ID ${sessionId} not found`);
              }
              return session;
            },
          },
        },
        { provide: KnowledgeService, useValue: { findActiveOwnedByIds: jest.fn(async () => []) } },
        {
          provide: ConversationService,
          useValue: {
            getConversationBySession: async (sessionId: string) =>
              conversations.get(sessionId) ?? null,
            getOrCreateConversation: async (sessionId: string) => {
              const existing = conversations.get(sessionId);
              if (existing) {
                return existing;
              }
              const created = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', sessionId };
              conversations.set(sessionId, created);
              return created;
            },
          },
        },
      ],
    })
      .overrideGuard(SessionOrApiKeyAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.apiKeyIdentity = {
            userId: OWNER_ID,
            apiKeyId: 'browser-session',
            scopes: ['ai:execute'],
            harnessEntitled: true,
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    service = app.get(OrchestrationService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    restoreEnv('GLOBAL_EXECUTION_ENABLED', originalGlobal);
    restoreEnv('AI_PROVIDER', originalProvider);
    restoreEnv('ABORT_MODE', originalAbort);
    restoreEnv('HARNESS_ENTITLEMENT_HMAC_SECRET', originalSecret);
  });

  async function startWaiting() {
    const response = await request(app.getHttpServer())
      .post('/api/collaboration/runs')
      .send({
        sessionId: SESSION_ID,
        task: TASK,
        provider: 'openai',
        model: 'gpt-4o',
        fileAccess: false,
      })
      .expect(201);
    return response.body as { collaborationRunId: string; referralId: string };
  }

  function editInput(started: { collaborationRunId: string; referralId: string }, prompt = EDITED) {
    return {
      collaborationRunId: started.collaborationRunId,
      referralId: started.referralId,
      prompt,
      editedBy: OWNER_ID,
    };
  }

  it('replaces the prompt and keeps the rest of the waiting job', async () => {
    const started = await startWaiting();
    const before = referrals.get(started.referralId)?.pendingJob;
    expect(before?.prompt).toBe(TASK);
    const snapshot = JSON.parse(JSON.stringify(before));

    const referral = await service.updatePendingReferralPrompt(editInput(started));

    const after = referrals.get(started.referralId)?.pendingJob;
    expect(after).toEqual({ ...snapshot, prompt: EDITED });
    expect(referral.prompt).toBe(EDITED);
    expect(referral.status).toBe('pending_approval');
    expect(referrals.get(started.referralId)?.status).toBe('pending_approval');
  });

  it('returns 409 and changes nothing when the hand-off is not pending approval', async () => {
    const started = await startWaiting();
    const stored = referrals.get(started.referralId);
    stored!.status = 'approved';
    const before = JSON.parse(JSON.stringify(stored));

    await expect(service.updatePendingReferralPrompt(editInput(started))).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.updatePendingReferralPrompt(editInput(started))).rejects.toMatchObject({
      status: 409,
    });

    expect(JSON.parse(JSON.stringify(referrals.get(started.referralId)))).toEqual(before);
    expect(
      service
        .getAuditEvents()
        .filter((event) => event.eventType === 'orchestration.referral_prompt_edited'),
    ).toEqual([]);
  });

  it('returns 409 when the waiting job is missing', async () => {
    const started = await startWaiting();
    const stored = referrals.get(started.referralId);
    stored!.pendingJob = null;
    const before = JSON.parse(JSON.stringify(stored));

    await expect(service.updatePendingReferralPrompt(editInput(started))).rejects.toMatchObject({
      status: 409,
    });

    expect(JSON.parse(JSON.stringify(referrals.get(started.referralId)))).toEqual(before);
  });

  it('returns 409 when the conditional update loses the race', async () => {
    const started = await startWaiting();
    const before = JSON.parse(JSON.stringify(referrals.get(started.referralId)));
    jest.spyOn(referralRepo, 'update').mockResolvedValue({
      affected: 0,
      raw: [],
      generatedMaps: [],
    });

    await expect(service.updatePendingReferralPrompt(editInput(started))).rejects.toMatchObject({
      status: 409,
    });

    expect(JSON.parse(JSON.stringify(referrals.get(started.referralId)))).toEqual(before);
    expect(
      service
        .getAuditEvents()
        .filter((event) => event.eventType === 'orchestration.referral_prompt_edited'),
    ).toEqual([]);
  });

  it('records an audit event whose payload has the length and not the prompt text', async () => {
    const started = await startWaiting();

    await service.updatePendingReferralPrompt(editInput(started));

    const events = service
      .getAuditEvents()
      .filter((event) => event.eventType === 'orchestration.referral_prompt_edited');
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event?.payload).toMatchObject({
      lifecycleEvent: 'referral_prompt_edited',
      editedBy: OWNER_ID,
      referralId: started.referralId,
      status: 'pending_approval',
      userId: OWNER_ID,
      projectId: PROJECT_ID,
      promptChars: EDITED.length,
    });
    expect(JSON.stringify(event)).not.toContain(EDITED);
    expect(JSON.stringify(event)).not.toContain(TASK);
    expect(event?.payload).not.toHaveProperty('prompt');
  });

  it('runs the edited prompt when the hand-off is approved', async () => {
    const started = await startWaiting();
    await service.updatePendingReferralPrompt(editInput(started));

    await service.approveReferral({
      collaborationRunId: started.collaborationRunId,
      referralId: started.referralId,
      decidedBy: OWNER_ID,
    });

    expect(queue.enqueueExecution).toHaveBeenCalledTimes(1);
    const payload = queue.enqueueExecution.mock.calls[0][0] as { prompt: string };
    expect(payload.prompt).toBe(EDITED);
    expect(payload.prompt).not.toBe(TASK);
  });
});
