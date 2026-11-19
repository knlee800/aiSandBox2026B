import {
  buildChatLinkMail,
  chatLinkConnectionsUrl,
  escapeChatMailHtml,
  formatChatLinkMailTime,
} from './chat-link-mail';
import { CHAT_MAIL_KEYS, chatLocaleText } from './chat-replies';

const AT = new Date('2026-11-19T10:05:42.123Z');
const BASE = 'https://ainow.example';
const FULL_ID = '987654321098765432';
const LOCALES = ['en', 'zh-TW', 'zh-CN'] as const;

describe('chat link mail (CHAT-LINK-NOTICE-01)', () => {
  it('formats the time in UTC to the minute and builds the Connections link for the locale', () => {
    expect(formatChatLinkMailTime(AT)).toBe('2026-11-19 10:05 UTC');
    // A time given with an offset is still written in UTC.
    expect(formatChatLinkMailTime(new Date('2026-11-20T01:30:00+08:00'))).toBe('2026-11-19 17:30 UTC');
    expect(chatLinkConnectionsUrl(BASE, 'en')).toBe('https://ainow.example/en/connections');
    expect(chatLinkConnectionsUrl(`${BASE}/`, 'zh-TW')).toBe('https://ainow.example/zh-TW/connections');
    expect(chatLinkConnectionsUrl(` ${BASE}// `, 'zh-CN')).toBe('https://ainow.example/zh-CN/connections');
  });

  it('linked, in English: subject, body with the id ending and time, the link, and what to do', () => {
    const mail = buildChatLinkMail({ event: 'linked', locale: 'en', externalIdLast4: '5432', at: AT, appBaseUrl: BASE });
    expect(mail.subject).toBe('A Discord account was linked to your account');
    expect(mail.text).toBe(
      'A Discord account (id ending 5432) was linked to your account at 2026-11-19 10:05 UTC.\n\n' +
        'Open the Connections page: https://ainow.example/en/connections\n\n' +
        'If this was not you, unlink Discord there and change your password.',
    );
    expect(mail.html).toBe(
      '<p>A Discord account (id ending 5432) was linked to your account at 2026-11-19 10:05 UTC.</p>' +
        '<p><a href="https://ainow.example/en/connections">Open the Connections page</a></p>' +
        '<p>If this was not you, unlink Discord there and change your password.</p>',
    );
  });

  it('unlinked, in English: says unlinked and only "change your password"', () => {
    const mail = buildChatLinkMail({ event: 'unlinked', locale: 'en', externalIdLast4: '5432', at: AT, appBaseUrl: BASE });
    expect(mail.subject).toBe('A Discord account was unlinked from your account');
    expect(mail.text).toBe(
      'A Discord account (id ending 5432) was unlinked from your account at 2026-11-19 10:05 UTC.\n\n' +
        'Open the Connections page: https://ainow.example/en/connections\n\n' +
        'If this was not you, change your password.',
    );
    expect(mail.html).toContain('<p>If this was not you, change your password.</p>');
    expect(mail.html).not.toContain('unlink Discord there');
  });

  it.each(LOCALES)('%s: both e-mails are in that language with the id ending, the time and the locale link', (locale) => {
    for (const event of ['linked', 'unlinked'] as const) {
      const mail = buildChatLinkMail({ event, locale, externalIdLast4: '5432', at: AT, appBaseUrl: BASE });
      expect(mail.subject).toBe(chatLocaleText(locale, `mail.${event}.subject`));
      for (const part of [mail.text, mail.html]) {
        expect(part).toContain('5432');
        expect(part).toContain('2026-11-19 10:05 UTC');
        expect(part).toContain(`https://ainow.example/${locale}/connections`);
        expect(part).toContain(chatLocaleText(locale, `mail.${event}.warning`) as string);
        expect(part).toContain(chatLocaleText(locale, 'mail.openConnections') as string);
        expect(part).not.toMatch(/\{\{\w+\}\}/);
      }
      if (locale !== 'en') {
        expect(mail.subject).toMatch(/[一-鿿]/);
        expect(mail.text).toMatch(/[一-鿿]/);
        expect(mail.subject).not.toBe(chatLocaleText('en', `mail.${event}.subject`));
      }
    }
  });

  it('zh-TW and zh-CN have their own text', () => {
    const tw = buildChatLinkMail({ event: 'linked', locale: 'zh-TW', externalIdLast4: '5432', at: AT, appBaseUrl: BASE });
    const cn = buildChatLinkMail({ event: 'linked', locale: 'zh-CN', externalIdLast4: '5432', at: AT, appBaseUrl: BASE });
    expect(tw.subject).toBe('有一個 Discord 帳號已連結到你的帳號');
    expect(cn.subject).toBe('有一个 Discord 账户已关联到你的账户');
    expect(tw.text).toContain('ID 末碼 5432');
    expect(cn.text).toContain('ID 末位 5432');
  });

  it('never carries more than the last four digits of the id', () => {
    const mail = buildChatLinkMail({ event: 'linked', locale: 'en', externalIdLast4: FULL_ID, at: AT, appBaseUrl: BASE });
    expect(mail.text).toContain('id ending 5432');
    for (const part of [mail.subject, mail.text, mail.html]) {
      expect(part).not.toContain(FULL_ID);
      expect(part).not.toContain('98765432');
    }
  });

  it('escapes every interpolated value in the html', () => {
    expect(escapeChatMailHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    const mail = buildChatLinkMail({
      event: 'linked',
      locale: 'en',
      externalIdLast4: '<b>',
      at: AT,
      appBaseUrl: 'https://x.example/"><script>alert(1)</script>',
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).not.toContain('<b>');
    expect(mail.html).toContain('id ending &lt;b&gt;');
    expect(mail.html).toContain('href="https://x.example/&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;/en/connections"');
  });

  it('every mail key exists in all three files', () => {
    for (const key of CHAT_MAIL_KEYS) {
      for (const locale of LOCALES) {
        expect({ locale, key, present: Boolean(chatLocaleText(locale, `mail.${key}`)) }).toEqual({
          locale,
          key,
          present: true,
        });
      }
    }
  });
});
