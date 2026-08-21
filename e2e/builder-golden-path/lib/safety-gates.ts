import {
  DEFAULT_IDLE_TIMEOUT_MS,
  SAFE_MINIMUM_HEADROOM_MS,
} from './constants';
import { isExactProviderBudgetOne } from './modes';

export class SessionHeadroomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionHeadroomError';
  }
}

export class ProviderRetryError extends Error {
  constructor(message = 'Provider retry refused. Golden-path budget is exactly one call.') {
    super(message);
    this.name = 'ProviderRetryError';
  }
}

export interface SessionTimingMarks {
  sessionCreatedAt: number;
  buildSubmittedAt?: number;
  sessionAgeAtBuild?: number;
  autoApplyAt?: number;
  previewCheckAt?: number;
}

export function remainingIdleHeadroomMs(
  sessionCreatedAt: number,
  now: number,
  idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS,
): number {
  return idleTimeoutMs - (now - sessionCreatedAt);
}

export function assertSafeHeadroomBeforeProvider(input: {
  sessionCreatedAt: number;
  now: number;
  idleTimeoutMs?: number;
  safeMinimumHeadroomMs?: number;
}): number {
  const remaining = remainingIdleHeadroomMs(
    input.sessionCreatedAt,
    input.now,
    input.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS,
  );
  const required = input.safeMinimumHeadroomMs ?? SAFE_MINIMUM_HEADROOM_MS;
  if (remaining < required) {
    throw new SessionHeadroomError(
      `Unsafe session headroom before provider call: remaining=${remaining}ms required=${required}ms. Fail before provider execution.`,
    );
  }
  return remaining;
}

export class ProviderCallGuard {
  private used = 0;

  constructor(private readonly budget: number) {
    if (budget !== 1) {
      throw new Error('PROVIDER_CALL_BUDGET must equal exactly 1.');
    }
  }

  get usedCount(): number {
    return this.used;
  }

  get remaining(): number {
    return this.budget - this.used;
  }

  authorizeCall(): void {
    if (this.used >= this.budget) {
      throw new ProviderRetryError();
    }
    this.used += 1;
  }
}

export function createProviderCallGuardFromEnv(
  budgetRaw: string | undefined,
): ProviderCallGuard {
  if (!isExactProviderBudgetOne(budgetRaw)) {
    throw new Error('PROVIDER_CALL_BUDGET must equal exactly 1.');
  }
  return new ProviderCallGuard(1);
}

export type GateRestoreStatus =
  | 'restored-false'
  | 'restore-failed'
  | 'restore-unconfirmed-timeout'
  | 'not-changed-by-runner'
  | 'not-attempted-no-authority';

export class ExecutionGateTracker {
  private enabledByRunner = false;
  private hadAuthority = false;

  recordEnabledByRunner(): void {
    this.enabledByRunner = true;
    this.hadAuthority = true;
  }

  recordAuthorityWithoutChange(): void {
    this.hadAuthority = true;
  }

  didChangeGate(): boolean {
    return this.enabledByRunner;
  }

  shouldRestore(): boolean {
    return this.enabledByRunner;
  }

  describeRestore(didRestore: boolean | null | 'timeout'): GateRestoreStatus {
    if (!this.enabledByRunner) {
      return this.hadAuthority ? 'not-changed-by-runner' : 'not-attempted-no-authority';
    }
    if (didRestore === true) {
      return 'restored-false';
    }
    if (didRestore === 'timeout') {
      return 'restore-unconfirmed-timeout';
    }
    return 'restore-failed';
  }
}

export function captureSessionTiming(input: {
  sessionCreatedAt: number;
  buildSubmittedAt: number;
  autoApplyAt?: number;
  previewCheckAt?: number;
}): SessionTimingMarks {
  return {
    sessionCreatedAt: input.sessionCreatedAt,
    buildSubmittedAt: input.buildSubmittedAt,
    sessionAgeAtBuild: input.buildSubmittedAt - input.sessionCreatedAt,
    autoApplyAt: input.autoApplyAt,
    previewCheckAt: input.previewCheckAt,
  };
}
