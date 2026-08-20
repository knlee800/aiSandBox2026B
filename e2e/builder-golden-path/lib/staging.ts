import { spawn } from 'node:child_process';
import { ExecutionGateTracker, type GateRestoreStatus } from './safety-gates';
import { isLiveAuthorized, type EnvMap } from './modes';

export const STAGING_SSH_ALIAS = 'aisandbox-staging';
export const STAGING_REPO_PATH = '/opt/aisandbox';
export const STAGING_BASE_URL = 'https://staging.ainow.biz';
export const REQUIRED_SOURCE_SHA = 'c3e39279abe3c0d6c348daa312107c8f6fc592b7';
export const RETAINED_STASH_SHA = '0372cc1f47f82e1db060ed2dd756a938fe324803';

export class StagingNotAuthorizedError extends Error {
  constructor(message = 'Staging helper refused: LIVE authorization flags are not all present.') {
    super(message);
    this.name = 'StagingNotAuthorizedError';
  }
}

export class UnsafeParityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeParityError';
  }
}

export function buildSshCommand(remoteCommand: string): string[] {
  return [STAGING_SSH_ALIAS, remoteCommand];
}

export function buildParityInspectCommand(): string {
  return `git -C ${STAGING_REPO_PATH} rev-parse HEAD && git -C ${STAGING_REPO_PATH} status --porcelain && git -C ${STAGING_REPO_PATH} rev-parse 'stash@{0}'`;
}

export function buildGateInspectCommand(): string {
  return "GW_ID=$(pm2 jlist | python3 -c \"import json,sys; [print(p['pm_id']) for p in json.load(sys.stdin) if p['name']=='aisandbox-api-gateway']\"); pm2 env \"$GW_ID\" | grep -E 'GLOBAL_EXECUTION_ENABLED|BILLING_CHARGES_ENABLED'";
}

export function buildGateEnableCommand(): string {
  return 'GLOBAL_EXECUTION_ENABLED=true pm2 restart aisandbox-api-gateway --update-env';
}

export function buildGateRestoreCommand(): string {
  return 'GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env';
}

export function buildDeductionQuery(executionId: string): string {
  return `psql "$DATABASE_URL" -c "SELECT source_event_id, requested_credits, applied_credits, overflow_credits, balance_before, balance_after, status FROM credit_deduction_records WHERE source_event_id = '${executionId.replace(/'/g, '')}';"`;
}

export function buildSessionStopPath(sessionId: string): string {
  return `/api/sessions/${encodeURIComponent(sessionId)}/stop`;
}

export function evaluateParity(input: {
  headSha: string;
  worktreeClean: boolean;
  stashSha: string;
  requiredHeadSha?: string;
}): 'PARITY_PROVEN' | 'UNSAFE_PARITY' {
  const requiredHead = input.requiredHeadSha ?? REQUIRED_SOURCE_SHA;
  if (
    input.headSha !== requiredHead ||
    !input.worktreeClean ||
    input.stashSha !== RETAINED_STASH_SHA
  ) {
    return 'UNSAFE_PARITY';
  }
  return 'PARITY_PROVEN';
}

export function refuseUnsafeParityOrSkipDeploy(
  result: ReturnType<typeof evaluateParity>,
): void {
  if (result === 'UNSAFE_PARITY') {
    throw new UnsafeParityError(
      'Staging source parity is unsafe. Golden-path runner refuses automatic deploy; treat deployment as a separate precondition.',
    );
  }
}

export interface StagingHelperOptions {
  env?: EnvMap;
  gateTracker?: ExecutionGateTracker;
  execute?: (argv: string[]) => Promise<string>;
}

export class StagingHelper {
  private readonly env: EnvMap;
  readonly gateTracker: ExecutionGateTracker;
  private readonly executeFn?: (argv: string[]) => Promise<string>;

  constructor(options: StagingHelperOptions = {}) {
    this.env = options.env ?? process.env;
    this.gateTracker = options.gateTracker ?? new ExecutionGateTracker();
    this.executeFn = options.execute;
  }

  private assertLive(): void {
    if (!isLiveAuthorized(this.env)) {
      throw new StagingNotAuthorizedError();
    }
  }

  async inspectParity(): Promise<'PARITY_PROVEN'> {
    this.assertLive();
    if (!this.executeFn) {
      throw new StagingNotAuthorizedError(
        'No staging executor bound. Refusing to open SSH from CONTRACT/DRY.',
      );
    }
    const output = await this.executeFn(buildSshCommand(buildParityInspectCommand()));
    const lines = output.trim().split(/\r?\n/);
    const decision = evaluateParity({
      headSha: lines[0] ?? '',
      worktreeClean: (lines[1] ?? '') === '',
      stashSha: lines[2] ?? '',
    });
    refuseUnsafeParityOrSkipDeploy(decision);
    return 'PARITY_PROVEN';
  }

  async inspectGates(): Promise<string> {
    this.assertLive();
    if (!this.executeFn) {
      throw new StagingNotAuthorizedError(
        'No staging executor bound. Gate inspection is LIVE-only.',
      );
    }
    return this.executeFn(buildSshCommand(buildGateInspectCommand()));
  }

  async enableExecutionGate(): Promise<void> {
    this.assertLive();
    if (!this.executeFn) {
      throw new StagingNotAuthorizedError();
    }
    await this.executeFn(buildSshCommand(buildGateEnableCommand()));
    this.gateTracker.recordEnabledByRunner();
  }

  async restoreExecutionGateIfChanged(): Promise<GateRestoreStatus> {
    if (!this.gateTracker.shouldRestore()) {
      return this.gateTracker.describeRestore(null);
    }
    if (!this.executeFn || !isLiveAuthorized(this.env)) {
      return this.gateTracker.describeRestore(false);
    }
    try {
      await this.executeFn(buildSshCommand(buildGateRestoreCommand()));
      return this.gateTracker.describeRestore(true);
    } catch {
      return this.gateTracker.describeRestore(false);
    }
  }

  async queryDeduction(executionId: string): Promise<string> {
    this.assertLive();
    if (!this.executeFn) {
      throw new StagingNotAuthorizedError();
    }
    return this.executeFn(buildSshCommand(buildDeductionQuery(executionId)));
  }
}

export function createSshExecutor(): (argv: string[]) => Promise<string> {
  return (argv) =>
    new Promise((resolve, reject) => {
      const child = spawn('ssh', argv, { shell: false });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`ssh exited ${code}: ${stderr || stdout}`));
        }
      });
    });
}
