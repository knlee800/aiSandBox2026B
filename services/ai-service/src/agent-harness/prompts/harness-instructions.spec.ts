import {
  HARNESS_ENV_FILE_INSTRUCTION,
  appendHarnessEnvFileInstruction,
} from './harness-instructions';

describe('harness env file instruction', () => {
  it('tells the model not to offer to create or edit .env files', () => {
    expect(HARNESS_ENV_FILE_INSTRUCTION).toBe(
      'Do not offer to create or edit .env files, because the platform refuses them.',
    );
    expect(HARNESS_ENV_FILE_INSTRUCTION).not.toContain('\n');
  });

  it('appends that one line to harness instructions and does not repeat it', () => {
    expect(appendHarnessEnvFileInstruction('Follow platform contract.')).toBe(
      `Follow platform contract.\n${HARNESS_ENV_FILE_INSTRUCTION}`,
    );
    expect(appendHarnessEnvFileInstruction('  ')).toBe(HARNESS_ENV_FILE_INSTRUCTION);
    expect(appendHarnessEnvFileInstruction(undefined)).toBe(
      HARNESS_ENV_FILE_INSTRUCTION,
    );
    const alreadyTold = `Follow platform contract.\n${HARNESS_ENV_FILE_INSTRUCTION}`;
    expect(appendHarnessEnvFileInstruction(alreadyTold)).toBe(alreadyTold);
  });
});
