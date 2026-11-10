import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { systemAgentById } from '../system-agents/system-agent-registry';
import { UserAgentService } from '../user-agent/user-agent.service';
import { CollaborationRosterService, ROSTER_REFUSAL_CODES } from './collaboration-roster';
import { CollaborationRosterController } from './collaboration-roster.controller';
import { CollaborationRosterEntity } from './collaboration-roster.entity';
import { CollaborationWorkflowService, renderWorkflow, type WorkflowRow } from './collaboration-workflow';

/**
 * COS-FRONTDOOR-01 D9 routes over the real CollaborationRosterService with
 * in-memory stores. The guard is replaced by one that sets the identity from
 * test headers, as in the RESULTS-01 controller spec.
 */

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const WF_MINE = 'a0a0a0a0-0000-4000-8000-000000000001';
const WF_THEIRS = 'b0b0b0b0-0000-4000-8000-000000000001';
const WF_NONE = 'c0c0c0c0-0000-4000-8000-000000000009';

type TestRow = WorkflowRow & { userId: string; description: string };

function workflowRow(id: string, userId: string, name: string): TestRow {
  const cos = systemAgentById('chief-of-staff')!;
  return {
    id,
    userId,
    name,
    role: 'Assistant',
    description: `${name} description`,
    status: 'active',
    tone: cos.tone,
    replyLanguage: cos.replyLanguage,
    purpose: cos.purpose,
    procedure: cos.procedure,
    result: cos.result,
    knowledgeScopeIds: cos.knowledgeScopes.map((scope) => scope.id),
    connectorToolIds: [],
    model: { choice: 'server' },
    budgetPerRunCredits: null,
    budgetPerDayCredits: null,
  };
}

