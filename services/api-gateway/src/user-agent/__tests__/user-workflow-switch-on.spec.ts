import { HttpException, Module, ServiceUnavailableException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserAgent } from '../../entities/user-agent.entity';
import { ConnectorConnection } from '../../entities/connector-connection.entity';
import { CreditDeductionRecord } from '../../entities/credit-deduction-record.entity';
import {
  CollaborationWorkflowService,
  renderWorkflow,
} from '../../orchestration/collaboration-workflow';
import { CollaborationRunEntity } from '../../orchestration/collaboration-run.entity';
import { CollaborationReferralEntity } from '../../orchestration/collaboration-referral.entity';
import { UserAgentModule } from '../user-agent.module';
import { UserAgentService } from '../user-agent.service';
import { USER_WORKFLOW_SWITCH_ON_CHECK } from '../user-workflow-switch-on.port';
import {
  TestedWorkflowSwitchOnCheck,
  assertWorkflowCanSwitchOn,
} from '../user-workflow-switch-on';

/** WORKFLOW-STATUS-02: the server-side switch-on check and its wiring. */
describe('WORKFLOW-STATUS-02 user workflow switch-on check', () => {
  const ownerUserId = 'user-a-uuid-111';
  const agentId = 'agent-uuid-001';

  const row = (overrides: Record<string, unknown> = {}): UserAgent =>
    ({
      id: agentId,
      userId: ownerUserId,
      name: 'Morning helper',
      role: 'Briefs me',
      description: 'Card text',
      status: 'draft',
      initials: 'MH',
      tone: null,
      replyLanguage: null,
      purpose: 'Help me.',
      procedure: 'Read the folder.',
      result: 'A short note.',
      toolProfile: 'read',
      knowledgeScopeIds: ['policies'],
      connectorToolIds: [],
      model: { choice: 'server' },
      budgetPerRunCredits: null,
      budgetPerDayCredits: null,
      templateId: null,
      ...overrides,
    }) as unknown as UserAgent;

  const refusalOf = async (promise: Promise<unknown>): Promise<HttpException> => {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      return error as HttpException;
    }
    throw new Error('expected a refusal');
  };

  describe('assertWorkflowCanSwitchOn (the Team gate rule)', () => {
    it('refuses with 409 WORKFLOW_NOT_TESTED when no version was tested', async () => {
      const refusal = await refusalOf(
        assertWorkflowCanSwitchOn(ownerUserId, row(), async () => ({ testedVersions: new Set() })),
      );
      expect(refusal.getStatus()).toBe(409);
      expect(refusal.getResponse()).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        code: 'WORKFLOW_NOT_TESTED',
      });
    });

    it('allows the switch when the rendered version has a completed test run', async () => {
      const version = renderWorkflow(row())!.version;
      const reader = jest.fn(async () => ({ testedVersions: new Set([version]) }));
      await expect(assertWorkflowCanSwitchOn(ownerUserId, row(), reader)).resolves.toBeUndefined();
      expect(reader).toHaveBeenCalledWith(ownerUserId, agentId);
    });

    it('refuses when only another version was tested', async () => {
      const older = renderWorkflow(row({ result: 'A longer note.' }))!.version;
      const refusal = await refusalOf(
        assertWorkflowCanSwitchOn(ownerUserId, row(), async () => ({
          testedVersions: new Set([older]),
        })),
      );
      expect(refusal.getResponse()).toMatchObject({ code: 'WORKFLOW_NOT_TESTED' });
    });

    it('refuses a row that cannot render with 409 WORKFLOW_INVALID, without reading test runs', async () => {
      const reader = jest.fn();
      const refusal = await refusalOf(
        assertWorkflowCanSwitchOn(
          ownerUserId,
          row({ model: { choice: 'platform', id: 'not-a-platform-model' } }),
          reader,
        ),
      );
      expect(refusal.getStatus()).toBe(409);
      expect(refusal.getResponse()).toMatchObject({ code: 'WORKFLOW_INVALID' });
      expect(reader).not.toHaveBeenCalled();
    });
  });

  describe('TestedWorkflowSwitchOnCheck', () => {
    it('reads the tested versions from the application CollaborationWorkflowService, looked up once', async () => {
      const version = renderWorkflow(row())!.version;
      const workflows = {
        usageFor: jest.fn(async () => ({ testedVersions: new Set([version]) })),
      };
      const moduleRef = { get: jest.fn(() => workflows) };
      const check = new TestedWorkflowSwitchOnCheck(moduleRef as unknown as ModuleRef);

      await check.assertCanSwitchOn(ownerUserId, row());
      await check.assertCanSwitchOn(ownerUserId, row());

      expect(moduleRef.get).toHaveBeenCalledTimes(1);
      expect(moduleRef.get).toHaveBeenCalledWith(CollaborationWorkflowService, { strict: false });
      expect(workflows.usageFor).toHaveBeenCalledWith(ownerUserId, agentId);
    });

    it.each([
      ['throws', () => {
        throw new Error('unknown element');
      }],
      ['returns nothing', () => undefined],
    ])('fails closed with 503 when the lookup %s', async (_label, lookup) => {
      const check = new TestedWorkflowSwitchOnCheck({ get: jest.fn(lookup) } as unknown as ModuleRef);
      await expect(check.assertCanSwitchOn(ownerUserId, row())).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('is the binding UserAgentModule provides for the port', () => {
      const providers = Reflect.getMetadata('providers', UserAgentModule) as unknown[];
      expect(providers).toContainEqual({
        provide: USER_WORKFLOW_SWITCH_ON_CHECK,
        useClass: TestedWorkflowSwitchOnCheck,
      });
    });
  });

  describe('Nest wiring as in production (orchestration imports user-agent)', () => {
    const rows = new Map<string, UserAgent>();
    const referrals: Record<string, unknown>[] = [];
    const runs = new Map<string, Record<string, unknown>>();

    const userAgentRepository = {
      findOne: jest.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        const stored = rows.get(where.id);
        return stored && stored.userId === where.userId ? { ...stored } : null;
      }),
      save: jest.fn(async (value: UserAgent) => {
        rows.set(value.id, { ...value });
        return { ...value };
      }),
    };

    @Module({
      providers: [
        UserAgentService,
        { provide: USER_WORKFLOW_SWITCH_ON_CHECK, useClass: TestedWorkflowSwitchOnCheck },
        { provide: getRepositoryToken(UserAgent), useValue: userAgentRepository },
        { provide: getRepositoryToken(ConnectorConnection), useValue: { find: async () => [] } },
      ],
      exports: [UserAgentService],
    })
    class TestUserAgentModule {}

    // CollaborationWorkflowService is provided here and not exported, like OrchestrationModule.
    @Module({
      imports: [TestUserAgentModule],
      providers: [
        CollaborationWorkflowService,
        {
          provide: getRepositoryToken(CollaborationRunEntity),
          useValue: {
            findOne: async ({ where }: { where: { collaborationRunId: string } }) =>
              runs.get(where.collaborationRunId) ?? null,
          },
        },
        {
          provide: getRepositoryToken(CollaborationReferralEntity),
          useValue: { find: async () => referrals.map((referral) => ({ ...referral })) },
        },
        { provide: getRepositoryToken(CreditDeductionRecord), useValue: { find: async () => [] } },
      ],
    })
    class TestOrchestrationModule {}

    it('refuses an untested switch-on, then allows it after a completed test run at the version', async () => {
      rows.set(agentId, row());
      const app = await Test.createTestingModule({ imports: [TestOrchestrationModule] }).compile();
      const service = app.get(UserAgentService, { strict: false });

      const refusal = await refusalOf(service.update(agentId, ownerUserId, { status: 'active' }));
      expect(refusal.getStatus()).toBe(409);
      expect(refusal.getResponse()).toMatchObject({ code: 'WORKFLOW_NOT_TESTED' });
      expect(rows.get(agentId)!.status).toBe('draft');

      // A test run by another owner does not count.
      const version = renderWorkflow(row())!.version;
      runs.set('run-other', { collaborationRunId: 'run-other', userId: 'someone-else' });
      referrals.push({
        referralId: 'ref-other',
        collaborationRunId: 'run-other',
        targetBuilderProfileId: agentId,
        status: 'completed',
        executionId: null,
        completedAt: '2026-11-10T01:00:00.000Z',
        updatedAt: '2026-11-10T01:00:00.000Z',
        pendingJob: { workflow: { id: agentId, version, testRun: true } },
      });
      await expect(
        service.update(agentId, ownerUserId, { status: 'active' }),
      ).rejects.toMatchObject({ status: 409 });

      runs.set('run-1', { collaborationRunId: 'run-1', userId: ownerUserId });
      referrals.push({
        referralId: 'ref-1',
        collaborationRunId: 'run-1',
        targetBuilderProfileId: agentId,
        status: 'completed',
        executionId: null,
        completedAt: '2026-11-10T02:00:00.000Z',
        updatedAt: '2026-11-10T02:00:00.000Z',
        pendingJob: { workflow: { id: agentId, version, testRun: true } },
      });
      const saved = await service.update(agentId, ownerUserId, { status: 'active' });
      expect(saved.status).toBe('active');
      expect(rows.get(agentId)!.status).toBe('active');

      await app.close();
    });
  });
});
