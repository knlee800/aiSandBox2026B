import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  GatewayProviderModelValidationError,
  resolveGatewayProviderModelSelection,
} from '../ai/provider-model.catalogue';
import { CreditDeductionRecord } from '../entities/credit-deduction-record.entity';
import type { UserAgent } from '../entities/user-agent.entity';
import { findKnowledgeScope, KNOWLEDGE_SCOPES } from '../knowledge/knowledge-scopes';
import { KillSwitchConfig } from '../safety/kill-switch.config';
import { isPlatformModelId } from '../system-agents/platform-models';
import {
  agentInstructionsWithinLimit,
  agentVersionFor,
  isSystemAgentModel,
  renderAgentInstructions,
  systemAgentById,
  systemAgentPromptSpecProblems,
  type SystemAgentModel,
  type SystemAgentPromptSpec,
} from '../system-agents/system-agent-registry';
import { findAllowlistedTool } from '../connectors/connector-servers';
import { UserAgentService, userWorkflowPromptSpec } from '../user-agent/user-agent.service';
import { allowlistedConnectorToolIds } from '../user-agent/user-workflow-grants';
import {
  isRosterSystemCandidate,
  readApprovalSetting,
  readStoredRosterMemberIds,
  type UserWorkflowApprovalSetting,
} from '../user-agent/user-workflow-rules';
import { CollaborationReferralEntity } from './collaboration-referral.entity';
import { CollaborationRunEntity } from './collaboration-run.entity';
import {
  AUTO_APPROVAL_WAIT_REASONS,
  type AutoApprovalMode,
  type CollaborationListedAgent,
  type ReferralAutoApproved,
  type ReferralPendingAutoApproval,
  type ReferralPendingWorkflow,
} from './orchestration.contracts';

/**
 * BIZ-USER-01C: a user workflow (a `user_agents` row) runs from the Team page
 * as a team of one. Everything the run uses comes from the stored row:
 * the rendered prompt, the version hash, the model, the access snapshot and
 * the budgets. Nothing of the spec is taken from the browser.
 *
 * D15: the start logic lives here, not in the controller, so a later caller
 * (TRIGGER-01) can start a run the way the Team page does.
 */

/** Stable refusal codes. The Team page translates them. */
export const WORKFLOW_REFUSAL_CODES = {
  notFound: 'WORKFLOW_NOT_FOUND',
  disabled: 'WORKFLOW_DISABLED',
  invalid: 'WORKFLOW_INVALID',
  notTested: 'WORKFLOW_NOT_TESTED',
  budgetDay: 'WORKFLOW_BUDGET_DAY',
  budgetRun: 'WORKFLOW_BUDGET_RUN',
} as const;

export type WorkflowRefusalCode =
  (typeof WORKFLOW_REFUSAL_CODES)[keyof typeof WORKFLOW_REFUSAL_CODES];

const REFUSAL_STATUS: Readonly<Record<WorkflowRefusalCode, number>> = {
  WORKFLOW_NOT_FOUND: HttpStatus.NOT_FOUND,
  WORKFLOW_DISABLED: HttpStatus.CONFLICT,
  WORKFLOW_INVALID: HttpStatus.CONFLICT,
  WORKFLOW_NOT_TESTED: HttpStatus.CONFLICT,
  WORKFLOW_BUDGET_DAY: HttpStatus.TOO_MANY_REQUESTS,
  WORKFLOW_BUDGET_RUN: HttpStatus.CONFLICT,
};

const REFUSAL_MESSAGES: Readonly<Record<WorkflowRefusalCode, string>> = {
  WORKFLOW_NOT_FOUND: 'Workflow not found',
  WORKFLOW_DISABLED: 'This workflow is off',
  WORKFLOW_INVALID: 'This workflow cannot run as saved',
  WORKFLOW_NOT_TESTED: 'Run a test of this version of the workflow first',
  WORKFLOW_BUDGET_DAY: "This workflow's budget for today is used up",
  WORKFLOW_BUDGET_RUN: "This workflow's last run cost more than its budget per run",
};

const ERROR_NAMES: Readonly<Record<number, string>> = {
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
};

