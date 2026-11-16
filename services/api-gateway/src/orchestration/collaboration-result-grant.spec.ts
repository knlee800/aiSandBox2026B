import { readFileSync, readdirSync } from 'fs';
import { join, relative, resolve } from 'path';
import { createHarnessEntitlementProof } from '../ai/ai-execution.controller';
import {
  SYSTEM_AGENT_DEFINITIONS,
  systemAgentById,
} from '../system-agents/system-agent-registry';
import {
  RUN_RESULT_READ_SYSTEM_AGENT_ID,
  RUN_RESULT_TOOL_ENABLED_ENV,
  isRunResultToolEnabled,
  runResultGrantJobFields,
} from './collaboration-result-grant';
import { collaborationHarnessJobFields } from './collaboration-tool-profile';

const ON = { RUN_RESULT_TOOL_ENABLED: 'true' } as NodeJS.ProcessEnv;
const WORKFLOW_ID = 'f0f0f0f0-0000-4000-8000-000000000001';
const CODING_ROLES = ['builder', 'lead', 'writer', 'reviewer'];
const ADVISORS = ['advisors-lead', 'product-strategy', 'technology-advisor'];

/** A job's harness fields as the gateway builds them for a system-agent target. */
function systemJob(target: string) {
  return { builderProfileId: target, ...collaborationHarnessJobFields(target) };
}

/** A workflow job: the workflow id as target, a read-only read profile (workflowJobAccess). */
function workflowJob(target = WORKFLOW_ID) {
  return { builderProfileId: target, ...collaborationHarnessJobFields(target) };
}

describe('RESULT-TOOL-01 isRunResultToolEnabled', () => {
  const original = process.env.RUN_RESULT_TOOL_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.RUN_RESULT_TOOL_ENABLED;
    else process.env.RUN_RESULT_TOOL_ENABLED = original;
  });

  it('reads the RUN_RESULT_TOOL_ENABLED variable', () => {
    expect(RUN_RESULT_TOOL_ENABLED_ENV).toBe('RUN_RESULT_TOOL_ENABLED');
  });

  it('is on only for the exact string true', () => {
    expect(isRunResultToolEnabled({ RUN_RESULT_TOOL_ENABLED: 'true' })).toBe(true);
  });

  it('is off when unset (the default)', () => {
    expect(isRunResultToolEnabled({})).toBe(false);
  });

  it.each(['', 'false', 'TRUE', 'True', '1', 'yes', 'on', ' true', 'true ', 'true\n'])(
    'is off for %j',
    (value) => {
      expect(isRunResultToolEnabled({ RUN_RESULT_TOOL_ENABLED: value })).toBe(false);
    },
  );

  it('reads process.env live on every call', () => {
    delete process.env.RUN_RESULT_TOOL_ENABLED;
    expect(isRunResultToolEnabled()).toBe(false);
    process.env.RUN_RESULT_TOOL_ENABLED = 'true';
    expect(isRunResultToolEnabled()).toBe(true);
    process.env.RUN_RESULT_TOOL_ENABLED = 'false';
    expect(isRunResultToolEnabled()).toBe(false);
  });

  it('is not turned on by the other switches', () => {
    expect(
      isRunResultToolEnabled({
        GLOBAL_EXECUTION_ENABLED: 'true',
        SCHEDULES_ENABLED: 'true',
        EVENT_TRIGGERS_ENABLED: 'true',
        MAIL_TRIGGERS_ENABLED: 'true',
        KNOWLEDGE_TRIGGERS_ENABLED: 'true',
      }),
    ).toBe(false);
  });
});

