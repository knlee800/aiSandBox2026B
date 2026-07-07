/**
 * Builder Profile v1 Contracts
 *
 * Typed contracts for per-builder harness config resolution.
 * This file defines shape only — no runtime behavior, no env reads, no I/O.
 *
 * Aligned with the Multi-Builder Runtime Topology Plan
 * (docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md).
 */

import type { AgentHarnessRuntimeConfigV1 } from '../config/agent-harness.config';

// ---------------------------------------------------------------------------
// Builder Harness Profile — per-builder overrides for harness config fields
// ---------------------------------------------------------------------------

export interface BuilderHarnessProfileV1 {
  readonly harnessProfileId: string;
  readonly maxToolIterations?: number;
  readonly maxFileReadBytes?: number;
  readonly maxFileWriteBytes?: number;
  readonly maxToolResultBytes?: number;
  readonly maxValidationOutputBytes?: number;
  readonly toolTimeoutMs?: number;
  readonly validationTimeoutMs?: number;
  readonly browserSmokeTimeoutMs?: number;
  readonly enableBrowserSmoke?: boolean;
  readonly enableSemanticSearch?: boolean;
  readonly enableToolLoop?: boolean;
  readonly enablePreApplyCheckpoint?: boolean;
  readonly enableWriteTools?: boolean;
  readonly enableValidationTools?: boolean;
  readonly auditEventsEnabled?: boolean;
  readonly allowArbitraryShell?: boolean;
  readonly allowedValidationCommands?: readonly string[];
  readonly requireApprovalForDelete?: boolean;
  readonly requireApprovalForPackageInstall?: boolean;
  readonly requireApprovalForEnvFileWrite?: boolean;
  readonly requireApprovalForLargeWrite?: boolean;
}

// ---------------------------------------------------------------------------
// Builder Model Profile — per-builder model selection hints
// ---------------------------------------------------------------------------

export interface BuilderModelProfileV1 {
  readonly modelProfileId: string;
  readonly defaultModelId?: string;
  readonly fallbackModelId?: string;
}

// ---------------------------------------------------------------------------
// Builder Tool Permissions — per-builder tool access control
// ---------------------------------------------------------------------------

export interface BuilderToolPermissionsV1 {
  readonly toolPermissionProfileId: string;
  readonly allowedToolIds?: readonly string[];
  readonly blockedToolIds?: readonly string[];
  readonly toolsRequiringApproval?: readonly string[];
}

// ---------------------------------------------------------------------------
// Builder Runtime Limits — per-builder session/workspace constraints
// ---------------------------------------------------------------------------

export interface BuilderRuntimeLimitsV1 {
  readonly maxConcurrentSessions?: number;
  readonly maxSessionLifetimeMs?: number;
  readonly maxIdleTimeoutMs?: number;
  readonly maxWorkspaceSizeMB?: number;
  readonly maxFileCount?: number;
}

// ---------------------------------------------------------------------------
// Builder Profile — top-level per-builder identity and config bundle
// ---------------------------------------------------------------------------

export interface BuilderProfileV1 {
  readonly builderProfileId: string;
  readonly displayName: string;
  readonly description: string;
  readonly agentRole: string;
  readonly enabled: boolean;
  readonly profileVersion: number;
  readonly harnessProfile?: BuilderHarnessProfileV1;
  readonly modelProfile?: BuilderModelProfileV1;
  readonly toolPermissions?: BuilderToolPermissionsV1;
  readonly runtimeLimits?: BuilderRuntimeLimitsV1;
}

// ---------------------------------------------------------------------------
// Adapter Input / Output
// ---------------------------------------------------------------------------

export interface BuilderHarnessConfigAdapterInputV1 {
  readonly builderProfileId?: string;
  readonly agentRole?: string;
}

export type BuilderHarnessConfigResolutionSourceV1 =
  | 'builder-profile'
  | 'global-default'
  | 'global-default-missing-profile'
  | 'global-default-unknown-profile'
  | 'global-default-non-builder-role';

export interface BuilderHarnessConfigResolutionMetadataV1 {
  readonly source: BuilderHarnessConfigResolutionSourceV1;
  readonly builderProfileId: string | undefined;
  readonly harnessProfileId: string | undefined;
  readonly modelProfileId: string | undefined;
  readonly toolPermissionProfileId: string | undefined;
  readonly fieldsOverridden: readonly string[];
  readonly fieldsDefaulted: readonly string[];
  readonly warnings: readonly string[];
}

export interface BuilderHarnessConfigAdapterResultV1 {
  readonly config: Readonly<AgentHarnessRuntimeConfigV1>;
  readonly metadata: BuilderHarnessConfigResolutionMetadataV1;
}
