import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator } from 'typeorm';
import { EntitlementService } from '../auth/entitlement.service';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { User } from '../entities/user.entity';
import { ChatLink } from '../entities/chat-link.entity';
import { ChatLinkCode } from '../entities/chat-link-code.entity';
import { ChatCommandService } from './chat-commands';
import { ChatApprovalService } from './chat-approval.service';
import { ChatDeliveryService } from './chat-delivery.service';
import { ChatRunService } from './chat-run.service';
import { ChatLinkService } from './chat-link.service';
import { chatReply } from './chat-replies';
import { CHAT_TRANSPORT, ChatCommandInvocation, FakeChatTransport } from './chat-transport';
import {
  CHAT_RUNNER_ALLOW_UNDER_JEST,
  CHAT_TRANSPORT_PROVIDER,
  ChatChannelRunner,
  ChatModule,
  createChatTransport,
} from './chat.module';
import { DiscordTransport } from './discord/discord-transport';

const OWNER = '11111111-1111-4111-8111-111111111111';
const DISCORD_ID = '987654321098765432';
const STRANGER = '123456789012345678';
const DISPLAY_NAME = 'Keith Discord Name';
const MARKER = 'MARKER-7f3a-do-not-log';

type Invoke = Omit<ChatCommandInvocation, 'channel' | 'ref'>;

function dm(command: string, options: Record<string, string> = {}, externalUserId = DISCORD_ID, locale = 'en-US'): Invoke {
  return { command, options, externalUserId, displayName: DISPLAY_NAME, locale, directMessage: true };
}