describe('RESULT-TOOL-01 runResultGrantJobFields', () => {
  it('grants a read-profile Chief of Staff step', () => {
    expect(RUN_RESULT_READ_SYSTEM_AGENT_ID).toBe('chief-of-staff');
    expect(systemAgentById('chief-of-staff')?.toolProfile).toBe('read');
    expect(runResultGrantJobFields(systemJob('chief-of-staff'), false, ON)).toEqual({
      runResultRead: true,
    });
  });

  it('grants a workflow step', () => {
    expect(runResultGrantJobFields(workflowJob(), true, ON)).toEqual({ runResultRead: true });
  });

  it.each(CODING_ROLES)('never grants the coding role %s, as a system or a workflow step', (role) => {
    expect(runResultGrantJobFields(systemJob(role), false, ON)).toEqual({});
    expect(runResultGrantJobFields(workflowJob(role), true, ON)).toEqual({});
  });

  it.each(ADVISORS)('never grants the advisor %s, as a system or a workflow step', (role) => {
    expect(runResultGrantJobFields(systemJob(role), false, ON)).toEqual({});
    expect(runResultGrantJobFields(workflowJob(role), true, ON)).toEqual({});
  });

  it('grants no system agent but the Chief of Staff, whatever the registry holds', () => {
    for (const definition of SYSTEM_AGENT_DEFINITIONS) {
      const fields = runResultGrantJobFields(systemJob(definition.id), false, ON);
      expect(fields).toEqual(definition.id === 'chief-of-staff' ? { runResultRead: true } : {});
    }
  });

  it('never grants a non-read profile, even to the Chief of Staff or a workflow', () => {
    for (const profile of ['review', 'write', 'agent-write', undefined, 'READ']) {
      const cos = { builderProfileId: 'chief-of-staff', harnessVersion: 'v1', harnessToolProfile: profile };
      const wf = { builderProfileId: WORKFLOW_ID, harnessVersion: 'v1', harnessToolProfile: profile };
      expect(runResultGrantJobFields(cos, false, ON)).toEqual({});
      expect(runResultGrantJobFields(wf, true, ON)).toEqual({});
    }
  });

  it('never grants a job without the signed harness v1 read-only fields (an Ask step, no file access)', () => {
    for (const target of ['chief-of-staff', WORKFLOW_ID]) {
      const workflowStep = target === WORKFLOW_ID;
      expect(runResultGrantJobFields({ builderProfileId: target }, workflowStep, ON)).toEqual({});
      expect(
        runResultGrantJobFields(
          { builderProfileId: target, harnessVersion: 'v2', harnessToolProfile: 'read', harnessReadOnly: true },
          workflowStep,
          ON,
        ),
      ).toEqual({});
      expect(
        runResultGrantJobFields(
          { builderProfileId: target, harnessVersion: 'v1', harnessToolProfile: 'read' },
          workflowStep,
          ON,
        ),
      ).toEqual({});
    }
  });

  it('does not grant a step that is not the Chief of Staff and not a workflow step', () => {
    expect(runResultGrantJobFields(workflowJob(), false, ON)).toEqual({});
    expect(runResultGrantJobFields(systemJob('Chief-Of-Staff'), false, ON)).toEqual({});
  });

  it.each([
    ['unset', {}],
    ['false', { RUN_RESULT_TOOL_ENABLED: 'false' }],
    ['TRUE', { RUN_RESULT_TOOL_ENABLED: 'TRUE' }],
    [' true', { RUN_RESULT_TOOL_ENABLED: ' true' }],
    ['1', { RUN_RESULT_TOOL_ENABLED: '1' }],
    ['empty', { RUN_RESULT_TOOL_ENABLED: '' }],
  ])('leaves the field absent while the switch is %s', (_label, env) => {
    const cos = runResultGrantJobFields(systemJob('chief-of-staff'), false, env as NodeJS.ProcessEnv);
    const wf = runResultGrantJobFields(workflowJob(), true, env as NodeJS.ProcessEnv);
    expect(cos).toEqual({});
    expect(wf).toEqual({});
    expect(cos).not.toHaveProperty('runResultRead');
    expect(wf).not.toHaveProperty('runResultRead');
  });

  it('never returns runResultRead: false; the field is true or absent', () => {
    const results = [
      runResultGrantJobFields(systemJob('builder'), false, ON),
      runResultGrantJobFields(systemJob('chief-of-staff'), false, {}),
      runResultGrantJobFields(workflowJob(), true, {}),
    ];
    for (const result of results) {
      expect(Object.keys(result)).toEqual([]);
    }
  });

  it('the entitlement proof digest covers the field: a job with it and one without differ', () => {
    const base = {
      executionId: 'exec-result-grant',
      userId: '11111111-1111-4111-8111-111111111111',
      apiKeyId: 'apikey-01',
      submittedAt: '2026-11-16T08:00:00.000Z',
      builderProfileId: 'chief-of-staff',
      ...collaborationHarnessJobFields('chief-of-staff'),
    };
    const proofOf = (payload: Record<string, unknown>) =>
      createHarnessEntitlementProof({
        executionId: base.executionId,
        userId: base.userId,
        apiKeyId: base.apiKeyId,
        issuedAt: base.submittedAt,
        payloadWithoutProof: payload,
        secret: 'test-hmac-secret-result-tool-01',
      });
    const without = proofOf({ ...base });
    const withField = proofOf({ ...base, ...runResultGrantJobFields(base, false, ON) });
    expect(withField.payloadDigest).not.toBe(without.payloadDigest);
    expect(withField.signature).not.toBe(without.signature);
    // An absent field and the off switch sign the same job as before.
    expect(proofOf({ ...base, ...runResultGrantJobFields(base, false, {}) })).toEqual(without);
  });
});

