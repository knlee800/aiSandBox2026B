import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CHAT_REPLY_KEYS,
  chatAgentName,
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

describe('chat replies (CHAT-DISCORD-01 B, C1, C2)', () => {
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

  it('C2: agent names are translated for the Discord-reachable system agents; anything else is "an agent"', () => {
    expect(chatAgentName('en', 'chief-of-staff')).toBe('Chief of Staff');
    expect(chatAgentName('zh-TW', 'product-strategy')).toBe('產品策略');
    expect(chatAgentName('zh-CN', 'technology-advisor')).toBe('技术顾问');
    expect(chatAgentName('en', 'writer')).toBe('an agent');
    expect(chatAgentName('zh-TW', '__proto__')).toBe('一個代理');
    expect(chatAgentName('fr' as never, 'other')).toBe('an agent');
  });

  it('C2: the approval reply keys and the button labels exist in all three files', () => {
    expect(CHAT_REPLY_KEYS.filter((key) => key.startsWith('approval.'))).toHaveLength(14);
    expect([chatReply('en', 'approval.approveButton'), chatReply('en', 'approval.rejectButton')]).toEqual(['Approve', 'Reject']);
    expect([chatReply('zh-TW', 'approval.approveButton'), chatReply('zh-TW', 'approval.rejectButton')]).toEqual(['核准', '拒絕']);
    expect([chatReply('zh-CN', 'approval.approveButton'), chatReply('zh-CN', 'approval.rejectButton')]).toEqual(['批准', '拒绝']);
  });

  it('CHAT-USER-INSTALL-01: /help says commands come from the / menu and that held results arrive after the next command', () => {
    const en = chatReply('en', 'help');
    expect(en.split('\n')[0]).toBe('Type / in this direct message and choose a command from the menu:');
    expect(en.split('\n').slice(-1)[0]).toBe(
      "If Discord blocks the bot's messages to you, your results arrive after your next command. They are always on the Results page.",
    );
    const tw = chatReply('zh-TW', 'help');
    expect(tw.split('\n')[0]).toBe('在這個私訊中輸入 /，再從選單中選擇指令：');
    expect(tw).toContain('結果會在你下次使用指令後送達');
    expect(tw).toContain('結果頁面');
    const cn = chatReply('zh-CN', 'help');
    expect(cn.split('\n')[0]).toBe('在这个私信中输入 /，再从菜单中选择指令：');
    expect(cn).toContain('结果会在你下次使用指令后送达');
    expect(cn).toContain('结果页面');
    // Every command is still listed, in every language.
    for (const text of [en, tw, cn]) {
      for (const command of ['/link', '/unlink', '/status', '/language', '/ask', '/cancel']) {
        expect(text).toContain(command);
      }
      expect(Array.from(text).length).toBeLessThanOrEqual(2000);
    }
  });

  it('CHAT-RESULTS-OTHER-01: /help says in one line that every run’s results and approval requests arrive here', () => {
    const lines = {
      en: 'Results and approval requests of every run you start (Team page, schedules, triggers and Discord) arrive here.',
      'zh-TW': '你啟動的每一次執行（團隊頁面、排程、觸發器和 Discord）的結果與核准請求都會送到這裡。',
      'zh-CN': '你启动的每一次运行（团队页面、计划任务、触发器和 Discord）的结果和批准请求都会发送到这里。',
    } as const;
    for (const locale of LOCALES) {
      const help = chatReply(locale, 'help').split('\n');
      // One line, right after /cancel and before the held-results line.
      expect(help.filter((line) => line === lines[locale])).toHaveLength(1);
      const at = help.indexOf(lines[locale]);
      expect(help[at - 1].startsWith('/cancel')).toBe(true);
      expect(at).toBe(help.length - 2);
      expect(Array.from(help.join('\n')).length).toBeLessThanOrEqual(2000);
    }
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
