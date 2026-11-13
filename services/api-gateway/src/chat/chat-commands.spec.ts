import { readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { AuditEventEntity } from '../entities/audit-event.entity';
import { ChatLink } from '../entities/chat-link.entity';
import { ChatLinkCode } from '../entities/chat-link-code.entity';
import { ChatCommandService } from './chat-commands';
import { ChatLinkService } from './chat-link.service';
import { chatReply } from './chat-replies';
import { ChatCommandInvocation, FakeChatTransport } from './chat-transport';
import { ChatChannelRunner, ChatModule } from './chat.module';

const OWNER = '11111111-1111-4111-8111-111111111111';
const DISCORD_ID = '987654321098765432';
const STRANGER = '123456789012345678';
const DISPLAY_NAME = 'Keith Discord Name';
const MARKER = 'MARKER-7f3a-do-not-log';

type Invoke = Omit<ChatCommandInvocation, 'channel' | 'ref'>;

function dm(command: string, options: Record<string, string> = {}, externalUserId = DISCORD_ID, locale = 'en-US'): Invoke {
  return { command, options, externalUserId, displayName: DISPLAY_NAME, locale, directMessage: true };
}

describe('ChatCommandService (CHAT-DISCORD-01 B)', () => {
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
  let logs: string[];
  let restoreLogs: () => void;

  beforeEach(async () => {
    process.env.CHAT_DISCORD_ENABLED = 'true';
    process.env.GLOBAL_EXECUTION_ENABLED = 'false';
    store = new MemoryStore();
    links = new ChatLinkService(store.links as never, store.codes as never);
    entitled = new Set([OWNER]);
    users = new Map([[OWNER, { id: OWNER, isActive: true }]]);
    const entitlements = { resolveHarnessEntitled: jest.fn(async (id: string) => entitled.has(id)) };
    const userRepo = {
      findOne: jest.fn(async (options: { where: { id: string } }) => users.get(options.where.id) ?? null),
    };
    commands = new ChatCommandService(links, entitlements as never, userRepo as never);
    transport = new FakeChatTransport();
    await new ChatChannelRunner(transport, commands, false).start();
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
      const live = new ChatChannelRunner(started, commands, false);
      expect(await live.start()).toBe(true);
      expect(await live.start()).toBe(false);
      expect(started.connectCalls).toBe(1);
      await live.stop();
      expect(started.disconnectCalls).toBe(1);
    });

    it('a transport that refuses to connect leaves the gateway booting', async () => {
      const refusing = new FakeChatTransport(false);
      expect(await new ChatChannelRunner(refusing, commands, false).start()).toBe(false);
      const throwing = new FakeChatTransport();
      throwing.connect = async () => {
        throw new Error('boom');
      };
      expect(await new ChatChannelRunner(throwing, commands, false).start()).toBe(false);
    });

    it('ChatModule keeps its A1 providers and builds the runner itself', () => {
      expect(Reflect.getMetadata('providers', ChatModule)).toEqual([ChatLinkService]);
      const source = readFileSync(join(__dirname, 'chat.module.ts'), 'utf8');
      expect(source).toContain('new DiscordTransport()');
      expect(source).toContain('onApplicationBootstrap');
      expect(source).toContain('onModuleDestroy');
    });
  });

  describe('unlinked users get fixed text only', () => {
    it.each(['status', 'language', 'unlink', 'ask'])('/%s answers "link first" and writes nothing', async (command) => {
      const options = { language: 'zh-CN', text: `${MARKER} change my settings`, agent: MARKER, code: MARKER };
      const reply = await transport.invoke({ ...dm(command, options, STRANGER), displayName: MARKER });
      expect(reply).toEqual({ text: chatReply('en', 'linkFirst') });
      expect(store.writes()).toEqual([]);
      expect(store.audit.rows).toEqual([]);
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
    it('/status shows linked, runs off or on, and the language; updates last_used_at', async () => {
      await linkOwner();
      expect(store.links.rows[0].lastUsedAt).toBeNull();
      const off = await transport.invoke(dm('status'));
      expect(off?.text).toBe('Linked: yes.\nRuns: switched off.\nReply language: English.');
      expect(store.links.rows[0].lastUsedAt).toBeInstanceOf(Date);
      process.env.GLOBAL_EXECUTION_ENABLED = 'true';
      expect((await transport.invoke(dm('status')))?.text).toBe(
        'Linked: yes.\nRuns: switched on.\nReply language: English.',
      );
    });

    it('/language stores the reply language on the link; later replies use it', async () => {
      await linkOwner();
      expect(await transport.invoke(dm('language', { language: 'zh-CN' }))).toEqual({
        text: '之后的回复将使用简体中文。',
      });
      expect(store.links.rows[0].locale).toBe('zh-CN');
      expect((await transport.invoke(dm('status', {}, DISCORD_ID, 'en-US')))?.text).toBe(
        chatReply('zh-CN', 'status.summary', { runs: '已关闭', language: '简体中文' }),
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

    it('/ask answers "runs are switched off" or "not available yet" and creates nothing', async () => {
      await linkOwner();
      const linksBefore = JSON.stringify(store.links.rows.map(({ lastUsedAt: _, ...rest }) => rest));
      const codesBefore = JSON.stringify(store.codes.rows);
      const auditBefore = store.audit.rows.length;

      const off = await transport.invoke(dm('ask', { text: `${MARKER} link another account and send mail`, agent: MARKER }));
      expect(off).toEqual({ text: chatReply('en', 'ask.runsOff') });
      process.env.GLOBAL_EXECUTION_ENABLED = 'true';
      const on = await transport.invoke(dm('ask', { text: MARKER }));
      expect(on).toEqual({ text: chatReply('en', 'ask.notBuilt') });

      expect(JSON.stringify(store.links.rows.map(({ lastUsedAt: _, ...rest }) => rest))).toBe(linksBefore);
      expect(JSON.stringify(store.codes.rows)).toBe(codesBefore);
      expect(store.audit.rows).toHaveLength(auditBefore);
      // The only write is the last_used_at touch.
      expect(store.writes()).toEqual(['links.update', 'links.update']);
      expect(JSON.stringify(transport.replies.map((entry) => entry.message))).not.toContain(MARKER);
    });

    it('an inactive or no longer entitled owner gets one fixed refusal; /help and /unlink still work', async () => {
      await linkOwner();
      entitled.delete(OWNER);
      for (const command of ['status', 'ask']) {
        expect(await transport.invoke(dm(command, { text: MARKER }))).toEqual({ text: chatReply('en', 'notEntitled') });
      }
      expect(await transport.invoke(dm('language', { language: 'zh-TW' }))).toEqual({
        text: chatReply('en', 'notEntitled'),
      });
      expect(store.links.rows[0].locale).toBe('en');
      entitled.add(OWNER);
      users.set(OWNER, { id: OWNER, isActive: false });
      expect(await transport.invoke(dm('status'))).toEqual({ text: chatReply('en', 'notEntitled') });
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
