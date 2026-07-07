import {
  DEFAULT_BUILDER_PROFILE_V1,
  BUILDER_PROFILES_V1,
  BUILDER_PROFILE_MAP_V1,
  getBuilderProfile,
  listBuilderProfiles,
  listEnabledBuilderProfiles,
  isBuilderProfileEnabled,
} from '../builder-profile.registry';

describe('Builder Profile Registry (v1)', () => {
  it('includes the default builder profile', () => {
    expect(BUILDER_PROFILES_V1.length).toBeGreaterThanOrEqual(1);
    const ids = BUILDER_PROFILES_V1.map((p) => p.builderProfileId);
    expect(ids).toContain('builder-default');
  });

  it('DEFAULT_BUILDER_PROFILE_V1 has expected identity fields', () => {
    expect(DEFAULT_BUILDER_PROFILE_V1.builderProfileId).toBe(
      'builder-default',
    );
    expect(DEFAULT_BUILDER_PROFILE_V1.agentRole).toBe('builder');
    expect(DEFAULT_BUILDER_PROFILE_V1.enabled).toBe(true);
    expect(DEFAULT_BUILDER_PROFILE_V1.profileVersion).toBe(1);
    expect(typeof DEFAULT_BUILDER_PROFILE_V1.displayName).toBe('string');
    expect(DEFAULT_BUILDER_PROFILE_V1.displayName.length).toBeGreaterThan(0);
    expect(typeof DEFAULT_BUILDER_PROFILE_V1.description).toBe('string');
    expect(DEFAULT_BUILDER_PROFILE_V1.description.length).toBeGreaterThan(0);
  });

  it('default profile has no harness overrides (preserves global behavior)', () => {
    expect(DEFAULT_BUILDER_PROFILE_V1.harnessProfile).toBeUndefined();
    expect(DEFAULT_BUILDER_PROFILE_V1.modelProfile).toBeUndefined();
    expect(DEFAULT_BUILDER_PROFILE_V1.toolPermissions).toBeUndefined();
    expect(DEFAULT_BUILDER_PROFILE_V1.runtimeLimits).toBeUndefined();
  });

  it('enforces unique profile ids and matching map size', () => {
    const uniqueIds = new Set(
      BUILDER_PROFILES_V1.map((p) => p.builderProfileId),
    );
    expect(uniqueIds.size).toBe(BUILDER_PROFILES_V1.length);
    expect(Object.keys(BUILDER_PROFILE_MAP_V1)).toHaveLength(uniqueIds.size);
  });

  it('getBuilderProfile returns the default profile', () => {
    const profile = getBuilderProfile('builder-default');
    expect(profile).toBeDefined();
    expect(profile?.builderProfileId).toBe('builder-default');
    expect(profile?.agentRole).toBe('builder');
  });

  it('getBuilderProfile returns undefined for unknown ids', () => {
    expect(getBuilderProfile('nonexistent-profile')).toBeUndefined();
    expect(getBuilderProfile('')).toBeUndefined();
  });

  it('listBuilderProfiles returns the full profile list', () => {
    const all = listBuilderProfiles();
    expect(all).toBe(BUILDER_PROFILES_V1);
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it('listEnabledBuilderProfiles returns only enabled profiles', () => {
    const enabled = listEnabledBuilderProfiles();
    const expectedEnabled = BUILDER_PROFILES_V1.filter((p) => p.enabled);
    expect(enabled).toEqual(expectedEnabled);
    for (const profile of enabled) {
      expect(profile.enabled).toBe(true);
    }
  });

  it('isBuilderProfileEnabled returns true for default, false for unknown', () => {
    expect(isBuilderProfileEnabled('builder-default')).toBe(true);
    expect(isBuilderProfileEnabled('nonexistent-profile')).toBe(false);
  });

  it('each profile has required structural fields with valid values', () => {
    for (const profile of BUILDER_PROFILES_V1) {
      expect(typeof profile.builderProfileId).toBe('string');
      expect(profile.builderProfileId.trim().length).toBeGreaterThan(0);
      expect(typeof profile.displayName).toBe('string');
      expect(profile.displayName.trim().length).toBeGreaterThan(0);
      expect(typeof profile.description).toBe('string');
      expect(typeof profile.agentRole).toBe('string');
      expect(profile.agentRole.trim().length).toBeGreaterThan(0);
      expect(typeof profile.enabled).toBe('boolean');
      expect(typeof profile.profileVersion).toBe('number');
      expect(profile.profileVersion).toBeGreaterThanOrEqual(1);
    }
  });
});
