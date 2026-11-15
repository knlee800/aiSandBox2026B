/**
 * TRIGGER-01 (stage-start section 8): the schedules switch.
 *
 * SCHEDULES_ENABLED gates only the schedule timer (slice S2). The schedule
 * routes keep working while it is off and report `enabled: false`, so the
 * owner's data stays reachable. Only the exact string 'true' is on; unset,
 * empty, 'TRUE', '1', ' true' and anything else is off (the same rule as
 * KillSwitchConfig.GLOBAL_EXECUTION_ENABLED, safety/kill-switch.config.ts, and
 * chat/chat-switch.ts).
 *
 * It never turns runs on: GLOBAL_EXECUTION_ENABLED, the provider switches,
 * credits and caps still apply to every run. A tester window never sets it.
 *
 * Read live on every call, so a restart is not needed for tests and the value
 * is never cached at import time.
 */
export const SCHEDULES_ENABLED_ENV = 'SCHEDULES_ENABLED';

export function isSchedulesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[SCHEDULES_ENABLED_ENV] === 'true';
}