describe('ChatCommandService (CHAT-DISCORD-01 B, C1)', () => {
  const original = {
    chat: process.env.CHAT_DISCORD_ENABLED,
    global: process.env.GLOBAL_EXECUTION_ENABLED,
  };
  let store: MemoryStore;
  let links: ChatLinkService;
  let entitled: Set<string>;
  let users: Map<string, { id: string; isActive: boolean }>;
  let transport: FakeChatTransport;
  let commands: ChatCommandService;
  let entitlements: { resolveHarnessEntitled: jest.Mock };
  let userRepo: { findOne: jest.Mock };
  let runs: { ask: jest.Mock; refuseOwner: jest.Mock; cancel: jest.Mock; statusCounts: jest.Mock };
  let logs: string[];
  let restoreLogs: () => void;

  beforeEach(async () => {
    process.env.CHAT_DISCORD_ENABLED = 'true';
    process.env.GLOBAL_EXECUTION_ENABLED = 'false';
    store = new MemoryStore();
    links = new ChatLinkService(store.links as never, store.codes as never);
    entitled = new Set([OWNER]);
    users = new Map([[OWNER, { id: OWNER, isActive: true }]]);
    entitlements = { resolveHarnessEntitled: jest.fn(async (id: string) => entitled.has(id)) };
    userRepo = {
      findOne: jest.fn(async (options: { where: { id: string } }) => users.get(options.where.id) ?? null),
    };
    runs = {
      ask: jest.fn(async () => ({ text: chatReply('en', 'ask.started') })),
      refuseOwner: jest.fn(async () => ({ text: chatReply('en', 'notEntitled') })),
      cancel: jest.fn(async () => ({ text: chatReply('en', 'cancel.nothing') })),
      statusCounts: jest.fn(async () => ({ running: 0, waiting: 0 })),
    };
    commands = new ChatCommandService(links, entitlements as never, userRepo as never, runs as never);
    transport = new FakeChatTransport();
    await new ChatChannelRunner(transport, commands, true).start();
    logs = [];
    restoreLogs = watchLogs(logs);
  });

  afterEach(() => {
    restoreLogs();
    const all = logs.join('\n');
    expect(all).not.toContain(DISCORD_ID);
    expect(all).not.toContain(STRANGER);
    expect(all).not.toContain(DISPLAY_NAME);
    expect(all).not.toContain(MARKER);
    restore('CHAT_DISCORD_ENABLED', original.chat);
    restore('GLOBAL_EXECUTION_ENABLED', original.global);
  });

  async function linkOwner(): Promise<string> {
    const { code } = await links.createCode(OWNER, 'en');
    const reply = await transport.invoke(dm('link', { code }));
    expect(reply?.text).toBe(chatReply('en', 'link.claimed'));
    await links.confirm(OWNER);
    store.resetCalls();
    return code;
  }

  describe('runner', () => {
    it('connects the transport with the command handler and registers the commands', () => {
      expect(transport.connectCalls).toBe(1);
      expect(transport.registeredCommands).toBe(1);
      expect(transport.state).toBe('ready');
    });

    it('does nothing under Jest by default, and stop disconnects only a started transport', async () => {
      const idle = new FakeChatTransport();
      const runner = new ChatChannelRunner(idle, commands);
      expect(await runner.start()).toBe(false);
      expect(idle.connectCalls).toBe(0);
      await runner.stop();
      expect(idle.disconnectCalls).toBe(0);

      const started = new FakeChatTransport();
      const live = new ChatChannelRunner(started, commands, true);
      expect(await live.start()).toBe(true);
      expect(await live.start()).toBe(false);
      expect(started.connectCalls).toBe(1);
      await live.stop();
      expect(started.disconnectCalls).toBe(1);
    });

    it('a transport that refuses to connect leaves the gateway booting', async () => {
      const refusing = new FakeChatTransport(false);
      expect(await new ChatChannelRunner(refusing, commands, true).start()).toBe(false);
      const throwing = new FakeChatTransport();
      throwing.connect = async () => {
        throw new Error('boom');
      };
      expect(await new ChatChannelRunner(throwing, commands, true).start()).toBe(false);
    });

    it('C2: button presses go to the approval service; without it the transport gets no component handler', async () => {
      const response = { kind: 'ephemeral' as const, message: { text: chatReply('en', 'approval.unavailable') } };
      const approvals = { handlePress: jest.fn(async () => response) };
      const withApprovals = new FakeChatTransport();
      await new ChatChannelRunner(withApprovals, commands, true, approvals as never).start();
      const press = { customId: 'ap1:a:AAAAAAAAAAAAAAAAAAAAAA', externalUserId: DISCORD_ID, locale: 'en-US', directMessage: true };
      expect(await withApprovals.press(press)).toBe(response);
      expect(approvals.handlePress).toHaveBeenCalledWith(expect.objectContaining({ ...press, channel: 'discord' }));
      // Commands still go to the command handler.
      expect(await withApprovals.invoke(dm('help', {}, STRANGER))).toEqual({ text: chatReply('en', 'help') });

      expect(transport.componentHandler).toBeNull();
      await expect(transport.press(press)).rejects.toThrow('no component handler');
    });

    it('ChatModule registers the commands, the transport token and the runner as providers', () => {
      expect(Reflect.getMetadata('providers', ChatModule)).toEqual([
        ChatLinkService,
        ChatCommandService,
        CHAT_TRANSPORT_PROVIDER,
        ChatChannelRunner,
        ChatRunService,
        ChatDeliveryService,
        ChatApprovalService,
      ]);
      expect(Reflect.getMetadata('exports', ChatModule)).toEqual([ChatLinkService]);
      expect(CHAT_TRANSPORT_PROVIDER).toEqual({ provide: CHAT_TRANSPORT, useFactory: createChatTransport });
      // The app's transport is the Discord transport (it does not connect here: nothing calls connect).
      expect(createChatTransport()).toBeInstanceOf(DiscordTransport);
    });

    it('Nest injects the transport by token: a fake connects on bootstrap and disconnects on close', async () => {
      const fake = new FakeChatTransport();
      const moduleRef = await Test.createTestingModule({
        providers: [
          ChatCommandService,
          CHAT_TRANSPORT_PROVIDER,
          ChatChannelRunner,
          { provide: ChatLinkService, useValue: links },
          { provide: EntitlementService, useValue: entitlements },
          { provide: getRepositoryToken(User), useValue: userRepo },
          { provide: ChatRunService, useValue: runs },
          { provide: CHAT_RUNNER_ALLOW_UNDER_JEST, useValue: true },
        ],
      })
        .overrideProvider(CHAT_TRANSPORT)
        .useValue(fake)
        .compile();
      const app = await moduleRef.init();
      expect(fake.connectCalls).toBe(1);
      expect(fake.registeredCommands).toBe(1);
      expect(await fake.invoke(dm('help', {}, STRANGER))).toEqual({ text: chatReply('en', 'help') });
      await app.close();
      expect(fake.disconnectCalls).toBe(1);
    });

    it('under Jest the runner provider does not connect unless a test allows it', async () => {
      const fake = new FakeChatTransport();
      const moduleRef = await Test.createTestingModule({
        providers: [
          ChatCommandService,
          CHAT_TRANSPORT_PROVIDER,
          ChatChannelRunner,
          { provide: ChatLinkService, useValue: links },
          { provide: EntitlementService, useValue: entitlements },
          { provide: getRepositoryToken(User), useValue: userRepo },
          { provide: ChatRunService, useValue: runs },
        ],
      })
        .overrideProvider(CHAT_TRANSPORT)
        .useValue(fake)
        .compile();
      const app = await moduleRef.init();
      await app.close();
      expect(fake.connectCalls).toBe(0);
      expect(fake.disconnectCalls).toBe(0);
    });
  });

  describe('unlinked users get fixed text only', () => {
    it.each(['status', 'language', 'unlink', 'ask', 'cancel'])('/%s answers "link first" and writes nothing', async (command) => {
      const options = { language: 'zh-CN', text: `${MARKER} change my settings`, agent: MARKER, code: MARKER };
      const reply = await transport.invoke({ ...dm(command, options, STRANGER), displayName: MARKER });
      expect(reply).toEqual({ text: chatReply('en', 'linkFirst') });
      expect(store.writes()).toEqual([]);
      expect(store.audit.rows).toEqual([]);
      expect(runs.ask).not.toHaveBeenCalled();
      expect(runs.refuseOwner).not.toHaveBeenCalled();
      expect(runs.cancel).not.toHaveBeenCalled();
    });

    it('/help is fixed text in the interaction language', async () => {
      expect(await transport.invoke(dm('help', {}, STRANGER))).toEqual({ text: chatReply('en', 'help') });
      expect(await transport.invoke(dm('help', {}, STRANGER, 'zh-TW'))).toEqual({ text: chatReply('zh-TW', 'help') });
      expect(await transport.invoke(dm('help', {}, STRANGER, 'zh-CN'))).toEqual({ text: chatReply('zh-CN', 'help') });
      expect(store.writes()).toEqual([]);
    });

    it('an unknown command, or one outside the direct message, gets fixed text and reads nothing', async () => {
      store.resetCalls();
      expect(await transport.invoke(dm(MARKER))).toEqual({ text: chatReply('en', 'unknownCommand') });
      expect(await transport.invoke({ ...dm('status'), directMessage: false })).toEqual({
        text: chatReply('en', 'useDirectMessage'),
      });
      expect(store.calls).toEqual([]);
    });

    it('switch off: fixed "not available" and nothing read', async () => {
      process.env.CHAT_DISCORD_ENABLED = 'false';
      store.resetCalls();
      for (const command of ['link', 'status', 'help', 'ask']) {
        expect(await transport.invoke(dm(command, { code: 'ABCD-EFGH' }))).toEqual({
          text: chatReply('en', 'notAvailable'),
        });
      }
      expect(store.calls).toEqual([]);
    });
  });

  describe('/link', () => {
    it('claims the code (a claim alone links nothing) and answers in the interaction language', async () => {
      const { code } = await links.createCode(OWNER, 'en');
      const reply = await transport.invoke(dm('link', { code }, DISCORD_ID, 'zh-TW'));
      expect(reply).toEqual({ text: chatReply('zh-TW', 'link.claimed') });
      expect(store.links.rows).toEqual([]);
      expect(store.codes.rows[0].claimedExternalUserId).toBe(DISCORD_ID);
      expect(store.codes.rows[0].claimedDisplayName).toBe(DISPLAY_NAME);
    });

    it('one answer for a wrong code; silence after 5 attempts; already linked', async () => {
      expect(await transport.invoke(dm('link', { code: 'ZZZZ-ZZZZ' }, STRANGER))).toEqual({
        text: chatReply('en', 'link.invalid'),
      });
      expect(await transport.invoke(dm('link', {}, STRANGER))).toEqual({ text: chatReply('en', 'link.invalid') });
      for (let i = 0; i < 3; i += 1) {
        await transport.invoke(dm('link', { code: 'ZZZZ-ZZZZ' }, STRANGER));
      }
      expect(await transport.invoke(dm('link', { code: 'ZZZZ-ZZZZ' }, STRANGER))).toBeNull();
      expect(transport.replies[transport.replies.length - 1].message).toBeNull();

      await linkOwner();
      expect(await transport.invoke(dm('link', { code: 'ABCD-EFGH' }))).toEqual({
        text: chatReply('en', 'link.alreadyLinked'),
      });
    });
  });

  describe('linked owner', () => {
    it('/status shows linked, runs off or on, the language and (C1) the run counts; updates last_used_at', async () => {
      await linkOwner();
      expect(store.links.rows[0].lastUsedAt).toBeNull();
      const off = await transport.invoke(dm('status'));
      expect(off?.text).toBe(
        'Linked: yes.\nRuns: switched off.\nReply language: English.\n' +
          'Runs from Discord in progress: 0.\nSteps waiting for your approval: 0.',
      );
      expect(store.links.rows[0].lastUsedAt).toBeInstanceOf(Date);
      process.env.GLOBAL_EXECUTION_ENABLED = 'true';
      runs.statusCounts.mockResolvedValueOnce({ running: 2, waiting: 1 });
      expect((await transport.invoke(dm('status')))?.text).toBe(
        'Linked: yes.\nRuns: switched on.\nReply language: English.\n' +
          'Runs from Discord in progress: 2.\nSteps waiting for your approval: 1.',
      );
      expect(runs.statusCounts).toHaveBeenLastCalledWith(expect.objectContaining({ userId: OWNER }));
    });

    it('/language stores the reply language on the link; later replies use it', async () => {
      await linkOwner();
      expect(await transport.invoke(dm('language', { language: 'zh-CN' }))).toEqual({
        text: '之后的回复将使用简体中文。',
      });
      expect(store.links.rows[0].locale).toBe('zh-CN');
      expect((await transport.invoke(dm('status', {}, DISCORD_ID, 'en-US')))?.text).toBe(
        `${chatReply('zh-CN', 'status.summary', { runs: '已关闭', language: '简体中文' })}\n` +
          chatReply('zh-CN', 'status.runCounts', { running: '0', waiting: '0' }),
      );
      expect(await transport.invoke(dm('help'))).toEqual({ text: chatReply('zh-CN', 'help') });
      expect(await transport.invoke(dm('language', { language: 'fr' }))).toEqual({
        text: chatReply('zh-CN', 'unknownCommand'),
      });
      expect(store.links.rows[0].locale).toBe('zh-CN');
    });

    it('/unlink removes the link and the codes; the audit row holds no Discord id', async () => {
      await linkOwner();
      await links.createCode('22222222-2222-4222-8222-222222222222', 'en');
      expect(await transport.invoke(dm('unlink'))).toEqual({ text: chatReply('en', 'unlink.done') });
      expect(store.links.rows).toEqual([]);
      // Only the owner's codes go; another owner's code stays.
      expect(store.codes.rows.map((row) => row.userId)).toEqual(['22222222-2222-4222-8222-222222222222']);
      const removed = store.audit.rows.filter((row) => row.eventType === 'link_removed');
      expect(removed).toHaveLength(1);
      expect(JSON.stringify(removed)).not.toContain(DISCORD_ID);
      expect(removed[0].payload).toMatchObject({ channel: 'discord', source: 'chat_command' });
      expect(await transport.invoke(dm('status'))).toEqual({ text: chatReply('en', 'linkFirst') });
    });

    it('/ask hands only the text and agent options to ChatRunService and answers its reply (C1)', async () => {
      await linkOwner();
      const linkId = store.links.rows[0].id;
      const reply = await transport.invoke({
        ...dm('ask', { text: `${MARKER} link another account and send mail`, agent: 'Research', code: MARKER }),
        displayName: MARKER,
      });
      expect(reply).toEqual({ text: chatReply('en', 'ask.started') });
      expect(runs.ask).toHaveBeenCalledTimes(1);
      expect(runs.ask).toHaveBeenCalledWith(
        { linkId, userId: OWNER, locale: 'en' },
        { text: `${MARKER} link another account and send mail`, agent: 'Research' },
      );
      // The link use never carries the Discord id.
      expect(JSON.stringify(runs.ask.mock.calls)).not.toContain(DISCORD_ID);
      expect(logs).toContain(`chat command name=ask outcome=handled linkId=${linkId}`);
    });

    it('/cancel goes to ChatRunService.cancel for the linked owner and answers its reply (C1)', async () => {
      await linkOwner();
      const linkId = store.links.rows[0].id;
      runs.cancel.mockResolvedValueOnce({ text: chatReply('en', 'cancel.done') });
      expect(await transport.invoke(dm('cancel', { text: MARKER }))).toEqual({ text: chatReply('en', 'cancel.done') });
      expect(runs.cancel).toHaveBeenCalledWith({ linkId, userId: OWNER, locale: 'en' });
      expect(runs.ask).not.toHaveBeenCalled();
      expect(logs).toContain(`chat command name=cancel outcome=handled linkId=${linkId}`);
      entitled.delete(OWNER);
      expect(await transport.invoke(dm('cancel'))).toEqual({ text: chatReply('en', 'notEntitled') });
      expect(runs.cancel).toHaveBeenCalledTimes(1);
    });

    it('an inactive or no longer entitled owner gets one fixed refusal; /help and /unlink still work', async () => {
      await linkOwner();
      entitled.delete(OWNER);
      for (const command of ['status', 'ask']) {
        expect(await transport.invoke(dm(command, { text: MARKER }))).toEqual({ text: chatReply('en', 'notEntitled') });
      }
      // C1: /ask from such an owner goes to refuseOwner (one run_refused audit row there), never to ask.
      expect(runs.refuseOwner).toHaveBeenCalledWith(expect.objectContaining({ userId: OWNER }), 'not_entitled');
      expect(runs.ask).not.toHaveBeenCalled();
      expect(await transport.invoke(dm('language', { language: 'zh-TW' }))).toEqual({
        text: chatReply('en', 'notEntitled'),
      });
      expect(store.links.rows[0].locale).toBe('en');
      entitled.add(OWNER);
      users.set(OWNER, { id: OWNER, isActive: false });
      expect(await transport.invoke(dm('status'))).toEqual({ text: chatReply('en', 'notEntitled') });
      await transport.invoke(dm('ask', { text: MARKER }));
      expect(runs.refuseOwner).toHaveBeenLastCalledWith(expect.objectContaining({ userId: OWNER }), 'inactive');
      expect(runs.ask).not.toHaveBeenCalled();
      expect(await transport.invoke(dm('help'))).toEqual({ text: chatReply('en', 'help') });
      expect(await transport.invoke(dm('unlink'))).toEqual({ text: chatReply('en', 'unlink.done') });
    });

    it('a failure inside a command answers the fixed error text and logs no Discord value', async () => {
      await linkOwner();
      store.links.findOne = async () => {
        throw new Error(`database said ${DISCORD_ID} ${MARKER}`);
      };
      expect(await transport.invoke(dm('status'))).toEqual({ text: chatReply('en', 'error') });
      expect(logs).toContain('chat command failed name=status reason=Error');
    });

    it('log lines carry the command, an outcome and the link uuid only', async () => {
      await linkOwner();
      await transport.invoke(dm('status'));
      const linkId = store.links.rows[0].id;
      expect(logs).toContain(`chat command name=status outcome=ok linkId=${linkId}`);
    });
  });
});

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
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

