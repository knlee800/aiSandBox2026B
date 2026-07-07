import type { AgentHarnessRuntimeConfigV1 } from '../../config/agent-harness.config';
import { AGENT_HARNESS_CONTRACT_VERSION_V1 } from '../../contracts/agent-harness.contracts';
import type {
  BuilderProfileV1,
  BuilderHarnessConfigAdapterInputV1,
} from '../builder-profile.contracts';
import { resolveBuilderHarnessConfig } from '../builder-harness-config-adapter';
import * as registry from '../builder-profile.registry';

/**
 * Minimal global default that mirrors the shape produced by
 * createAgentHarnessConfigV1. Tests use this rather than the live
 * DEFAULT_AGENT_HARNESS_CONFIG_V1 so they remain deterministic and
 * independent of process.env.
 */
function makeGlobalDefault(
  overrides?: Partial<AgentHarnessRuntimeConfigV1>,
): Readonly<AgentHarnessRuntimeConfigV1> {
  return Object.freeze({
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
    allowedValidationCommands: Object.freeze([
      'npm test',
      'npm run build',
      'npx tsc --noEmit',
    ]),
    requireApprovalForDelete: true,
    requireApprovalForPackageInstall: true,
    requireApprovalForEnvFileWrite: true,
    requireApprovalForLargeWrite: true,
    enableBrowserSmoke: false,
    enableSemanticSearch: false,
    enableToolLoop: false,
    enableWriteTools: false,
    enableValidationTools: false,
    enablePreApplyCheckpoint: true,
    auditEventsEnabled: true,
    ...overrides,
  });
}

function stubProfile(partial: Partial<BuilderProfileV1>): BuilderProfileV1 {
  return {
    builderProfileId: partial.builderProfileId ?? 'test-profile',
    displayName: partial.displayName ?? 'Test Profile',
    description: partial.description ?? 'Test description',
    agentRole: partial.agentRole ?? 'builder',
    enabled: partial.enabled ?? true,
    profileVersion: partial.profileVersion ?? 1,
    ...partial,
  } as BuilderProfileV1;
}

