import {
  isWorkspaceExecutionFileActionState,
  type WorkspaceExecutionFileActionState,
} from './workspace-ai-file-actions.logic';

export interface WorkspaceChatThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  executionId?: string;
  provider?: string;
  model?: string;
  fileActionState?: WorkspaceExecutionFileActionState;
}

export function parseStoredChatThreadMessages(raw: string | null): WorkspaceChatThreadMessage[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    const messages: WorkspaceChatThreadMessage[] = [];
    for (const value of parsed) {
      if (!value || typeof value !== 'object') {
        continue;
      }
      const candidate = value as {
        id?: unknown;
        role?: unknown;
        content?: unknown;
        executionId?: unknown;
        provider?: unknown;
        model?: unknown;
        fileActionState?: unknown;
      };
      if (
        typeof candidate.id !== 'string' ||
        (candidate.role !== 'user' && candidate.role !== 'assistant') ||
        typeof candidate.content !== 'string'
      ) {
        continue;
      }
      const message: WorkspaceChatThreadMessage = {
        id: candidate.id,
        role: candidate.role,
        content: candidate.content,
      };
      if (typeof candidate.executionId === 'string') {
        message.executionId = candidate.executionId;
      }
      if (typeof candidate.provider === 'string') {
        message.provider = candidate.provider;
      }
      if (typeof candidate.model === 'string') {
        message.model = candidate.model;
      }
      if (isWorkspaceExecutionFileActionState(candidate.fileActionState)) {
        message.fileActionState = {
          ...candidate.fileActionState,
          confirmationRequired: candidate.fileActionState.confirmationRequired === true,
        };
      }
      messages.push(message);
    }
    return messages;
  } catch {
    return [];
  }
}
