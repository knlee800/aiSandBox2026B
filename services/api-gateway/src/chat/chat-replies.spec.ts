import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CHAT_MAIL_KEYS,
  CHAT_REPLY_KEYS,
  chatAgentName,
  chatLanguageName,
  chatLocalePaths,
  chatLocaleText,
  chatMailText,
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
    // CHAT-TIDY-01: 14 plus the reject form title, its field label and the default reason.
    expect(CHAT_REPLY_KEYS.filter((key) => key.startsWith('approval.'))).toHaveLength(17);
    expect([chatReply('en', 'approval.approveButton'), chatReply('en', 'approval.rejectButton')]).toEqual(['Approve', 'Reject']);
    expect([chatReply('zh-TW', 'approval.approveButton'), chatReply('zh-TW', 'approval.rejectButton')]).toEqual(['核准', '拒絕']);
    expect([chatReply('zh-CN', 'approval.approveButton'), chatReply('zh-CN', 'approval.rejectButton')]).toEqual(['批准', '拒绝']);
  });

  it('CHAT-USER-INSTALL-01 / CHAT-TIDY-01: /help says commands come from the / menu and that held results arrive after the next slash command', () => {
    const en = chatReply('en', 'help');
    expect(en.split('\n')[0]).toBe('Type / in this direct message and choose a command from the menu:');
    expect(en.split('\n').slice(-1)[0]).toBe(
      "If Discord blocks the bot's messages to you, your results arrive after your next slash command (a plain message is not enough). They are always on the Results page.",
    );
    const tw = chatReply('zh-TW', 'help');
    expect(tw.split('\n')[0]).toBe('在這個私訊中輸入 /，再從選單中選擇指令：');
    expect(tw).toContain('結果會在你下次使用斜線指令後送達（只傳一般訊息不夠）');
    expect(tw).toContain('結果頁面');
    const cn = chatReply('zh-CN', 'help');
    expect(cn.split('\n')[0]).toBe('在这个私信中输入 /，再从菜单中选择指令：');
    expect(cn).toContain('结果会在你下次使用斜杠指令后送达（只发普通消息不够）');
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
      // One line, right after /cancel; then (CHAT-TIDY-01) the buttons line and the held-results line.
      expect(help.filter((line) => line === lines[locale])).toHaveLength(1);
      const at = help.indexOf(lines[locale]);
      expect(help[at - 1].startsWith('/cancel')).toBe(true);
      expect(at).toBe(help.length - 3);
      expect(Array.from(help.join('\n')).length).toBeLessThanOrEqual(2000);
    }
  });

  it('CHAT-TIDY-01: /help names the Approve and Reject buttons and that a Reject can carry a reason, under 2000 characters', () => {
    const lines = {
      en: 'A step that can only read comes with Approve and Reject buttons. Reject asks for a reason, which you can leave empty.',
      'zh-TW': '只能讀取的步驟會附上「核准」和「拒絕」按鈕；按下「拒絕」時可以填寫原因，也可以留空。',
      'zh-CN': '只能读取的步骤会附带“批准”和“拒绝”按钮；按下“拒绝”时可以填写原因，也可以留空。',
    } as const;
    for (const locale of LOCALES) {
      const help = chatReply(locale, 'help').split('\n');
      // The line before the held-results line names the buttons as they are labelled.
      expect(help[help.length - 2]).toBe(lines[locale]);
      expect(help[help.length - 2]).toContain(chatReply(locale, 'approval.approveButton'));
      expect(help[help.length - 2]).toContain(chatReply(locale, 'approval.rejectButton'));
      expect(Array.from(help.join('\n')).length).toBeLessThanOrEqual(2000);
    }
  });

  it('CHAT-TIDY-01: the reject form texts fit Discord (title and label at most 45) and the default reason is translated', () => {
    expect(LOCALES.map((locale) => chatReply(locale, 'approval.rejectDefaultReason'))).toEqual(
      LOCALES.map((locale) => ({ en: 'Rejected in Discord', 'zh-TW': '已在 Discord 拒絕', 'zh-CN': '已在 Discord 拒绝' })[locale]),
    );
    expect(chatReply('en', 'approval.rejectFormTitle')).toBe('Reject this step');
    expect(chatReply('en', 'approval.rejectReasonLabel')).toBe('Reason (optional)');
    for (const locale of LOCALES) {
      for (const key of ['approval.rejectFormTitle', 'approval.rejectReasonLabel'] as const) {
        const text = chatReply(locale, key);
        expect(text.length).toBeGreaterThan(0);
        expect(Array.from(text).length).toBeLessThanOrEqual(45);
      }
    }
  });

  it('CHAT-DISCORD-DM-01: /help says plain messages work, @name picks a workflow, and /ask is the fallback', () => {
    const lines = {
      en: 'You can also just send a message here: it goes to the Chief of Staff, or start it with @name to ask one of your workflows. If the bot does not answer plain messages, use /ask.',
      'zh-TW': '你也可以直接在這裡傳送訊息：訊息會交給幕僚長；以 @名稱 開頭即可向你的某個工作流程提問。如果機器人沒有回應一般訊息，請使用 /ask。',
      'zh-CN': '你也可以直接在这里发送消息：消息会交给幕僚长；以 @名称 开头即可向你的某个工作流提问。如果机器人没有回应普通消息，请使用 /ask。',
    } as const;
    for (const locale of LOCALES) {
      const help = chatReply(locale, 'help').split('\n');
      // One line, right after /ask and before /cancel.
      expect(help.filter((line) => line === lines[locale])).toHaveLength(1);
      const at = help.indexOf(lines[locale]);
      expect(help[at - 1].startsWith('/ask')).toBe(true);
      expect(help[at + 1].startsWith('/cancel')).toBe(true);
      expect(Array.from(help.join('\n')).length).toBeLessThanOrEqual(2000);
    }
  });

  it('CHAT-DISCORD-DM-01: the plain-message lines exist in all three languages and say nothing was started', () => {
    expect(CHAT_REPLY_KEYS.filter((key) => key.startsWith('message.'))).toEqual([
      'message.textOnly',
      'message.useSlashMenu',
      'message.tooLong',
    ]);
    expect(chatReply('en', 'message.textOnly')).toBe(
      'Only the text of a message is read. Write your question or task as text. Nothing was started.',
    );
    expect(chatReply('en', 'message.useSlashMenu')).toBe(
      'To use a command, type / and choose it from the menu. Nothing was started.',
    );
    expect(chatReply('en', 'message.tooLong')).toBe(
      'That message is too long (at most 6000 characters). Nothing was started.',
    );
    for (const locale of ['zh-TW', 'zh-CN'] as const) {
      expect(chatReply(locale, 'message.tooLong')).toContain('6000');
      expect(chatReply(locale, 'message.useSlashMenu')).toContain('/');
    }
  });

  it('CHAT-LINK-NOTICE-01 / CHAT-TIDY-01: the confirmation after Confirm on the page, which also says a plain message works', () => {
    expect(chatReply('en', 'link.confirmed')).toBe(
      "Linked. This Discord account now receives your agents' results. Just send a message here, or type / and choose ask, to start.",
    );
    expect(chatReply('zh-TW', 'link.confirmed')).toBe(
      '已連結。這個 Discord 帳號現在會收到你的代理的結果。直接在這裡傳送訊息，或輸入 / 並選擇 ask，即可開始。',
    );
    expect(chatReply('zh-CN', 'link.confirmed')).toBe(
      '已关联。这个 Discord 账户现在会收到你的代理的结果。直接在这里发送消息，或输入 / 并选择 ask，即可开始。',
    );
  });

  it('CHAT-LINK-NOTICE-01: CHAT_MAIL_KEYS is exactly the mail set in every file, and chatMailText fills only the values passed', () => {
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
      walk(json.chat.mail, '');
      expect({ locale, keys: out.sort() }).toEqual({ locale, keys: [...CHAT_MAIL_KEYS].sort() });
      for (const event of ['linked', 'unlinked']) {
        expect(placeholders(json.chat.mail[event].body)).toEqual(['last4', 'time']);
        expect(placeholders(json.chat.mail[event].subject)).toEqual([]);
        expect(placeholders(json.chat.mail[event].warning)).toEqual([]);
      }
    }
    expect(chatMailText('en', 'linked.body', { last4: '5432', time: '2026-11-19 10:05 UTC' })).toBe(
      'A Discord account (id ending 5432) was linked to your account at 2026-11-19 10:05 UTC.',
    );
    expect(chatMailText('en', 'unlinked.body')).toBe(
      'A Discord account (id ending {{last4}}) was unlinked from your account at {{time}}.',
    );
    expect(chatMailText('fr' as never, 'openConnections')).toBe('Open the Connections page');
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
