import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CHAT_ERROR_KEYS,
  canCreateCode,
  chatErrorKey,
  deriveChatView,
  formatLinkCode,
  isCodeLive,
  parseChatLinks,
  pickChatLocale,
  retryMinutes,
  shouldPoll,
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
  return { enabled: true, paused: false, link: null, pending: null, ...overrides };
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
    assert.deepEqual(parsed, { enabled: false, paused: false, link: null, pending: null });
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
