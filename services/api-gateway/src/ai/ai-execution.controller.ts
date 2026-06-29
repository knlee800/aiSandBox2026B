import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Headers,
  BadRequestException,
  Req,
  Logger,
  Optional,
  Get,
  Param,
  NotFoundException,
  ConflictException,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import {
  AIExecutionRequest,
} from '../clients/ai-service-http.client';
import { ExecutionStreamService } from '../streaming/execution-stream.service';
import { ExecutionResultDto, FileActionDto } from './dto/execution-result.dto';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import { AuthorizationGuard } from '../auth/authorization.guard';
import { QuotaGuard } from '../quota/quota.guard';
import { TokenQuotaGuard } from '../quota/token-quota.guard';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import { RequireScope } from '../auth/decorators/require-scope.decorator';
import { ApiKeyIdentity } from '../auth/api-key.config';
import { UsageLedgerService } from '../usage-ledger/usage-ledger.service';
import { ExecutionSafetyGuard } from '../safety/execution-safety.guard';
import { GlobalSafetyLimitService } from '../safety/global-safety-limit.service';
import { LaunchGuard } from '../launch/launch.guard';
import { AbortGuard } from '../abort/abort.guard';
import { RateLimitGuard, RateLimit } from '../guards/rate-limit.guard';
import { IdempotencyGuard } from './idempotency.guard';
import { QueueService } from '../queue/queue.service';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { ExecutionResultService } from './execution-result.service';
import { UserAiInstructionsService } from '../user-ai-instructions/user-ai-instructions.service';
import { ProjectAiContextService } from '../project-ai-context/project-ai-context.service';
import { SessionService } from '../sessions/session.service';
import { ProjectRepoDocsService } from '../project-repo-docs/project-repo-docs.service';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';

const SUPPORTED_AI_PROVIDERS = [
  'stub',
  'anthropic',
  'openai',
  'groq',
  'xai',
  'deepseek',
] as const;
type SupportedAiProvider = (typeof SUPPORTED_AI_PROVIDERS)[number];

const MAX_REPO_DOC_COUNT = 10;
const MAX_REPO_DOC_CHARS = 8000;
const REPO_DOC_TRUNCATION_SUFFIX = '[...truncated at 8000 characters]';

/**
 * AIExecutionController
 *
 * Phase 18A: API Gateway Execution Controller
 * Phase 20A: API key authentication enforcement
 * Phase 20B: Scope-based authorization enforcement
 * Phase 21B: Quota and rate-limiting enforcement
 * Phase 22B: Usage ledger recording
 * Phase 26B: Production readiness (kill switches + safety limits)
 * Phase 28B-1: Launch state enforcement
 * Phase 28B-2: Abort mode enforcement
 * Phase 42A-3: Token quota enforcement (rolling 24h)
 * Phase 43A-2B: Idempotency via Idempotency-Key header
 * Phase 43A-2C: Idempotency short-circuit BEFORE quota (retry-safe)
 * Phase 43B-2: Two-phase execution record (write-before-call)
 * Phase 44.4D: Async queue submission after ledger intent write
 *
 * Exposes POST /api/ai/execute endpoint.
 * Requires API key authentication (Phase 20A).
 * Requires 'ai:execute' scope authorization (Phase 20B).
 * Enforces kill switches and global safety limits (Phase 26B).
 * Enforces launch state restrictions (Phase 28B-1).
 * Enforces abort mode restrictions (Phase 28B-2).
 * Checks idempotency BEFORE quota (Phase 43A-2C).
 * Requires quota availability (Phase 21B).
 * Enforces token quota (Phase 42A-3).
 * Records execution intent BEFORE queue submission (Phase 43B-2B).
 * Enqueues job for async execution (Phase 44.4D).
 * Returns immediately with executionId and status='queued' (Phase 44.4D).
 *
 * NO business logic, NO retries, NO transformations.
 * Intent write + enqueue only. AI execution is handled by worker.
 */
@Controller('ai')
export class AIExecutionController {
  private readonly logger = new Logger(AIExecutionController.name);

  constructor(
    private readonly usageLedgerService: UsageLedgerService,
    private readonly globalSafetyLimitService: GlobalSafetyLimitService,
    private readonly queueService: QueueService,
    private readonly executionResultService: ExecutionResultService,
    private readonly executionStreamService: ExecutionStreamService,
    private readonly userAiInstructionsService: UserAiInstructionsService,
    private readonly projectAiContextService: ProjectAiContextService,
    private readonly sessionService: SessionService,
    @Optional()
    private readonly projectRepoDocsService?: ProjectRepoDocsService,
    @Optional()
    private readonly containerManagerHttpClient?: ContainerManagerHttpClient,
  ) {}