export function workflowRefusal(
  code: WorkflowRefusalCode,
  details: Record<string, number> = {},
): HttpException {
  const statusCode = REFUSAL_STATUS[code];
  return new HttpException(
    {
      statusCode,
      message: REFUSAL_MESSAGES[code],
      error: ERROR_NAMES[statusCode],
      code,
      ...details,
    },
    statusCode,
  );
}

export type WorkflowStatus = 'active' | 'draft' | 'disabled';

/** An unknown stored status reads as disabled (fail closed). */
export function workflowStatus(value: unknown): WorkflowStatus {
  return value === 'active' || value === 'draft' ? value : 'disabled';
}

/**
 * The row fields a workflow run reads. USER-TEAMS-01 D1: `teamMemberIds`, the
 * stored team, is optional here so a caller without it reads as an empty
 * team; it is not part of the render or the version (D14, DECISION C).
 */
export type WorkflowRow = Partial<Pick<UserAgent, 'teamMemberIds'>> &
  Pick<
    UserAgent,
    | 'id'
    | 'name'
    | 'role'
    | 'status'
    | 'tone'
    | 'replyLanguage'
    | 'purpose'
    | 'procedure'
    | 'result'
    | 'knowledgeScopeIds'
    | 'connectorToolIds'
    | 'model'
    | 'budgetPerRunCredits'
    | 'budgetPerDayCredits'
  >;

/** Catalogue scope ids of the row, deduplicated, in catalogue order. */
export function workflowKnowledgeScopeIds(value: unknown): string[] {
  const requested = new Set<string>();
  if (Array.isArray(value)) {
    for (const id of value) {
      if (typeof id === 'string' && findKnowledgeScope(id)) {
        requested.add(id);
      }
    }
  }
  return KNOWLEDGE_SCOPES.map((scope) => scope.id).filter((id) => requested.has(id));
}

function copyModel(model: SystemAgentModel): SystemAgentModel {
  return model.choice === 'platform'
    ? { choice: 'platform', id: model.id }
    : { choice: 'server' };
}

export interface RenderedWorkflow {
  readonly spec: SystemAgentPromptSpec;
  readonly instructions: string;
  readonly knowledgeScopeIds: string[];
  readonly connectorToolIds: string[];
  readonly model: SystemAgentModel;
  readonly version: string;
}

/**
 * The prompt, access and version of a stored row, or null when the row
 * cannot run as saved (spec problems, over the length limit, or a model
 * that is not a platform model or the server's).
 */
export function renderWorkflow(row: WorkflowRow): RenderedWorkflow | null {
  const spec = userWorkflowPromptSpec(row);
  if (systemAgentPromptSpecProblems(spec).length > 0 || !agentInstructionsWithinLimit(spec)) {
    return null;
  }
  if (!isSystemAgentModel(row.model)) {
    return null;
  }
  const model = copyModel(row.model);
  if (model.choice === 'platform' && !isPlatformModelId(model.id)) {
    return null;
  }
  const instructions = renderAgentInstructions(spec);
  const knowledgeScopeIds = workflowKnowledgeScopeIds(row.knowledgeScopeIds);
  const connectorToolIds = allowlistedConnectorToolIds(row.connectorToolIds);
  const version = workflowVersion({
    id: row.id,
    spec,
    instructions,
    knowledgeScopeIds,
    connectorToolIds,
    model,
  });
  return { spec, instructions, knowledgeScopeIds, connectorToolIds, model, version };
}

/**
 * D6: the system-agent version material with id = row id, rules = the
 * platform rules, the rendered prompt, tool profile read, the catalogue
 * scopes with their catalogue type, the stored tool ids, the model and no
 * team role. Hashed by the registry's agentVersionFor.
 */
export function workflowVersion(input: {
  id: string;
  spec: SystemAgentPromptSpec;
  instructions: string;
  knowledgeScopeIds: readonly string[];
  connectorToolIds: readonly string[];
  model: SystemAgentModel;
}): string {
  const scopes = input.knowledgeScopeIds.map((id) => {
    const scope = findKnowledgeScope(id);
    if (!scope) {
      throw new Error(`Invalid knowledge scope: ${id}`);
    }
    return { id: scope.id, type: scope.type };
  });
  return agentVersionFor({
    id: input.id,
    tone: input.spec.tone,
    replyLanguage: input.spec.replyLanguage,
    purpose: input.spec.purpose,
    procedure: input.spec.procedure,
    result: input.spec.result,
    rules: input.spec.rules,
    instructions: input.instructions,
    toolProfile: 'read',
    scopes,
    connectorToolIds: input.connectorToolIds,
    model: input.model,
    teamRole: null,
  });
}

