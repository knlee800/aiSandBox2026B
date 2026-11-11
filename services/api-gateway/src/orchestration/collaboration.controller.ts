import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
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
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import type { ApiKeyIdentity } from '../auth/api-key.config';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { ConversationService } from '../conversations/conversation.service';
import { SessionStatus } from '../entities/session-status.enum';
import { SessionService } from '../sessions/session.service';
import {
  COLLABORATION_OMITTED_REJECT_REASON,
  COLLABORATION_PAGE_AGENT_ROLE,
  COLLABORATION_RUN_LIST_LIMIT,
  COLLABORATION_USER_ACTOR,
  COLLABORATION_USER_TASK_MAX_CHARS,
} from './collaboration-team';
import {
  businessRoleProfileIds,
  collaborationAgentsForTeam,
  collaborationTeamById,
  collaborationTeamForTarget,
  readCollaborationStartTeam,
  type CollaborationRunTeamId,
  type CollaborationServerTeamId,
} from './collaboration-teams';
import {
  CollaborationWorkflowService,
  resolveServerProviderModel,
  workflowRefusal,
  WORKFLOW_REFUSAL_CODES,
  type CollaborationWorkflowListItem,
  type PreparedWorkflowStart,
} from './collaboration-workflow';
import {
  COLLABORATION_BUSINESS_RUN_NOTE,
  CollaborationBusinessSessionService,
} from './collaboration-business-session';
import { collaborationHarnessToolProfile } from './collaboration-tool-profile';
import {
  CollaborationRosterService,
  cutAgentListText,
  type RosterMemberReason,
} from './collaboration-roster';
import {
  FRONT_DOOR_LEAD_ID,
  frontDoorAgentList,
  teamAgentList,
  teamLeadSummary,
} from './collaboration-front-door';
import type {
  AutoApprovalMode,
  AutoApprovalWaitReason,
  CollaborationListedAgent,
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
import {
  MAX_AGENT_LABEL_CHARS,
  MAX_AGENT_SUMMARY_CHARS,
  MAX_HANDOFF_TASK_CHARS,
} from './handoff-request';
import { OrchestrationService } from './orchestration.service';
import {
  parseDraftBlock,
  stepMayDraft,
  type CollaborationDraftView,
} from './collaboration-draft';

const USABLE_SESSION_STATUSES: readonly SessionStatus[] = [
  SessionStatus.ACTIVE,
  SessionStatus.PENDING,
];

/** Stored when the owner cancels without typing a reason. Same token as an omitted reject. */
export const COLLABORATION_OMITTED_CANCEL_REASON = 'omitted';

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

export interface CollaborationStartResponse {
  collaborationRunId: string;
  projectId: string;
  status: string;
  referralId: string;
  handoffStatus: string;
  source: string;
  target: string;
  conversationId: string;
  conversationCreated: boolean;
  /** COS-FRONTDOOR-01B D10: chief-of-staff starts only; the members used and the ones left out. */
  roster?: CollaborationStartRoster;
}

export interface CollaborationStartRoster {
  used: string[];
  skipped: Array<{ id: string; reason: RosterMemberReason }>;
}

/** One start's plan: who runs first, the agent list and the server's provider and model. */
interface CollaborationStartPlan {
  builderProfileId: string;
  agents: CollaborationListedAgent[];
  provider: string;
  adapter: string;
  model: string;
  workflow: ReferralPendingWorkflow | null;
  rosterWorkflows: ReferralPendingWorkflow[];
  roster: CollaborationStartRoster | null;
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
  constructor(
    private readonly orchestrationService: OrchestrationService,
    private readonly sessionService: SessionService,
    private readonly conversationService: ConversationService,
    private readonly knowledgeService: KnowledgeService,
    @Optional() private readonly workflowService?: CollaborationWorkflowService,
    @Optional() private readonly businessSessions?: CollaborationBusinessSessionService,
    @Optional() private readonly rosterService?: CollaborationRosterService,
  ) {}

  @Post('runs')
  @HttpCode(HttpStatus.CREATED)
  async startRun(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Body() body: unknown,
  ): Promise<CollaborationStartResponse> {
    const caller = this.assertEntitled(identity);
    const input = this.readStartBody(body);
    const workspace =
      input.sessionId !== undefined
        ? await this.loadUsableSession(input.sessionId, caller.userId)
        : null;

    // BIZ-USER-01C D2: every workflow refusal comes before the conversation and the run exist.
    const workflowPlan =
      'workflowId' in input
        ? await this.workflowStartPlan(
            await this.prepareWorkflow(input, caller.userId),
            caller.userId,
          )
        : null;
    // TEAM-NO-SESSION-02 D5, D6: only a read-profile workflow (and, COS-FRONTDOOR-01B
    // D4, the Chief of Staff) may start without a session; the business rows are
    // created after every refusal above.
    const sessionlessPlan =
      workflowPlan ??
      ('teamId' in input && input.teamId === 'chief-of-staff'
        ? { builderProfileId: FRONT_DOOR_LEAD_ID }
        : null);
    const anchor = workspace ?? (await this.businessAnchor(sessionlessPlan, caller.userId));
    const projectId = anchor.projectId;
    const conversation = await this.reuseOrCreateConversation(anchor.sessionId);
    const plan: CollaborationStartPlan =
      workflowPlan ??
      (await this.teamStartPlan(input as { teamId: CollaborationServerTeamId }, caller.userId));
    const run = await this.orchestrationService.createCollaborationRun({
      userId: caller.userId,
      projectId,
      initiatorAgent: COLLABORATION_USER_ACTOR,
    });

    try {
      const started = await this.orchestrationService.createPendingReferral({
        collaborationRunId: run.collaborationRunId,
        sourceBuilder: COLLABORATION_USER_ACTOR,
        targetBuilder: {
          agentRole: COLLABORATION_PAGE_AGENT_ROLE,
          builderProfileId: plan.builderProfileId,
        },
        idempotencyKey: `screen:${randomUUID()}`,
        sessionId: anchor.sessionId,
        conversationId: conversation.conversation.id,
        apiKeyId: caller.apiKeyId,
        prompt: input.task,
        provider: plan.provider,
        adapter: plan.adapter,
        model: plan.model,
        agents: plan.agents,
        fileAccess: true,
        ...(plan.workflow ? { workflow: plan.workflow } : {}),
        ...(plan.rosterWorkflows.length > 0 ? { rosterWorkflows: plan.rosterWorkflows } : {}),
        // D7 (DECISION D): a run with no session has no files to read.
        ...(workspace ? {} : { projectInstructions: COLLABORATION_BUSINESS_RUN_NOTE }),
      });
      return {
        collaborationRunId: run.collaborationRunId,
        projectId: run.projectId,
        status: run.status,
        referralId: started.referral.referralId,
        handoffStatus: started.referral.status,
        source: started.referral.sourceBuilder.builderProfileId,
        target: started.referral.targetBuilder.builderProfileId,
        conversationId: conversation.conversation.id,
        conversationCreated: conversation.created,
        ...(plan.roster ? { roster: plan.roster } : {}),
      };
    } catch (error) {
      try {
        await this.orchestrationService.cancelCollaboration({
          collaborationRunId: run.collaborationRunId,
          cancelledByUserId: caller.userId,
          cancelReason: 'initial hand-off was not created',
        });
      } catch {
        // The original error is the one the page should see.
      }
      this.raise(error);
    }
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
      const started = await this.orchestrationService.approveReferral({
        collaborationRunId,
        referralId,
        decidedBy: caller.userId,
        enforceTestsGate: true,
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

  private async loadUsableSession(
    sessionId: string,
    userId: string,
  ): Promise<{ sessionId: string; projectId: string }> {
    const session = await this.loadOwnedSession(sessionId, userId);
    if (!this.sessionIsUsable(session)) {
      throw new ConflictException('Session is not usable');
    }
    const projectId = typeof session.projectId === 'string' ? session.projectId.trim() : '';
    if (projectId.length === 0) {
      throw new ConflictException('Session has no project');
    }
    return { sessionId: session.id, projectId };
  }

  /**
   * TEAM-NO-SESSION-02 D5, D6: the business session for a start with no session.
   * readStartBody lets only a workflow body or (COS-FRONTDOOR-01B D4) a
   * chief-of-staff team body omit sessionId; this refuses anything else, and any
   * plan whose signed profile would not be read.
   */
  private async businessAnchor(
    sessionlessPlan: { builderProfileId: string } | null,
    userId: string,
  ): Promise<{ sessionId: string; projectId: string }> {
    if (!sessionlessPlan) {
      throw new BadRequestException('sessionId must be a valid UUID');
    }
    if (collaborationHarnessToolProfile(sessionlessPlan.builderProfileId) !== 'read') {
      throw workflowRefusal(WORKFLOW_REFUSAL_CODES.invalid);
    }
    if (!this.businessSessions) {
      throw new ServiceUnavailableException('Workflows are unavailable');
    }
    return this.businessSessions.ensureForOwner(userId);
  }

  private async loadOwnedSession(sessionId: string, userId: string) {
    let session;
    try {
      session = await this.sessionService.getSessionById(sessionId);
    } catch (error) {
      this.raise(error);
    }
    if (session.userId !== userId) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }
    return session;
  }

  private sessionIsUsable(session: {
    status: SessionStatus;
    terminatedAt: Date | null;
    expiresAt: Date | string | null;
  }): boolean {
    if (session.terminatedAt) {
      return false;
    }
    if (!USABLE_SESSION_STATUSES.includes(session.status)) {
      return false;
    }
    if (!session.expiresAt) {
      return true;
    }
    const expiresAtMs =
      session.expiresAt instanceof Date
        ? session.expiresAt.getTime()
        : Date.parse(String(session.expiresAt));
    return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();
  }

  private async reuseOrCreateConversation(sessionId: string): Promise<{
    conversation: { id: string };
    created: boolean;
  }> {
    const existing = await this.conversationService.getConversationBySession(sessionId);
    if (existing) {
      return { conversation: existing, created: false };
    }
    try {
      const created = await this.conversationService.getOrCreateConversation(sessionId);
      return { conversation: created, created: true };
    } catch (error) {
      const raced = await this.conversationService.getConversationBySession(sessionId);
      if (raced) {
        return { conversation: raced, created: false };
      }
      this.raise(error);
    }
  }

  private requireWorkflowService(): CollaborationWorkflowService {
    if (!this.workflowService) {
      throw new ServiceUnavailableException('Workflows are unavailable');
    }
    return this.workflowService;
  }

  private async prepareWorkflow(
    input: { workflowId: string; testRun: boolean },
    userId: string,
  ): Promise<PreparedWorkflowStart> {
    return this.requireWorkflowService().prepareStart({
      userId,
      workflowId: input.workflowId,
      testRun: input.testRun,
    });
  }

  private async teamStartPlan(
    input: { teamId: CollaborationServerTeamId },
    userId: string,
  ): Promise<CollaborationStartPlan> {
    const { provider, model } = resolveServerProviderModel();
    const team = collaborationTeamById(input.teamId);
    const firstRole = team.roles[0];
    if (!firstRole) {
      throw new BadRequestException('team must be coding, chief-of-staff, or advisors');
    }
    const agents = collaborationAgentsForTeam(input.teamId).map((agent) => ({ ...agent }));
    if (input.teamId !== 'chief-of-staff') {
      return {
        builderProfileId: firstRole.name,
        agents,
        provider,
        adapter: provider,
        model,
        workflow: null,
        rosterWorkflows: [],
        roster: null,
      };
    }
    // COS-FRONTDOOR-01B D5, D10: the owner's stored roster, re-checked now. The body
    // never carries it. No roster (or no roster service) is today's one-role run.
    const lead = agents.find((agent) => agent.name === FRONT_DOOR_LEAD_ID);
    if (!lead || firstRole.name !== FRONT_DOOR_LEAD_ID) {
      throw new BadRequestException('team must be coding, chief-of-staff, or advisors');
    }
    const members = this.rosterService
      ? await this.rosterService.membersForStart(userId)
      : { agents: [], rosterWorkflows: [], used: [], skipped: [] };
    return {
      builderProfileId: firstRole.name,
      agents: frontDoorAgentList(lead.instructions, members.agents),
      provider,
      adapter: provider,
      model,
      workflow: null,
      rosterWorkflows: members.rosterWorkflows.map((workflow) => ({ ...workflow })),
      roster: {
        used: [...members.used],
        skipped: members.skipped.map((entry) => ({ id: entry.id, reason: entry.reason })),
      },
    };
  }

  /**
   * BIZ-USER-01C: a workflow start. USER-TEAMS-01B D6, D7: the row's stored team
   * (ids from prepareStart, the row's own id dropped) is checked now by the
   * roster's rules; usable members follow the lead on the agent list, the
   * others are reported as skipped. The body never carries the team. With no
   * team this is today's team of one, byte for byte, and roster is null.
   */
  private async workflowStartPlan(
    prepared: PreparedWorkflowStart,
    userId: string,
  ): Promise<CollaborationStartPlan> {
    const plan: CollaborationStartPlan = {
      builderProfileId: prepared.builderProfileId,
      agents: prepared.agents.map((agent) => ({ ...agent })),
      provider: prepared.provider,
      adapter: prepared.adapter,
      model: prepared.model,
      workflow: prepared.workflow,
      rosterWorkflows: [],
      roster: null,
    };
    const leadId = prepared.builderProfileId.toLowerCase();
    const memberIds = (prepared.teamMemberIds ?? []).filter(
      (id) => id.toLowerCase() !== leadId,
    );
    const lead = prepared.agents[0];
    if (memberIds.length === 0 || !this.rosterService || !lead) {
      return plan;
    }
    const members = await this.rosterService.evaluateMembers(userId, memberIds);
    const label = cutAgentListText(prepared.workflow.name, MAX_AGENT_LABEL_CHARS);
    return {
      ...plan,
      agents: teamAgentList(
        {
          name: lead.name,
          instructions: lead.instructions,
          label,
          summary: cutAgentListText(teamLeadSummary(label), MAX_AGENT_SUMMARY_CHARS),
        },
        members.agents,
      ),
      rosterWorkflows: members.rosterWorkflows.map((workflow) => ({ ...workflow })),
      roster: {
        used: [...members.used],
        skipped: members.skipped.map((entry) => ({ id: entry.id, reason: entry.reason })),
      },
    };
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

  private readStartBody(body: unknown):
    | { sessionId?: string; task: string; teamId: CollaborationServerTeamId }
    | { sessionId?: string; task: string; workflowId: string; testRun: boolean } {
    const record = this.asRecord(body);
    if (record.workflowId !== undefined) {
      if (record.team !== undefined) {
        throw new BadRequestException('team and workflowId cannot be sent together');
      }
      if (record.testRun !== undefined && typeof record.testRun !== 'boolean') {
        throw new BadRequestException('testRun must be a boolean');
      }
      // TEAM-NO-SESSION-02 D5: absent means the business session; present is checked as before.
      return {
        ...(record.sessionId !== undefined
          ? { sessionId: this.readUuid(record.sessionId, 'sessionId') }
          : {}),
        task: this.readTask(record.task),
        workflowId: this.readUuid(record.workflowId, 'workflowId').toLowerCase(),
        testRun: record.testRun === true,
      };
    }
    if (record.testRun !== undefined) {
      throw new BadRequestException('testRun is only accepted with workflowId');
    }
    const teamId = readCollaborationStartTeam(record.team);
    if (!teamId) {
      throw new BadRequestException('team must be coding, chief-of-staff, or advisors');
    }
    // COS-FRONTDOOR-01B D4: only the chief-of-staff team may omit sessionId; a
    // present sessionId is checked as before, and coding and advisors still need one.
    if (teamId === 'chief-of-staff' && record.sessionId === undefined) {
      return { task: this.readTask(record.task), teamId };
    }
    return {
      sessionId: this.readUuid(record.sessionId, 'sessionId'),
      task: this.readTask(record.task),
      teamId,
    };
  }

  private readTask(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('task is required');
    }
    const task = value.trim();
    if (task.length === 0) {
      throw new BadRequestException('task is required');
    }
    if (task.length > COLLABORATION_USER_TASK_MAX_CHARS) {
      throw new BadRequestException(
        `task must be at most ${COLLABORATION_USER_TASK_MAX_CHARS} characters`,
      );
    }
    return task;
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

  private readUuid(value: unknown, field: string): string {
    if (typeof value !== 'string' || !uuidValidate(value)) {
      throw new BadRequestException(`${field} must be a valid UUID`);
    }
    return value;
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
    if (error instanceof HttpException) {
      throw error;
    }
    throw this.toHttpException(error);
  }

  private toHttpException(error: unknown): HttpException {
    const message = error instanceof Error ? error.message : 'Collaboration request failed';
    if (message.includes('not found')) {
      return new NotFoundException(message);
    }
    if (message === 'Failed to write execution intent') {
      return new InternalServerErrorException(message);
    }
    if (
      message.includes('exceeds max depth') ||
      message.includes('loop detected') ||
      message.includes('Max agents') ||
      message.includes('read-only') ||
      message.includes('blocked write-capable') ||
      message.includes('Handoff limit') ||
      message.includes('not in this run')
    ) {
      return new BadRequestException(message);
    }
    return new InternalServerErrorException(message);
  }
}
