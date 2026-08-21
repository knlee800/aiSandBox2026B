import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { test, expect, type Browser, type Page } from '@playwright/test';
import liveConfig from '../playwright.live.config';
import {
  assertLiveStagingExecutorBound,
  createLiveAdapters,
  createLiveStagingHelper,
  createProjectAndObserveSession,
} from '../lib/live-adapters';
import {
  LIVE_GUARD_KEYS,
  LiveAuthorizationError,
  ProviderBudgetError,
  assertLiveAuthorized,
  inspectLiveGuards,
  resolveMode,
  type EnvMap,
} from '../lib/modes';
import {
  GATEWAY_READY_URL,
  GatewayNotReadyError,
  PARITY_END_SENTINEL,
  PARITY_HEAD_SENTINEL,
  PARITY_STASH_SENTINEL,
  PARITY_STATUS_SENTINEL,
  RETAINED_STASH_SHA,
  SshExecutionTimeoutError,
  SshExecutorMissingError,
  StagingHelper,
  StagingNotAuthorizedError,
  UnsafeParityError,
  buildGateRestoreCommand,
  buildGatewayReadyProbeCommand,
  buildSshCommand,
  createSshExecutor,
  evaluateParity,
  isGatewayReadyProbeSuccess,
  parseParityInspectOutput,
  readAuthorizedLocalHead,
  refuseUnsafeParityOrSkipDeploy,
} from '../lib/staging';
import { GOLDEN_PATH_PHASES } from '../lib/phases';
import { createRecordingAdapters, runGoldenPath } from '../lib/runner';
import { ExecutionGateTracker, ProviderCallGuard } from '../lib/safety-gates';
import {
  FROZEN_ARTIFACT_PATH,
  LIVE_ACTION_TIMEOUT_MS,
  LIVE_NAVIGATION_TIMEOUT_MS,
  PROJECT_CARD_CLICK_TIMEOUT_MS,
  PROJECT_CREATE_BODY_TIMEOUT_MS,
  PROJECT_CREATE_OBSERVATION_TIMEOUT_MS,
  SELECTORS,
  SESSION_CREATE_TIMEOUT_MS,
  SSH_EXECUTION_TIMEOUT_MS,
  BUILD_EXECUTION_BODY_TIMEOUT_MS,
  BUILD_EXECUTION_RESPONSE_TIMEOUT_MS,
} from '../lib/constants';
import {
  AutoApplyObservationError,
  BuildExecutionObservationError,
  ProjectCreateObservationError,
  SessionObservationError,
  armFileWriteListener,
  extractExecutionIdFromExecuteBody,
  extractSessionIdFromFileWriteUrl,
  inspectFileWriteRequestBody,
  isAiExecuteUrl,
  isSessionFileWriteUrl,
  parseBuildExecutionId,
  readBuildExecutionBody,
} from '../lib/network';
import {
  AUTO_APPLY_OTHER_SESSION_ID,
  AUTO_APPLY_PROJECT_ID,
  AUTO_APPLY_SESSION_ID,
  AUTO_APPLY_WRONG_PATH,
  REAL_EXECUTE_EXECUTION_ID,
  createAutoApplyFixtureServer,
  createSessionRaceFixtureServer,
  SESSION_RACE_PROJECT_ID,
  SESSION_RACE_SESSION_ID,
} from '../lib/local-fixture';

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

function fastReadyHelper(input: {
  execute: (argv: string[]) => Promise<string>;
  gateTracker?: ExecutionGateTracker;
  env?: EnvMap;
}): StagingHelper {
  let now = 0;
  return new StagingHelper({
    env: input.env ?? liveEnv,
    gateTracker: input.gateTracker,
    execute: input.execute,
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
    gatewayReadyTimeoutMs: 30,
    gatewayReadyIntervalMs: 10,
  });
}

test.describe('AUTO-01C post-gate gateway-ready wait', () => {
  test('uses the existing localhost gateway readiness probe and treats only HTTP 200 as ready', () => {
    expect(buildGatewayReadyProbeCommand()).toContain(GATEWAY_READY_URL);
    expect(buildGatewayReadyProbeCommand()).toContain('/api/health/ready');
    expect(isGatewayReadyProbeSuccess('200')).toBe(true);
    expect(isGatewayReadyProbeSuccess('200\n')).toBe(true);
    expect(isGatewayReadyProbeSuccess('502')).toBe(false);
    expect(isGatewayReadyProbeSuccess('000')).toBe(false);
    expect(isGatewayReadyProbeSuccess('')).toBe(false);
    expect(isGatewayReadyProbeSuccess('200 OK')).toBe(false);
  });

  test('after gate-enable pm2 restart, waits for gateway ready before returning to STARTING_BALANCE', async () => {
    const order: string[] = [];
    let readyProbes = 0;
    const helper = fastReadyHelper({
      execute: async (argv) => {
        const remote = argv[1] ?? '';
        if (remote.includes('GLOBAL_EXECUTION_ENABLED=true pm2 restart')) {
          order.push('restart');
          return '';
        }
        if (remote.includes('/api/health/ready')) {
          readyProbes += 1;
          order.push(`ready-${readyProbes}`);
          return readyProbes >= 2 ? '200' : '502';
        }
        order.push(`other:${remote}`);
        return '';
      },
    });

    await expect(helper.enableExecutionGate()).resolves.toBeUndefined();
    expect(order[0]).toBe('restart');
    expect(order.slice(1)).toEqual(['ready-1', 'ready-2']);
    expect(order.some((item) => item.includes('/api/billing/balance'))).toBe(false);
    expect(helper.gateTracker.shouldRestore()).toBe(true);
  });

  test('timeout after pm2 restart fails closed before STARTING_BALANCE/provider; cleanup still restores the gate', async () => {
    const executeCalls: string[] = [];
    const helper = fastReadyHelper({
      execute: async (argv) => {
        executeCalls.push(argv.join(' '));
        const remote = argv[1] ?? '';
        if (remote.includes('GLOBAL_EXECUTION_ENABLED=true pm2 restart')) {
          return '';
        }
        if (remote.includes('/api/health/ready')) {
          return '502';
        }
        if (remote.includes('GLOBAL_EXECUTION_ENABLED=false pm2 restart')) {
          return '';
        }
        return '';
      },
    });

    await expect(helper.enableExecutionGate()).rejects.toBeInstanceOf(GatewayNotReadyError);
    expect(
      executeCalls.some((call) => call.includes('GLOBAL_EXECUTION_ENABLED=true pm2 restart')),
    ).toBe(true);
    expect(executeCalls.some((call) => call.includes('/api/health/ready'))).toBe(true);
    expect(executeCalls.some((call) => call.includes('/api/billing/balance'))).toBe(false);
    expect(helper.gateTracker.shouldRestore()).toBe(true);

    const restore = await helper.restoreExecutionGateIfChanged();
    expect(restore).toBe('restored-false');
    expect(
      executeCalls.some((call) => call.includes('GLOBAL_EXECUTION_ENABLED=false pm2 restart')),
    ).toBe(true);
  });

  test('LIVE adapter waits for ready after enabling the gate and never probes billing over SSH', async ({
    browser,
  }) => {
    const executeCalls: string[] = [];
    const helper = fastReadyHelper({
      env: liveEnvWithCreds,
      execute: async (argv) => {
        executeCalls.push(argv.join(' '));
        const remote = argv[1] ?? '';
        if (remote.includes('rev-parse HEAD') || remote.includes(PARITY_HEAD_SENTINEL)) {
          return parityOutput(DYNAMIC_HEAD_B);
        }
        if (remote.includes('GLOBAL_EXECUTION_ENABLED|BILLING_CHARGES_ENABLED')) {
          return 'GLOBAL_EXECUTION_ENABLED=false\nBILLING_CHARGES_ENABLED=false\n';
        }
        if (remote.includes('GLOBAL_EXECUTION_ENABLED=true pm2 restart')) {
          return '';
        }
        if (remote.includes('/api/health/ready')) {
          return '200';
        }
        if (remote.includes('GLOBAL_EXECUTION_ENABLED=false pm2 restart')) {
          return '';
        }
        return '';
      },
    });

    const live = await createLiveAdapters({
      browser,
      env: liveEnvWithCreds,
      staging: helper,
      readLocalHead: async () => DYNAMIC_HEAD_B,
    });
    try {
      await expect(live.adapters.runSafetyChecks()).resolves.toBeUndefined();
      const restartIdx = executeCalls.findIndex((call) =>
        call.includes('GLOBAL_EXECUTION_ENABLED=true pm2 restart'),
      );
      const readyIdx = executeCalls.findIndex((call) => call.includes('/api/health/ready'));
      expect(restartIdx).toBeGreaterThanOrEqual(0);
      expect(readyIdx).toBeGreaterThan(restartIdx);
      expect(executeCalls.some((call) => call.includes('/api/billing/balance'))).toBe(false);
    } finally {
      await live.adapters.cleanup({ ids: {}, gateTracker: live.gateTracker });
    }
  });

  test('already-enabled gate does not restart or ready-wait; existing safety remains intact', async ({
    browser,
  }) => {
    const executeCalls: string[] = [];
    const helper = fastReadyHelper({
      env: liveEnvWithCreds,
      execute: async (argv) => {
        executeCalls.push(argv.join(' '));
        const remote = argv[1] ?? '';
        if (remote.includes('rev-parse HEAD') || remote.includes(PARITY_HEAD_SENTINEL)) {
          return parityOutput(DYNAMIC_HEAD_B);
        }
        return 'GLOBAL_EXECUTION_ENABLED=true\nBILLING_CHARGES_ENABLED=false\n';
      },
    });

    const live = await createLiveAdapters({
      browser,
      env: liveEnvWithCreds,
      staging: helper,
      readLocalHead: async () => DYNAMIC_HEAD_B,
    });
    try {
      await expect(live.adapters.runSafetyChecks()).resolves.toBeUndefined();
      expect(
        executeCalls.some((call) =>
          call.includes('GLOBAL_EXECUTION_ENABLED=true pm2 restart'),
        ),
      ).toBe(false);
      expect(executeCalls.some((call) => call.includes('/api/health/ready'))).toBe(false);
    } finally {
      await live.context.close();
    }
  });

  test('gateway ready timeout fails closed before STARTING_BALANCE and BUILD; provider unused; gate restored', async () => {
    const executeCalls: string[] = [];
    const recording = createRecordingAdapters();
    const helper = fastReadyHelper({
      gateTracker: recording.gateTracker,
      execute: async (argv) => {
        executeCalls.push(argv.join(' '));
        const remote = argv[1] ?? '';
        if (remote.includes('/api/health/ready')) {
          return '502';
        }
        return '';
      },
    });
    recording.adapters.runSafetyChecks = async () => {
      recording.calls.push('SAFETY');
      await helper.enableExecutionGate();
    };

    const providerGuard = new ProviderCallGuard(1);
    const result = await runGoldenPath({
      mode: 'contract',
      adapters: recording.adapters,
      gateTracker: recording.gateTracker,
      providerGuard,
    });

    expect(result.summary.verdict).toBe('FAIL');
    if (result.summary.verdict === 'FAIL') {
      expect(result.summary.phase).toBe('SAFETY');
      expect(result.summary.executionGateFinal).toBe('restored-false');
    }
    expect(recording.calls).toContain('SAFETY');
    expect(recording.calls).not.toContain('STARTING_BALANCE');
    expect(recording.calls).not.toContain('CREATE_SESSION');
    expect(recording.calls).not.toContain('BUILD');
    expect(recording.calls.at(-1)).toBe('CLEANUP');
    expect(providerGuard.usedCount).toBe(0);
    expect(executeCalls.some((call) => call.includes('/api/billing/balance'))).toBe(false);
  });

  test('CONTRACT mode remains staging-free for gate enable and ready-wait', async () => {
    let executeCalled = false;
    const helper = new StagingHelper({
      env: { E2E_MODE: 'contract' },
      execute: async () => {
        executeCalled = true;
        return '200';
      },
    });
    await expect(helper.enableExecutionGate()).rejects.toBeInstanceOf(StagingNotAuthorizedError);
    await expect(helper.waitForGatewayReady()).rejects.toBeInstanceOf(StagingNotAuthorizedError);
    expect(executeCalled).toBe(false);
    expect(liveConfig.retries).toBe(0);
    expect(new ProviderCallGuard(1).remaining).toBe(1);
  });
});

