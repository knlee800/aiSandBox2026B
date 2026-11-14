import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Optional,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { validate as uuidValidate } from 'uuid';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import type { ApiKeyIdentity } from '../auth/api-key.config';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { ConversationService } from '../conversations/conversation.service';
import { SessionService } from '../sessions/session.service';
import {
  COLLABORATION_OMITTED_REJECT_REASON,
  COLLABORATION_RUN_LIST_LIMIT,
} from './collaboration-team';
import {
  businessRoleProfileIds,
  collaborationTeamForTarget,
  type CollaborationRunTeamId,
} from './collaboration-teams';
import {
  CollaborationWorkflowService,
  type CollaborationWorkflowListItem,
} from './collaboration-workflow';
import { CollaborationBusinessSessionService } from './collaboration-business-session';
import { CollaborationRosterService } from './collaboration-roster';
import { FRONT_DOOR_LEAD_ID } from './collaboration-front-door';
import type {
  AutoApprovalMode,
  AutoApprovalWaitReason,
  CollaborationReferral,
  CollaborationRun,
  ReferralPendingWorkflow,
} from './orchestration.contracts';
import type { CollaborationHandoffFact } from './collaboration-tool-profile';
import {
  testsGateForHandoff,
  toTestsGateReferral,
  type CollaborationTestsGate,
  type CollaborationTestsBlockReason,
  type CollaborationTestsGateResult,
} from './collaboration-tests-gate';
import { KnowledgeService } from '../knowledge/knowledge.service';
import {
  collaborationAnswerCitations,
  parseCollaborationSourceMarkers,
  type CitationDocument,
} from './collaboration-citations';
import { MAX_HANDOFF_TASK_CHARS } from './handoff-request';
import { OrchestrationService } from './orchestration.service';
import {
  parseDraftBlock,
  stepMayDraft,
  type CollaborationDraftView,
} from './collaboration-draft';
import {
  COLLABORATION_OMITTED_CANCEL_REASON,
  CollaborationStartService,
  raiseCollaborationError,
  type CollaborationStartResponse,
} from './collaboration-start.service';

// CHAT-DISCORD-01 C1 D1: the start code and these names moved to collaboration-start.service.ts.
export {
  COLLABORATION_OMITTED_CANCEL_REASON,
  type CollaborationStartResponse,
  type CollaborationStartRoster,
} from './collaboration-start.service';

/** BIZ-USER-01C D12: the workflow a run ran, as the page shows it. */
export interface CollaborationRunWorkflowView {
  id: string;
  name: string;
  testRun: boolean;
}

export interface CollaborationRunListItem {
  collaborationRunId: string;
  projectId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  teamId: CollaborationRunTeamId;
  workflow: CollaborationRunWorkflowView | null;
}

export interface CollaborationHandoffView {
  referralId: string;
  status: string;
  source: string;
  target: string;
  prompt: string | null;
  answer: string | null;
  handoffNote: string | null;
  failureReason: string | null;
  decidedBy: string | null;
  rejectReason: string | null;
  canChangeFiles: boolean;
  changedPaths: string[];
  savePoint: string | null;
  tests: Array<{ command: string; passed: boolean }>;
  diff: string | null;
  diffUnavailable: boolean;
  testsGate: CollaborationTestsGate;
  testsBlockReason: CollaborationTestsBlockReason | null;
  sources: Array<{
    documentId: string;
    title: string;
    scopeId: string;
    heading: string | null;
  }>;
  droppedSourceCount: number;
  unsourced: boolean;
  showUnsourced: boolean;
  /**
   * APPROVAL-SET-01B D12: set when the server approved this step under the
   * lead's stored setting (decidedBy is then the owner); null otherwise.
   */
  autoApproved: {
    mode: AutoApprovalMode;
    estimateCredits: number | null;
    creditLimit: number | null;
  } | null;
  /** APPROVAL-SET-01B D12: why a waiting step waits although the setting is not every; else null. */
  autoApprovalWaiting: AutoApprovalWaitReason | null;
  /**
   * COS-DRAFTS-01 D5: the draft block at the end of a completed Chief of
   * Staff answer, parsed on read (never stored); null for any other step,
   * a step that is not completed, or an answer without a draft tag. A
   * proposal only: nothing is saved and no access is ever carried.
   */
  draft: CollaborationDraftView | null;
}

