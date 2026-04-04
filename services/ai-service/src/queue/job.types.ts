export interface AiExecutionJob {
  executionId: string;

  userId: string;
  apiKeyId: string;

  sessionId: string;
  conversationId: string;

  provider: 'openai' | 'anthropic' | 'groq' | 'xai' | 'deepseek' | 'stub';
  adapter: 'openai' | 'anthropic' | 'groq' | 'xai' | 'deepseek' | 'stub';

  prompt: string;
  model?: string;

  requestId?: string;

  submittedAt: string;
}

export interface AiExecutionResult {
  executionId: string;

  status: 'completed' | 'failed' | 'timeout';

  output?: string;
  tokensUsed?: number;
  model?: string;

  executionDurationMs?: number;

  error?: {
    code: string;
    message: string;
  };
}
