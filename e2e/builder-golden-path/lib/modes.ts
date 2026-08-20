export const RUNNER_MODE_CONTRACT = 'contract';
export const RUNNER_MODE_LIVE = 'live';

export type RunnerMode = typeof RUNNER_MODE_CONTRACT | typeof RUNNER_MODE_LIVE;

export const LIVE_GUARD_KEYS = [
  'E2E_MODE',
  'E2E_LIVE_AUTHORIZED',
  'E2E_ALLOW_STAGING_MUTATION',
  'E2E_ALLOW_CREDIT_MUTATION',
  'PROVIDER_CALL_BUDGET',
] as const;

export type EnvMap = NodeJS.Dict<string | undefined>;

export class LiveAuthorizationError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(
      `LIVE mode refused (fail-closed). Missing or invalid: ${missing.join(', ')}. ` +
        'A normal invocation stays CONTRACT/DRY and must not become a paid run.',
    );
    this.name = 'LiveAuthorizationError';
    this.missing = missing;
  }
}

export class ProviderBudgetError extends Error {
  constructor(actual: string | undefined) {
    super(
      `LIVE mode refused: PROVIDER_CALL_BUDGET must equal exactly 1 (received ${JSON.stringify(actual)}). ` +
        'No automatic provider retry is permitted.',
    );
    this.name = 'ProviderBudgetError';
  }
}

function read(env: EnvMap, key: string): string {
  return String(env[key] ?? '').trim();
}

export function isExactProviderBudgetOne(value: string | undefined): boolean {
  return String(value ?? '').trim() === '1';
}

export function inspectLiveGuards(env: EnvMap = process.env): {
  authorized: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (read(env, 'E2E_MODE').toLowerCase() !== 'live') {
    missing.push('E2E_MODE=live');
  }
  if (read(env, 'E2E_LIVE_AUTHORIZED').toLowerCase() !== 'true') {
    missing.push('E2E_LIVE_AUTHORIZED=true');
  }
  if (read(env, 'E2E_ALLOW_STAGING_MUTATION').toLowerCase() !== 'true') {
    missing.push('E2E_ALLOW_STAGING_MUTATION=true');
  }
  if (read(env, 'E2E_ALLOW_CREDIT_MUTATION').toLowerCase() !== 'true') {
    missing.push('E2E_ALLOW_CREDIT_MUTATION=true');
  }
  if (!isExactProviderBudgetOne(env.PROVIDER_CALL_BUDGET)) {
    missing.push('PROVIDER_CALL_BUDGET=1');
  }

  return { authorized: missing.length === 0, missing };
}

export function isLiveAuthorized(env: EnvMap = process.env): boolean {
  return inspectLiveGuards(env).authorized;
}

export function assertLiveAuthorized(env: EnvMap = process.env): void {
  const inspection = inspectLiveGuards(env);
  const otherLiveFlagsPresent =
    read(env, 'E2E_MODE').toLowerCase() === 'live' &&
    read(env, 'E2E_LIVE_AUTHORIZED').toLowerCase() === 'true' &&
    read(env, 'E2E_ALLOW_STAGING_MUTATION').toLowerCase() === 'true' &&
    read(env, 'E2E_ALLOW_CREDIT_MUTATION').toLowerCase() === 'true';

  if (otherLiveFlagsPresent && !isExactProviderBudgetOne(env.PROVIDER_CALL_BUDGET)) {
    throw new ProviderBudgetError(env.PROVIDER_CALL_BUDGET);
  }
  if (!inspection.authorized) {
    throw new LiveAuthorizationError(inspection.missing);
  }
}

export function resolveMode(env: EnvMap = process.env): RunnerMode {
  return isLiveAuthorized(env) ? RUNNER_MODE_LIVE : RUNNER_MODE_CONTRACT;
}

export function assertContractDoesNotRequireSecrets(env: EnvMap = process.env): void {
  if (resolveMode(env) !== RUNNER_MODE_CONTRACT) {
    throw new Error('CONTRACT assertion called while LIVE is fully authorized.');
  }
}

export function liveRefusedWithoutAllFlags(env: EnvMap): boolean {
  return !isLiveAuthorized(env);
}