describe('CollaborationRosterController (COS-FRONTDOOR-01 D9)', () => {
  let app: INestApplication;
  let rosterRows: Map<string, CollaborationRosterEntity>;
  let agentRows: Map<string, TestRow>;
  let tested: Set<string>;
  let rosterRepo: { findOne: jest.Mock; upsert: jest.Mock };
  let userAgents: { findOneByIdAndUserId: jest.Mock; listByUserId: jest.Mock };

  beforeEach(async () => {
    rosterRows = new Map();
    agentRows = new Map([
      [WF_MINE, workflowRow(WF_MINE, OWNER, 'Mine')],
      [WF_THEIRS, workflowRow(WF_THEIRS, OTHER, 'Theirs')],
    ]);
    tested = new Set([`${OWNER}:${WF_MINE}:${renderWorkflow(agentRows.get(WF_MINE)!)!.version}`]);
    rosterRepo = {
      findOne: jest.fn(async ({ where }: { where: { userId: string } }) => {
        const row = rosterRows.get(where.userId);
        return row ? { ...row, memberIds: [...row.memberIds] } : null;
      }),
      upsert: jest.fn(async (values: CollaborationRosterEntity, conflictPaths: string[]) => {
        expect(conflictPaths).toEqual(['userId']);
        rosterRows.set(values.userId, { ...values, memberIds: [...values.memberIds] });
      }),
    };
    userAgents = {
      findOneByIdAndUserId: jest.fn(async (id: string, userId: string) => {
        const row = agentRows.get(id);
        return row && row.userId === userId ? { ...row } : null;
      }),
      listByUserId: jest.fn(async (userId: string) =>
        [...agentRows.values()].filter((row) => row.userId === userId).map((row) => ({ ...row })),
      ),
    };
    const workflows = {
      usageFor: jest.fn(async (userId: string, workflowId: string) => {
        const versions = new Set<string>();
        for (const key of tested) {
          const [owner, id, version] = key.split(':');
          if (owner === userId && id === workflowId) {
            versions.add(version);
          }
        }
        return { testedVersions: versions, lastTestRunAt: null, spentTodayCredits: 0, lastRunCredits: null };
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [CollaborationRosterController],
      providers: [
        CollaborationRosterService,
        { provide: getRepositoryToken(CollaborationRosterEntity), useValue: rosterRepo },
        { provide: UserAgentService, useValue: userAgents },
        { provide: CollaborationWorkflowService, useValue: workflows },
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
            userId: req.header('x-test-user') || OWNER,
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
      req.set('x-test-user', options.userId ?? OWNER);
      req.set('x-test-entitled', options.entitled === false ? '0' : '1');
      if (options.anonymous) {
        req.set('x-test-anonymous', '1');
      }
      return req;
    };
    return {
      get: (path: string) => headers(server.get(path)),
      put: (path: string) => headers(server.put(path)),
    };
  }

  function noStoreCalls(): void {
    expect(rosterRepo.findOne).not.toHaveBeenCalled();
    expect(rosterRepo.upsert).not.toHaveBeenCalled();
    expect(userAgents.findOneByIdAndUserId).not.toHaveBeenCalled();
    expect(userAgents.listByUserId).not.toHaveBeenCalled();
  }

  describe('401 and 403', () => {
    it('answers 401 on both routes without an identity and reads nothing', async () => {
      await http({ anonymous: true }).get('/api/collaboration/roster').expect(401);
      await http({ anonymous: true })
        .put('/api/collaboration/roster')
        .send({ memberIds: ['product-strategy'] })
        .expect(401);
      noStoreCalls();
    });

    it('answers 403 on both routes without harness access and reads nothing', async () => {
      await http({ entitled: false }).get('/api/collaboration/roster').expect(403);
      await http({ entitled: false })
        .put('/api/collaboration/roster')
        .send({ memberIds: ['product-strategy'] })
        .expect(403);
      noStoreCalls();
      expect(rosterRows.size).toBe(0);
    });
  });

  describe('GET /api/collaboration/roster', () => {
    it('answers an empty roster with the owner choices for a new owner', async () => {
      const response = await http().get('/api/collaboration/roster').expect(200);
      expect(response.body).toEqual({
        members: [],
        choices: [
          { id: 'product-strategy', kind: 'system', name: 'Product Strategy', usable: true, reason: null },
          { id: 'technology-advisor', kind: 'system', name: 'Technology Advisor', usable: true, reason: null },
          { id: WF_MINE, kind: 'workflow', name: 'Mine', usable: true, reason: null },
        ],
      });
      expect(rosterRepo.findOne).toHaveBeenCalledWith({ where: { userId: OWNER } });
      expect(userAgents.listByUserId).toHaveBeenCalledWith(OWNER);
    });
  });

  describe('PUT /api/collaboration/roster', () => {
    it('saves the roster, answers the GET body, and GET reads it back', async () => {
      const put = await http()
        .put('/api/collaboration/roster')
        .send({ memberIds: [WF_MINE, 'technology-advisor'] })
        .expect(200);
      expect(put.body.members).toEqual([
        { id: WF_MINE, kind: 'workflow', name: 'Mine', usable: true, reason: null },
        { id: 'technology-advisor', kind: 'system', name: 'Technology Advisor', usable: true, reason: null },
      ]);
      expect(rosterRows.get(OWNER)?.memberIds).toEqual([WF_MINE, 'technology-advisor']);
      const get = await http().get('/api/collaboration/roster').expect(200);
      expect(get.body).toEqual(put.body);
    });

    it.each([
      ['no body', undefined, ROSTER_REFUSAL_CODES.invalidBody],
      ['a list body', [], ROSTER_REFUSAL_CODES.invalidBody],
      ['memberIds missing', {}, ROSTER_REFUSAL_CODES.invalidBody],
      ['an extra key', { memberIds: [], userId: OTHER }, ROSTER_REFUSAL_CODES.invalidBody],
      ['instructions in the body', { memberIds: ['product-strategy'], instructions: 'x' }, ROSTER_REFUSAL_CODES.invalidBody],
      ['memberIds not a list', { memberIds: 'product-strategy' }, ROSTER_REFUSAL_CODES.invalidBody],
      ['a fourth member', { memberIds: ['product-strategy', 'technology-advisor', WF_MINE, WF_NONE] }, ROSTER_REFUSAL_CODES.tooMany],
      ['a duplicate', { memberIds: [WF_MINE, WF_MINE] }, ROSTER_REFUSAL_CODES.duplicate],
      ['the Chief of Staff', { memberIds: ['chief-of-staff'] }, ROSTER_REFUSAL_CODES.notAllowed],
      ['a coding role', { memberIds: ['writer'] }, ROSTER_REFUSAL_CODES.notAllowed],
      ['an unknown id', { memberIds: ['nobody'] }, ROSTER_REFUSAL_CODES.unknown],
    ])('answers 400 for %s and saves nothing', async (_label, body, code) => {
      rosterRows.set(OWNER, { userId: OWNER, memberIds: ['product-strategy'], updatedAt: new Date(0) });
      const req = http().put('/api/collaboration/roster');
      const response = await (body === undefined ? req : req.send(body as object)).expect(400);
      expect(response.body.code).toBe(code);
      expect(response.body.statusCode).toBe(400);
      expect(rosterRepo.upsert).not.toHaveBeenCalled();
      expect(rosterRows.get(OWNER)?.memberIds).toEqual(['product-strategy']);
    });

    it('answers another owner workflow exactly as a missing one (no existence leak) and saves nothing', async () => {
      const theirs = await http()
        .put('/api/collaboration/roster')
        .send({ memberIds: [WF_THEIRS] })
        .expect(400);
      const none = await http()
        .put('/api/collaboration/roster')
        .send({ memberIds: [WF_NONE] })
        .expect(400);
      expect(theirs.body).toEqual({
        statusCode: 400,
        message: 'Workflow not found',
        error: 'Bad Request',
        code: ROSTER_REFUSAL_CODES.notFound,
        memberId: WF_THEIRS,
      });
      expect({ ...theirs.body, memberId: null }).toEqual({ ...none.body, memberId: null });
      expect(userAgents.findOneByIdAndUserId).toHaveBeenCalledWith(WF_THEIRS, OWNER);
      expect(rosterRepo.upsert).not.toHaveBeenCalled();
    });

    it('is owner-scoped: one owner never reads or writes another owner roster', async () => {
      await http()
        .put('/api/collaboration/roster')
        .send({ memberIds: [WF_MINE] })
        .expect(200);
      const other = await http({ userId: OTHER }).get('/api/collaboration/roster').expect(200);
      expect(other.body.members).toEqual([]);
      expect(other.body.choices.map((choice: { id: string }) => choice.id)).toEqual([
        'product-strategy',
        'technology-advisor',
        WF_THEIRS,
      ]);

      await http({ userId: OTHER })
        .put('/api/collaboration/roster')
        .send({ memberIds: ['product-strategy'] })
        .expect(200);
      expect(rosterRows.get(OWNER)?.memberIds).toEqual([WF_MINE]);
      expect(rosterRows.get(OTHER)?.memberIds).toEqual(['product-strategy']);
      for (const call of rosterRepo.upsert.mock.calls) {
        expect([OWNER, OTHER]).toContain(call[0].userId);
      }
      expect(rosterRepo.upsert.mock.calls.map((call) => call[0].userId)).toEqual([OWNER, OTHER]);
    });
  });
});
