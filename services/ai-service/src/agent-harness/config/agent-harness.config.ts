import {
  AGENT_HARNESS_CONTRACT_VERSION_V1,
  AgentHarnessConfigV1,
} from '../contracts/agent-harness.contracts';

/**
 * Agent Harness v1 conservative defaults.
 *
 * This module intentionally centralizes policy/config data only.
 * Runtime behavior wiring is handled in later slices.
 */
export const DEFAULT_AGENT_HARNESS_CONFIG_V1: AgentHarnessConfigV1 = {
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
  allowedValidationCommands: ['npm test', 'npm run build', 'npx tsc --noEmit'],
  requireApprovalForDelete: true,
  requireApprovalForPackageInstall: true,
  requireApprovalForEnvFileWrite: true,
  requireApprovalForLargeWrite: true,
  enableBrowserSmoke: false,
  enableSemanticSearch: false,
  enableToolLoop: false,
  auditEventsEnabled: true,
};
