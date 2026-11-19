import type { ChatLinkLocale } from './chat-link.service';
import { chatMailText } from './chat-replies';

/**
 * CHAT-LINK-NOTICE-01: the e-mail to the owner when a Discord account is
 * linked to or unlinked from their platform account (a takeover signal).
 *
 * In the link's language (en, zh-TW, zh-CN; text from the gateway locale
 * files, key chat.mail): what happened, the last four digits of the Discord
 * id, the time in UTC to the minute, a link to the Connections page, and what
 * to do if it was not the owner. Never the Discord display name, the full id,
 * a link code or any token. Plain html like the auth e-mails, every
 * interpolated value escaped, plus a text version.
 */

export type ChatLinkMailEvent = 'linked' | 'unlinked';

export interface ChatLinkMailInput {
  readonly event: ChatLinkMailEvent;
  readonly locale: ChatLinkLocale;
  /** The last four characters of the outside user id (the caller passes nothing longer). */
  readonly externalIdLast4: string;
  /** When the link was made or removed. */
  readonly at: Date;
  /** APP_BASE_URL, for example https://ainow.biz (a trailing slash is dropped). */
  readonly appBaseUrl: string;
}

export interface ChatLinkMail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/** "2026-11-19 10:05 UTC": ISO date and time to the minute, always UTC. */
export function formatChatLinkMailTime(at: Date): string {
  const iso = at.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** `${APP_BASE_URL}/<locale>/connections`. */
export function chatLinkConnectionsUrl(appBaseUrl: string, locale: ChatLinkLocale): string {
  return `${appBaseUrl.trim().replace(/\/+$/, '')}/${locale}/connections`;
}

/** Escapes text for html element content and double-quoted attribute values. */
export function escapeChatMailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildChatLinkMail(input: ChatLinkMailInput): ChatLinkMail {
  const { event, locale } = input;
  // Defence in depth: never more than four characters of the id, whatever the caller passes.
  const last4 = String(input.externalIdLast4).slice(-4);
  const values = { last4, time: formatChatLinkMailTime(input.at) };
  const subject = chatMailText(locale, `${event}.subject`);
  const body = chatMailText(locale, `${event}.body`, values);
  const warning = chatMailText(locale, `${event}.warning`);
  const linkLabel = chatMailText(locale, 'openConnections');
  const url = chatLinkConnectionsUrl(input.appBaseUrl, locale);
  const html =
    `<p>${escapeChatMailHtml(body)}</p>` +
    `<p><a href="${escapeChatMailHtml(url)}">${escapeChatMailHtml(linkLabel)}</a></p>` +
    `<p>${escapeChatMailHtml(warning)}</p>`;
  const text = `${body}\n\n${linkLabel}: ${url}\n\n${warning}`;
  return { subject, html, text };
}
