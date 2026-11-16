/**
 * TRIGGER-MAIL-01 (stage-start section 7): the mail triggers switch.
 *
 * MAIL_TRIGGERS_ENABLED gates only the mail timer and its mailbox sign-ins
 * (slice S3). The mail trigger routes keep working while it is off and report
 * `enabled: false`, so the owner's data stays reachable. Only the exact
 * string 'true' is on; unset, empty, 'TRUE', '1', ' true' and anything else
 * is off (the same rule as SCHEDULES_ENABLED and EVENT_TRIGGERS_ENABLED).
 *
 * It is not EVENT_TRIGGERS_ENABLED: the mail timer signs in to a third-party
 * mail host with a secret that opens the whole mailbox, so it can be stopped
 * alone. It never turns runs on: GLOBAL_EXECUTION_ENABLED, the provider
 * switches, credits and caps still apply to every run. A tester window never
 * sets it.
 *
 * Read live on every call, so a restart is not needed for tests and the value
 * is never cached at import time.
 */
export const MAIL_TRIGGERS_ENABLED_ENV = 'MAIL_TRIGGERS_ENABLED';

export function isMailTriggersEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[MAIL_TRIGGERS_ENABLED_ENV] === 'true';
}
