/**
 * One line of harness instruction. Tool-use requests append it so the model
 * does not offer to create or edit .env files; the platform refuses those.
 */
export const HARNESS_ENV_FILE_INSTRUCTION =
  'Do not offer to create or edit .env files, because the platform refuses them.';

export function appendHarnessEnvFileInstruction(
  systemPrompt: string | undefined,
): string {
  const line = HARNESS_ENV_FILE_INSTRUCTION;
  const trimmed = typeof systemPrompt === 'string' ? systemPrompt.trim() : '';
  if (trimmed.length === 0) {
    return line;
  }
  if (trimmed.includes(line)) {
    return trimmed;
  }
  return `${trimmed}\n${line}`;
}
