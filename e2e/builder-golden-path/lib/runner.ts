import {
  GOLDEN_PATH_PHASES,
  type GoldenPathPhase,
  assertPhaseOrder,
} from './phases';
import {
  ExecutionGateTracker,
  ProviderCallGuard,
  captureSessionTiming,
  type GateRestoreStatus,
  type SessionTimingMarks,
} from './safety-gates';
import {
  formatFailSummary,
  formatPassSummary,
  type FailSummary,
  type GoldenPathSummary,
  type PassSummary,
} from './summary';
import { MODEL, PROVIDER } from './constants';
import type { ConfirmBuildApplyCapture } from './network';
import type { CheckpointEvidence } from './evidence';
import type { RunnerMode } from './modes';

export interface GoldenPathIds {
  projectId?: string | null;
  sessionId?: string | null;
  executionId?: string | null;
}

export interface GoldenPathAdapters {
  prepareBrowser(): Promise<void>;
  authenticate(): Promise<void>;
  runSafetyChecks(): Promise<void>;
  captureStartingBalance(): Promise<number>;
  armListeners(): Promise<void>;
  createSession(): Promise<{
    projectId: string;
    sessionId: string;
    sessionCreatedAt: number;
  }>;
  submitBuild(input: {
    sessionCreatedAt: number;
    providerGuard: ProviderCallGuard;
  }): Promise<{ executionId?: string; buildSubmittedAt: number }>;
  waitForAutoApply(): Promise<{ autoApplyAt: number; fileApplied: true }>;
  verifyPreview(): Promise<{ preview: 'PASS' }>;
  verifyCheckpoint(): Promise<CheckpointEvidence>;
  verifyPublicConfirm(): Promise<ConfirmBuildApplyCapture>;
  verifyDeduction(executionId: string | null): Promise<{
    deductionCount: number;
    tokensUsed: number;
    creditsDeducted: number;
  }>;
  verifyBalance(input: {
    balanceBefore: number;
    appliedCredits: number;
  }): Promise<{ balanceAfter: number }>;
  cleanup(input: {
    ids: GoldenPathIds;
    gateTracker: ExecutionGateTracker;
  }): Promise<{ cleanup: string; executionGateFinal: GateRestoreStatus }>;
}

export interface RunGoldenPathInput {
  mode: RunnerMode;
  adapters: GoldenPathAdapters;
  providerGuard?: ProviderCallGuard;
  gateTracker?: ExecutionGateTracker;
}

export interface GoldenPathRunResult {
  summary: GoldenPathSummary;
  formatted: string;
  phases: GoldenPathPhase[];
  timing: SessionTimingMarks | null;
}

export async function runGoldenPath(
  input: RunGoldenPathInput,
): Promise<GoldenPathRunResult> {
  const phases: GoldenPathPhase[] = [];
  const ids: GoldenPathIds = {};
  const gateTracker = input.gateTracker ?? new ExecutionGateTracker();
  const providerGuard = input.providerGuard ?? new ProviderCallGuard(1);
  let timing: SessionTimingMarks | null = null;
  let sessionCreatedAt = 0;
  let buildSubmittedAt = 0;
  let autoApplyAt = 0;
  let previewCheckAt = 0;
  let balanceBefore = 0;
  let balanceAfter: number | null = null;
  let checkpointHash: string | null = null;
  let confirm: ConfirmBuildApplyCapture | null = null;
  let tokensUsed: number | null = null;
  let creditsDeducted: number | null = null;
  let deductionCount: number | null = null;
  let cleanup = 'not-run';
  let executionGateFinal = gateTracker.describeRestore(null);
  let failedPhase: GoldenPathPhase | 'UNKNOWN' = 'UNKNOWN';
  let failure: unknown;

  const mark = (phase: GoldenPathPhase): void => {
    phases.push(phase);
    failedPhase = phase;
  };

  try {
    mark('PREPARE_BROWSER');
    await input.adapters.prepareBrowser();

    mark('AUTH');
    await input.adapters.authenticate();

    mark('SAFETY');
    await input.adapters.runSafetyChecks();

    mark('STARTING_BALANCE');
    balanceBefore = await input.adapters.captureStartingBalance();

    mark('ARM_LISTENERS');
    await input.adapters.armListeners();

    mark('CREATE_SESSION');
    const session = await input.adapters.createSession();
    ids.projectId = session.projectId;
    ids.sessionId = session.sessionId;
    sessionCreatedAt = session.sessionCreatedAt;

    mark('BUILD');
    const build = await input.adapters.submitBuild({
      sessionCreatedAt,
      providerGuard,
    });
    ids.executionId = build.executionId ?? ids.executionId;
    buildSubmittedAt = build.buildSubmittedAt;

    mark('WAIT_FOR_AUTO_APPLY');
    const applied = await input.adapters.waitForAutoApply();
    autoApplyAt = applied.autoApplyAt;

    mark('PREVIEW');
    await input.adapters.verifyPreview();
    previewCheckAt = Date.now();

    mark('CHECKPOINT');
    const checkpoint = await input.adapters.verifyCheckpoint();
    checkpointHash = checkpoint.commitHash;

    mark('PUBLIC_CONFIRM');
    confirm = await input.adapters.verifyPublicConfirm();
    ids.executionId = confirm.executionId ?? ids.executionId;

    mark('DEDUCTION');
    const deduction = await input.adapters.verifyDeduction(ids.executionId ?? null);
    deductionCount = deduction.deductionCount;
    tokensUsed = deduction.tokensUsed;
    creditsDeducted = deduction.creditsDeducted;

    mark('BALANCE');
    const balance = await input.adapters.verifyBalance({
      balanceBefore,
      appliedCredits: creditsDeducted ?? 0,
    });
    balanceAfter = balance.balanceAfter;

    timing = captureSessionTiming({
      sessionCreatedAt,
      buildSubmittedAt,
      autoApplyAt,
      previewCheckAt,
    });
  } catch (error) {
    failure = error;
  } finally {
    try {
      const cleanupResult = await input.adapters.cleanup({ ids, gateTracker });
      cleanup = cleanupResult.cleanup;
      executionGateFinal = cleanupResult.executionGateFinal;
    } catch (cleanupError) {
      cleanup = `cleanup-failed:${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`;
      executionGateFinal = gateTracker.describeRestore(false);
    }
    if (!phases.includes('CLEANUP')) {
      phases.push('CLEANUP');
    }
  }

  if (!failure) {
    assertPhaseOrder(phases);
    const pass: PassSummary = {
      verdict: 'PASS',
      projectId: ids.projectId ?? null,
      sessionId: ids.sessionId ?? null,
      executionId: ids.executionId ?? null,
      provider: PROVIDER,
      model: MODEL,
      tokensUsed,
      autoApply: 'YES',
      preview: 'PASS',
      checkpointHash,
      confirmStatus: confirm?.status ?? null,
      confirmTriggered:
        confirm && typeof confirm.body === 'object' && confirm.body
          ? (confirm.body as { triggered?: boolean }).triggered === true
          : null,
      deductionCount,
      creditsDeducted,
      balanceBefore,
      balanceAfter,
      cleanup,
      executionGateFinal,
    };
    return {
      summary: pass,
      formatted: formatPassSummary(pass),
      phases,
      timing,
    };
  }

  const fail: FailSummary = {
    verdict: 'FAIL',
    phase: failedPhase,
    error: failure instanceof Error ? failure.message : String(failure),
    projectId: ids.projectId ?? null,
    sessionId: ids.sessionId ?? null,
    executionId: ids.executionId ?? null,
    cleanup,
    executionGateFinal,
  };
  return {
    summary: fail,
    formatted: formatFailSummary(fail),
    phases,
    timing,
  };
}

