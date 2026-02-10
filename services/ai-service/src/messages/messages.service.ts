import { Injectable, BadRequestException } from '@nestjs/common';
import { ConversationsService } from '../conversations/conversations.service';
import { QuotaService } from '../quota/quota.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import Database from 'better-sqlite3';
import * as path from 'path';
import { ApiGatewayHttpClient } from '../clients/api-gateway-http.client';
import { AIExecutionService } from '../ai-execution/ai-execution.service';
import { AIExecutionRequest } from '../ai-execution/types';

@Injectable()
export class MessagesService {
  private db: Database.Database;
  private containerManagerUrl = process.env.CONTAINER_MANAGER_URL || 'http://localhost:4001';

  constructor(
    private aiExecutionService: AIExecutionService,
    private conversationsService: ConversationsService,
    private quotaService: QuotaService,
    private httpService: HttpService,
    private apiGatewayClient: ApiGatewayHttpClient,
  ) {
    const dbPath = path.join(__dirname, '../../../..', 'database', 'aisandbox.db');
    this.db = new Database(dbPath);
  }

  async handleUserMessage(
    sessionId: string,
    userId: string,
    message: string,
    provider: 'stub' | 'anthropic' | 'openai' | 'groq' | 'xai' | 'deepseek',
  ) {
    // Verify session exists and belongs to user
    const session = await this.getSession(sessionId, userId);
    if (!session) {
      throw new BadRequestException('Session not found or access denied');
    }

    // Get or create conversation
    let conversation;
    try {
      conversation = await this.conversationsService.getConversation(sessionId);
    } catch (error) {
      // Create new conversation if it doesn't exist
      conversation = await this.conversationsService.createConversation(sessionId, userId);
    }

    // Persist user message via api-gateway HTTP (fail-fast)
    const userMessageId = await this.apiGatewayClient.addChatMessage(
      sessionId,
      'user',
      message,
      0, // User messages have 0 tokens
    );

    // Add user message to local conversation for context building
    await this.conversationsService.addMessage(sessionId, 'user', message);

    // Get conversation history for context
    const messages = await this.conversationsService.getMessages(sessionId, 20);

    // Build system prompt with workspace context
    const systemPrompt = this.buildSystemPrompt(session);

    // Task 5.1B: Check quota BEFORE calling AI API
    // Throws QuotaExceededException if limit would be exceeded
    await this.quotaService.checkQuota(sessionId);

    // Build AIExecutionRequest from conversation history
    const prompt = this.buildPromptFromMessages(messages, systemPrompt);
    const executionRequest: AIExecutionRequest = {
      sessionId,
      userId,
      conversationId: conversation.id,
      prompt,
      provider,
      metadata: { systemPrompt },
    };

    // Execute via AI adapter
    const executionResult = await this.aiExecutionService.execute(executionRequest);

    // Map execution result to Claude-compatible response format
    const claudeResponse = {
      content: executionResult.output,
      usage: {
        input_tokens: 0, // Adapters don't expose token breakdown
        output_tokens: executionResult.tokensUsed,
        total_tokens: executionResult.tokensUsed,
      },
      model: executionResult.model,
    };

    // Parse Claude's response for file operations
    const operations = this.parseFileOperations(claudeResponse.content);

    // Execute file operations via Container Manager
    if (operations.length > 0) {
      await this.executeFileOperations(sessionId, operations);
    }

    // Add assistant message to local conversation
    const assistantMessageResult = await this.conversationsService.addMessage(
      sessionId,
      'assistant',
      claudeResponse.content,
    );

    // Persist assistant message via api-gateway HTTP (fail-fast)
    const assistantMessageId = await this.apiGatewayClient.addChatMessage(
      sessionId,
      'assistant',
      claudeResponse.content,
      claudeResponse.usage.output_tokens, // Assistant message token count
    );

    // Create git commit if there were file operations
    if (operations.length > 0) {
      await this.createGitCommit(sessionId, userId, assistantMessageResult.messageNumber);
    }

    // Record token usage via api-gateway HTTP (fail-fast)
    await this.apiGatewayClient.recordTokenUsage(
      sessionId,
      claudeResponse.usage.input_tokens,
      claudeResponse.usage.output_tokens,
      assistantMessageId,
    );

    return {
      message: claudeResponse.content,
      operations: operations,
      usage: claudeResponse.usage,
    };
  }

