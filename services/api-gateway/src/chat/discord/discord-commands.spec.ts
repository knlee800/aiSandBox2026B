import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
} from '@discordjs/core';
import {
  buildDiscordCommands,
  CHAT_ASK_TEXT_MAX,
  CHAT_COMMAND_NAMES,
  chatCommandOptionNames,
  DISCORD_COMMAND_TYPE_CHAT_INPUT,
  DISCORD_CONTEXT_BOT_DM,
  DISCORD_INTEGRATION_GUILD_INSTALL,
  DISCORD_OPTION_TYPE_STRING,
} from './discord-commands';

// Discord's rule for command and option names (application-commands docs).
const NAME_RULE = /^[-_'\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u;

describe('Discord commands (CHAT-DISCORD-01 B)', () => {
  const commands = buildDiscordCommands();

  it('uses the library enum values', () => {
    expect(DISCORD_COMMAND_TYPE_CHAT_INPUT).toBe(ApplicationCommandType.ChatInput);
    expect(DISCORD_OPTION_TYPE_STRING).toBe(ApplicationCommandOptionType.String);
    expect(DISCORD_CONTEXT_BOT_DM).toBe(InteractionContextType.BotDM);
    expect(DISCORD_INTEGRATION_GUILD_INSTALL).toBe(ApplicationIntegrationType.GuildInstall);
  });

  it('registers exactly link, unlink, status, language, help, ask and cancel', () => {
    expect(commands.map((command) => command.name)).toEqual(['link', 'unlink', 'status', 'language', 'help', 'ask', 'cancel']);
    expect(CHAT_COMMAND_NAMES).toEqual(commands.map((command) => command.name));
  });

  it('every command is a slash command for the direct message with the bot only', () => {
    for (const command of commands) {
      expect(command.type).toBe(ApplicationCommandType.ChatInput);
      expect(command.contexts).toEqual([InteractionContextType.BotDM]);
      expect(command.integration_types).toEqual([ApplicationIntegrationType.GuildInstall]);
      expect(Object.keys(command).sort()).toEqual(
        expect.arrayContaining(['type', 'name', 'description', 'description_localizations', 'contexts', 'integration_types']),
      );
      // Nothing that would widen where or by whom it is used.
      expect(command).not.toHaveProperty('default_member_permissions');
      expect(command).not.toHaveProperty('dm_permission');
      expect(command).not.toHaveProperty('nsfw');
    }
  });

  it('keeps English command and option names in every client: no name_localizations anywhere', () => {
    const json = JSON.stringify(commands);
    expect(json).not.toContain('name_localizations');
    for (const command of commands) {
      expect(command).not.toHaveProperty('name_localizations');
      for (const option of command.options ?? []) {
        expect(option).not.toHaveProperty('name_localizations');
      }
    }
  });

  it('translates every command and option description into zh-TW and zh-CN', () => {
    const translated = (map: Record<string, string>, english: string): void => {
      expect(Object.keys(map).sort()).toEqual(['zh-CN', 'zh-TW']);
      for (const text of Object.values(map)) {
        expect(text).not.toBe(english);
        expect(text).toMatch(/[一-鿿]/);
      }
    };
    for (const command of commands) {
      translated(command.description_localizations, command.description);
      for (const option of command.options ?? []) {
        translated(option.description_localizations, option.description);
      }
    }
    const link = commands.find((command) => command.name === 'link');
    expect(link?.description_localizations).toEqual({
      'zh-TW': '用平台上的代碼連結這個 Discord 帳號',
      'zh-CN': '用平台上的代码关联这个 Discord 账户',
    });
  });

  it('keeps names and descriptions within Discord limits', () => {
    for (const command of commands) {
      const names: string[] = [command.name];
      const descriptions = [command.description, ...Object.values(command.description_localizations)];
      for (const option of command.options ?? []) {
        names.push(option.name);
        descriptions.push(option.description, ...Object.values(option.description_localizations));
        for (const choice of option.choices ?? []) {
          expect(choice.name.length).toBeGreaterThan(0);
          expect(choice.name.length).toBeLessThanOrEqual(100);
        }
      }
      for (const name of names) {
        expect(name).toMatch(NAME_RULE);
        expect(name).toMatch(/^[a-z]+$/);
        expect(name).toBe(name.toLowerCase());
      }
      for (const description of descriptions) {
        expect(description.length).toBeGreaterThan(0);
        expect(Array.from(description).length).toBeLessThanOrEqual(100);
      }
    }
  });

  it('declares only string options, with their limits', () => {
    const byName = Object.fromEntries(commands.map((command) => [command.name, command]));
    for (const command of commands) {
      for (const option of command.options ?? []) {
        expect(option.type).toBe(ApplicationCommandOptionType.String);
      }
      expect((command.options ?? []).map((option) => option.name)).toEqual(chatCommandOptionNames(command.name));
    }
    expect(byName.link.options).toEqual([
      expect.objectContaining({ name: 'code', required: true, min_length: 8, max_length: 16 }),
    ]);
    expect(byName.language.options?.[0]).toEqual(
      expect.objectContaining({
        name: 'language',
        required: true,
        choices: [
          { name: 'English', value: 'en' },
          { name: '繁體中文', value: 'zh-TW' },
          { name: '简体中文', value: 'zh-CN' },
        ],
      }),
    );
    expect(byName.ask.options).toEqual([
      expect.objectContaining({ name: 'text', required: true, max_length: CHAT_ASK_TEXT_MAX }),
      expect.objectContaining({ name: 'agent', required: false, max_length: 100 }),
    ]);
    expect(CHAT_ASK_TEXT_MAX).toBe(6000);
    for (const name of ['unlink', 'status', 'help']) {
      expect(byName[name].options).toBeUndefined();
    }
  });
});