export function createRecordingAdapters(options?: {
  failAt?: GoldenPathPhase;
  enableGate?: boolean;
}): {
  adapters: GoldenPathAdapters;
  calls: string[];
  gateTracker: ExecutionGateTracker;
} {
  const calls: string[] = [];
  const gateTracker = new ExecutionGateTracker();
  const failAt = options?.failAt;

  const maybeFail = (phase: GoldenPathPhase): void => {
    calls.push(phase);
    if (failAt === phase) {
      throw new Error(`forced failure at ${phase}`);
    }
  };

  const adapters: GoldenPathAdapters = {
    async prepareBrowser() {
      maybeFail('PREPARE_BROWSER');
    },
    async authenticate() {
      maybeFail('AUTH');
    },
    async runSafetyChecks() {
      maybeFail('SAFETY');
      if (options?.enableGate) {
        gateTracker.recordEnabledByRunner();
      }
    },
    async captureStartingBalance() {
      maybeFail('STARTING_BALANCE');
      return 30577;
    },
    async armListeners() {
      maybeFail('ARM_LISTENERS');
    },
    async createSession() {
      maybeFail('CREATE_SESSION');
      return {
        projectId: 'project-contract',
        sessionId: 'session-contract',
        sessionCreatedAt: Date.now(),
      };
    },
    async submitBuild({ providerGuard }) {
      maybeFail('BUILD');
      providerGuard.authorizeCall();
      return { executionId: 'exec-contract', buildSubmittedAt: Date.now() };
    },
    async waitForAutoApply() {
      maybeFail('WAIT_FOR_AUTO_APPLY');
      return { autoApplyAt: Date.now(), fileApplied: true };
    },
    async verifyPreview() {
      maybeFail('PREVIEW');
      return { preview: 'PASS' };
    },
    async verifyCheckpoint() {
      maybeFail('CHECKPOINT');
      return { commitHash: 'abc123def456', filesChanged: 1 };
    },
    async verifyPublicConfirm() {
      maybeFail('PUBLIC_CONFIRM');
      return {
        url: 'https://staging.ainow.biz/api/ai/executions/exec-contract/confirm-build-apply',
        status: 200,
        body: { triggered: true, reason: 'completed' },
        executionId: 'exec-contract',
      };
    },
    async verifyDeduction() {
      maybeFail('DEDUCTION');
      return { deductionCount: 1, tokensUsed: 1178, creditsDeducted: 1178 };
    },
    async verifyBalance() {
      maybeFail('BALANCE');
      return { balanceAfter: 29399 };
    },
    async cleanup({ gateTracker: tracker }) {
      calls.push('CLEANUP');
      const restored = tracker.shouldRestore() ? 'restored-false' : tracker.describeRestore(null);
      return {
        cleanup: 'session-stopped',
        executionGateFinal: restored,
      };
    },
  };

  return { adapters, calls, gateTracker };
}

export { GOLDEN_PATH_PHASES };
