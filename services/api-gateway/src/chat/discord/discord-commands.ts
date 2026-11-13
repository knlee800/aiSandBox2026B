import { CHAT_LINK_LOCALES, ChatLinkLocale } from '../chat-link.service';
import { chatLanguageName, chatLocaleText } from '../chat-replies';

/**
 * CHAT-DISCORD-01 slice B (stage-start sections 4, 6.1, 8): the slash commands
 * as registered with Discord.
 *
 * - Global commands, usable only in the direct message with the bot
 *   (contexts = [BOT_DM]); installed with the bot into Keith's private server
 *   (integration_types = [GUILD_INSTALL]).
 * - Command and option names are English in every client (no
 *   name_localizations), so /link, /unlink, /status, /language, /help and
 *   /ask match the Connections page and the bot's replies everywhere.
 *   Descriptions come from the gateway locale files; zh-TW and zh-CN go to
 *   Discord as description localizations. The language choices carry the
 *   languages' own names.
 * - Every option is a string. Discord sends the default (English) command and
 *   option names in the interaction whatever the user's client language.
 *
 * Plain numbers stand for the Discord enum values, so this file loads no
 * Discord library; discord-commands.spec.ts checks each number against the
 * library's own enum.
 */

/** ApplicationCommandType.ChatInput */
export const DISCORD_COMMAND_TYPE_CHAT_INPUT = 1;
/** ApplicationCommandOptionType.String */
export const DISCORD_OPTION_TYPE_STRING = 3;
/** InteractionContextType.BotDM */
export const DISCORD_CONTEXT_BOT_DM = 1;
/** ApplicationIntegrationType.GuildInstall */
export const DISCORD_INTEGRATION_GUILD_INSTALL = 0;

/** Discord's option limit is 6000 characters; the platform's task limit is 8000. */
export const CHAT_ASK_TEXT_MAX = 6000;
export const CHAT_ASK_AGENT_MAX = 100;
/** XXXX-XXXX is 9 characters; room for spaces the owner may type. */
export const CHAT_LINK_CODE_OPTION_MAX = 16;

export const CHAT_COMMAND_NAMES = ['link', 'unlink', 'status', 'language', 'help', 'ask'] as const;
export type ChatCommandName = (typeof CHAT_COMMAND_NAMES)[number];

export function isChatCommandName(value: unknown): value is ChatCommandName {
  return typeof value === 'string' && (CHAT_COMMAND_NAMES as readonly string[]).includes(value);
}

export type DiscordLocalizations = Partial<Record<'zh-TW' | 'zh-CN', string>>;

export interface DiscordCommandChoice {
  name: string;
  value: string;
}

export interface DiscordCommandOption {
  type: typeof DISCORD_OPTION_TYPE_STRING;
  name: string;
  description: string;
  description_localizations: DiscordLocalizations;
  required: boolean;
  min_length?: number;
  max_length?: number;
  choices?: DiscordCommandChoice[];
}

export interface DiscordCommandDefinition {
  type: typeof DISCORD_COMMAND_TYPE_CHAT_INPUT;
  name: ChatCommandName;
  description: string;
  description_localizations: DiscordLocalizations;
  contexts: number[];
  integration_types: number[];
  options?: DiscordCommandOption[];
}

interface OptionSpec {
  name: string;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  languageChoices?: boolean;
}

const OPTION_SPECS: Readonly<Record<ChatCommandName, readonly OptionSpec[]>> = {
  link: [{ name: 'code', required: true, minLength: 8, maxLength: CHAT_LINK_CODE_OPTION_MAX }],
  unlink: [],
  status: [],
  language: [{ name: 'language', required: true, languageChoices: true }],
  help: [],
  ask: [
    { name: 'text', required: true, minLength: 1, maxLength: CHAT_ASK_TEXT_MAX },
    { name: 'agent', required: false, minLength: 1, maxLength: CHAT_ASK_AGENT_MAX },
  ],
};

/** The string options a command reads. Anything else in an interaction is ignored. */
export function chatCommandOptionNames(command: ChatCommandName): readonly string[] {
  return OPTION_SPECS[command].map((spec) => spec.name);
}

/** The longest value kept for an option; longer values are cut by the transport. */
export function chatCommandOptionMax(command: ChatCommandName, option: string): number {
  return OPTION_SPECS[command].find((spec) => spec.name === option)?.maxLength ?? CHAT_LINK_CODE_OPTION_MAX;
}

const LOCALIZED: readonly Exclude<ChatLinkLocale, 'en'>[] = ['zh-TW', 'zh-CN'];

function requireText(locale: ChatLinkLocale, path: string): string {
  const text = chatLocaleText(locale, path);
  if (text === undefined || text.length === 0) {
    throw new Error(`missing chat locale text ${locale} ${path}`);
  }
  return text;
}

/** Description localizations only. */
function descriptionLocalizations(path: string): DiscordLocalizations {
  const map: DiscordLocalizations = {};
  for (const locale of LOCALIZED) {
    map[locale] = requireText(locale, path);
  }
  return map;
}

function buildOption(command: ChatCommandName, spec: OptionSpec): DiscordCommandOption {
  const path = `commands.${command}.options.${spec.name}.description`;
  const option: DiscordCommandOption = {
    type: DISCORD_OPTION_TYPE_STRING,
    name: spec.name,
    description: requireText('en', path),
    description_localizations: descriptionLocalizations(path),
    required: spec.required,
  };
  if (spec.minLength !== undefined) option.min_length = spec.minLength;
  if (spec.maxLength !== undefined) option.max_length = spec.maxLength;
  if (spec.languageChoices) {
    option.choices = CHAT_LINK_LOCALES.map((locale) => ({ name: chatLanguageName(locale), value: locale }));
  }
  return option;
}

/** The full command list sent to PUT /applications/{id}/commands. */
export function buildDiscordCommands(): DiscordCommandDefinition[] {
  return CHAT_COMMAND_NAMES.map((command) => {
    const path = `commands.${command}.description`;
    const definition: DiscordCommandDefinition = {
      type: DISCORD_COMMAND_TYPE_CHAT_INPUT,
      name: command,
      description: requireText('en', path),
      description_localizations: descriptionLocalizations(path),
      contexts: [DISCORD_CONTEXT_BOT_DM],
      integration_types: [DISCORD_INTEGRATION_GUILD_INSTALL],
    };
    const options = OPTION_SPECS[command].map((spec) => buildOption(command, spec));
    if (options.length > 0) definition.options = options;
    return definition;
  });
}
