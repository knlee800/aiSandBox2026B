import { readFileSync } from 'fs';
import { join } from 'path';
import { isEventTriggersEnabled } from './event-trigger-switch';
import { KNOWLEDGE_TRIGGERS_ENABLED_ENV, isKnowledgeTriggersEnabled } from './knowledge-trigger-switch';
import { isMailTriggersEnabled } from './mail-trigger-switch';
import { isSchedulesEnabled } from './schedule-switch';

describe('isKnowledgeTriggersEnabled (TRIGGER-MORE-01 S1)', () => {
  const originals: Record<string, string | undefined> = {
    KNOWLEDGE_TRIGGERS_ENABLED: process.env.KNOWLEDGE_TRIGGERS_ENABLED,
    MAIL_TRIGGERS_ENABLED: process.env.MAIL_TRIGGERS_ENABLED,
    EVENT_TRIGGERS_ENABLED: process.env.EVENT_TRIGGERS_ENABLED,
    SCHEDULES_ENABLED: process.env.SCHEDULES_ENABLED,
  };

  afterEach(() => {
    for (const [name, value] of Object.entries(originals)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('reads the KNOWLEDGE_TRIGGERS_ENABLED variable', () => {
    expect(KNOWLEDGE_TRIGGERS_ENABLED_ENV).toBe('KNOWLEDGE_TRIGGERS_ENABLED');
  });

  it('is on only for the exact string true', () => {
    expect(isKnowledgeTriggersEnabled({ KNOWLEDGE_TRIGGERS_ENABLED: 'true' })).toBe(true);
  });

  it('is off when unset (the default)', () => {
    expect(isKnowledgeTriggersEnabled({})).toBe(false);
  });

  it.each(['', 'false', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'true\n'])(
    'is off for %j',
    (value) => {
      expect(isKnowledgeTriggersEnabled({ KNOWLEDGE_TRIGGERS_ENABLED: value })).toBe(false);
    },
  );

  it('reads process.env live on every call', () => {
    delete process.env.KNOWLEDGE_TRIGGERS_ENABLED;
    expect(isKnowledgeTriggersEnabled()).toBe(false);
    process.env.KNOWLEDGE_TRIGGERS_ENABLED = 'true';
    expect(isKnowledgeTriggersEnabled()).toBe(true);
    process.env.KNOWLEDGE_TRIGGERS_ENABLED = 'false';
    expect(isKnowledgeTriggersEnabled()).toBe(false);
  });

  it('is its own switch: the mail, event and schedule switches do not turn it on, and it turns none of them on', () => {
    expect(
      isKnowledgeTriggersEnabled({ MAIL_TRIGGERS_ENABLED: 'true', EVENT_TRIGGERS_ENABLED: 'true', SCHEDULES_ENABLED: 'true' }),
    ).toBe(false);
    expect(isMailTriggersEnabled({ KNOWLEDGE_TRIGGERS_ENABLED: 'true' })).toBe(false);
    expect(isEventTriggersEnabled({ KNOWLEDGE_TRIGGERS_ENABLED: 'true' })).toBe(false);
    expect(isSchedulesEnabled({ KNOWLEDGE_TRIGGERS_ENABLED: 'true' })).toBe(false);
    process.env.MAIL_TRIGGERS_ENABLED = 'true';
    process.env.EVENT_TRIGGERS_ENABLED = 'true';
    process.env.SCHEDULES_ENABLED = 'true';
    delete process.env.KNOWLEDGE_TRIGGERS_ENABLED;
    expect(isKnowledgeTriggersEnabled()).toBe(false);
  });

  it('uses the same exact-string rule as the other trigger switches and sets nothing', () => {
    const source = readFileSync(join(__dirname, 'knowledge-trigger-switch.ts'), 'utf8');
    expect(source).toContain("env[KNOWLEDGE_TRIGGERS_ENABLED_ENV] === 'true'");
    expect(source).not.toMatch(/GLOBAL_EXECUTION_ENABLED\s*=|process\.env\.[A-Z_]+\s*=/);
  });

  it('the gateway env template carries KNOWLEDGE_TRIGGERS_ENABLED=false with its comment line', () => {
    const template = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'ops', 'clean-baseline', 'env', 'gateway.env.template'),
      'utf8',
    );
    expect(template).toMatch(/^KNOWLEDGE_TRIGGERS_ENABLED=false$/m);
    const lines = template.split('\n');
    const index = lines.indexOf('KNOWLEDGE_TRIGGERS_ENABLED=false');
    expect(lines[index - 1]).toMatch(/^# Knowledge triggers \(TRIGGER-MORE-01\)\. Off unless exactly true;/);
    expect(lines[index - 1]).toContain('gates only the knowledge timer and its document reads');
    expect(lines[index - 1]).toContain('never turns runs on');
    expect(lines[index - 1]).toContain('tester window never sets it');
    expect(template.match(/^KNOWLEDGE_TRIGGERS_ENABLED=/gm)).toHaveLength(1);
    // Next to the other trigger switches, which are still there, unchanged and off.
    expect(lines[index - 2]).toBe('MAIL_TRIGGERS_ENABLED=false');
    expect(template).toMatch(/^SCHEDULES_ENABLED=false$/m);
    expect(template).toMatch(/^EVENT_TRIGGERS_ENABLED=false$/m);
    expect(template).toMatch(/^MAIL_TRIGGERS_ENABLED=false$/m);
    expect(template).not.toContain('\r');
  });
});
