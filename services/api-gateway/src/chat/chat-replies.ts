import en from '../../locales/en.json';
import zhCN from '../../locales/zh-CN.json';
import zhTW from '../../locales/zh-TW.json';
import { CHAT_LINK_LOCALES, ChatLinkLocale } from './chat-link.service';

/**
 * CHAT-DISCORD-01 slices B, C1 and C2 (stage-start section 8): the bot's own text.
 *
 * Replies and command names come from the gateway's locale files
 * (services/api-gateway/locales/{en,zh-TW,zh-CN}.json, key "chat"). The files
 * are imported, so tsc copies them next to the build and nothing is read from
 * disk at run time. A key missing in zh-TW or zh-CN falls back to en; a spec
 * asserts every key exists in all three files.
 *
 * Interpolation fills {{name}} only with values the caller passes, and callers
 * pass only the bot's own fixed text (a language name, "switched on"). Text
 * from Discord is never put into a reply. CHAT-LINK-NOTICE-01: the link
 * e-mail (chatMailText) fills only the last four digits of the outside id
 * and a time the server formats.
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
  // CHAT-LINK-NOTICE-01: the one message after Confirm on the page.
  'link.confirmed',
  'unlink.done',
  'status.summary',
  'status.runsOn',
  'status.runsOff',
  'language.set',
  'ask.runsOff',
  // Slice C1: runs, /cancel and results.
  'ask.started',
  'ask.badTask',
  'ask.unknownAgent',
  'ask.ambiguousAgent',
  'ask.noAgents',
  'ask.tooMany',
  'ask.tooManyRuns',
  'ask.providerOff',
  'ask.noCredits',
  'ask.overCap',
  'ask.workflowOff',
  'ask.workflowNotTested',
  'ask.workflowInvalid',
  'ask.workflowBudget',
  'ask.refused',
  'status.runCounts',
  'cancel.done',
  'cancel.nothing',
  'result.cut',
  'result.noAnswer',
  'result.failed',
  'result.timedOut',
  'result.cancelled',
  'result.waitingApproval',
  // Slice C2: approvals in Discord for read-only steps.
  'approval.request',
  'approval.approveButton',
  'approval.rejectButton',
  'approval.approved',
  'approval.rejected',
  'approval.unavailable',
  'approval.notReadOnly',
  'approval.testsBlocked',
  'approval.runsOff',
  'approval.providerOff',
  'approval.noCredits',
  'approval.overCap',
  'approval.workflow',
  'approval.refused',
  // CHAT-TIDY-01: the reject form and the reason stored when none is typed.
  'approval.rejectFormTitle',
  'approval.rejectReasonLabel',
  'approval.rejectDefaultReason',
  // CHAT-DISCORD-DM-01: plain direct messages that start nothing.
  'message.textOnly',
  'message.useSlashMenu',
  'message.tooLong',
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

/**
 * CHAT-LINK-NOTICE-01: the e-mail to the owner when a Discord account is
 * linked or unlinked (chat.mail in the gateway locale files).
 */
export const CHAT_MAIL_KEYS = [
  'linked.subject',
  'linked.body',
  'linked.warning',
  'unlinked.subject',
  'unlinked.body',
  'unlinked.warning',
  'openConnections',
] as const;

export type ChatMailKey = (typeof CHAT_MAIL_KEYS)[number];

/** A link-notice e-mail text in that locale, falling back to en; {{name}} filled only with the values passed. */
export function chatMailText(
  locale: ChatLinkLocale,
  key: ChatMailKey,
  values: Readonly<Record<string, string>> = {},
): string {
  const safeLocale = isChatLocale(locale) ? locale : 'en';
  const template = chatLocaleText(safeLocale, `mail.${key}`) ?? chatLocaleText('en', `mail.${key}`) ?? key;
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

/** Agent ids with their own name under chat.agentNames; anything else is "an agent" (agentNames.other). */
const CHAT_AGENT_NAME_IDS: readonly string[] = ['chief-of-staff', 'product-strategy', 'technology-advisor'];

/** Slice C2: the name of a system agent as the bot writes it in that locale, or "an agent". */
export function chatAgentName(locale: ChatLinkLocale, agentId: string): string {
  const safeLocale = isChatLocale(locale) ? locale : 'en';
  const key = CHAT_AGENT_NAME_IDS.includes(agentId) ? agentId : 'other';
  return (
    chatLocaleText(safeLocale, `agentNames.${key}`) ?? chatLocaleText('en', `agentNames.${key}`) ?? 'an agent'
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
