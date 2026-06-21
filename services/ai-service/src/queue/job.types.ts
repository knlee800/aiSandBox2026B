export interface WorkspaceNamedFileContent {
  path: string;
  content: string;
}

export interface WorkspaceRepoDocContent {
  path: string;
  content: string;
}

export interface WorkspaceSearchMatch {
  path: string;
  line: number;
  preview: string;
}

export interface WorkspaceSearchResults {
  query: string;
  results: WorkspaceSearchMatch[];
  truncated: boolean;
}

export interface WorkspaceContext {
  filePaths: string[];
  selectedFilePath?: string;
  selectedFileContent?: string;
  namedFileContents?: WorkspaceNamedFileContent[];
  repoDocContents?: WorkspaceRepoDocContent[];
  searchResults?: WorkspaceSearchResults;
  projectName?: string;
  workspaceName?: string;
}

export interface AiExecutionJob {
  executionId: string;

  userId: string;
  apiKeyId: string;

  sessionId: string;
  conversationId: string;

  provider: 'openai' | 'anthropic' | 'groq' | 'xai' | 'deepseek' | 'stub';
  adapter: 'openai' | 'anthropic' | 'groq' | 'xai' | 'deepseek' | 'stub';

  prompt: string;
  workspaceContext?: WorkspaceContext;
  globalInstructions?: string;
  projectInstructions?: string;
  model?: string;

  /** Agent Harness version gate. When set to 'v1', enables the harness execution path. */
  harnessVersion?: string;

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
