import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * PREVIEW-ORIGIN-01: signed, short-lived values for the preview host.
 *
 * - A ticket (kind 't', 60 seconds, single use) is minted on the platform
 *   host after the session cookie and ownership checks, and carried to the
 *   preview host in the enter URL. It names the proxy path to open.
 * - An access value (kind 'c', 12 hours) is the aisandbox_preview cookie the
 *   preview host sets in enter and checks on every proxy request.
 *
 * Both are bound to one session id and one user id and signed with
 * HMAC-SHA256 under a 32-byte key made from random bytes when the gateway
 * starts. The key is kept in memory only: no new secret, nothing in env
 * files. A gateway restart only means the next Refresh mints a new ticket.
 *
 * Format: base64url(JSON payload) "." base64url(HMAC). Neither the key nor
 * a ticket or cookie value is ever logged.
 */

export const PREVIEW_TICKET_TTL_MS = 60 * 1000;
export const PREVIEW_ACCESS_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_TOKEN_LENGTH = 4096;
const MAX_TARGET_LENGTH = 2048;
const MAX_USER_ID_LENGTH = 256;
const MAC_DOMAIN = 'aisb-preview-v1|';
const BASE64URL = /^[A-Za-z0-9_-]+$/;
/** The same session id shape as resolvePreviewForward. */
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

type Kind = 't' | 'c';

type Payload = {
  v: 1;
  k: Kind;
  s: string;
  u: string;
  e: number;
  n: string;
  p?: string;
};

export type PreviewTicketClaims = {
  sessionId: string;
  userId: string;
  /** The proxy suffix and query to open, for example 'proxy?refresh=3'. */
  target: string;
  nonce: string;
  expiresAt: number;
};

export type PreviewAccessClaims = {
  sessionId: string;
  userId: string;
  expiresAt: number;
};

export type PreviewTicketsOptions = {
  key?: Buffer;
  now?: () => number;
};

export class PreviewTickets {
  private readonly key: Buffer;
  private readonly now: () => number;
  /** Nonces of tickets already used, with their expiry (single use). */
  private readonly usedTicketNonces = new Map<string, number>();

  constructor(options: PreviewTicketsOptions = {}) {
    this.key = options.key ?? randomBytes(32);
    if (this.key.length < 32) {
      throw new Error('Preview ticket key must be at least 32 bytes');
    }
    this.now = options.now ?? Date.now;
  }

  /** Ticket for the enter URL; null when an input is out of shape. */
  issueTicket(sessionId: string, userId: string, target: string): string | null {
    if (!validSessionId(sessionId) || !validUserId(userId)) return null;
    if (typeof target !== 'string' || !isProxyTarget(target) || target.length > MAX_TARGET_LENGTH) {
      return null;
    }
    return this.sign({
      v: 1,
      k: 't',
      s: sessionId,
      u: userId,
      e: this.now() + PREVIEW_TICKET_TTL_MS,
      n: randomBytes(16).toString('base64url'),
      p: target,
    });
  }

  /** Value for the aisandbox_preview cookie; null when an input is out of shape. */
  issueAccess(sessionId: string, userId: string): string | null {
    if (!validSessionId(sessionId) || !validUserId(userId)) return null;
    return this.sign({
      v: 1,
      k: 'c',
      s: sessionId,
      u: userId,
      e: this.now() + PREVIEW_ACCESS_TTL_MS,
      n: randomBytes(16).toString('base64url'),
    });
  }

  /** Checks a ticket for this session. Does not mark it used. */
  verifyTicket(token: unknown, sessionId: string): PreviewTicketClaims | null {
    const payload = this.verify(token, 't', sessionId, PREVIEW_TICKET_TTL_MS);
    if (!payload || typeof payload.p !== 'string' || !isProxyTarget(payload.p)) return null;
    if (payload.p.length > MAX_TARGET_LENGTH) return null;
    if (this.usedTicketNonces.has(payload.n)) return null;
    return {
      sessionId: payload.s,
      userId: payload.u,
      target: payload.p,
      nonce: payload.n,
      expiresAt: payload.e,
    };
  }

  /** Marks a verified ticket used; false if it was already used. */
  consumeTicket(claims: PreviewTicketClaims): boolean {
    const now = this.now();
    for (const [nonce, expiresAt] of this.usedTicketNonces) {
      if (expiresAt <= now) this.usedTicketNonces.delete(nonce);
    }
    if (this.usedTicketNonces.has(claims.nonce)) return false;
    this.usedTicketNonces.set(claims.nonce, claims.expiresAt);
    return true;
  }

  /** Checks an aisandbox_preview cookie value for this session. */
  verifyAccess(token: unknown, sessionId: string): PreviewAccessClaims | null {
    const payload = this.verify(token, 'c', sessionId, PREVIEW_ACCESS_TTL_MS);
    if (!payload) return null;
    return { sessionId: payload.s, userId: payload.u, expiresAt: payload.e };
  }

  private mac(body: string): Buffer {
    return createHmac('sha256', this.key).update(MAC_DOMAIN).update(body).digest();
  }

  private sign(payload: Payload): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${body}.${this.mac(body).toString('base64url')}`;
  }

  private verify(token: unknown, kind: Kind, sessionId: string, ttlMs: number): Payload | null {
    if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
      return null;
    }
    if (!validSessionId(sessionId)) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, macText] = parts;
    if (!BASE64URL.test(body) || !BASE64URL.test(macText)) return null;

    const expected = this.mac(body);
    const given = Buffer.from(macText, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    // Only the canonical encoding: no second spelling of one signature.
    if (given.toString('base64url') !== macText) return null;

    let payload: Payload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Payload;
    } catch {
      return null;
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    if (payload.v !== 1 || payload.k !== kind) return null;
    if (payload.s !== sessionId) return null;
    if (!validUserId(payload.u)) return null;
    if (typeof payload.n !== 'string' || payload.n.length < 16 || payload.n.length > 64) return null;
    if (typeof payload.e !== 'number' || !Number.isFinite(payload.e)) return null;
    const now = this.now();
    if (payload.e <= now || payload.e - now > ttlMs) return null;
    return payload;
  }
}

function validSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID.test(value);
}

function validUserId(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_USER_ID_LENGTH
  );
}

/** 'proxy', 'proxy?…', 'proxy/…': no scheme, no host, no fragment, no control characters. */
function isProxyTarget(value: string): boolean {
  if (!/^proxy(?:[/?]|$)/.test(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    // Control characters, space, DEL, '#' (a fragment) and '\'.
    if (code <= 0x20 || code === 0x7f || code === 0x23 || code === 0x5c) return false;
  }
  return true;
}

let processPreviewTickets: PreviewTickets | null = null;

/** One signer per gateway process, so every controller and guard shares the key. */
export function getProcessPreviewTickets(): PreviewTickets {
  if (!processPreviewTickets) {
    processPreviewTickets = new PreviewTickets();
  }
  return processPreviewTickets;
}
