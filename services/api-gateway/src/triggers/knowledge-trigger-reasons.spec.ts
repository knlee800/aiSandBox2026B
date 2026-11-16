import { readFileSync } from 'fs';
import { join } from 'path';
import {
  KNOWLEDGE_TRIGGER_DAY_LIMIT,
  KNOWLEDGE_TRIGGER_DAY_ROW_CAP,
  KNOWLEDGE_TRIGGER_RUN_AUDIT_EVENTS,
  KNOWLEDGE_TRIGGER_SKIP_REASONS,
  knowledgeTriggerCancelReason,
} from './knowledge-trigger-reasons';
import { MAIL_TRIGGER_SKIP_REASONS } from './mail-trigger-reasons';
import { SCHEDULE_SKIP_REASONS } from './schedule-refusal';

/** TRIGGER-MORE-01 S2 (stage-start section 5): the reason codes, limits and audit event names. */

describe('knowledge trigger reasons (TRIGGER-MORE-01 S2)', () => {
  it('the schedule codes without missed, in order, then day_limit; no new reason code (the mail list)', () => {
    expect(SCHEDULE_SKIP_REASONS).toHaveLength(14);
    expect(KNOWLEDGE_TRIGGER_SKIP_REASONS).toEqual([
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
    expect(KNOWLEDGE_TRIGGER_SKIP_REASONS.slice(0, 13)).toEqual(SCHEDULE_SKIP_REASONS.filter((code) => code !== 'missed'));
    expect([...KNOWLEDGE_TRIGGER_SKIP_REASONS]).toEqual([...MAIL_TRIGGER_SKIP_REASONS]);
    expect(KNOWLEDGE_TRIGGER_SKIP_REASONS as readonly string[]).not.toContain('missed');
  });

  it('every code is unique, a plain code and fits agent_knowledge_trigger_runs.reason (varchar 32)', () => {
    expect(new Set(KNOWLEDGE_TRIGGER_SKIP_REASONS).size).toBe(KNOWLEDGE_TRIGGER_SKIP_REASONS.length);
    for (const code of KNOWLEDGE_TRIGGER_SKIP_REASONS) {
      expect(code).toMatch(/^[a-z_]{1,32}$/);
    }
  });

  it('the cancel reason of a created and refused run names the code', () => {
    expect(knowledgeTriggerCancelReason('provider_off')).toBe('knowledge_trigger_skipped:provider_off');
    expect(knowledgeTriggerCancelReason('over_cap')).toBe('knowledge_trigger_skipped:over_cap');
    for (const code of KNOWLEDGE_TRIGGER_SKIP_REASONS) {
      expect(knowledgeTriggerCancelReason(code)).toMatch(/^knowledge_trigger_skipped:[a-z_]+$/);
    }
  });

  it('the audit event names of stage-start section 5', () => {
    expect(KNOWLEDGE_TRIGGER_RUN_AUDIT_EVENTS).toEqual({
      runStarted: 'knowledge_run_started',
      runSkipped: 'knowledge_run_skipped',
      triggerDisabled: 'knowledge_trigger_disabled',
    });
  });

  it("Keith's Q11: five starts per trigger per local day and fifty history rows per trigger per day", () => {
    expect(KNOWLEDGE_TRIGGER_DAY_LIMIT).toBe(5);
    expect(KNOWLEDGE_TRIGGER_DAY_ROW_CAP).toBe(50);
  });

  it('the file reads no table, clock or document', () => {
    const source = readFileSync(join(__dirname, 'knowledge-trigger-reasons.ts'), 'utf8');
    expect(source).not.toMatch(/Repository|KnowledgeDocument|knowledge_documents|new Date|Date\.now/);
  });
});