  private normalizeGlobalInstructions(
    globalInstructions: string | null | undefined,
  ): string | undefined {
    if (typeof globalInstructions !== 'string') {
      return undefined;
    }
    const trimmedInstructions = globalInstructions.trim();
    return trimmedInstructions.length > 0 ? trimmedInstructions : undefined;
  }

  private normalizeProjectInstructions(
    projectInstructions: string | null | undefined,
  ): string | undefined {
    if (typeof projectInstructions !== 'string') {
      return undefined;
    }
    const trimmedInstructions = projectInstructions.trim();
    return trimmedInstructions.length > 0 ? trimmedInstructions : undefined;
  }

  private async resolveProjectInstructions(
    sessionId: string | undefined,
    userId: string,
  ): Promise<string | undefined> {
    if (typeof sessionId !== 'string') {
      return undefined;
    }

    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return undefined;
    }

    try {
      const session = await this.sessionService.getSessionById(normalizedSessionId);
      if (session.userId !== userId) {
        this.logger.warn(
          `Skipping project instructions: session ${normalizedSessionId} does not belong to user ${userId}`,
        );
        return undefined;
      }

      const projectId =
        typeof session.projectId === 'string' ? session.projectId.trim() : '';
      if (!projectId) {
        return undefined;
      }

      return this.normalizeProjectInstructions(
        await this.projectAiContextService.getByProjectId(projectId),
      );
    } catch (error) {
      this.logger.debug(
        `Project instructions unavailable for session ${normalizedSessionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
  }

  private async resolveRepoDocContents(
    sessionId: string | undefined,
    userId: string,
  ): Promise<Array<{ path: string; content: string }> | undefined> {
    if (
      !this.projectRepoDocsService ||
      !this.containerManagerHttpClient ||
      typeof sessionId !== 'string'
    ) {
      return undefined;
    }

    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return undefined;
    }

    let session: { userId: string; projectId?: string | null };
    try {
      session = await this.sessionService.getSessionById(normalizedSessionId);
    } catch (error) {
      this.logger.debug(
        `Repo doc context unavailable for session ${normalizedSessionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }

    if (session.userId !== userId) {
      this.logger.warn(
        `Skipping repo doc context: session ${normalizedSessionId} does not belong to user ${userId}`,
      );
      return undefined;
    }

    const projectId =
      typeof session.projectId === 'string' ? session.projectId.trim() : '';
    if (!projectId) {
      return undefined;
    }

    let registeredDocs: Array<{ path: string }>;
    try {
      registeredDocs = await this.projectRepoDocsService.listByProjectId(projectId);
    } catch (error) {
      this.logger.warn(
        `Failed to resolve repo doc registry for project ${projectId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
    if (registeredDocs.length === 0) {
      return undefined;
    }

    const readableDocs: Array<{ path: string; content: string }> = [];
    const docsToRead = registeredDocs.slice(0, MAX_REPO_DOC_COUNT);

    for (const doc of docsToRead) {
      const docPath = typeof doc.path === 'string' ? doc.path.trim() : '';
      if (!docPath) {
        continue;
      }

      try {
        const file = await this.containerManagerHttpClient.readSessionFile(
          normalizedSessionId,
          docPath,
        );
        const trimmedContent =
          typeof file.content === 'string' ? file.content.trim() : '';
        if (!trimmedContent) {
          continue;
        }

        const normalizedContent =
          trimmedContent.length > MAX_REPO_DOC_CHARS
            ? `${trimmedContent.slice(0, MAX_REPO_DOC_CHARS)}\n${REPO_DOC_TRUNCATION_SUFFIX}`
            : trimmedContent;

        readableDocs.push({
          path: docPath,
          content: normalizedContent,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to read repo doc ${docPath} for session ${normalizedSessionId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return readableDocs.length > 0 ? readableDocs : undefined;
  }

  private parseExecutionResultMetadata(
    metadata: Record<string, unknown> | null | undefined,
  ): {
    output?: string;
    model?: string;
    provider?: string;
    fileActions: ExecutionResultDto['fileActions'];
  } {
    if (!metadata || typeof metadata !== 'object') {
      return { fileActions: [] };
    }

    const aiExecutionResult = metadata.aiExecutionResult;
    if (!aiExecutionResult || typeof aiExecutionResult !== 'object') {
      return { fileActions: [] };
    }

    const aiResult = aiExecutionResult as Record<string, unknown>;
    const output =
      typeof aiResult.output === 'string' ? aiResult.output : undefined;
    const model =
      typeof aiResult.model === 'string' ? aiResult.model : undefined;
    const provider =
      typeof aiResult.provider === 'string' ? aiResult.provider : undefined;

    const rawActions = Array.isArray(aiResult.fileActions)
      ? aiResult.fileActions
      : [];

    const fileActions: FileActionDto[] = [];
    for (const action of rawActions) {
      if (!action || typeof action !== 'object') continue;
      const value = action as Record<string, unknown>;
      if (
        (value.action === 'create' ||
          value.action === 'write' ||
          value.action === 'update') &&
        typeof value.path === 'string' &&
        typeof value.content === 'string'
      ) {
        fileActions.push({
          action: value.action,
          path: value.path,
          content: value.content,
        });
      } else if (value.action === 'delete' && typeof value.path === 'string') {
        fileActions.push({
          action: value.action,
          path: value.path,
        });
      }
    }

    return { output, model, provider, fileActions };
  }

  private resolveProvider(
    requestProvider: string | undefined,
  ): SupportedAiProvider {
    if (!requestProvider) {
      const envProvider = process.env.AI_PROVIDER;
      if (envProvider && SUPPORTED_AI_PROVIDERS.includes(envProvider as SupportedAiProvider)) {
        return envProvider as SupportedAiProvider;
      }
      return 'stub';
    }

    if (!SUPPORTED_AI_PROVIDERS.includes(requestProvider as SupportedAiProvider)) {
      throw new BadRequestException(
        `provider must be one of: ${SUPPORTED_AI_PROVIDERS.join(', ')}`,
      );
    }

    return requestProvider as SupportedAiProvider;
  }

  /**
   * Execute AI request (async — Phase 44.4D)
   *
   * POST /api/ai/execute
   *
   * Phase 20A: Requires API key authentication
   * Phase 20B: Requires 'ai:execute' scope authorization
   * Phase 26B: Enforces kill switches and global safety limits
   * Phase 28B-1: Enforces launch state restrictions
   * Phase 28B-2: Enforces abort mode restrictions
   * Phase 43A-2C: Checks idempotency BEFORE quota (retry-safe)
   * Phase 21B: Requires quota availability
   * Phase 42A-3: Enforces token quota (rolling 24h)
   * Phase 43B-2B: Writes execution intent BEFORE queue submission
   * Phase 44.4D: Enqueues job for async execution, returns immediately
   * Phase 41B: Rate limited to 20 requests per minute per IP
   * Phase 43A-2B: Accepts optional Idempotency-Key header for idempotent retries
   *
   * Returns 202 Accepted with { executionId, status: 'queued' }.
   * AI execution is handled asynchronously by the worker.
   * Throws 401 on authentication failure
   * Throws 403 on authorization failure, launch state restriction, or token quota exceeded
   * Throws 400 on invalid request (e.g., max_tokens too high, invalid Idempotency-Key)
   * Throws 409 on concurrent execution with same Idempotency-Key
   * Throws 429 on rate limit exceeded
   * Throws 503 on kill switch disabled, safety limit reached, or abort mode active
   * Throws 500 on ledger write failure or queue submission failure
   */
  @Post('execute')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(SessionOrApiKeyAuthGuard, AuthorizationGuard, ExecutionSafetyGuard, LaunchGuard, AbortGuard, IdempotencyGuard, QuotaGuard, TokenQuotaGuard, RateLimitGuard)
  @RequireScope('ai:execute')
  @RateLimit({ maxRequests: 20, windowMs: 60000 })
  async execute(
    @Body() request: AIExecutionRequest,
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ): Promise<{ executionId: string; status: string }> {
    // Phase 43B-2-HOTFIX: IdempotencyGuard now throws IdempotentReplayException
    // instead of attaching to request. No need to check req.idempotentResult.
    // If we reach here, it's NOT a replay (or replay was for 'timeout'/'failed' status).

    // AGENT-HARNESS-05B9: Validate sessionId is a valid UUID before any ledger write or enqueue
    if (!uuidValidate(request.sessionId)) {
      throw new BadRequestException('sessionId must be a valid UUID');
    }

    // AGENT-HARNESS-05C2: Validate harnessVersion allow-list before any side effects
    if (request.harnessVersion !== undefined) {
      if (typeof request.harnessVersion !== 'string' || request.harnessVersion !== 'v1') {
        throw new BadRequestException("harnessVersion must be 'v1' when provided");
      }
    }

    // AGENT-HARNESS-05C5: Session ownership enforcement
    const session = await this.sessionService.getSessionById(request.sessionId);
    if (session.userId !== identity.userId) {
      throw new NotFoundException(
        `Session with ID ${request.sessionId} not found`,
      );
    }

    // Phase 43A-2B: Validate and normalize idempotency key
    let requestId: string | undefined;
    if (idempotencyKey !== undefined) {
      // Normalize: trim whitespace
      const normalized = idempotencyKey.trim();
      
      // Validate: must not be empty
      if (normalized.length === 0) {
        throw new BadRequestException('Idempotency-Key must not be empty');
      }
      
      // Validate: must not exceed 100 characters (matches DB constraint)
      if (normalized.length > 100) {
        throw new BadRequestException('Idempotency-Key must not exceed 100 characters');
      }
      
      requestId = normalized;
    }

    // ADV-01-01: Request-level provider selection with bounded allow-list.
    const provider = this.resolveProvider(request.provider);
    const requestedModel =
      typeof request.model === 'string' && request.model.trim().length > 0
        ? request.model.trim()
        : undefined;
    const globalInstructions = this.normalizeGlobalInstructions(
      await this.userAiInstructionsService.getByUserId(identity.userId),
    );
    const projectInstructions = await this.resolveProjectInstructions(
      request.sessionId,
      identity.userId,
    );
    const repoDocContents = await this.resolveRepoDocContents(
      request.sessionId,
      identity.userId,
    );
    const enrichedWorkspaceContext =
      repoDocContents && repoDocContents.length > 0
        ? {
            ...(request.workspaceContext ?? { filePaths: [] }),
            filePaths: Array.isArray(request.workspaceContext?.filePaths)
              ? request.workspaceContext.filePaths
              : [],
            repoDocContents,
          }
        : request.workspaceContext;
    this.logger.debug(
      `Global AI instructions ${globalInstructions ? 'present' : 'absent'} for user ${identity.userId}`,
    );
    this.logger.debug(
      `Project AI instructions ${projectInstructions ? 'present' : 'absent'} for session ${request.sessionId}`,
    );
    this.logger.debug(
      `Repo doc context ${repoDocContents ? 'present' : 'absent'} for session ${request.sessionId}`,
    );

    // Phase 43B-4 HOTFIX: Check if retry after timeout/failed
    // If existing record is timeout/failed, reuse the row instead of inserting new
    let executionId: string;
    let flow: 'new' | 'reuse'; // PHASE-43C-1: track intent flow for telemetry
    if (requestId) {
      const existingRecord = await this.usageLedgerService.findByRequestId(
        identity.userId,
        requestId,
      );
      
      if (
        existingRecord &&
        (existingRecord.executionStatus === 'timeout' ||
          existingRecord.executionStatus === 'failed')
      ) {
        // Reuse existing row (UPDATE, not INSERT) to avoid UNIQUE constraint violation
        executionId = await this.usageLedgerService.reuseExecutionIntent({
          requestId,
          userId: identity.userId,
          apiKeyId: identity.apiKeyId,
          sessionId: request.sessionId,
          conversationId: request.conversationId,
          provider,
          adapter: provider,
          metadata: {
            ...request.metadata,
            apiKeyId: identity.apiKeyId, // INJECTED for audit
            requestedProvider: provider,
            requestedModel: requestedModel ?? null,
          },
        });
        flow = 'reuse';
      } else {
        // Normal flow: create new execution intent
        executionId = uuidv4();
        await this.usageLedgerService.writeExecutionIntent({
          executionId,
          apiKeyId: identity.apiKeyId,
          userId: identity.userId,
          sessionId: request.sessionId,
          conversationId: request.conversationId,
          provider,
          adapter: provider,
          requestId,
          metadata: {
            ...request.metadata,
            apiKeyId: identity.apiKeyId, // INJECTED for audit
            requestedProvider: provider,
            requestedModel: requestedModel ?? null,
          },
        });
        flow = 'new';
      }
    } else {
      // No requestId: normal flow
      executionId = uuidv4();
      await this.usageLedgerService.writeExecutionIntent({
        executionId,
        apiKeyId: identity.apiKeyId,
        userId: identity.userId,
        sessionId: request.sessionId,
        conversationId: request.conversationId,
        provider,
        adapter: provider,
        requestId,
        metadata: {
          ...request.metadata,
          apiKeyId: identity.apiKeyId, // INJECTED for audit
          requestedProvider: provider,
          requestedModel: requestedModel ?? null,
        },
      });
      flow = 'new';
    }

    // PHASE-43C-1: Emit execution.intent_written after intent record is established
    this.logger.log(JSON.stringify({
      event: 'execution.intent_written',
      timestamp: new Date().toISOString(),
      userId: identity.userId,
      apiKeyId: identity.apiKeyId,
      requestId: requestId ?? null,
      executionId,
      status: 'pending',
      flow,
      provider,
    }));

    // Phase 44.4D: Enqueue execution job for async processing.
    // Intent is already written to ledger (status='pending').
    // Worker will claim, execute, and finalize the ledger record.
    const submittedAt = new Date().toISOString();
    await this.queueService.enqueueExecution({
      executionId,
      userId: identity.userId,
      apiKeyId: identity.apiKeyId,
      sessionId: request.sessionId,
      conversationId: request.conversationId,
      provider,
      adapter: provider,
      prompt: request.prompt,
      workspaceContext: enrichedWorkspaceContext,
      model: requestedModel,
      globalInstructions,
      projectInstructions,
      requestId,
      submittedAt,
      ...(request.harnessVersion !== undefined && { harnessVersion: request.harnessVersion }),
    });

    // Phase 44.4D: Return immediately — do NOT wait for AI execution.
    return {
      executionId,
      status: 'queued',
    };
  }

  /**
   * Request cancellation of a running execution (Phase 47.2)
   *
   * POST /api/ai/executions/:executionId/cancel
   *
   * Updates ledger to cancel_requested when execution is running.
   * Returns 409 Conflict if execution cannot be cancelled.
   */
  @Post('executions/:executionId/cancel')
  @UseGuards(SessionOrApiKeyAuthGuard)
  async cancelExecution(
    @Param('executionId') executionId: string,
  ): Promise<{ executionId: string; status: string }> {
    const result = await this.executionResultService.requestCancel(executionId);

    if (!result) {
      throw new ConflictException('Execution cannot be cancelled');
    }

    return {
      executionId,
      status: 'cancel_requested',
    };
  }

  /**
   * Get execution status
   *
   * GET /api/ai/executions/:executionId
   *
   * Phase 45.2: Execution status endpoint
   * Phase 45.4: Execution status mapping to public DTO
   *
   * Returns execution status from ledger.
   * Throws 404 if execution not found.
   */
  @Get('executions/:executionId')
  @UseGuards(SessionOrApiKeyAuthGuard)
  async getExecution(
    @Param('executionId') executionId: string,
  ): Promise<ExecutionResultDto> {
    const execution = await this.executionResultService.getExecution(executionId);

    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    let status: ExecutionResultDto['status'];

    switch (execution.execution_status) {
      case 'pending':
        status = 'queued';
        break;
      case 'running':
        status = 'running';
        break;
      case 'completed':
        status = 'completed';
        break;
      case 'failed':
        status = 'failed';
        break;
      case 'cancel_requested':
      case 'cancelled':
        status = 'cancelled';
        break;
      case 'timeout':
        status = 'timeout';
        break;
      default:
        status = 'queued';
    }

    const response: ExecutionResultDto = {
      executionId: execution.execution_id,
      status,
    };

    if (status === 'completed') {
      response.tokensUsed = execution.tokens_used ?? undefined;
      const parsed = this.parseExecutionResultMetadata(execution.metadata);
      response.output = parsed.output;
      const resolvedModel =
        parsed.model ?? (typeof execution.model === 'string' ? execution.model : undefined);
      const resolvedProvider =
        parsed.provider ??
        (typeof execution.provider === 'string' ? execution.provider : undefined);
      if (resolvedModel) {
        response.model = resolvedModel;
      }
      if (resolvedProvider) {
        response.provider = resolvedProvider;
      }
      response.fileActions = parsed.fileActions;
    } else {
      if (typeof execution.model === 'string') {
        response.model = execution.model;
      }
      if (typeof execution.provider === 'string') {
        response.provider = execution.provider;
      }
    }

    return response;
  }

  /**
   * Stream execution tokens
   *
   * GET /api/ai/executions/:executionId/stream
   *
   * Phase 46.3: SSE streaming endpoint
   *
   * Subscribes to Redis channel ai-execution-stream:{executionId}
   * and forwards incoming tokens to client via Server-Sent Events.
   *
   * Non-blocking. If no client connects, execution completes normally.
   */
  @Sse('executions/:executionId/stream')
  @UseGuards(SessionOrApiKeyAuthGuard)
  streamExecution(
    @Param('executionId') executionId: string,
  ): Observable<MessageEvent> {
    return new Observable((observer) => {

      this.executionStreamService.subscribe(
        executionId,
        (token: string) => {
          observer.next({ data: token });
        }
      );

      return () => {
        this.executionStreamService.unsubscribe(executionId);
      };
    });
  }
}
