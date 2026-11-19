import { HttpException, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { FindOperator } from 'typeorm';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ChatLink } from '../entities/chat-link.entity';
import { ChatLinkCode } from '../entities/chat-link-code.entity';
import { ChatRunDelivery } from '../entities/chat-run-delivery.entity';
import { User } from '../entities/user.entity';
import { EMAIL_PROVIDER } from '../email/email-provider.interface';
import { EmailModule } from '../email/email.module';
import { buildChatLinkMail } from './chat-link-mail';
import { chatLocaleText, chatReply } from './chat-replies';
import {
  CHAT_LINK_CODE_ALPHABET,
  CHAT_LINK_ERROR_CODES,
  CHAT_LINK_NOTICE_TIMEOUT_MS,
  ChatLinkService,
  generateChatLinkCode,
  normalizeChatLinkCode,
  normalizeChatLocale,
} from './chat-link.service';
import { ChatLimits, chatLimitSubjectOfExternalUser, MemoryChatLimitStore } from './chat-limits';
import { CHAT_TRANSPORT, FakeChatTransport } from './chat-transport';
import { ChatModule } from './chat.module';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const THIRD = '33333333-3333-4333-8333-333333333333';
const DISCORD_ID = '987654321098765432';
const DISCORD_OTHER = '123456789012345678';
const DISPLAY_NAME = 'Keith Discord Name';
const START = Date.parse('2026-11-13T10:00:00.000Z');
const MINUTE = 60 * 1000;
const BELL = String.fromCharCode(7);
const HAN = String.fromCharCode(0x5f20);
const HOUR = 60 * MINUTE;

