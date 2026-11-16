/**
 * TRIGGER-CHAIN-01 (stage-start section 4): the chain triggers switch.
 *
 * CHAIN_TRIGGERS_ENABLED gates only the chain timer and its run reads (slice
 * S2). The chain trigger routes keep working while it is off and report
 * `enabled: false`, so the owner's data stays reachable. Only the exact
 * string 'true' is on; unset, empty, 'TRUE', '1', ' true' and anything else
 * is off (the same rule as SCHEDULES_ENABLED, EVENT_TRIGGERS_ENABLED,
 * MAIL_TRIGGERS_ENABLED and KNOWLEDGE_TRIGGERS_ENABLED).
 *
 * One switch per trigger type: it is not KNOWLEDGE_TRIGGERS_ENABLED, so each
 * type can be stopped alone. It never turns runs on and never turns the run
 * result tool on: GLOBAL_EXECUTION_ENABLED, the provider switches, the result
 * tool's own switch, credits and caps still apply. A tester window never sets
 * it.
 *
 * Read live on every call, so a restart is not needed for tests and the value
 * is never cached at import time.
 */
export const CHAIN_TRIGGERS_ENABLED_ENV = 'CHAIN_TRIGGERS_ENABLED';

export function isChainTriggersEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[CHAIN_TRIGGERS_ENABLED_ENV] === 'true';
}
