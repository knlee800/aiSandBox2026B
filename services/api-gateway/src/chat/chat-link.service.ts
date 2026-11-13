import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { EntityManager, IsNull, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ChatLink } from '../entities/chat-link.entity';
import { ChatLinkCode } from '../entities/chat-link-code.entity';
import { isChatDiscordEnabled } from './chat-switch';

/**
 * CHAT-DISCORD-01 slice A1 (stage-start section 5): the account link.
 *
 * The platform makes a one-time code for the signed-in owner; the owner types
 * it in Discord (claim, called by the Discord command from slice B); the owner
 * then confirms on the platform. A claim alone links nothing.
 *
 * - Code: 8 characters from a 32-character alphabet without look-alikes
 *   (no I, O, 0 or 1; 40 bits), made with crypto.randomBytes, returned once as
 *   XXXX-XXXX. Only its SHA-256 hex is stored. 10 minutes, single use; one live
 *   code per owner per channel, a new one replaces the old.
 * - Claim: the same answer for a wrong, used, expired or replaced code.
 * - Limits (in memory; one gateway process): 5 code creations per owner per
 *   hour; 5 claim attempts per outside user per hour, then silence; more than
 *   100 failed claims platform-wide in an hour pauses linking for an hour and
 *   writes one audit row.
 * - One outside account per owner per channel, one owner per outside account
 *   (two unique indexes; checked here first).
 * - Audit rows (category chat) hold ids, reason codes and counts only: never
 *   the outside user id, the display name, the code or its hash.
 * - Logs hold event names and ids only: never the code, its hash, the outside
 *   user id or the display name.
 * - CHAT_DISCORD_ENABLED off: every write is refused with chat_link_unavailable
 *   and nothing is read or written; the state read answers enabled false.
 */

export const CHAT_CHANNEL_DISCORD = 'discord';
export type ChatChannel = typeof CHAT_CHANNEL_DISCORD;

export const CHAT_AUDIT_CATEGORY = 'chat';

/** 8 digits and 24 letters: no I, O, 0 or 1. 256 / 32 = 8, so byte & 31 is uniform. */
export const CHAT_LINK_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CHAT_LINK_CODE_LENGTH = 8;
export const CHAT_LINK_CODE_TTL_MS = 10 * 60 * 1000;
export const CHAT_LINK_DISPLAY_NAME_MAX = 64;

export const CHAT_LINK_LIMITS = {
  windowMs: 60 * 60 * 1000,
  codesPerOwner: 5,
  claimsPerExternalUser: 5,
  failedClaimsBeforePause: 100,
  pauseMs: 60 * 60 * 1000,
} as const;

export const CHAT_LINK_LOCALES = ['en', 'zh-TW', 'zh-CN'] as const;
export type ChatLinkLocale = (typeof CHAT_LINK_LOCALES)[number];

export const CHAT_LINK_ERROR_CODES = {
  unavailable: 'chat_link_unavailable',
  paused: 'chat_link_paused',
  rateLimited: 'chat_link_rate_limited',
  exists: 'chat_link_exists',
  taken: 'chat_link_taken',
  noPendingClaim: 'chat_link_no_pending_claim',
} as const;

export const CHAT_LINK_MESSAGES = {
  unavailable: 'Chat linking is not available',
  paused: 'Chat linking is paused, try again later',
  rateLimited: 'Too many link codes, try again later',
  exists: 'A Discord account is already linked',
  taken: 'That Discord account is already linked',
  noPendingClaim: 'No link request is waiting for confirmation',
} as const;

export const CHAT_AUDIT_EVENTS = {
  codeCreated: 'link_code_created',
  claimed: 'link_claimed',
  confirmed: 'link_confirmed',
  cancelled: 'link_cancelled',
  removed: 'link_removed',
  attemptsPaused: 'link_attempts_paused',
} as const;