describe('ChatLinkService (CHAT-DISCORD-01 A1)', () => {
  const originalSwitch = process.env.CHAT_DISCORD_ENABLED;
  let store: MemoryStore;
  let service: ChatLinkService;
  let logs: string[];
  let restoreLogs: () => void;

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(START);
    process.env.CHAT_DISCORD_ENABLED = 'true';
    store = new MemoryStore();
    service = new ChatLinkService(store.links as never, store.codes as never);
    logs = [];
    restoreLogs = watchLogs(logs);
  });

  afterEach(() => {
    restoreLogs();
    jest.useRealTimers();
    if (originalSwitch === undefined) delete process.env.CHAT_DISCORD_ENABLED;
    else process.env.CHAT_DISCORD_ENABLED = originalSwitch;
  });

  function advance(ms: number): void {
    jest.setSystemTime(Date.now() + ms);
  }

  async function expectRefusal(promise: Promise<unknown>, status: number, code: string): Promise<void> {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const http = error as HttpException;
      expect(http.getStatus()).toBe(status);
      expect((http.getResponse() as { code?: string }).code).toBe(code);
      return;
    }
    throw new Error(`expected ${status} ${code}`);
  }

  async function linkOwner(userId = OWNER, discordId = DISCORD_ID): Promise<string> {
    const { code } = await service.createCode(userId, 'en');
    expect((await service.claim(code, discordId, DISPLAY_NAME, 'en-US')).outcome).toBe('claimed');
    await service.confirm(userId);
    return code;
  }

  describe('codes', () => {
    it('returns an XXXX-XXXX code once and stores only its SHA-256 hash', async () => {
      const created = await service.createCode(OWNER, 'zh-TW');

      expect(created.channel).toBe('discord');
      expect(created.code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
      expect(created.expiresAt).toBe(new Date(START + 10 * MINUTE).toISOString());

      const plain = created.code.replace('-', '');
      expect(store.codes.rows).toHaveLength(1);
      const row = store.codes.rows[0];
      expect(row.codeHash).toBe(createHash('sha256').update(plain).digest('hex'));
      expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.locale).toBe('zh-TW');
      expect(row.userId).toBe(OWNER);
      expect(row.claimedExternalUserId).toBeNull();
      const stored = JSON.stringify(store.codes.rows);
      expect(stored).not.toContain(plain);
      expect(stored).not.toContain(created.code);

      const state = await service.getState(OWNER);
      expect(JSON.stringify(state)).not.toContain(plain);
      expect(state.discord.pending).toEqual({
        channel: 'discord',
        claimed: false,
        expiresAt: created.expiresAt,
      });
      expect(state.discord.link).toBeNull();
    });

    it('a new code replaces the old one: one live code per owner per channel', async () => {
      const first = await service.createCode(OWNER, 'en');
      const second = await service.createCode(OWNER, 'en');

      expect(second.code).not.toBe(first.code);
      expect(store.codes.rows).toHaveLength(1);
      expect(store.codes.rows[0].codeHash).toBe(
        createHash('sha256').update(second.code.replace('-', '')).digest('hex'),
      );
      const audits = store.audit.rows.filter((row) => row.eventType === 'link_code_created');
      expect(audits.map((row) => (row.payload as { replacedCodes: number }).replacedCodes)).toEqual([0, 1]);
    });

    it('a code for one owner does not replace another owner code', async () => {
      await service.createCode(OWNER, 'en');
      await service.createCode(OTHER, 'en');
      expect(store.codes.rows.map((row) => row.userId).sort()).toEqual([OWNER, OTHER].sort());
    });

    it('expired codes are deleted when the state is read or a code is made', async () => {
      await service.createCode(OWNER, 'en');
      await service.createCode(OTHER, 'en');
      advance(10 * MINUTE);
      const state = await service.getState(OWNER);
      expect(state.discord.pending).toBeNull();
      expect(store.codes.rows).toHaveLength(0);
    });

    it('CHAT-PRUNE-01: pruneExpiredCodes deletes expired codes without a link call, with the switch off, and returns the count', async () => {
      await service.createCode(OWNER, 'en');
      advance(5 * MINUTE);
      await service.createCode(OTHER, 'en');
      advance(5 * MINUTE);
      process.env.CHAT_DISCORD_ENABLED = 'false';
      expect(await service.pruneExpiredCodes(Date.now())).toBe(1);
      expect(store.codes.rows.map((row) => row.userId)).toEqual([OTHER]);
      expect(await service.pruneExpiredCodes()).toBe(0);
    });

    it('generates only alphabet characters, 8 of them, without look-alikes', () => {
      expect(CHAT_LINK_CODE_ALPHABET).toHaveLength(32);
      expect(new Set(CHAT_LINK_CODE_ALPHABET).size).toBe(32);
      for (const lookAlike of ['I', 'O', '0', '1']) {
        expect(CHAT_LINK_CODE_ALPHABET).not.toContain(lookAlike);
      }
      const seen = new Set<string>();
      for (let i = 0; i < 300; i += 1) {
        const code = generateChatLinkCode();
        expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
        seen.add(code);
      }
      expect(seen.size).toBe(300);
    });

    it('normalizes typed codes: case, dash and spaces; refuses look-alikes and other lengths', () => {
      expect(normalizeChatLinkCode('abcd-2345')).toBe('ABCD2345');
      expect(normalizeChatLinkCode(' ABCD 2345 ')).toBe('ABCD2345');
      expect(normalizeChatLinkCode('ABCD-234O')).toBeNull();
      expect(normalizeChatLinkCode('ABCD-2341')).toBeNull();
      expect(normalizeChatLinkCode('ABCD-234')).toBeNull();
      expect(normalizeChatLinkCode('ABCD-23456')).toBeNull();
      expect(normalizeChatLinkCode(12345678)).toBeNull();
      expect(normalizeChatLinkCode(undefined)).toBeNull();
    });

    it('maps locales to en, zh-TW and zh-CN only', () => {
      expect(normalizeChatLocale('en-US')).toBe('en');
      expect(normalizeChatLocale('en-GB')).toBe('en');
      expect(normalizeChatLocale('zh-TW')).toBe('zh-TW');
      expect(normalizeChatLocale('zh-CN')).toBe('zh-CN');
      expect(normalizeChatLocale('ja')).toBe('en');
      expect(normalizeChatLocale(undefined)).toBe('en');
      expect(normalizeChatLocale({})).toBe('en');
    });
  });

  describe('claim and confirm', () => {
    it('a claim alone creates no link; confirm by the signed-in owner does', async () => {
      const { code } = await service.createCode(OWNER, 'zh-CN');

      const claimed = await service.claim(code.toLowerCase(), DISCORD_ID, DISPLAY_NAME, 'en-US');
      expect(claimed).toEqual({ outcome: 'claimed', locale: 'en' });
      expect(store.links.rows).toHaveLength(0);

      const pending = (await service.getState(OWNER)).discord.pending;
      expect(pending).toEqual({
        channel: 'discord',
        claimed: true,
        expiresAt: new Date(START + 10 * MINUTE).toISOString(),
        claimedAt: new Date(START).toISOString(),
        displayName: DISPLAY_NAME,
        externalIdLast4: '5432',
      });
      expect((await service.getState(OTHER)).discord.pending).toBeNull();

      advance(MINUTE);
      const linked = await service.confirm(OWNER);
      expect(linked).toEqual({
        channel: 'discord',
        linkedAt: new Date(START + MINUTE).toISOString(),
        lastUsedAt: null,
        externalIdLast4: '5432',
      });
      expect(store.links.rows).toHaveLength(1);
      expect(store.links.rows[0]).toMatchObject({
        userId: OWNER,
        channel: 'discord',
        externalUserId: DISCORD_ID,
        locale: 'zh-CN',
      });
      expect(store.codes.rows).toHaveLength(0);
      const state = await service.getState(OWNER);
      expect(state.discord.link).toEqual(linked);
      expect(state.discord.pending).toBeNull();
    });

    it('another owner cannot confirm a claim on someone else code', async () => {
      const { code } = await service.createCode(OWNER, 'en');
      await service.claim(code, DISCORD_ID, DISPLAY_NAME, 'en');
      await expectRefusal(service.confirm(OTHER), 404, CHAT_LINK_ERROR_CODES.noPendingClaim);
      expect(store.links.rows).toHaveLength(0);
    });

    it('confirm without a claim, or after the code expired, links nothing', async () => {
      await expectRefusal(service.confirm(OWNER), 404, CHAT_LINK_ERROR_CODES.noPendingClaim);
      await service.createCode(OWNER, 'en');
      await expectRefusal(service.confirm(OWNER), 404, CHAT_LINK_ERROR_CODES.noPendingClaim);

      const { code } = await service.createCode(OWNER, 'en');
      await service.claim(code, DISCORD_ID, DISPLAY_NAME, 'en');
      advance(10 * MINUTE);
      await expectRefusal(service.confirm(OWNER), 404, CHAT_LINK_ERROR_CODES.noPendingClaim);
      expect(store.links.rows).toHaveLength(0);
      expect(store.codes.rows).toHaveLength(0);
    });

    it('gives the same answer for a wrong, used, expired or replaced code, and writes nothing for them', async () => {
      const answers: unknown[] = [];

      // wrong
      answers.push(await service.claim('ABCD-EFGH', '100000000000000001', DISPLAY_NAME, 'en'));
      // malformed
      answers.push(await service.claim('not a code', '100000000000000002', DISPLAY_NAME, 'en'));

      // used
      const used = await service.createCode(OWNER, 'en');
      expect((await service.claim(used.code, '100000000000000003', DISPLAY_NAME, 'en')).outcome).toBe(
        'claimed',
      );
      const afterUse = JSON.stringify(store.codes.rows);
      answers.push(await service.claim(used.code, '100000000000000004', 'Someone Else', 'en'));
      expect(JSON.stringify(store.codes.rows)).toBe(afterUse);

      // replaced
      const replaced = await service.createCode(OTHER, 'en');
      await service.createCode(OTHER, 'en');
      answers.push(await service.claim(replaced.code, '100000000000000005', DISPLAY_NAME, 'en'));

      // expired
      const expired = await service.createCode(THIRD, 'en');
      advance(10 * MINUTE);
      answers.push(await service.claim(expired.code, '100000000000000006', DISPLAY_NAME, 'en'));

      expect(answers).toEqual(Array(5).fill({ outcome: 'invalid', locale: 'en' }));
      expect(store.links.rows).toHaveLength(0);
      expect(store.audit.rows.filter((row) => row.eventType === 'link_claimed')).toHaveLength(1);
    });

    it('a claim cannot overwrite an earlier claim, even in a race', async () => {
      const { code } = await service.createCode(OWNER, 'en');
      const first = service.claim(code, DISCORD_ID, DISPLAY_NAME, 'en');
      const second = service.claim(code, DISCORD_OTHER, 'Attacker', 'en');
      const outcomes = [(await first).outcome, (await second).outcome].sort();
      expect(outcomes).toEqual(['claimed', 'invalid']);
      expect(store.codes.rows[0].claimedExternalUserId).toBe(DISCORD_ID);
      expect(store.codes.rows[0].claimedDisplayName).toBe(DISPLAY_NAME);
    });

    it('refuses an outside user id that is not a number', async () => {
      const { code } = await service.createCode(OWNER, 'en');
      expect((await service.claim(code, 'abc', DISPLAY_NAME, 'en')).outcome).toBe('invalid');
      expect((await service.claim(code, '', DISPLAY_NAME, 'en')).outcome).toBe('invalid');
      expect((await service.claim(code, 12345, DISPLAY_NAME, 'en')).outcome).toBe('invalid');
      expect((await service.claim(code, '1'.repeat(33), DISPLAY_NAME, 'en')).outcome).toBe('invalid');
      expect(store.codes.rows[0].claimedExternalUserId).toBeNull();
    });

    it('holds the display name cleaned and cut to 64 characters, and only on the code row', async () => {
      const { code } = await service.createCode(OWNER, 'en');
      const long = `${BELL} ${HAN.repeat(70)} `;
      await service.claim(code, DISCORD_ID, long, 'zh-CN');
      const name = store.codes.rows[0].claimedDisplayName!;
      expect(Array.from(name)).toHaveLength(64);
      expect(name).toBe(HAN.repeat(64));

      const { code: next } = await service.createCode(OTHER, 'en');
      await service.claim(next, DISCORD_OTHER, '   ', 'en');
      expect(store.codes.rows.find((row) => row.userId === OTHER)?.claimedDisplayName).toBeNull();

      await service.confirm(OWNER);
      expect(JSON.stringify(store.links.rows)).not.toContain(HAN);
    });

    it('cancel deletes the claim; a later confirm links nothing', async () => {
      const { code } = await service.createCode(OWNER, 'en');
      await service.claim(code, DISCORD_ID, DISPLAY_NAME, 'en');

      expect(await service.cancel(OWNER)).toEqual({ channel: 'discord', cancelled: true });
      expect(store.codes.rows).toHaveLength(0);
      await expectRefusal(service.confirm(OWNER), 404, CHAT_LINK_ERROR_CODES.noPendingClaim);
      expect(await service.cancel(OWNER)).toEqual({ channel: 'discord', cancelled: false });
      expect(store.audit.rows.filter((row) => row.eventType === 'link_cancelled')).toHaveLength(1);
      expect(store.links.rows).toHaveLength(0);
    });
  });

  describe('one to one', () => {
    it('an owner with a link cannot make a code or confirm a second link', async () => {
      await linkOwner();
      await expectRefusal(service.createCode(OWNER, 'en'), 409, CHAT_LINK_ERROR_CODES.exists);
      expect(store.codes.rows).toHaveLength(0);
    });

    it('a linked outside account cannot claim another owner code', async () => {
      await linkOwner(OWNER, DISCORD_ID);
      const { code } = await service.createCode(OTHER, 'en');
      expect(await service.claim(code, DISCORD_ID, DISPLAY_NAME, 'en')).toEqual({
        outcome: 'already_linked',
        locale: 'en',
      });
      expect(store.codes.rows[0].claimedExternalUserId).toBeNull();
    });

    it('confirm refuses when the claiming account was linked to another owner in the meantime', async () => {
      const mine = await service.createCode(OWNER, 'en');
      const theirs = await service.createCode(OTHER, 'en');
      await service.claim(mine.code, DISCORD_ID, DISPLAY_NAME, 'en');
      await service.claim(theirs.code, DISCORD_OTHER, DISPLAY_NAME, 'en');
      // The other owner's claim is rewritten to the same outside account (a race the index must stop).
      store.codes.rows.find((row) => row.userId === OTHER)!.claimedExternalUserId = DISCORD_ID;

      await service.confirm(OWNER);
      await expectRefusal(service.confirm(OTHER), 409, CHAT_LINK_ERROR_CODES.taken);
      expect(store.links.rows).toHaveLength(1);
      expect(store.links.rows[0].userId).toBe(OWNER);
    });

    it('the unique indexes stop a second row even when the read checks are raced', async () => {
      const mine = await service.createCode(OWNER, 'en');
      await service.claim(mine.code, DISCORD_ID, DISPLAY_NAME, 'en');
      // A row for the same outside account lands between the checks and the insert.
      const findOne = store.links.findOne.bind(store.links);
      let calls = 0;
      jest.spyOn(store.links, 'findOne').mockImplementation(async (options) => {
        calls += 1;
        const result = await findOne(options);
        if (calls === 2) {
          store.links.rows.push({
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            userId: OTHER,
            channel: 'discord',
            externalUserId: DISCORD_ID,
            locale: 'en',
            createdAt: new Date(),
            lastUsedAt: null,
          });
        }
        return result;
      });

      await expectRefusal(service.confirm(OWNER), 409, CHAT_LINK_ERROR_CODES.taken);
      expect(store.links.rows.filter((row) => row.userId === OWNER)).toHaveLength(0);
      // The transaction rolled back: the claim and its code are still there, no audit row.
      expect(store.codes.rows).toHaveLength(1);
      expect(store.audit.rows.filter((row) => row.eventType === 'link_confirmed')).toHaveLength(0);
    });

    it('the memory store enforces both unique indexes like the migration', async () => {
      await store.links.insert(linkRow('a', OWNER, DISCORD_ID));
      await expect(store.links.insert(linkRow('b', OWNER, DISCORD_OTHER))).rejects.toMatchObject({
        code: '23505',
      });
      await expect(store.links.insert(linkRow('c', OTHER, DISCORD_ID))).rejects.toMatchObject({
        code: '23505',
      });
      await store.links.insert(linkRow('d', OTHER, DISCORD_OTHER));
      expect(store.links.rows).toHaveLength(2);
    });
  });

  describe('unlink deletes the delivery rows (C1, acceptance 7)', () => {
    function deliveryRow(collaborationRunId: string, linkId: string, status = 'waiting'): ChatRunDelivery {
      return {
        collaborationRunId,
        linkId,
        status: status as ChatRunDelivery['status'],
        notifiedReferralIds: [],
        createdAt: new Date(),
        deliveredAt: null,
      };
    }

    beforeEach(() => {
      service = new ChatLinkService(store.links as never, store.codes as never, store.deliveries as never);
    });

    it('the page unlink deletes the link and its delivery rows in one transaction; other links keep theirs', async () => {
      await linkOwner();
      await linkOwner(OTHER, DISCORD_OTHER);
      const ownerLink = store.links.rows.find((row) => row.userId === OWNER)!.id;
      const otherLink = store.links.rows.find((row) => row.userId === OTHER)!.id;
      store.deliveries.rows.push(deliveryRow('run-1', ownerLink), deliveryRow('run-2', ownerLink, 'delivered'));
      store.deliveries.rows.push(deliveryRow('run-3', otherLink));

      expect(await service.unlink(OWNER)).toEqual({ channel: 'discord', removed: true });
      expect(store.deliveries.rows.map((row) => row.collaborationRunId)).toEqual(['run-3']);
      const removed = store.audit.rows.filter((row) => row.eventType === 'link_removed');
      expect(removed[0].payload).toEqual({ channel: 'discord', linkId: ownerLink, removedCodes: 0, removedDeliveries: 2 });
    });

    it('/unlink in the chat deletes them too', async () => {
      await linkOwner();
      const linkId = store.links.rows[0].id;
      store.deliveries.rows.push(deliveryRow('run-1', linkId));
      expect(await service.unlinkByExternalUser('discord', DISCORD_ID)).toEqual({ channel: 'discord', removed: true });
      expect(store.deliveries.rows).toEqual([]);
      expect(store.audit.rows.find((row) => row.eventType === 'link_removed')!.payload).toMatchObject({
        removedDeliveries: 1,
        source: 'chat_command',
      });
    });

    it('a failed unlink keeps the rows (rolled back with the link)', async () => {
      await linkOwner();
      const linkId = store.links.rows[0].id;
      store.deliveries.rows.push(deliveryRow('run-1', linkId));
      store.links.delete = async () => {
        throw new Error('boom');
      };
      await expect(service.unlink(OWNER)).rejects.toThrow('boom');
      expect(store.deliveries.rows).toHaveLength(1);
      expect(store.links.rows).toHaveLength(1);
    });

    it('Nest injects the delivery repository, and ChatModule registers it', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          ChatLinkService,
          { provide: getRepositoryToken(ChatLink), useValue: store.links },
          { provide: getRepositoryToken(ChatLinkCode), useValue: store.codes },
          { provide: getRepositoryToken(ChatRunDelivery), useValue: store.deliveries },
        ],
      }).compile();
      const injected = moduleRef.get(ChatLinkService);
      await injected.createCode(OWNER, 'en');
      const { code } = await injected.createCode(OWNER, 'en');
      await injected.claim(code, DISCORD_ID, DISPLAY_NAME, 'en');
      await injected.confirm(OWNER);
      store.deliveries.rows.push(deliveryRow('run-1', store.links.rows[0].id));
      await injected.unlink(OWNER);
      expect(store.deliveries.rows).toEqual([]);

      const imports = Reflect.getMetadata('imports', ChatModule) as Array<{ providers?: Array<{ provide?: unknown }> }>;
      const token = getRepositoryToken(ChatRunDelivery);
      expect(
        imports.some((entry) => Array.isArray(entry?.providers) && entry.providers.some((provider) => provider?.provide === token)),
      ).toBe(true);
    });
  });

  describe('unlink', () => {
    it('deletes the link and every code of the owner', async () => {
      await linkOwner();
      // A stray code row for the same owner (for example from a race) goes too.
      store.codes.rows.push(codeRow('stray', OWNER));
      store.codes.rows.push(codeRow('other', OTHER));

      expect(await service.unlink(OWNER)).toEqual({ channel: 'discord', removed: true });
      expect(store.links.rows).toHaveLength(0);
      expect(store.codes.rows.map((row) => row.userId)).toEqual([OTHER]);
      const removed = store.audit.rows.filter((row) => row.eventType === 'link_removed');
      expect(removed).toHaveLength(1);
      expect(removed[0].payload).toMatchObject({ channel: 'discord', removedCodes: 1 });

      expect(await service.unlink(OWNER)).toEqual({ channel: 'discord', removed: false });
      expect(store.audit.rows.filter((row) => row.eventType === 'link_removed')).toHaveLength(1);
    });

    it('after unlink the outside account can link again', async () => {
      await linkOwner();
      await service.unlink(OWNER);
      await linkOwner(OTHER, DISCORD_ID);
      expect(store.links.rows).toHaveLength(1);
      expect(store.links.rows[0].userId).toBe(OTHER);
    });
  });

  describe('by outside user (slice B commands)', () => {
    it('useLinkByExternalUser returns the owner and language, and updates last_used_at', async () => {
      await linkOwner();
      await service.setLinkLocaleByExternalUser('discord', DISCORD_ID, 'zh-TW');
      store.links.rows[0].lastUsedAt = null;
      advance(MINUTE);

      const use = await service.useLinkByExternalUser('discord', DISCORD_ID);
      expect(use).toEqual({ linkId: store.links.rows[0].id, userId: OWNER, locale: 'zh-TW' });
      expect(JSON.stringify(use)).not.toContain(DISCORD_ID);
      expect(store.links.rows[0].lastUsedAt?.getTime()).toBe(START + MINUTE);
    });

    it('useLinkByExternalUser: no link, a malformed id or the switch off gives null and writes nothing', async () => {
      await linkOwner();
      store.resetCalls();
      expect(await service.useLinkByExternalUser('discord', DISCORD_OTHER)).toBeNull();
      expect(await service.useLinkByExternalUser('discord', 'abc')).toBeNull();
      expect(await service.useLinkByExternalUser('discord', 42)).toBeNull();
      expect(store.calls).toEqual(['links.findOne']);
      process.env.CHAT_DISCORD_ENABLED = 'false';
      store.resetCalls();
      expect(await service.useLinkByExternalUser('discord', DISCORD_ID)).toBeNull();
      expect(store.calls).toEqual([]);
    });

    it('setLinkLocaleByExternalUser stores only the three languages, only on an existing link', async () => {
      expect(await service.setLinkLocaleByExternalUser('discord', DISCORD_ID, 'zh-CN')).toBe(false);
      await linkOwner();
      expect(await service.setLinkLocaleByExternalUser('discord', DISCORD_ID, 'zh-CN')).toBe(true);
      expect(store.links.rows[0].locale).toBe('zh-CN');
      expect(store.links.rows[0].lastUsedAt).toBeInstanceOf(Date);
      expect(await service.setLinkLocaleByExternalUser('discord', DISCORD_ID, 'fr' as never)).toBe(false);
      expect(store.links.rows[0].locale).toBe('zh-CN');
      process.env.CHAT_DISCORD_ENABLED = 'false';
      expect(await service.setLinkLocaleByExternalUser('discord', DISCORD_ID, 'en')).toBe(false);
      expect(store.links.rows[0].locale).toBe('zh-CN');
    });

    it('unlinkByExternalUser deletes the link and every code of that owner, with one audit row', async () => {
      await linkOwner();
      store.codes.rows.push(codeRow('stray', OWNER));
      store.codes.rows.push(codeRow('other', OTHER));
      store.links.rows.push(linkRow('b', THIRD, DISCORD_OTHER));

      expect(await service.unlinkByExternalUser('discord', DISCORD_ID)).toEqual({ channel: 'discord', removed: true });
      expect(store.links.rows.map((row) => row.userId)).toEqual([THIRD]);
      expect(store.codes.rows.map((row) => row.userId)).toEqual([OTHER]);
      const removed = store.audit.rows.filter((row) => row.eventType === 'link_removed');
      expect(removed).toHaveLength(1);
      expect(removed[0]).toMatchObject({ category: 'chat', subjectType: 'chat_link', userId: OWNER });
      expect(removed[0].payload).toEqual({
        channel: 'discord',
        linkId: removed[0].subjectId,
        removedCodes: 1,
        source: 'chat_command',
      });
      expect(JSON.stringify(store.audit.rows)).not.toContain(DISCORD_ID);
      expect(logs.join('\n')).not.toContain(DISCORD_ID);

      expect(await service.unlinkByExternalUser('discord', DISCORD_ID)).toEqual({ channel: 'discord', removed: false });
      expect(store.audit.rows.filter((row) => row.eventType === 'link_removed')).toHaveLength(1);
    });

    it('unlinkByExternalUser: switch off or a malformed id writes nothing', async () => {
      await linkOwner();
      store.resetCalls();
      expect(await service.unlinkByExternalUser('discord', 'not-a-number')).toEqual({
        channel: 'discord',
        removed: false,
      });
      process.env.CHAT_DISCORD_ENABLED = 'false';
      expect(await service.unlinkByExternalUser('discord', DISCORD_ID)).toEqual({ channel: 'discord', removed: false });
      expect(store.calls).toEqual([]);
      expect(store.links.rows).toHaveLength(1);
    });
  });

  describe('limits', () => {
    it('5 code creations per owner per hour, then 429 until the hour has passed', async () => {
      for (let i = 0; i < 5; i += 1) {
        await service.createCode(OWNER, 'en');
        advance(MINUTE);
      }
      const before = JSON.stringify(store.codes.rows);
      await expectRefusal(service.createCode(OWNER, 'en'), 429, CHAT_LINK_ERROR_CODES.rateLimited);
      expect(JSON.stringify(store.codes.rows)).toBe(before);

      await service.createCode(OTHER, 'en');

      advance(HOUR - 5 * MINUTE + 1);
      await service.createCode(OWNER, 'en');
      await expectRefusal(service.createCode(OWNER, 'en'), 429, CHAT_LINK_ERROR_CODES.rateLimited);
      expect(store.audit.rows.filter((row) => row.eventType === 'link_code_created')).toHaveLength(7);
    });

    it('the 429 answer says when to try again', async () => {
      for (let i = 0; i < 5; i += 1) await service.createCode(OWNER, 'en');
      try {
        await service.createCode(OWNER, 'en');
        throw new Error('expected 429');
      } catch (error) {
        expect((error as HttpException).getResponse()).toEqual({
          statusCode: 429,
          message: 'Too many link codes, try again later',
          error: 'Too Many Requests',
          code: 'chat_link_rate_limited',
          retryAfterSeconds: 3600,
        });
      }
    });

    it('5 claim attempts per outside user per hour, then silence, even with a right code', async () => {
      const { code } = await service.createCode(OWNER, 'en');
      for (let i = 0; i < 5; i += 1) {
        expect((await service.claim('ZZZZ-ZZZZ', DISCORD_OTHER, DISPLAY_NAME, 'en')).outcome).toBe('invalid');
      }
      expect(await service.claim(code, DISCORD_OTHER, DISPLAY_NAME, 'zh-TW')).toEqual({
        outcome: 'silenced',
        locale: 'zh-TW',
      });
      expect(store.codes.rows[0].claimedExternalUserId).toBeNull();

      // Another outside user is not silenced.
      expect((await service.claim(code, DISCORD_ID, DISPLAY_NAME, 'en')).outcome).toBe('claimed');

      advance(HOUR);
      const { code: next } = await service.createCode(OTHER, 'en');
      expect((await service.claim(next, DISCORD_OTHER, DISPLAY_NAME, 'en')).outcome).toBe('claimed');
    });

    it('more than 100 failed claims in an hour pauses linking for an hour with one audit row', async () => {
      const { code } = await service.createCode(OWNER, 'en');
      let user = 0;
      for (let i = 0; i < 100; i += 1) {
        if (i % 5 === 0) user += 1;
        expect((await service.claim('ZZZZ-ZZZZ', outsideId('2', user), DISPLAY_NAME, 'en')).outcome).toBe('invalid');
      }
      expect((await service.getState(OWNER)).paused).toBe(false);
      expect(store.audit.rows.filter((row) => row.eventType === 'link_attempts_paused')).toHaveLength(0);

      // The 101st failure: still the same answer, and linking pauses.
      expect((await service.claim('ZZZZ-ZZZZ', '299999999999999999', DISPLAY_NAME, 'en')).outcome).toBe(
        'invalid',
      );
      const paused = store.audit.rows.filter((row) => row.eventType === 'link_attempts_paused');
      expect(paused).toHaveLength(1);
      expect(paused[0]).toMatchObject({
        category: 'chat',
        subjectType: 'chat_channel',
        subjectId: 'discord',
        userId: null,
        payload: { channel: 'discord', failedAttempts: 101, windowMinutes: 60, pauseMinutes: 60 },
      });
      expect((await service.getState(OWNER)).paused).toBe(true);

      expect(await service.claim(code, DISCORD_ID, DISPLAY_NAME, 'en')).toEqual({
        outcome: 'paused',
        locale: 'en',
      });
      expect(store.codes.rows[0].claimedExternalUserId).toBeNull();
      await expectRefusal(service.createCode(OTHER, 'en'), 503, CHAT_LINK_ERROR_CODES.paused);
      await expectRefusal(service.confirm(OWNER), 503, CHAT_LINK_ERROR_CODES.paused);

      advance(HOUR);
      expect((await service.getState(OWNER)).paused).toBe(false);
      const { code: fresh } = await service.createCode(OWNER, 'en');
      expect((await service.claim(fresh, DISCORD_ID, DISPLAY_NAME, 'en')).outcome).toBe('claimed');
      await service.confirm(OWNER);
      expect(store.links.rows).toHaveLength(1);
    });

    describe('CHAT-STATE-PERSIST-01: the limits are rows, so a restart (a new service over the same rows) keeps them', () => {
      let limitRows: MemoryChatLimitStore;

      function instance(): ChatLinkService {
        return new ChatLinkService(store.links as never, store.codes as never, undefined, undefined, ChatLimits.inMemory(limitRows));
      }

      beforeEach(() => {
        limitRows = new MemoryChatLimitStore();
        service = instance();
      });

      it('the fifth code this hour is still the fifth after a restart; the sixth is refused with the time from the oldest row', async () => {
        for (let i = 0; i < 5; i += 1) {
          await service.createCode(OWNER, 'en');
          advance(MINUTE);
        }
        service = instance();
        try {
          await service.createCode(OWNER, 'en');
          throw new Error('expected 429');
        } catch (error) {
          expect((error as HttpException).getStatus()).toBe(429);
          expect((error as HttpException).getResponse()).toMatchObject({
            code: CHAT_LINK_ERROR_CODES.rateLimited,
            retryAfterSeconds: (HOUR - 5 * MINUTE) / 1000,
          });
        }
        advance(HOUR - 5 * MINUTE + 1);
        service = instance();
        await service.createCode(OWNER, 'en');
        // Rows older than the window are deleted on the write.
        expect(limitRows.rows.filter((row) => row.bucket === 'code_create')).toHaveLength(5);
      });

      it('the sixth claim attempt is silenced after a restart; the limit key is the SHA-256 of the Discord id, never the id', async () => {
        for (let i = 0; i < 5; i += 1) {
          expect((await service.claim('ZZZZ-ZZZZ', DISCORD_OTHER, DISPLAY_NAME, 'en')).outcome).toBe('invalid');
        }
        service = instance();
        const { code } = await service.createCode(OWNER, 'en');
        expect((await service.claim(code, DISCORD_OTHER, DISPLAY_NAME, 'en')).outcome).toBe('silenced');
        const attempts = limitRows.rows.filter((row) => row.bucket === 'claim_attempt');
        expect(attempts).toHaveLength(5);
        expect(new Set(attempts.map((row) => row.subjectKey))).toEqual(new Set([chatLimitSubjectOfExternalUser(DISCORD_OTHER)]));
        expect(chatLimitSubjectOfExternalUser(DISCORD_OTHER)).toBe(createHash('sha256').update(DISCORD_OTHER).digest('hex'));
        expect(JSON.stringify(limitRows.rows)).not.toContain(DISCORD_OTHER);
      });

      it('failure 101 pauses once with one audit row; the pause survives a restart and lasts its full hour', async () => {
        let user = 0;
        for (let i = 0; i < 100; i += 1) {
          if (i % 5 === 0) user += 1;
          await service.claim('ZZZZ-ZZZZ', outsideId('4', user), DISPLAY_NAME, 'en');
          // A restart in the middle of the count changes nothing.
          if (i === 50) service = instance();
        }
        expect((await service.getState(OWNER)).paused).toBe(false);
        await service.claim('ZZZZ-ZZZZ', '499999999999999999', DISPLAY_NAME, 'en');
        expect(store.audit.rows.filter((row) => row.eventType === 'link_attempts_paused')).toHaveLength(1);
        expect(limitRows.rows.filter((row) => row.bucket === 'link_pause')).toHaveLength(1);
        // The failures are cleared with the pause, as the in-memory counter was.
        expect(limitRows.rows.filter((row) => row.bucket === 'claim_failed')).toHaveLength(0);

        service = instance();
        expect((await service.getState(OWNER)).paused).toBe(true);
        expect((await service.claim('ZZZZ-ZZZZ', '499999999999999998', DISPLAY_NAME, 'en')).outcome).toBe('paused');
        await expectRefusal(service.createCode(OTHER, 'en'), 503, CHAT_LINK_ERROR_CODES.paused);
        advance(HOUR - 1);
        service = instance();
        expect((await service.getState(OWNER)).paused).toBe(true);
        advance(1);
        expect((await service.getState(OWNER)).paused).toBe(false);
        expect(store.audit.rows.filter((row) => row.eventType === 'link_attempts_paused')).toHaveLength(1);
      });

      it('two services over the same rows (two processes): failure 101 pauses once, with one audit row', async () => {
        const other = instance();
        let user = 0;
        const claims: Array<Promise<unknown>> = [];
        for (let i = 0; i < 104; i += 1) {
          if (i % 5 === 0) user += 1;
          claims.push((i % 2 === 0 ? service : other).claim('ZZZZ-ZZZZ', outsideId('5', user), DISPLAY_NAME, 'en'));
        }
        await Promise.all(claims);
        expect(store.audit.rows.filter((row) => row.eventType === 'link_attempts_paused')).toHaveLength(1);
        expect(limitRows.rows.filter((row) => row.bucket === 'link_pause')).toHaveLength(1);
      });

      it('a store error refuses the action and writes nothing', async () => {
        const broken = {
          locked: async () => {
            throw new Error('db down');
          },
          times: async () => {
            throw new Error('db down');
          },
          pruneUpTo: async () => 0,
        };
        service = new ChatLinkService(store.links as never, store.codes as never, undefined, undefined, ChatLimits.inMemory(broken));
        await expectRefusal(service.createCode(OWNER, 'en'), 503, CHAT_LINK_ERROR_CODES.unavailable);
        await expectRefusal(service.confirm(OWNER), 503, CHAT_LINK_ERROR_CODES.unavailable);
        expect(await service.claim('ZZZZ-ZZZZ', DISCORD_ID, DISPLAY_NAME, 'zh-CN')).toEqual({ outcome: 'unavailable', locale: 'zh-CN' });
        expect(store.codes.rows).toEqual([]);
        expect(store.audit.rows).toEqual([]);
        expect(logs).toContain('chat link limit store failed action=pause_check');
      });
    });

    it('failures older than an hour do not count toward the pause', async () => {
      let user = 0;
      for (let i = 0; i < 100; i += 1) {
        if (i % 5 === 0) user += 1;
        await service.claim('ZZZZ-ZZZZ', outsideId('3', user), DISPLAY_NAME, 'en');
      }
      advance(HOUR);
      await service.claim('ZZZZ-ZZZZ', '399999999999999999', DISPLAY_NAME, 'en');
      expect((await service.getState(OWNER)).paused).toBe(false);
    });
  });

  describe('switch off', () => {
    it('writes nothing, reads nothing, and answers not available', async () => {
      const { code } = await service.createCode(OWNER, 'en');
      const linksBefore = JSON.stringify(store.links.rows);
      const codesBefore = JSON.stringify(store.codes.rows);
      const auditBefore = store.audit.rows.length;
      process.env.CHAT_DISCORD_ENABLED = 'false';
      store.resetCalls();

      expect(await service.getState(OWNER)).toEqual({
        enabled: false,
        paused: false,
        discord: { link: null, pending: null, installUrl: null, botProfileUrl: null },
      });
      await expectRefusal(service.createCode(OWNER, 'en'), 503, CHAT_LINK_ERROR_CODES.unavailable);
      await expectRefusal(service.confirm(OWNER), 503, CHAT_LINK_ERROR_CODES.unavailable);
      await expectRefusal(service.cancel(OWNER), 503, CHAT_LINK_ERROR_CODES.unavailable);
      await expectRefusal(service.unlink(OWNER), 503, CHAT_LINK_ERROR_CODES.unavailable);
      expect(await service.claim(code, DISCORD_ID, DISPLAY_NAME, 'zh-CN')).toEqual({
        outcome: 'unavailable',
        locale: 'zh-CN',
      });

      expect(store.calls).toEqual([]);
      expect(JSON.stringify(store.links.rows)).toBe(linksBefore);
      expect(JSON.stringify(store.codes.rows)).toBe(codesBefore);
      expect(store.audit.rows).toHaveLength(auditBefore);
    });

    it.each([undefined, '', 'TRUE', '1'])('treats CHAT_DISCORD_ENABLED=%p as off', async (value) => {
      if (value === undefined) delete process.env.CHAT_DISCORD_ENABLED;
      else process.env.CHAT_DISCORD_ENABLED = value;
      await expectRefusal(service.createCode(OWNER, 'en'), 503, CHAT_LINK_ERROR_CODES.unavailable);
      expect(store.calls).toEqual([]);
    });
  });

  describe('install and bot links (CHAT-USER-INSTALL-01)', () => {
    const LINKS = {
      installUrl: 'https://discord.com/oauth2/authorize?client_id=111111111111111111&integration_type=1&scope=applications.commands',
      botProfileUrl: 'https://discord.com/users/222222222222222222',
    };

    it('the state carries the transport links while the connection is ready', async () => {
      const transport = new FakeChatTransport();
      transport.links = LINKS;
      await transport.connect(async () => null);
      service = new ChatLinkService(store.links as never, store.codes as never, undefined, transport);
      const state = await service.getState(OWNER);
      expect(state).toEqual({
        enabled: true,
        paused: false,
        discord: { link: null, pending: null, ...LINKS },
      });
      // Linked owners get them too (to open the bot again).
      await linkOwner();
      expect((await service.getState(OWNER)).discord).toMatchObject(LINKS);
    });

    it('null while not connected, without a transport, with the switch off, or when the transport throws', async () => {
      const transport = new FakeChatTransport();
      transport.links = LINKS;
      service = new ChatLinkService(store.links as never, store.codes as never, undefined, transport);
      expect((await service.getState(OWNER)).discord).toMatchObject({ installUrl: null, botProfileUrl: null });

      service = new ChatLinkService(store.links as never, store.codes as never);
      expect((await service.getState(OWNER)).discord).toMatchObject({ installUrl: null, botProfileUrl: null });

      await transport.connect(async () => null);
      service = new ChatLinkService(store.links as never, store.codes as never, undefined, transport);
      process.env.CHAT_DISCORD_ENABLED = 'false';
      expect((await service.getState(OWNER)).discord).toMatchObject({ installUrl: null, botProfileUrl: null });
      process.env.CHAT_DISCORD_ENABLED = 'true';

      transport.installLinks = () => {
        throw new Error('boom');
      };
      expect((await service.getState(OWNER)).discord).toMatchObject({ installUrl: null, botProfileUrl: null });
    });

    it('Nest injects the transport by token; the state has no secret', async () => {
      const transport = new FakeChatTransport();
      transport.links = LINKS;
      await transport.connect(async () => null);
      const moduleRef = await Test.createTestingModule({
        providers: [
          ChatLinkService,
          { provide: getRepositoryToken(ChatLink), useValue: store.links },
          { provide: getRepositoryToken(ChatLinkCode), useValue: store.codes },
          { provide: CHAT_TRANSPORT, useValue: transport },
        ],
      }).compile();
      const state = await moduleRef.get(ChatLinkService).getState(OWNER);
      expect(state.discord).toMatchObject(LINKS);
      expect(JSON.stringify(state)).not.toMatch(/token|secret/i);
    });
  });

  describe('audit and logs', () => {
    it('audit rows are category chat and hold ids, reason codes and counts only', async () => {
      const first = await linkOwner();
      await service.unlink(OWNER);
      const { code: second } = await service.createCode(OWNER, 'en');
      await service.claim(second, DISCORD_OTHER, DISPLAY_NAME, 'en');
      await service.cancel(OWNER);

      const events = store.audit.rows.map((row) => row.eventType);
      expect(events).toEqual([
        'link_code_created',
        'link_claimed',
        'link_confirmed',
        'link_removed',
        'link_code_created',
        'link_claimed',
        'link_cancelled',
      ]);
      for (const row of store.audit.rows) {
        expect(row.category).toBe('chat');
        expect(['chat_link', 'chat_link_code', 'user']).toContain(row.subjectType);
        for (const value of Object.values(row.payload as Record<string, unknown>)) {
          expect(['string', 'number']).toContain(typeof value);
        }
      }
      const linkId = (store.audit.rows[2].payload as { linkId: string }).linkId;
      expect(store.audit.rows[2]).toMatchObject({ subjectType: 'chat_link', subjectId: linkId, userId: OWNER });

      const everything = JSON.stringify(store.audit.rows);
      expectAbsent(secretsOf([first, second], [DISCORD_ID, DISCORD_OTHER]), everything);
      expect(everything).not.toContain(DISPLAY_NAME);
    });

    it('logs never hold the code, its hash, the outside user id or the display name', async () => {
      const code = await linkOwner();
      await service.claim('ZZZZ-ZZZZ', DISCORD_OTHER, DISPLAY_NAME, 'en');
      let user = 0;
      for (let i = 0; i < 101; i += 1) {
        if (i % 5 === 0) user += 1;
        await service.claim('YYYY-YYYY', outsideId('4', user), DISPLAY_NAME, 'en');
      }
      await service.unlink(OWNER);

      expect(logs.length).toBeGreaterThan(0);
      const all = logs.join('\n');
      expectAbsent(secretsOf([code, 'ZZZZ-ZZZZ', 'YYYY-YYYY'], [DISCORD_ID, DISCORD_OTHER]), all);
      expect(all).not.toContain(DISPLAY_NAME);
      expect(all).not.toMatch(/4000000000000000\d\d/);
    });
  });

  describe('link notices (CHAT-LINK-NOTICE-01)', () => {
    const EMAIL = 'owner-mail@example.test';
    const BASE = 'https://ainow.example';
    const originalBase = process.env.APP_BASE_URL;
    let transport: FakeChatTransport;
    let mailer: { sendEmail: jest.Mock };
    let users: { findOne: jest.Mock };
    let addresses: Map<string, string | null>;

    type SentMail = { to: string; subject: string; html: string; text: string };

    function mails(): SentMail[] {
      return mailer.sendEmail.mock.calls.map((call) => call[0] as SentMail);
    }

    function linkIdOf(userId = OWNER): string {
      return store.links.rows.find((row) => row.userId === userId)!.id;
    }

    function expected(event: 'linked' | 'unlinked', locale: 'en' | 'zh-TW' | 'zh-CN', at: number): SentMail {
      return {
        to: EMAIL,
        ...buildChatLinkMail({ event, locale, externalIdLast4: '5432', at: new Date(at), appBaseUrl: BASE }),
      };
    }

    function expectNothingSecret(text: string, code: string): void {
      expectAbsent(secretsOf([code], [DISCORD_ID]), text);
      expect(text).not.toContain(DISPLAY_NAME);
      expect(text).not.toMatch(/token/i);
    }

    async function claimAs(locale = 'en', discordId = DISCORD_ID): Promise<string> {
      const { code } = await service.createCode(OWNER, locale);
      expect((await service.claim(code, discordId, DISPLAY_NAME, 'en-US')).outcome).toBe('claimed');
      return code;
    }

    async function flushUntil(done: () => boolean): Promise<void> {
      for (let i = 0; i < 200 && !done(); i += 1) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      expect(done()).toBe(true);
    }

    beforeEach(() => {
      process.env.APP_BASE_URL = BASE;
      transport = new FakeChatTransport();
      // CHAT-TIDY-01: a connected transport (a fake that is not ready now refuses to send).
      transport.state = 'ready';
      mailer = { sendEmail: jest.fn(async () => undefined) };
      addresses = new Map<string, string | null>([[OWNER, EMAIL]]);
      users = {
        findOne: jest.fn(async (options: { where: { id: string } }) =>
          addresses.has(options.where.id) ? { id: options.where.id, email: addresses.get(options.where.id) } : null,
        ),
      };
      service = new ChatLinkService(
        store.links as never,
        store.codes as never,
        store.deliveries as never,
        transport,
        undefined,
        users as never,
        mailer as never,
      );
    });

    afterEach(() => {
      if (originalBase === undefined) delete process.env.APP_BASE_URL;
      else process.env.APP_BASE_URL = originalBase;
    });

    it('confirm sends one e-mail in the link language and one Discord confirmation; nothing secret', async () => {
      const code = await claimAs('zh-TW');
      const view = await service.confirm(OWNER);
      expect(view.externalIdLast4).toBe('5432');
      const linkId = linkIdOf();

      expect(mails()).toEqual([expected('linked', 'zh-TW', START)]);
      const [mail] = mails();
      for (const part of [mail.text, mail.html]) {
        expect(part).toContain('5432');
        expect(part).toContain('2026-11-13 10:00 UTC');
        expect(part).toContain(`${BASE}/zh-TW/connections`);
      }
      expect(mail.subject).toBe(chatLocaleText('zh-TW', 'mail.linked.subject'));
      expectNothingSecret(JSON.stringify(mail), code);
      expect(users.findOne).toHaveBeenCalledWith({ where: { id: OWNER }, select: { id: true, email: true } });

      expect(transport.directMessages).toEqual([
        { externalUserId: DISCORD_ID, message: { text: chatReply('zh-TW', 'link.confirmed') } },
      ]);

      expect(logs).toContain(`chat link mail sent event=linked userId=${OWNER} linkId=${linkId}`);
      expect(logs).toContain(`chat link confirmation sent userId=${OWNER} linkId=${linkId}`);
      const all = logs.join('\n');
      expect(all).not.toContain(EMAIL);
      expectNothingSecret(all, code);
    });

    it('the page unlink sends one e-mail in the link language (after /language), and no Discord message', async () => {
      await claimAs('en');
      await service.confirm(OWNER);
      const linkId = linkIdOf();
      await service.setLinkLocaleByExternalUser('discord', DISCORD_ID, 'zh-CN');
      mailer.sendEmail.mockClear();
      transport.directMessages.length = 0;
      advance(5 * MINUTE);

      expect(await service.unlink(OWNER)).toEqual({ channel: 'discord', removed: true });
      expect(mails()).toEqual([expected('unlinked', 'zh-CN', START + 5 * MINUTE)]);
      expect(mails()[0].text).toContain(`${BASE}/zh-CN/connections`);
      expect(mails()[0].text).toContain('2026-11-13 10:05 UTC');
      expect(transport.directMessages).toEqual([]);
      expect(logs).toContain(`chat link mail sent event=unlinked userId=${OWNER} linkId=${linkId}`);

      // Nothing to remove: nothing sent.
      expect(await service.unlink(OWNER)).toEqual({ channel: 'discord', removed: false });
      expect(mailer.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('/unlink in Discord sends one e-mail in the link language', async () => {
      const code = await claimAs('en');
      await service.confirm(OWNER);
      mailer.sendEmail.mockClear();

      expect(await service.unlinkByExternalUser('discord', DISCORD_ID)).toEqual({ channel: 'discord', removed: true });
      expect(mails()).toEqual([expected('unlinked', 'en', START)]);
      expect(mails()[0].subject).toBe('A Discord account was unlinked from your account');
      expect(mails()[0].text).toContain('If this was not you, change your password.');
      expectNothingSecret(JSON.stringify(mails()), code);

      // Again: no link, nothing sent.
      expect(await service.unlinkByExternalUser('discord', DISCORD_ID)).toEqual({ channel: 'discord', removed: false });
      expect(mailer.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('a mailer failure never breaks or undoes the confirm or either unlink', async () => {
      mailer.sendEmail.mockRejectedValue(new Error(`provider down for ${EMAIL}`));
      await claimAs();
      const view = await service.confirm(OWNER);
      expect(view.channel).toBe('discord');
      expect(store.links.rows).toHaveLength(1);
      const linkId = linkIdOf();
      expect(transport.directMessages).toHaveLength(1);
      expect(logs).toContain(`chat link mail failed event=linked userId=${OWNER} linkId=${linkId} reason=send_failed`);

      expect(await service.unlink(OWNER)).toEqual({ channel: 'discord', removed: true });
      expect(store.links.rows).toHaveLength(0);
      expect(logs).toContain(`chat link mail failed event=unlinked userId=${OWNER} linkId=${linkId} reason=send_failed`);

      // A mailer that throws at once is contained too.
      mailer.sendEmail.mockImplementation(() => {
        throw new Error('sync failure');
      });
      await claimAs();
      await service.confirm(OWNER);
      expect(store.links.rows).toHaveLength(1);
      expect(await service.unlinkByExternalUser('discord', DISCORD_ID)).toEqual({ channel: 'discord', removed: true });
      expect(store.links.rows).toHaveLength(0);
      expect(logs.filter((line) => line.includes('reason=send_failed'))).toHaveLength(4);

      const all = logs.join('\n');
      expect(all).not.toContain(EMAIL);
      expect(all).not.toContain('provider down');
      expect(all).not.toContain('sync failure');
    });

    it('no address, a failed address lookup or no APP_BASE_URL: logged with a reason code, nothing sent, the link stands', async () => {
      addresses.set(OWNER, '  ');
      await claimAs();
      await service.confirm(OWNER);
      const first = linkIdOf();
      expect(logs).toContain(`chat link mail failed event=linked userId=${OWNER} linkId=${first} reason=no_address`);

      users.findOne.mockRejectedValueOnce(new Error('db down'));
      expect(await service.unlink(OWNER)).toEqual({ channel: 'discord', removed: true });
      expect(logs).toContain(`chat link mail failed event=unlinked userId=${OWNER} linkId=${first} reason=lookup_failed`);

      delete process.env.APP_BASE_URL;
      users.findOne.mockClear();
      await claimAs();
      await service.confirm(OWNER);
      expect(store.links.rows).toHaveLength(1);
      expect(logs).toContain(`chat link mail failed event=linked userId=${OWNER} linkId=${linkIdOf()} reason=no_base_url`);
      expect(users.findOne).not.toHaveBeenCalled();

      expect(mailer.sendEmail).not.toHaveBeenCalled();
      // The Discord confirmation does not depend on the e-mail.
      expect(transport.directMessages).toHaveLength(2);
    });

    it('no e-mail and no Discord message when the confirm or the unlink fails', async () => {
      // No claim waiting.
      await expectRefusal(service.confirm(OWNER), 404, CHAT_LINK_ERROR_CODES.noPendingClaim);
      // The link insert fails: rolled back, nothing sent.
      await claimAs();
      const insert = store.links.insert.bind(store.links);
      store.links.insert = async () => {
        throw new Error('boom');
      };
      await expect(service.confirm(OWNER)).rejects.toThrow('boom');
      // Someone else linked the same Discord account in between: 409, nothing sent.
      store.links.insert = async () => {
        throw Object.assign(new Error('duplicate'), { code: '23505' });
      };
      await expectRefusal(service.confirm(OWNER), 409, CHAT_LINK_ERROR_CODES.taken);
      store.links.insert = insert;
      expect(store.links.rows).toHaveLength(0);

      // Nothing linked: both unlink paths remove nothing and send nothing.
      expect(await service.unlink(OWNER)).toEqual({ channel: 'discord', removed: false });
      expect(await service.unlinkByExternalUser('discord', DISCORD_ID)).toEqual({ channel: 'discord', removed: false });

      // A failed unlink transaction is rolled back and sends nothing.
      await claimAs();
      await service.confirm(OWNER);
      mailer.sendEmail.mockClear();
      transport.directMessages.length = 0;
      const remove = store.links.delete.bind(store.links);
      store.links.delete = async () => {
        throw new Error('boom');
      };
      await expect(service.unlink(OWNER)).rejects.toThrow('boom');
      await expect(service.unlinkByExternalUser('discord', DISCORD_ID)).rejects.toThrow('boom');
      store.links.delete = remove;
      expect(store.links.rows).toHaveLength(1);

      // The switch off: refused, nothing sent.
      process.env.CHAT_DISCORD_ENABLED = 'false';
      await expectRefusal(service.unlink(OWNER), 503, CHAT_LINK_ERROR_CODES.unavailable);
      expect(await service.unlinkByExternalUser('discord', DISCORD_ID)).toEqual({ channel: 'discord', removed: false });

      expect(mailer.sendEmail).not.toHaveBeenCalled();
      expect(transport.directMessages).toEqual([]);
    });

    it('a refused direct message is ignored and logged once with ids only; other send errors are contained', async () => {
      transport.refusedUsers.add(DISCORD_ID);
      const code = await claimAs();
      await service.confirm(OWNER);
      const linkId = linkIdOf();
      expect(store.links.rows).toHaveLength(1);
      expect(transport.directMessages).toEqual([]);
      expect(mailer.sendEmail).toHaveBeenCalledTimes(1);
      expect(logs.filter((line) => line.startsWith('chat link confirmation'))).toEqual([
        `chat link confirmation not sent userId=${OWNER} linkId=${linkId} reason=refused`,
      ]);

      await service.unlink(OWNER);
      transport.sendToUser = async () => {
        throw new Error(`failed for ${DISCORD_ID}`);
      };
      await claimAs();
      await service.confirm(OWNER);
      expect(store.links.rows).toHaveLength(1);
      expect(logs).toContain(`chat link confirmation not sent userId=${OWNER} linkId=${linkIdOf()} reason=send_failed`);
      expectNothingSecret(logs.join('\n'), code);
    });

    it('CHAT-TIDY-01: a transport that is not ready sends nothing; the confirm still links and logs reason=not_ready', async () => {
      transport.state = 'connecting';
      const code = await claimAs();
      await service.confirm(OWNER);
      expect(store.links.rows).toHaveLength(1);
      expect(transport.directMessages).toEqual([]);
      expect(mailer.sendEmail).toHaveBeenCalledTimes(1);
      expect(logs).toContain(`chat link confirmation not sent userId=${OWNER} linkId=${linkIdOf()} reason=not_ready`);
      expectNothingSecret(logs.join('\n'), code);
    });

    it('without a transport the confirm still links and e-mails', async () => {
      service = new ChatLinkService(
        store.links as never,
        store.codes as never,
        store.deliveries as never,
        undefined,
        undefined,
        users as never,
        mailer as never,
      );
      await claimAs();
      await service.confirm(OWNER);
      expect(store.links.rows).toHaveLength(1);
      expect(mails()).toEqual([expected('linked', 'en', START)]);
      expect(logs.some((line) => line.startsWith('chat link confirmation'))).toBe(false);
    });

    it(`a notice that hangs holds the confirm up for at most ${CHAT_LINK_NOTICE_TIMEOUT_MS} ms, then is logged as a time-out`, async () => {
      mailer.sendEmail.mockImplementation(() => new Promise(() => undefined));
      transport.sendToUser = () => new Promise(() => undefined);
      const sendToUser = jest.spyOn(transport, 'sendToUser');
      await claimAs();
      let settled = false;
      const confirming = service.confirm(OWNER).then((view) => {
        settled = true;
        return view;
      });
      await flushUntil(() => mailer.sendEmail.mock.calls.length === 1 && sendToUser.mock.calls.length === 1);
      await jest.advanceTimersByTimeAsync(CHAT_LINK_NOTICE_TIMEOUT_MS - 1);
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      const view = await confirming;
      expect(view.externalIdLast4).toBe('5432');
      expect(store.links.rows).toHaveLength(1);
      const linkId = linkIdOf();
      expect(logs).toContain(`chat link mail failed event=linked userId=${OWNER} linkId=${linkId} reason=timeout`);
      expect(logs).toContain(`chat link confirmation not sent userId=${OWNER} linkId=${linkId} reason=timeout`);
    });

    it('Nest injects the users repository and the mailer; ChatModule imports EmailModule and registers User', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          ChatLinkService,
          { provide: getRepositoryToken(ChatLink), useValue: store.links },
          { provide: getRepositoryToken(ChatLinkCode), useValue: store.codes },
          { provide: getRepositoryToken(User), useValue: users },
          { provide: EMAIL_PROVIDER, useValue: mailer },
          { provide: CHAT_TRANSPORT, useValue: transport },
        ],
      }).compile();
      service = moduleRef.get(ChatLinkService);
      await claimAs('zh-CN');
      await service.confirm(OWNER);
      expect(mails()).toEqual([expected('linked', 'zh-CN', START)]);
      expect(transport.directMessages).toEqual([
        { externalUserId: DISCORD_ID, message: { text: chatReply('zh-CN', 'link.confirmed') } },
      ]);
      await service.unlink(OWNER);
      expect(mailer.sendEmail).toHaveBeenCalledTimes(2);

      const imports = Reflect.getMetadata('imports', ChatModule) as Array<{ providers?: Array<{ provide?: unknown }> }>;
      expect(imports).toContain(EmailModule);
      const token = getRepositoryToken(User);
      expect(
        imports.some((entry) => Array.isArray(entry?.providers) && entry.providers.some((provider) => provider?.provide === token)),
      ).toBe(true);
    });
  });
});

