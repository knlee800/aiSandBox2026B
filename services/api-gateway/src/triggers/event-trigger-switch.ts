/**
 * TRIGGER-EVENT-01 (stage-start section 7): the event triggers switch.
 *
 * EVENT_TRIGGERS_ENABLED gates only the event timer and its calendar reads
 * (slice S3). The event trigger routes keep working while it is off and
 * report `enabled: false`, so the owner's data stays reachable. Only the
 * exact string 'true' is on; unset, empty, 'TRUE', '1', ' true' and anything
 * else is off (the same rule as SCHEDULES_ENABLED, schedule-switch.ts, and
 * KillSwitchConfig.GLOBAL_EXECUTION_ENABLED).
 *
 * It is not SCHEDULES_ENABLED: schedules can stay on while event triggers are
 * off. It never turns runs on: GLOBAL_EXECUTION_ENABLED, the provider
 * switches, credits and caps still apply to every run. A tester window never
 * sets it.
 *
 * Read live on every call, so a restart is not needed for tests and the value
 * is never cached at import time.
 */
export const EVENT_TRIGGERS_ENABLED_ENV = 'EVENT_TRIGGERS_ENABLED';

export function isEventTriggersEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[EVENT_TRIGGERS_ENABLED_ENV] === 'true';
}
