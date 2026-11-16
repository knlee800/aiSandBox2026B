import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CHAIN_TRIGGER_DAY_LIMIT,
  CHAIN_TRIGGER_DAY_ROW_CAP,
  CHAIN_TRIGGER_RUN_AUDIT_EVENTS,
  CHAIN_TRIGGER_SKIP_REASONS,
  chainTriggerCancelReason,
} from './chain-trigger-reasons';
import { SCHEDULE_SKIP_REASONS } from './schedule-refusal';

/** TRIGGER-CHAIN-01 S2 (stage-start sections 3 and 4): the reason codes, limits and audit event names. */

describe('chain trigger reasons (TRIGGER-CHAIN-01 S2)', () => {
  it('the schedule codes without missed, in order, then day_limit and the one new code chain_depth', () => {
    expect(SCHEDULE_SKIP_REASONS).toHaveLength(14);
    expect(CHAIN_TRIGGER_SKIP_REASONS).toEqual([
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
      'chain_depth',
    ]);
    expect(CHAIN_TRIGGER_SKIP_REASONS.slice(0, 13)).toEqual(SCHEDULE_SKIP_REASONS.filter((code) => code !== 'missed'));
    expect(CHAIN_TRIGGER_SKIP_REASONS as readonly string[]).not.toContain('missed');
  });

  it('every code is unique, a plain code and fits agent_chain_trigger_runs.reason (varchar 32)', () => {
    expect(new Set(CHAIN_TRIGGER_SKIP_REASONS).size).toBe(CHAIN_TRIGGER_SKIP_REASONS.length);
    for (const code of CHAIN_TRIGGER_SKIP_REASONS) {
      expect(code).toMatch(/^[a-z_]{1,32}$/);
    }
  });

  it('the cancel reason of a created and refused run names the code', () => {
    expect(chainTriggerCancelReason('provider_off')).toBe('chain_trigger_skipped:provider_off');
    expect(chainTriggerCancelReason('chain_depth')).toBe('chain_trigger_skipped:chain_depth');
    for (const code of CHAIN_TRIGGER_SKIP_REASONS) {
      expect(chainTriggerCancelReason(code)).toMatch(/^chain_trigger_skipped:[a-z_]+$/);
    }
  });

  it('the audit event names of stage-start section 4', () => {
    expect(CHAIN_TRIGGER_RUN_AUDIT_EVENTS).toEqual({
      runStarted: 'chain_run_started',
      runSkipped: 'chain_run_skipped',
      triggerDisabled: 'chain_trigger_disabled',
    });
  });

  it("Keith's Q3: five starts per trigger per local day and twenty history rows per trigger per day", () => {
    expect(CHAIN_TRIGGER_DAY_LIMIT).toBe(5);
    expect(CHAIN_TRIGGER_DAY_ROW_CAP).toBe(20);
  });

  it('the file reads no table, clock or run, and names none of the pinned run result texts', () => {
    const source = readFileSync(join(__dirname, 'chain-trigger-reasons.ts'), 'utf8');
    expect(source).not.toMatch(/Repository|CollaborationRunEntity|collaboration_runs|new Date|Date\.now/);
    const pinned = [['run', 'Result', 'Read'].join(''), ['RUN', 'RESULT', 'TOOL', 'ENABLED'].join('_'), ['run', 'Result', 'Grant', 'Job', 'Fields'].join('')];
    for (const text of pinned) {
      expect(source).not.toContain(text);
    }
    expect(source).not.toContain('\r');
  });
});
