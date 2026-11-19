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
  /** CHAT-USER-INSTALL-01: adds the bot to the owner's own Discord apps; null hides the button. */
  installUrl: string | null;
  /** CHAT-USER-INSTALL-01: the bot's Discord profile (Message opens its direct message); null hides the link. */
  botProfileUrl: string | null;
}

export const UNAVAILABLE_CHAT_STATE: ChatLinksState = {
  enabled: false,
  paused: false,
  link: null,
  pending: null,
  installUrl: null,
  botProfileUrl: null,
};

/** The five linking steps shown while not linked (CHAT-USER-INSTALL-01). */
export const CHAT_SETUP_STEPS = ['install', 'open', 'create', 'link', 'confirm'] as const;
export type ChatSetupStep = (typeof CHAT_SETUP_STEPS)[number];

const DISCORD_INSTALL_PREFIX = 'https://discord.com/oauth2/authorize?';
const DISCORD_BOT_PROFILE = /^https:\/\/discord\.com\/users\/[0-9]{1,32}$/;

/**
 * Keeps the install link only when it is Discord's own authorize page over https
 * (never another host or a script URL); anything else is null and hides the button.
 */
export function parseInstallUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith(DISCORD_INSTALL_PREFIX) || value.length > 512) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.host !== 'discord.com' || url.pathname !== '/oauth2/authorize') {
      return null;
    }
    return /^[0-9]{1,32}$/.test(url.searchParams.get('client_id') ?? '') ? value : null;
  } catch {
    return null;
  }
}

/** Keeps the bot profile link only when it is https://discord.com/users/<digits>. */
export function parseBotProfileUrl(value: unknown): string | null {
  return typeof value === 'string' && DISCORD_BOT_PROFILE.test(value) ? value : null;
}

/** The step the owner is on: the code is live (4) or claimed (5); none before a code exists. */
export function currentChatStep(view: ChatLinkView): ChatSetupStep | null {
  if (view === 'codeLive' || view === 'codeHidden') {
    return 'link';
  }
  if (view === 'claimed') {
    return 'confirm';
  }
  return null;
}

/** The steps show while linking is possible and the owner is not linked yet. */
export function showsChatSteps(view: ChatLinkView): boolean {
  return view === 'unlinked' || view === 'codeLive' || view === 'codeHidden' || view === 'claimed';
}

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
  return {
    enabled: row.enabled,
    paused: row.paused,
    link,
    pending,
    installUrl: parseInstallUrl(inner.installUrl),
    botProfileUrl: parseBotProfileUrl(inner.botProfileUrl),
  };
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

/** CHAT-LINK-NOTICE-01: the "was this you?" notice shows while the link is younger than 7 days. */
export const CHAT_RECENT_LINK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * True while the link is younger than 7 days (a takeover signal); false without a link or a readable date.
 * CHAT-TIDY-01: false right after the owner pressed Confirm on this page (justConfirmed): then only the
 * green "Discord is linked." line shows; the notice shows on later views.
 */
export function showsRecentLinkNotice(link: ChatLinkLink | null, now: number, justConfirmed = false): boolean {
  if (!link || justConfirmed) {
    return false;
  }
  const linkedAt = Date.parse(link.linkedAt);
  if (Number.isNaN(linkedAt)) {
    return false;
  }
  return now - linkedAt < CHAT_RECENT_LINK_MS;
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
