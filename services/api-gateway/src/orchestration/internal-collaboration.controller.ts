import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { validate as uuidValidate } from 'uuid';
import {
  type CollaborationAgentIdentity,
  type CollaborationAgentRole,
  type CollaborationReferral,
  type CollaborationRun,
  type ReferralConstraints,
} from './orchestration.contracts';
import {
  OrchestrationService,
  type StartedCollaborationReferral,
} from './orchestration.service';

const AGENT_ROLES: readonly CollaborationAgentRole[] = [
  'builder',
  'chief-of-staff',
  'product-strategy',
  'technology-advisor',
];

/**
 * Internal collaboration routes.
 *
 * POST /api/internal/collaboration/runs
 * POST /api/internal/collaboration/runs/:id/referrals
 * POST /api/internal/collaboration/runs/:id/referrals/:referralId/approve
 * POST /api/internal/collaboration/runs/:id/referrals/:referralId/reject
 * GET  /api/internal/collaboration/runs/:id
 *
 * Protected by the global InternalServiceAuthGuard (X-Internal-Service-Key).
 */
@Controller('internal/collaboration')
export class InternalCollaborationController {
  constructor(private readonly orchestrationService: OrchestrationService) {}

  @Post('runs')
  @HttpCode(HttpStatus.CREATED)
  async createRun(@Body() body: unknown): Promise<CollaborationRun> {
    const input = this.readCreateRunBody(body);
    try {
      return await this.orchestrationService.createCollaborationRun(input);
    } catch (error) {
      this.raise(error);
    }
  }

  @Post('runs/:id/referrals')
  @HttpCode(HttpStatus.CREATED)
  async createReferral(
    @Param('id') collaborationRunId: string,
    @Body() body: unknown,
  ): Promise<StartedCollaborationReferral> {
    const input = this.readStartReferralBody(collaborationRunId, body);
    try {
      return await this.orchestrationService.createPendingReferral(input);
    } catch (error) {
      this.raise(error);
    }
  }

  @Post('runs/:id/referrals/:referralId/approve')
  @HttpCode(HttpStatus.OK)
  async approveReferral(
    @Param('id') collaborationRunId: string,
    @Param('referralId') referralId: string,
    @Body() body: unknown,
  ): Promise<StartedCollaborationReferral> {
    const decision = this.readDecision(body, false);
    try {
      return await this.orchestrationService.approveReferral({
        collaborationRunId,
        referralId,
        decidedBy: decision.decidedBy,
      });
    } catch (error) {
      this.raise(error);
    }
  }

  @Post('runs/:id/referrals/:referralId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectReferral(
    @Param('id') collaborationRunId: string,
    @Param('referralId') referralId: string,
    @Body() body: unknown,
  ): Promise<CollaborationReferral> {
    const decision = this.readDecision(body, true);
    try {
      return await this.orchestrationService.rejectReferral({
        collaborationRunId,
        referralId,
        decidedBy: decision.decidedBy,
        reason: decision.reason,
      });
    } catch (error) {
      this.raise(error);
    }
  }

  @Get('runs/:id')
  async getRun(
    @Param('id') collaborationRunId: string,
  ): Promise<{ run: CollaborationRun; referrals: CollaborationReferral[] }> {
    try {
      const detail = await this.orchestrationService.getCollaborationRunWithReferrals(
        collaborationRunId,
      );
      if (!detail) {
        throw new NotFoundException(`Collaboration run ${collaborationRunId} not found`);
      }
      return detail;
    } catch (error) {
      this.raise(error);
    }
  }

  private readCreateRunBody(body: unknown): {
    userId: string;
    projectId: string;
    initiatorAgent: CollaborationAgentIdentity;
    timeoutMs?: number;
  } {
    const record = this.asRecord(body, 'body');
    const timeoutMs =
      record.timeoutMs === undefined
        ? undefined
        : this.readNonNegativeInt(record.timeoutMs, 'timeoutMs');
    return {
      userId: this.readRequiredString(record.userId, 'userId', 50),
      projectId: this.readRequiredString(record.projectId, 'projectId'),
      initiatorAgent: this.readAgent(record.initiatorAgent, 'initiatorAgent'),
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    };
  }

