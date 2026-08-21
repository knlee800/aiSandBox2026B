import { spawn } from 'node:child_process';
import { ExecutionGateTracker, type GateRestoreStatus } from './safety-gates';
import { isLiveAuthorized, type EnvMap } from './modes';

export const STAGING_SSH_ALIAS = 'aisandbox-staging';
export const STAGING_REPO_PATH = '/opt/aisandbox';
export const STAGING_BASE_URL = 'https://staging.ainow.biz';
export const RETAINED_STASH_SHA = '0372cc1f47f82e1db060ed2dd756a938fe324803';

export const PARITY_HEAD_SENTINEL = 'AISB_PARITY_HEAD';
export const PARITY_STATUS_SENTINEL = 'AISB_PARITY_STATUS';
export const PARITY_STASH_SENTINEL = 'AISB_PARITY_STASH';
export const PARITY_END_SENTINEL = 'AISB_PARITY_END';

export const GATEWAY_READY_URL = 'http://127.0.0.1:4000/api/health/ready';
export const GATEWAY_READY_TIMEOUT_MS = 30_000;
export const GATEWAY_READY_INTERVAL_MS = 500;

const GIT_SHA_RE = /^[0-9a-f]{40}$/i;

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

export class SshExecutorMissingError extends Error {
  constructor(
    message = 'LIVE staging adapter failed closed: SSH executor is not bound.',
  ) {
    super(message);
    this.name = 'SshExecutorMissingError';
  }
}

export class GatewayNotReadyError extends Error {
  constructor(
    message = 'Gateway did not become ready after execution-gate pm2 restart. Refusing STARTING_BALANCE. Fail closed.',
  ) {
    super(message);
    this.name = 'GatewayNotReadyError';
  }
}

export function buildSshCommand(remoteCommand: string): string[] {
  return [STAGING_SSH_ALIAS, remoteCommand];
}

export function buildParityInspectCommand(): string {
  return [
    `echo ${PARITY_HEAD_SENTINEL}`,
    `git -C ${STAGING_REPO_PATH} rev-parse HEAD`,
    `echo ${PARITY_STATUS_SENTINEL}`,
    `git -C ${STAGING_REPO_PATH} status --porcelain`,
    `echo ${PARITY_STASH_SENTINEL}`,
    `git -C ${STAGING_REPO_PATH} rev-parse 'stash@{0}'`,
    `echo ${PARITY_END_SENTINEL}`,
  ].join(' && ');
}

export function parseParityInspectOutput(output: string): {
  headSha: string;
  status: string;
  stashSha: string;
} {
  const labelled = tryParseLabelledParityOutput(output);
  if (labelled) {
    return labelled;
  }

  // LIVE-02 proven clean helper output was only HEAD then stash SHA.
  // Porcelain emitted zero lines, so a blank placeholder never existed.
  // Treat exactly two SHA lines as HEAD + empty STATUS + STASH.
  const shaLines = output
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (shaLines.length === 2 && GIT_SHA_RE.test(shaLines[0] ?? '') && GIT_SHA_RE.test(shaLines[1] ?? '')) {
    return {
      headSha: shaLines[0] ?? '',
      status: '',
      stashSha: shaLines[1] ?? '',
    };
  }

  throw new UnsafeParityError(
    'Staging parity inspect output is unparseable. Refusing positional empty-field shifting. No automatic deploy.',
  );
}

function tryParseLabelledParityOutput(output: string): {
  headSha: string;
  status: string;
  stashSha: string;
} | null {
  const normalized = output.replace(/\r\n/g, '\n');
  if (
    !normalized.includes(PARITY_HEAD_SENTINEL) ||
    !normalized.includes(PARITY_STATUS_SENTINEL) ||
    !normalized.includes(PARITY_STASH_SENTINEL) ||
    !normalized.includes(PARITY_END_SENTINEL)
  ) {
    return null;
  }

  const headRaw = extractSentinelSection(normalized, PARITY_HEAD_SENTINEL, PARITY_STATUS_SENTINEL);
  const statusRaw = extractSentinelSection(normalized, PARITY_STATUS_SENTINEL, PARITY_STASH_SENTINEL);
  const stashRaw = extractSentinelSection(normalized, PARITY_STASH_SENTINEL, PARITY_END_SENTINEL);
  if (headRaw === null || statusRaw === null || stashRaw === null) {
    return null;
  }

  return {
    headSha: headRaw.trim(),
    status: statusRaw.replace(/^\n+/, '').replace(/\n+$/, ''),
    stashSha: stashRaw.trim(),
  };
}

function extractSentinelSection(
  source: string,
  startSentinel: string,
  endSentinel: string,
): string | null {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line.trim() === startSentinel);
  const end = lines.findIndex((line) => line.trim() === endSentinel);
  if (start < 0 || end < 0 || end <= start) {
    return null;
  }
  return lines.slice(start + 1, end).join('\n');
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

export function buildGatewayReadyProbeCommand(): string {
  return `curl -sS -o /dev/null -w '%{http_code}' --max-time 2 ${GATEWAY_READY_URL} || echo 000`;
}