/* ---------- Small in-memory TypeORM stand-in (IsNull, MoreThan, LessThanOrEqual; unique indexes; rollback). ---------- */

type Row = Record<string, unknown>;

function asNumber(value: unknown): number {
  return value instanceof Date ? value.getTime() : Number(value);
}

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected instanceof FindOperator) {
      if (expected.type === 'isNull') return actual === null || actual === undefined;
      if (expected.type === 'moreThan') return asNumber(actual) > asNumber(expected.value);
      if (expected.type === 'lessThanOrEqual') return asNumber(actual) <= asNumber(expected.value);
      throw new Error(`unsupported operator ${expected.type}`);
    }
    if (actual instanceof Date && expected instanceof Date) return actual.getTime() === expected.getTime();
    return actual === expected;
  });
}

class MemoryRepository<T extends object> {
  rows: T[] = [];
  manager!: MemoryManager;

  constructor(
    private readonly name: string,
    private readonly store: MemoryStore,
    private readonly uniques: string[][] = [],
  ) {}

  async findOne(options: { where: Row }): Promise<T | null> {
    this.store.calls.push(`${this.name}.findOne`);
    const found = this.rows.find((row) => matches(row as Row, options.where));
    return found ? ({ ...found } as T) : null;
  }

  async find(options: { where: Row; order?: Record<string, 'ASC' | 'DESC'> }): Promise<T[]> {
    this.store.calls.push(`${this.name}.find`);
    const found = this.rows.filter((row) => matches(row as Row, options.where)).map((row) => ({ ...row }) as T);
    const [key, direction] = Object.entries(options.order ?? {})[0] ?? [];
    if (key) {
      found.sort((a, b) => (asNumber((a as Row)[key]) - asNumber((b as Row)[key])) * (direction === 'DESC' ? -1 : 1));
    }
    return found;
  }

