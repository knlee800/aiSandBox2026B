import { HttpException, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { FindOperator } from 'typeorm';
import { createHarnessEntitlementProof } from '../ai/ai-execution.controller';
import { ExecutionResultService } from '../ai/execution-result.service';
import { isConnectorCallGranted } from '../connectors/connector-grant-token';
import { CALENDAR_TOOL_ID, MAIL_TOOL, MAIL_TOOL_ID } from '../connectors/connector-servers';
import { ConnectorConnection } from '../entities/connector-connection.entity';
import { CreditDeductionRecord } from '../entities/credit-deduction-record.entity';
import { QueueService } from '../queue/queue.service';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import {
  agentVersionFor,
  renderAgentInstructions,
  systemAgentById,
  systemAgentVersion,
} from '../system-agents/system-agent-registry';
import { UserAgentService } from '../user-agent/user-agent.service';
import { USER_WORKFLOW_RULES } from '../user-agent/user-workflow-rules';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { CollaborationRunEntity } from './collaboration-run.entity';
import { knowledgeScopesJobFields } from './collaboration-tool-profile';
import {
  CollaborationWorkflowService,
  WORKFLOW_REFUSAL_CODES,
  autoApprovalDecisionReason,
  autoApprovalTargetIsReadOnly,
  connectorToolIdsAreReadOnly,
  readAutoApprovalDecision,
  readPendingAutoApproval,
  renderWorkflow,
  resolveWorkflowProviderModel,
  workflowBudgetRefusal,
  workflowKnowledgeScopeIds,
  workflowNormalRunAllowed,
  workflowRefusal,
  workflowStatus,
  workflowVersion,
  type WorkflowRow,
} from './collaboration-workflow';
import type { ReferralPendingWorkflow } from './orchestration.contracts';
import { OrchestrationService } from './orchestration.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const WORKFLOW_ID = 'f0f0f0f0-0000-4000-8000-000000000001';
const KEY = randomBytes(32).toString('base64');
const HARNESS_SECRET = 'test-hmac-secret-biz-user-01c';

function chiefOfStaff() {
  const found = systemAgentById('chief-of-staff');
  if (!found) {
    throw new Error('missing chief-of-staff');
  }
  return found;
}

/** A row as BIZ-USER-01A's copy of the Chief of Staff stores it. */
function copiedRow(overrides: Partial<WorkflowRow> = {}): WorkflowRow & { userId: string } {
  const cos = chiefOfStaff();
  return {
    id: WORKFLOW_ID,
    userId: OWNER,
    name: 'Morning brief',
    role: 'Assistant',
    status: 'active',
    tone: cos.tone,
    replyLanguage: cos.replyLanguage,
    purpose: cos.purpose,
    procedure: cos.procedure,
    result: cos.result,
    knowledgeScopeIds: cos.knowledgeScopes.map((scope) => scope.id),
    connectorToolIds: [...cos.connectorToolIds],
    model: { choice: 'server' },
    budgetPerRunCredits: null,
    budgetPerDayCredits: null,
    ...overrides,
  };
}

function matches(row: unknown, where?: Record<string, unknown>): boolean {
  if (!where) {
    return true;
  }
  const record = row as Record<string, unknown>;
  return Object.entries(where).every(([key, expected]) => {
    if (expected instanceof FindOperator) {
      const values = expected.value as unknown[];
      return expected.type === 'in' && values.includes(record[key]);
    }
    return record[key] === expected;
  });
}

function mapRepo<T>(store: Map<string, T>, pk: string) {
  const copy = (row: T): T => structuredClone(row);
  const repo = {
    findOne: async ({ where }: { where: Record<string, unknown> }) => {
      for (const row of store.values()) if (matches(row, where)) return copy(row);
      return null;
    },
    find: jest.fn(async (opts: { where?: Record<string, unknown> } = {}) =>
      [...store.values()].filter((row) => matches(row, opts.where)).map(copy),
    ),
    save: async (entity: T) => {
      store.set(String((entity as Record<string, unknown>)[pk]), copy(entity));
      return copy(entity);
    },
    update: async (criteria: Record<string, unknown>, partial: Record<string, unknown>) => {
      let affected = 0;
      for (const [key, row] of store) {
        if (matches(row, criteria)) {
          store.set(key, { ...(row as object), ...partial } as T);
          affected += 1;
        }
      }
      return { affected, raw: [], generatedMaps: [] };
    },
    manager: undefined as unknown,
  };
  return repo;
}

function refusalBody(error: unknown): Record<string, unknown> {
  expect(error).toBeInstanceOf(HttpException);
  return (error as HttpException).getResponse() as Record<string, unknown>;
}

describe('BIZ-USER-01C workflow helpers', () => {
  it('renders the copied row to the Chief of Staff prompt with the platform rules', () => {
    const rendered = renderWorkflow(copiedRow());
    expect(rendered).not.toBeNull();
    expect(rendered?.spec.rules).toBe(USER_WORKFLOW_RULES);
    expect(rendered?.instructions).toBe(renderAgentInstructions({ ...rendered!.spec }));
    expect(rendered?.instructions).toBe(chiefOfStaff().instructions);
    expect(rendered?.knowledgeScopeIds).toEqual(
      chiefOfStaff().knowledgeScopes.map((scope) => scope.id),
    );
    expect(rendered?.connectorToolIds).toEqual([MAIL_TOOL_ID, CALENDAR_TOOL_ID]);
  });

  it('refuses a row whose spec, length or model cannot run', () => {
    expect(renderWorkflow(copiedRow({ purpose: 'bad\u0001part' }))).toBeNull();
    expect(renderWorkflow(copiedRow({ purpose: 'x'.repeat(4001) }))).toBeNull();
    expect(
      renderWorkflow(copiedRow({ model: { choice: 'platform', id: 'gpt-4o' } as never })),
    ).toBeNull();
    expect(renderWorkflow(copiedRow({ model: { choice: 'other' } as never }))).toBeNull();
  });

  it('hashes with the registry function: the Chief of Staff material with no team role', () => {
    const cos = chiefOfStaff();
    const viaWorkflow = workflowVersion({
      id: cos.id,
      spec: {
        tone: cos.tone,
        replyLanguage: cos.replyLanguage,
        purpose: cos.purpose,
        procedure: cos.procedure,
        result: cos.result,
        rules: USER_WORKFLOW_RULES,
      },
      instructions: cos.instructions,
      knowledgeScopeIds: cos.knowledgeScopes.map((scope) => scope.id),
      connectorToolIds: cos.connectorToolIds,
      model: cos.model,
    });
    const viaRegistry = agentVersionFor({
      id: cos.id,
      tone: cos.tone,
      replyLanguage: cos.replyLanguage,
      purpose: cos.purpose,
      procedure: cos.procedure,
      result: cos.result,
      rules: cos.rules,
      instructions: cos.instructions,
      toolProfile: cos.toolProfile,
      scopes: cos.knowledgeScopes,
      connectorToolIds: cos.connectorToolIds,
      model: cos.model,
      teamRole: null,
    });
    expect(viaWorkflow).toBe(viaRegistry);
    // With its team role the registry function gives the pinned system-agent version.
    expect(
      agentVersionFor({
        id: cos.id,
        tone: cos.tone,
        replyLanguage: cos.replyLanguage,
        purpose: cos.purpose,
        procedure: cos.procedure,
        result: cos.result,
        rules: cos.rules,
        instructions: cos.instructions,
        toolProfile: cos.toolProfile,
        scopes: cos.knowledgeScopes,
        connectorToolIds: cos.connectorToolIds,
        model: cos.model,
        teamRole: cos.teamRole,
      }),
    ).toBe(systemAgentVersion('chief-of-staff'));
  });

  it('changes the version when any material field of the row changes', () => {
    const base = renderWorkflow(copiedRow())!.version;
    const variants: Array<Partial<WorkflowRow>> = [
      { id: 'f0f0f0f0-0000-4000-8000-000000000002' },
      { tone: 'Plain' },
      { replyLanguage: 'zh-TW' },
      { purpose: 'Something else.' },
      { procedure: 'Do it differently.' },
      { result: 'Return a table.' },
      { knowledgeScopeIds: ['policies'] },
      { connectorToolIds: [MAIL_TOOL_ID] },
      { model: { choice: 'platform', id: 'claude-haiku-5-5' } },
    ];
    const seen = new Set<string>([base]);
    for (const variant of variants) {
      const version = renderWorkflow(copiedRow(variant))!.version;
      expect(version).not.toBe(base);
      seen.add(version);
    }
    expect(seen.size).toBe(variants.length + 1);
    // Name, role, status and budgets are not in the material.
    for (const same of [
      { name: 'Other' },
      { role: 'Other' },
      { status: 'draft' },
      { budgetPerRunCredits: 5, budgetPerDayCredits: 50 },
    ]) {
      expect(renderWorkflow(copiedRow(same))!.version).toBe(base);
    }
  });

  it('keeps catalogue scope ids only, in catalogue order', () => {
    expect(workflowKnowledgeScopeIds(['contract-templates', 'policies', 'nope', 'policies'])).toEqual(
      ['policies', 'contract-templates'],
    );
    expect(workflowKnowledgeScopeIds('policies')).toEqual([]);
  });

  it('reads an unknown status as disabled', () => {
    expect(workflowStatus('active')).toBe('active');
    expect(workflowStatus('draft')).toBe('draft');
    expect(workflowStatus('disabled')).toBe('disabled');
    expect(workflowStatus('on')).toBe('disabled');
    expect(workflowStatus(undefined)).toBe('disabled');
  });

  it('allows a normal run only when active and tested at the current version', () => {
    const tested = { testedVersions: new Set(['v1']) };
    expect(workflowNormalRunAllowed('active', 'v1', tested)).toBe(true);
    expect(workflowNormalRunAllowed('active', 'v2', tested)).toBe(false);
    expect(workflowNormalRunAllowed('draft', 'v1', tested)).toBe(false);
    expect(workflowNormalRunAllowed('disabled', 'v1', tested)).toBe(false);
  });

  it('refuses the day budget at spent >= budget and the run budget when the last run cost more', () => {
    const day = workflowBudgetRefusal(
      { budgetPerRunCredits: null, budgetPerDayCredits: 20 },
      { spentTodayCredits: 20, lastRunCredits: null },
    );
    expect(day?.getStatus()).toBe(429);
    expect(refusalBody(day)).toMatchObject({ code: 'WORKFLOW_BUDGET_DAY', budget: 20, spent: 20 });
    expect(
      workflowBudgetRefusal(
        { budgetPerRunCredits: null, budgetPerDayCredits: 20 },
        { spentTodayCredits: 19, lastRunCredits: null },
      ),
    ).toBeNull();

    const run = workflowBudgetRefusal(
      { budgetPerRunCredits: 10, budgetPerDayCredits: null },
      { spentTodayCredits: 0, lastRunCredits: 11 },
    );
    expect(run?.getStatus()).toBe(409);
    expect(refusalBody(run)).toMatchObject({ code: 'WORKFLOW_BUDGET_RUN', budget: 10, lastRun: 11 });
    expect(
      workflowBudgetRefusal(
        { budgetPerRunCredits: 10, budgetPerDayCredits: null },
        { spentTodayCredits: 0, lastRunCredits: 10 },
      ),
    ).toBeNull();
    expect(
      workflowBudgetRefusal(
        { budgetPerRunCredits: 10, budgetPerDayCredits: null },
        { spentTodayCredits: 0, lastRunCredits: null },
      ),
    ).toBeNull();
    // NULL budgets never refuse.
    expect(
      workflowBudgetRefusal(
        { budgetPerRunCredits: null, budgetPerDayCredits: null },
        { spentTodayCredits: 10_000, lastRunCredits: 10_000 },
      ),
    ).toBeNull();
  });

  it('gives each refusal code a stable status', () => {
    const statuses = Object.values(WORKFLOW_REFUSAL_CODES).map((code) => [
      code,
      workflowRefusal(code).getStatus(),
    ]);
    expect(statuses).toEqual([
      ['WORKFLOW_NOT_FOUND', 404],
      ['WORKFLOW_DISABLED', 409],
      ['WORKFLOW_INVALID', 409],
      ['WORKFLOW_NOT_TESTED', 409],
      ['WORKFLOW_BUDGET_DAY', 429],
      ['WORKFLOW_BUDGET_RUN', 409],
    ]);
  });

  it('runs a platform model on anthropic with that id and keeps the env for the server choice', () => {
    const originalProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = 'stub';
    try {
      expect(resolveWorkflowProviderModel({ choice: 'platform', id: 'claude-haiku-5-5' })).toEqual({
        provider: 'anthropic',
        model: 'claude-haiku-5-5',
      });
      expect(resolveWorkflowProviderModel({ choice: 'server' })).toEqual({
        provider: 'stub',
        model: 'stub',
      });
      expect(() =>
        resolveWorkflowProviderModel({ choice: 'platform', id: 'gpt-4o' } as never),
      ).toThrow(HttpException);
      const spy = jest.spyOn(KillSwitchConfig, 'isProviderEnabled').mockReturnValue(false);
      try {
        let caught: unknown;
        try {
          resolveWorkflowProviderModel({ choice: 'platform', id: 'claude-haiku-5-5' });
        } catch (error) {
          caught = error;
        }
        expect((caught as HttpException).getStatus()).toBe(503);
      } finally {
        spy.mockRestore();
      }
    } finally {
      if (originalProvider === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = originalProvider;
    }
  });
});

describe('BIZ-USER-01C CollaborationWorkflowService', () => {
  let rowsById: Map<string, WorkflowRow & { userId: string }>;
  let runs: Map<string, Record<string, unknown>>;
  let referrals: Map<string, Record<string, unknown>>;
  let deductions: Map<string, Record<string, unknown>>;
  let service: CollaborationWorkflowService;
  let deductionRepo: ReturnType<typeof mapRepo<Record<string, unknown>>>;

  beforeEach(() => {
    rowsById = new Map([[WORKFLOW_ID, copiedRow()]]);
    runs = new Map();
    referrals = new Map();
    deductions = new Map();
    const userAgents = {
      findOneByIdAndUserId: async (id: string, userId: string) => {
        const row = rowsById.get(id);
        return row && row.userId === userId ? { ...row } : null;
      },
      listByUserId: async (userId: string) =>
        [...rowsById.values()].filter((row) => row.userId === userId).map((row) => ({ ...row })),
    };
    deductionRepo = mapRepo(deductions, 'id');
    service = new CollaborationWorkflowService(
      userAgents as unknown as UserAgentService,
      mapRepo(runs, 'collaborationRunId') as never,
      mapRepo(referrals, 'referralId') as never,
      deductionRepo as never,
    );
  });

  function addRun(id: string, userId = OWNER) {
    runs.set(id, { collaborationRunId: id, userId });
  }

  function addReferral(input: {
    id: string;
    runId: string;
    status: string;
    version: string;
    testRun: boolean;
    executionId?: string | null;
    completedAt?: string;
    target?: string;
  }) {
    const workflow: Partial<ReferralPendingWorkflow> = {
      id: input.target ?? WORKFLOW_ID,
      version: input.version,
      testRun: input.testRun,
    };
    referrals.set(input.id, {
      referralId: input.id,
      collaborationRunId: input.runId,
      targetBuilderProfileId: input.target ?? WORKFLOW_ID,
      status: input.status,
      executionId: input.executionId ?? null,
      completedAt: input.completedAt ?? '2026-11-10T01:00:00.000Z',
      updatedAt: input.completedAt ?? '2026-11-10T01:00:00.000Z',
      pendingJob: { workflow },
    });
  }

  function addDeduction(executionId: string, credits: number, createdAt: string, ownerId = OWNER) {
    deductions.set(executionId, {
      id: executionId,
      ownerId,
      sourceEventId: executionId,
      requestedCredits: credits,
      createdAt,
    });
  }

  it('starts a test run of an untested workflow and refuses a normal one', async () => {
    const started = await service.prepareStart({
      userId: OWNER,
      workflowId: WORKFLOW_ID,
      testRun: true,
    });
    const rendered = renderWorkflow(copiedRow())!;
    expect(started.builderProfileId).toBe(WORKFLOW_ID);
    expect(started.agents).toEqual([{ name: WORKFLOW_ID, instructions: rendered.instructions }]);
    expect(started.workflow).toEqual({
      id: WORKFLOW_ID,
      name: 'Morning brief',
      version: rendered.version,
      knowledgeScopeIds: rendered.knowledgeScopeIds,
      connectorToolIds: [MAIL_TOOL_ID, CALENDAR_TOOL_ID],
      model: { choice: 'server' },
      testRun: true,
      budgetPerRunCredits: null,
      budgetPerDayCredits: null,
    });
    await expect(
      service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: false }),
    ).rejects.toMatchObject({ response: { code: 'WORKFLOW_NOT_TESTED' } });
  });

  it('refuses another owner, a disabled row and an invalid row, in that order', async () => {
    await expect(
      service.prepareStart({ userId: OTHER, workflowId: WORKFLOW_ID, testRun: true }),
    ).rejects.toMatchObject({ status: 404, response: { code: 'WORKFLOW_NOT_FOUND' } });
    rowsById.set(WORKFLOW_ID, copiedRow({ status: 'disabled', purpose: 'bad\u0001' }));
    await expect(
      service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: true }),
    ).rejects.toMatchObject({ status: 409, response: { code: 'WORKFLOW_DISABLED' } });
    rowsById.set(WORKFLOW_ID, copiedRow({ purpose: 'bad\u0001' }));
    await expect(
      service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: true }),
    ).rejects.toMatchObject({ status: 409, response: { code: 'WORKFLOW_INVALID' } });
  });

  it('counts a completed test run at the current version as tested; an older version or a failed run does not', async () => {
    const current = renderWorkflow(copiedRow())!.version;
    addRun('run-1');
    addReferral({ id: 'ref-old', runId: 'run-1', status: 'completed', version: 'old', testRun: true });
    addReferral({ id: 'ref-failed', runId: 'run-1', status: 'failed', version: current, testRun: true });
    addReferral({ id: 'ref-normal', runId: 'run-1', status: 'completed', version: current, testRun: false });
    await expect(
      service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: false }),
    ).rejects.toMatchObject({ response: { code: 'WORKFLOW_NOT_TESTED' } });

    // Another owner's run with the same target never counts.
    addRun('run-foreign', OTHER);
    addReferral({ id: 'ref-foreign', runId: 'run-foreign', status: 'completed', version: current, testRun: true });
    await expect(
      service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: false }),
    ).rejects.toMatchObject({ response: { code: 'WORKFLOW_NOT_TESTED' } });

    addReferral({ id: 'ref-tested', runId: 'run-1', status: 'completed', version: current, testRun: true });
    const started = await service.prepareStart({
      userId: OWNER,
      workflowId: WORKFLOW_ID,
      testRun: false,
    });
    expect(started.workflow.testRun).toBe(false);

    // A draft is tested too but may only test-run.
    rowsById.set(WORKFLOW_ID, copiedRow({ status: 'draft' }));
    await expect(
      service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: false }),
    ).rejects.toMatchObject({ response: { code: 'WORKFLOW_NOT_TESTED' } });
    await expect(
      service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: true }),
    ).resolves.toBeDefined();
  });

  it("sums today's credits of this workflow's executions and reads the last completed run's cost", async () => {
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 30),
    ).toISOString();
    const yesterday = new Date(Date.parse(today) - 24 * 60 * 60 * 1000).toISOString();
    addRun('run-1');
    addReferral({
      id: 'ref-a',
      runId: 'run-1',
      status: 'completed',
      version: 'v',
      testRun: true,
      executionId: 'exec-a',
      completedAt: yesterday,
    });
    addReferral({
      id: 'ref-b',
      runId: 'run-1',
      status: 'completed',
      version: 'v',
      testRun: false,
      executionId: 'exec-b',
      completedAt: today,
    });
    addReferral({
      id: 'ref-c',
      runId: 'run-1',
      status: 'failed',
      version: 'v',
      testRun: false,
      executionId: 'exec-c',
      completedAt: today,
    });
    addDeduction('exec-a', 7, yesterday);
    addDeduction('exec-b', 12, today);
    addDeduction('exec-c', 3, today);
    // Not this workflow's execution, and another owner's record.
    addDeduction('exec-other', 100, today);
    addDeduction('exec-b-foreign', 100, today, OTHER);

    const usage = await service.usageFor(OWNER, WORKFLOW_ID, now);
    expect(usage.spentTodayCredits).toBe(15);
    expect(usage.lastRunCredits).toBe(12);
    expect(usage.testedVersions).toEqual(new Set(['v']));
    expect(usage.lastTestRunAt).toBe(yesterday);
    expect(deductionRepo.find).toHaveBeenCalledTimes(1);
    const where = deductionRepo.find.mock.calls[0][0]!.where as Record<string, unknown>;
    expect(where.ownerId).toBe(OWNER);

    rowsById.set(WORKFLOW_ID, copiedRow({ budgetPerDayCredits: 15 }));
    await expect(
      service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: true }),
    ).rejects.toMatchObject({
      status: 429,
      response: { code: 'WORKFLOW_BUDGET_DAY', budget: 15, spent: 15 },
    });
    rowsById.set(WORKFLOW_ID, copiedRow({ budgetPerRunCredits: 11, budgetPerDayCredits: 100 }));
    await expect(
      service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: true }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'WORKFLOW_BUDGET_RUN', budget: 11, lastRun: 12 },
    });
    rowsById.set(WORKFLOW_ID, copiedRow({ budgetPerRunCredits: 12, budgetPerDayCredits: 16 }));
    await expect(
      service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: true }),
    ).resolves.toBeDefined();
  });

  it('a workflow with no history reads zero spent and no last run without a credit query', async () => {
    const usage = await service.usageFor(OWNER, WORKFLOW_ID);
    expect(usage).toEqual({
      testedVersions: new Set(),
      lastTestRunAt: null,
      spentTodayCredits: 0,
      lastRunCredits: null,
    });
    expect(deductionRepo.find).not.toHaveBeenCalled();
  });

  it('re-checks at approve: a removed or disabled row, a draft normal run, and the budgets', async () => {
    const snapshot = (
      await service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: true })
    ).workflow;
    await expect(service.assertCanApprove(OWNER, snapshot)).resolves.toBeUndefined();
    await expect(service.assertCanApprove(OTHER, snapshot)).rejects.toMatchObject({
      response: { code: 'WORKFLOW_DISABLED' },
    });
    rowsById.set(WORKFLOW_ID, copiedRow({ status: 'disabled' }));
    await expect(service.assertCanApprove(OWNER, snapshot)).rejects.toMatchObject({
      response: { code: 'WORKFLOW_DISABLED' },
    });
    rowsById.set(WORKFLOW_ID, copiedRow({ status: 'draft' }));
    await expect(service.assertCanApprove(OWNER, snapshot)).resolves.toBeUndefined();
    await expect(
      service.assertCanApprove(OWNER, { ...snapshot, testRun: false }),
    ).rejects.toMatchObject({ response: { code: 'WORKFLOW_NOT_TESTED' } });
    rowsById.delete(WORKFLOW_ID);
    await expect(service.assertCanApprove(OWNER, snapshot)).rejects.toMatchObject({
      response: { code: 'WORKFLOW_DISABLED' },
    });

    rowsById.set(WORKFLOW_ID, copiedRow());
    addRun('run-1');
    addReferral({
      id: 'ref-a',
      runId: 'run-1',
      status: 'completed',
      version: 'v',
      testRun: true,
      executionId: 'exec-a',
      completedAt: new Date().toISOString(),
    });
    addDeduction('exec-a', 9, new Date().toISOString());
    await expect(
      service.assertCanApprove(OWNER, { ...snapshot, budgetPerDayCredits: 9 }),
    ).rejects.toMatchObject({ status: 429, response: { code: 'WORKFLOW_BUDGET_DAY', spent: 9 } });
  });

  it('lists the owner workflows with status, version, tested and spend, and no prompt', async () => {
    rowsById.set(
      'f0f0f0f0-0000-4000-8000-000000000009',
      copiedRow({ id: 'f0f0f0f0-0000-4000-8000-000000000009', userId: OTHER } as never),
    );
    rowsById.set(
      'f0f0f0f0-0000-4000-8000-000000000003',
      copiedRow({
        id: 'f0f0f0f0-0000-4000-8000-000000000003',
        name: 'Broken',
        status: 'draft',
        purpose: 'bad\u0001',
        model: { choice: 'platform', id: 'claude-haiku-5-5' },
      }),
    );
    const current = renderWorkflow(copiedRow())!.version;
    addRun('run-1');
    addReferral({ id: 'ref-t', runId: 'run-1', status: 'completed', version: current, testRun: true });

    const items = await service.listForOwner(OWNER);
    expect(items.map((item) => item.id)).toEqual([
      WORKFLOW_ID,
      'f0f0f0f0-0000-4000-8000-000000000003',
    ]);
    expect(items[0]).toEqual({
      id: WORKFLOW_ID,
      name: 'Morning brief',
      role: 'Assistant',
      status: 'active',
      version: current,
      tested: true,
      lastTestRunAt: '2026-11-10T01:00:00.000Z',
      knowledgeScopeIds: chiefOfStaff().knowledgeScopes.map((scope) => scope.id),
      connectorToolIds: [MAIL_TOOL_ID, CALENDAR_TOOL_ID],
      model: { choice: 'server' },
      budgetPerRunCredits: null,
      budgetPerDayCredits: null,
      spentTodayCredits: 0,
      lastRunCredits: null,
    });
    expect(items[1]).toMatchObject({ status: 'draft', version: null, tested: false, model: null });
    const text = JSON.stringify(items);
    expect(text).not.toContain(chiefOfStaff().purpose);
    expect(text).not.toContain('instructions');
    expect(text).not.toContain('Token');
  });

  describe('USER-TEAMS-01 01A: the stored team at start (D6, D14)', () => {
    const TEAM_WF = 'f0f0f0f0-0000-4000-8000-000000000002';

    it('prepareStart returns the stored team as ids only, and the run is still a team of one', async () => {
      const plain = await service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: true });
      expect(plain.teamMemberIds).toEqual([]);

      rowsById.set(
        WORKFLOW_ID,
        copiedRow({ teamMemberIds: ['product-strategy', TEAM_WF.toUpperCase()] }),
      );
      const withTeam = await service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: true });
      expect(withTeam.teamMemberIds).toEqual(['product-strategy', TEAM_WF]);
      // Nothing evaluated, nothing added: the agent list and the snapshot are today's.
      const { teamMemberIds: _plainTeam, ...plainRest } = plain;
      const { teamMemberIds: _team, ...rest } = withTeam;
      expect(rest).toEqual(plainRest);
      expect(withTeam.agents).toHaveLength(1);
      expect(JSON.stringify(withTeam.workflow)).not.toContain('product-strategy');
    });

    it('reads a damaged stored team fail-closed', async () => {
      rowsById.set(
        WORKFLOW_ID,
        copiedRow({ teamMemberIds: { 0: 'product-strategy' } as unknown as string[] }),
      );
      await expect(
        service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: true }),
      ).resolves.toMatchObject({ teamMemberIds: [] });
      rowsById.set(
        WORKFLOW_ID,
        copiedRow({
          teamMemberIds: ['product-strategy', 7, 'product-strategy', 'technology-advisor', TEAM_WF, 'x'] as never,
        }),
      );
      await expect(
        service.prepareStart({ userId: OWNER, workflowId: WORKFLOW_ID, testRun: true }),
      ).resolves.toMatchObject({ teamMemberIds: ['product-strategy', 'technology-advisor', TEAM_WF] });
    });

    it('the team is not part of the render or the version (DECISION C)', () => {
      const plain = renderWorkflow(copiedRow())!;
      const withTeam = renderWorkflow(copiedRow({ teamMemberIds: ['product-strategy', TEAM_WF] }))!;
      expect(withTeam).toEqual(plain);
      expect(withTeam.version).toBe(plain.version);
    });
  });
});

