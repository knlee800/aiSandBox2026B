import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { validate as uuidValidate } from 'uuid';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator';
import type { ApiKeyIdentity } from '../auth/api-key.config';
import { SessionOrApiKeyAuthGuard } from '../auth/session-or-api-key.guard';
import type { CollaborationRunStatus } from './orchestration.contracts';
import {
  CollaborationResultsService,
  RESULTS_PAGE_MAX,
  RESULTS_PAGE_SIZE_DEFAULT,
  RESULTS_PAGE_SIZE_MAX,
  RESULTS_STATUS_FILTERS,
  type CollaborationResultsPage,
  type CollaborationResultsQuery,
} from './collaboration-results';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const POSITIVE_INTEGER = /^[1-9]\d{0,5}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function readSingle(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} must be given once`);
  }
  return value;
}

function readStatus(value: unknown): CollaborationRunStatus | null {
  const raw = readSingle(value, 'status');
  if (raw === undefined) {
    return null;
  }
  if (!(RESULTS_STATUS_FILTERS as readonly string[]).includes(raw)) {
    throw new BadRequestException(
      'status must be completed, failed, timed_out, cancelled, or active',
    );
  }
  return raw as CollaborationRunStatus;
}

function readWorkflowId(value: unknown): string | null {
  const raw = readSingle(value, 'workflowId');
  if (raw === undefined) {
    return null;
  }
  if (!uuidValidate(raw)) {
    throw new BadRequestException('workflowId must be a valid UUID');
  }
  return raw.toLowerCase();
}

/**
 * An ISO date (a UTC day) or an ISO date-time with a zone. A day bound covers
 * the whole day: from starts at 00:00Z, to ends just before the next 00:00Z.
 */
function readDateBound(value: unknown, field: 'from' | 'to'): Date | null {
  const raw = readSingle(value, field);
  if (raw === undefined) {
    return null;
  }
  const invalid = () => new BadRequestException(`${field} must be an ISO date or date-time`);
  const day = DATE_ONLY.exec(raw);
  if (day) {
    const start = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== raw) {
      throw invalid();
    }
    return field === 'from' ? start : new Date(start.getTime() + DAY_MS - 1);
  }
  if (!DATE_TIME.test(raw)) {
    throw invalid();
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw invalid();
  }
  return parsed;
}

function readPositiveInteger(
  value: unknown,
  field: 'page' | 'pageSize',
  fallback: number,
  max: number,
): number {
  const raw = readSingle(value, field);
  if (raw === undefined) {
    return fallback;
  }
  if (!POSITIVE_INTEGER.test(raw)) {
    throw new BadRequestException(`${field} must be a whole number from 1 to ${max}`);
  }
  const parsed = Number(raw);
  if (parsed > max) {
    throw new BadRequestException(`${field} must be a whole number from 1 to ${max}`);
  }
  return parsed;
}

/** D8: every query value is checked; a bad one is 400. */
export function readCollaborationResultsQuery(
  query: Record<string, unknown> | undefined,
): CollaborationResultsQuery {
  const source = query ?? {};
  const from = readDateBound(source.from, 'from');
  const to = readDateBound(source.to, 'to');
  if (from && to && from.getTime() > to.getTime()) {
    throw new BadRequestException('from must not be after to');
  }
  return {
    status: readStatus(source.status),
    workflowId: readWorkflowId(source.workflowId),
    from,
    to,
    page: readPositiveInteger(source.page, 'page', 1, RESULTS_PAGE_MAX),
    pageSize: readPositiveInteger(
      source.pageSize,
      'pageSize',
      RESULTS_PAGE_SIZE_DEFAULT,
      RESULTS_PAGE_SIZE_MAX,
    ),
  };
}

/**
 * RESULTS-01 login routes (D7). Same guard and entitlement rule as the
 * collaboration routes: 401 without identity, 403 without harness access,
 * 404 for a run that is missing or someone else's.
 *
 * GET  /api/results?status=&workflowId=&from=&to=&page=&pageSize=
 * GET  /api/results/unread-count
 * POST /api/results/:runId/seen
 *
 * The detail stays GET /api/collaboration/runs/:id, unchanged (D13).
 */
@Controller('results')
@UseGuards(SessionOrApiKeyAuthGuard)
export class CollaborationResultsController {
  constructor(private readonly results: CollaborationResultsService) {}

  @Get()
  async list(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Query() query: Record<string, unknown>,
  ): Promise<CollaborationResultsPage> {
    const caller = this.assertEntitled(identity);
    const parsed = readCollaborationResultsQuery(query);
    return this.results.listForOwner(caller.userId, parsed);
  }

  @Get('unread-count')
  async unreadCount(@AuthenticatedUser() identity: ApiKeyIdentity): Promise<{ count: number }> {
    const caller = this.assertEntitled(identity);
    return { count: await this.results.unreadCount(caller.userId) };
  }

  @Post(':runId/seen')
  @HttpCode(HttpStatus.OK)
  async markSeen(
    @AuthenticatedUser() identity: ApiKeyIdentity,
    @Param('runId') runId: string,
  ): Promise<{ seenAt: string }> {
    const caller = this.assertEntitled(identity);
    const seen = await this.results.markSeen(caller.userId, runId);
    if (!seen) {
      throw new NotFoundException('Collaboration run not found');
    }
    return seen;
  }

  /** The same rule as CollaborationController.assertEntitled. */
  private assertEntitled(identity: ApiKeyIdentity | undefined): ApiKeyIdentity {
    if (!identity?.userId || typeof identity.apiKeyId !== 'string' || identity.apiKeyId.length === 0) {
      throw new UnauthorizedException('Missing authentication credentials');
    }
    if (identity.harnessEntitled !== true) {
      throw new ForbiddenException('Forbidden');
    }
    return identity;
  }
}
