import { readFileSync } from 'fs';
import { join } from 'path';
import { SCHEDULES_ENABLED_ENV, isSchedulesEnabled } from './schedule-switch';

describe('isSchedulesEnabled (TRIGGER-01 S1)', () => {
  const original = process.env.SCHEDULES_ENABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SCHEDULES_ENABLED;
    } else {
      process.env.SCHEDULES_ENABLED = original;
    }
  });

  it('reads the SCHEDULES_ENABLED variable', () => {
    expect(SCHEDULES_ENABLED_ENV).toBe('SCHEDULES_ENABLED');
  });

  it('is on only for the exact string true', () => {
    expect(isSchedulesEnabled({ SCHEDULES_ENABLED: 'true' })).toBe(true);
  });

  it('is off when unset (the default)', () => {
    expect(isSchedulesEnabled({})).toBe(false);
  });

  it.each(['', 'false', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'true\n'])(
    'is off for %j',
    (value) => {
      expect(isSchedulesEnabled({ SCHEDULES_ENABLED: value })).toBe(false);
    },
  );

  it('reads process.env live on every call', () => {
    delete process.env.SCHEDULES_ENABLED;
    expect(isSchedulesEnabled()).toBe(false);
    process.env.SCHEDULES_ENABLED = 'true';
    expect(isSchedulesEnabled()).toBe(true);
    process.env.SCHEDULES_ENABLED = 'false';
    expect(isSchedulesEnabled()).toBe(false);
  });

  it('uses the same exact-string rule as the global execution switch and the chat switch', () => {
    const killSwitch = readFileSync(join(__dirname, '..', 'safety', 'kill-switch.config.ts'), 'utf8');
    expect(killSwitch).toContain("process.env.GLOBAL_EXECUTION_ENABLED === 'true'");
    const chat = readFileSync(join(__dirname, '..', 'chat', 'chat-switch.ts'), 'utf8');
    expect(chat).toContain("env[CHAT_DISCORD_ENABLED_ENV] === 'true'");
    const source = readFileSync(join(__dirname, 'schedule-switch.ts'), 'utf8');
    expect(source).toContain("env[SCHEDULES_ENABLED_ENV] === 'true'");
  });

  it('the gateway env template carries SCHEDULES_ENABLED=false with its comment line', () => {
    const template = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'ops', 'clean-baseline', 'env', 'gateway.env.template'),
      'utf8',
    );
    expect(template).toMatch(/^SCHEDULES_ENABLED=false$/m);
    const lines = template.split('\n');
    const index = lines.indexOf('SCHEDULES_ENABLED=false');
    expect(lines[index - 1]).toMatch(/^# Schedules \(TRIGGER-01\)\. Off unless exactly true;/);
    expect(lines[index - 1]).toContain('never turns runs on');
    expect(lines[index - 1]).toContain('tester window never sets it');
    expect(template.match(/^SCHEDULES_ENABLED=/gm)).toHaveLength(1);
  });
});
