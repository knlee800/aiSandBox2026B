import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SCHEDULE_SKIP_REASONS } from './schedule-refusal';
import {
  EVENT_TRIGGER_DAY_LIMIT,
  EVENT_TRIGGER_NEW_SKIP_REASONS,
  EVENT_TRIGGER_RUN_AUDIT_EVENTS,
  EVENT_TRIGGER_SKIP_REASONS,
  confirmReadReasonOf,
  eventTriggerCancelReason,
} from './event-trigger-reasons';

/** TRIGGER-EVENT-01 S3 (stage-start section 6): the reason codes and audit event names. */

describe('event trigger reasons (TRIGGER-EVENT-01 S3)', () => {
  it('the fourteen schedule codes are reused unchanged and in order, then the four new ones', () => {
    expect(SCHEDULE_SKIP_REASONS).toHaveLength(14);
    expect(EVENT_TRIGGER_SKIP_REASONS.slice(0, 14)).toEqual([...SCHEDULE_SKIP_REASONS]);
    expect(EVENT_TRIGGER_NEW_SKIP_REASONS).toEqual(['day_limit', 'event_changed', 'calendar_read_failed', 'connector_missing']);
    expect(EVENT_TRIGGER_SKIP_REASONS.slice(14)).toEqual([...EVENT_TRIGGER_NEW_SKIP_REASONS]);
  });

  it('every code is unique, a plain code and fits agent_event_trigger_runs.reason (varchar 32)', () => {
    expect(new Set(EVENT_TRIGGER_SKIP_REASONS).size).toBe(EVENT_TRIGGER_SKIP_REASONS.length);
    for (const code of EVENT_TRIGGER_SKIP_REASONS) {
      expect(code).toMatch(/^[a-z_]{1,32}$/);
    }
  });

  it('the cancel reason of a created and refused run names the code', () => {
    expect(eventTriggerCancelReason('provider_off')).toBe('event_trigger_skipped:provider_off');
    expect(eventTriggerCancelReason('over_cap')).toBe('event_trigger_skipped:over_cap');
  });

  it('the audit event names of stage-start section 6', () => {
    expect(EVENT_TRIGGER_RUN_AUDIT_EVENTS).toEqual({
      runStarted: 'event_run_started',
      runSkipped: 'event_run_skipped',
      triggerDisabled: 'event_trigger_disabled',
      calendarStateChanged: 'calendar_state_changed',
    });
  });

  it("Keith's Q5: three starts per trigger per local day", () => {
    expect(EVENT_TRIGGER_DAY_LIMIT).toBe(3);
  });

  it('a confirm read that answers 404 is connector_missing; every other failure is calendar_read_failed', () => {
    expect(confirmReadReasonOf(new NotFoundException('Connection not found'))).toBe('connector_missing');
    for (const error of [
      new ServiceUnavailableException('busy'),
      new BadGatewayException('bad result'),
      new BadRequestException('bad window'),
      new Error('Connector credentials key is not configured'),
      'not an error',
      null,
    ]) {
      expect(confirmReadReasonOf(error)).toBe('calendar_read_failed');
    }
  });
});