export interface CollaborationRunDetail {
  run: {
    collaborationRunId: string;
    projectId: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    failedAt: string | null;
  };
  teamId: CollaborationRunTeamId;
  team: string[];
  workflow: CollaborationRunWorkflowView | null;
  /** COS-FRONTDOOR-01B D21: the run's stored agent list with labels; never instructions. */
  agents: Array<{ name: string; label: string | null }>;
  handoffs: CollaborationHandoffView[];
}

/**
 * Login routes for the collaboration page.
 *
 * POST /api/collaboration/runs
 * GET  /api/collaboration/runs?projectId=
 * GET  /api/collaboration/runs/:id
 * POST /api/collaboration/runs/:id/referrals/:referralId/approve
 * POST /api/collaboration/runs/:id/referrals/:referralId/reject
 * POST /api/collaboration/runs/:id/referrals/:referralId/prompt
 * POST /api/collaboration/runs/:id/cancel
 * GET  /api/collaboration/workflows
 *
 * team is optional and only coding, chief-of-staff, or advisors. Missing means coding.
 * BIZ-USER-01C: workflowId (with optional testRun) runs the owner's workflow
 * instead; team and workflowId together are refused. Everything a workflow
 * run uses comes from the stored row.
 * TEAM-NO-SESSION-02: with workflowId, sessionId is optional. Without it the
 * run uses the owner's business project and session (read profile only).
 * A team start still requires sessionId, except (COS-FRONTDOOR-01B D4) the
 * chief-of-staff team, which then also uses the business session.
 * COS-FRONTDOOR-01B D10: a chief-of-staff start lists the owner's stored
 * roster (usable members only) after the Chief of Staff.
 * USER-TEAMS-01B D6: a workflow start lists the row's stored team (usable
 * members only) after the workflow, which leads the run and gets report-backs.
 * Provider, model, instructions, scopes, tool profile, and decidedBy are not taken from the body.
 */
@Controller('collaboration')
@UseGuards(SessionOrApiKeyAuthGuard)
export class CollaborationController {
  /** CHAT-DISCORD-01 C1 D1: the start and approve code the chat channel shares. */
  private readonly starter: CollaborationStartService;

  constructor(
    private readonly orchestrationService: OrchestrationService,
    sessionService: SessionService,
    conversationService: ConversationService,
    private readonly knowledgeService: KnowledgeService,
    @Optional() private readonly workflowService?: CollaborationWorkflowService,
    @Optional() private readonly businessSessions?: CollaborationBusinessSessionService,
    @Optional() rosterService?: CollaborationRosterService,
    @Optional() startService?: CollaborationStartService,
  ) {
    // The module provides one CollaborationStartService for the page and the
    // chat channel. A module without it (older test modules) gets the same
    // service built from the controller's own dependencies.
    this.starter =
      startService ??
      new CollaborationStartService(
        orchestrationService,
        sessionService,
        conversationService,
        workflowService,
        businessSessions,
        rosterService,
      );
  }

  @Post('runs')
  @HttpCode(HttpStatus.CREATED)
  async startRun(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Body() body: unknown,
  ): Promise<CollaborationStartResponse> {
    const caller = this.assertEntitled(identity);
    const input = this.starter.readStartBody(body);
    return this.starter.start(caller, input);
  }

  @Get('workflows')
  async listWorkflows(
    @AuthenticatedUser() identity: ApiKeyIdentity,
  ): Promise<{
    workflows: CollaborationWorkflowListItem[];
    business: { projectId: string } | null;
  }> {
    const caller = this.assertEntitled(identity);
    const workflows = await this.requireWorkflowService().listForOwner(caller.userId);
    // TEAM-NO-SESSION-02 D10: read only; never creates the business rows.
    const business = this.businessSessions
      ? await this.businessSessions.findForOwner(caller.userId)
      : null;
    return { workflows, business };
  }

