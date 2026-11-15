import { readFileSync } from 'fs';
import { join } from 'path';
import { EVENT_TRIGGERS_ENABLED_ENV, isEventTriggersEnabled } from './event-trigger-switch';
import { isSchedulesEnabled } from './schedule-switch';

describe('isEventTriggersEnabled (TRIGGER-EVENT-01 S2)', () => {
  const original = process.env.EVENT_TRIGGERS_ENABLED;
  const originalSchedules = process.env.SCHEDULES_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.EVENT_TRIGGERS_ENABLED;
    else process.env.EVENT_TRIGGERS_ENABLED = original;
    if (originalSchedules === undefined) delete process.env.SCHEDULES_ENABLED;
    else process.env.SCHEDULES_ENABLED = originalSchedules;
  });

  it('reads the EVENT_TRIGGERS_ENABLED variable', () => {
    expect(EVENT_TRIGGERS_ENABLED_ENV).toBe('EVENT_TRIGGERS_ENABLED');
  });

  it('is on only for the exact string true', () => {
    expect(isEventTriggersEnabled({ EVENT_TRIGGERS_ENABLED: 'true' })).toBe(true);
  });

  it('is off when unset (the default)', () => {
    expect(isEventTriggersEnabled({})).toBe(false);
  });

  it.each(['', 'false', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'true\n'])(
    'is off for %j',
    (value) => {
      expect(isEventTriggersEnabled({ EVENT_TRIGGERS_ENABLED: value })).toBe(false);
    },
  );

  it('reads process.env live on every call', () => {
    delete process.env.EVENT_TRIGGERS_ENABLED;
    expect(isEventTriggersEnabled()).toBe(false);
    process.env.EVENT_TRIGGERS_ENABLED = 'true';
    expect(isEventTriggersEnabled()).toBe(true);
    process.env.EVENT_TRIGGERS_ENABLED = 'false';
    expect(isEventTriggersEnabled()).toBe(false);
  });

  it('is its own switch: SCHEDULES_ENABLED does not turn it on, and it does not turn schedules on', () => {
    expect(isEventTriggersEnabled({ SCHEDULES_ENABLED: 'true' })).toBe(false);
    expect(isSchedulesEnabled({ EVENT_TRIGGERS_ENABLED: 'true' })).toBe(false);
    process.env.SCHEDULES_ENABLED = 'true';
    delete process.env.EVENT_TRIGGERS_ENABLED;
    expect(isEventTriggersEnabled()).toBe(false);
  });

  it('uses the same exact-string rule as the schedules switch', () => {
    const source = readFileSync(join(__dirname, 'event-trigger-switch.ts'), 'utf8');
    expect(source).toContain("env[EVENT_TRIGGERS_ENABLED_ENV] === 'true'");
    expect(source).not.toMatch(/GLOBAL_EXECUTION_ENABLED\s*=|process\.env\.[A-Z_]+\s*=/);
  });

  it('the gateway env template carries EVENT_TRIGGERS_ENABLED=false with its comment line', () => {
    const template = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'ops', 'clean-baseline', 'env', 'gateway.env.template'),
      'utf8',
    );
    expect(template).toMatch(/^EVENT_TRIGGERS_ENABLED=false$/m);
    const lines = template.split('\n');
    const index = lines.indexOf('EVENT_TRIGGERS_ENABLED=false');
    expect(lines[index - 1]).toMatch(/^# Event triggers \(TRIGGER-EVENT-01\)\. Off unless exactly true;/);
    expect(lines[index - 1]).toContain('gates only the event timer and its calendar reads');
    expect(lines[index - 1]).toContain('never turns runs on');
    expect(lines[index - 1]).toContain('tester window never sets it');
    expect(template.match(/^EVENT_TRIGGERS_ENABLED=/gm)).toHaveLength(1);
    // The schedules switch is still there, unchanged and off.
    expect(template).toMatch(/^SCHEDULES_ENABLED=false$/m);
  });
});
