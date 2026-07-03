import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * ApiGatewayHttpClient
 * HTTP client for persisting data to api-gateway
 * Communicates via HTTP POST requests (microservices architecture)
 *
 * Design:
 * - NO imports from api-gateway
 * - Fail-fast: throws on error
 * - No retries, no fallback storage
 * - Pure HTTP communication
 * - Authenticates internal API calls with X-Internal-Service-Key (Task 5.2B)
 */
@Injectable()
export class ApiGatewayHttpClient {
  private readonly apiGatewayUrl: string;
  private readonly internalServiceKey: string;

  constructor(private readonly httpService: HttpService) {
    this.apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:4000';

    // Task 5.2B: Internal Service Authentication (client-side)
    // Fail fast if INTERNAL_SERVICE_KEY is not configured
    this.internalServiceKey = process.env.INTERNAL_SERVICE_KEY;
    if (!this.internalServiceKey) {
      throw new Error(
        'INTERNAL_SERVICE_KEY environment variable is required for internal API authentication',
      );
    }
  }

  /**
   * Add a chat message (user or assistant)
   * @param sessionId - Session UUID
   * @param role - Message role (user, assistant, system)
   * @param content - Message content
   * @param tokensUsed - Token count (0 for user messages)
   * @returns Message ID from api-gateway
   * @throws Error if HTTP request fails
   */
  async addChatMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    tokensUsed: number = 0,
  ): Promise<string> {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.apiGatewayUrl}/api/chat-messages/add-by-session`,
        {
          sessionId,
          role,
          content,
          tokensUsed,
        },
        {
          headers: {
            'X-Internal-Service-Key': this.internalServiceKey,
          },
        },
      ),
    );

    return response.data.id;
  }

  /**
   * Record token usage for an AI interaction
   * @param sessionId - Session UUID
   * @param inputTokens - Input tokens consumed
   * @param outputTokens - Output tokens generated
   * @param chatMessageId - Optional chat message ID
   * @param model - AI model identifier
   * @throws Error if HTTP request fails
   */
  async recordTokenUsage(
    sessionId: string,
    inputTokens: number,
    outputTokens: number,
    chatMessageId?: string,
    model: string = 'claude-sonnet-4-20250514',
  ): Promise<void> {
    await firstValueFrom(
      this.httpService.post(
        `${this.apiGatewayUrl}/api/token-usage/record`,
        {
          sessionId,
          chatMessageId: chatMessageId || null,
          model,
          inputTokens,
          outputTokens,
        },
        {
          headers: {
            'X-Internal-Service-Key': this.internalServiceKey,
          },
        },
      ),
    );
  }

  /**
   * Get total token usage for a session
   * Read-only endpoint for quota checking (Task 5.1A)
   * @param sessionId - Session UUID
   * @returns Total tokens consumed by the session
   * @throws Error if HTTP request fails
   */
  async getTotalTokenUsage(sessionId: string): Promise<number> {
    const response = await firstValueFrom(
      this.httpService.get(
        `${this.apiGatewayUrl}/api/internal/token-usage/sessions/${sessionId}/total`,
        {
          headers: {
            'X-Internal-Service-Key': this.internalServiceKey,
          },
        },
      ),
    );

    return response.data.totalTokens;
  }

  /**
   * Read file content from a session workspace via API Gateway.
   * AGENT-HARNESS-03A: ai-service → API Gateway → container-manager boundary.
   * @param sessionId - Session UUID
   * @param path - Relative file path within workspace
   * @returns File path and content
   * @throws Error if HTTP request fails
   */
  async readWorkspaceFile(
    sessionId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<{ path: string; content: string }> {
    const response = await firstValueFrom(
      this.httpService.get(
        `${this.apiGatewayUrl}/api/internal/workspace/${sessionId}/read`,
        {
          params: { path },
          signal,
          headers: {
            'X-Internal-Service-Key': this.internalServiceKey,
          },
        },
      ),
    );

    return response.data;
  }

  /**
   * List directory contents from a session workspace via API Gateway.
   * AGENT-HARNESS-03A: ai-service → API Gateway → container-manager boundary.
   * @param sessionId - Session UUID
   * @param path - Relative directory path within workspace (defaults to root)
   * @returns Directory path and entries
   * @throws Error if HTTP request fails
   */
  async listWorkspaceDirectory(
    sessionId: string,
    path: string = '/',
    signal?: AbortSignal,
  ): Promise<{
    path: string;
    entries: Array<{
      name: string;
      type: 'file' | 'dir';
      size: number;
      modifiedAt: string;
    }>;
  }> {
    const response = await firstValueFrom(
      this.httpService.get(
        `${this.apiGatewayUrl}/api/internal/workspace/${sessionId}/list`,
        {
          params: { path },
          signal,
          headers: {
            'X-Internal-Service-Key': this.internalServiceKey,
          },
        },
      ),
    );

    return response.data;
  }

  /**
   * Write file content to a session workspace via API Gateway.
   * AGENT-HARNESS-03B: ai-service → API Gateway → container-manager boundary.
   * @param sessionId - Session UUID
   * @param path - Relative file path within workspace
   * @param content - File content to write
   * @throws Error if HTTP request fails
   */
  async writeWorkspaceFile(
    sessionId: string,
    path: string,
    content: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await firstValueFrom(
      this.httpService.post(
        `${this.apiGatewayUrl}/api/internal/workspace/${sessionId}/write`,
        { path, content },
        {
          signal,
          headers: {
            'X-Internal-Service-Key': this.internalServiceKey,
          },
        },
      ),
    );
  }

  /**
   * Delete a file from a session workspace via API Gateway.
   * AGENT-HARNESS-03B: ai-service → API Gateway → container-manager boundary.
   * @param sessionId - Session UUID
   * @param path - Relative file path within workspace
   * @throws Error if HTTP request fails
   */
  async deleteWorkspaceFile(
    sessionId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await firstValueFrom(
      this.httpService.delete(
        `${this.apiGatewayUrl}/api/internal/workspace/${sessionId}/delete`,
        {
          data: { path },
          signal,
          headers: {
            'X-Internal-Service-Key': this.internalServiceKey,
          },
        },
      ),
    );
  }

  /**
   * Run a validation command in a session workspace via API Gateway.
   * AGENT-HARNESS-04A: ai-service → API Gateway → container-manager boundary.
   * @param sessionId - Session UUID
   * @param command - Allow-listed validation command string
   * @param timeoutMs - Execution timeout in milliseconds
   * @returns Exit code, stdout, and stderr from the command
   * @throws Error if HTTP request fails
   */
  async runWorkspaceValidation(
    sessionId: string,
    command: string,
    timeoutMs: number = 120_000,
    signal?: AbortSignal,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.apiGatewayUrl}/api/internal/workspace/${sessionId}/validate`,
        { command, timeoutMs },
        {
          signal,
          headers: {
            'X-Internal-Service-Key': this.internalServiceKey,
          },
        },
      ),
    );

    return response.data;
  }

  /**
   * Create a workspace checkpoint via API Gateway.
   * AGENT-HARNESS-03C: Pre-apply checkpoint before first mutating tool call.
   * @param sessionId - Session UUID
   * @param description - Optional checkpoint description
   * @returns Commit hash and files changed count
   * @throws Error if HTTP request fails
   */
  async createWorkspaceCheckpoint(
    sessionId: string,
    description?: string,
    signal?: AbortSignal,
  ): Promise<{ commitHash: string; filesChanged: number }> {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.apiGatewayUrl}/api/internal/workspace/${sessionId}/checkpoint`,
        { description },
        {
          signal,
          headers: {
            'X-Internal-Service-Key': this.internalServiceKey,
          },
        },
      ),
    );

    return response.data;
  }

  /**
   * Run browser smoke check in a session workspace via API Gateway.
   * AGENT-HARNESS-05B2: ai-service → API Gateway → container-manager boundary.
   * @param sessionId - Session UUID
   * @param url - Relative URL path (defaults to "/")
   * @param timeoutMs - Timeout in milliseconds
   * @returns BrowserSmokeResult
   * @throws Error if HTTP request fails
   */
  async runBrowserSmoke(
    sessionId: string,
    url?: string,
    timeoutMs?: number,
    signal?: AbortSignal,
  ): Promise<BrowserSmokeResult> {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.apiGatewayUrl}/api/internal/workspace/${sessionId}/browser-smoke`,
        { url, timeoutMs },
        {
          timeout: (timeoutMs ?? 120_000) + 10_000,
          signal,
          headers: {
            'X-Internal-Service-Key': this.internalServiceKey,
          },
        },
      ),
    );

    return response.data;
  }
}

export interface BrowserSmokeResult {
  success: boolean;
  url: string;
  pageTitle: string;
  consoleErrors: string[];
  consoleWarnings: string[];
  networkErrors: string[];
  visibleTextSnippet: string;
  durationMs: number;
  error?: string;
  truncated: boolean;
}