test.describe('AUTO-01D CREATE_SESSION response-observation race', () => {
  test.describe.configure({ mode: 'serial' });
  test('arms session observation before create-project confirm and keeps AUTO-01C ready-wait', () => {
    const liveAdaptersSource = fs.readFileSync(
      path.join(__dirname, '../lib/live-adapters.ts'),
      'utf8',
    );
    const networkSource = fs.readFileSync(path.join(__dirname, '../lib/network.ts'), 'utf8');
    const stagingSource = fs.readFileSync(path.join(__dirname, '../lib/staging.ts'), 'utf8');
    const armIdx = liveAdaptersSource.indexOf('armSessionCreateListener(page)');
    const confirmClickIdx = liveAdaptersSource.indexOf(
      'page.locator(SELECTORS.createProjectConfirm).click()',
    );
    expect(armIdx).toBeGreaterThan(-1);
    expect(confirmClickIdx).toBeGreaterThan(armIdx);
    expect(liveAdaptersSource).not.toMatch(
      /waitForResponse\([\s\S]*\/api\\\/sessions/,
    );
    expect(networkSource).toContain('armSessionCreateListener');
    expect(SESSION_CREATE_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
    expect(SESSION_CREATE_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
    expect(stagingSource).toContain('waitForGatewayReady');
    expect(GOLDEN_PATH_PHASES.indexOf('PREVIEW')).toBe(
      GOLDEN_PATH_PHASES.indexOf('WAIT_FOR_AUTO_APPLY') + 1,
    );
    expect(liveConfig.retries).toBe(0);
    expect(new ProviderCallGuard(1).remaining).toBe(1);
  });

  test('captures POST /api/sessions fired immediately by create-project confirm and does not click the card', async ({
    page,
  }) => {
    const fixture = await createSessionRaceFixtureServer('auto-on-create');
    try {
      await page.goto(`${fixture.url}/en/app`);
      await page.locator(SELECTORS.sidebarProjects).click();
      await page.locator(SELECTORS.newProjectButton).click();
      await page.locator(SELECTORS.newProjectInput).fill('demo');
      const result = await createProjectAndObserveSession(page, { timeoutMs: 5_000 });
      expect(result.projectId).toBe(SESSION_RACE_PROJECT_ID);
      expect(result.sessionId).toBe(SESSION_RACE_SESSION_ID);
      expect(result.clickedProjectCard).toBe(false);
      expect(fixture.sessionPostCount()).toBe(1);
      expect(await page.evaluate(() => (window as { __cardClicks?: number }).__cardClicks ?? 0)).toBe(
        0,
      );
    } finally {
      await fixture.close();
    }
  });

  test('captures a session response that arrives before project-response parsing completes', async ({
    page,
  }) => {
    const fixture = await createSessionRaceFixtureServer('session-before-project');
    try {
      await page.goto(`${fixture.url}/en/app`);
      const result = await createProjectAndObserveSession(page, { timeoutMs: 5_000 });
      expect(result.projectId).toBe(SESSION_RACE_PROJECT_ID);
      expect(result.sessionId).toBe(SESSION_RACE_SESSION_ID);
      expect(result.clickedProjectCard).toBe(false);
      expect(fixture.sessionPostCount()).toBe(1);
    } finally {
      await fixture.close();
    }
  });

  test('falls back to one project-card click when create-project does not auto-open a session', async ({
    page,
  }) => {
    const fixture = await createSessionRaceFixtureServer('on-card-click');
    try {
      await page.goto(`${fixture.url}/en/app`);
      const result = await createProjectAndObserveSession(page, { timeoutMs: 5_000 });
      expect(result.projectId).toBe(SESSION_RACE_PROJECT_ID);
      expect(result.sessionId).toBe(SESSION_RACE_SESSION_ID);
      expect(result.clickedProjectCard).toBe(true);
      expect(fixture.sessionPostCount()).toBe(1);
      expect(await page.evaluate(() => (window as { __cardClicks?: number }).__cardClicks ?? 0)).toBe(
        1,
      );
    } finally {
      await fixture.close();
    }
  });

  test('missing session response fails inside the bounded adapter timeout', async ({ page }) => {
    const fixture = await createSessionRaceFixtureServer('never');
    try {
      await page.goto(`${fixture.url}/en/app`);
      const started = Date.now();
      await expect(
        createProjectAndObserveSession(page, { timeoutMs: 400 }),
      ).rejects.toBeInstanceOf(SessionObservationError);
      expect(Date.now() - started).toBeLessThan(5_000);
    } finally {
      await fixture.close();
    }
  });

  test('CREATE_SESSION observation failure returns through runGoldenPath so CLEANUP restores the gate', async () => {
    const recording = createRecordingAdapters({ enableGate: true });
    recording.adapters.createSession = async () => {
      recording.calls.push('CREATE_SESSION');
      throw new SessionObservationError('Timed out waiting for POST /api/sessions after 400ms.');
    };
    const providerGuard = new ProviderCallGuard(1);
    const result = await runGoldenPath({
      mode: 'contract',
      adapters: recording.adapters,
      gateTracker: recording.gateTracker,
      providerGuard,
    });

    expect(result.summary.verdict).toBe('FAIL');
    if (result.summary.verdict === 'FAIL') {
      expect(result.summary.phase).toBe('CREATE_SESSION');
      expect(result.summary.error).toMatch(/POST \/api\/sessions/);
      expect(result.summary.executionGateFinal).toBe('restored-false');
      expect(result.summary.cleanup).toBe('session-stopped');
    }
    expect(result.phases).toContain('CLEANUP');
    expect(result.phases).not.toContain('BUILD');
    expect(recording.calls.at(-1)).toBe('CLEANUP');
    expect(providerGuard.usedCount).toBe(0);
    expect(providerGuard.remaining).toBe(1);
    expect(liveConfig.retries).toBe(0);
    expect(GOLDEN_PATH_PHASES.indexOf('PREVIEW')).toBe(
      GOLDEN_PATH_PHASES.indexOf('WAIT_FOR_AUTO_APPLY') + 1,
    );
  });

  test('LIVE createSession captures an auto-opened session without a second POST', async ({
    browser,
  }) => {
    const fixture = await createSessionRaceFixtureServer('auto-on-create');
    const helper = fastReadyHelper({
      env: liveEnvWithCreds,
      execute: async () => '',
    });
    const live = await createLiveAdapters({
      browser,
      env: { ...liveEnvWithCreds, E2E_BASE_URL: fixture.url },
      staging: helper,
      readLocalHead: async () => DYNAMIC_HEAD_B,
    });
    try {
      const created = await live.adapters.createSession();
      expect(created.projectId).toBe(SESSION_RACE_PROJECT_ID);
      expect(created.sessionId).toBe(SESSION_RACE_SESSION_ID);
      expect(fixture.sessionPostCount()).toBe(1);
    } finally {
      await live.context.close();
      await fixture.close();
    }
  });
});

const OUTER_LIVE_TIMEOUT_MS = liveConfig.timeout ?? 0;
const STALL_BOUND_MS = 700;
const STALL_ASSERTION_CEILING_MS = 10_000;

async function openFixtureCreateForm(page: Page, fixtureUrl: string): Promise<void> {
  await page.goto(`${fixtureUrl}/en/app`);
  await page.locator(SELECTORS.sidebarProjects).click();
  await page.locator(SELECTORS.newProjectButton).click();
  await page.locator(SELECTORS.newProjectInput).fill('demo');
}

test.describe('AUTO-01E CREATE_SESSION project-observation bounding', () => {
  test.describe.configure({ mode: 'serial' });

  test('LIVE config declares finite per-operation timeouts, keeps the 600s test timeout, and keeps trace off', () => {
    const use = liveConfig.use;
    expect(use?.actionTimeout).toBe(30_000);
    expect(use?.navigationTimeout).toBe(60_000);
    expect(liveConfig.timeout).toBe(600_000);
    expect(use?.trace).toBe('off');
    expect(LIVE_ACTION_TIMEOUT_MS).toBe(30_000);
    expect(LIVE_NAVIGATION_TIMEOUT_MS).toBe(60_000);

    for (const bound of [
      use?.actionTimeout,
      use?.navigationTimeout,
      PROJECT_CREATE_OBSERVATION_TIMEOUT_MS,
      PROJECT_CREATE_BODY_TIMEOUT_MS,
      PROJECT_CARD_CLICK_TIMEOUT_MS,
      SESSION_CREATE_TIMEOUT_MS,
    ]) {
      expect(Number.isFinite(bound)).toBe(true);
      expect(bound).toBeGreaterThan(0);
      expect(bound).toBeLessThan(OUTER_LIVE_TIMEOUT_MS);
    }
    expect(PROJECT_CARD_CLICK_TIMEOUT_MS).toBe(10_000);
    expect(liveConfig.retries).toBe(0);
  });

  test('project-create observation statements carry explicit bounds in source', () => {
    const adapterSource = fs.readFileSync(
      path.join(__dirname, '../lib/live-adapters.ts'),
      'utf8',
    );
    const configSource = fs.readFileSync(
      path.join(__dirname, '../playwright.live.config.ts'),
      'utf8',
    );
    expect(adapterSource).toMatch(
      /\/api\\\/projects[\s\S]{0,240}\{ timeout: projectResponseTimeoutMs \}/,
    );
    expect(adapterSource).toContain(
      'readProjectCreateBody(projectResponse, projectBodyTimeoutMs)',
    );
    expect(adapterSource).toContain('card.click({ timeout: cardClickTimeoutMs })');
    expect(adapterSource).not.toContain('await projectResponse.json()');
    expect(adapterSource).not.toContain('await card.click();');
    expect(configSource).toMatch(/actionTimeout: LIVE_ACTION_TIMEOUT_MS/);
    expect(configSource).toMatch(/navigationTimeout: LIVE_NAVIGATION_TIMEOUT_MS/);
  });

  test('a project-create response that never arrives fails with a bounded typed adapter error', async ({
    page,
  }) => {
    const fixture = await createSessionRaceFixtureServer('project-response-stalls');
    try {
      await openFixtureCreateForm(page, fixture.url);
      const started = Date.now();
      await expect(
        createProjectAndObserveSession(page, {
          timeoutMs: 5_000,
          projectResponseTimeoutMs: STALL_BOUND_MS,
        }),
      ).rejects.toBeInstanceOf(ProjectCreateObservationError);
      const elapsed = Date.now() - started;
      expect(elapsed).toBeGreaterThanOrEqual(STALL_BOUND_MS - 100);
      expect(elapsed).toBeLessThan(STALL_ASSERTION_CEILING_MS);
      expect(elapsed).toBeLessThan(OUTER_LIVE_TIMEOUT_MS);
      expect(fixture.sessionPostCount()).toBe(0);
    } finally {
      await fixture.close();
    }
  });

  test('a project-create response body that never completes fails with a bounded typed adapter error', async ({
    page,
  }) => {
    const fixture = await createSessionRaceFixtureServer('project-body-stalls');
    try {
      await openFixtureCreateForm(page, fixture.url);
      const started = Date.now();
      const rejection = await createProjectAndObserveSession(page, {
        timeoutMs: 5_000,
        projectResponseTimeoutMs: 5_000,
        projectBodyTimeoutMs: STALL_BOUND_MS,
      }).then(
        () => null,
        (error: unknown) => error,
      );
      const elapsed = Date.now() - started;
      expect(rejection).toBeInstanceOf(ProjectCreateObservationError);
      expect((rejection as Error).message).toMatch(/response body/);
      expect(elapsed).toBeLessThan(STALL_ASSERTION_CEILING_MS);
      expect(elapsed).toBeLessThan(OUTER_LIVE_TIMEOUT_MS);
      expect(fixture.sessionPostCount()).toBe(0);
    } finally {
      await fixture.close();
    }
  });

  test('the fallback project-card click cannot wait indefinitely', async ({ page }) => {
    const fixture = await createSessionRaceFixtureServer('card-not-actionable');
    try {
      await openFixtureCreateForm(page, fixture.url);
      const started = Date.now();
      const rejection = await createProjectAndObserveSession(page, {
        timeoutMs: 5_000,
        cardClickTimeoutMs: 400,
      }).then(
        () => null,
        (error: unknown) => error,
      );
      const elapsed = Date.now() - started;
      expect(rejection).toBeInstanceOf(ProjectCreateObservationError);
      expect((rejection as Error).message).toMatch(/project-card click/);
      expect(elapsed).toBeLessThan(STALL_ASSERTION_CEILING_MS);
      expect(fixture.sessionPostCount()).toBe(0);
      expect(await page.evaluate(() => (window as { __cardClicks?: number }).__cardClicks ?? 0)).toBe(
        0,
      );
    } finally {
      await fixture.close();
    }
  });

  test('an auto-opened session that renders then removes the project card needs no card click', async ({
    page,
  }) => {
    const fixture = await createSessionRaceFixtureServer('auto-open-removes-card');
    try {
      await openFixtureCreateForm(page, fixture.url);
      const result = await createProjectAndObserveSession(page, { timeoutMs: 5_000 });
      expect(result.projectId).toBe(SESSION_RACE_PROJECT_ID);
      expect(result.sessionId).toBe(SESSION_RACE_SESSION_ID);
      expect(result.clickedProjectCard).toBe(false);
      expect(fixture.sessionPostCount()).toBe(1);
      expect(await page.evaluate(() => (window as { __cardClicks?: number }).__cardClicks ?? 0)).toBe(
        0,
      );
    } finally {
      await fixture.close();
    }
  });

  test('a stalled project-create response returns through runGoldenPath with CLEANUP and gate restore', async ({
    page,
  }) => {
    const fixture = await createSessionRaceFixtureServer('project-response-stalls');
    const recording = createRecordingAdapters({ enableGate: true });
    recording.adapters.createSession = async () => {
      recording.calls.push('CREATE_SESSION');
      await openFixtureCreateForm(page, fixture.url);
      return createProjectAndObserveSession(page, {
        timeoutMs: 5_000,
        projectResponseTimeoutMs: STALL_BOUND_MS,
      });
    };
    const providerGuard = new ProviderCallGuard(1);
    const started = Date.now();
    try {
      const result = await runGoldenPath({
        mode: 'contract',
        adapters: recording.adapters,
        gateTracker: recording.gateTracker,
        providerGuard,
      });
      expect(result.summary.verdict).toBe('FAIL');
      if (result.summary.verdict === 'FAIL') {
        expect(result.summary.phase).toBe('CREATE_SESSION');
        expect(result.summary.error).toMatch(/project-create response/);
        expect(result.summary.executionGateFinal).toBe('restored-false');
        expect(result.summary.cleanup).toBe('session-stopped');
      }
      expect(result.phases).toContain('CLEANUP');
      expect(result.phases).not.toContain('BUILD');
      expect(recording.calls.at(-1)).toBe('CLEANUP');
      expect(providerGuard.usedCount).toBe(0);
      expect(providerGuard.remaining).toBe(1);
      expect(Date.now() - started).toBeLessThan(OUTER_LIVE_TIMEOUT_MS);
    } finally {
      await fixture.close();
    }
  });

  test('a stalled project-create body returns through runGoldenPath with CLEANUP and gate restore', async ({
    page,
  }) => {
    const fixture = await createSessionRaceFixtureServer('project-body-stalls');
    const recording = createRecordingAdapters({ enableGate: true });
    recording.adapters.createSession = async () => {
      recording.calls.push('CREATE_SESSION');
      await openFixtureCreateForm(page, fixture.url);
      return createProjectAndObserveSession(page, {
        timeoutMs: 5_000,
        projectResponseTimeoutMs: 5_000,
        projectBodyTimeoutMs: STALL_BOUND_MS,
      });
    };
    const providerGuard = new ProviderCallGuard(1);
    const started = Date.now();
    try {
      const result = await runGoldenPath({
        mode: 'contract',
        adapters: recording.adapters,
        gateTracker: recording.gateTracker,
        providerGuard,
      });
      expect(result.summary.verdict).toBe('FAIL');
      if (result.summary.verdict === 'FAIL') {
        expect(result.summary.phase).toBe('CREATE_SESSION');
        expect(result.summary.error).toMatch(/response body/);
        expect(result.summary.executionGateFinal).toBe('restored-false');
        expect(result.summary.cleanup).toBe('session-stopped');
      }
      expect(result.phases).toContain('CLEANUP');
      expect(result.phases).not.toContain('BUILD');
      expect(recording.calls.at(-1)).toBe('CLEANUP');
      expect(providerGuard.usedCount).toBe(0);
      expect(Date.now() - started).toBeLessThan(OUTER_LIVE_TIMEOUT_MS);
    } finally {
      await fixture.close();
    }
  });
});

const CONTRACT_SSH_TIMEOUT_MS = 200;
const CONTRACT_SSH_WATCHDOG_MS = 1_000;
const CONTRACT_SSH_ASSERTION_CEILING_MS = 5_000;
const SECRET_REMOTE_FRAGMENT = 'super-secret-credential-value';

class NeverExitingSshChild extends EventEmitter {
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  killCount = 0;

  kill(): boolean {
    this.killCount += 1;
    return true;
  }
}

async function raceSshExecutorOutcome(
  pending: Promise<string>,
  watchdogMs: number,
): Promise<
  | { state: 'resolved'; stdout: string }
  | { state: 'rejected'; error: unknown }
  | { state: 'still-pending' }
> {
  return Promise.race([
    pending.then(
      (stdout) => ({ state: 'resolved' as const, stdout }),
      (error: unknown) => ({ state: 'rejected' as const, error }),
    ),
    new Promise<{ state: 'still-pending' }>((resolve) => {
      setTimeout(() => resolve({ state: 'still-pending' }), watchdogMs);
    }),
  ]);
}

test.describe('AUTO-01F bounded SSH execution', () => {
  test('spawned SSH child that never exits must not remain pending past the execution timeout', async () => {
    expect(SSH_EXECUTION_TIMEOUT_MS).toBe(30_000);
    const child = new NeverExitingSshChild();
    let spawnCount = 0;
    const execute = createSshExecutor({
      spawnFn: () => {
        spawnCount += 1;
        return child;
      },
      timeoutMs: CONTRACT_SSH_TIMEOUT_MS,
    });
    const started = Date.now();
    const outcome = await raceSshExecutorOutcome(
      execute(buildSshCommand(`echo ${SECRET_REMOTE_FRAGMENT}`)),
      CONTRACT_SSH_WATCHDOG_MS,
    );
    const elapsed = Date.now() - started;

    expect(outcome.state).toBe('rejected');
    if (outcome.state !== 'rejected') {
      return;
    }
    expect(outcome.error).toBeInstanceOf(SshExecutionTimeoutError);
    const timeoutError = outcome.error as SshExecutionTimeoutError;
    expect(timeoutError.timeoutMs).toBe(CONTRACT_SSH_TIMEOUT_MS);
    expect(timeoutError.killInvoked).toBe(true);
    expect(timeoutError.killAccepted).toBe(true);
    expect(child.killCount).toBe(1);
    expect(spawnCount).toBe(1);
    expect(elapsed).toBeGreaterThanOrEqual(CONTRACT_SSH_TIMEOUT_MS - 50);
    expect(elapsed).toBeLessThan(CONTRACT_SSH_ASSERTION_CEILING_MS);
    expect(elapsed).toBeLessThan(OUTER_LIVE_TIMEOUT_MS);
    expect(timeoutError.message).not.toContain(SECRET_REMOTE_FRAGMENT);
    expect(timeoutError.message).toMatch(/timed out after 200ms/);
    expect(timeoutError.message).toMatch(/kill invoked=true/);
  });

  test('timeout does not wait for child close and ignores a late close', async () => {
    const child = new NeverExitingSshChild();
    const execute = createSshExecutor({
      spawnFn: () => child,
      timeoutMs: CONTRACT_SSH_TIMEOUT_MS,
    });
    const pending = execute(buildSshCommand('true'));
    const started = Date.now();
    await expect(pending).rejects.toBeInstanceOf(SshExecutionTimeoutError);
    expect(Date.now() - started).toBeLessThan(CONTRACT_SSH_ASSERTION_CEILING_MS);
    expect(child.killCount).toBe(1);

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    child.emit('close', 0);
    await new Promise((resolve) => {
      setTimeout(resolve, 30);
    });
    process.off('unhandledRejection', onUnhandled);
    expect(unhandled).toEqual([]);
    expect(child.killCount).toBe(1);
    await expect(pending).rejects.toBeInstanceOf(SshExecutionTimeoutError);
  });

  test('timeout ignores a late child error without double-settling', async () => {
    const child = new NeverExitingSshChild();
    const execute = createSshExecutor({
      spawnFn: () => child,
      timeoutMs: CONTRACT_SSH_TIMEOUT_MS,
    });
    const pending = execute(buildSshCommand('true'));
    await expect(pending).rejects.toBeInstanceOf(SshExecutionTimeoutError);
    expect(child.killCount).toBe(1);

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    child.emit('error', new Error('late spawn error'));
    await new Promise((resolve) => {
      setTimeout(resolve, 30);
    });
    process.off('unhandledRejection', onUnhandled);
    expect(unhandled).toEqual([]);
    expect(child.killCount).toBe(1);
    await expect(pending).rejects.toBeInstanceOf(SshExecutionTimeoutError);
  });

  test('normal exit code 0 still returns stdout', async () => {
    const child = new NeverExitingSshChild();
    const execute = createSshExecutor({
      spawnFn: () => child,
      timeoutMs: CONTRACT_SSH_TIMEOUT_MS,
    });
    const pending = execute(buildSshCommand('true'));
    child.stdout.emit('data', 'parity-ok\n');
    child.emit('close', 0);
    await expect(pending).resolves.toBe('parity-ok\n');
    expect(child.killCount).toBe(0);
  });

  test('normal nonzero exit preserves existing failure behavior', async () => {
    const child = new NeverExitingSshChild();
    const execute = createSshExecutor({
      spawnFn: () => child,
      timeoutMs: CONTRACT_SSH_TIMEOUT_MS,
    });
    const pending = execute(buildSshCommand('false'));
    child.stderr.emit('data', 'Permission denied\n');
    child.emit('close', 255);
    await expect(pending).rejects.toThrow('ssh exited 255: Permission denied\n');
    expect(child.killCount).toBe(0);
  });

  test('ordinary spawn error preserves existing failure behavior', async () => {
    const child = new NeverExitingSshChild();
    const spawnError = Object.assign(new Error('spawn ssh ENOENT'), { code: 'ENOENT' });
    const execute = createSshExecutor({
      spawnFn: () => {
        queueMicrotask(() => {
          child.emit('error', spawnError);
        });
        return child;
      },
      timeoutMs: CONTRACT_SSH_TIMEOUT_MS,
    });
    await expect(execute(buildSshCommand('true'))).rejects.toBe(spawnError);
    expect(child.killCount).toBe(0);
  });

  test('timeout error contains bounded safe diagnostics and does not retry SSH', async () => {
    const child = new NeverExitingSshChild();
    let spawnCount = 0;
    const execute = createSshExecutor({
      spawnFn: () => {
        spawnCount += 1;
        return child;
      },
      timeoutMs: CONTRACT_SSH_TIMEOUT_MS,
    });
    const longStdout = `${'A'.repeat(500)}UNIQUE_STDOUT_TAIL`;
    const longStderr = `${'B'.repeat(500)}UNIQUE_STDERR_TAIL`;
    const pending = execute(
      buildSshCommand(`export PASSWORD=${SECRET_REMOTE_FRAGMENT}; true`),
    );
    child.stdout.emit('data', longStdout);
    child.stderr.emit('data', longStderr);
    const timeoutError = await pending.then(
      () => {
        throw new Error('expected SSH timeout');
      },
      (error: unknown) => error,
    );
    expect(timeoutError).toBeInstanceOf(SshExecutionTimeoutError);
    const typed = timeoutError as SshExecutionTimeoutError;
    expect(typed.stdout.endsWith('…')).toBe(true);
    expect(typed.stderr.endsWith('…')).toBe(true);
    expect(typed.stdout.length).toBeLessThanOrEqual(401);
    expect(typed.stderr.length).toBeLessThanOrEqual(401);
    expect(typed.stdout).not.toContain('UNIQUE_STDOUT_TAIL');
    expect(typed.stderr).not.toContain('UNIQUE_STDERR_TAIL');
    expect(typed.message).not.toContain(SECRET_REMOTE_FRAGMENT);
    expect(typed.message).not.toContain('PASSWORD=');
    expect(spawnCount).toBe(1);
    expect(child.killCount).toBe(1);
  });

  test('non-timeout SSH restore failure remains restore-failed', async () => {
    const helper = new StagingHelper({
      env: liveEnv,
      execute: async () => {
        throw new Error('ssh exited 255: Permission denied');
      },
    });
    helper.gateTracker.recordEnabledByRunner();
    await expect(helper.restoreExecutionGateIfChanged()).resolves.toBe('restore-failed');
  });

  test('successful restore remains restored-false and is not mapped to timeout', async () => {
    const helper = new StagingHelper({
      env: liveEnv,
      execute: async () => '',
    });
    helper.gateTracker.recordEnabledByRunner();
    await expect(helper.restoreExecutionGateIfChanged()).resolves.toBe('restored-false');
  });

  test('gate-restore SSH hang times out, cleanup continues, and restoration is unconfirmed', async () => {
    const child = new NeverExitingSshChild();
    let spawnCount = 0;
    let restoreAttempts = 0;
    let localCleanupCompleted = false;
    const execute = createSshExecutor({
      spawnFn: (_command, args) => {
        spawnCount += 1;
        if ((args[1] ?? '').includes('GLOBAL_EXECUTION_ENABLED=false pm2 restart')) {
          restoreAttempts += 1;
        }
        return child;
      },
      timeoutMs: CONTRACT_SSH_TIMEOUT_MS,
    });
    const gateTracker = new ExecutionGateTracker();
    const helper = new StagingHelper({
      env: liveEnv,
      execute,
      gateTracker,
    });
    const recording = createRecordingAdapters();
    recording.adapters.runSafetyChecks = async () => {
      recording.calls.push('SAFETY');
      gateTracker.recordEnabledByRunner();
      throw new Error('forced SAFETY failure after execution gate enabled');
    };
    recording.adapters.cleanup = async () => {
      recording.calls.push('CLEANUP');
      const executionGateFinal = await helper.restoreExecutionGateIfChanged();
      localCleanupCompleted = true;
      return { cleanup: 'session-stopped', executionGateFinal };
    };
    const providerGuard = new ProviderCallGuard(1);
    const started = Date.now();
    const result = await runGoldenPath({
      mode: 'contract',
      adapters: recording.adapters,
      gateTracker,
      providerGuard,
    });
    const elapsed = Date.now() - started;

    expect(result.summary.verdict).toBe('FAIL');
    if (result.summary.verdict === 'FAIL') {
      expect(result.summary.phase).toBe('SAFETY');
      expect(result.summary.cleanup).toBe('session-stopped');
      expect(result.summary.executionGateFinal).not.toBe('restored-false');
      expect(result.summary.executionGateFinal).toBe('restore-unconfirmed-timeout');
      expect(result.formatted).toMatch(/^verdict=FAIL$/m);
      expect(result.formatted).toContain('executionGateFinal=restore-unconfirmed-timeout');
    }
    expect(result.phases).toContain('CLEANUP');
    expect(result.phases.at(-1)).toBe('CLEANUP');
    expect(recording.calls.at(-1)).toBe('CLEANUP');
    expect(localCleanupCompleted).toBe(true);
    expect(providerGuard.usedCount).toBe(0);
    expect(providerGuard.remaining).toBe(1);
    expect(liveConfig.retries).toBe(0);
    expect(spawnCount).toBe(1);
    expect(restoreAttempts).toBe(1);
    expect(child.killCount).toBe(1);
    expect(elapsed).toBeLessThan(CONTRACT_SSH_ASSERTION_CEILING_MS);
    expect(elapsed).toBeLessThan(OUTER_LIVE_TIMEOUT_MS);
    expect(buildGateRestoreCommand()).toContain('GLOBAL_EXECUTION_ENABLED=false');
  });
});

const AUTO_APPLY_BOUND_MS = 400;
const AUTO_APPLY_ASSERTION_CEILING_MS = 5_000;

async function createAutoApplyLive(
  browser: Browser,
  fixtureUrl: string,
  timeoutMs = AUTO_APPLY_BOUND_MS,
) {
  const helper = fastReadyHelper({
    env: liveEnvWithCreds,
    execute: async () => '',
  });
  return createLiveAdapters({
    browser,
    env: { ...liveEnvWithCreds, E2E_BASE_URL: fixtureUrl },
    staging: helper,
    readLocalHead: async () => DYNAMIC_HEAD_B,
    autoApplyTimeoutMs: timeoutMs,
  });
}

async function fireSessionFileWrite(
  page: Page,
  input: { sessionId: string; path?: string; malformed?: boolean },
): Promise<void> {
  await page.evaluate(async (payload) => {
    await fetch(`/api/sessions/${payload.sessionId}/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload.malformed
        ? '{not-json'
        : JSON.stringify({ path: payload.path, content: '<p>e2e</p>' }),
    });
  }, {
    sessionId: input.sessionId,
    path: input.path ?? FROZEN_ARTIFACT_PATH,
    malformed: input.malformed === true,
  });
}

test.describe('AUTO-01G WAIT_FOR_AUTO_APPLY file-write observation', () => {
  test.describe.configure({ mode: 'serial' });

  test('matches POST /api/sessions/:sessionId/files/write only and inspects path fail-closed', () => {
    const writeUrl =
      'https://staging.ainow.biz/api/sessions/session-auto-apply-1/files/write';
    expect(isSessionFileWriteUrl(writeUrl)).toBe(true);
    expect(isSessionFileWriteUrl(`${writeUrl}/`)).toBe(true);
    expect(isSessionFileWriteUrl('https://staging.ainow.biz/api/sessions')).toBe(false);
    expect(
      isSessionFileWriteUrl(
        'https://staging.ainow.biz/api/sessions/session-auto-apply-1/files/list',
      ),
    ).toBe(false);
    expect(extractSessionIdFromFileWriteUrl(writeUrl)).toBe(AUTO_APPLY_SESSION_ID);
    expect(inspectFileWriteRequestBody(JSON.stringify({ path: FROZEN_ARTIFACT_PATH }))).toEqual({
      malformed: false,
      path: FROZEN_ARTIFACT_PATH,
    });
    expect(inspectFileWriteRequestBody('{not-json')).toEqual({
      malformed: true,
      path: null,
    });
    expect(GOLDEN_PATH_PHASES.indexOf('PREVIEW')).toBe(
      GOLDEN_PATH_PHASES.indexOf('WAIT_FOR_AUTO_APPLY') + 1,
    );
    expect(GOLDEN_PATH_PHASES.indexOf('ARM_LISTENERS')).toBeLessThan(
      GOLDEN_PATH_PHASES.indexOf('CREATE_SESSION'),
    );
    expect(GOLDEN_PATH_PHASES.indexOf('CREATE_SESSION')).toBeLessThan(
      GOLDEN_PATH_PHASES.indexOf('BUILD'),
    );
    expect(GOLDEN_PATH_PHASES.indexOf('BUILD')).toBeLessThan(
      GOLDEN_PATH_PHASES.indexOf('WAIT_FOR_AUTO_APPLY'),
    );
    const liveAdaptersSource = fs.readFileSync(
      path.join(__dirname, '../lib/live-adapters.ts'),
      'utf8',
    );
    const networkSource = fs.readFileSync(path.join(__dirname, '../lib/network.ts'), 'utf8');
    expect(networkSource).toContain('armFileWriteListener');
    expect(networkSource).toContain('AutoApplyObservationError');
    expect(liveAdaptersSource).toContain('armFileWriteListener(page)');
    expect(liveAdaptersSource).not.toMatch(/locator\(SELECTORS\.autoFileNode\)\.waitFor/);
    expect(liveAdaptersSource).not.toContain('workspace-tab-codeFiles');
    const armIdx = liveAdaptersSource.indexOf('armFileWriteListener(page)');
    const submitIdx = liveAdaptersSource.indexOf('async submitBuild');
    const waitIdx = liveAdaptersSource.indexOf('waitForMatchingWrite');
    expect(armIdx).toBeGreaterThan(-1);
    expect(armIdx).toBeLessThan(submitIdx);
    expect(waitIdx).toBeGreaterThan(submitIdx);
    const waitFn = liveAdaptersSource.slice(
      liveAdaptersSource.indexOf('async waitForAutoApply()'),
      liveAdaptersSource.indexOf('async verifyPreview()'),
    );
    expect(waitFn).not.toContain('armFileWriteListener');
    expect(waitFn).toContain('awaitingConfirmation');
  });

  test('LIVE-06 reproduction: Preview-default successful write is observed without Code & Files', async ({
    browser,
  }) => {
    const fixture = await createAutoApplyFixtureServer('auto-apply-on-preview-tab');
    const live = await createAutoApplyLive(browser, fixture.url);
    const started = Date.now();
    try {
      await live.adapters.armListeners();
      const created = await live.adapters.createSession();
      expect(created.sessionId).toBe(AUTO_APPLY_SESSION_ID);
      expect(created.projectId).toBe(AUTO_APPLY_PROJECT_ID);
      expect(await live.page.locator('[data-testid="workspace-tab-preview"]').getAttribute('data-active')).toBe(
        'true',
      );
      expect(await live.page.locator(SELECTORS.autoFileNode).count()).toBe(0);

      await live.page.locator(SELECTORS.chatSubmit).click();
      await expect.poll(() => fixture.fileWriteCount()).toBe(1);
      expect(fixture.writtenPaths()).toContain(FROZEN_ARTIFACT_PATH);
      expect(await live.page.locator('[data-testid="workspace-chat-file-actions-list"]')).toContainText(
        FROZEN_ARTIFACT_PATH,
      );
      expect(await live.page.locator(SELECTORS.autoFileNode).count()).toBe(0);
      expect(await live.page.locator('[data-testid="workspace-tab-preview"]').getAttribute('data-active')).toBe(
        'true',
      );

      const applied = await live.adapters.waitForAutoApply();
      expect(applied.fileApplied).toBe(true);
      expect(applied.autoApplyAt).toBeGreaterThan(0);
      expect(await live.page.locator(SELECTORS.autoFileNode).count()).toBe(0);
      expect(await live.page.locator('[data-testid="workspace-tab-preview"]').getAttribute('data-active')).toBe(
        'true',
      );
      expect(await live.page.locator('[data-testid="workspace-tab-codeFiles"]').getAttribute('data-active')).toBe(
        'false',
      );
      expect(Date.now() - started).toBeLessThan(AUTO_APPLY_ASSERTION_CEILING_MS);
    } finally {
      await live.context.close();
      await fixture.close();
    }
  });

  test('retains a matching files/write that arrives before waitForAutoApply', async ({ page }) => {
    const fixture = await createAutoApplyFixtureServer('auto-apply-on-preview-tab');
    try {
      await page.goto(`${fixture.url}/en/app`);
      const listener = await armFileWriteListener(page);
      await fireSessionFileWrite(page, { sessionId: AUTO_APPLY_SESSION_ID });
      await expect.poll(() => fixture.fileWriteCount()).toBe(1);
      const capture = await listener.waitForMatchingWrite({
        sessionId: AUTO_APPLY_SESSION_ID,
        path: FROZEN_ARTIFACT_PATH,
        timeoutMs: AUTO_APPLY_BOUND_MS,
      });
      expect(capture.status).toBe(204);
      expect(capture.path).toBe(FROZEN_ARTIFACT_PATH);
      expect(capture.sessionId).toBe(AUTO_APPLY_SESSION_ID);
      await listener.dispose();
    } finally {
      await fixture.close();
    }
  });

  test('pre-sessionId capture still matches after CREATE_SESSION resolves the same session', async ({
    browser,
  }) => {
    const fixture = await createAutoApplyFixtureServer('auto-apply-on-preview-tab');
    const live = await createAutoApplyLive(browser, fixture.url);
    try {
      await live.page.goto(`${fixture.url}/en/app`);
      await live.adapters.armListeners();
      await fireSessionFileWrite(live.page, { sessionId: AUTO_APPLY_SESSION_ID });
      await expect.poll(() => fixture.fileWriteCount()).toBe(1);
      const created = await live.adapters.createSession();
      expect(created.sessionId).toBe(AUTO_APPLY_SESSION_ID);
      expect(fixture.fileWriteCount()).toBe(1);
      const applied = await live.adapters.waitForAutoApply();
      expect(applied.fileApplied).toBe(true);
      expect(await live.page.locator(SELECTORS.autoFileNode).count()).toBe(0);
    } finally {
      await live.context.close();
      await fixture.close();
    }
  });

  test('a matching path from the wrong session does not satisfy AUTO_APPLY', async ({ page }) => {
    const fixture = await createAutoApplyFixtureServer('auto-apply-on-preview-tab');
    try {
      await page.goto(`${fixture.url}/en/app`);
      const listener = await armFileWriteListener(page);
      await fireSessionFileWrite(page, { sessionId: AUTO_APPLY_OTHER_SESSION_ID });
      await expect.poll(() => fixture.fileWriteCount()).toBe(1);
      const started = Date.now();
      await expect(
        listener.waitForMatchingWrite({
          sessionId: AUTO_APPLY_SESSION_ID,
          path: FROZEN_ARTIFACT_PATH,
          timeoutMs: AUTO_APPLY_BOUND_MS,
        }),
      ).rejects.toBeInstanceOf(AutoApplyObservationError);
      expect(Date.now() - started).toBeLessThan(AUTO_APPLY_ASSERTION_CEILING_MS);
      await listener.dispose();
    } finally {
      await fixture.close();
    }
  });

  test('a write to the wrong path does not satisfy AUTO_APPLY', async ({ page }) => {
    const fixture = await createAutoApplyFixtureServer('wrong-path');
    try {
      await page.goto(`${fixture.url}/en/app`);
      const listener = await armFileWriteListener(page);
      await page.locator(SELECTORS.chatSubmit).click();
      await expect.poll(() => fixture.writtenPaths()).toEqual([AUTO_APPLY_WRONG_PATH]);
      await expect(
        listener.waitForMatchingWrite({
          sessionId: AUTO_APPLY_SESSION_ID,
          path: FROZEN_ARTIFACT_PATH,
          timeoutMs: AUTO_APPLY_BOUND_MS,
        }),
      ).rejects.toBeInstanceOf(AutoApplyObservationError);
      await listener.dispose();
    } finally {
      await fixture.close();
    }
  });

  test('missing write fails closed with a bounded AutoApplyObservationError', async ({
    browser,
  }) => {
    const fixture = await createAutoApplyFixtureServer('no-write');
    const live = await createAutoApplyLive(browser, fixture.url);
    const started = Date.now();
    try {
      await live.adapters.armListeners();
      await live.adapters.createSession();
      await live.page.locator(SELECTORS.chatSubmit).click();
      const rejection = await live.adapters.waitForAutoApply().then(
        () => null,
        (error: unknown) => error,
      );
      expect(rejection).toBeInstanceOf(AutoApplyObservationError);
      expect((rejection as Error).message).toMatch(/Timed out waiting for POST \/api\/sessions\/:sessionId\/files\/write/);
      expect(fixture.fileWriteCount()).toBe(0);
      expect(Date.now() - started).toBeLessThan(AUTO_APPLY_ASSERTION_CEILING_MS);
    } finally {
      await live.context.close();
      await fixture.close();
    }
  });

  test('a matching non-204 write does not report persistence PASS', async ({ page }) => {
    const fixture = await createAutoApplyFixtureServer('failed-write');
    try {
      await page.goto(`${fixture.url}/en/app`);
      const listener = await armFileWriteListener(page);
      await page.locator(SELECTORS.chatSubmit).click();
      await expect.poll(() => fixture.fileWriteCount()).toBe(1);
      const rejection = await listener
        .waitForMatchingWrite({
          sessionId: AUTO_APPLY_SESSION_ID,
          path: FROZEN_ARTIFACT_PATH,
          timeoutMs: AUTO_APPLY_BOUND_MS,
        })
        .then(
          () => null,
          (error: unknown) => error,
        );
      expect(rejection).toBeInstanceOf(AutoApplyObservationError);
      expect((rejection as Error).message).toMatch(/HTTP 500/);
      await listener.dispose();
    } finally {
      await fixture.close();
    }
  });

  test('malformed write JSON fails closed and does not satisfy AUTO_APPLY', async ({ page }) => {
    const fixture = await createAutoApplyFixtureServer('malformed-body');
    try {
      await page.goto(`${fixture.url}/en/app`);
      const listener = await armFileWriteListener(page);
      await page.locator(SELECTORS.chatSubmit).click();
      await expect.poll(() => fixture.fileWriteCount()).toBe(1);
      const rejection = await listener
        .waitForMatchingWrite({
          sessionId: AUTO_APPLY_SESSION_ID,
          path: FROZEN_ARTIFACT_PATH,
          timeoutMs: AUTO_APPLY_BOUND_MS,
        })
        .then(
          () => null,
          (error: unknown) => error,
        );
      expect(rejection).toBeInstanceOf(AutoApplyObservationError);
      expect((rejection as Error).message).toMatch(/malformed/);
      expect((rejection as Error).message).not.toContain('{not-json');
      await listener.dispose();
    } finally {
      await fixture.close();
    }
  });

  test('awaiting-confirmation remains a negative AUTO_APPLY guard', async ({ browser }) => {
    const fixture = await createAutoApplyFixtureServer('awaiting-confirmation');
    const live = await createAutoApplyLive(browser, fixture.url);
    try {
      await live.adapters.armListeners();
      await live.adapters.createSession();
      await live.page.locator(SELECTORS.chatSubmit).click();
      await expect(live.page.locator(SELECTORS.awaitingConfirmation)).toHaveCount(1);
      await expect.poll(() => fixture.fileWriteCount()).toBe(1);
      await expect(live.adapters.waitForAutoApply()).rejects.toThrow(
        /awaiting-confirmation UI appeared/,
      );
    } finally {
      await live.context.close();
      await fixture.close();
    }
  });

  test('dispose stops capturing further file writes', async ({ page }) => {
    const fixture = await createAutoApplyFixtureServer('auto-apply-on-preview-tab');
    try {
      await page.goto(`${fixture.url}/en/app`);
      const listener = await armFileWriteListener(page);
      await listener.dispose();
      await fireSessionFileWrite(page, { sessionId: AUTO_APPLY_SESSION_ID });
      await expect.poll(() => fixture.fileWriteCount()).toBe(1);
      expect(listener.captures).toEqual([]);
      await expect(
        listener.waitForMatchingWrite({
          sessionId: AUTO_APPLY_SESSION_ID,
          path: FROZEN_ARTIFACT_PATH,
          timeoutMs: AUTO_APPLY_BOUND_MS,
        }),
      ).rejects.toBeInstanceOf(AutoApplyObservationError);
    } finally {
      await fixture.close();
    }
  });

  test('a single matching write is not reported as duplicate success', async ({ page }) => {
    const fixture = await createAutoApplyFixtureServer('auto-apply-on-preview-tab');
    try {
      await page.goto(`${fixture.url}/en/app`);
      const listener = await armFileWriteListener(page);
      await fireSessionFileWrite(page, { sessionId: AUTO_APPLY_SESSION_ID });
      const first = await listener.waitForMatchingWrite({
        sessionId: AUTO_APPLY_SESSION_ID,
        path: FROZEN_ARTIFACT_PATH,
        timeoutMs: AUTO_APPLY_BOUND_MS,
      });
      const second = await listener.waitForMatchingWrite({
        sessionId: AUTO_APPLY_SESSION_ID,
        path: FROZEN_ARTIFACT_PATH,
        timeoutMs: AUTO_APPLY_BOUND_MS,
      });
      expect(second.observedAt).toBe(first.observedAt);
      expect(listener.captures.filter((capture) => capture.status === 204)).toHaveLength(1);
      await listener.dispose();
    } finally {
      await fixture.close();
    }
  });

  test('runner ARM_LISTENERS → BUILD write → WAIT_FOR_AUTO_APPLY PASS → PREVIEW next', async ({
    browser,
  }) => {
    const fixture = await createAutoApplyFixtureServer('auto-apply-on-preview-tab');
    const live = await createAutoApplyLive(browser, fixture.url);
    const recording = createRecordingAdapters();
    recording.adapters.armListeners = async () => {
      recording.calls.push('ARM_LISTENERS');
      await live.adapters.armListeners();
    };
    recording.adapters.createSession = async () => {
      recording.calls.push('CREATE_SESSION');
      return live.adapters.createSession();
    };
    recording.adapters.submitBuild = async (input) => {
      recording.calls.push('BUILD');
      return live.adapters.submitBuild(input);
    };
    recording.adapters.waitForAutoApply = async () => {
      recording.calls.push('WAIT_FOR_AUTO_APPLY');
      const applied = await live.adapters.waitForAutoApply();
      expect(await live.page.locator(SELECTORS.autoFileNode).count()).toBe(0);
      expect(await live.page.locator('[data-testid="workspace-tab-preview"]').getAttribute('data-active')).toBe(
        'true',
      );
      return applied;
    };
    recording.adapters.cleanup = async (input) => {
      recording.calls.push('CLEANUP');
      return live.adapters.cleanup(input);
    };
    const providerGuard = new ProviderCallGuard(1);
    try {
      const result = await runGoldenPath({
        mode: 'contract',
        adapters: recording.adapters,
        gateTracker: recording.gateTracker,
        providerGuard,
      });
      expect(result.summary.verdict).toBe('PASS');
      expect(result.phases.indexOf('PREVIEW')).toBe(
        result.phases.indexOf('WAIT_FOR_AUTO_APPLY') + 1,
      );
      expect(result.phases.indexOf('WAIT_FOR_AUTO_APPLY')).toBe(
        result.phases.indexOf('BUILD') + 1,
      );
      expect(result.phases).toEqual([...GOLDEN_PATH_PHASES]);
      expect(recording.calls).toContain('ARM_LISTENERS');
      expect(recording.calls.indexOf('ARM_LISTENERS')).toBeLessThan(
        recording.calls.indexOf('CREATE_SESSION'),
      );
      expect(recording.calls.indexOf('CREATE_SESSION')).toBeLessThan(recording.calls.indexOf('BUILD'));
      expect(recording.calls.indexOf('BUILD')).toBeLessThan(
        recording.calls.indexOf('WAIT_FOR_AUTO_APPLY'),
      );
      expect(fixture.writtenPaths()).toContain(FROZEN_ARTIFACT_PATH);
      expect(providerGuard.usedCount).toBe(1);
    } finally {
      await live.context.close().catch(() => undefined);
      await fixture.close();
    }
  });
});

const BUILD_OBSERVATION_BOUND_MS = 400;
const BUILD_OBSERVATION_ASSERTION_CEILING_MS = 5_000;

async function createBuildObservationLive(
  browser: Browser,
  fixtureUrl: string,
  timeouts?: {
    responseMs?: number;
    bodyMs?: number;
    autoApplyMs?: number;
  },
) {
  const helper = fastReadyHelper({
    env: liveEnvWithCreds,
    execute: async () => '',
  });
  return createLiveAdapters({
    browser,
    env: { ...liveEnvWithCreds, E2E_BASE_URL: fixtureUrl },
    staging: helper,
    readLocalHead: async () => DYNAMIC_HEAD_B,
    autoApplyTimeoutMs: timeouts?.autoApplyMs ?? AUTO_APPLY_BOUND_MS,
    buildExecutionResponseTimeoutMs: timeouts?.responseMs ?? BUILD_OBSERVATION_BOUND_MS,
    buildExecutionBodyTimeoutMs: timeouts?.bodyMs ?? BUILD_OBSERVATION_BOUND_MS,
  });
}

function fixtureSendClicks(page: Page): Promise<number> {
  return page.evaluate(() => (window as { __sendClicks?: number }).__sendClicks ?? 0);
}

function submitBuildSource(): string {
  const liveAdaptersSource = fs.readFileSync(
    path.join(__dirname, '../lib/live-adapters.ts'),
    'utf8',
  );
  const start = liveAdaptersSource.indexOf('async submitBuild');
  const end = liveAdaptersSource.indexOf('async waitForAutoApply()');
  return liveAdaptersSource.slice(start, end);
}

async function expectSubmitBuildClosed(
  browser: Browser,
  mode:
    | 'execute-missing'
    | 'execute-status-500'
    | 'execute-malformed-json'
    | 'execute-missing-id'
    | 'execute-empty-id'
    | 'execute-body-stalls',
  message: RegExp,
): Promise<void> {
  const fixture = await createAutoApplyFixtureServer(mode);
  const live = await createBuildObservationLive(browser, fixture.url);
  const providerGuard = new ProviderCallGuard(1);
  const started = Date.now();
  try {
    await live.adapters.createSession();
    const rejection = await live.adapters
      .submitBuild({
        sessionCreatedAt: Date.now(),
        providerGuard,
      })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(rejection).toBeInstanceOf(BuildExecutionObservationError);
    expect((rejection as Error).message).toMatch(message);
    expect(await fixtureSendClicks(live.page)).toBe(1);
    expect(providerGuard.usedCount).toBe(1);
    expect(providerGuard.remaining).toBe(0);
    expect(Date.now() - started).toBeLessThan(BUILD_OBSERVATION_ASSERTION_CEILING_MS);
    expect(Date.now() - started).toBeLessThan(OUTER_LIVE_TIMEOUT_MS);
  } finally {
    await live.context.close();
    await fixture.close();
  }
}

test.describe('AUTO-01H BUILD executionId observation', () => {
  test.describe.configure({ mode: 'serial' });

  test('matches POST /api/ai/execute only and keeps observation bounds finite', () => {
    expect(isAiExecuteUrl('https://staging.ainow.biz/api/ai/execute')).toBe(true);
    expect(isAiExecuteUrl('https://staging.ainow.biz/api/ai/execute/')).toBe(true);
    expect(isAiExecuteUrl('https://staging.ainow.biz/api/ai/executions')).toBe(false);
    expect(isAiExecuteUrl('https://staging.ainow.biz/api/ai/executions/')).toBe(false);
    expect(
      isAiExecuteUrl(
        'https://staging.ainow.biz/api/ai/executions/1a995035-6b1c-431b-acc2-8dd1e51a53da/stream',
      ),
    ).toBe(false);
    expect(
      isAiExecuteUrl(
        'https://staging.ainow.biz/api/ai/executions/1a995035-6b1c-431b-acc2-8dd1e51a53da/confirm-build-apply',
      ),
    ).toBe(false);
    expect(extractExecutionIdFromExecuteBody({ executionId: REAL_EXECUTE_EXECUTION_ID, status: 'queued' })).toBe(
      REAL_EXECUTE_EXECUTION_ID,
    );
    expect(extractExecutionIdFromExecuteBody({ id: REAL_EXECUTE_EXECUTION_ID })).toBeNull();
    expect(parseBuildExecutionId({ executionId: REAL_EXECUTE_EXECUTION_ID, status: 'queued' })).toBe(
      REAL_EXECUTE_EXECUTION_ID,
    );
    expect(() => parseBuildExecutionId({ status: 'queued' })).toThrow(BuildExecutionObservationError);
    expect(() => parseBuildExecutionId({ executionId: '' })).toThrow(/empty/);
    expect(() => parseBuildExecutionId('{not-json')).toThrow(/malformed/);

    expect(BUILD_EXECUTION_RESPONSE_TIMEOUT_MS).toBe(30_000);
    expect(BUILD_EXECUTION_BODY_TIMEOUT_MS).toBe(30_000);
    expect(BUILD_EXECUTION_RESPONSE_TIMEOUT_MS).toBeLessThan(120_000);
    expect(BUILD_EXECUTION_BODY_TIMEOUT_MS).toBeLessThan(OUTER_LIVE_TIMEOUT_MS);

    const submitFn = submitBuildSource();
    const liveAdaptersSource = fs.readFileSync(
      path.join(__dirname, '../lib/live-adapters.ts'),
      'utf8',
    );
    expect(submitFn).toContain('isAiExecuteUrl');
    expect(submitFn).toContain('readBuildExecutionBody');
    expect(submitFn).toContain('parseBuildExecutionId');
    expect(submitFn).toContain('buildExecutionResponseTimeoutMs');
    expect(submitFn).toContain('buildExecutionBodyTimeoutMs');
    expect(submitFn).not.toMatch(/\/api\\\/ai\\\/executions\\\/\?\$/);
    expect(submitFn).not.toContain('BUILD_TIMEOUT_SAFE');
    expect(submitFn).not.toContain('120_000');
    expect(submitFn).not.toContain('executionId = undefined');
    expect(submitFn).not.toMatch(/catch \{\s*executionId = undefined;/);
    expect(submitFn).not.toContain('EventSource');
    expect(submitFn).not.toMatch(/\/stream/);
    expect(submitFn).not.toContain('queryDeduction');
    expect(submitFn).not.toContain('usage_records');
    expect(submitFn).not.toContain('await executionResponse.json()');
    expect((submitFn.match(/authorizeCall\(\)/g) ?? []).length).toBe(1);
    expect((submitFn.match(/chatSubmit/g) ?? []).length).toBe(1);
    expect(liveAdaptersSource).not.toContain('const BUILD_TIMEOUT_SAFE');
  });

  test('observes POST /api/ai/execute 202 JSON executionId and returns that exact ID', async ({
    browser,
  }) => {
    const fixture = await createAutoApplyFixtureServer('real-execute-202');
    const live = await createBuildObservationLive(browser, fixture.url);
    const providerGuard = new ProviderCallGuard(1);
    const started = Date.now();
    try {
      await live.adapters.createSession();
      const build = await live.adapters.submitBuild({
        sessionCreatedAt: Date.now(),
        providerGuard,
      });
      expect(build.executionId).toBe(REAL_EXECUTE_EXECUTION_ID);
      expect(fixture.executePostCount()).toBe(1);
      expect(fixture.executionsCollectionPostCount()).toBe(0);
      expect(await fixtureSendClicks(live.page)).toBe(1);
      expect(providerGuard.usedCount).toBe(1);
      expect(providerGuard.remaining).toBe(0);
      expect(Date.now() - started).toBeLessThan(BUILD_OBSERVATION_ASSERTION_CEILING_MS);
      expect(Date.now() - started).toBeLessThan(120_000);
    } finally {
      await live.context.close();
      await fixture.close();
    }
  });

  test('missing execute response fails closed with a bounded BuildExecutionObservationError', async ({
    browser,
  }) => {
    await expectSubmitBuildClosed(browser, 'execute-missing', /Did not observe POST \/api\/ai\/execute/);
  });

  test('a non-202 execute status fails closed', async ({ browser }) => {
    await expectSubmitBuildClosed(browser, 'execute-status-500', /HTTP 500/);
  });

  test('malformed execute JSON fails closed', async ({ browser }) => {
    await expectSubmitBuildClosed(
      browser,
      'execute-malformed-json',
      /Could not read the POST \/api\/ai\/execute response body/,
    );
  });

  test('missing executionId fails closed', async ({ browser }) => {
    await expectSubmitBuildClosed(
      browser,
      'execute-missing-id',
      /did not include executionId/,
    );
  });

  test('empty executionId fails closed', async ({ browser }) => {
    await expectSubmitBuildClosed(browser, 'execute-empty-id', /executionId was empty/);
  });

  test('a stalled execute body read fails with a bounded typed error rather than Playwright timeout', async () => {
    const started = Date.now();
    const rejection = await readBuildExecutionBody(
      { json: () => new Promise(() => undefined) },
      BUILD_OBSERVATION_BOUND_MS,
    ).then(
      () => null,
      (error: unknown) => error,
    );
    const elapsed = Date.now() - started;
    expect(rejection).toBeInstanceOf(BuildExecutionObservationError);
    expect((rejection as Error).message).toMatch(/response body/);
    expect(elapsed).toBeGreaterThanOrEqual(BUILD_OBSERVATION_BOUND_MS - 100);
    expect(elapsed).toBeLessThan(BUILD_OBSERVATION_ASSERTION_CEILING_MS);
    expect(elapsed).toBeLessThan(OUTER_LIVE_TIMEOUT_MS);
  });

  test('a stalled execute response body fails closed through submitBuild', async ({ browser }) => {
    await expectSubmitBuildClosed(
      browser,
      'execute-body-stalls',
      /Timed out after \d+ms reading the POST \/api\/ai\/execute response body/,
    );
  });

  test('execute 202 executionId survives the runner into DEDUCTION verification', async ({
    browser,
  }) => {
    const fixture = await createAutoApplyFixtureServer('real-execute-202');
    const live = await createBuildObservationLive(browser, fixture.url);
    const recording = createRecordingAdapters();
    let deductedExecutionId: string | null | undefined;
    let sendClicks = 0;
    recording.adapters.armListeners = async () => {
      recording.calls.push('ARM_LISTENERS');
      await live.adapters.armListeners();
    };
    recording.adapters.createSession = async () => {
      recording.calls.push('CREATE_SESSION');
      return live.adapters.createSession();
    };
    recording.adapters.submitBuild = async (input) => {
      recording.calls.push('BUILD');
      const build = await live.adapters.submitBuild(input);
      sendClicks = await fixtureSendClicks(live.page);
      return build;
    };
    recording.adapters.waitForAutoApply = async () => {
      recording.calls.push('WAIT_FOR_AUTO_APPLY');
      return live.adapters.waitForAutoApply();
    };
    recording.adapters.verifyPublicConfirm = async () => {
      recording.calls.push('PUBLIC_CONFIRM');
      return {
        url: 'https://staging.ainow.biz/api/ai/executions/exec-real-flow/confirm-build-apply',
        status: 200,
        body: { triggered: true, reason: 'completed' },
        executionId: null,
      };
    };
    recording.adapters.verifyDeduction = async (executionId) => {
      recording.calls.push('DEDUCTION');
      deductedExecutionId = executionId;
      return { deductionCount: 1, tokensUsed: 1178, creditsDeducted: 1178 };
    };
    recording.adapters.cleanup = async (input) => {
      recording.calls.push('CLEANUP');
      return live.adapters.cleanup(input);
    };
    const providerGuard = new ProviderCallGuard(1);
    const started = Date.now();
    try {
      const result = await runGoldenPath({
        mode: 'contract',
        adapters: recording.adapters,
        gateTracker: recording.gateTracker,
        providerGuard,
      });
      expect(result.summary.verdict).toBe('PASS');
      expect(result.summary.executionId).toBe(REAL_EXECUTE_EXECUTION_ID);
      expect(deductedExecutionId).toBe(REAL_EXECUTE_EXECUTION_ID);
      expect(fixture.executePostCount()).toBe(1);
      expect(fixture.executionsCollectionPostCount()).toBe(0);
      expect(sendClicks).toBe(1);
      expect(providerGuard.usedCount).toBe(1);
      expect(result.phases.indexOf('DEDUCTION')).toBeGreaterThan(result.phases.indexOf('BUILD'));
      expect(Date.now() - started).toBeLessThan(120_000);
    } finally {
      await live.context.close().catch(() => undefined);
      await fixture.close();
    }
  });

  test('observation failure stays inside runGoldenPath so CLEANUP remains reachable', async ({
    browser,
  }) => {
    const fixture = await createAutoApplyFixtureServer('execute-body-stalls');
    const live = await createBuildObservationLive(browser, fixture.url);
    const recording = createRecordingAdapters({ enableGate: true });
    recording.adapters.createSession = async () => {
      recording.calls.push('CREATE_SESSION');
      return live.adapters.createSession();
    };
    recording.adapters.submitBuild = async (input) => {
      recording.calls.push('BUILD');
      return live.adapters.submitBuild(input);
    };
    const providerGuard = new ProviderCallGuard(1);
    const started = Date.now();
    try {
      const result = await runGoldenPath({
        mode: 'contract',
        adapters: recording.adapters,
        gateTracker: recording.gateTracker,
        providerGuard,
      });
      expect(result.summary.verdict).toBe('FAIL');
      if (result.summary.verdict === 'FAIL') {
        expect(result.summary.phase).toBe('BUILD');
        expect(result.summary.error).toMatch(/response body/);
        expect(result.summary.executionId).toBeNull();
        expect(result.summary.cleanup).toBe('session-stopped');
      }
      expect(result.phases).toContain('CLEANUP');
      expect(result.phases.at(-1)).toBe('CLEANUP');
      expect(result.phases).not.toContain('WAIT_FOR_AUTO_APPLY');
      expect(recording.calls.at(-1)).toBe('CLEANUP');
      expect(providerGuard.usedCount).toBe(1);
      expect(await fixtureSendClicks(live.page)).toBe(1);
      expect(fixture.executePostCount()).toBe(1);
      expect(Date.now() - started).toBeLessThan(BUILD_OBSERVATION_ASSERTION_CEILING_MS);
      expect(Date.now() - started).toBeLessThan(OUTER_LIVE_TIMEOUT_MS);
    } finally {
      await live.context.close().catch(() => undefined);
      await fixture.close();
    }
  });
});