/**
 * claimed: the code is now claimed; the owner must confirm on the platform.
 * invalid: wrong, used, expired or replaced code (one answer for all four).
 * already_linked: this outside account is already linked (unlink first).
 * silenced: over 5 attempts this hour; the bot answers nothing.
 * paused: linking is paused platform-wide.
 * unavailable: CHAT_DISCORD_ENABLED is off.
 */
export type ChatLinkClaimOutcome =
  | 'claimed'
  | 'invalid'
  | 'already_linked'
  | 'silenced'
  | 'paused'
  | 'unavailable';

export interface ChatLinkClaimResult {
  outcome: ChatLinkClaimOutcome;
  /** The language for the bot's answer, from the interaction locale. */
  locale: ChatLinkLocale;
}

export interface ChatLinkView {
  channel: ChatChannel;
  linkedAt: string;
  lastUsedAt: string | null;
  externalIdLast4: string;
}

export type ChatLinkPendingView =
  | { channel: ChatChannel; claimed: false; expiresAt: string }
  | {
      channel: ChatChannel;
      claimed: true;
      expiresAt: string;
      claimedAt: string;
      displayName: string | null;
      externalIdLast4: string;
    };

export interface ChatLinkState {
  enabled: boolean;
  paused: boolean;
  discord: {
    link: ChatLinkView | null;
    pending: ChatLinkPendingView | null;
  };
}

export interface ChatLinkCodeCreated {
  channel: ChatChannel;
  code: string;
  expiresAt: string;
}

export interface ChatLinkCancelled {
  channel: ChatChannel;
  cancelled: boolean;
}

export interface ChatLinkRemoved {
  channel: ChatChannel;
  removed: boolean;
}

/** Slice B: what a chat command needs from the link. Never holds the outside user id. */
export interface ChatLinkUse {
  linkId: string;
  userId: string;
  locale: ChatLinkLocale;
}

/**
 * Maps a page or Discord interaction locale to the three reply languages
 * (stage-start section 8): en-US, en-GB and other en-* to en; zh-TW; zh-CN;
 * anything else en.
 */
export function normalizeChatLocale(value: unknown): ChatLinkLocale {
  if (typeof value !== 'string') {
    return 'en';
  }
  const trimmed = value.trim();
  if (trimmed === 'zh-TW' || trimmed === 'zh-CN') {
    return trimmed;
  }
  return 'en';
}

/** Upper case, without spaces and dashes; null unless exactly 8 alphabet characters. */
export function normalizeChatLinkCode(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 64) {
    return null;
  }
  const compact = value.replace(/[\s-]/g, '').toUpperCase();
  if (compact.length !== CHAT_LINK_CODE_LENGTH) {
    return null;
  }
  for (const char of compact) {
    if (!CHAT_LINK_CODE_ALPHABET.includes(char)) {
      return null;
    }
  }
  return compact;
}

export function hashChatLinkCode(normalizedCode: string): string {
  return createHash('sha256').update(normalizedCode).digest('hex');
}

export function generateChatLinkCode(): string {
  const bytes = randomBytes(CHAT_LINK_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CHAT_LINK_CODE_LENGTH; i += 1) {
    code += CHAT_LINK_CODE_ALPHABET[bytes[i] & 31];
  }
  return code;
}

export function formatChatLinkCode(normalizedCode: string): string {
  return `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4)}`;
}

const EXTERNAL_USER_ID_PATTERN = /^[0-9]{1,32}$/;

function isExternalUserId(value: unknown): value is string {
  return typeof value === 'string' && EXTERNAL_USER_ID_PATTERN.test(value);
}

function isInvisibleCodePoint(codePoint: number): boolean {
  return (
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    (codePoint >= 0x200b && codePoint <= 0x200f) ||
    (codePoint >= 0x2028 && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069)
  );
}

function sanitizeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  // varchar(64) counts characters, so cut by code point, not by UTF-16 unit.
  const cleaned = Array.from(value)
    .filter((char) => !isInvisibleCodePoint(char.codePointAt(0) ?? 0))
    .join('')
    .trim();
  if (cleaned.length === 0) {
    return null;
  }
  return Array.from(cleaned).slice(0, CHAT_LINK_DISPLAY_NAME_MAX).join('');
}

function last4(externalUserId: string): string {
  return externalUserId.slice(-4);
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: unknown; driverError?: { code?: unknown } } | null;
  return candidate?.code === '23505' || candidate?.driverError?.code === '23505';
}

/** Sliding one-hour counters keyed by owner id or outside user id. Memory only. */
class WindowCounter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly windowMs: number) {}

  count(key: string, now: number): number {
    this.prune(now);
    return this.hits.get(key)?.length ?? 0;
  }

  add(key: string, now: number): void {
    const list = this.hits.get(key) ?? [];
    list.push(now);
    this.hits.set(key, list);
  }

  retryAfterSeconds(key: string, now: number): number {
    const oldest = this.hits.get(key)?.[0];
    if (oldest === undefined) {
      return 0;
    }
    return Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
  }

  private prune(now: number): void {
    for (const [key, list] of this.hits) {
      const kept = list.filter((at) => at > now - this.windowMs);
      if (kept.length === 0) {
        this.hits.delete(key);
      } else if (kept.length !== list.length) {
        this.hits.set(key, kept);
      }
    }
  }
}

function chatLinkError(
  status: HttpStatus,
  error: string,
  key: keyof typeof CHAT_LINK_ERROR_CODES,
  extra: Record<string, unknown> = {},
): HttpException {
  const body = {
    statusCode: status,
    message: CHAT_LINK_MESSAGES[key],
    error,
    code: CHAT_LINK_ERROR_CODES[key],
    ...extra,
  };
  switch (status) {
    case HttpStatus.SERVICE_UNAVAILABLE:
      return new ServiceUnavailableException(body);
    case HttpStatus.CONFLICT:
      return new ConflictException(body);
    case HttpStatus.NOT_FOUND:
      return new NotFoundException(body);
    default:
      return new HttpException(body, status);
  }
}

@Injectable()
export class ChatLinkService {
  private readonly logger = new Logger(ChatLinkService.name);
  private readonly codeCreations = new WindowCounter(CHAT_LINK_LIMITS.windowMs);
  private readonly claimAttempts = new WindowCounter(CHAT_LINK_LIMITS.windowMs);
  private failedClaims: number[] = [];
  private pausedUntil = 0;

  constructor(
    @InjectRepository(ChatLink)
    private readonly links: Repository<ChatLink>,
    @InjectRepository(ChatLinkCode)
    private readonly codes: Repository<ChatLinkCode>,
  ) {}

  /** GET /api/chat-links. Switch off: nothing is read. */
  async getState(userId: string): Promise<ChatLinkState> {
    if (!isChatDiscordEnabled()) {
      return { enabled: false, paused: false, discord: { link: null, pending: null } };
    }
    const now = Date.now();
    await this.deleteExpiredCodes(now);
    const link = await this.links.findOne({
      where: { userId, channel: CHAT_CHANNEL_DISCORD },
    });
    const live = await this.liveCodesFor(userId, now);
    const latest = live[0];
    let pending: ChatLinkPendingView | null = null;
    if (latest) {
      pending =
        latest.claimedExternalUserId && latest.claimedAt
          ? {
              channel: CHAT_CHANNEL_DISCORD,
              claimed: true,
              expiresAt: latest.expiresAt.toISOString(),
              claimedAt: latest.claimedAt.toISOString(),
              displayName: latest.claimedDisplayName ?? null,
              externalIdLast4: last4(latest.claimedExternalUserId),
            }
          : { channel: CHAT_CHANNEL_DISCORD, claimed: false, expiresAt: latest.expiresAt.toISOString() };
    }
    return {
      enabled: true,
      paused: this.isPaused(now),
      discord: { link: link ? this.linkView(link) : null, pending },
    };
  }