  async insert(entity: T): Promise<unknown> {
    this.store.calls.push(`${this.name}.insert`);
    for (const columns of this.uniques) {
      if (this.rows.some((row) => columns.every((column) => (row as Row)[column] === (entity as Row)[column]))) {
        throw Object.assign(new Error('duplicate key'), { code: '23505' });
      }
    }
    this.rows.push({ ...entity });
    return {};
  }

  async update(where: Row, patch: Partial<T>): Promise<{ affected: number }> {
    this.store.calls.push(`${this.name}.update`);
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
    this.store.calls.push(`${this.name}.delete`);
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
    throw new Error('unknown repository');
  }

  async transaction<R>(work: (manager: MemoryManager) => Promise<R>): Promise<R> {
    const snapshot = [this.store.links.rows, this.store.codes.rows, this.store.audit.rows].map((rows) =>
      rows.map((row) => ({ ...row })),
    );
    try {
      return await work(this);
    } catch (error) {
      this.store.links.rows = snapshot[0] as ChatLink[];
      this.store.codes.rows = snapshot[1] as ChatLinkCode[];
      this.store.audit.rows = snapshot[2] as AuditEventEntity[];
      throw error;
    }
  }
}

class MemoryStore {
  calls: string[] = [];
  links = new MemoryRepository<ChatLink>('links', this, [
    ['channel', 'externalUserId'],
    ['userId', 'channel'],
  ]);
  codes = new MemoryRepository<ChatLinkCode>('codes', this, [['codeHash']]);
  audit = new MemoryRepository<AuditEventEntity>('audit', this);
  manager = new MemoryManager(this);

  constructor() {
    this.links.manager = this.manager;
    this.codes.manager = this.manager;
    this.audit.manager = this.manager;
  }

  resetCalls(): void {
    this.calls.length = 0;
  }

  /** Calls that would write to the database. */
  writes(): string[] {
    return this.calls.filter((call) => /\.(insert|update|delete)$/.test(call));
  }
}