describe('resolveBuilderHarnessConfig', () => {
  const globalDefault = makeGlobalDefault();

  // -----------------------------------------------------------------------
  // Missing / unknown / non-builder fallback paths
  // -----------------------------------------------------------------------

  describe('global default fallback paths', () => {
    it('missing builderProfileId returns global default', () => {
      const result = resolveBuilderHarnessConfig({}, globalDefault);

      expect(result.config).toBe(globalDefault);
      expect(result.metadata.source).toBe('global-default-missing-profile');
      expect(result.metadata.builderProfileId).toBeUndefined();
      expect(result.metadata.fieldsOverridden).toHaveLength(0);
      expect(result.metadata.fieldsDefaulted.length).toBeGreaterThan(0);
      expect(result.metadata.warnings).toHaveLength(0);
    });

    it('empty-string builderProfileId returns global default', () => {
      const result = resolveBuilderHarnessConfig(
        { builderProfileId: '' },
        globalDefault,
      );
      expect(result.metadata.source).toBe('global-default-missing-profile');
    });

    it('unknown builderProfileId returns global default with warning', () => {
      const result = resolveBuilderHarnessConfig(
        { builderProfileId: 'does-not-exist' },
        globalDefault,
      );

      expect(result.config).toBe(globalDefault);
      expect(result.metadata.source).toBe('global-default-unknown-profile');
      expect(result.metadata.builderProfileId).toBe('does-not-exist');
      expect(result.metadata.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.metadata.warnings[0]).toContain('does-not-exist');
    });

    it('non-builder agentRole returns global default with warning', () => {
      const result = resolveBuilderHarnessConfig(
        { agentRole: 'chief-of-staff', builderProfileId: 'builder-default' },
        globalDefault,
      );

      expect(result.config).toBe(globalDefault);
      expect(result.metadata.source).toBe('global-default-non-builder-role');
      expect(result.metadata.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.metadata.warnings[0]).toContain('chief-of-staff');
    });
  });

  // -----------------------------------------------------------------------
  // Default builder profile (no overrides)
  // -----------------------------------------------------------------------

  describe('default builder profile resolution', () => {
    it('default profile resolves without changing current global defaults', () => {
      const result = resolveBuilderHarnessConfig(
        { builderProfileId: 'builder-default', agentRole: 'builder' },
        globalDefault,
      );

      expect(result.config).toBe(globalDefault);
      expect(result.metadata.source).toBe('builder-profile');
      expect(result.metadata.builderProfileId).toBe('builder-default');
      expect(result.metadata.fieldsOverridden).toHaveLength(0);
      expect(result.metadata.fieldsDefaulted.length).toBeGreaterThan(0);
      expect(result.metadata.warnings).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Profile overrides
  // -----------------------------------------------------------------------

  describe('per-builder profile overrides', () => {
    const customProfile = stubProfile({
      builderProfileId: 'builder-custom',
      harnessProfile: {
        harnessProfileId: 'harness-custom',
        maxToolIterations: 10,
        enableToolLoop: true,
        enableWriteTools: true,
      },
      modelProfile: {
        modelProfileId: 'model-custom',
        defaultModelId: 'anthropic.claude-3-5-sonnet',
      },
      toolPermissions: {
        toolPermissionProfileId: 'tools-custom',
      },
    });

    beforeEach(() => {
      jest
        .spyOn(registry, 'getBuilderProfile')
        .mockImplementation((id: string) => {
          if (id === 'builder-custom') return customProfile;
          return registry.BUILDER_PROFILE_MAP_V1[id];
        });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('profile override changes allowed fields', () => {
      const result = resolveBuilderHarnessConfig(
        { builderProfileId: 'builder-custom', agentRole: 'builder' },
        globalDefault,
      );

      expect(result.config.maxToolIterations).toBe(10);
      expect(result.config.enableToolLoop).toBe(true);
      expect(result.config.enableWriteTools).toBe(true);
      expect(result.config.contractVersion).toBe(
        AGENT_HARNESS_CONTRACT_VERSION_V1,
      );
    });

    it('missing optional harness fields default correctly', () => {
      const result = resolveBuilderHarnessConfig(
        { builderProfileId: 'builder-custom', agentRole: 'builder' },
        globalDefault,
      );

      expect(result.config.maxFileReadBytes).toBe(
        globalDefault.maxFileReadBytes,
      );
      expect(result.config.toolTimeoutMs).toBe(globalDefault.toolTimeoutMs);
      expect(result.config.validationTimeoutMs).toBe(
        globalDefault.validationTimeoutMs,
      );
      expect(result.config.enableBrowserSmoke).toBe(
        globalDefault.enableBrowserSmoke,
      );
    });

    it('metadata tracks fieldsOverridden and fieldsDefaulted accurately', () => {
      const result = resolveBuilderHarnessConfig(
        { builderProfileId: 'builder-custom', agentRole: 'builder' },
        globalDefault,
      );

      expect(result.metadata.fieldsOverridden).toContain('maxToolIterations');
      expect(result.metadata.fieldsOverridden).toContain('enableToolLoop');
      expect(result.metadata.fieldsOverridden).toContain('enableWriteTools');
      expect(result.metadata.fieldsDefaulted).toContain('maxFileReadBytes');
      expect(result.metadata.fieldsDefaulted).toContain('toolTimeoutMs');

      expect(result.metadata.harnessProfileId).toBe('harness-custom');
      expect(result.metadata.modelProfileId).toBe('model-custom');
      expect(result.metadata.toolPermissionProfileId).toBe('tools-custom');
    });
  });

  // -----------------------------------------------------------------------
  // Platform floor enforcement
  // -----------------------------------------------------------------------

  describe('platform approval floors', () => {
    const floorFields = [
      'requireApprovalForDelete',
      'requireApprovalForPackageInstall',
      'requireApprovalForEnvFileWrite',
      'requireApprovalForLargeWrite',
    ] as const;

    for (const field of floorFields) {
      it(`enforces platform floor for ${field}`, () => {
        const weakProfile = stubProfile({
          builderProfileId: 'builder-weak',
          harnessProfile: {
            harnessProfileId: 'harness-weak',
            [field]: false,
          },
        });

        jest
          .spyOn(registry, 'getBuilderProfile')
          .mockImplementation((id: string) => {
            if (id === 'builder-weak') return weakProfile;
            return registry.BUILDER_PROFILE_MAP_V1[id];
          });

        const result = resolveBuilderHarnessConfig(
          { builderProfileId: 'builder-weak', agentRole: 'builder' },
          globalDefault,
        );

        expect(result.config[field]).toBe(true);
        expect(
          result.metadata.warnings.some((w) => w.includes(field)),
        ).toBe(true);

        jest.restoreAllMocks();
      });
    }

    it('does not warn when profile approval field matches global true', () => {
      const safeProfile = stubProfile({
        builderProfileId: 'builder-safe',
        harnessProfile: {
          harnessProfileId: 'harness-safe',
          requireApprovalForDelete: true,
        },
      });

      jest
        .spyOn(registry, 'getBuilderProfile')
        .mockImplementation((id: string) => {
          if (id === 'builder-safe') return safeProfile;
          return registry.BUILDER_PROFILE_MAP_V1[id];
        });

      const result = resolveBuilderHarnessConfig(
        { builderProfileId: 'builder-safe', agentRole: 'builder' },
        globalDefault,
      );

      expect(result.config.requireApprovalForDelete).toBe(true);
      expect(
        result.metadata.warnings.some((w) =>
          w.includes('requireApprovalForDelete'),
        ),
      ).toBe(false);

      jest.restoreAllMocks();
    });
  });

  // -----------------------------------------------------------------------
  // Platform veto for allowArbitraryShell
  // -----------------------------------------------------------------------

  describe('allowArbitraryShell platform veto', () => {
    it('vetoes allowArbitraryShell=true when global default is false', () => {
      const shellProfile = stubProfile({
        builderProfileId: 'builder-shell',
        harnessProfile: {
          harnessProfileId: 'harness-shell',
          allowArbitraryShell: true,
        },
      });

      jest
        .spyOn(registry, 'getBuilderProfile')
        .mockImplementation((id: string) => {
          if (id === 'builder-shell') return shellProfile;
          return registry.BUILDER_PROFILE_MAP_V1[id];
        });

      const result = resolveBuilderHarnessConfig(
        { builderProfileId: 'builder-shell', agentRole: 'builder' },
        globalDefault,
      );

      expect(result.config.allowArbitraryShell).toBe(false);
      expect(
        result.metadata.warnings.some((w) =>
          w.includes('allowArbitraryShell'),
        ),
      ).toBe(true);

      jest.restoreAllMocks();
    });

    it('allows allowArbitraryShell=true when global default is true', () => {
      const permissiveGlobal = makeGlobalDefault({
        allowArbitraryShell: true,
      });
      const shellProfile = stubProfile({
        builderProfileId: 'builder-shell',
        harnessProfile: {
          harnessProfileId: 'harness-shell',
          allowArbitraryShell: true,
        },
      });

      jest
        .spyOn(registry, 'getBuilderProfile')
        .mockImplementation((id: string) => {
          if (id === 'builder-shell') return shellProfile;
          return registry.BUILDER_PROFILE_MAP_V1[id];
        });

      const result = resolveBuilderHarnessConfig(
        { builderProfileId: 'builder-shell', agentRole: 'builder' },
        permissiveGlobal,
      );

      expect(result.config.allowArbitraryShell).toBe(true);
      expect(
        result.metadata.warnings.some((w) =>
          w.includes('allowArbitraryShell'),
        ),
      ).toBe(false);

      jest.restoreAllMocks();
    });
  });

  // -----------------------------------------------------------------------
  // Non-builder agentRole fallback
  // -----------------------------------------------------------------------

  describe('non-builder agentRole handling', () => {
    it('uses global fallback for product-strategy role', () => {
      const result = resolveBuilderHarnessConfig(
        { agentRole: 'product-strategy' },
        globalDefault,
      );

      expect(result.config).toBe(globalDefault);
      expect(result.metadata.source).toBe('global-default-non-builder-role');
    });

    it('uses global fallback for technology-advisor role', () => {
      const result = resolveBuilderHarnessConfig(
        { agentRole: 'technology-advisor', builderProfileId: 'builder-default' },
        globalDefault,
      );

      expect(result.config).toBe(globalDefault);
      expect(result.metadata.source).toBe('global-default-non-builder-role');
      expect(result.metadata.warnings.length).toBeGreaterThanOrEqual(1);
    });

    it('builder agentRole without profile falls back to missing-profile path', () => {
      const result = resolveBuilderHarnessConfig(
        { agentRole: 'builder' },
        globalDefault,
      );

      expect(result.metadata.source).toBe('global-default-missing-profile');
    });
  });

  // -----------------------------------------------------------------------
  // Metadata accuracy
  // -----------------------------------------------------------------------

  describe('resolution metadata accuracy', () => {
    it('metadata for global-default-missing-profile is complete', () => {
      const result = resolveBuilderHarnessConfig({}, globalDefault);

      expect(result.metadata.source).toBe('global-default-missing-profile');
      expect(result.metadata.harnessProfileId).toBeUndefined();
      expect(result.metadata.modelProfileId).toBeUndefined();
      expect(result.metadata.toolPermissionProfileId).toBeUndefined();
      expect(result.metadata.fieldsOverridden).toHaveLength(0);
      expect(result.metadata.fieldsDefaulted.length).toBeGreaterThan(10);
    });

    it('metadata warnings are string arrays suitable for debug logging', () => {
      const result = resolveBuilderHarnessConfig(
        { builderProfileId: 'unknown-id' },
        globalDefault,
      );

      expect(Array.isArray(result.metadata.warnings)).toBe(true);
      for (const w of result.metadata.warnings) {
        expect(typeof w).toBe('string');
        expect(w.length).toBeGreaterThan(0);
      }
    });

    it('fieldsOverridden + fieldsDefaulted cover all mergeable fields for a profile with overrides', () => {
      const fullOverrideProfile = stubProfile({
        builderProfileId: 'builder-full',
        harnessProfile: {
          harnessProfileId: 'harness-full',
          maxToolIterations: 5,
        },
      });

      jest
        .spyOn(registry, 'getBuilderProfile')
        .mockImplementation((id: string) => {
          if (id === 'builder-full') return fullOverrideProfile;
          return registry.BUILDER_PROFILE_MAP_V1[id];
        });

      const result = resolveBuilderHarnessConfig(
        { builderProfileId: 'builder-full', agentRole: 'builder' },
        globalDefault,
      );

      const allTracked = [
        ...result.metadata.fieldsOverridden,
        ...result.metadata.fieldsDefaulted,
      ];
      expect(allTracked.length).toBeGreaterThan(10);
      expect(new Set(allTracked).size).toBe(allTracked.length);

      jest.restoreAllMocks();
    });
  });
});
