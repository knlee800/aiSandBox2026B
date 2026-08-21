import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import liveConfig from '../playwright.live.config';
import {
  assertLiveStagingExecutorBound,
  createLiveAdapters,
  createLiveStagingHelper,
} from '../lib/live-adapters';
import {
  LIVE_GUARD_KEYS,
  LiveAuthorizationError,
  ProviderBudgetError,
  assertLiveAuthorized,
  inspectLiveGuards,
  resolveMode,
} from '../lib/modes';
import {
  PARITY_END_SENTINEL,
  PARITY_HEAD_SENTINEL,
  PARITY_STASH_SENTINEL,
  PARITY_STATUS_SENTINEL,
  RETAINED_STASH_SHA,
  SshExecutorMissingError,
  StagingHelper,
  StagingNotAuthorizedError,
  UnsafeParityError,
  createSshExecutor,
  evaluateParity,
  parseParityInspectOutput,
  readAuthorizedLocalHead,
  refuseUnsafeParityOrSkipDeploy,
} from '../lib/staging';
import { GOLDEN_PATH_PHASES } from '../lib/phases';
import { createRecordingAdapters, runGoldenPath } from '../lib/runner';
import { ProviderCallGuard } from '../lib/safety-gates';

const HISTORICAL_E2E05_SHA = 'c3e39279abe3c0d6c348daa312107c8f6fc592b7';
const DYNAMIC_HEAD_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const DYNAMIC_HEAD_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const liveEnv = {
  E2E_MODE: 'live',
  E2E_LIVE_AUTHORIZED: 'true',
  E2E_ALLOW_STAGING_MUTATION: 'true',
  E2E_ALLOW_CREDIT_MUTATION: 'true',
  PROVIDER_CALL_BUDGET: '1',
};

const liveEnvWithCreds = {
  ...liveEnv,
  E2E_LOGIN_EMAIL: 'e2e-contract@example.test',
  E2E_LOGIN_PASSWORD: 'not-a-real-password',
};

function parityOutput(headSha: string, dirtyLine = '', stashSha = RETAINED_STASH_SHA): string {
  const statusLines = dirtyLine === '' ? [] : [dirtyLine];
  return [
    PARITY_HEAD_SENTINEL,
    headSha,
    PARITY_STATUS_SENTINEL,
    ...statusLines,
    PARITY_STASH_SENTINEL,
    stashSha,
    PARITY_END_SENTINEL,
    '',
  ].join('\n');
}

function twoLineCleanOutput(headSha: string, stashSha = RETAINED_STASH_SHA): string {
  return `${headSha}\n${stashSha}\n`;
}