function secretsOf(codes: string[], externalIds: string[]): string[] {
  const values: string[] = [...externalIds];
  for (const code of codes) {
    const plain = code.replace('-', '');
    values.push(code, plain, createHash('sha256').update(plain).digest('hex'));
  }
  return values;
}

function expectAbsent(values: string[], text: string): void {
  for (const value of values) {
    expect(text).not.toContain(value);
  }
}

function linkRow(id: string, userId: string, externalUserId: string): ChatLink {
  return {
    id: `${id.repeat(8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
    userId,
    channel: 'discord',
    externalUserId,
    locale: 'en',
    createdAt: new Date(),
    lastUsedAt: null,
  };
}

function codeRow(id: string, userId: string): ChatLinkCode {
  return {
    id,
    userId,
    channel: 'discord',
    codeHash: createHash('sha256').update(id).digest('hex'),
    locale: 'en',
    expiresAt: new Date(Date.now() + 5 * MINUTE),
    claimedExternalUserId: null,
    claimedDisplayName: null,
    claimedAt: null,
    createdAt: new Date(),
  };
}

function watchLogs(logs: string[]): () => void {
  const methods = ['log', 'warn', 'error', 'debug', 'verbose'] as const;
  const spies = methods.map((method) =>
    jest.spyOn(Logger.prototype, method).mockImplementation((...args: unknown[]) => {
      logs.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
    }),
  );
  return () => spies.forEach((spy) => spy.mockRestore());
}

/* ---------- In-memory TypeORM stand-in: where with IsNull, LessThanOrEqual, MoreThan; unique indexes; transactions roll back. ---------- */

type Row = Record<string, unknown>;

function sameValue(left: unknown, right: unknown): boolean {
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  return left === right;
}

function asNumber(value: unknown): number {
  return value instanceof Date ? value.getTime() : Number(value);
}

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected instanceof FindOperator) {
      switch (expected.type) {
        case 'isNull':
          return actual === null || actual === undefined;
        case 'lessThanOrEqual':
          return asNumber(actual) <= asNumber(expected.value);
        case 'moreThan':
          return asNumber(actual) > asNumber(expected.value);
        default:
          throw new Error(`unsupported operator ${expected.type}`);
      }
    }
    return sameValue(actual, expected);
  });
}

function copy<T>(row: T): T {
  return { ...(row as object) } as T;
}

class MemoryRepository<T extends object> {
  rows: T[] = [];
  manager!: MemoryManager;

  constructor(
    private readonly name: string,
    private readonly calls: string[],
    private readonly uniques: string[][] = [],
  ) {}

  async findOne(options: { where: Row }): Promise<T | null> {
    this.calls.push(`${this.name}.findOne`);
    const found = this.rows.find((row) => matches(row as Row, options.where));
    return found ? copy(found) : null;
  }

  async find(options: { where: Row; order?: Record<string, 'ASC' | 'DESC'> }): Promise<T[]> {
    this.calls.push(`${this.name}.find`);
    const found = this.rows.filter((row) => matches(row as Row, options.where)).map(copy);
    const [orderKey, direction] = Object.entries(options.order ?? {})[0] ?? [];
    if (orderKey) {
      found.sort((a, b) => {
        const diff = asNumber((a as Row)[orderKey]) - asNumber((b as Row)[orderKey]);
        return direction === 'DESC' ? -diff : diff;
      });
    }
    return found;
  }

  async insert(entity: T): Promise<{ identifiers: unknown[] }> {
    this.calls.push(`${this.name}.insert`);
    for (const columns of this.uniques) {
      const clash = this.rows.some((row) =>
        columns.every((column) => sameValue((row as Row)[column], (entity as Row)[column])),
      );
      if (clash) {
        throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
      }
    }
    this.rows.push(copy(entity));
    return { identifiers: [{ id: (entity as Row).id }] };
  }

  async update(where: Row, patch: Partial<T>): Promise<{ affected: number }> {
    this.calls.push(`${this.name}.update`);
    let affected = 0;
    for (const row of this.rows) {
      if (matches(row as Row, where)) {
        Object.assign(row, patch);
        affected += 1;
      }
    }
    return { affected };
  }

  async delete(where: Row): Promise<{ affected: number }> {
    this.calls.push(`${this.name}.delete`);
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !matches(row as Row, where));
    return { affected: before - this.rows.length };
  }
}

class MemoryManager {
  constructor(private readonly store: MemoryStore) {}

  getRepository(target: unknown): MemoryRepository<object> {
    if (target === ChatLink) return this.store.links as MemoryRepository<object>;
    if (target === ChatLinkCode) return this.store.codes as MemoryRepository<object>;
    if (target === AuditEventEntity) return this.store.audit as MemoryRepository<object>;
    if (target === ChatRunDelivery) return this.store.deliveries as MemoryRepository<object>;
    throw new Error('unknown repository');
  }

  async transaction<R>(work: (manager: MemoryManager) => Promise<R>): Promise<R> {
    const snapshot = this.store.snapshot();
    try {
      return await work(this);
    } catch (error) {
      this.store.restore(snapshot);
      throw error;
    }
  }
}

class MemoryStore {
  calls: string[] = [];
  links = new MemoryRepository<ChatLink>('links', this.calls, [
    ['channel', 'externalUserId'],
    ['userId', 'channel'],
  ]);
  codes = new MemoryRepository<ChatLinkCode>('codes', this.calls, [['codeHash']]);
  audit = new MemoryRepository<AuditEventEntity>('audit', this.calls);
  deliveries = new MemoryRepository<ChatRunDelivery>('deliveries', this.calls);
  manager = new MemoryManager(this);

  constructor() {
    this.links.manager = this.manager;
    this.codes.manager = this.manager;
    this.audit.manager = this.manager;
    this.deliveries.manager = this.manager;
  }

  resetCalls(): void {
    this.calls.length = 0;
  }

  snapshot(): { links: ChatLink[]; codes: ChatLinkCode[]; audit: AuditEventEntity[]; deliveries: ChatRunDelivery[] } {
    return {
      links: this.links.rows.map(copy),
      codes: this.codes.rows.map(copy),
      audit: this.audit.rows.map(copy),
      deliveries: this.deliveries.rows.map(copy),
    };
  }

  restore(snapshot: { links: ChatLink[]; codes: ChatLinkCode[]; audit: AuditEventEntity[]; deliveries: ChatRunDelivery[] }): void {
    this.links.rows = snapshot.links;
    this.codes.rows = snapshot.codes;
    this.audit.rows = snapshot.audit;
    this.deliveries.rows = snapshot.deliveries;
  }
}

/** An 18-digit outside user id as a string (above Number.MAX_SAFE_INTEGER, so never a number). */
function outsideId(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(17, '0')}`;
}
