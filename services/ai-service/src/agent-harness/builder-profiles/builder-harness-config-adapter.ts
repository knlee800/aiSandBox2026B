/**
 * Per-Builder Harness Config Adapter (v1)
 *
 * Pure function — no env reads, no async, no I/O.
 * Resolves a concrete AgentHarnessRuntimeConfigV1 for a given builder
 * profile, falling back to the global default for missing fields.
 *
 * Platform safety enforcement:
 *  - Approval-floor fields cannot be weakened below global/platform true.
 *  - allowArbitraryShell cannot become true if global default is false.
 */

import type { AgentHarnessRuntimeConfigV1 } from '../config/agent-harness.config';
import type {
  BuilderHarnessConfigAdapterInputV1,
  BuilderHarnessConfigAdapterResultV1,
  BuilderHarnessConfigResolutionMetadataV1,
  BuilderHarnessConfigResolutionSourceV1,
  BuilderHarnessProfileV1,
} from './builder-profile.contracts';
import { getBuilderProfile } from './builder-profile.registry';

// Fields that the adapter merges from the builder harness profile.
// Excludes contractVersion (always from global).
const MERGEABLE_FIELDS = [
  'maxToolIterations',
  'maxFileReadBytes',
  'maxFileWriteBytes',
  'maxToolResultBytes',
  'maxValidationOutputBytes',
  'toolTimeoutMs',
  'validationTimeoutMs',
  'browserSmokeTimeoutMs',
  'enableBrowserSmoke',
  'enableSemanticSearch',
  'enableToolLoop',
  'enablePreApplyCheckpoint',
  'enableWriteTools',
  'enableValidationTools',
  'auditEventsEnabled',
  'allowArbitraryShell',
  'allowedValidationCommands',
  'requireApprovalForDelete',
  'requireApprovalForPackageInstall',
  'requireApprovalForEnvFileWrite',
  'requireApprovalForLargeWrite',
] as const;

type MergeableField = (typeof MERGEABLE_FIELDS)[number];

const APPROVAL_FLOOR_FIELDS: readonly MergeableField[] = [
  'requireApprovalForDelete',
  'requireApprovalForPackageInstall',
  'requireApprovalForEnvFileWrite',
  'requireApprovalForLargeWrite',
];

function buildGlobalDefaultResult(
  source: BuilderHarnessConfigResolutionSourceV1,
  globalDefault: Readonly<AgentHarnessRuntimeConfigV1>,
  builderProfileId: string | undefined,
  warnings: readonly string[],
): BuilderHarnessConfigAdapterResultV1 {
  return {
    config: globalDefault,
    metadata: {
      source,
      builderProfileId,
      harnessProfileId: undefined,
      modelProfileId: undefined,
      toolPermissionProfileId: undefined,
      fieldsOverridden: [],
      fieldsDefaulted: [...MERGEABLE_FIELDS],
      warnings,
    },
  };
}

export function resolveBuilderHarnessConfig(
  input: BuilderHarnessConfigAdapterInputV1,
  globalDefault: Readonly<AgentHarnessRuntimeConfigV1>,
): BuilderHarnessConfigAdapterResultV1 {
  if (input.agentRole !== undefined && input.agentRole !== 'builder') {
    return buildGlobalDefaultResult(
      'global-default-non-builder-role',
      globalDefault,
      input.builderProfileId,
      [
        `Non-builder agentRole '${input.agentRole}' cannot resolve a builder harness config; using global default.`,
      ],
    );
  }

  if (!input.builderProfileId) {
    return buildGlobalDefaultResult(
      'global-default-missing-profile',
      globalDefault,
      undefined,
      [],
    );
  }

  const profile = getBuilderProfile(input.builderProfileId);
  if (!profile) {
    return buildGlobalDefaultResult(
      'global-default-unknown-profile',
      globalDefault,
      input.builderProfileId,
      [
        `Unknown builderProfileId '${input.builderProfileId}'; using global default.`,
      ],
    );
  }

  const harnessProfile = profile.harnessProfile;

  if (!harnessProfile) {
    return {
      config: globalDefault,
      metadata: {
        source: 'builder-profile',
        builderProfileId: profile.builderProfileId,
        harnessProfileId: undefined,
        modelProfileId: profile.modelProfile?.modelProfileId,
        toolPermissionProfileId:
          profile.toolPermissions?.toolPermissionProfileId,
        fieldsOverridden: [],
        fieldsDefaulted: [...MERGEABLE_FIELDS],
        warnings: [],
      },
    };
  }

  const fieldsOverridden: string[] = [];
  const fieldsDefaulted: string[] = [];
  const warnings: string[] = [];

  const resolved: Record<string, unknown> = {
    contractVersion: globalDefault.contractVersion,
  };

  for (const field of MERGEABLE_FIELDS) {
    const profileValue = (harnessProfile as unknown as Record<string, unknown>)[field];

    if (profileValue !== undefined) {
      fieldsOverridden.push(field);
      resolved[field] = profileValue;
    } else {
      fieldsDefaulted.push(field);
      resolved[field] = (globalDefault as Record<string, unknown>)[field];
    }
  }

  for (const floorField of APPROVAL_FLOOR_FIELDS) {
    if (
      (globalDefault as Record<string, unknown>)[floorField] === true &&
      resolved[floorField] === false
    ) {
      resolved[floorField] = true;
      warnings.push(
        `Platform floor enforced: '${floorField}' cannot be weakened below global default (true).`,
      );
    }
  }

  if (
    globalDefault.allowArbitraryShell === false &&
    resolved.allowArbitraryShell === true
  ) {
    resolved.allowArbitraryShell = false;
    warnings.push(
      "Platform veto enforced: 'allowArbitraryShell' cannot be enabled when global default is false.",
    );
  }

  const metadata: BuilderHarnessConfigResolutionMetadataV1 = {
    source: 'builder-profile',
    builderProfileId: profile.builderProfileId,
    harnessProfileId: harnessProfile.harnessProfileId,
    modelProfileId: profile.modelProfile?.modelProfileId,
    toolPermissionProfileId: profile.toolPermissions?.toolPermissionProfileId,
    fieldsOverridden,
    fieldsDefaulted,
    warnings,
  };

  return {
    config: Object.freeze(
      resolved as unknown as AgentHarnessRuntimeConfigV1,
    ),
    metadata,
  };
}
