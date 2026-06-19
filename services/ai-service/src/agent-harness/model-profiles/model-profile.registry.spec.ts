import * as fs from 'fs';
import * as path from 'path';
import {
  AGENT_HARNESS_MODEL_PROFILE_MAP_V1,
  AGENT_HARNESS_MODEL_PROFILES_V1,
  getAgentHarnessModelProfile,
  isAgentHarnessModelProfileEnabled,
  listAgentHarnessModelProfiles,
  listEnabledAgentHarnessModelProfiles,
} from '../index';

describe('Agent Harness model profile registry (v1)', () => {
  it('exports at least the intended initial provider-family profiles', () => {
    const profileIds = AGENT_HARNESS_MODEL_PROFILES_V1.map((profile) => profile.id);

    expect(profileIds).toEqual(
      expect.arrayContaining([
        'anthropic.claude-3-5-sonnet',
        'openai.gpt-4o',
        'groq.mixtral-8x7b-32768',
        'xai.grok-3',
        'deepseek.deepseek-chat',
      ]),
    );
    expect(AGENT_HARNESS_MODEL_PROFILES_V1.length).toBeGreaterThanOrEqual(5);
  });

  it('ensures each profile has required fields and conservative typed values', () => {
    for (const profile of AGENT_HARNESS_MODEL_PROFILES_V1) {
      expect(typeof profile.id).toBe('string');
      expect(profile.id.trim().length).toBeGreaterThan(0);
      expect(typeof profile.provider).toBe('string');
      expect(profile.provider.trim().length).toBeGreaterThan(0);
      expect(typeof profile.model).toBe('string');
      expect(profile.model.trim().length).toBeGreaterThan(0);
      expect(typeof profile.displayName).toBe('string');
      expect(profile.displayName.trim().length).toBeGreaterThan(0);
      expect(typeof profile.family).toBe('string');
      expect(profile.family.trim().length).toBeGreaterThan(0);
      expect(typeof profile.purpose).toBe('string');
      expect(profile.purpose.trim().length).toBeGreaterThan(0);
      expect(typeof profile.contextWindowTokens).toBe('number');
      expect(profile.contextWindowTokens).toBeGreaterThan(0);
      expect(typeof profile.maxOutputTokens).toBe('number');
      expect(profile.maxOutputTokens).toBeGreaterThan(0);
      expect(typeof profile.defaultTemperature).toBe('number');
      expect(Array.isArray(profile.tags)).toBe(true);
    }
  });

  it('enforces unique profile ids and a matching map size', () => {
    const uniqueIds = new Set(
      AGENT_HARNESS_MODEL_PROFILES_V1.map((profile) => profile.id),
    );

    expect(uniqueIds.size).toBe(AGENT_HARNESS_MODEL_PROFILES_V1.length);
    expect(Object.keys(AGENT_HARNESS_MODEL_PROFILE_MAP_V1)).toHaveLength(
      uniqueIds.size,
    );
  });

  it('ensures capability flags are booleans', () => {
    for (const profile of AGENT_HARNESS_MODEL_PROFILES_V1) {
      expect(typeof profile.supportsTools).toBe('boolean');
      expect(typeof profile.supportsStreaming).toBe('boolean');
      expect(typeof profile.supportsJsonMode).toBe('boolean');
      expect(typeof profile.supportsVision).toBe('boolean');
      expect(typeof profile.enabled).toBe('boolean');
    }
  });

  it('returns the expected profile for helper lookup', () => {
    const profile = getAgentHarnessModelProfile('openai.gpt-4o');

    expect(profile).toBeDefined();
    expect(profile?.provider).toBe('openai');
    expect(profile?.model).toBe('gpt-4o');
  });

  it('handles missing profile lookup safely', () => {
    const missingProfile = getAgentHarnessModelProfile('missing.profile-id');

    expect(missingProfile).toBeUndefined();
    expect(isAgentHarnessModelProfileEnabled('missing.profile-id')).toBe(false);
  });

  it('returns stable list helper data and correct enabled list behavior', () => {
    const allProfiles = listAgentHarnessModelProfiles();
    const enabledProfiles = listEnabledAgentHarnessModelProfiles();
    const expectedEnabledProfiles = allProfiles.filter((profile) => profile.enabled);

    expect(allProfiles).toBe(AGENT_HARNESS_MODEL_PROFILES_V1);
    expect(enabledProfiles).toEqual(expectedEnabledProfiles);
    for (const profile of enabledProfiles) {
      expect(isAgentHarnessModelProfileEnabled(profile.id)).toBe(true);
    }
  });

  it('makes registry exports available from stable agent-harness index', () => {
    expect(AGENT_HARNESS_MODEL_PROFILES_V1.length).toBeGreaterThan(0);
    expect(Object.keys(AGENT_HARNESS_MODEL_PROFILE_MAP_V1).length).toBeGreaterThan(
      0,
    );
  });

  it('does not require runtime wiring imports yet', () => {
    const workerProcessorPath = path.resolve(
      __dirname,
      '../../worker/worker.processor.ts',
    );
    const aiExecutionServicePath = path.resolve(
      __dirname,
      '../../ai-execution/ai-execution.service.ts',
    );

    const workerProcessorContent = fs.readFileSync(workerProcessorPath, 'utf8');
    const aiExecutionServiceContent = fs.readFileSync(aiExecutionServicePath, 'utf8');

    expect(workerProcessorContent).not.toContain('agent-harness/model-profiles');
    expect(aiExecutionServiceContent).not.toContain('agent-harness/model-profiles');
  });
});
