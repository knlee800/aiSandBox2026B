import { readFileSync } from 'fs';
import { join } from 'path';
import { CHAT_DISCORD_ENABLED_ENV, isChatDiscordEnabled } from './chat-switch';

describe('isChatDiscordEnabled (CHAT-DISCORD-01 A1)', () => {
  const original = process.env.CHAT_DISCORD_ENABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CHAT_DISCORD_ENABLED;
    } else {
      process.env.CHAT_DISCORD_ENABLED = original;
    }
  });

  it('reads the CHAT_DISCORD_ENABLED variable', () => {
    expect(CHAT_DISCORD_ENABLED_ENV).toBe('CHAT_DISCORD_ENABLED');
  });

  it('is on only for the exact string true', () => {
    expect(isChatDiscordEnabled({ CHAT_DISCORD_ENABLED: 'true' })).toBe(true);
  });

  it('is off when unset (the default)', () => {
    expect(isChatDiscordEnabled({})).toBe(false);
  });

  it.each(['', 'false', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'true\n'])(
    'is off for %j',
    (value) => {
      expect(isChatDiscordEnabled({ CHAT_DISCORD_ENABLED: value })).toBe(false);
    },
  );

  it('reads process.env live on every call', () => {
    delete process.env.CHAT_DISCORD_ENABLED;
    expect(isChatDiscordEnabled()).toBe(false);
    process.env.CHAT_DISCORD_ENABLED = 'true';
    expect(isChatDiscordEnabled()).toBe(true);
    process.env.CHAT_DISCORD_ENABLED = 'false';
    expect(isChatDiscordEnabled()).toBe(false);
  });

  it('uses the same exact-string rule as the global execution switch', () => {
    const killSwitch = readFileSync(
      join(__dirname, '..', 'safety', 'kill-switch.config.ts'),
      'utf8',
    );
    expect(killSwitch).toContain("process.env.GLOBAL_EXECUTION_ENABLED === 'true'");
    const source = readFileSync(join(__dirname, 'chat-switch.ts'), 'utf8');
    expect(source).toContain("env[CHAT_DISCORD_ENABLED_ENV] === 'true'");
  });
});
