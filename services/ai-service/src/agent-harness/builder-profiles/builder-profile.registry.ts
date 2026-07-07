/**
 * Builder Profile Registry (v1)
 *
 * Static, data-only registry of builder profiles.
 * No env reads, no async, no I/O.
 *
 * DEFAULT_BUILDER_PROFILE_V1 preserves current single-builder behavior:
 * all harness config fields are resolved from global defaults by the adapter.
 */

import type { BuilderProfileV1 } from './builder-profile.contracts';

export const DEFAULT_BUILDER_PROFILE_V1: Readonly<BuilderProfileV1> =
  Object.freeze({
    builderProfileId: 'builder-default',
    displayName: 'Default Builder',
    description:
      'Default Builder profile — preserves current single-builder behavior.',
    agentRole: 'builder',
    enabled: true,
    profileVersion: 1,
  });

const BUILDER_PROFILES_V1: readonly Readonly<BuilderProfileV1>[] =
  Object.freeze([DEFAULT_BUILDER_PROFILE_V1]);

const profilesById: Record<string, Readonly<BuilderProfileV1>> = {};
for (const profile of BUILDER_PROFILES_V1) {
  profilesById[profile.builderProfileId] = profile;
}

const BUILDER_PROFILE_MAP_V1: Readonly<
  Record<string, Readonly<BuilderProfileV1>>
> = Object.freeze(profilesById);

export { BUILDER_PROFILES_V1, BUILDER_PROFILE_MAP_V1 };

export function getBuilderProfile(
  builderProfileId: string,
): Readonly<BuilderProfileV1> | undefined {
  return BUILDER_PROFILE_MAP_V1[builderProfileId];
}

export function listBuilderProfiles(): readonly Readonly<BuilderProfileV1>[] {
  return BUILDER_PROFILES_V1;
}

export function listEnabledBuilderProfiles(): readonly Readonly<BuilderProfileV1>[] {
  return BUILDER_PROFILES_V1.filter((p) => p.enabled);
}

export function isBuilderProfileEnabled(builderProfileId: string): boolean {
  const profile = getBuilderProfile(builderProfileId);
  return profile?.enabled === true;
}
