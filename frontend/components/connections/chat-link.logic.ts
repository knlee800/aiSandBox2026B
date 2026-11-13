/** Pure logic for the Chat (Discord) link section of the Connections page (CHAT-DISCORD-01 slice A2). */

export interface ChatLinkLink {
  channel: 'discord';
  linkedAt: string;
  lastUsedAt: string | null;
  externalIdLast4: string;
}

export interface ChatLinkPending {
  channel: 'discord';
  claimed: boolean;
  expiresAt: string;
  claimedAt: string | null;
  displayName: string | null;
  externalIdLast4: string | null;
}

export interface ChatLinksState {
  enabled: boolean;
  paused: boolean;
  link: ChatLinkLink | null;
  pending: ChatLinkPending | null;
}

export const UNAVAILABLE_CHAT_STATE: ChatLinksState = {
  enabled: false,
  paused: false,
  link: null,
  pending: null,
};

/** How often the page asks for a claim while a code is live. */
export const CHAT_LINK_POLL_MS = 4000;

export type ChatLinkView = 'unavailable' | 'linked' | 'claimed' | 'codeLive' | 'codeHidden' | 'unlinked';

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function parseChatLink(entry: unknown): ChatLinkLink | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const row = entry as Record<string, unknown>;
  const linkedAt = asString(row.linkedAt);
  const last4 = asString(row.externalIdLast4);
  if (row.channel !== 'discord' || !linkedAt || !last4) {
    return null;
  }
  return { channel: 'discord', linkedAt, lastUsedAt: asString(row.lastUsedAt), externalIdLast4: last4 };
}

export function parseChatPending(entry: unknown): ChatLinkPending | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const row = entry as Record<string, unknown>;
  const expiresAt = asString(row.expiresAt);
  if (row.channel !== 'discord' || typeof row.claimed !== 'boolean' || !expiresAt) {
    return null;
  }
  return {
    channel: 'discord',
    claimed: row.claimed,
    expiresAt,
    claimedAt: asString(row.claimedAt),
    displayName: asString(row.displayName),
    externalIdLast4: asString(row.externalIdLast4),
  };
}

/** Keeps only the public fields. Returns null when the payload is not the expected shape. */
export function parseChatLinks(payload: unknown): ChatLinksState | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const row = payload as Record<string, unknown>;
  if (typeof row.enabled !== 'boolean' || typeof row.paused !== 'boolean') {
    return null;
  }
  const discord = row.discord;
  if (!discord || typeof discord !== 'object') {
    return null;
  }
  const inner = discord as Record<string, unknown>;
  const link = inner.link == null ? null : parseChatLink(inner.link);
  const pending = inner.pending == null ? null : parseChatPending(inner.pending);
  if ((inner.link != null && !link) || (inner.pending != null && !pending)) {
    return null;
  }
  return { enabled: row.enabled, paused: row.paused, link, pending };
}

export function isExpired(expiresAt: string, now: number): boolean {
  const parsed = Date.parse(expiresAt);
  return Number.isNaN(parsed) || parsed <= now;
}

/** A code held in memory only is live until it expires. */
export function isCodeLive(code: { expiresAt: string } | null, now: number): boolean {
  return code !== null && !isExpired(code.expiresAt, now);
}

export function deriveChatView(
  state: ChatLinksState | null,
  hasLiveCode: boolean,
  now: number,
): ChatLinkView {
  if (!state || !state.enabled) {
    return 'unavailable';
  }
  if (state.link) {
    return 'linked';
  }
  const pending = state.pending;
  if (pending && !isExpired(pending.expiresAt, now)) {
    if (pending.claimed) {
      return 'claimed';
    }
    return hasLiveCode ? 'codeLive' : 'codeHidden';
  }
  return 'unlinked';
}

/** Poll only while an unexpired code exists, the owner is not linked and the page is visible. */
export function shouldPoll(state: ChatLinksState | null, hidden: boolean, now: number): boolean {
  if (hidden || !state || !state.enabled || state.link || !state.pending) {
    return false;
  }
  return !isExpired(state.pending.expiresAt, now);
}

/** Create code stays off until the data statement is ticked and nothing else is running. */
export function canCreateCode(ticked: boolean, busy: boolean, paused: boolean): boolean {
  return ticked && !busy && !paused;
}

/** XXXX-XXXX for display; anything else is shown as received. */
export function formatLinkCode(raw: string): string {
  const compact = raw.replace(/[\s-]/g, '').toUpperCase();
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  }
  return raw.toUpperCase();
}

export const CHAT_ERROR_KEYS: Record<string, string> = {
  chat_link_paused: 'chat.errors.paused',
  chat_link_rate_limited: 'chat.errors.rateLimited',
  chat_link_taken: 'chat.errors.taken',
  chat_link_exists: 'chat.errors.exists',
  chat_link_no_pending_claim: 'chat.errors.noPending',
  chat_link_unavailable: 'chat.errors.unavailable',
};

/** Maps a server error code to a catalog key; the page never shows raw server text. */
export function chatErrorKey(code: string | null, fallbackKey = 'chat.errors.generic'): string {
  if (code && Object.prototype.hasOwnProperty.call(CHAT_ERROR_KEYS, code)) {
    return CHAT_ERROR_KEYS[code];
  }
  return fallbackKey;
}

export function retryMinutes(retryAfterSeconds: number | null): number {
  if (retryAfterSeconds === null || !Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(retryAfterSeconds / 60));
}

export function pickChatLocale(locale: string): 'en' | 'zh-TW' | 'zh-CN' | undefined {
  return locale === 'en' || locale === 'zh-TW' || locale === 'zh-CN' ? locale : undefined;
}
