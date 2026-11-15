import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { chatRunRefusalOf } from '../chat/chat-run.service';
import { workflowRefusal, WORKFLOW_REFUSAL_CODES } from '../orchestration/collaboration-workflow';
import { SCHEDULE_SKIP_REASONS, scheduleRefusalOf } from './schedule-refusal';

/**
 * TRIGGER-01 S2 decision D5: the schedule mapper has the rules of
 * chatRunRefusalOf, pinned here against the same errors. Two chat codes have
 * no schedule meaning and are translated: workflow_not_found is workflow_gone,
 * bad_task is refused.
 */

const CHAT_TO_SCHEDULE: Readonly<Record<string, string>> = {
  workflow_not_found: 'workflow_gone',
  bad_task: 'refused',
};

const ERRORS: Array<[string, unknown]> = [
  ['a plain Error', new Error('boom')],
  ['a string', 'nope'],
  ['workflow not found', workflowRefusal(WORKFLOW_REFUSAL_CODES.notFound)],
  ['workflow off', workflowRefusal(WORKFLOW_REFUSAL_CODES.disabled)],
  ['workflow invalid', workflowRefusal(WORKFLOW_REFUSAL_CODES.invalid)],
  ['workflow not tested', workflowRefusal(WORKFLOW_REFUSAL_CODES.notTested)],
  ['workflow day budget', workflowRefusal(WORKFLOW_REFUSAL_CODES.budgetDay)],
  ['workflow run budget', workflowRefusal(WORKFLOW_REFUSAL_CODES.budgetRun)],
  ['402 credits', new HttpException({ statusCode: 402, message: 'Insufficient credit balance' }, 402)],
  [
    '429 daily cap',
    new HttpException(
      { statusCode: 429, message: 'Daily credit limit reached', error: 'Too Many Requests', cap: 'user' },
      HttpStatus.TOO_MANY_REQUESTS,
    ),
  ],
  ['429 token quota (string body)', new HttpException('Token quota exceeded', HttpStatus.TOO_MANY_REQUESTS)],
  ['503 runs off', new ServiceUnavailableException('AI execution temporarily disabled for maintenance')],
  ['503 provider off', new ServiceUnavailableException('Provider anthropic temporarily unavailable')],
  ['503 credits', new ServiceUnavailableException('Insufficient credit balance')],
  ['503 token quota', new ServiceUnavailableException('Token quota exceeded')],
  ['503 cap check failed', new ServiceUnavailableException('Daily credit limit check failed')],
  ['503 workflows unavailable', new ServiceUnavailableException('Workflows are unavailable')],
  ['400 task required', new BadRequestException('task is required')],
  ['400 task too long', new BadRequestException('task must be at most 8000 characters')],
  ['400 other', new BadRequestException('sessionId must be a valid UUID')],
  ['409 session', new ConflictException('Session is not usable')],
];

describe('scheduleRefusalOf (TRIGGER-01 S2 D5)', () => {
  it.each(ERRORS)('%s: the chat mapper rule, translated where the chat code has no schedule meaning', (_name, error) => {
    const chat = chatRunRefusalOf(error);
    expect(scheduleRefusalOf(error)).toBe(CHAT_TO_SCHEDULE[chat] ?? chat);
  });

  it.each([
    ['runs_off', new ServiceUnavailableException('AI execution temporarily disabled for maintenance')],
    ['provider_off', new ServiceUnavailableException('Provider anthropic temporarily unavailable')],
    ['no_credits', new HttpException({ statusCode: 402, message: 'Insufficient credit balance' }, 402)],
    ['no_credits', new ServiceUnavailableException('Insufficient credit balance')],
    ['over_cap', new HttpException({ statusCode: 429, message: 'Daily credit limit reached' }, 429)],
    ['over_cap', new ServiceUnavailableException('Token quota exceeded')],
    ['workflow_gone', workflowRefusal(WORKFLOW_REFUSAL_CODES.notFound)],
    ['workflow_off', workflowRefusal(WORKFLOW_REFUSAL_CODES.disabled)],
    ['workflow_invalid', workflowRefusal(WORKFLOW_REFUSAL_CODES.invalid)],
    ['workflow_not_tested', workflowRefusal(WORKFLOW_REFUSAL_CODES.notTested)],
    ['workflow_budget', workflowRefusal(WORKFLOW_REFUSAL_CODES.budgetRun)],
    ['refused', new Error('x')],
    ['refused', new BadRequestException('task is required')],
  ])('%s', (reason, error) => {
    expect(scheduleRefusalOf(error)).toBe(reason);
  });

  it('only answers codes of the stage-start section 5 table, and never text from the error', () => {
    const secret = 'MARKER-provider-said-something';
    for (const [, error] of ERRORS) {
      expect(SCHEDULE_SKIP_REASONS).toContain(scheduleRefusalOf(error));
    }
    expect(scheduleRefusalOf(new ServiceUnavailableException(secret))).toBe('refused');
    expect(scheduleRefusalOf(new HttpException({ message: secret, code: secret }, 409))).toBe('refused');
  });

  it('the reason codes are exactly the stage-start section 5 table', () => {
    expect([...SCHEDULE_SKIP_REASONS].sort()).toEqual(
      [
        'runs_off',
        'inactive',
        'not_entitled',
        'workflow_gone',
        'workflow_off',
        'workflow_not_tested',
        'workflow_invalid',
        'workflow_budget',
        'over_cap',
        'provider_off',
        'no_credits',
        'missed',
        'interrupted',
        'refused',
      ].sort(),
    );
    for (const reason of SCHEDULE_SKIP_REASONS) {
      // agent_schedule_runs.reason is varchar(32).
      expect(reason.length).toBeLessThanOrEqual(32);
    }
  });
});
