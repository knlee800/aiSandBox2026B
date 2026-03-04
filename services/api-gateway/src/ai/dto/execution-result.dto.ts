export interface ExecutionResultDto {
  executionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

  output?: string;
  tokensUsed?: number;

  error?: {
    code: string;
    message: string;
  };
}