  @Get('runs')
  async listRuns(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Query('projectId') projectId: unknown,
  ): Promise<{ runs: CollaborationRunListItem[] }> {
    const caller = this.assertEntitled(identity);
    const parsedProjectId = this.readProjectId(projectId);
    const runs = await this.orchestrationService.listCollaborationRunsForOwner({
      userId: caller.userId,
      projectId: parsedProjectId,
      limit: COLLABORATION_RUN_LIST_LIMIT,
    });
    const items: CollaborationRunListItem[] = [];
    for (const run of runs) {
      const firstId = run.referralIds[0];
      const first = firstId ? await this.orchestrationService.getReferral(firstId) : null;
      const workflow = first
        ? await this.orchestrationService.readReferralWorkflow(first.referralId)
        : null;
      items.push(
        this.toListItem(
          run,
          collaborationTeamForTarget(first?.targetBuilder.builderProfileId, workflow).id,
          workflow,
        ),
      );
    }
    return { runs: items };
  }

  @Get('runs/:id')
  async getRun(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Param('id') collaborationRunId: string,
  ): Promise<CollaborationRunDetail> {
    const caller = this.assertEntitled(identity);
    await this.requireOwnedRun(collaborationRunId, caller.userId);
    try {
      const detail = await this.orchestrationService.getCollaborationRunWithReferrals(
        collaborationRunId,
      );
      if (!detail || detail.run.userId !== caller.userId) {
        throw new NotFoundException('Collaboration run not found');
      }
      const facts = await this.orchestrationService.readCollaborationHandoffFacts(
        collaborationRunId,
      );
      return await this.toDetail(detail.run, detail.referrals, facts);
    } catch (error) {
      this.raise(error);
    }
  }

  @Post('runs/:id/referrals/:referralId/approve')
  @HttpCode(HttpStatus.OK)
  async approveReferral(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Param('id') collaborationRunId: string,
    @Param('referralId') referralId: string,
    @Body() body: unknown,
  ): Promise<CollaborationHandoffView> {
    const caller = this.assertEntitled(identity);
    await this.requireOwnedRun(collaborationRunId, caller.userId);
    const approveWithoutPassingTests = this.readApproveWithoutPassingTests(body);
    try {
      const started = await this.starter.approveStep({
        collaborationRunId,
        referralId,
        decidedBy: caller.userId,
        approveWithoutPassingTests,
      });
      const facts = await this.orchestrationService.readCollaborationHandoffFacts(
        collaborationRunId,
      );
      const gate = await this.orchestrationService.readCollaborationTestsGate(
        collaborationRunId,
        started.referral.referralId,
      );
      const documents = await this.citationDocuments(caller.userId, [started.referral]);
      return this.toHandoff(
        started.referral,
        facts.get(started.referral.referralId),
        gate,
        caller.userId,
        documents,
        await this.labelledProfileIds(started.referral),
      );
    } catch (error) {
      this.raise(error);
    }
  }

  @Post('runs/:id/referrals/:referralId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectReferral(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Param('id') collaborationRunId: string,
    @Param('referralId') referralId: string,
    @Body() body: unknown,
  ): Promise<CollaborationHandoffView> {
    const caller = this.assertEntitled(identity);
    await this.requireOwnedRun(collaborationRunId, caller.userId);
    const reason = this.readOptionalReason(body) ?? COLLABORATION_OMITTED_REJECT_REASON;
    try {
      const referral = await this.orchestrationService.rejectReferral({
        collaborationRunId,
        referralId,
        decidedBy: caller.userId,
        reason,
      });
      const facts = await this.orchestrationService.readCollaborationHandoffFacts(
        collaborationRunId,
      );
      const gate = await this.orchestrationService.readCollaborationTestsGate(
        collaborationRunId,
        referral.referralId,
      );
      const documents = await this.citationDocuments(caller.userId, [referral]);
      return this.toHandoff(
        referral,
        facts.get(referral.referralId),
        gate,
        caller.userId,
        documents,
        await this.labelledProfileIds(referral),
      );
    } catch (error) {
      this.raise(error);
    }
  }

