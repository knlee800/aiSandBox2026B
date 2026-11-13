import { knowledgeFetch } from '@/components/knowledge/knowledge-api';
import {
  chatErrorKey,
  formatLinkCode,
  parseChatLink,
  parseChatLinks,
  pickChatLocale,
  type ChatLinkLink,
  type ChatLinksState,
} from '@/components/connections/chat-link.logic';

export type ChatLinkFetcher = (path: string, init?: RequestInit) => Promise<Response>;

export type ChatLinkResult<T> =
  | { type: 'ok'; value: T }
  | { type: 'unauthorized' }
  | { type: 'forbidden' }
  | { type: 'unavailable' }
  | { type: 'failed'; errorKey: string; retryAfterSeconds: number | null };

export interface ChatCodeValue {
  code: string;
  expiresAt: string;
}

async function readError(response: Response): Promise<{ code: string | null; retryAfterSeconds: number | null }> {
  try {
    const payload = (await response.json()) as { code?: unknown; retryAfterSeconds?: unknown };
    return {
      code: typeof payload.code === 'string' ? payload.code : null,
      retryAfterSeconds: typeof payload.retryAfterSeconds === 'number' ? payload.retryAfterSeconds : null,
    };
  } catch {
    return { code: null, retryAfterSeconds: null };
  }
}

async function failedResult<T>(response: Response): Promise<ChatLinkResult<T>> {
  if (response.status === 401) {
    return { type: 'unauthorized' };
  }
  if (response.status === 403) {
    return { type: 'forbidden' };
  }
  const error = await readError(response);
  if (response.status === 503 && error.code === 'chat_link_unavailable') {
    return { type: 'unavailable' };
  }
  return { type: 'failed', errorKey: chatErrorKey(error.code), retryAfterSeconds: error.retryAfterSeconds };
}

function failed<T>(errorKey: string): ChatLinkResult<T> {
  return { type: 'failed', errorKey, retryAfterSeconds: null };
}

export async function loadChatLinks(
  fetcher: ChatLinkFetcher = knowledgeFetch,
): Promise<ChatLinkResult<ChatLinksState>> {
  try {
    const response = await fetcher('/api/chat-links');
    if (!response.ok) {
      return failedResult(response);
    }
    const parsed = parseChatLinks(await response.json());
    return parsed ? { type: 'ok', value: parsed } : failed('chat.errors.generic');
  } catch {
    return failed('chat.errors.network');
  }
}

/** The code is returned here and nowhere else; the caller keeps it in memory only. */
export async function createChatCode(
  locale: string,
  fetcher: ChatLinkFetcher = knowledgeFetch,
): Promise<ChatLinkResult<ChatCodeValue>> {
  try {
    const chosen = pickChatLocale(locale);
    const response = await fetcher('/api/chat-links/discord/code', {
      method: 'POST',
      body: JSON.stringify(chosen ? { locale: chosen } : {}),
    });
    if (!response.ok) {
      return failedResult(response);
    }
    const payload = (await response.json()) as { code?: unknown; expiresAt?: unknown };
    if (typeof payload.code !== 'string' || typeof payload.expiresAt !== 'string') {
      return failed('chat.errors.generic');
    }
    return { type: 'ok', value: { code: formatLinkCode(payload.code), expiresAt: payload.expiresAt } };
  } catch {
    return failed('chat.errors.network');
  }
}

export async function confirmChatLink(
  fetcher: ChatLinkFetcher = knowledgeFetch,
): Promise<ChatLinkResult<ChatLinkLink>> {
  try {
    const response = await fetcher('/api/chat-links/discord/confirm', { method: 'POST' });
    if (!response.ok) {
      return failedResult(response);
    }
    const parsed = parseChatLink(await response.json());
    return parsed ? { type: 'ok', value: parsed } : failed('chat.errors.generic');
  } catch {
    return failed('chat.errors.network');
  }
}

export async function cancelChatClaim(
  fetcher: ChatLinkFetcher = knowledgeFetch,
): Promise<ChatLinkResult<null>> {
  try {
    const response = await fetcher('/api/chat-links/discord/cancel', { method: 'POST' });
    if (!response.ok) {
      return failedResult(response);
    }
    return { type: 'ok', value: null };
  } catch {
    return failed('chat.errors.network');
  }
}

export async function unlinkChat(
  fetcher: ChatLinkFetcher = knowledgeFetch,
): Promise<ChatLinkResult<null>> {
  try {
    const response = await fetcher('/api/chat-links/discord', { method: 'DELETE' });
    if (!response.ok) {
      return failedResult(response);
    }
    return { type: 'ok', value: null };
  } catch {
    return failed('chat.errors.network');
  }
}
