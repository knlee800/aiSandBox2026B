import type { WorkspaceChatThreadMessage } from './workspace-chat-thread.logic';

export interface BackendConversationResponse {
  id: string;
  sessionId: string;
}

export interface BackendChatMessageResponse {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

interface LoadSessionChatMessagesArgs {
  token: string;
  sessionId: string;
  fetchImpl?: typeof fetch;
}

interface PersistSessionChatMessageArgs {
  token: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  fetchImpl?: typeof fetch;
}

export async function loadSessionChatMessagesFromBackend(
  args: LoadSessionChatMessagesArgs,
): Promise<WorkspaceChatThreadMessage[]> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const conversationResponse = await fetchImpl(
    `/api/sessions/${encodeURIComponent(args.sessionId)}/conversation`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${args.token}`,
      },
    },
  );
  if (!conversationResponse.ok) {
    throw new Error(`Chat conversation load failed (${conversationResponse.status})`);
  }

  const conversationData = (await conversationResponse.json()) as BackendConversationResponse | null;
  if (!conversationData || typeof conversationData.id !== 'string') {
    return [];
  }

  const messagesResponse = await fetchImpl(
    `/api/conversations/${encodeURIComponent(conversationData.id)}/messages?limit=200&offset=0`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${args.token}`,
      },
    },
  );
  if (!messagesResponse.ok) {
    throw new Error(`Chat messages load failed (${messagesResponse.status})`);
  }

  const messagesData = (await messagesResponse.json()) as BackendChatMessageResponse[];
  if (!Array.isArray(messagesData)) {
    return [];
  }

  return messagesData
    .filter(
      (message): message is BackendChatMessageResponse & { role: 'user' | 'assistant' } =>
        Boolean(message) &&
        typeof message.id === 'string' &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string',
    )
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    }));
}

export async function persistSessionChatMessageToBackend(
  args: PersistSessionChatMessageArgs,
): Promise<string> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const response = await fetchImpl(`/api/sessions/${encodeURIComponent(args.sessionId)}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: args.role,
      content: args.content,
    }),
  });
  if (!response.ok) {
    throw new Error(`Chat message persistence failed (${response.status})`);
  }
  const data = (await response.json()) as { id?: unknown };
  if (typeof data.id !== 'string') {
    throw new Error('Chat message persistence returned invalid id');
  }
  return data.id;
}
