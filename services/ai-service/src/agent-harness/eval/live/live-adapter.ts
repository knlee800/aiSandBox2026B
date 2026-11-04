import { ConfigService } from '@nestjs/config';
import { AIExecutionService } from '../../../ai-execution/ai-execution.service';
import type { AIAdapter } from '../../../ai-execution/adapters/ai-adapter.interface';

export interface AnthropicLiveAdapter extends AIAdapter {
  executeWithTools: NonNullable<AIAdapter['executeWithTools']>;
}
import { resolveProviderModelSelection } from '../../../ai-execution/provider-model.catalogue';

/**
 * Same text getAdapter throws for a missing Anthropic key.
 * The value of the key is never included.
 */
export const MISSING_ANTHROPIC_API_KEY_MESSAGE =
  'ANTHROPIC_API_KEY environment variable is required when provider is "anthropic"';

export function readAnthropicApiKey(env: NodeJS.ProcessEnv): string {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    throw new Error(MISSING_ANTHROPIC_API_KEY_MESSAGE);
  }
  return apiKey;
}

/**
 * Same resolution getAdapter uses for anthropic: catalogue allow-list,
 * otherwise the ANTHROPIC_MODEL environment value.
 */
export function resolveLiveModel(model: string, env: NodeJS.ProcessEnv): string {
  return resolveProviderModelSelection({
    provider: 'anthropic',
    model,
    anthropicModel: env.ANTHROPIC_MODEL,
  }).model;
}

/**
 * Builds the Anthropic adapter the way AIExecutionService.getAdapter does.
 * The key is read from env and passed only into that constructor.
 */
export function createAnthropicLiveAdapter(
  env: NodeJS.ProcessEnv,
  model: string,
): AnthropicLiveAdapter {
  const service = new AIExecutionService(envConfig(env));
  const adapter = service.getAdapter('anthropic', model);
  if (typeof adapter.executeWithTools !== 'function') {
    throw new Error('Anthropic adapter does not provide executeWithTools');
  }
  return adapter as AnthropicLiveAdapter;
}

/**
 * Removes an exact API key from text that might be printed or stored.
 * Does nothing when no key is present.
 */
export function scrubSecret(text: string, secret: string | undefined): string {
  if (typeof secret !== 'string' || secret.length === 0) {
    return text;
  }
  if (!text.includes(secret)) {
    return text;
  }
  return text.split(secret).join('[redacted]');
}

export function scrubError(err: unknown, secret: string | undefined): Error {
  const message = scrubSecret(
    err instanceof Error ? err.message : String(err),
    secret,
  );
  const scrubbed = new Error(message);
  scrubbed.name = err instanceof Error && err.name ? err.name : 'Error';
  return scrubbed;
}

function envConfig(env: NodeJS.ProcessEnv): ConfigService {
  return {
    get(key: string): string | undefined {
      const value = env[key];
      return typeof value === 'string' ? value : undefined;
    },
  } as ConfigService;
}