  @Post('runs/:id/referrals/:referralId/prompt')
  @HttpCode(HttpStatus.OK)
  async updateReferralPrompt(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Param('id') collaborationRunId: string,
    @Param('referralId') referralId: string,
    @Body() body: unknown,
  ): Promise<CollaborationHandoffView> {
    const caller = this.assertEntitled(identity);
    await this.requireOwnedRun(collaborationRunId, caller.userId);
    const prompt = this.readReferralPrompt(body);
    try {
      const referral = await this.orchestrationService.updatePendingReferralPrompt({
        collaborationRunId,
        referralId,
        prompt,
        editedBy: caller.userId,
      });
      const facts = await this.orchestrationService.readCollaborationHandoffFacts(
        collaborationRunId,
      );
      const gate = await this.orchestrationService.readCollaborationTestsGate(
        collaborationRunId,
        referral.referralId,
      );
      const documents = await this.citationDocuments(caller.userId, [referral]);
      return this.toHandoff(
        referral,
        facts.get(referral.referralId),
        gate,
        caller.userId,
        documents,
        await this.labelledProfileIds(referral),
      );
    } catch (error) {
      this.raise(error);
    }
  }

  @Post('runs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelRun(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Param('id') collaborationRunId: string,
    @Body() body: unknown,
  ): Promise<{ collaborationRunId: string; status: string }> {
    const caller = this.assertEntitled(identity);
    const owned = await this.requireOwnedRun(collaborationRunId, caller.userId);
    if (owned.status !== 'active') {
      throw new ConflictException('Collaboration run is not active');
    }
    const cancelReason = this.readOptionalReason(body) ?? COLLABORATION_OMITTED_CANCEL_REASON;
    try {
      const cancelled = await this.orchestrationService.cancelCollaboration({
        collaborationRunId,
        cancelledByUserId: caller.userId,
        cancelReason,
      });
      return {
        collaborationRunId: cancelled.collaborationRunId,
        status: cancelled.status,
      };
    } catch (error) {
      this.raise(error);
    }
  }

  private assertEntitled(identity: ApiKeyIdentity | undefined): ApiKeyIdentity {
    if (!identity?.userId || typeof identity.apiKeyId !== 'string' || identity.apiKeyId.length === 0) {
      throw new UnauthorizedException('Missing authentication credentials');
    }
    if (identity.harnessEntitled !== true) {
      throw new ForbiddenException('Forbidden');
    }
    return identity;
  }

  private requireWorkflowService(): CollaborationWorkflowService {
    if (!this.workflowService) {
      throw new ServiceUnavailableException('Workflows are unavailable');
    }
    return this.workflowService;
  }

  /** D12 (3): a workflow's own answers carry the unsourced label like business roles. */
  private async labelledProfileIds(
    referral: CollaborationReferral,
  ): Promise<readonly string[] | undefined> {
    const workflow = await this.orchestrationService.readReferralWorkflow(referral.referralId);
    return workflow ? [...businessRoleProfileIds(), workflow.id] : undefined;
  }

  private async requireOwnedRun(
    collaborationRunId: string,
    userId: string,
  ): Promise<CollaborationRun> {
    const run = await this.orchestrationService.getCollaborationRun(collaborationRunId);
    if (!run || run.userId !== userId) {
      throw new NotFoundException('Collaboration run not found');
    }
    return run;
  }

