export interface ExecutionResultDto {
  executionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';

  output?: string;
  tokensUsed?: number;

  error?: {
    code: string;
    message: string;
  };
}
