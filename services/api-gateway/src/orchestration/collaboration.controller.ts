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
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { validate as uuidValidate } from 'uuid';
import { randomUUID } from 'crypto';
import {
  GatewayProviderModelValidationError,
  resolveGatewayProviderModelSelection,
} from '../ai/provider-model.catalogue';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import type { ApiKeyIdentity } from '../auth/api-key.config';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { ConversationService } from '../conversations/conversation.service';
import { SessionStatus } from '../entities/session-status.enum';
import { SessionService } from '../sessions/session.service';
import {
  COLLABORATION_LEAD_ACTOR,
  COLLABORATION_OMITTED_REJECT_REASON,
  COLLABORATION_RUN_LIST_LIMIT,
  COLLABORATION_TEAM,
  COLLABORATION_USER_ACTOR,
  COLLABORATION_USER_TASK_MAX_CHARS,
} from './collaboration-team';
import type { CollaborationReferral, CollaborationRun } from './orchestration.contracts';
import type { CollaborationHandoffFact } from './collaboration-tool-profile';
import {
  testsGateForHandoff,
  toTestsGateReferral,
  type CollaborationTestsGate,
  type CollaborationTestsBlockReason,
  type CollaborationTestsGateResult,
} from './collaboration-tests-gate';
import { OrchestrationService } from './orchestration.service';

const USABLE_SESSION_STATUSES: readonly SessionStatus[] = [
  SessionStatus.ACTIVE,
  SessionStatus.PENDING,
];

export interface CollaborationRunListItem {
  collaborationRunId: string;
  projectId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
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
  team: string[];
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
}

/**
 * Login routes for the collaboration page.
 *
 * POST /api/collaboration/runs
 * GET  /api/collaboration/runs?projectId=
 * GET  /api/collaboration/runs/:id
 * POST /api/collaboration/runs/:id/referrals/:referralId/approve
 * POST /api/collaboration/runs/:id/referrals/:referralId/reject
 *
 * Provider, model, team and decidedBy are not taken from the body.
 */
@Controller('collaboration')
@UseGuards(SessionOrApiKeyAuthGuard)
export class CollaborationController {
  constructor(
    private readonly orchestrationService: OrchestrationService,
    private readonly sessionService: SessionService,
    private readonly conversationService: ConversationService,
  ) {}

  @Post('runs')
  @HttpCode(HttpStatus.CREATED)
  async startRun(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Body() body: unknown,
  ): Promise<CollaborationStartResponse> {
    const caller = this.assertEntitled(identity);
    const input = this.readStartBody(body);
    const session = await this.loadOwnedSession(input.sessionId, caller.userId);
    if (!this.sessionIsUsable(session)) {
      throw new ConflictException('Session is not usable');
    }
    const projectId = typeof session.projectId === 'string' ? session.projectId.trim() : '';
    if (projectId.length === 0) {
      throw new ConflictException('Session has no project');
    }

    const conversation = await this.reuseOrCreateConversation(session.id);
    const { provider, model } = this.resolveServerProviderModel();
    const run = await this.orchestrationService.createCollaborationRun({
      userId: caller.userId,
      projectId,
      initiatorAgent: COLLABORATION_USER_ACTOR,
    });

    try {
      const started = await this.orchestrationService.createPendingReferral({
        collaborationRunId: run.collaborationRunId,
        sourceBuilder: COLLABORATION_USER_ACTOR,
        targetBuilder: COLLABORATION_LEAD_ACTOR,
        idempotencyKey: `screen:${randomUUID()}`,
        sessionId: session.id,
        conversationId: conversation.conversation.id,
        apiKeyId: caller.apiKeyId,
        prompt: input.task,
        provider,
        adapter: provider,
        model,
        agents: COLLABORATION_TEAM.map((agent) => ({ ...agent })),
        fileAccess: true,
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
    return {
      runs: runs.map((run) => this.toListItem(run)),
    };
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
      return this.toDetail(detail.run, detail.referrals, facts);
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
      return this.toHandoff(started.referral, facts.get(started.referral.referralId), gate);
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
      return this.toHandoff(referral, facts.get(referral.referralId), gate);
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

  private resolveServerProviderModel(): { provider: string; model: string } {
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

  private readStartBody(body: unknown): { sessionId: string; task: string } {
    const record = this.asRecord(body);
    return {
      sessionId: this.readUuid(record.sessionId, 'sessionId'),
      task: this.readTask(record.task),
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

  private toListItem(run: CollaborationRun): CollaborationRunListItem {
    return {
      collaborationRunId: run.collaborationRunId,
      projectId: run.projectId,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
  }

  private toDetail(
    run: CollaborationRun,
    referrals: readonly CollaborationReferral[],
    facts: ReadonlyMap<string, CollaborationHandoffFact>,
  ): CollaborationRunDetail {
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
      team: COLLABORATION_TEAM.map((agent) => agent.name),
      handoffs: referrals.map((referral) =>
        this.toHandoff(
          referral,
          facts.get(referral.referralId),
          this.testsGateFor(referral, referrals, facts),
        ),
      ),
    };
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
  ): CollaborationHandoffView {
    const failed =
      referral.status === 'failed' ||
      referral.status === 'timed_out' ||
      referral.status === 'cancelled';
    const summary = referral.result?.summary ?? '';
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
    };
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