  private readProjectId(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('projectId is required');
    }
    const projectId = value.trim();
    if (!uuidValidate(projectId)) {
      throw new BadRequestException('projectId must be a valid UUID');
    }
    return projectId;
  }

  private readApproveWithoutPassingTests(body: unknown): boolean {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return false;
    }
    return (body as Record<string, unknown>).approveWithoutPassingTests === true;
  }

  private readOptionalReason(body: unknown): string | undefined {
    if (body === undefined || body === null) {
      return undefined;
    }
    const record = this.asRecord(body);
    if (record.reason === undefined || record.reason === null) {
      return undefined;
    }
    if (typeof record.reason !== 'string') {
      throw new BadRequestException('reason must be a string');
    }
    const reason = record.reason.trim();
    if (reason.length === 0) {
      return undefined;
    }
    if (reason.length > 2000) {
      throw new BadRequestException('reason must be at most 2000 characters');
    }
    return reason;
  }

  private readReferralPrompt(body: unknown): string {
    const record = this.asRecord(body);
    if (typeof record.prompt !== 'string') {
      throw new BadRequestException('prompt is required');
    }
    const prompt = record.prompt.trim();
    if (prompt.length === 0) {
      throw new BadRequestException('prompt is required');
    }
    if (prompt.length > MAX_HANDOFF_TASK_CHARS) {
      throw new BadRequestException(
        `prompt must be at most ${MAX_HANDOFF_TASK_CHARS} characters`,
      );
    }
    return prompt;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('body is required');
    }
    return value as Record<string, unknown>;
  }

  private toListItem(
    run: CollaborationRun,
    teamId: CollaborationRunTeamId,
    workflow: ReferralPendingWorkflow | null,
  ): CollaborationRunListItem {
    return {
      collaborationRunId: run.collaborationRunId,
      projectId: run.projectId,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      teamId,
      workflow: this.toWorkflowView(teamId, workflow),
    };
  }

  private toWorkflowView(
    teamId: CollaborationRunTeamId,
    workflow: ReferralPendingWorkflow | null,
  ): CollaborationRunWorkflowView | null {
    if (teamId !== 'workflow' || !workflow) {
      return null;
    }
    return { id: workflow.id, name: workflow.name, testRun: workflow.testRun === true };
  }

  private async toDetail(
    run: CollaborationRun,
    referrals: readonly CollaborationReferral[],
    facts: ReadonlyMap<string, CollaborationHandoffFact>,
  ): Promise<CollaborationRunDetail> {
    const documents = await this.citationDocuments(run.userId, referrals);
    const first = referrals[0];
    const workflow = first
      ? await this.orchestrationService.readReferralWorkflow(first.referralId)
      : null;
    const team = collaborationTeamForTarget(first?.targetBuilder.builderProfileId, workflow);
    const agents = first ? await this.orchestrationService.readReferralAgents(first.referralId) : [];
    // COS-FRONTDOOR-01B: a front-door run labels its workflow members' unsourced answers too.
    // USER-TEAMS-01B: a workflow lead's team run labels its members' unsourced answers too.
    const labelled =
      team.id === 'workflow' && workflow
        ? agents.length > 1
          ? [...businessRoleProfileIds(), workflow.id, ...agents.map((agent) => agent.name)]
          : [...businessRoleProfileIds(), workflow.id]
        : team.id === FRONT_DOOR_LEAD_ID && agents.length > 1
          ? [...businessRoleProfileIds(), ...agents.map((agent) => agent.name)]
          : undefined;
    return {
      run: {
        collaborationRunId: run.collaborationRunId,
        projectId: run.projectId,
        status: run.status,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        completedAt: run.completedAt,
        failedAt: run.failedAt,
      },
      teamId: team.id,
      team: [...team.roleNames],
      workflow: this.toWorkflowView(team.id, workflow),
      agents,
      handoffs: referrals.map((referral) =>
        this.toHandoff(
          referral,
          facts.get(referral.referralId),
          this.testsGateFor(referral, referrals, facts),
          run.userId,
          documents,
          labelled,
        ),
      ),
    };
  }

  private async citationDocuments(
    ownerId: string,
    referrals: readonly CollaborationReferral[],
  ): Promise<CitationDocument[]> {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const referral of referrals) {
      if (referral.status !== 'completed') {
        continue;
      }
      const parsed = parseCollaborationSourceMarkers(referral.result?.summary ?? '');
      for (const marker of parsed.markers) {
        if (seen.has(marker.documentId)) {
          continue;
        }
        seen.add(marker.documentId);
        ids.push(marker.documentId);
      }
    }
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.knowledgeService.findActiveOwnedByIds(ownerId, ids);
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      title: row.title,
      scopeId: row.scopeId,
      deletedAt: row.deletedAt,
    }));
  }

  private testsGateFor(
    referral: CollaborationReferral,
    referrals: readonly CollaborationReferral[],
    facts: ReadonlyMap<string, CollaborationHandoffFact>,
  ): CollaborationTestsGateResult {
    return testsGateForHandoff(
      toTestsGateReferral(referral),
      referrals.map((item) => toTestsGateReferral(item)),
      (referralId) => facts.get(referralId),
    );
  }

  private toHandoff(
    referral: CollaborationReferral,
    fact: CollaborationHandoffFact | undefined,
    gate: CollaborationTestsGateResult,
    ownerId: string,
    documents: readonly CitationDocument[],
    businessRoleIds?: readonly string[],
  ): CollaborationHandoffView {
    const failed =
      referral.status === 'failed' ||
      referral.status === 'timed_out' ||
      referral.status === 'cancelled';
    const summary = referral.result?.summary ?? '';
    const citations = collaborationAnswerCitations({
      completed: referral.status === 'completed',
      answer: summary,
      targetProfileId: referral.targetBuilder.builderProfileId,
      ownerId,
      documents,
      ...(businessRoleIds ? { businessRoleProfileIds: businessRoleIds } : {}),
    });
    const work = fact ?? {
      canChangeFiles: false,
      changedPaths: [],
      savePoint: null,
      tests: [],
      diff: null,
      diffUnavailable: false,
    };
    const rejectReason =
      referral.status === 'rejected' &&
      referral.cancelReason &&
      referral.cancelReason !== COLLABORATION_OMITTED_REJECT_REASON
        ? referral.cancelReason
        : null;
    return {
      referralId: referral.referralId,
      status: referral.status,
      source: referral.sourceBuilder.builderProfileId,
      target: referral.targetBuilder.builderProfileId,
      prompt: referral.prompt,
      answer: referral.status === 'completed' ? summary : null,
      handoffNote: referral.handoffNote,
      failureReason: failed && summary.length > 0 ? summary : null,
      decidedBy: referral.decidedBy,
      rejectReason,
      canChangeFiles: work.canChangeFiles,
      changedPaths: [...work.changedPaths],
      savePoint: work.savePoint,
      tests: work.tests.map((test) => ({
        command: test.command,
        passed: test.passed,
      })),
      diff: work.diff,
      diffUnavailable: work.diffUnavailable,
      testsGate: gate.testsGate,
      testsBlockReason: gate.testsBlockReason,
      sources: citations.sources,
      droppedSourceCount: citations.droppedSourceCount,
      unsourced: citations.unsourced,
      showUnsourced: citations.showUnsourced,
      ...this.autoApprovalView(referral),
      draft:
        referral.status === 'completed' && stepMayDraft(referral.targetBuilder.builderProfileId)
          ? parseDraftBlock(summary)
          : null,
    };
  }

  /**
   * APPROVAL-SET-01B D12: from the referral's server-derived facts (the
   * stored decisionReason and pending_job.autoApproval), never from a body.
   * A waiting reason shows only while the step waits; an automatic approval
   * never shows on a waiting or rejected step.
   */
  private autoApprovalView(
    referral: CollaborationReferral,
  ): Pick<CollaborationHandoffView, 'autoApproved' | 'autoApprovalWaiting'> {
    const approved = referral.autoApproved;
    const autoApproved =
      approved &&
      referral.status !== 'pending_approval' &&
      referral.status !== 'rejected' &&
      referral.decidedBy !== null
        ? {
            mode: approved.mode,
            estimateCredits: approved.estimateCredits,
            creditLimit: approved.creditLimit,
          }
        : null;
    const autoApprovalWaiting =
      referral.status === 'pending_approval' && referral.autoApprovalWaiting
        ? referral.autoApprovalWaiting
        : null;
    return { autoApproved, autoApprovalWaiting };
  }

  private raise(error: unknown): never {
    raiseCollaborationError(error);
  }
}
