import { readFileSync } from 'fs';
import { join } from 'path';
import { isEventTriggersEnabled } from './event-trigger-switch';
import { MAIL_TRIGGERS_ENABLED_ENV, isMailTriggersEnabled } from './mail-trigger-switch';
import { isSchedulesEnabled } from './schedule-switch';

describe('isMailTriggersEnabled (TRIGGER-MAIL-01 S2)', () => {
  const original = process.env.MAIL_TRIGGERS_ENABLED;
  const originalEvents = process.env.EVENT_TRIGGERS_ENABLED;
  const originalSchedules = process.env.SCHEDULES_ENABLED;

  afterEach(() => {
    for (const [name, value] of [
      ['MAIL_TRIGGERS_ENABLED', original],
      ['EVENT_TRIGGERS_ENABLED', originalEvents],
      ['SCHEDULES_ENABLED', originalSchedules],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('reads the MAIL_TRIGGERS_ENABLED variable', () => {
    expect(MAIL_TRIGGERS_ENABLED_ENV).toBe('MAIL_TRIGGERS_ENABLED');
  });

  it('is on only for the exact string true', () => {
    expect(isMailTriggersEnabled({ MAIL_TRIGGERS_ENABLED: 'true' })).toBe(true);
  });

  it('is off when unset (the default)', () => {
    expect(isMailTriggersEnabled({})).toBe(false);
  });

  it.each(['', 'false', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'true\n'])(
    'is off for %j',
    (value) => {
      expect(isMailTriggersEnabled({ MAIL_TRIGGERS_ENABLED: value })).toBe(false);
    },
  );

  it('reads process.env live on every call', () => {
    delete process.env.MAIL_TRIGGERS_ENABLED;
    expect(isMailTriggersEnabled()).toBe(false);
    process.env.MAIL_TRIGGERS_ENABLED = 'true';
    expect(isMailTriggersEnabled()).toBe(true);
    process.env.MAIL_TRIGGERS_ENABLED = 'false';
    expect(isMailTriggersEnabled()).toBe(false);
  });

  it('is its own switch: the event and schedule switches do not turn it on, and it turns neither on', () => {
    expect(isMailTriggersEnabled({ EVENT_TRIGGERS_ENABLED: 'true', SCHEDULES_ENABLED: 'true' })).toBe(false);
    expect(isEventTriggersEnabled({ MAIL_TRIGGERS_ENABLED: 'true' })).toBe(false);
    expect(isSchedulesEnabled({ MAIL_TRIGGERS_ENABLED: 'true' })).toBe(false);
    process.env.EVENT_TRIGGERS_ENABLED = 'true';
    process.env.SCHEDULES_ENABLED = 'true';
    delete process.env.MAIL_TRIGGERS_ENABLED;
    expect(isMailTriggersEnabled()).toBe(false);
  });

  it('uses the same exact-string rule as the other trigger switches and sets nothing', () => {
    const source = readFileSync(join(__dirname, 'mail-trigger-switch.ts'), 'utf8');
    expect(source).toContain("env[MAIL_TRIGGERS_ENABLED_ENV] === 'true'");
    expect(source).not.toMatch(/GLOBAL_EXECUTION_ENABLED\s*=|process\.env\.[A-Z_]+\s*=/);
  });

  it('the gateway env template carries MAIL_TRIGGERS_ENABLED=false with its comment line', () => {
    const template = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'ops', 'clean-baseline', 'env', 'gateway.env.template'),
      'utf8',
    );
    expect(template).toMatch(/^MAIL_TRIGGERS_ENABLED=false$/m);
    const lines = template.split('\n');
    const index = lines.indexOf('MAIL_TRIGGERS_ENABLED=false');
    expect(lines[index - 1]).toMatch(/^# Mail triggers \(TRIGGER-MAIL-01\)\. Off unless exactly true;/);
    expect(lines[index - 1]).toContain('gates only the mail timer and its mailbox sign-ins');
    expect(lines[index - 1]).toContain('never turns runs on');
    expect(lines[index - 1]).toContain('tester window never sets it');
    expect(template.match(/^MAIL_TRIGGERS_ENABLED=/gm)).toHaveLength(1);
    // The schedule and event switches are still there, unchanged and off.
    expect(template).toMatch(/^SCHEDULES_ENABLED=false$/m);
    expect(template).toMatch(/^EVENT_TRIGGERS_ENABLED=false$/m);
  });
});
