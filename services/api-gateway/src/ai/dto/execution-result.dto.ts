export interface ExecutionResultDto {
  executionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

  output?: string;
  tokensUsed?: number;
  fileActions?: FileActionDto[];

  error?: {
    code: string;
    message: string;
  };
}

export interface FileActionDto {
  action: 'create' | 'write' | 'update';
  path: string;
  content: string;
}
