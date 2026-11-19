import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CHAT_ERROR_KEYS,
  CHAT_RECENT_LINK_MS,
  CHAT_SETUP_STEPS,
  canCreateCode,
  chatErrorKey,
  currentChatStep,
  deriveChatView,
  formatLinkCode,
  isCodeLive,
  parseBotProfileUrl,
  parseChatLinks,
  parseInstallUrl,
  pickChatLocale,
  retryMinutes,
  shouldPoll,
  showsChatSteps,
  showsRecentLinkNotice,
  type ChatLinksState,
} from '@/components/connections/chat-link.logic';

const NOW = Date.parse('2026-11-13T10:00:00.000Z');
const FUTURE = '2026-11-13T10:10:00.000Z';
const PAST = '2026-11-13T09:50:00.000Z';

const LINK = {
  channel: 'discord' as const,
  linkedAt: '2026-11-13T09:00:00.000Z',
  lastUsedAt: null,
  externalIdLast4: '5432',
};

function state(overrides: Partial<ChatLinksState> = {}): ChatLinksState {
  return { enabled: true, paused: false, link: null, pending: null, installUrl: null, botProfileUrl: null, ...overrides };
}

function pending(claimed: boolean, expiresAt = FUTURE) {
  return {
    channel: 'discord' as const,
    claimed,
    expiresAt,
    claimedAt: claimed ? '2026-11-13T10:01:00.000Z' : null,
    displayName: claimed ? 'Keith' : null,
    externalIdLast4: claimed ? '5432' : null,
  };
}

describe('parseChatLinks', () => {
  test('the switch-off answer parses to a disabled state', () => {
    const parsed = parseChatLinks({ enabled: false, paused: false, discord: { link: null, pending: null } });
    assert.deepEqual(parsed, {
      enabled: false,
      paused: false,
      link: null,
      pending: null,
      installUrl: null,
      botProfileUrl: null,
    });
  });

  test('unclaimed, claimed and linked answers keep only the public fields', () => {
    const unclaimed = parseChatLinks({
      enabled: true,
      paused: false,
      discord: { link: null, pending: { channel: 'discord', claimed: false, expiresAt: FUTURE, secret: 'x' } },
    });
    assert.equal(unclaimed?.pending?.claimed, false);
    assert.equal(unclaimed?.pending?.displayName, null);
    assert.equal('secret' in (unclaimed?.pending ?? {}), false);

    const claimed = parseChatLinks({
      enabled: true,
      paused: true,
      discord: {
        link: null,
        pending: {
          channel: 'discord',
          claimed: true,
          expiresAt: FUTURE,
          claimedAt: '2026-11-13T10:01:00.000Z',
          displayName: 'Keith',
          externalIdLast4: '5432',
        },
      },
    });
    assert.equal(claimed?.paused, true);
    assert.equal(claimed?.pending?.displayName, 'Keith');
    assert.equal(claimed?.pending?.externalIdLast4, '5432');

    const linked = parseChatLinks({ enabled: true, paused: false, discord: { link: LINK, pending: null } });
    assert.equal(linked?.link?.externalIdLast4, '5432');
  });

  test('a wrong shape is refused', () => {
    assert.equal(parseChatLinks(null), null);
    assert.equal(parseChatLinks({ enabled: true }), null);
    assert.equal(parseChatLinks({ enabled: 'yes', paused: false, discord: {} }), null);
    assert.equal(
      parseChatLinks({ enabled: true, paused: false, discord: { link: { channel: 'x' }, pending: null } }),
      null,
    );
  });
});

