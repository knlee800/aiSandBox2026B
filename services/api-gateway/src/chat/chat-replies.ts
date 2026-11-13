import en from '../../locales/en.json';
import zhCN from '../../locales/zh-CN.json';
import zhTW from '../../locales/zh-TW.json';
import { CHAT_LINK_LOCALES, ChatLinkLocale } from './chat-link.service';

/**
 * CHAT-DISCORD-01 slice B (stage-start section 8): the bot's own text.
 *
 * Replies and command names come from the gateway's locale files
 * (services/api-gateway/locales/{en,zh-TW,zh-CN}.json, key "chat"). The files
 * are imported, so tsc copies them next to the build and nothing is read from
 * disk at run time. A key missing in zh-TW or zh-CN falls back to en; a spec
 * asserts every key exists in all three files.
 *
 * Interpolation fills {{name}} only with values the caller passes, and callers
 * pass only the bot's own fixed text (a language name, "switched on"). Text
 * from Discord is never put into a reply.
 */

export const CHAT_REPLY_KEYS = [
  'help',
  'notAvailable',
  'useDirectMessage',
  'unknownCommand',
  'error',
  'linkFirst',
  'notEntitled',
  'link.claimed',
  'link.invalid',
  'link.alreadyLinked',
  'link.paused',
  'unlink.done',
  'status.summary',
  'status.runsOn',
  'status.runsOff',
  'language.set',
  'ask.runsOff',
  'ask.notBuilt',
] as const;

export type ChatReplyKey = (typeof CHAT_REPLY_KEYS)[number];

type LocaleTree = { [key: string]: string | LocaleTree };

const CHAT_LOCALE_FILES: Readonly<Record<ChatLinkLocale, LocaleTree>> = {
  en: en as unknown as LocaleTree,
  'zh-TW': zhTW as unknown as LocaleTree,
  'zh-CN': zhCN as unknown as LocaleTree,
};

function lookup(tree: LocaleTree, path: string): string | undefined {
  let node: string | LocaleTree | undefined = tree;
  for (const part of path.split('.')) {
    if (node === undefined || typeof node === 'string') {
      return undefined;
    }
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function isChatLocale(value: unknown): value is ChatLinkLocale {
  return typeof value === 'string' && (CHAT_LINK_LOCALES as readonly string[]).includes(value);
}

/** The text at chat.<path> in that locale, or undefined. No fallback. */
export function chatLocaleText(locale: ChatLinkLocale, path: string): string | undefined {
  return lookup(CHAT_LOCALE_FILES[locale], `chat.${path}`);
}

function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : whole,
  );
}

/** A reply in that locale, falling back to en. */
export function chatReply(
  locale: ChatLinkLocale,
  key: ChatReplyKey,
  values: Readonly<Record<string, string>> = {},
): string {
  const safeLocale = isChatLocale(locale) ? locale : 'en';
  const template =
    chatLocaleText(safeLocale, `replies.${key}`) ?? chatLocaleText('en', `replies.${key}`) ?? key;
  return fill(template, values);
}

/** The name of a reply language as the bot writes it. */
export function chatLanguageName(locale: ChatLinkLocale): string {
  const safeLocale = isChatLocale(locale) ? locale : 'en';
  return (
    chatLocaleText(safeLocale, `languageNames.${safeLocale}`) ??
    chatLocaleText('en', `languageNames.${safeLocale}`) ??
    safeLocale
  );
}

/** Every reply, language-name and command text path under "chat" in en.json (for the three-file spec). */
export function chatLocalePaths(): string[] {
  const paths: string[] = [];
  const walk = (node: LocaleTree, prefix: string): void => {
    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'string') {
        paths.push(path);
      } else {
        walk(value, path);
      }
    }
  };
  const chat = CHAT_LOCALE_FILES.en.chat;
  if (chat && typeof chat !== 'string') {
    walk(chat, '');
  }
  return paths;
}