test.describe('AUTO-01A live adapter tooling', () => {
  test('does not require a historical fixed staging SHA; expected HEAD is supplied dynamically', () => {
    const stagingSource = fs.readFileSync(
      path.join(__dirname, '../lib/staging.ts'),
      'utf8',
    );
    const liveAdaptersSource = fs.readFileSync(
      path.join(__dirname, '../lib/live-adapters.ts'),
      'utf8',
    );
    expect(stagingSource).not.toContain('REQUIRED_SOURCE_SHA');
    expect(stagingSource).not.toContain(HISTORICAL_E2E05_SHA);
    expect(liveAdaptersSource).not.toContain(HISTORICAL_E2E05_SHA);
    expect(liveAdaptersSource).toContain('createSshExecutor()');
    expect(liveAdaptersSource).toContain('readAuthorizedLocalHead');

    expect(
      evaluateParity({
        headSha: DYNAMIC_HEAD_A,
        worktreeClean: true,
        stashSha: RETAINED_STASH_SHA,
        requiredHeadSha: DYNAMIC_HEAD_A,
      }),
    ).toBe('PARITY_PROVEN');
    expect(
      evaluateParity({
        headSha: HISTORICAL_E2E05_SHA,
        worktreeClean: true,
        stashSha: RETAINED_STASH_SHA,
        requiredHeadSha: DYNAMIC_HEAD_A,
      }),
    ).toBe('UNSAFE_PARITY');
    expect(
      evaluateParity({
        headSha: DYNAMIC_HEAD_A,
        worktreeClean: true,
        stashSha: RETAINED_STASH_SHA,
        requiredHeadSha: '',
      }),
    ).toBe('UNSAFE_PARITY');
  });

  test('exact parity PASS when local and staging HEAD match', async () => {
    const executeCalls: string[] = [];
    const helper = new StagingHelper({
      env: liveEnv,
      execute: async (argv) => {
        executeCalls.push(argv.join(' '));
        return parityOutput(DYNAMIC_HEAD_B);
      },
    });
    await expect(helper.inspectParity(DYNAMIC_HEAD_B)).resolves.toBe('PARITY_PROVEN');
    expect(executeCalls.some((call) => call.includes('pm2 restart'))).toBe(false);

    await expect(
      readAuthorizedLocalHead({
        revParse: async () => `  ${DYNAMIC_HEAD_B}  `,
        statusShort: async () => '',
      }),
    ).resolves.toBe(DYNAMIC_HEAD_B);
  });

  test('parity mismatch FAILS before any provider-capable phase', async () => {
    const executeCalls: string[] = [];
    const helper = new StagingHelper({
      env: liveEnv,
      execute: async (argv) => {
        executeCalls.push(argv.join(' '));
        return parityOutput(DYNAMIC_HEAD_A);
      },
    });
    await expect(helper.inspectParity(DYNAMIC_HEAD_B)).rejects.toBeInstanceOf(UnsafeParityError);
    expect(
      executeCalls.some((call) => call.includes('GLOBAL_EXECUTION_ENABLED=true pm2 restart')),
    ).toBe(false);

    const recording = createRecordingAdapters();
    const originalSafety = recording.adapters.runSafetyChecks.bind(recording.adapters);
    recording.adapters.runSafetyChecks = async () => {
      await originalSafety();
      refuseUnsafeParityOrSkipDeploy(
        evaluateParity({
          headSha: DYNAMIC_HEAD_A,
          worktreeClean: true,
          stashSha: RETAINED_STASH_SHA,
          requiredHeadSha: DYNAMIC_HEAD_B,
        }),
      );
    };
    const result = await runGoldenPath({
      mode: 'contract',
      adapters: recording.adapters,
      gateTracker: recording.gateTracker,
      providerGuard: new ProviderCallGuard(1),
    });
    expect(result.summary.verdict).toBe('FAIL');
    if (result.summary.verdict === 'FAIL') {
      expect(result.summary.phase).toBe('SAFETY');
    }
    expect(recording.calls).toContain('SAFETY');
    expect(recording.calls).not.toContain('BUILD');
    expect(recording.calls).not.toContain('STARTING_BALANCE');
    expect(recording.calls.at(-1)).toBe('CLEANUP');
  });

  test('createLiveAdapters binds the existing SSH executor and fails closed when it is absent or fails', async () => {
    const defaultHelper = createLiveStagingHelper({ env: liveEnv });
    expect(defaultHelper.hasExecutor()).toBe(true);
    expect(typeof createSshExecutor()).toBe('function');
    expect(() => assertLiveStagingExecutorBound(defaultHelper)).not.toThrow();

    const unbound = new StagingHelper({ env: liveEnv });
    expect(unbound.hasExecutor()).toBe(false);
    expect(() => assertLiveStagingExecutorBound(unbound)).toThrow(SshExecutorMissingError);
    await expect(unbound.inspectParity(DYNAMIC_HEAD_A)).rejects.toBeInstanceOf(
      SshExecutorMissingError,
    );

    const failing = new StagingHelper({
      env: liveEnv,
      execute: async () => {
        throw new Error('ssh exited 255: Permission denied');
      },
    });
    await expect(failing.inspectParity(DYNAMIC_HEAD_A)).rejects.toThrow(/ssh exited 255/);
  });

  test('CONTRACT mode remains staging-free', async () => {
    let executeCalled = false;
    const helper = new StagingHelper({
      env: { E2E_MODE: 'contract' },
      execute: async () => {
        executeCalled = true;
        return parityOutput(DYNAMIC_HEAD_A);
      },
    });
    await expect(helper.inspectParity(DYNAMIC_HEAD_A)).rejects.toBeInstanceOf(
      StagingNotAuthorizedError,
    );
    expect(executeCalled).toBe(false);
    expect(resolveMode({})).toBe('contract');
  });

  test('LIVE authorization guards, provider budget, retries, and phase order remain unchanged', () => {
    expect(LIVE_GUARD_KEYS).toEqual([
      'E2E_MODE',
      'E2E_LIVE_AUTHORIZED',
      'E2E_ALLOW_STAGING_MUTATION',
      'E2E_ALLOW_CREDIT_MUTATION',
      'PROVIDER_CALL_BUDGET',
    ]);
    expect(inspectLiveGuards({ E2E_MODE: 'live' }).authorized).toBe(false);
    expect(() => assertLiveAuthorized({ E2E_MODE: 'live' })).toThrow(LiveAuthorizationError);
    expect(() =>
      assertLiveAuthorized({ ...liveEnv, PROVIDER_CALL_BUDGET: '2' }),
    ).toThrow(ProviderBudgetError);
    expect(() => assertLiveAuthorized(liveEnv)).not.toThrow();
    expect(new ProviderCallGuard(1).remaining).toBe(1);
    expect(() => new ProviderCallGuard(2)).toThrow(/exactly 1/);
    expect(liveConfig.retries).toBe(0);
    expect(GOLDEN_PATH_PHASES.indexOf('PREVIEW')).toBe(
      GOLDEN_PATH_PHASES.indexOf('WAIT_FOR_AUTO_APPLY') + 1,
    );
    expect(GOLDEN_PATH_PHASES.indexOf('CHECKPOINT')).toBe(
      GOLDEN_PATH_PHASES.indexOf('PREVIEW') + 1,
    );
  });

  test('createLiveAdapters wires dynamic HEAD parity and bound SSH, and mismatch never enables the gate', async ({
    browser,
  }) => {
    const executeCalls: string[] = [];
    const matchExecute = async (argv: string[]) => {
      executeCalls.push(argv.join(' '));
      const remote = argv[1] ?? '';
      if (remote.includes('rev-parse HEAD')) {
        return parityOutput(DYNAMIC_HEAD_B);
      }
      return 'GLOBAL_EXECUTION_ENABLED=true\nBILLING_CHARGES_ENABLED=false\n';
    };

    const matched = await createLiveAdapters({
      browser,
      env: liveEnvWithCreds,
      execute: matchExecute,
      readLocalHead: async () => DYNAMIC_HEAD_B,
    });
    try {
      expect(matched.staging.hasExecutor()).toBe(true);
      await expect(matched.adapters.runSafetyChecks()).resolves.toBeUndefined();
      expect(
        executeCalls.some((call) =>
          call.includes('GLOBAL_EXECUTION_ENABLED=true pm2 restart'),
        ),
      ).toBe(false);
    } finally {
      await matched.context.close();
    }

    executeCalls.length = 0;
    const mismatch = await createLiveAdapters({
      browser,
      env: liveEnvWithCreds,
      execute: async (argv) => {
        executeCalls.push(argv.join(' '));
        return parityOutput(DYNAMIC_HEAD_A);
      },
      readLocalHead: async () => DYNAMIC_HEAD_B,
    });
    try {
      await expect(mismatch.adapters.runSafetyChecks()).rejects.toBeInstanceOf(UnsafeParityError);
      expect(
        executeCalls.some((call) =>
          call.includes('GLOBAL_EXECUTION_ENABLED=true pm2 restart'),
        ),
      ).toBe(false);
    } finally {
      await mismatch.context.close();
    }

    const unbound = new StagingHelper({ env: liveEnvWithCreds });
    await expect(
      createLiveAdapters({
        browser,
        env: liveEnvWithCreds,
        staging: unbound,
      }),
    ).rejects.toBeInstanceOf(SshExecutorMissingError);
  });

  test('missing expected HEAD fails closed before SSH', async () => {
    let executeCalled = false;
    const helper = new StagingHelper({
      env: liveEnv,
      execute: async () => {
        executeCalled = true;
        return parityOutput(DYNAMIC_HEAD_A);
      },
    });
    await expect(helper.inspectParity('   ')).rejects.toBeInstanceOf(UnsafeParityError);
    expect(executeCalled).toBe(false);
    await expect(
      readAuthorizedLocalHead({
        revParse: async () => '',
        statusShort: async () => '',
      }),
    ).rejects.toBeInstanceOf(UnsafeParityError);
    await expect(
      readAuthorizedLocalHead({
        revParse: async () => DYNAMIC_HEAD_A,
        statusShort: async () => ' M e2e/builder-golden-path/lib/staging.ts',
      }),
    ).rejects.toBeInstanceOf(UnsafeParityError);
  });
});