  private readStartReferralBody(collaborationRunId: string, body: unknown) {
    const record = this.asRecord(body, 'body');
    const provider = this.readRequiredString(record.provider, 'provider', 50);
    const adapter =
      record.adapter === undefined
        ? provider
        : this.readRequiredString(record.adapter, 'adapter', 50);
    const timeoutMs =
      record.timeoutMs === undefined
        ? undefined
        : this.readNonNegativeInt(record.timeoutMs, 'timeoutMs');
    const orchestrationPriority =
      record.orchestrationPriority === undefined
        ? undefined
        : this.readFiniteNumber(record.orchestrationPriority, 'orchestrationPriority');

    return {
      collaborationRunId,
      sourceBuilder: this.readAgent(record.sourceBuilder, 'sourceBuilder'),
      targetBuilder: this.readAgent(record.targetBuilder, 'targetBuilder'),
      idempotencyKey: this.readRequiredString(record.idempotencyKey, 'idempotencyKey'),
      sessionId: this.readUuid(record.sessionId, 'sessionId'),
      conversationId: this.readUuid(record.conversationId, 'conversationId'),
      apiKeyId: this.readRequiredString(record.apiKeyId, 'apiKeyId', 50),
      prompt: this.readRequiredString(record.prompt, 'prompt'),
      provider,
      adapter,
      model: this.readOptionalString(record.model, 'model'),
      workspaceContext: record.workspaceContext,
      globalInstructions: this.readOptionalString(
        record.globalInstructions,
        'globalInstructions',
      ),
      projectInstructions: this.readOptionalString(
        record.projectInstructions,
        'projectInstructions',
      ),
      agents: record.agents,
      constraints: this.readConstraints(record.constraints),
      parentReferralTraceId: this.readOptionalNullableString(
        record.parentReferralTraceId,
        'parentReferralTraceId',
      ),
      timeoutMs,
      orchestrationPriority,
    };
  }

  private readDecision(
    body: unknown,
    requireReason: boolean,
  ): { decidedBy: string; reason?: string } {
    const record = this.asRecord(body, 'body');
    const decidedBy = this.readRequiredString(record.decidedBy, 'decidedBy').trim();
    if (!requireReason) {
      return { decidedBy };
    }
    const reason = this.readRequiredString(record.reason, 'reason').trim();
    return { decidedBy, reason };
  }

  private readConstraints(value: unknown): Partial<ReferralConstraints> | undefined {
    if (value === undefined) {
      return undefined;
    }
    const record = this.asRecord(value, 'constraints');
    const constraints: {
      timeoutMs?: number;
      maxDepth?: number;
      maxAgentsPerCollaboration?: number;
      readOnly?: boolean;
      allowWriteTools?: boolean;
      allowedTools?: string[];
    } = {};

    if (record.timeoutMs !== undefined) {
      constraints.timeoutMs = this.readNonNegativeInt(record.timeoutMs, 'constraints.timeoutMs');
    }
    if (record.maxDepth !== undefined) {
      constraints.maxDepth = this.readNonNegativeInt(record.maxDepth, 'constraints.maxDepth');
    }
    if (record.maxAgentsPerCollaboration !== undefined) {
      constraints.maxAgentsPerCollaboration = this.readNonNegativeInt(
        record.maxAgentsPerCollaboration,
        'constraints.maxAgentsPerCollaboration',
      );
    }
    if (record.readOnly !== undefined) {
      if (typeof record.readOnly !== 'boolean') {
        throw new BadRequestException('constraints.readOnly must be a boolean');
      }
      constraints.readOnly = record.readOnly;
    }
    if (record.allowWriteTools !== undefined) {
      if (typeof record.allowWriteTools !== 'boolean') {
        throw new BadRequestException('constraints.allowWriteTools must be a boolean');
      }
      constraints.allowWriteTools = record.allowWriteTools;
    }
    if (record.allowedTools !== undefined) {
      const allowedTools = this.readOptionalStringArray(
        record.allowedTools,
        'constraints.allowedTools',
      );
      if (!allowedTools) {
        throw new BadRequestException('constraints.allowedTools must be an array of strings');
      }
      constraints.allowedTools = allowedTools;
    }

    return constraints;
  }

  private readAgent(value: unknown, field: string): CollaborationAgentIdentity {
    const record = this.asRecord(value, field);
    const agentRole = record.agentRole;
    if (!AGENT_ROLES.includes(agentRole as CollaborationAgentRole)) {
      throw new BadRequestException(`${field}.agentRole is invalid`);
    }
    return {
      agentRole: agentRole as CollaborationAgentRole,
      builderProfileId: this.readRequiredString(
        record.builderProfileId,
        `${field}.builderProfileId`,
      ),
    };
  }

  private asRecord(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(`${field} is required`);
    }
    return value as Record<string, unknown>;
  }

  private readRequiredString(value: unknown, field: string, maxLength?: number): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required`);
    }
    if (maxLength !== undefined && value.length > maxLength) {
      throw new BadRequestException(`${field} must be at most ${maxLength} characters`);
    }
    return value;
  }

  private readOptionalString(value: unknown, field: string): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string') {
      throw new BadRequestException(`${field} must be a string`);
    }
    return value;
  }

  private readOptionalNullableString(value: unknown, field: string): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new BadRequestException(`${field} must be a string`);
    }
    return value;
  }

  private readUuid(value: unknown, field: string): string {
    const text = this.readRequiredString(value, field);
    if (!uuidValidate(text)) {
      throw new BadRequestException(`${field} must be a valid UUID`);
    }
    return text;
  }

  private readNonNegativeInt(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new BadRequestException(`${field} must be a non-negative integer`);
    }
    return value;
  }

  private readFiniteNumber(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException(`${field} must be a finite number`);
    }
    return value;
  }

  private readOptionalStringArray(value: unknown, field: string): string[] | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
      throw new BadRequestException(`${field} must be an array of strings`);
    }
    return [...value];
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
