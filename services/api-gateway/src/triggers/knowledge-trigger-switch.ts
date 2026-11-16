/**
 * TRIGGER-MORE-01 (stage-start section 5): the knowledge triggers switch.
 *
 * KNOWLEDGE_TRIGGERS_ENABLED gates only the knowledge timer and its document
 * reads (slice S2). The knowledge trigger routes keep working while it is off
 * and report `enabled: false`, so the owner's data stays reachable. Only the
 * exact string 'true' is on; unset, empty, 'TRUE', '1', ' true' and anything
 * else is off (the same rule as SCHEDULES_ENABLED, EVENT_TRIGGERS_ENABLED and
 * MAIL_TRIGGERS_ENABLED).
 *
 * One switch per trigger type: it is not MAIL_TRIGGERS_ENABLED, so each type
 * can be stopped alone. It never turns runs on: GLOBAL_EXECUTION_ENABLED, the
 * provider switches, credits and caps still apply to every run. A tester
 * window never sets it.
 *
 * Read live on every call, so a restart is not needed for tests and the value
 * is never cached at import time.
 */
export const KNOWLEDGE_TRIGGERS_ENABLED_ENV = 'KNOWLEDGE_TRIGGERS_ENABLED';

export function isKnowledgeTriggersEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[KNOWLEDGE_TRIGGERS_ENABLED_ENV] === 'true';
}