describe('install and bot links (CHAT-USER-INSTALL-01)', () => {
  const INSTALL = 'https://discord.com/oauth2/authorize?client_id=111111111111111111&integration_type=1&scope=applications.commands';
  const PROFILE = 'https://discord.com/users/222222222222222222';

  test('the server links are kept; a payload without them (an older server) has null links', () => {
    const parsed = parseChatLinks({
      enabled: true,
      paused: false,
      discord: { link: null, pending: null, installUrl: INSTALL, botProfileUrl: PROFILE },
    });
    assert.equal(parsed?.installUrl, INSTALL);
    assert.equal(parsed?.botProfileUrl, PROFILE);
    const older = parseChatLinks({ enabled: true, paused: false, discord: { link: null, pending: null } });
    assert.equal(older?.installUrl, null);
    assert.equal(older?.botProfileUrl, null);
  });

  test('only Discord https links are kept; anything else is null and hides the button', () => {
    assert.equal(parseInstallUrl(INSTALL), INSTALL);
    for (const bad of [
      'javascript:alert(1)',
      'http://discord.com/oauth2/authorize?client_id=1',
      'https://discord.com.evil.example/oauth2/authorize?client_id=1',
      'https://discord.com/oauth2/authorize?client_id=abc',
      'https://discord.com/oauth2/authorize?',
      'https://discord.com/api/oauth2/authorize?client_id=1',
      `${INSTALL}${'x'.repeat(600)}`,
      42,
      null,
    ]) {
      assert.equal(parseInstallUrl(bad), null, String(bad));
    }
    assert.equal(parseBotProfileUrl(PROFILE), PROFILE);
    for (const bad of [
      'https://discord.com/users/abc',
      'https://discord.com/users/1/x',
      'http://discord.com/users/1',
      'https://evil.example/users/1',
      'javascript:alert(1)',
      undefined,
    ]) {
      assert.equal(parseBotProfileUrl(bad), null, String(bad));
    }
    const mixed = parseChatLinks({
      enabled: true,
      paused: false,
      discord: { link: null, pending: null, installUrl: 'javascript:alert(1)', botProfileUrl: PROFILE },
    });
    assert.equal(mixed?.installUrl, null);
    assert.equal(mixed?.botProfileUrl, PROFILE);
  });

  test('the five steps, which show while not linked, and the current step', () => {
    assert.deepEqual([...CHAT_SETUP_STEPS], ['install', 'open', 'create', 'link', 'confirm']);
    for (const view of ['unlinked', 'codeLive', 'codeHidden', 'claimed'] as const) {
      assert.equal(showsChatSteps(view), true, view);
    }
    for (const view of ['unavailable', 'linked'] as const) {
      assert.equal(showsChatSteps(view), false, view);
    }
    assert.equal(currentChatStep('unlinked'), null);
    assert.equal(currentChatStep('codeLive'), 'link');
    assert.equal(currentChatStep('codeHidden'), 'link');
    assert.equal(currentChatStep('claimed'), 'confirm');
    assert.equal(currentChatStep('linked'), null);
  });
});

describe('deriveChatView', () => {
  test('missing or switched-off state is unavailable', () => {
    assert.equal(deriveChatView(null, false, NOW), 'unavailable');
    assert.equal(deriveChatView(state({ enabled: false }), false, NOW), 'unavailable');
  });

  test('linked wins over everything', () => {
    assert.equal(deriveChatView(state({ link: LINK, pending: pending(true) }), true, NOW), 'linked');
  });

  test('a claim shows the confirm view, a live code shows the code, a lost code is hidden', () => {
    assert.equal(deriveChatView(state({ pending: pending(true) }), true, NOW), 'claimed');
    assert.equal(deriveChatView(state({ pending: pending(false) }), true, NOW), 'codeLive');
    assert.equal(deriveChatView(state({ pending: pending(false) }), false, NOW), 'codeHidden');
  });

  test('no pending or an expired one is unlinked', () => {
    assert.equal(deriveChatView(state(), false, NOW), 'unlinked');
    assert.equal(deriveChatView(state({ pending: pending(false, PAST) }), true, NOW), 'unlinked');
  });
});

describe('shouldPoll', () => {
  test('polls only while an unexpired code exists and the page is visible', () => {
    assert.equal(shouldPoll(state({ pending: pending(false) }), false, NOW), true);
    assert.equal(shouldPoll(state({ pending: pending(true) }), false, NOW), true);
    assert.equal(shouldPoll(state({ pending: pending(false) }), true, NOW), false, 'hidden page');
    assert.equal(shouldPoll(state(), false, NOW), false, 'no code');
    assert.equal(shouldPoll(state({ pending: pending(false, PAST) }), false, NOW), false, 'expired');
    assert.equal(shouldPoll(state({ link: LINK }), false, NOW), false, 'linked');
    assert.equal(shouldPoll(state({ enabled: false, pending: pending(false) }), false, NOW), false, 'off');
    assert.equal(shouldPoll(null, false, NOW), false);
  });
});