describe('BIZ-USER-01C workflow jobs (frozen HARNESS_ENTITLEMENT_PROOF_V1)', () => {
  const originalKey = process.env.CONNECTOR_CREDENTIALS_KEY;
  const originalSecret = process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
  let service: OrchestrationService;
  let queue: { enqueueExecution: jest.Mock };
  let connectionRows: Array<{ userId: string; kind: string }>;

  beforeEach(async () => {
    process.env.CONNECTOR_CREDENTIALS_KEY = KEY;
    process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = HARNESS_SECRET;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    connectionRows = [
      { userId: OWNER, kind: 'imap' },
      { userId: OWNER, kind: 'ical' },
    ];
    const connections = {
      find: jest.fn(async (options: { where: { userId: string } }) =>
        connectionRows.filter((row) => row.userId === options.where.userId).map((row) => ({ ...row })),
      ),
    };
    queue = { enqueueExecution: jest.fn().mockResolvedValue(undefined) };
    const runRepo = mapRepo(new Map(), 'collaborationRunId');
    const referralRepo = mapRepo(new Map(), 'referralId');
    const manager = {
      transaction: async <R>(cb: (em: unknown) => Promise<R>) => cb(manager),
      getRepository: (entity: unknown) => (entity === CollaborationRunEntity ? runRepo : referralRepo),
    };
    runRepo.manager = manager;
    referralRepo.manager = manager;
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationService,
        { provide: getRepositoryToken(CollaborationRunEntity), useValue: runRepo },
        { provide: getRepositoryToken(CollaborationReferralEntity), useValue: referralRepo },
        { provide: getRepositoryToken(ConnectorConnection), useValue: connections },
        { provide: getRepositoryToken(CreditDeductionRecord), useValue: { find: jest.fn() } },
        { provide: QueueService, useValue: queue },
        { provide: ExecutionResultService, useValue: { requestCancel: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(OrchestrationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalKey === undefined) delete process.env.CONNECTOR_CREDENTIALS_KEY;
    else process.env.CONNECTOR_CREDENTIALS_KEY = originalKey;
    if (originalSecret === undefined) delete process.env.HARNESS_ENTITLEMENT_HMAC_SECRET;
    else process.env.HARNESS_ENTITLEMENT_HMAC_SECRET = originalSecret;
  });

  function snapshot(overrides: Partial<ReferralPendingWorkflow> = {}): ReferralPendingWorkflow {
    const rendered = renderWorkflow(copiedRow())!;
    return {
      id: WORKFLOW_ID,
      name: 'Morning brief',
      version: rendered.version,
      knowledgeScopeIds: rendered.knowledgeScopeIds,
      connectorToolIds: rendered.connectorToolIds,
      model: { choice: 'server' },
      testRun: true,
      budgetPerRunCredits: null,
      budgetPerDayCredits: null,
      ...overrides,
    };
  }

  async function startJob(input: {
    id: string;
    target: string;
    workflow?: ReferralPendingWorkflow;
  }): Promise<Record<string, unknown>> {
    await service.createCollaborationRun({
      collaborationRunId: `run-${input.id}`,
      userId: OWNER,
      projectId: 'project-01',
      initiatorAgent: { agentRole: 'builder', builderProfileId: 'user' },
    });
    const referral = await service.createReferral({
      referralId: `ref-${input.id}`,
      referralTraceId: `trace-${input.id}`,
      collaborationRunId: `run-${input.id}`,
      sourceBuilder: { agentRole: 'builder', builderProfileId: 'user' },
      targetBuilder: { agentRole: 'builder', builderProfileId: input.target },
      idempotencyKey: `key-${input.id}`,
      pendingJob: {
        sessionId: 'session-01',
        conversationId: 'conv-01',
        apiKeyId: 'apikey-01',
        prompt: 'Brief me.',
        provider: 'stub',
        adapter: 'stub',
        model: null,
        workspaceContext: null,
        globalInstructions: null,
        projectInstructions: null,
        orchestrationPriority: null,
        decidedBy: null,
        decisionReason: null,
        fileAccess: true,
        ...(input.workflow ? { workflow: input.workflow } : {}),
      },
    });
    await service.startReferralExecution({
      referralId: referral.referralId,
      executionId: `exec-${input.id}`,
      sessionId: 'session-01',
      conversationId: 'conv-01',
      userId: OWNER,
      apiKeyId: 'apikey-01',
      prompt: 'Brief me.',
      provider: 'stub',
      adapter: 'stub',
      model: 'stub',
      submittedAt: '2026-11-10T08:00:00.000Z',
    });
    const calls = queue.enqueueExecution.mock.calls;
    return calls[calls.length - 1][0] as Record<string, unknown>;
  }

  it('signs a workflow job with exactly the key set of a chief-of-staff job, and no agentId', async () => {
    const cosJob = await startJob({ id: 'cos', target: 'chief-of-staff' });
    const workflowJob = await startJob({ id: 'wf', target: WORKFLOW_ID, workflow: snapshot() });

    expect(Object.keys(workflowJob).sort()).toEqual(Object.keys(cosJob).sort());
    expect(workflowJob).not.toHaveProperty('agentId');
    expect(cosJob).not.toHaveProperty('agentId');
    expect(workflowJob).not.toHaveProperty('workflow');
    expect(workflowJob.builderProfileId).toBe(WORKFLOW_ID);
    expect(workflowJob.harnessVersion).toBe('v1');
    expect(workflowJob.harnessToolProfile).toBe('read');
    expect(workflowJob.harnessReadOnly).toBe(true);
    expect(workflowJob.knowledgeScopes).toEqual(
      knowledgeScopesJobFields('chief-of-staff').knowledgeScopes,
    );
    expect(workflowJob.connectorGrants).toEqual([CALENDAR_TOOL_ID, MAIL_TOOL_ID]);

    // The proof covers every key, as for a system role.
    const { harnessEntitlementProof, ...signed } = workflowJob;
    expect(harnessEntitlementProof).toEqual(
      createHarnessEntitlementProof({
        executionId: String(signed.executionId),
        userId: String(signed.userId),
        apiKeyId: String(signed.apiKeyId),
        issuedAt: String(signed.submittedAt),
        payloadWithoutProof: signed,
        secret: HARNESS_SECRET,
      }),
    );
  });

  it('grants stored scopes in catalogue order and only tools whose kind the owner has connected now', async () => {
    connectionRows.splice(1, 1); // the owner disconnected the calendar
    const job = await startJob({
      id: 'narrow',
      target: WORKFLOW_ID,
      workflow: snapshot({
        knowledgeScopeIds: ['contract-templates', 'policies', 'not-a-scope'],
        connectorToolIds: [CALENDAR_TOOL_ID, MAIL_TOOL_ID, 'not_a_tool'],
      }),
    });
    expect(job.knowledgeScopes).toEqual(['policies', 'contract-templates']);
    expect(job.connectorGrants).toEqual([MAIL_TOOL_ID]);
    for (const [toolId, granted] of [
      [MAIL_TOOL_ID, true],
      [CALENDAR_TOOL_ID, false],
      ['not_a_tool', false],
    ] as const) {
      expect(
        isConnectorCallGranted({
          grantToken: job.connectorGrantToken,
          executionId: 'exec-narrow',
          userId: OWNER,
          toolId,
          nowMs: Date.now(),
        }),
      ).toBe(granted);
    }
  });

  it('omits the grant fields when no stored tool has a connection, and scopes when none are stored', async () => {
    connectionRows.length = 0;
    const job = await startJob({
      id: 'none',
      target: WORKFLOW_ID,
      workflow: snapshot({ knowledgeScopeIds: [], connectorToolIds: [MAIL_TOOL_ID] }),
    });
    expect(job).not.toHaveProperty('connectorGrants');
    expect(job).not.toHaveProperty('connectorGrantToken');
    expect(job).not.toHaveProperty('knowledgeScopes');
    expect(job.harnessToolProfile).toBe('read');
    expect(job.harnessReadOnly).toBe(true);
  });

  it('never grants a tool the snapshot does not list, even when the owner has the connection', async () => {
    const job = await startJob({
      id: 'unlisted',
      target: WORKFLOW_ID,
      workflow: snapshot({ connectorToolIds: [] }),
    });
    expect(job).not.toHaveProperty('connectorGrants');
  });

  it('ignores a snapshot whose id is not the target (not a workflow hand-off)', async () => {
    const job = await startJob({
      id: 'mismatch',
      target: 'lead',
      workflow: snapshot({ connectorToolIds: [MAIL_TOOL_ID] }),
    });
    expect(job.builderProfileId).toBe('lead');
    expect(job).not.toHaveProperty('connectorGrants');
    expect(job.knowledgeScopes).toEqual(knowledgeScopesJobFields('lead').knowledgeScopes);
  });
});

describe('APPROVAL-SET-01B auto-approval helpers', () => {
  const memberSnapshot = (overrides: Partial<ReferralPendingWorkflow> = {}): ReferralPendingWorkflow => ({
    id: WORKFLOW_ID,
    name: 'Mail digest',
    version: 'v-1',
    knowledgeScopeIds: [],
    connectorToolIds: [MAIL_TOOL_ID, CALENDAR_TOOL_ID],
    model: { choice: 'server' },
    testRun: false,
    budgetPerRunCredits: null,
    budgetPerDayCredits: null,
    ...overrides,
  });

  it('treats only allowlisted connector tools flagged readOnly as read-only', () => {
    expect(connectorToolIdsAreReadOnly([])).toBe(true);
    expect(connectorToolIdsAreReadOnly([MAIL_TOOL_ID, CALENDAR_TOOL_ID])).toBe(true);
    expect(connectorToolIdsAreReadOnly(['mail_send_message'])).toBe(false);
    expect(connectorToolIdsAreReadOnly([MAIL_TOOL_ID, 'calendar_create_event'])).toBe(false);
    expect(connectorToolIdsAreReadOnly(undefined)).toBe(false);
    expect(connectorToolIdsAreReadOnly(MAIL_TOOL_ID)).toBe(false);
  });

  it('a tool whose readOnly flag is not true is refused by the flag, not by a list', () => {
    const tool = MAIL_TOOL as { readOnly: boolean };
    tool.readOnly = false;
    try {
      expect(connectorToolIdsAreReadOnly([MAIL_TOOL_ID])).toBe(false);
      expect(autoApprovalTargetIsReadOnly(WORKFLOW_ID, memberSnapshot())).toBe(false);
      expect(
        autoApprovalTargetIsReadOnly(WORKFLOW_ID, memberSnapshot({ connectorToolIds: [CALENDAR_TOOL_ID] })),
      ).toBe(true);
    } finally {
      tool.readOnly = true;
    }
  });

  it('positively read-only targets: the read team advisors and a workflow with its own snapshot', () => {
    expect(autoApprovalTargetIsReadOnly('product-strategy', null)).toBe(true);
    expect(autoApprovalTargetIsReadOnly('technology-advisor', null)).toBe(true);
    expect(autoApprovalTargetIsReadOnly(WORKFLOW_ID, memberSnapshot())).toBe(true);
    expect(autoApprovalTargetIsReadOnly(WORKFLOW_ID, memberSnapshot({ connectorToolIds: [] }))).toBe(
      true,
    );
  });

  it('everything else waits: write, review, null profiles, leads, unknown ids and foreign snapshots', () => {
    for (const id of ['writer', 'reviewer', 'builder', 'lead', 'chief-of-staff', 'advisors-lead']) {
      expect(autoApprovalTargetIsReadOnly(id, null)).toBe(false);
    }
    // A system id never carries a workflow snapshot.
    expect(
      autoApprovalTargetIsReadOnly('product-strategy', memberSnapshot({ id: 'product-strategy' })),
    ).toBe(false);
    // An id outside the registry without its own snapshot.
    expect(autoApprovalTargetIsReadOnly(WORKFLOW_ID, null)).toBe(false);
    expect(autoApprovalTargetIsReadOnly(WORKFLOW_ID, memberSnapshot({ id: OTHER }))).toBe(false);
    expect(autoApprovalTargetIsReadOnly('', null)).toBe(false);
    expect(
      autoApprovalTargetIsReadOnly(
        WORKFLOW_ID,
        memberSnapshot({ connectorToolIds: ['mail_send_message'] }),
      ),
    ).toBe(false);
    expect(
      autoApprovalTargetIsReadOnly(
        WORKFLOW_ID,
        memberSnapshot({ connectorToolIds: 'mail_list_unread_metadata' as never }),
      ),
    ).toBe(false);
  });

  it('writes and reads the automatic decision reason; anything else is not one', () => {
    expect(autoApprovalDecisionReason('read_only', null, null)).toBe('auto:read_only');
    expect(autoApprovalDecisionReason('credits', 7, 10)).toBe('auto:credits:7/10');
    expect(readAutoApprovalDecision('auto:read_only')).toEqual({
      mode: 'read_only',
      estimateCredits: null,
      creditLimit: null,
    });
    expect(readAutoApprovalDecision('auto:credits:7/10')).toEqual({
      mode: 'credits',
      estimateCredits: 7,
      creditLimit: 10,
    });
    expect(readAutoApprovalDecision('auto:credits:10/10')).toEqual({
      mode: 'credits',
      estimateCredits: 10,
      creditLimit: 10,
    });
    for (const value of [
      null,
      undefined,
      '',
      'auto:',
      'auto:every',
      'auto:credits',
      'auto:credits:11/10',
      'auto:credits:1/0',
      'auto:credits:-1/10',
      'auto:credits:1.5/10',
      'auto:read_only ',
      'not good enough',
      42,
    ]) {
      expect(readAutoApprovalDecision(value)).toBeNull();
    }
  });

  it('reads a waiting record only with a known reason', () => {
    for (const reason of ['writes', 'unknown_cost', 'over_limit', 'checks_failed', 'lead_missing']) {
      expect(readPendingAutoApproval({ outcome: 'waiting', reason })).toEqual({
        outcome: 'waiting',
        reason,
      });
    }
    for (const value of [
      null,
      undefined,
      'waiting',
      [],
      { outcome: 'approved', reason: 'writes' },
      { outcome: 'waiting', reason: 'nope' },
      { outcome: 'waiting' },
    ]) {
      expect(readPendingAutoApproval(value)).toBeNull();
    }
  });
});

describe('APPROVAL-SET-01B CollaborationWorkflowService reads', () => {
  let rowsById: Map<string, Record<string, unknown>>;
  let runs: Map<string, Record<string, unknown>>;
  let referrals: Map<string, Record<string, unknown>>;
  let deductions: Map<string, Record<string, unknown>>;
  let service: CollaborationWorkflowService;

  beforeEach(() => {
    rowsById = new Map([
      [WORKFLOW_ID, { ...copiedRow(), approvalMode: 'read_only', approvalCreditLimit: null }],
    ]);
    runs = new Map();
    referrals = new Map();
    deductions = new Map();
    const userAgents = {
      findOneByIdAndUserId: async (id: string, userId: string) => {
        const row = rowsById.get(id);
        return row && row.userId === userId ? { ...row } : null;
      },
    };
    service = new CollaborationWorkflowService(
      userAgents as unknown as UserAgentService,
      mapRepo(runs, 'collaborationRunId') as never,
      mapRepo(referrals, 'referralId') as never,
      mapRepo(deductions, 'id') as never,
    );
  });

  function step(input: {
    id: string;
    runId: string;
    target: string;
    status?: string;
    executionId?: string | null;
    completedAt?: string;
  }) {
    referrals.set(input.id, {
      referralId: input.id,
      collaborationRunId: input.runId,
      targetBuilderProfileId: input.target,
      status: input.status ?? 'completed',
      executionId: input.executionId === undefined ? `exec-${input.id}` : input.executionId,
      completedAt: input.completedAt ?? '2026-11-10T01:00:00.000Z',
      updatedAt: input.completedAt ?? '2026-11-10T01:00:00.000Z',
      pendingJob: {},
    });
  }

  function deduct(id: string, executionId: string, credits: unknown, ownerId = OWNER) {
    deductions.set(id, {
      id,
      ownerId,
      sourceEventId: executionId,
      requestedCredits: credits,
      createdAt: '2026-11-10T01:00:00.000Z',
    });
  }

  it("reads the lead's stored setting fail-closed, and a missing, foreign or system row as not found", async () => {
    expect(await service.leadApprovalSetting(OWNER, WORKFLOW_ID)).toEqual({
      found: true,
      off: false,
      setting: { mode: 'read_only', creditLimit: null },
    });
    rowsById.set(WORKFLOW_ID, { ...copiedRow(), approvalMode: 'credits', approvalCreditLimit: 12 });
    expect(await service.leadApprovalSetting(OWNER, WORKFLOW_ID)).toEqual({
      found: true,
      off: false,
      setting: { mode: 'credits', creditLimit: 12 },
    });
    // Malformed or absent reads as every.
    for (const stored of [
      { approvalMode: 'credits', approvalCreditLimit: null },
      { approvalMode: 'always' },
      {},
    ]) {
      rowsById.set(WORKFLOW_ID, { ...copiedRow(), ...stored });
      expect(await service.leadApprovalSetting(OWNER, WORKFLOW_ID)).toEqual({
        found: true,
        off: false,
        setting: { mode: 'every', creditLimit: null },
      });
    }
    rowsById.set(WORKFLOW_ID, { ...copiedRow({ status: 'disabled' }), approvalMode: 'read_only' });
    expect(await service.leadApprovalSetting(OWNER, WORKFLOW_ID)).toMatchObject({
      found: true,
      off: true,
    });
    rowsById.set(WORKFLOW_ID, { ...copiedRow({ status: 'draft' }), approvalMode: 'read_only' });
    expect(await service.leadApprovalSetting(OWNER, WORKFLOW_ID)).toMatchObject({
      found: true,
      off: false,
    });
    expect(await service.leadApprovalSetting(OTHER, WORKFLOW_ID)).toEqual({ found: false });
    expect(
      await service.leadApprovalSetting(OWNER, 'f0f0f0f0-0000-4000-8000-00000000dead'),
    ).toEqual({ found: false });
    expect(await service.leadApprovalSetting(OWNER, 'chief-of-staff')).toEqual({ found: false });
    expect(await service.leadApprovalSetting(OWNER, '')).toEqual({ found: false });
  });

  it("estimates from the target's latest completed step in the owner's runs, summed and rounded up", async () => {
    runs.set('run-1', { collaborationRunId: 'run-1', userId: OWNER });
    runs.set('run-2', { collaborationRunId: 'run-2', userId: OWNER });
    runs.set('run-other', { collaborationRunId: 'run-other', userId: OTHER });
    step({ id: 'old', runId: 'run-1', target: 'product-strategy', completedAt: '2026-11-09T01:00:00.000Z' });
    step({ id: 'new', runId: 'run-2', target: 'product-strategy', completedAt: '2026-11-10T05:00:00.000Z' });
    // Later, but another owner's run, unfinished, or without an execution: not counted.
    step({ id: 'foreign', runId: 'run-other', target: 'product-strategy', completedAt: '2026-11-11T01:00:00.000Z' });
    step({
      id: 'waiting',
      runId: 'run-2',
      target: 'product-strategy',
      status: 'pending_approval',
      completedAt: '2026-11-11T02:00:00.000Z',
    });
    step({
      id: 'noexec',
      runId: 'run-2',
      target: 'product-strategy',
      executionId: null,
      completedAt: '2026-11-11T03:00:00.000Z',
    });
    step({ id: 'otherTarget', runId: 'run-2', target: 'technology-advisor', completedAt: '2026-11-11T04:00:00.000Z' });
    deduct('d-old', 'exec-old', 50);
    deduct('d-new-1', 'exec-new', 3);
    deduct('d-new-2', 'exec-new', 1.5);
    deduct('d-new-foreign', 'exec-new', 100, OTHER);
    deduct('d-foreign', 'exec-foreign', 1);
    deduct('d-other', 'exec-otherTarget', 1);

    expect(await service.lastStepCreditsFor(OWNER, 'product-strategy')).toBe(5);
    expect(await service.lastStepCreditsFor(OWNER, 'technology-advisor')).toBe(1);
    // The other owner's own latest step is their foreign run's, with no deduction of theirs.
    expect(await service.lastStepCreditsFor(OTHER, 'product-strategy')).toBeNull();
  });

  it('is unknown with no completed step, no deduction row, or a malformed amount', async () => {
    runs.set('run-1', { collaborationRunId: 'run-1', userId: OWNER });
    expect(await service.lastStepCreditsFor(OWNER, 'product-strategy')).toBeNull();
    step({ id: 'a', runId: 'run-1', target: 'product-strategy' });
    expect(await service.lastStepCreditsFor(OWNER, 'product-strategy')).toBeNull();
    deduct('d-a', 'exec-a', 'lots');
    expect(await service.lastStepCreditsFor(OWNER, 'product-strategy')).toBeNull();
    deduct('d-a', 'exec-a', -2);
    expect(await service.lastStepCreditsFor(OWNER, 'product-strategy')).toBeNull();
    deduct('d-a', 'exec-a', 0);
    expect(await service.lastStepCreditsFor(OWNER, 'product-strategy')).toBe(0);
    // The latest owned step counts even with no deduction yet: unknown, not the older cost.
    step({ id: 'b', runId: 'run-1', target: 'product-strategy', completedAt: '2026-11-10T09:00:00.000Z' });
    expect(await service.lastStepCreditsFor(OWNER, 'product-strategy')).toBeNull();
  });
});
