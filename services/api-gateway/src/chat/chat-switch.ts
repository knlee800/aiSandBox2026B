/**
 * CHAT-DISCORD-01 (stage-start section 7): the Discord chat channel switch.
 *
 * CHAT_DISCORD_ENABLED gates the link routes now and, from slice B, the
 * Discord connection and delivery. Only the exact string 'true' is on; unset,
 * empty, 'TRUE', '1', ' true' and anything else is off (the same rule as
 * KillSwitchConfig.GLOBAL_EXECUTION_ENABLED, safety/kill-switch.config.ts).
 *
 * It never turns runs on: GLOBAL_EXECUTION_ENABLED, the provider switches,
 * credits and caps still apply to every run.
 *
 * Read live on every call, so a restart is not needed for tests and the value
 * is never cached at import time.
 */
export const CHAT_DISCORD_ENABLED_ENV = 'CHAT_DISCORD_ENABLED';

export function isChatDiscordEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[CHAT_DISCORD_ENABLED_ENV] === 'true';
}