describe('RESULT-TOOL-01 where the grant lives', () => {
  const root = resolve(__dirname, '..');

  it('reads the switch with the exact-string rule and sets no env value', () => {
    const source = readFileSync(join(__dirname, 'collaboration-result-grant.ts'), 'utf8');
    expect(source).toContain("env[RUN_RESULT_TOOL_ENABLED_ENV] === 'true'");
    expect(source).not.toMatch(/process\.env\.[A-Z_]+\s*=[^=]/);
    expect(source).not.toContain('\r');
  });

  it('only the grant file and the hand-off job build name runResultRead or the switch (never Agent mode, Ask or Build)', () => {
    const hits: string[] = [];
    walk(root, (file) => {
      if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) return;
      const text = readFileSync(file, 'utf8');
      if (
        text.includes('runResultRead') ||
        text.includes('RUN_RESULT_TOOL_ENABLED') ||
        text.includes('runResultGrantJobFields')
      ) {
        hits.push(relative(root, file).replace(/\\/g, '/'));
      }
    });
    expect(hits.sort()).toEqual([
      'orchestration/collaboration-result-grant.ts',
      'orchestration/orchestration.service.ts',
    ]);
  });

  it('the gateway env template carries RUN_RESULT_TOOL_ENABLED=false with its comment line', () => {
    const template = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'ops', 'clean-baseline', 'env', 'gateway.env.template'),
      'utf8',
    );
    expect(template).toMatch(/^RUN_RESULT_TOOL_ENABLED=false$/m);
    expect(template.match(/^RUN_RESULT_TOOL_ENABLED=/gm)).toHaveLength(1);
    const lines = template.split('\n');
    const index = lines.indexOf('RUN_RESULT_TOOL_ENABLED=false');
    expect(lines[index - 1]).toMatch(/^# Run result tool \(RESULT-TOOL-01\)\. Off unless exactly true;/);
    expect(lines[index - 1]).toContain(
      "only lets read-only Chief of Staff and workflow steps read the owner's own completed results",
    );
    expect(lines[index - 1]).toContain('never turns runs on');
    expect(lines[index - 1]).toContain('tester window never sets it');
    expect(template).toMatch(/^GLOBAL_EXECUTION_ENABLED=false$/m);
    expect(template).toMatch(/^KNOWLEDGE_TRIGGERS_ENABLED=false$/m);
    expect(template).not.toContain('\r');
  });
});

function walk(dir: string, visit: (file: string) => void): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, visit);
    } else {
      visit(full);
    }
  }
}