describe('showsRecentLinkNotice (CHAT-LINK-NOTICE-01)', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const linkedAt = Date.parse(LINK.linkedAt);

  test('shows while the link is younger than 7 days, and not from 7 days on', () => {
    assert.equal(CHAT_RECENT_LINK_MS, 7 * DAY);
    assert.equal(showsRecentLinkNotice(LINK, linkedAt), true, 'just linked');
    assert.equal(showsRecentLinkNotice(LINK, NOW), true, 'an hour later');
    assert.equal(showsRecentLinkNotice(LINK, linkedAt + 6 * DAY), true, '6 days');
    assert.equal(showsRecentLinkNotice(LINK, linkedAt + 7 * DAY - 1), true, 'just under 7 days');
    assert.equal(showsRecentLinkNotice(LINK, linkedAt + 7 * DAY), false, '7 days');
    assert.equal(showsRecentLinkNotice(LINK, linkedAt + 30 * DAY), false, '30 days');
  });

  test('no link or an unreadable date shows nothing', () => {
    assert.equal(showsRecentLinkNotice(null, NOW), false);
    assert.equal(showsRecentLinkNotice({ ...LINK, linkedAt: 'not a date' }, NOW), false);
  });
});

describe('canCreateCode', () => {
  test('needs the tick, nothing running and linking not paused', () => {
    assert.equal(canCreateCode(false, false, false), false);
    assert.equal(canCreateCode(true, false, false), true);
    assert.equal(canCreateCode(true, true, false), false);
    assert.equal(canCreateCode(true, false, true), false);
  });
});

describe('code helpers', () => {
  test('formatLinkCode shows XXXX-XXXX', () => {
    assert.equal(formatLinkCode('abcd-2345'), 'ABCD-2345');
    assert.equal(formatLinkCode('ABCD2345'), 'ABCD-2345');
  });

  test('isCodeLive is false for no code and for an expired code', () => {
    assert.equal(isCodeLive(null, NOW), false);
    assert.equal(isCodeLive({ expiresAt: PAST }, NOW), false);
    assert.equal(isCodeLive({ expiresAt: FUTURE }, NOW), true);
  });
});

describe('error mapping', () => {
  test('every frozen server code maps to its own key and unknown codes fall back', () => {
    assert.equal(chatErrorKey('chat_link_paused'), 'chat.errors.paused');
    assert.equal(chatErrorKey('chat_link_rate_limited'), 'chat.errors.rateLimited');
    assert.equal(chatErrorKey('chat_link_taken'), 'chat.errors.taken');
    assert.equal(chatErrorKey('chat_link_exists'), 'chat.errors.exists');
    assert.equal(chatErrorKey('chat_link_no_pending_claim'), 'chat.errors.noPending');
    assert.equal(chatErrorKey('chat_link_unavailable'), 'chat.errors.unavailable');
    assert.equal(chatErrorKey('surprise'), 'chat.errors.generic');
    assert.equal(chatErrorKey(null), 'chat.errors.generic');
    assert.equal(chatErrorKey('toString'), 'chat.errors.generic');
    assert.equal(Object.keys(CHAT_ERROR_KEYS).length, 6);
  });

  test('retryMinutes rounds up and never shows zero', () => {
    assert.equal(retryMinutes(null), 1);
    assert.equal(retryMinutes(30), 1);
    assert.equal(retryMinutes(61), 2);
    assert.equal(retryMinutes(3600), 60);
  });

  test('pickChatLocale passes only the three supported locales', () => {
    assert.equal(pickChatLocale('zh-TW'), 'zh-TW');
    assert.equal(pickChatLocale('fr'), undefined);
  });
});