test.describe('AUTO-01B inspectParity clean-output parser', () => {
  test('labelled clean porcelain with no blank line parses HEAD empty STATUS and STASH exactly', () => {
    const output = [
      PARITY_HEAD_SENTINEL,
      DYNAMIC_HEAD_B,
      PARITY_STATUS_SENTINEL,
      PARITY_STASH_SENTINEL,
      RETAINED_STASH_SHA,
      PARITY_END_SENTINEL,
    ].join('\n');
    expect(output).not.toContain('\n\n');
    const parsed = parseParityInspectOutput(output);
    expect(parsed.headSha).toBe(DYNAMIC_HEAD_B);
    expect(parsed.status).toBe('');
    expect(parsed.stashSha).toBe(RETAINED_STASH_SHA);
  });

  test('HEAD + stash two-line form is clean and cannot be mistaken as dirty status', () => {
    const output = twoLineCleanOutput(DYNAMIC_HEAD_B);
    const parsed = parseParityInspectOutput(output);
    expect(parsed.headSha).toBe(DYNAMIC_HEAD_B);
    expect(parsed.status).toBe('');
    expect(parsed.stashSha).toBe(RETAINED_STASH_SHA);
    expect(parsed.status).not.toBe(RETAINED_STASH_SHA);
    expect(
      evaluateParity({
        headSha: parsed.headSha,
        worktreeClean: parsed.status === '',
        stashSha: parsed.stashSha,
        requiredHeadSha: DYNAMIC_HEAD_B,
      }),
    ).toBe('PARITY_PROVEN');
  });

  test('exact labelled clean parity PASSES inspectParity', async () => {
    const helper = new StagingHelper({
      env: liveEnv,
      execute: async () => parityOutput(DYNAMIC_HEAD_B),
    });
    await expect(helper.inspectParity(DYNAMIC_HEAD_B)).resolves.toBe('PARITY_PROVEN');
  });

  test('LIVE-02 two-line clean helper output PASSES inspectParity', async () => {
    const helper = new StagingHelper({
      env: liveEnv,
      execute: async () => twoLineCleanOutput(DYNAMIC_HEAD_B),
    });
    await expect(helper.inspectParity(DYNAMIC_HEAD_B)).resolves.toBe('PARITY_PROVEN');
  });

  test('dirty porcelain is detected and fails closed before gate enable', async () => {
    const executeCalls: string[] = [];
    const helper = new StagingHelper({
      env: liveEnv,
      execute: async (argv) => {
        executeCalls.push(argv.join(' '));
        return parityOutput(DYNAMIC_HEAD_B, ' M e2e/builder-golden-path/lib/staging.ts');
      },
    });
    await expect(helper.inspectParity(DYNAMIC_HEAD_B)).rejects.toBeInstanceOf(UnsafeParityError);
    expect(
      executeCalls.some((call) => call.includes('GLOBAL_EXECUTION_ENABLED=true pm2 restart')),
    ).toBe(false);

    const parsed = parseParityInspectOutput(
      parityOutput(DYNAMIC_HEAD_B, ' M e2e/builder-golden-path/lib/staging.ts'),
    );
    expect(parsed.status).toContain('M e2e/builder-golden-path/lib/staging.ts');
    expect(parsed.status).not.toBe('');
    expect(
      evaluateParity({
        headSha: parsed.headSha,
        worktreeClean: parsed.status === '',
        stashSha: parsed.stashSha,
        requiredHeadSha: DYNAMIC_HEAD_B,
      }),
    ).toBe('UNSAFE_PARITY');
  });

  test('missing stash fails closed before gate enable', async () => {
    const executeCalls: string[] = [];
    const helper = new StagingHelper({
      env: liveEnv,
      execute: async (argv) => {
        executeCalls.push(argv.join(' '));
        return parityOutput(DYNAMIC_HEAD_B, '', '');
      },
    });
    await expect(helper.inspectParity(DYNAMIC_HEAD_B)).rejects.toBeInstanceOf(UnsafeParityError);
    expect(
      executeCalls.some((call) => call.includes('GLOBAL_EXECUTION_ENABLED=true pm2 restart')),
    ).toBe(false);

    const oneLineHeadOnly = `${DYNAMIC_HEAD_B}\n`;
    expect(() => parseParityInspectOutput(oneLineHeadOnly)).toThrow(UnsafeParityError);
  });

  test('incorrect stash fails closed before gate enable', async () => {
    const wrongStash = 'cccccccccccccccccccccccccccccccccccccccc';
    const helper = new StagingHelper({
      env: liveEnv,
      execute: async () => parityOutput(DYNAMIC_HEAD_B, '', wrongStash),
    });
    await expect(helper.inspectParity(DYNAMIC_HEAD_B)).rejects.toBeInstanceOf(UnsafeParityError);
    await expect(
      new StagingHelper({
        env: liveEnv,
        execute: async () => twoLineCleanOutput(DYNAMIC_HEAD_B, wrongStash),
      }).inspectParity(DYNAMIC_HEAD_B),
    ).rejects.toBeInstanceOf(UnsafeParityError);
  });

  test('HEAD mismatch fails closed before gate enable', async () => {
    const executeCalls: string[] = [];
    const helper = new StagingHelper({
      env: liveEnv,
      execute: async (argv) => {
        executeCalls.push(argv.join(' '));
        return parityOutput(DYNAMIC_HEAD_A);
      },
    });
    await expect(helper.inspectParity(DYNAMIC_HEAD_B)).rejects.toBeInstanceOf(UnsafeParityError);
    expect(
      executeCalls.some((call) => call.includes('GLOBAL_EXECUTION_ENABLED=true pm2 restart')),
    ).toBe(false);
  });

  test('CONTRACT mode remains staging-free; provider budget 1; retries 0; AUTO_APPLY then PREVIEW', async () => {
    let executeCalled = false;
    const helper = new StagingHelper({
      env: { E2E_MODE: 'contract' },
      execute: async () => {
        executeCalled = true;
        return parityOutput(DYNAMIC_HEAD_B);
      },
    });
    await expect(helper.inspectParity(DYNAMIC_HEAD_B)).rejects.toBeInstanceOf(
      StagingNotAuthorizedError,
    );
    expect(executeCalled).toBe(false);
    expect(resolveMode({})).toBe('contract');
    expect(new ProviderCallGuard(1).remaining).toBe(1);
    expect(() => new ProviderCallGuard(2)).toThrow(/exactly 1/);
    expect(liveConfig.retries).toBe(0);
    expect(GOLDEN_PATH_PHASES.indexOf('PREVIEW')).toBe(
      GOLDEN_PATH_PHASES.indexOf('WAIT_FOR_AUTO_APPLY') + 1,
    );
  });
});
