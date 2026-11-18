import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  GatewayTimeoutException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MAIL_SIGN_IN_REFUSED_MESSAGE } from '../connectors/connector-servers';
import { SCHEDULE_SKIP_REASONS } from './schedule-refusal';
import {
  MAIL_TRIGGER_DAY_LIMIT,
  MAIL_TRIGGER_DAY_ROW_CAP,
  MAIL_TRIGGER_RUN_AUDIT_EVENTS,
  MAIL_TRIGGER_SKIP_REASONS,
  mailReadFailureOf,
  mailTriggerCancelReason,
} from './mail-trigger-reasons';

/** TRIGGER-MAIL-01 S3 (stage-start section 6): the reason codes, limits and audit event names. */

describe('mail trigger reasons (TRIGGER-MAIL-01 S3)', () => {
  it('the schedule codes without missed, in order, then day_limit; no new reason code', () => {
    expect(SCHEDULE_SKIP_REASONS).toHaveLength(14);
    expect(MAIL_TRIGGER_SKIP_REASONS).toEqual([
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
      'interrupted',
      'refused',
      'day_limit',
    ]);
    expect(MAIL_TRIGGER_SKIP_REASONS.slice(0, 13)).toEqual(SCHEDULE_SKIP_REASONS.filter((code) => code !== 'missed'));
    for (const unused of ['missed', 'event_changed', 'calendar_read_failed', 'connector_missing', 'read_failed']) {
      expect(MAIL_TRIGGER_SKIP_REASONS as readonly string[]).not.toContain(unused);
    }
  });

  it('every code is unique, a plain code and fits agent_mail_trigger_runs.reason (varchar 32)', () => {
    expect(new Set(MAIL_TRIGGER_SKIP_REASONS).size).toBe(MAIL_TRIGGER_SKIP_REASONS.length);
    for (const code of MAIL_TRIGGER_SKIP_REASONS) {
      expect(code).toMatch(/^[a-z_]{1,32}$/);
    }
  });

  it('the cancel reason of a created and refused run names the code (fits the cancel reason column)', () => {
    expect(mailTriggerCancelReason('provider_off')).toBe('mail_trigger_skipped:provider_off');
    expect(mailTriggerCancelReason('over_cap')).toBe('mail_trigger_skipped:over_cap');
    for (const code of MAIL_TRIGGER_SKIP_REASONS) {
      expect(mailTriggerCancelReason(code)).toMatch(/^mail_trigger_skipped:[a-z_]+$/);
    }
  });

  it('the audit event names of stage-start section 6', () => {
    expect(MAIL_TRIGGER_RUN_AUDIT_EVENTS).toEqual({
      runStarted: 'mail_run_started',
      runSkipped: 'mail_run_skipped',
      triggerDisabled: 'mail_trigger_disabled',
      mailStateChanged: 'mail_state_changed',
    });
  });

  it("Keith's Q7: five starts per trigger per local day and twenty history rows per trigger per day", () => {
    expect(MAIL_TRIGGER_DAY_LIMIT).toBe(5);
    expect(MAIL_TRIGGER_DAY_ROW_CAP).toBe(20);
  });

  it('a read that answers 404 is connector_missing; every other failure is read_failed', () => {
    expect(mailReadFailureOf(new NotFoundException('Connection not found'))).toBe('connector_missing');
    for (const error of [
      new ServiceUnavailableException('busy'),
      new GatewayTimeoutException('timeout'),
      new BadGatewayException('bad result'),
      new BadRequestException('bad since'),
      new Error('Connector credentials key is not configured'),
      'not an error',
      null,
    ]) {
      expect(mailReadFailureOf(error)).toBe('read_failed');
    }
  });

  it('CONN-MAIL-AUTH-STATE-01 D4: only a 409 with the broker fixed refused-password text is sign_in_refused', () => {
    expect(mailReadFailureOf(new ConflictException(MAIL_SIGN_IN_REFUSED_MESSAGE))).toBe('sign_in_refused');
    for (const error of [
      new ConflictException('Conflict'),
      new ConflictException(`${MAIL_SIGN_IN_REFUSED_MESSAGE} `),
      new ServiceUnavailableException(MAIL_SIGN_IN_REFUSED_MESSAGE),
      new BadGatewayException(MAIL_SIGN_IN_REFUSED_MESSAGE),
      new Error(MAIL_SIGN_IN_REFUSED_MESSAGE),
    ]) {
      expect(mailReadFailureOf(error)).toBe('read_failed');
    }
    expect(mailReadFailureOf(new NotFoundException(MAIL_SIGN_IN_REFUSED_MESSAGE))).toBe('connector_missing');
  });

  it('the file reads no table, broker, clock or message text', () => {
    const source = readFileSync(join(__dirname, 'mail-trigger-reasons.ts'), 'utf8');
    expect(source).not.toMatch(/Repository|ConnectorBroker|readRecentMail|new Date|Date\.now|fromAddress|subject\b/);
  });
});
