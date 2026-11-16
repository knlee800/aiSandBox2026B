import { readFileSync } from 'fs';
import { join } from 'path';
import { isRunResultToolEnabled } from '../orchestration/collaboration-result-grant';
import { CHAIN_TRIGGERS_ENABLED_ENV, isChainTriggersEnabled } from './chain-trigger-switch';
import { isEventTriggersEnabled } from './event-trigger-switch';
import { isKnowledgeTriggersEnabled } from './knowledge-trigger-switch';
import { isMailTriggersEnabled } from './mail-trigger-switch';
import { isSchedulesEnabled } from './schedule-switch';

describe('isChainTriggersEnabled (TRIGGER-CHAIN-01 S1)', () => {
  const originals: Record<string, string | undefined> = {
    CHAIN_TRIGGERS_ENABLED: process.env.CHAIN_TRIGGERS_ENABLED,
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

  it('reads the CHAIN_TRIGGERS_ENABLED variable', () => {
    expect(CHAIN_TRIGGERS_ENABLED_ENV).toBe('CHAIN_TRIGGERS_ENABLED');
  });

  it('is on only for the exact string true', () => {
    expect(isChainTriggersEnabled({ CHAIN_TRIGGERS_ENABLED: 'true' })).toBe(true);
  });

  it('is off when unset (the default)', () => {
    expect(isChainTriggersEnabled({})).toBe(false);
  });

  it.each(['', 'false', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'true\n'])('is off for %j', (value) => {
    expect(isChainTriggersEnabled({ CHAIN_TRIGGERS_ENABLED: value })).toBe(false);
  });

  it('reads process.env live on every call', () => {
    delete process.env.CHAIN_TRIGGERS_ENABLED;
    expect(isChainTriggersEnabled()).toBe(false);
    process.env.CHAIN_TRIGGERS_ENABLED = 'true';
    expect(isChainTriggersEnabled()).toBe(true);
    process.env.CHAIN_TRIGGERS_ENABLED = 'false';
    expect(isChainTriggersEnabled()).toBe(false);
  });

  it('is its own switch: the other trigger switches do not turn it on, and it turns none of them (nor the result tool) on', () => {
    expect(
      isChainTriggersEnabled({
        KNOWLEDGE_TRIGGERS_ENABLED: 'true',
        MAIL_TRIGGERS_ENABLED: 'true',
        EVENT_TRIGGERS_ENABLED: 'true',
        SCHEDULES_ENABLED: 'true',
      }),
    ).toBe(false);
    const chainOn = { CHAIN_TRIGGERS_ENABLED: 'true' };
    expect(isKnowledgeTriggersEnabled(chainOn)).toBe(false);
    expect(isMailTriggersEnabled(chainOn)).toBe(false);
    expect(isEventTriggersEnabled(chainOn)).toBe(false);
    expect(isSchedulesEnabled(chainOn)).toBe(false);
    expect(isRunResultToolEnabled(chainOn)).toBe(false);
    process.env.KNOWLEDGE_TRIGGERS_ENABLED = 'true';
    process.env.MAIL_TRIGGERS_ENABLED = 'true';
    process.env.EVENT_TRIGGERS_ENABLED = 'true';
    process.env.SCHEDULES_ENABLED = 'true';
    delete process.env.CHAIN_TRIGGERS_ENABLED;
    expect(isChainTriggersEnabled()).toBe(false);
  });

  it('uses the same exact-string rule as the other trigger switches and sets nothing', () => {
    const source = readFileSync(join(__dirname, 'chain-trigger-switch.ts'), 'utf8');
    expect(source).toContain("env[CHAIN_TRIGGERS_ENABLED_ENV] === 'true'");
    expect(source).not.toMatch(/GLOBAL_EXECUTION_ENABLED\s*=|process\.env\.[A-Z_]+\s*=/);
    expect(source).not.toContain('\r');
  });

  it('the gateway env template carries CHAIN_TRIGGERS_ENABLED=false with its comment line', () => {
    const template = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'ops', 'clean-baseline', 'env', 'gateway.env.template'),
      'utf8',
    );
    expect(template).toMatch(/^CHAIN_TRIGGERS_ENABLED=false$/m);
    const lines = template.split('\n');
    const index = lines.indexOf('CHAIN_TRIGGERS_ENABLED=false');
    expect(lines[index - 1]).toMatch(/^# Chain triggers \(TRIGGER-CHAIN-01\)\. Off unless exactly true;/);
    expect(lines[index - 1]).toContain('gates only the chain timer and its run reads');
    expect(lines[index - 1]).toContain('never turns runs on or the run result tool on');
    expect(lines[index - 1]).toContain('tester window never sets it');
    expect(template.match(/^CHAIN_TRIGGERS_ENABLED=/gm)).toHaveLength(1);
    // Next to the other switches, which are still there, unchanged and off.
    expect(template).toMatch(/^SCHEDULES_ENABLED=false$/m);
    expect(template).toMatch(/^EVENT_TRIGGERS_ENABLED=false$/m);
    expect(template).toMatch(/^MAIL_TRIGGERS_ENABLED=false$/m);
    expect(template).toMatch(/^KNOWLEDGE_TRIGGERS_ENABLED=false$/m);
    expect(template).toMatch(/^GLOBAL_EXECUTION_ENABLED=false$/m);
    expect(lines[index - 2]).toMatch(/^[A-Z_]+=false$/);
    expect(template.endsWith('CHAIN_TRIGGERS_ENABLED=false\n')).toBe(true);
    expect(template).not.toContain('\r');
  });
});
