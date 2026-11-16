import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
} from '@nestjs/common';
import {
  CollaborationResultsService,
  type CollaborationRunResultRead,
} from './collaboration-results';

/** Same pattern as the internal knowledge routes use for userId. */
const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A run id: 1 to 128 letters, digits, `_` or `-` (stage-start section 3). */
const RUN_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const RUN_RESULT_ERRORS = Object.freeze({
  notFound: 'Run result not found.',
  userInvalid: 'The user id is not valid.',
});

export const RUN_RESULT_ERROR_CODES = Object.freeze({
  notFound: 'NOT_FOUND',
  userInvalid: 'USER_INVALID',
});

/**
 * RESULT-TOOL-01 S1: the harness's read of one finished run result.
 * POST /api/internal/collaboration/results/read
 *
 * Protected by the global InternalServiceAuthGuard (X-Internal-Service-Key);
 * no other guard. userId is the signed job's owner; runId names the run.
 * Other body fields are ignored. A missing run, another owner's run, a run
 * that is not completed, a run with no completed step and a blank answer all
 * answer the same 404. Reads only; records no audit row and logs nothing.
 */
@Controller('internal/collaboration/results')
export class InternalCollaborationResultsController {
  constructor(private readonly resultsService: CollaborationResultsService) {}

  @Post('read')
  @HttpCode(HttpStatus.OK)
  async read(@Body() body: unknown): Promise<CollaborationRunResultRead> {
    const record = readBody(body);
    const userId = readUserId(record);
    const runId = record.runId;
    if (typeof runId !== 'string' || !RUN_ID_PATTERN.test(runId)) {
      throw runResultNotFound();
    }
    const result = await this.resultsService.readFinalAnswerForOwner(userId, runId);
    if (!result) {
      throw runResultNotFound();
    }
    return {
      runId: result.runId,
      status: result.status,
      finishedAt: result.finishedAt,
      workflow: result.workflow
        ? { name: result.workflow.name, testRun: result.workflow.testRun }
        : null,
      answer: result.answer,
      truncated: result.truncated,
    };
  }
}

export function runResultNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    message: RUN_RESULT_ERRORS.notFound,
    error: 'Not Found',
    code: RUN_RESULT_ERROR_CODES.notFound,
  });
}

function readBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  return body as Record<string, unknown>;
}

function readUserId(record: Record<string, unknown>): string {
  const userId = record.userId;
  if (typeof userId !== 'string' || !USER_ID_PATTERN.test(userId)) {
    throw new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      message: RUN_RESULT_ERRORS.userInvalid,
      error: 'Bad Request',
      code: RUN_RESULT_ERROR_CODES.userInvalid,
    });
  }
  return userId;
}