  /** POST /api/chat-links/discord/code. The code is in this answer only. */
  async createCode(userId: string, locale: unknown): Promise<ChatLinkCodeCreated> {
    this.assertEnabled();
    const now = Date.now();
    if (this.isPaused(now)) {
      throw chatLinkError(HttpStatus.SERVICE_UNAVAILABLE, 'Service Unavailable', 'paused');
    }
    const existing = await this.links.findOne({
      where: { userId, channel: CHAT_CHANNEL_DISCORD },
    });
    if (existing) {
      throw chatLinkError(HttpStatus.CONFLICT, 'Conflict', 'exists');
    }
    if (this.codeCreations.count(userId, now) >= CHAT_LINK_LIMITS.codesPerOwner) {
      throw chatLinkError(HttpStatus.TOO_MANY_REQUESTS, 'Too Many Requests', 'rateLimited', {
        retryAfterSeconds: this.codeCreations.retryAfterSeconds(userId, now),
      });
    }
    this.codeCreations.add(userId, now);
    await this.deleteExpiredCodes(now);

    const expiresAt = new Date(now + CHAT_LINK_CODE_TTL_MS);
    const normalizedLocale = normalizeChatLocale(locale);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const code = generateChatLinkCode();
      const id = randomUUID();
      try {
        const replaced = await this.codes.manager.transaction(async (manager: EntityManager) => {
          const codes = manager.getRepository(ChatLinkCode);
          const removed = await codes.delete({ userId, channel: CHAT_CHANNEL_DISCORD });
          await codes.insert({
            id,
            userId,
            channel: CHAT_CHANNEL_DISCORD,
            codeHash: hashChatLinkCode(code),
            locale: normalizedLocale,
            expiresAt,
            claimedExternalUserId: null,
            claimedDisplayName: null,
            claimedAt: null,
            createdAt: new Date(now),
          });
          const replacedCodes = removed.affected ?? 0;
          await this.audit(manager, CHAT_AUDIT_EVENTS.codeCreated, 'chat_link_code', id, userId, {
            channel: CHAT_CHANNEL_DISCORD,
            codeId: id,
            replacedCodes,
          });
          return replacedCodes;
        });
        this.logger.log(`chat link code created userId=${userId} codeId=${id} replaced=${replaced}`);
        return {
          channel: CHAT_CHANNEL_DISCORD,
          code: formatChatLinkCode(code),
          expiresAt: expiresAt.toISOString(),
        };
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }
    }
    throw new ServiceUnavailableException(CHAT_LINK_MESSAGES.unavailable);
  }

  /**
   * Called by the Discord /link command (slice B). Marks the code claimed by
   * that outside user. Never links: the owner confirms on the platform.
   */
  async claim(
    code: unknown,
    externalUserId: unknown,
    displayName: unknown,
    locale: unknown,
  ): Promise<ChatLinkClaimResult> {
    const replyLocale = normalizeChatLocale(locale);
    if (!isChatDiscordEnabled()) {
      return { outcome: 'unavailable', locale: replyLocale };
    }
    const now = Date.now();
    if (this.isPaused(now)) {
      return { outcome: 'paused', locale: replyLocale };
    }
    if (typeof externalUserId !== 'string' || !EXTERNAL_USER_ID_PATTERN.test(externalUserId)) {
      return { outcome: 'invalid', locale: replyLocale };
    }
    if (this.claimAttempts.count(externalUserId, now) >= CHAT_LINK_LIMITS.claimsPerExternalUser) {
      return { outcome: 'silenced', locale: replyLocale };
    }
    this.claimAttempts.add(externalUserId, now);

    const linked = await this.links.findOne({
      where: { channel: CHAT_CHANNEL_DISCORD, externalUserId },
    });
    if (linked) {
      return { outcome: 'already_linked', locale: replyLocale };
    }

    const normalized = normalizeChatLinkCode(code);
    if (normalized === null) {
      return this.failedClaim(now, replyLocale);
    }
    const row = await this.codes.findOne({
      where: { codeHash: hashChatLinkCode(normalized), channel: CHAT_CHANNEL_DISCORD },
    });
    if (!row || row.claimedExternalUserId !== null || row.expiresAt.getTime() <= now) {
      return this.failedClaim(now, replyLocale);
    }

    const claimedAt = new Date(now);
    const claimed = await this.codes.manager.transaction(async (manager: EntityManager) => {
      const codes = manager.getRepository(ChatLinkCode);
      const result = await codes.update(
        {
          id: row.id,
          claimedExternalUserId: IsNull(),
          expiresAt: MoreThan(claimedAt),
        },
        {
          claimedExternalUserId: externalUserId,
          claimedDisplayName: sanitizeDisplayName(displayName),
          claimedAt,
        },
      );
      if ((result.affected ?? 0) !== 1) {
        return false;
      }
      await this.audit(manager, CHAT_AUDIT_EVENTS.claimed, 'chat_link_code', row.id, row.userId, {
        channel: CHAT_CHANNEL_DISCORD,
        codeId: row.id,
      });
      return true;
    });
    if (!claimed) {
      return this.failedClaim(now, replyLocale);
    }
    this.logger.log(`chat link code claimed userId=${row.userId} codeId=${row.id}`);
    return { outcome: 'claimed', locale: replyLocale };
  }

  /** POST /api/chat-links/discord/confirm: the signed-in owner turns the claim into a link. */
  async confirm(userId: string): Promise<ChatLinkView> {
    this.assertEnabled();
    const now = Date.now();
    if (this.isPaused(now)) {
      throw chatLinkError(HttpStatus.SERVICE_UNAVAILABLE, 'Service Unavailable', 'paused');
    }
    await this.deleteExpiredCodes(now);
    const claim = (await this.liveCodesFor(userId, now)).find(
      (row) => row.claimedExternalUserId !== null && row.claimedAt !== null,
    );
    if (!claim || claim.claimedExternalUserId === null) {
      throw chatLinkError(HttpStatus.NOT_FOUND, 'Not Found', 'noPendingClaim');
    }
    const externalUserId = claim.claimedExternalUserId;
    const ownLink = await this.links.findOne({
      where: { userId, channel: CHAT_CHANNEL_DISCORD },
    });
    if (ownLink) {
      throw chatLinkError(HttpStatus.CONFLICT, 'Conflict', 'exists');
    }
    const otherLink = await this.links.findOne({
      where: { channel: CHAT_CHANNEL_DISCORD, externalUserId },
    });
    if (otherLink) {
      throw chatLinkError(HttpStatus.CONFLICT, 'Conflict', 'taken');
    }

    const link: ChatLink = {
      id: randomUUID(),
      userId,
      channel: CHAT_CHANNEL_DISCORD,
      externalUserId,
      locale: normalizeChatLocale(claim.locale),
      createdAt: new Date(now),
      lastUsedAt: null,
    };
    try {
      await this.links.manager.transaction(async (manager: EntityManager) => {
        await manager.getRepository(ChatLink).insert(link);
        await manager.getRepository(ChatLinkCode).delete({ userId, channel: CHAT_CHANNEL_DISCORD });
        await this.audit(manager, CHAT_AUDIT_EVENTS.confirmed, 'chat_link', link.id, userId, {
          channel: CHAT_CHANNEL_DISCORD,
          linkId: link.id,
          codeId: claim.id,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw chatLinkError(HttpStatus.CONFLICT, 'Conflict', 'taken');
      }
      throw error;
    }
    this.logger.log(`chat link confirmed userId=${userId} linkId=${link.id}`);
    return this.linkView(link);
  }

  /** POST /api/chat-links/discord/cancel: deletes the owner's live code and any claim on it. */
  async cancel(userId: string): Promise<ChatLinkCancelled> {
    this.assertEnabled();
    const removed = await this.codes.manager.transaction(async (manager: EntityManager) => {
      const result = await manager
        .getRepository(ChatLinkCode)
        .delete({ userId, channel: CHAT_CHANNEL_DISCORD });
      const count = result.affected ?? 0;
      if (count > 0) {
        await this.audit(manager, CHAT_AUDIT_EVENTS.cancelled, 'user', userId, userId, {
          channel: CHAT_CHANNEL_DISCORD,
          removedCodes: count,
        });
      }
      return count;
    });
    if (removed > 0) {
      this.logger.log(`chat link cancelled userId=${userId} removedCodes=${removed}`);
    }
    return { channel: CHAT_CHANNEL_DISCORD, cancelled: removed > 0 };
  }

  /** DELETE /api/chat-links/discord: deletes the link and every code of the owner. */
  async unlink(userId: string): Promise<ChatLinkRemoved> {
    this.assertEnabled();
    const result = await this.links.manager.transaction(async (manager: EntityManager) => {
      const links = manager.getRepository(ChatLink);
      const link = await links.findOne({ where: { userId, channel: CHAT_CHANNEL_DISCORD } });
      const codes = await manager
        .getRepository(ChatLinkCode)
        .delete({ userId, channel: CHAT_CHANNEL_DISCORD });
      if (!link) {
        return { linkId: null as string | null, removedCodes: codes.affected ?? 0 };
      }
      await links.delete({ id: link.id });
      await this.audit(manager, CHAT_AUDIT_EVENTS.removed, 'chat_link', link.id, userId, {
        channel: CHAT_CHANNEL_DISCORD,
        linkId: link.id,
        removedCodes: codes.affected ?? 0,
      });
      return { linkId: link.id as string | null, removedCodes: codes.affected ?? 0 };
    });
    if (result.linkId) {
      this.logger.log(`chat link removed userId=${userId} linkId=${result.linkId}`);
    }
    return { channel: CHAT_CHANNEL_DISCORD, removed: result.linkId !== null };
  }

  /**
   * Slice B: the link of an outside user, for a chat command. Updates
   * last_used_at. Switch off, a malformed id or no link: null, and nothing
   * is written.
   */
  async useLinkByExternalUser(channel: ChatChannel, externalUserId: unknown): Promise<ChatLinkUse | null> {
    if (!isChatDiscordEnabled() || !isExternalUserId(externalUserId)) {
      return null;
    }
    const link = await this.links.findOne({ where: { channel, externalUserId } });
    if (!link) {
      return null;
    }
    await this.links.update({ id: link.id }, { lastUsedAt: new Date() });
    return { linkId: link.id, userId: link.userId, locale: normalizeChatLocale(link.locale) };
  }

  /**
   * Slice B: /language stores the reply language on the link and updates
   * last_used_at. False when there is no link (or the switch is off).
   */
  async setLinkLocaleByExternalUser(
    channel: ChatChannel,
    externalUserId: unknown,
    locale: ChatLinkLocale,
  ): Promise<boolean> {
    if (!isChatDiscordEnabled() || !isExternalUserId(externalUserId)) {
      return false;
    }
    if (!(CHAT_LINK_LOCALES as readonly string[]).includes(locale)) {
      return false;
    }
    const result = await this.links.update(
      { channel, externalUserId },
      { locale, lastUsedAt: new Date() },
    );
    return (result.affected ?? 0) === 1;
  }

  /**
   * Slice B: /unlink in the chat. Deletes the link and every code of its
   * owner, like DELETE /api/chat-links/discord, with one link_removed audit
   * row (ids and counts only; source chat_command). Switch off or no link:
   * removed false, nothing written.
   */
  async unlinkByExternalUser(channel: ChatChannel, externalUserId: unknown): Promise<ChatLinkRemoved> {
    if (!isChatDiscordEnabled() || !isExternalUserId(externalUserId)) {
      return { channel, removed: false };
    }
    const result = await this.links.manager.transaction(async (manager: EntityManager) => {
      const links = manager.getRepository(ChatLink);
      const link = await links.findOne({ where: { channel, externalUserId } });
      if (!link) {
        return null;
      }
      const codes = await manager.getRepository(ChatLinkCode).delete({ userId: link.userId, channel });
      await links.delete({ id: link.id });
      const removedCodes = codes.affected ?? 0;
      await this.audit(manager, CHAT_AUDIT_EVENTS.removed, 'chat_link', link.id, link.userId, {
        channel,
        linkId: link.id,
        removedCodes,
        source: 'chat_command',
      });
      return { linkId: link.id, userId: link.userId };
    });
    if (!result) {
      return { channel, removed: false };
    }
    this.logger.log(`chat link removed userId=${result.userId} linkId=${result.linkId} source=chat_command`);
    return { channel, removed: true };
  }

  private assertEnabled(): void {
    if (!isChatDiscordEnabled()) {
      throw chatLinkError(HttpStatus.SERVICE_UNAVAILABLE, 'Service Unavailable', 'unavailable');
    }
  }

  private isPaused(now: number): boolean {
    return now < this.pausedUntil;
  }

  private async failedClaim(now: number, locale: ChatLinkLocale): Promise<ChatLinkClaimResult> {
    this.failedClaims = this.failedClaims.filter((at) => at > now - CHAT_LINK_LIMITS.windowMs);
    this.failedClaims.push(now);
    if (this.failedClaims.length > CHAT_LINK_LIMITS.failedClaimsBeforePause) {
      const failedAttempts = this.failedClaims.length;
      this.failedClaims = [];
      this.pausedUntil = now + CHAT_LINK_LIMITS.pauseMs;
      this.logger.warn(`chat link attempts paused failedAttempts=${failedAttempts}`);
      try {
        await this.audit(this.codes.manager, CHAT_AUDIT_EVENTS.attemptsPaused, 'chat_channel', CHAT_CHANNEL_DISCORD, null, {
          channel: CHAT_CHANNEL_DISCORD,
          failedAttempts,
          windowMinutes: CHAT_LINK_LIMITS.windowMs / 60000,
          pauseMinutes: CHAT_LINK_LIMITS.pauseMs / 60000,
        });
      } catch {
        this.logger.warn('chat link pause audit insert failed');
      }
    }
    return { outcome: 'invalid', locale };
  }

  private async liveCodesFor(userId: string, now: number): Promise<ChatLinkCode[]> {
    const rows = await this.codes.find({
      where: { userId, channel: CHAT_CHANNEL_DISCORD },
      order: { createdAt: 'DESC' },
    });
    return rows.filter((row) => row.expiresAt.getTime() > now);
  }

  private async deleteExpiredCodes(now: number): Promise<void> {
    await this.codes.delete({ expiresAt: LessThanOrEqual(new Date(now)) });
  }

  private linkView(link: ChatLink): ChatLinkView {
    return {
      channel: CHAT_CHANNEL_DISCORD,
      linkedAt: link.createdAt.toISOString(),
      lastUsedAt: link.lastUsedAt ? link.lastUsedAt.toISOString() : null,
      externalIdLast4: last4(link.externalUserId),
    };
  }

  private async audit(
    manager: EntityManager,
    eventType: string,
    subjectType: string,
    subjectId: string,
    userId: string | null,
    payload: Record<string, string | number>,
  ): Promise<void> {
    await manager.getRepository(AuditEventEntity).insert({
      category: CHAT_AUDIT_CATEGORY,
      eventType,
      subjectType,
      subjectId,
      userId,
      payload,
      occurredAt: new Date(),
    });
  }
}
