import {
  AGENT_HARNESS_CONTRACT_VERSION_V1,
  AgentHarnessConfigV1,
} from '../contracts/agent-harness.contracts';

/**
 * Strict boolean parser for environment-backed feature gates.
 * Accepts only "true" / "false" (case-insensitive, trimmed).
 * Undefined, null, or whitespace-only values resolve to defaultValue.
 * Any other non-empty string throws to prevent misconfiguration.
 */
export function parseStrictBooleanEnv(
  variableName: string,
  raw: string | undefined,
  defaultValue: boolean,
): boolean {
  if (raw === undefined || raw === null) {
    return defaultValue;
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return defaultValue;
  }
  const normalized = trimmed.toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(
    `Invalid value for ${variableName}. Accepted values: true, false.`,
  );
}

/**
 * Factory that produces an AgentHarnessConfigV1 from an env-like record.
 * Reads AGENT_HARNESS_ENABLE_TOOL_LOOP only.
 */
export function createAgentHarnessConfigV1(
  env: Record<string, string | undefined>,
): Readonly<AgentHarnessConfigV1> {
  const enableToolLoop = parseStrictBooleanEnv(
    'AGENT_HARNESS_ENABLE_TOOL_LOOP',
    env.AGENT_HARNESS_ENABLE_TOOL_LOOP,
    false,
  );

  const allowedValidationCommands: readonly string[] = Object.freeze([
    'npm test',
    'npm run build',
    'npx tsc --noEmit',
  ]);

  const config: AgentHarnessConfigV1 = {
    contractVersion: AGENT_HARNESS_CONTRACT_VERSION_V1,
    maxToolIterations: 3,
    maxFileReadBytes: 262_144,
    maxFileWriteBytes: 131_072,
    maxToolResultBytes: 262_144,
    maxValidationOutputBytes: 131_072,
    toolTimeoutMs: 30_000,
    validationTimeoutMs: 120_000,
    browserSmokeTimeoutMs: 120_000,
    allowArbitraryShell: false,
    allowedValidationCommands: allowedValidationCommands as unknown as readonly string[],
    requireApprovalForDelete: true,
    requireApprovalForPackageInstall: true,
    requireApprovalForEnvFileWrite: true,
    requireApprovalForLargeWrite: true,
    enableBrowserSmoke: false,
    enableSemanticSearch: false,
    enableToolLoop,
    enablePreApplyCheckpoint: true,
    auditEventsEnabled: true,
  };

  return Object.freeze(config);
}

/**
 * Agent Harness v1 conservative defaults.
 *
 * This module intentionally centralizes policy/config data only.
 * Runtime behavior wiring is handled in later slices.
 */
export const DEFAULT_AGENT_HARNESS_CONFIG_V1: Readonly<AgentHarnessConfigV1> =
  createAgentHarnessConfigV1(process.env);
