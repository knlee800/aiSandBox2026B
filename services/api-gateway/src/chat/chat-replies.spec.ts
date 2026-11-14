import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CHAT_REPLY_KEYS,
  chatLanguageName,
  chatLocalePaths,
  chatLocaleText,
  chatReply,
} from './chat-replies';

const LOCALES_DIR = join(__dirname, '..', '..', 'locales');
const LOCALES = ['en', 'zh-TW', 'zh-CN'] as const;

function placeholders(text: string): string[] {
  return Array.from(text.matchAll(/\{\{(\w+)\}\}/g), (match) => match[1]).sort();
}

describe('chat replies (CHAT-DISCORD-01 B, C1)', () => {
  it('every chat text in en.json exists in zh-TW.json and zh-CN.json, non-empty, with the same placeholders', () => {
    const paths = chatLocalePaths();
    expect(paths.length).toBeGreaterThan(25);
    for (const path of paths) {
      const english = chatLocaleText('en', path);
      expect(english).toBeTruthy();
      for (const locale of ['zh-TW', 'zh-CN'] as const) {
        const text = chatLocaleText(locale, path);
        if (!text) {
          throw new Error(`missing ${locale} chat.${path}`);
        }
        expect(placeholders(text)).toEqual(placeholders(english as string));
      }
    }
  });

  it('the zh files hold real translations, not English copies (language names excepted)', () => {
    for (const path of chatLocalePaths()) {
      if (path.startsWith('languageNames.')) continue;
      const english = chatLocaleText('en', path);
      expect({ path, text: chatLocaleText('zh-TW', path) }).not.toEqual({ path, text: english });
      expect({ path, text: chatLocaleText('zh-CN', path) }).not.toEqual({ path, text: english });
      expect(chatLocaleText('zh-TW', path)).toMatch(/[一-鿿]/);
      expect(chatLocaleText('zh-CN', path)).toMatch(/[一-鿿]/);
    }
  });

  it('every reply key the bot uses exists in all three files', () => {
    for (const key of CHAT_REPLY_KEYS) {
      for (const locale of LOCALES) {
        expect({ locale, key, present: Boolean(chatLocaleText(locale, `replies.${key}`)) }).toEqual({
          locale,
          key,
          present: true,
        });
      }
    }
  });

  it('CHAT_REPLY_KEYS is exactly the reply set in every file: no unused or missing key (C1)', () => {
    for (const locale of LOCALES) {
      const json = JSON.parse(readFileSync(join(LOCALES_DIR, `${locale}.json`), 'utf8'));
      const out: string[] = [];
      const walk = (node: Record<string, unknown>, prefix: string): void => {
        for (const [key, value] of Object.entries(node)) {
          const path = prefix ? `${prefix}.${key}` : key;
          if (typeof value === 'string') out.push(path);
          else walk(value as Record<string, unknown>, path);
        }
      };
      walk(json.chat.replies, '');
      expect({ locale, keys: out.sort() }).toEqual({ locale, keys: [...CHAT_REPLY_KEYS].sort() });
    }
    expect(CHAT_REPLY_KEYS).not.toContain('ask.notBuilt');
    expect(new Set(CHAT_REPLY_KEYS).size).toBe(CHAT_REPLY_KEYS.length);
  });

  it('the three files have the same chat key set (no extra keys either way)', () => {
    const keysOf = (locale: string): string[] => {
      const json = JSON.parse(readFileSync(join(LOCALES_DIR, `${locale}.json`), 'utf8'));
      const out: string[] = [];
      const walk = (node: Record<string, unknown>, prefix: string): void => {
        for (const [key, value] of Object.entries(node)) {
          const path = prefix ? `${prefix}.${key}` : key;
          if (typeof value === 'string') out.push(path);
          else walk(value as Record<string, unknown>, path);
        }
      };
      walk(json.chat, '');
      return out.sort();
    };
    expect(keysOf('zh-TW')).toEqual(keysOf('en'));
    expect(keysOf('zh-CN')).toEqual(keysOf('en'));
  });

  it('fills only the values passed, in the chosen language', () => {
    expect(chatReply('en', 'status.summary', { runs: 'switched off', language: 'English' })).toBe(
      'Linked: yes.\nRuns: switched off.\nReply language: English.',
    );
    expect(chatReply('zh-TW', 'language.set', { language: chatLanguageName('zh-TW') })).toBe(
      '之後的回覆會使用繁體中文。',
    );
    expect(chatReply('en', 'language.set')).toBe('Replies are now in {{language}}.');
  });

  it('falls back to en for an unknown locale', () => {
    expect(chatReply('fr' as never, 'notAvailable')).toBe(chatReply('en', 'notAvailable'));
    expect(chatLanguageName('fr' as never)).toBe('English');
  });

  it('keeps the existing auth texts', () => {
    const en = JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf8'));
    expect(en.auth.invalidCredentials).toBe('Invalid credentials');
  });
});
