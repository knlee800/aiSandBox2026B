import { Injectable, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/**
 * AIExecutionRequest
 * Matches ai-service contract (services/ai-service/src/ai-execution/types.ts)
 *
 * Phase 28: Provider selection is caller-owned (api-gateway determines provider)
 */
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

export interface AIExecutionRequest {
  sessionId: string;
  conversationId: string;
  userId: string;
  prompt: string;
  executionIntent?: 'conversation' | 'workspace_mutation';
  provider?: 'stub' | 'anthropic' | 'openai' | 'groq' | 'xai' | 'deepseek';
  model?: string;
  harnessVersion?: 'v1';
  workspaceContext?: WorkspaceContext;
  metadata?: Record<string, unknown>;

  /** AGENT-PLATFORM-06: Upstream identity propagation fields (all optional). */
  agentRole?: string;
  builderProfileId?: string;
  collaborationRunId?: string;
  referralTraceId?: string;

  /**
   * AGENT-PLATFORM-CREATE-01D: Optional persisted user_agents.id for Ask identity.
   * Distinct from agentRole (harness/system role) and builderProfileId (Builder catalog id).
   */
  agentId?: string;
}

/**
 * AIExecutionResult
 * Matches ai-service contract (services/ai-service/src/ai-execution/types.ts)
 */
export interface AIExecutionResult {
  output: string;
  tokensUsed: number;
  model: string;
  provider?: string;
  fileActions?: FileAction[];
}

export interface FileAction {
  action: 'create' | 'write' | 'update';
  path: string;
  content: string;
}

/**
 * AIServiceHttpClient
 *
 * HTTP client for communicating with ai-service.
 * Forwards execution requests and propagates results/exceptions unchanged.
 *
 * Phase 18A: Initial implementation
 */
@Injectable()
export class AIServiceHttpClient implements OnModuleInit {
  private readonly baseUrl: string;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:4001';

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 second timeout for AI execution
      headers: { 'Content-Type': 'application/json' },
    });
  }

  onModuleInit() {
    // No validation required - AI service is internal and always available
  }

  /**
   * Execute AI request via ai-service
   *
   * Forwards request to POST /api/execute
   * Returns result on success
   * Propagates exception on failure
   */
  async execute(request: AIExecutionRequest): Promise<AIExecutionResult> {
    try {
      const response = await this.axiosInstance.post<AIExecutionResult>(
        '/api/execute',
        request,
      );
      return response.data;
    } catch (error) {
      // Re-throw errors unchanged to preserve ai-service error semantics
      if (axios.isAxiosError(error) && error.response) {
        // Preserve HTTP error response from ai-service
        const status = error.response.status;
        const data = error.response.data;

        // Re-throw with original error structure
        const aiServiceError: any = new Error(data.message || 'AI execution failed');
        aiServiceError.status = status;
        aiServiceError.response = data;
        throw aiServiceError;
      }

      // Network or unknown errors
      throw error;
    }
  }
}