/** Today's provider and model from the server env (the team runs' choice). */
export function resolveServerProviderModel(): { provider: string; model: string } {
  try {
    const selection = resolveGatewayProviderModelSelection({
      provider: undefined,
      model: undefined,
      fallbackProviderEnv: process.env.AI_PROVIDER,
      anthropicModel: process.env.ANTHROPIC_MODEL,
    });
    return { provider: selection.provider, model: selection.model };
  } catch (error) {
    if (error instanceof GatewayProviderModelValidationError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}

/**
 * D5: a platform model runs on its provider through the catalogue check;
 * the server choice keeps today's env model.
 */
export function resolveWorkflowProviderModel(model: SystemAgentModel): {
  provider: string;
  model: string;
} {
  if (model.choice === 'server') {
    return resolveServerProviderModel();
  }
  if (!isPlatformModelId(model.id)) {
    throw workflowRefusal(WORKFLOW_REFUSAL_CODES.invalid);
  }
  let selection: { provider: string; model: string };
  try {
    selection = resolveGatewayProviderModelSelection({
      provider: 'anthropic',
      model: model.id,
      fallbackProviderEnv: undefined,
      anthropicModel: process.env.ANTHROPIC_MODEL,
    });
  } catch (error) {
    if (error instanceof GatewayProviderModelValidationError) {
      throw workflowRefusal(WORKFLOW_REFUSAL_CODES.invalid);
    }
    throw error;
  }
  if (selection.provider !== 'anthropic' || selection.model !== model.id) {
    throw workflowRefusal(WORKFLOW_REFUSAL_CODES.invalid);
  }
  if (!KillSwitchConfig.isProviderEnabled(selection.provider)) {
    throw new ServiceUnavailableException(
      `Provider ${selection.provider} temporarily unavailable`,
    );
  }
  return { provider: selection.provider, model: selection.model };
}

/** What a workflow has spent and been tested at, from its own referrals. */
export interface WorkflowUsage {
  /** Versions with a completed test run. */
  readonly testedVersions: ReadonlySet<string>;
  readonly lastTestRunAt: string | null;
  readonly spentTodayCredits: number;
  /** Requested credits of the most recent completed run; null with no such run or no deduction yet. */
  readonly lastRunCredits: number | null;
}

/**
 * D8: per day = today's sum >= the budget (429); per run = the last
 * completed run cost more than the budget (409). A null budget skips its check.
 */
export function workflowBudgetRefusal(
  budgets: { budgetPerRunCredits: number | null; budgetPerDayCredits: number | null },
  usage: Pick<WorkflowUsage, 'spentTodayCredits' | 'lastRunCredits'>,
): HttpException | null {
  const perDay = budgets.budgetPerDayCredits;
  if (typeof perDay === 'number' && usage.spentTodayCredits >= perDay) {
    return workflowRefusal(WORKFLOW_REFUSAL_CODES.budgetDay, {
      budget: perDay,
      spent: usage.spentTodayCredits,
    });
  }
  const perRun = budgets.budgetPerRunCredits;
  if (
    typeof perRun === 'number' &&
    usage.lastRunCredits !== null &&
    usage.lastRunCredits > perRun
  ) {
    return workflowRefusal(WORKFLOW_REFUSAL_CODES.budgetRun, {
      budget: perRun,
      lastRun: usage.lastRunCredits,
    });
  }
  return null;
}

/** D7: a normal run needs status active and a completed test run at the current version. */
export function workflowNormalRunAllowed(
  status: WorkflowStatus,
  version: string,
  usage: Pick<WorkflowUsage, 'testedVersions'>,
): boolean {
  return status === 'active' && usage.testedVersions.has(version);
}

export interface PreparedWorkflowStart {
  /** The run's only agent and the first hand-off's target: the row id. */
  readonly builderProfileId: string;
  readonly agents: CollaborationListedAgent[];
  readonly provider: string;
  readonly adapter: string;
  readonly model: string;
  readonly workflow: ReferralPendingWorkflow;
  /**
   * USER-TEAMS-01 D6: the row's stored team, ids only, read fail-closed and
   * not evaluated. Slice 01B's start evaluates it; until then no caller uses it.
   */
  readonly teamMemberIds: string[];
}

export interface CollaborationWorkflowListItem {
  id: string;
  name: string;
  role: string;
  status: WorkflowStatus;
  version: string | null;
  tested: boolean;
  lastTestRunAt: string | null;
  knowledgeScopeIds: string[];
  connectorToolIds: string[];
  model: SystemAgentModel | null;
  budgetPerRunCredits: number | null;
  budgetPerDayCredits: number | null;
  spentTodayCredits: number;
  lastRunCredits: number | null;
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function timeMs(value: Date | string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
}

function budgetOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
}

/**
 * APPROVAL-SET-01B D6: a connector tool list is read-only when every id is in
 * the allowlist and its definition carries `readOnly: true`. Anything else
 * (not an array, an unknown id, a tool without the flag or with false) is not.
 */
export function connectorToolIdsAreReadOnly(toolIds: unknown): boolean {
  if (!Array.isArray(toolIds)) {
    return false;
  }
  return toolIds.every((id) => findAllowlistedTool(id)?.readOnly === true);
}

/**
 * APPROVAL-SET-01B D6, fail-closed: a step's target is positively read-only
 * only when it is
 * (a) a system agent whose registry profile is `read` and which may sit in a
 *     user team (isRosterSystemCandidate: never the coding team, the Chief of
 *     Staff or the advisors lead), with no workflow snapshot on the step; or
 * (b) a user workflow whose own snapshot is on the step
 *     (USER_WORKFLOW_TOOL_PROFILES is `read` only);
 * and every connector tool it may be granted is in the allowlist with
 * `readOnly: true`. Everything else (profile null, `review`, `write`, an
 * unknown id without a snapshot) is not.
 */
export function autoApprovalTargetIsReadOnly(
  targetProfileId: string,
  stepWorkflow: ReferralPendingWorkflow | null | undefined,
): boolean {
  if (typeof targetProfileId !== 'string' || targetProfileId.length === 0) {
    return false;
  }
  const system = systemAgentById(targetProfileId);
  if (system) {
    return (
      !stepWorkflow &&
      system.toolProfile === 'read' &&
      isRosterSystemCandidate(system) &&
      connectorToolIdsAreReadOnly(system.connectorToolIds)
    );
  }
  if (!stepWorkflow || typeof stepWorkflow !== 'object' || stepWorkflow.id !== targetProfileId) {
    return false;
  }
  return connectorToolIdsAreReadOnly(stepWorkflow.connectorToolIds);
}

const AUTO_DECISION_READ_ONLY = 'auto:read_only';
const AUTO_DECISION_CREDITS = /^auto:credits:(\d{1,9})\/(\d{1,9})$/;

/** APPROVAL-SET-01B D11: `auto:read_only` or `auto:credits:<estimate>/<limit>`. */
export function autoApprovalDecisionReason(
  mode: AutoApprovalMode,
  estimateCredits: number | null,
  creditLimit: number | null,
): string {
  if (mode === 'read_only') {
    return AUTO_DECISION_READ_ONLY;
  }
  return `auto:credits:${estimateCredits}/${creditLimit}`;
}

/**
 * APPROVAL-SET-01B D12: the automatic decision a stored decisionReason
 * records, or null when it is not one (a reject reason, null, malformed, or a
 * credits estimate above its limit).
 */
export function readAutoApprovalDecision(reason: unknown): ReferralAutoApproved | null {
  if (reason === AUTO_DECISION_READ_ONLY) {
    return { mode: 'read_only', estimateCredits: null, creditLimit: null };
  }
  if (typeof reason !== 'string') {
    return null;
  }
  const match = AUTO_DECISION_CREDITS.exec(reason);
  if (!match) {
    return null;
  }
  const estimateCredits = Number(match[1]);
  const creditLimit = Number(match[2]);
  if (creditLimit < 1 || estimateCredits > creditLimit) {
    return null;
  }
  return { mode: 'credits', estimateCredits, creditLimit };
}

/** APPROVAL-SET-01B D11: a stored waiting record, or null when it is not a valid one. */
export function readPendingAutoApproval(value: unknown): ReferralPendingAutoApproval | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as { outcome?: unknown; reason?: unknown };
  if (record.outcome !== 'waiting') {
    return null;
  }
  const reason = record.reason;
  if (
    typeof reason !== 'string' ||
    !(AUTO_APPROVAL_WAIT_REASONS as readonly string[]).includes(reason)
  ) {
    return null;
  }
  return { outcome: 'waiting', reason: reason as ReferralPendingAutoApproval['reason'] };
}

/** APPROVAL-SET-01B D5: the lead's stored setting, read live. */
export type LeadApprovalSetting =
  | { readonly found: false }
  | {
      readonly found: true;
      /** The row's status reads as disabled. */
      readonly off: boolean;
      readonly setting: UserWorkflowApprovalSetting;
    };

@Injectable()
export class CollaborationWorkflowService {
  constructor(
    private readonly userAgents: UserAgentService,
    @InjectRepository(CollaborationRunEntity)
    private readonly runRepo: Repository<CollaborationRunEntity>,
    @InjectRepository(CollaborationReferralEntity)
    private readonly referralRepo: Repository<CollaborationReferralEntity>,
    @InjectRepository(CreditDeductionRecord)
    private readonly deductions: Repository<CreditDeductionRecord>,
  ) {}

  /**
   * D2: load the owner's row and check it, in order: missing, disabled,
   * invalid spec or model, the provider switch, C13 (D7), then the budgets (D8).
   */
  async prepareStart(input: {
    userId: string;
    workflowId: string;
    testRun: boolean;
  }): Promise<PreparedWorkflowStart> {
    const row = await this.userAgents.findOneByIdAndUserId(input.workflowId, input.userId);
    if (!row || row.userId !== input.userId) {
      throw workflowRefusal(WORKFLOW_REFUSAL_CODES.notFound);
    }
    if (systemAgentById(row.id)) {
      throw workflowRefusal(WORKFLOW_REFUSAL_CODES.invalid);
    }
    const status = workflowStatus(row.status);
    if (status === 'disabled') {
      throw workflowRefusal(WORKFLOW_REFUSAL_CODES.disabled);
    }
    const rendered = renderWorkflow(row);
    if (!rendered) {
      throw workflowRefusal(WORKFLOW_REFUSAL_CODES.invalid);
    }
    const providerModel = resolveWorkflowProviderModel(rendered.model);
    const usage = await this.usageFor(input.userId, row.id);
    if (!input.testRun && !workflowNormalRunAllowed(status, rendered.version, usage)) {
      throw workflowRefusal(WORKFLOW_REFUSAL_CODES.notTested);
    }
    const budgets = {
      budgetPerRunCredits: budgetOf(row.budgetPerRunCredits),
      budgetPerDayCredits: budgetOf(row.budgetPerDayCredits),
    };
    const budgetRefusal = workflowBudgetRefusal(budgets, usage);
    if (budgetRefusal) {
      throw budgetRefusal;
    }
    return {
      builderProfileId: row.id,
      agents: [{ name: row.id, instructions: rendered.instructions }],
      provider: providerModel.provider,
      adapter: providerModel.provider,
      model: providerModel.model,
      workflow: {
        id: row.id,
        name: row.name,
        version: rendered.version,
        knowledgeScopeIds: [...rendered.knowledgeScopeIds],
        connectorToolIds: [...rendered.connectorToolIds],
        model: copyModel(rendered.model),
        testRun: input.testRun,
        ...budgets,
      },
      teamMemberIds: readStoredRosterMemberIds(row.teamMemberIds),
    };
  }

  /**
   * D11: before the owner's approve starts the job. The row must still exist
   * and not be off; a draft may only test-run; the budgets are checked again
   * because credits can be spent during the wait.
   */
  async assertCanApprove(userId: string, workflow: ReferralPendingWorkflow): Promise<void> {
    const row = await this.userAgents.findOneByIdAndUserId(workflow.id, userId);
    if (!row || row.userId !== userId) {
      throw workflowRefusal(WORKFLOW_REFUSAL_CODES.disabled);
    }
    const status = workflowStatus(row.status);
    if (status === 'disabled') {
      throw workflowRefusal(WORKFLOW_REFUSAL_CODES.disabled);
    }
    if (status === 'draft' && workflow.testRun !== true) {
      throw workflowRefusal(WORKFLOW_REFUSAL_CODES.notTested);
    }
    const usage = await this.usageFor(userId, workflow.id);
    const budgetRefusal = workflowBudgetRefusal(
      {
        budgetPerRunCredits: budgetOf(workflow.budgetPerRunCredits),
        budgetPerDayCredits: budgetOf(workflow.budgetPerDayCredits),
      },
      usage,
    );
    if (budgetRefusal) {
      throw budgetRefusal;
    }
  }

  /**
   * APPROVAL-SET-01B D5: the lead workflow's stored approval setting, read
   * fail-closed (readApprovalSetting). Missing, another owner's, or a system
   * id reads as not found.
   */
  async leadApprovalSetting(userId: string, leadId: string): Promise<LeadApprovalSetting> {
    if (typeof leadId !== 'string' || leadId.length === 0 || systemAgentById(leadId)) {
      return { found: false };
    }
    const row = await this.userAgents.findOneByIdAndUserId(leadId, userId);
    if (!row || row.userId !== userId || row.id !== leadId) {
      return { found: false };
    }
    return {
      found: true,
      off: workflowStatus(row.status) === 'disabled',
      setting: readApprovalSetting(row),
    };
  }

  /**
   * APPROVAL-SET-01B D7: the estimate for a step to `targetProfileId` = the
   * requested credits of that target's latest completed step (with an
   * execution) in the owner's runs, summed over its deduction rows, rounded
   * up. Like usageFor's last run, without the workflow-snapshot filter. Null
   * when there is no such step, no deduction row, or a malformed amount.
   */
  async lastStepCreditsFor(userId: string, targetProfileId: string): Promise<number | null> {
    const candidates = await this.referralRepo.find({
      where: { targetBuilderProfileId: targetProfileId, status: 'completed' },
    });
    const completed = candidates
      .filter(
        (referral) =>
          referral.targetBuilderProfileId === targetProfileId &&
          referral.status === 'completed' &&
          typeof referral.executionId === 'string' &&
          referral.executionId.length > 0,
      )
      .sort(
        (a, b) => timeMs(b.completedAt ?? b.updatedAt) - timeMs(a.completedAt ?? a.updatedAt),
      );
    const runOwner = new Map<string, boolean>();
    let latest: CollaborationReferralEntity | null = null;
    for (const referral of completed) {
      let ownedRun = runOwner.get(referral.collaborationRunId);
      if (ownedRun === undefined) {
        const run = await this.runRepo.findOne({
          where: { collaborationRunId: referral.collaborationRunId },
        });
        ownedRun = run?.userId === userId;
        runOwner.set(referral.collaborationRunId, ownedRun);
      }
      if (ownedRun) {
        latest = referral;
        break;
      }
    }
    const executionId = latest?.executionId;
    if (typeof executionId !== 'string' || executionId.length === 0) {
      return null;
    }
    const records = await this.deductions.find({
      where: { ownerId: userId, sourceEventId: executionId },
      select: ['ownerId', 'sourceEventId', 'requestedCredits', 'createdAt'],
    });
    let total: number | null = null;
    for (const record of records) {
      if (record.ownerId !== userId || record.sourceEventId !== executionId) {
        continue;
      }
      const credits = Number(record.requestedCredits);
      if (!Number.isFinite(credits) || credits < 0) {
        return null;
      }
      total = (total ?? 0) + credits;
    }
    return total === null ? null : Math.ceil(total);
  }

  /** D12: the owner's workflows for the Team page. No instructions, no tokens. */
  async listForOwner(userId: string): Promise<CollaborationWorkflowListItem[]> {
    const rows = await this.userAgents.listByUserId(userId);
    const items: CollaborationWorkflowListItem[] = [];
    for (const row of rows) {
      if (row.userId !== userId) {
        continue;
      }
      const rendered = renderWorkflow(row);
      const usage = await this.usageFor(userId, row.id);
      items.push({
        id: row.id,
        name: row.name,
        role: row.role,
        status: workflowStatus(row.status),
        version: rendered?.version ?? null,
        tested: rendered ? usage.testedVersions.has(rendered.version) : false,
        lastTestRunAt: usage.lastTestRunAt,
        knowledgeScopeIds: rendered
          ? [...rendered.knowledgeScopeIds]
          : workflowKnowledgeScopeIds(row.knowledgeScopeIds),
        connectorToolIds: rendered
          ? [...rendered.connectorToolIds]
          : allowlistedConnectorToolIds(row.connectorToolIds),
        model: rendered ? copyModel(rendered.model) : null,
        budgetPerRunCredits: budgetOf(row.budgetPerRunCredits),
        budgetPerDayCredits: budgetOf(row.budgetPerDayCredits),
        spentTodayCredits: usage.spentTodayCredits,
        lastRunCredits: usage.lastRunCredits,
      });
    }
    return items;
  }

  /**
   * The workflow's own referrals in the owner's runs (small per workflow),
   * filtered in code, plus their credit deductions. A deduction's
   * source_event_id is the execution id.
   */
  async usageFor(userId: string, workflowId: string, now = new Date()): Promise<WorkflowUsage> {
    const candidates = await this.referralRepo.find({
      where: { targetBuilderProfileId: workflowId },
    });
    const owned: CollaborationReferralEntity[] = [];
    const runOwner = new Map<string, boolean>();
    for (const referral of candidates) {
      if (referral.targetBuilderProfileId !== workflowId) {
        continue;
      }
      if (referral.pendingJob?.workflow?.id !== workflowId) {
        continue;
      }
      let ownedRun = runOwner.get(referral.collaborationRunId);
      if (ownedRun === undefined) {
        const run = await this.runRepo.findOne({
          where: { collaborationRunId: referral.collaborationRunId },
        });
        ownedRun = run?.userId === userId;
        runOwner.set(referral.collaborationRunId, ownedRun);
      }
      if (ownedRun) {
        owned.push(referral);
      }
    }

    const testedVersions = new Set<string>();
    let lastTestRunMs = 0;
    let lastTestRunAt: string | null = null;
    let lastCompleted: CollaborationReferralEntity | null = null;
    for (const referral of owned) {
      if (referral.status !== 'completed') {
        continue;
      }
      const completedMs = timeMs(referral.completedAt ?? referral.updatedAt);
      const workflow = referral.pendingJob?.workflow;
      if (workflow?.testRun === true && typeof workflow.version === 'string') {
        testedVersions.add(workflow.version);
        if (completedMs >= lastTestRunMs) {
          lastTestRunMs = completedMs;
          lastTestRunAt = new Date(completedMs).toISOString();
        }
      }
      if (
        referral.executionId &&
        (!lastCompleted ||
          completedMs >= timeMs(lastCompleted.completedAt ?? lastCompleted.updatedAt))
      ) {
        lastCompleted = referral;
      }
    }

    const executionIds = [
      ...new Set(
        owned
          .map((referral) => referral.executionId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];
    let spentTodayCredits = 0;
    let lastRunCredits: number | null = null;
    if (executionIds.length > 0) {
      const records = await this.deductions.find({
        where: { ownerId: userId, sourceEventId: In(executionIds) },
        select: ['ownerId', 'sourceEventId', 'requestedCredits', 'createdAt'],
      });
      const since = startOfUtcDay(now).getTime();
      for (const record of records) {
        if (record.ownerId !== userId || !executionIds.includes(record.sourceEventId)) {
          continue;
        }
        const credits = Number(record.requestedCredits);
        if (!Number.isFinite(credits)) {
          continue;
        }
        if (timeMs(record.createdAt) >= since) {
          spentTodayCredits += credits;
        }
        if (lastCompleted && record.sourceEventId === lastCompleted.executionId) {
          lastRunCredits = (lastRunCredits ?? 0) + credits;
        }
      }
    }

    return { testedVersions, lastTestRunAt, spentTodayCredits, lastRunCredits };
  }
}
