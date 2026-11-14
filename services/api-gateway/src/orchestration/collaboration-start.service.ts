import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { validate as uuidValidate } from 'uuid';
import { randomUUID } from 'crypto';
import type { ApiKeyIdentity } from '../auth/api-key.config';
import { ConversationService } from '../conversations/conversation.service';
import { SessionStatus } from '../entities/session-status.enum';
import { SessionService } from '../sessions/session.service';
import {
  COLLABORATION_PAGE_AGENT_ROLE,
  COLLABORATION_USER_ACTOR,
  COLLABORATION_USER_TASK_MAX_CHARS,
} from './collaboration-team';
import {
  collaborationAgentsForTeam,
  collaborationTeamById,
  readCollaborationStartTeam,
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
  CollaborationListedAgent,
  CollaborationRun,
  ReferralPendingWorkflow,
} from './orchestration.contracts';
import { MAX_AGENT_LABEL_CHARS, MAX_AGENT_SUMMARY_CHARS } from './handoff-request';
import { OrchestrationService, type StartedCollaborationReferral } from './orchestration.service';

/**
 * CHAT-DISCORD-01 slice C1, decision D1 (stage-start section 6.2): the start
 * and approve-first-step code of the Team page, moved out of
 * CollaborationController so the page route and the chat channel run the
 * same code. No second start path exists.
 *
 * The code below is the controller's former private methods, unchanged in
 * order and in every check: the body parser (team or workflowId, task trimmed
 * and at most 8000 characters, sessionId optional only for the chief-of-staff
 * team or a workflow), the session or business anchor (read profile only
 * without a session), the conversation, the plan (roster, workflow team), the
 * run and its first hand-off in pending_approval, and the cancel when the
 * hand-off cannot be made. Provider, model, instructions, scopes, tool
 * profile and decidedBy never come from the body.
 *
 * approveStep is the page's approve call: OrchestrationService.approveReferral
 * with the owner as decidedBy and enforceTestsGate true, so every check in
 * approveReferral runs (provider switch, global switch and daily caps through
 * ExecutionSafetyGuard, abort guard, credits, token quota, workflow checks,
 * the tests gate).
 */

const USABLE_SESSION_STATUSES: readonly SessionStatus[] = [
  SessionStatus.ACTIVE,
  SessionStatus.PENDING,
];

/** Stored when the owner cancels without typing a reason. Same token as an omitted reject. */
export const COLLABORATION_OMITTED_CANCEL_REASON = 'omitted';

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

/** A parsed start body, as readStartBody returns it. */
export type CollaborationStartInput =
  | { sessionId?: string; task: string; teamId: CollaborationServerTeamId }
  | { sessionId?: string; task: string; workflowId: string; testRun: boolean };

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

/** The controller's error mapping: an HttpException passes; anything else is mapped by its message. */
export function collaborationHttpException(error: unknown): HttpException {
  if (error instanceof HttpException) {
    return error;
  }
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

export function raiseCollaborationError(error: unknown): never {
  throw collaborationHttpException(error);
}

@Injectable()
export class CollaborationStartService {
  constructor(
    private readonly orchestrationService: OrchestrationService,
    private readonly sessionService: SessionService,
    private readonly conversationService: ConversationService,
    @Optional() private readonly workflowService?: CollaborationWorkflowService,
    @Optional() private readonly businessSessions?: CollaborationBusinessSessionService,
    @Optional() private readonly rosterService?: CollaborationRosterService,
  ) {}

  /** POST /api/collaboration/runs: the run and its first hand-off, waiting for approval. */
  async start(
    caller: ApiKeyIdentity,
    input: CollaborationStartInput,
  ): Promise<CollaborationStartResponse> {
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
      raiseCollaborationError(error);
    }
  }

  /**
   * POST /api/collaboration/runs/:id/referrals/:referralId/approve: the owner
   * approves one waiting hand-off. Errors are thrown as they come; the caller
   * maps them (the controller with raise).
   */
  async approveStep(input: {
    collaborationRunId: string;
    referralId: string;
    decidedBy: string;
    approveWithoutPassingTests: boolean;
  }): Promise<StartedCollaborationReferral> {
    return this.orchestrationService.approveReferral({
      collaborationRunId: input.collaborationRunId,
      referralId: input.referralId,
      decidedBy: input.decidedBy,
      enforceTestsGate: true,
      approveWithoutPassingTests: input.approveWithoutPassingTests,
    });
  }

  /**
   * The cancel the page's POST /api/collaboration/runs/:id/cancel makes, for
   * a run the caller owns and that is still active: cancelCollaboration with
   * the owner and the omitted-reason token. Null when the run is not the
   * owner's or not active (nothing is changed).
   */
  async cancelOwnedActiveRun(
    collaborationRunId: string,
    userId: string,
  ): Promise<CollaborationRun | null> {
    const run = await this.orchestrationService.getCollaborationRun(collaborationRunId);
    if (!run || run.userId !== userId || run.status !== 'active') {
      return null;
    }
    return this.orchestrationService.cancelCollaboration({
      collaborationRunId,
      cancelledByUserId: userId,
      cancelReason: COLLABORATION_OMITTED_CANCEL_REASON,
    });
  }

  /** GET /api/collaboration/workflows: the owner's workflows. */
  async listOwnerWorkflows(userId: string): Promise<CollaborationWorkflowListItem[]> {
    return this.requireWorkflowService().listForOwner(userId);
  }

  readStartBody(body: unknown): CollaborationStartInput {
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
      raiseCollaborationError(error);
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
      raiseCollaborationError(error);
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
}