export function isGatewayReadyProbeSuccess(output: string): boolean {
  const lines = output
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines[lines.length - 1] === '200';
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
  requiredHeadSha: string;
}): 'PARITY_PROVEN' | 'UNSAFE_PARITY' {
  const requiredHead = input.requiredHeadSha.trim();
  const stagingHead = input.headSha.trim();
  if (
    !requiredHead ||
    !stagingHead ||
    stagingHead !== requiredHead ||
    !input.worktreeClean ||
    input.stashSha.trim() !== RETAINED_STASH_SHA
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
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  gatewayReadyTimeoutMs?: number;
  gatewayReadyIntervalMs?: number;
}

export class StagingHelper {
  private readonly env: EnvMap;
  readonly gateTracker: ExecutionGateTracker;
  private readonly executeFn?: (argv: string[]) => Promise<string>;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly nowFn: () => number;
  private readonly gatewayReadyTimeoutMs: number;
  private readonly gatewayReadyIntervalMs: number;

  constructor(options: StagingHelperOptions = {}) {
    this.env = options.env ?? process.env;
    this.gateTracker = options.gateTracker ?? new ExecutionGateTracker();
    this.executeFn = options.execute;
    this.sleepFn = options.sleep ?? defaultSleep;
    this.nowFn = options.now ?? (() => Date.now());
    this.gatewayReadyTimeoutMs = options.gatewayReadyTimeoutMs ?? GATEWAY_READY_TIMEOUT_MS;
    this.gatewayReadyIntervalMs = options.gatewayReadyIntervalMs ?? GATEWAY_READY_INTERVAL_MS;
  }

  hasExecutor(): boolean {
    return typeof this.executeFn === 'function';
  }

  private assertLive(): void {
    if (!isLiveAuthorized(this.env)) {
      throw new StagingNotAuthorizedError();
    }
  }

  private requireExecutor(): (argv: string[]) => Promise<string> {
    if (typeof this.executeFn !== 'function') {
      throw new SshExecutorMissingError();
    }
    return this.executeFn;
  }

  async inspectParity(expectedHeadSha: string): Promise<'PARITY_PROVEN'> {
    this.assertLive();
    const expectedHead = expectedHeadSha.trim();
    if (!expectedHead) {
      throw new UnsafeParityError(
        'Expected execution-edge HEAD is missing. Refusing to default to a historical staging SHA. No automatic deploy.',
      );
    }
    const execute = this.requireExecutor();
    const output = await execute(buildSshCommand(buildParityInspectCommand()));
    const parsed = parseParityInspectOutput(output);
    const decision = evaluateParity({
      headSha: parsed.headSha,
      worktreeClean: parsed.status === '',
      stashSha: parsed.stashSha,
      requiredHeadSha: expectedHead,
    });
    refuseUnsafeParityOrSkipDeploy(decision);
    return 'PARITY_PROVEN';
  }

  async inspectGates(): Promise<string> {
    this.assertLive();
    return this.requireExecutor()(buildSshCommand(buildGateInspectCommand()));
  }

  async enableExecutionGate(): Promise<void> {
    this.assertLive();
    await this.requireExecutor()(buildSshCommand(buildGateEnableCommand()));
    this.gateTracker.recordEnabledByRunner();
    await this.waitForGatewayReady();
  }

  async waitForGatewayReady(): Promise<void> {
    this.assertLive();
    const execute = this.requireExecutor();
    const deadline = this.nowFn() + this.gatewayReadyTimeoutMs;
    let lastDetail = 'no probe attempted';
    while (this.nowFn() < deadline) {
      try {
        const output = await execute(buildSshCommand(buildGatewayReadyProbeCommand()));
        if (isGatewayReadyProbeSuccess(output)) {
          return;
        }
        lastDetail = `probe HTTP ${output.trim() || 'empty'}`;
      } catch (error) {
        lastDetail = error instanceof Error ? error.message : String(error);
      }
      const remaining = deadline - this.nowFn();
      if (remaining <= 0) {
        break;
      }
      await this.sleepFn(Math.min(this.gatewayReadyIntervalMs, remaining));
    }
    throw new GatewayNotReadyError(
      `Gateway did not become ready after execution-gate pm2 restart within ${this.gatewayReadyTimeoutMs}ms (${lastDetail}). Refusing STARTING_BALANCE. Fail closed.`,
    );
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
    return this.requireExecutor()(buildSshCommand(buildDeductionQuery(executionId)));
  }
}

export async function readAuthorizedLocalHead(input?: {
  revParse?: () => Promise<string>;
  statusShort?: () => Promise<string>;
}): Promise<string> {
  const status = (await (input?.statusShort ?? gitStatusShort)()).trim();
  if (status) {
    throw new UnsafeParityError(
      'Local worktree is dirty. LIVE execution-edge parity requires a clean tree. No automatic deploy.',
    );
  }
  const head = (await (input?.revParse ?? gitRevParseHead)()).trim();
  if (!head) {
    throw new UnsafeParityError(
      'Could not read authorized local HEAD. Refusing to default to a historical staging SHA.',
    );
  }
  return head;
}

function gitRevParseHead(): Promise<string> {
  return runGit(['rev-parse', 'HEAD']);
}

function gitStatusShort(): Promise<string> {
  return runGit(['status', '--short']);
}

function runGit(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { shell: false });
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
        reject(new Error(`git ${args.join(' ')} exited ${code}: ${stderr || stdout}`));
      }
    });
  });
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