  async streamUserMessage(
    sessionId: string,
    userId: string,
    message: string,
    provider: 'stub' | 'anthropic' | 'openai' | 'groq' | 'xai' | 'deepseek',
    onChunk: (text: string) => void,
  ) {
    // Verify session
    const session = await this.getSession(sessionId, userId);
    if (!session) {
      throw new BadRequestException('Session not found or access denied');
    }

    // Get or create conversation
    let conversation;
    try {
      conversation = await this.conversationsService.getConversation(sessionId);
    } catch (error) {
      conversation = await this.conversationsService.createConversation(sessionId, userId);
    }

    // Persist user message via api-gateway (fail-fast)
    const userMessageId = await this.apiGatewayClient.addChatMessage(
      sessionId,
      'user',
      message,
      0,
    );

    // Add user message to local conversation
    await this.conversationsService.addMessage(sessionId, 'user', message);

    // Get history
    const messages = await this.conversationsService.getMessages(sessionId, 20);
    const systemPrompt = this.buildSystemPrompt(session);

    // Task 5.1B: Check quota BEFORE calling AI API
    // Throws QuotaExceededException if limit would be exceeded
    await this.quotaService.checkQuota(sessionId);

    // Build AIExecutionRequest from conversation history
    const prompt = this.buildPromptFromMessages(messages, systemPrompt);
    const executionRequest: AIExecutionRequest = {
      sessionId,
      userId,
      conversationId: conversation.id,
      prompt,
      provider,
      metadata: { systemPrompt },
    };

    // Execute via AI adapter (non-streaming fallback)
    // Note: AIExecutionService doesn't support streaming, so we return full response
    const executionResult = await this.aiExecutionService.execute(executionRequest);

    // Call onChunk with full response to maintain interface compatibility
    if (onChunk) {
      onChunk(executionResult.output);
    }

    // Map execution result to Claude-compatible response format
    const claudeResponse = {
      content: executionResult.output,
      usage: {
        input_tokens: 0, // Adapters don't expose token breakdown
        output_tokens: executionResult.tokensUsed,
        total_tokens: executionResult.tokensUsed,
      },
    };

    // Parse and execute operations
    const operations = this.parseFileOperations(claudeResponse.content);
    if (operations.length > 0) {
      await this.executeFileOperations(sessionId, operations);
    }

    // Save assistant message locally
    const assistantMessageResult = await this.conversationsService.addMessage(
      sessionId,
      'assistant',
      claudeResponse.content,
    );

    // Persist assistant message via api-gateway (fail-fast)
    const assistantMessageId = await this.apiGatewayClient.addChatMessage(
      sessionId,
      'assistant',
      claudeResponse.content,
      claudeResponse.usage.output_tokens,
    );

    // Create git commit if there were file operations
    if (operations.length > 0) {
      await this.createGitCommit(sessionId, userId, assistantMessageResult.messageNumber);
    }

    // Record token usage via api-gateway HTTP (fail-fast)
    await this.apiGatewayClient.recordTokenUsage(
      sessionId,
      claudeResponse.usage.input_tokens,
      claudeResponse.usage.output_tokens,
      assistantMessageId,
    );

    return {
      message: claudeResponse.content,
      operations: operations,
      usage: claudeResponse.usage,
    };
  }

  private buildSystemPrompt(session: any): string {
    return `You are an AI coding assistant helping users build applications in a sandbox environment.

The user is working in session: ${session.id}
Workspace path: /workspaces/${session.id}
Current status: ${session.status}

You can create, modify, and delete files by using specific markers in your responses:
- To create/update a file, use: FILE_WRITE: <path> | <content>
- To delete a file, use: FILE_DELETE: <path>

Always provide clear explanations of what you're doing and why.
Focus on writing clean, maintainable code with good practices.
`;
  }

  /**
   * Convert conversation messages array into a single prompt string for AIExecutionRequest.
   * Concatenates messages with role prefixes to preserve conversation context.
   */
  private buildPromptFromMessages(
    messages: Array<{ role: string; content: string }>,
    systemPrompt?: string,
  ): string {
    let prompt = '';

    // Prepend system prompt if provided
    if (systemPrompt) {
      prompt += `System: ${systemPrompt}\n\n`;
    }

    // Append each message with role prefix
    for (const msg of messages) {
      const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
      prompt += `${roleLabel}: ${msg.content}\n\n`;
    }

    return prompt.trim();
  }

  private parseFileOperations(content: string): Array<{
    type: 'write' | 'delete';
    path: string;
    content?: string;
  }> {
    const operations = [];

    // Parse FILE_WRITE operations
    const writeMatches = content.matchAll(/FILE_WRITE:\s*(.+?)\s*\|\s*([\s\S]+?)(?=FILE_WRITE:|FILE_DELETE:|$)/g);
    for (const match of writeMatches) {
      operations.push({
        type: 'write' as const,
        path: match[1].trim(),
        content: match[2].trim(),
      });
    }

    // Parse FILE_DELETE operations
    const deleteMatches = content.matchAll(/FILE_DELETE:\s*(.+?)(?:\n|$)/g);
    for (const match of deleteMatches) {
      operations.push({
        type: 'delete' as const,
        path: match[1].trim(),
      });
    }

    return operations;
  }

  private async executeFileOperations(
    sessionId: string,
    operations: Array<{ type: string; path: string; content?: string }>,
  ) {
    for (const op of operations) {
      try {
        if (op.type === 'write') {
          await firstValueFrom(
            this.httpService.post(
              `${this.containerManagerUrl}/api/files/${sessionId}/write`,
              {
                path: op.path,
                content: op.content,
              },
            ),
          );
        } else if (op.type === 'delete') {
          await firstValueFrom(
            this.httpService.delete(
              `${this.containerManagerUrl}/api/files/${sessionId}/delete?path=${encodeURIComponent(op.path)}`,
            ),
          );
        }
      } catch (error) {
        console.error(`Failed to execute ${op.type} operation for ${op.path}:`, error.message);
      }
    }
  }

  private async getSession(sessionId: string, userId: string) {
    return this.db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .get(sessionId, userId);
  }

  private async createGitCommit(
    sessionId: string,
    userId: string,
    messageNumber: number,
  ) {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.containerManagerUrl}/api/git/${sessionId}/commit`,
          {
            userId,
            messageNumber,
            description: `Auto-commit: Message ${messageNumber}`,
          },
        ),
      );
      console.log(`Git commit created for session ${sessionId}, message ${messageNumber}`);
    } catch (error) {
      console.error(`Failed to create git commit for session ${sessionId}:`, error.message);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}
