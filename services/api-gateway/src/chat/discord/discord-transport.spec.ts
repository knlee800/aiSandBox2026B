import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import {
  GatewayCloseCodes,
  GatewayDispatchEvents,
  InteractionType,
  ApplicationCommandType,
  MessageFlags,
} from '@discordjs/core';
import { WebSocketShardEvents } from '@discordjs/ws';
import type { ChatCommandInvocation, ChatReplyMessage } from '../chat-transport';
import * as transportModule from './discord-transport';
import {
  DISCORD_COMMAND_DATA_CHAT_INPUT,
  DISCORD_DISPATCH_INTERACTION_CREATE,
  DISCORD_EPHEMERAL_FLAG,
  DISCORD_FATAL_CLOSE_CODES,
  DISCORD_GATEWAY_EVENTS,
  DISCORD_GATEWAY_INTENTS,
  DISCORD_INTERACTION_APPLICATION_COMMAND,
  DISCORD_MAX_FAILED_IDENTIFIES,
  DiscordCalls,
  DiscordConnection,
  DiscordIdentifyGuard,
  DiscordTransport,
  toChatInvocation,
} from './discord-transport';

const TOKEN = 'MTIzNDU2Nzg5MDEyMzQ1Njc4.SECRET-TOKEN-VALUE.abcdefghijklmnop';
const APP_ID = '111111111111111111';
const USER_ID = '987654321098765432';
const HOUR = 60 * 60 * 1000;

class FakeGateway extends EventEmitter {
  connectCalls = 0;
  destroyCalls = 0;
  connectResult: Promise<void> = new Promise<void>(() => undefined); // like the library: waits for ready

  connect(): Promise<void> {
    this.connectCalls += 1;
    return this.connectResult;
  }

  destroy(): void {
    this.destroyCalls += 1;
  }
}

function fakeCalls(): DiscordCalls & { log: string[]; bodies: unknown[] } {
  const log: string[] = [];
  const bodies: unknown[] = [];
  return {
    log,
    bodies,
    async reply(id, token, body) {
      log.push(`reply ${id} ${token === 'interaction-token' ? 'token' : 'other'}`);
      bodies.push(body);
    },
    async defer(id, _token, flags) {
      log.push(`defer ${id} ${flags ?? '-'}`);
    },
    async editReply(appId, _token, body) {
      log.push(`edit ${appId}`);
      bodies.push(body);
    },
    async deleteReply(appId) {
      log.push(`delete ${appId}`);
    },
    async registerGlobalCommands(appId, commands) {
      log.push(`register ${appId} ${commands.length}`);
    },
    async sendDirectMessage(userId, body) {
      log.push(`dm ${userId}`);
      bodies.push(body);
    },
  };
}

interface Harness {
  transport: DiscordTransport;
  gateway: FakeGateway;
  calls: ReturnType<typeof fakeCalls>;
  factory: jest.Mock;
  closeCalls: () => number;
}

function harness(env: NodeJS.ProcessEnv, now: () => number = Date.now, deferAfterMs = 50): Harness {
  const gateway = new FakeGateway();
  const calls = fakeCalls();
  let closed = 0;
  const factory = jest.fn(
    async (): Promise<DiscordConnection> => ({ calls, gateway, close: () => (closed += 1) }),
  );
  const transport = new DiscordTransport({ env, factory, now, deferAfterMs });
  return { transport, gateway, calls, factory, closeCalls: () => closed };
}

const ON = { CHAT_DISCORD_ENABLED: 'true', DISCORD_BOT_TOKEN: TOKEN };

function interaction(overrides: Record<string, unknown> = {}, data: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '222222222222222222',
    application_id: APP_ID,
    type: InteractionType.ApplicationCommand,
    token: 'interaction-token',
    locale: 'zh-TW',
    context: 1,
    user: { id: USER_ID, username: 'keith_user', global_name: 'Keith Display' },
    data: { type: ApplicationCommandType.ChatInput, name: 'status', options: [], ...data },
    ...overrides,
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function watchLogs(logs: string[]): () => void {
  const methods = ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const;
  const spies: jest.SpyInstance[] = methods.map((method) =>
    jest.spyOn(Logger.prototype, method).mockImplementation((...args: unknown[]) => {
      logs.push(`${method}: ${args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')}`);
    }),
  );
  for (const method of ['log', 'warn', 'error', 'info', 'debug'] as const) {
    spies.push(
      jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logs.push(`console.${method}: ${args.map(String).join(' ')}`);
      }),
    );
  }
  return () => spies.forEach((spy) => spy.mockRestore());
}

describe('DiscordTransport (CHAT-DISCORD-01 B)', () => {
  let logs: string[];
  let restoreLogs: () => void;

  beforeEach(() => {
    logs = [];
    restoreLogs = watchLogs(logs);
  });

  afterEach(() => {
    restoreLogs();
    expect(logs.join('\n')).not.toContain(TOKEN);
    expect(logs.join('\n')).not.toContain('SECRET-TOKEN-VALUE');
  });

  it('uses the library constant values', () => {
    expect(DISCORD_GATEWAY_INTENTS).toBe(0);
    expect(DISCORD_INTERACTION_APPLICATION_COMMAND).toBe(InteractionType.ApplicationCommand);
    expect(DISCORD_COMMAND_DATA_CHAT_INPUT).toBe(ApplicationCommandType.ChatInput);
    expect(DISCORD_DISPATCH_INTERACTION_CREATE).toBe(GatewayDispatchEvents.InteractionCreate);
    expect(DISCORD_EPHEMERAL_FLAG).toBe(MessageFlags.Ephemeral);
    expect(DISCORD_GATEWAY_EVENTS).toEqual({
      closed: WebSocketShardEvents.Closed,
      dispatch: WebSocketShardEvents.Dispatch,
      error: WebSocketShardEvents.Error,
      ready: WebSocketShardEvents.Ready,
      resumed: WebSocketShardEvents.Resumed,
    });
    expect([...DISCORD_FATAL_CLOSE_CODES].sort()).toEqual(
      [
        GatewayCloseCodes.AuthenticationFailed,
        GatewayCloseCodes.InvalidShard,
        GatewayCloseCodes.ShardingRequired,
        GatewayCloseCodes.InvalidAPIVersion,
        GatewayCloseCodes.InvalidIntents,
        GatewayCloseCodes.DisallowedIntents,
      ].sort(),
    );
  });

  describe('switch and token', () => {
    it.each([
      ['unset', {}],
      ['false', { CHAT_DISCORD_ENABLED: 'false', DISCORD_BOT_TOKEN: TOKEN }],
      ['TRUE', { CHAT_DISCORD_ENABLED: 'TRUE', DISCORD_BOT_TOKEN: TOKEN }],
      ['1', { CHAT_DISCORD_ENABLED: '1', DISCORD_BOT_TOKEN: TOKEN }],
      [' true', { CHAT_DISCORD_ENABLED: ' true', DISCORD_BOT_TOKEN: TOKEN }],
    ])('switch %s: no connection and exactly one log line without any value', async (_label, env) => {
      const h = harness(env as NodeJS.ProcessEnv);
      expect(await h.transport.connect(jest.fn())).toBe(false);
      expect(h.factory).not.toHaveBeenCalled();
      expect(h.transport.state).toBe('off');
      expect(logs).toEqual(['log: chat discord off reason=switch_off']);
    });

    it.each([
      ['missing', { CHAT_DISCORD_ENABLED: 'true' }],
      ['empty', { CHAT_DISCORD_ENABLED: 'true', DISCORD_BOT_TOKEN: '' }],
      ['blank', { CHAT_DISCORD_ENABLED: 'true', DISCORD_BOT_TOKEN: '  \n' }],
    ])('token %s: no connection and exactly one log line', async (_label, env) => {
      const h = harness(env as NodeJS.ProcessEnv);
      expect(await h.transport.connect(jest.fn())).toBe(false);
      expect(h.factory).not.toHaveBeenCalled();
      expect(logs).toEqual(['log: chat discord off reason=token_missing']);
    });

    it('never loads or connects the real library under Jest', async () => {
      const real = jest.spyOn(transportModule, 'createDiscordConnection');
      const transport = new DiscordTransport({ env: { ...ON, JEST_WORKER_ID: '1' } });
      expect(await transport.connect(jest.fn())).toBe(false);
      expect(real).not.toHaveBeenCalled();
      expect(transport.state).toBe('off');
      expect(logs).toEqual(['log: chat discord off reason=test_environment']);
      // The default env is process.env, which has JEST_WORKER_ID here.
      expect(process.env.JEST_WORKER_ID).toBeDefined();
      const byDefault = new DiscordTransport();
      process.env.CHAT_DISCORD_ENABLED = 'true';
      process.env.DISCORD_BOT_TOKEN = TOKEN;
      try {
        expect(await byDefault.connect(jest.fn())).toBe(false);
      } finally {
        delete process.env.CHAT_DISCORD_ENABLED;
        delete process.env.DISCORD_BOT_TOKEN;
      }
      expect(real).not.toHaveBeenCalled();
      real.mockRestore();
    });

    it('connects with intents 0 and the token, without waiting for the session', async () => {
      const h = harness(ON);
      expect(await h.transport.connect(jest.fn())).toBe(true);
      expect(h.factory).toHaveBeenCalledTimes(1);
      expect(h.factory).toHaveBeenCalledWith(TOKEN, 0);
      expect(h.gateway.connectCalls).toBe(1);
      expect(h.transport.state).toBe('connecting');
      // Never listens to library debug output.
      expect(h.gateway.listenerCount('debug')).toBe(0);
      expect(h.gateway.eventNames().sort()).toEqual(['closed', 'dispatch', 'error', 'ready', 'resumed']);
      // A second connect does nothing.
      expect(await h.transport.connect(jest.fn())).toBe(false);
      expect(h.factory).toHaveBeenCalledTimes(1);
    });

    it('a factory failure stops the transport with one line naming the error class only', async () => {
      const factory = jest.fn(async () => {
        throw new TypeError(`bad token ${TOKEN}`);
      });
      const transport = new DiscordTransport({ env: ON, factory });
      expect(await transport.connect(jest.fn())).toBe(false);
      expect(transport.state).toBe('stopped');
      expect(logs).toEqual(['warn: chat discord connect failed reason=TypeError']);
    });

    it('a failed first connect (for example a 401 for a bad token) stops it and logs the status only', async () => {
      const h = harness(ON);
      const error = Object.assign(new Error(`401: Unauthorized ${TOKEN}`), { status: 401, name: 'DiscordAPIError' });
      h.gateway.connectResult = Promise.reject(error);
      await h.transport.connect(jest.fn());
      await flush();
      expect(h.transport.state).toBe('stopped');
      expect(h.gateway.destroyCalls).toBe(1);
      expect(h.closeCalls()).toBe(1);
      expect(logs).toContain('warn: chat discord stopped connect_failed reason=DiscordAPIError status=401');
    });
  });

  describe('ready and commands', () => {
    it('registers the commands once with the application id from the ready event', async () => {
      const h = harness(ON);
      await h.transport.connect(jest.fn());
      h.gateway.emit('ready', { application: { id: APP_ID, flags: 0 } }, 0);
      await flush();
      expect(h.transport.state).toBe('ready');
      expect(h.calls.log).toEqual([`register ${APP_ID} 7`]);
      h.gateway.emit('closed', 4200, 0);
      h.gateway.emit('ready', { application: { id: APP_ID, flags: 0 } }, 0);
      await flush();
      expect(h.calls.log).toEqual([`register ${APP_ID} 7`]);
      expect(logs).toEqual(
        expect.arrayContaining([
          'log: chat discord ready',
          'log: chat discord commands registered count=7',
        ]),
      );
    });

    it('a failed registration is logged by error class and status only', async () => {
      const h = harness(ON);
      h.calls.registerGlobalCommands = async () => {
        throw Object.assign(new Error(`Missing Access ${TOKEN}`), { status: 403, name: 'DiscordAPIError' });
      };
      await h.transport.connect(jest.fn());
      h.gateway.emit('ready', { application: { id: APP_ID } }, 0);
      await flush();
      expect(logs).toContain('warn: chat discord commands not registered reason=DiscordAPIError status=403');
    });

    it('library error events are logged by class name only', async () => {
      const h = harness(ON);
      await h.transport.connect(jest.fn());
      h.gateway.emit('error', new Error(`Authentication failed ${TOKEN}`), 0);
      expect(logs).toContain('warn: chat discord error reason=Error');
    });
  });

  describe('identify guard', () => {
    it('stops after 20 failed identifies in a day and closes the connection', async () => {
      let now = Date.parse('2026-11-14T00:00:00.000Z');
      const h = harness(ON, () => now);
      await h.transport.connect(jest.fn());
      for (let i = 1; i < DISCORD_MAX_FAILED_IDENTIFIES; i += 1) {
        h.gateway.emit('closed', 1006, 0);
        now += 60 * 1000;
      }
      expect(h.transport.state).toBe('connecting');
      expect(h.gateway.destroyCalls).toBe(0);
      h.gateway.emit('closed', 1006, 0);
      await flush();
      expect(h.transport.state).toBe('stopped');
      expect(h.gateway.destroyCalls).toBe(1);
      expect(logs).toContain('warn: chat discord stopped identify_limit failures=20');
      // Nothing more happens after the stop.
      h.gateway.emit('ready', { application: { id: APP_ID } }, 0);
      h.gateway.emit('closed', 1006, 0);
      expect(h.transport.state).toBe('stopped');
      expect(await h.transport.connect(jest.fn())).toBe(false);
      expect(DISCORD_MAX_FAILED_IDENTIFIES).toBe(20);
    });

    it('a close after a ready or resumed session is not a failed identify', async () => {
      const h = harness(ON);
      await h.transport.connect(jest.fn());
      for (let i = 0; i < 30; i += 1) {
        h.gateway.emit(i % 2 === 0 ? 'ready' : 'resumed', { application: { id: APP_ID } }, 0);
        h.gateway.emit('closed', 1006, 0);
      }
      await flush();
      expect(h.transport.state).toBe('connecting');
      expect(h.gateway.destroyCalls).toBe(0);
    });

    it('the guard counts in a 24-hour window', () => {
      const guard = new DiscordIdentifyGuard(3, HOUR);
      expect(guard.recordFailure(0)).toBe(false);
      expect(guard.recordFailure(10)).toBe(false);
      // At HOUR + 5 the failure at 0 has left the window; the one at 10 has not.
      expect(guard.recordFailure(HOUR + 5)).toBe(false);
      expect(guard.count(HOUR + 5)).toBe(2);
      expect(guard.recordFailure(HOUR + 6)).toBe(true);
      expect(new DiscordIdentifyGuard().count(0)).toBe(0);
    });

    it.each(DISCORD_FATAL_CLOSE_CODES.map((code) => [code]))('close code %i stops at once', async (code) => {
      const h = harness(ON);
      await h.transport.connect(jest.fn());
      h.gateway.emit('ready', { application: { id: APP_ID } }, 0);
      h.gateway.emit('closed', code, 0);
      await flush();
      expect(h.transport.state).toBe('stopped');
      expect(logs).toContain(`warn: chat discord stopped close_code code=${code}`);
    });
  });

  describe('interactions', () => {
    async function ready(handler: jest.Mock, deferAfterMs = 50): Promise<Harness> {
      const h = harness(ON, Date.now, deferAfterMs);
      await h.transport.connect(handler);
      h.gateway.emit('ready', { application: { id: APP_ID } }, 0);
      await flush();
      h.calls.log.length = 0;
      return h;
    }

    function dispatch(h: Harness, raw: Record<string, unknown>): void {
      h.gateway.emit('dispatch', { t: 'INTERACTION_CREATE', op: 0, s: 1, d: raw }, 0);
    }

    it('answers a direct-message command directly, with mentions off', async () => {
      const handler = jest.fn(async (): Promise<ChatReplyMessage> => ({ text: 'hello @everyone' }));
      const h = await ready(handler);
      dispatch(h, interaction());
      await flush();
      expect(handler).toHaveBeenCalledTimes(1);
      const invocation = (handler.mock.calls[0] as unknown[])[0] as ChatCommandInvocation;
      expect(invocation).toEqual(
        expect.objectContaining({
          channel: 'discord',
          command: 'status',
          options: {},
          externalUserId: USER_ID,
          displayName: 'Keith Display',
          locale: 'zh-TW',
          directMessage: true,
        }),
      );
      expect(h.calls.log).toEqual(['reply 222222222222222222 token']);
      expect(h.calls.bodies).toEqual([{ content: 'hello @everyone', allowed_mentions: { parse: [] } }]);
    });

    it('cuts a reply to 2000 characters', async () => {
      const h = await ready(jest.fn(async () => ({ text: 'x'.repeat(2500) })));
      dispatch(h, interaction());
      await flush();
      expect((h.calls.bodies[0] as { content: string }).content).toHaveLength(2000);
    });

    it('answers nothing when the handler returns null in time', async () => {
      const h = await ready(jest.fn(async () => null));
      dispatch(h, interaction());
      await flush();
      expect(h.calls.log).toEqual([]);
    });

    it('defers a slow answer, then edits the reply (or deletes it for no answer)', async () => {
      let release: (value: ChatReplyMessage | null) => void = () => undefined;
      const handler = jest.fn(
        () =>
          new Promise<ChatReplyMessage | null>((resolve) => {
            release = resolve;
          }),
      );
      const h = await ready(handler, 5);
      dispatch(h, interaction());
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(h.calls.log).toEqual(['defer 222222222222222222 -']);
      release({ text: 'late answer' });
      await flush();
      expect(h.calls.log).toEqual(['defer 222222222222222222 -', `edit ${APP_ID}`]);
      expect(h.calls.bodies).toEqual([{ content: 'late answer', allowed_mentions: { parse: [] } }]);

      h.calls.log.length = 0;
      dispatch(h, interaction());
      await new Promise((resolve) => setTimeout(resolve, 30));
      release(null);
      await flush();
      expect(h.calls.log).toEqual(['defer 222222222222222222 -', `delete ${APP_ID}`]);
    });

    it('marks a command outside the direct message and answers it ephemeral', async () => {
      const handler = jest.fn(async () => ({ text: 'use the DM' }));
      const h = await ready(handler);
      dispatch(
        h,
        interaction({ guild_id: '333333333333333333', context: 0, user: undefined, member: { user: { id: USER_ID } } }),
      );
      await flush();
      expect(((handler.mock.calls[0] as unknown[])[0] as ChatCommandInvocation).directMessage).toBe(false);
      expect(h.calls.bodies).toEqual([{ content: 'use the DM', allowed_mentions: { parse: [] }, flags: 64 }]);
    });

    it('ignores other events and interaction types', async () => {
      const handler = jest.fn(async () => ({ text: 'x' }));
      const h = await ready(handler);
      h.gateway.emit('dispatch', { t: 'MESSAGE_CREATE', d: { content: 'hi' } }, 0);
      dispatch(h, interaction({ type: InteractionType.MessageComponent }));
      dispatch(h, interaction({ type: InteractionType.ApplicationCommandAutocomplete }));
      dispatch(h, interaction({}, { type: ApplicationCommandType.User }));
      dispatch(h, interaction({ token: undefined }));
      await flush();
      expect(handler).not.toHaveBeenCalled();
      expect(h.calls.log).toEqual([]);
    });

    it('a handler failure is logged by class name only, with no reply', async () => {
      const h = await ready(
        jest.fn(async () => {
          throw new RangeError(`boom ${TOKEN}`);
        }),
      );
      dispatch(h, interaction());
      await flush();
      expect(h.calls.log).toEqual([]);
      expect(logs).toContain('warn: chat discord interaction failed reason=RangeError');
    });

    it('does not answer before ready or after disconnect', async () => {
      const handler = jest.fn(async () => ({ text: 'x' }));
      const h = harness(ON);
      await h.transport.connect(handler);
      dispatch(h, interaction());
      await flush();
      expect(handler).not.toHaveBeenCalled();
      h.gateway.emit('ready', { application: { id: APP_ID } }, 0);
      await h.transport.disconnect();
      dispatch(h, interaction());
      await flush();
      expect(handler).not.toHaveBeenCalled();
      expect(h.gateway.destroyCalls).toBe(1);
      expect(h.closeCalls()).toBe(1);
      expect(h.transport.state).toBe('stopped');
    });
  });

  describe('toChatInvocation', () => {
    it('reads only the declared string options and cuts them to their limit', () => {
      const invocation = toChatInvocation(
        interaction(
          {},
          {
            name: 'ask',
            options: [
              { type: 3, name: 'text', value: 'y'.repeat(7000) },
              { type: 3, name: 'agent', value: 'Research' },
              { type: 3, name: 'provider', value: 'openai' },
              { type: 4, name: 'text', value: 5 },
              { type: 3, name: 'text', value: 'second copy ignored' },
            ],
          },
        ),
      );
      expect(Object.keys(invocation?.options ?? {}).sort()).toEqual(['agent', 'text']);
      expect(invocation?.options.text).toHaveLength(6000);
      expect(invocation?.options.agent).toBe('Research');
    });

    it('keeps no options for an unknown command name and no user id that is not a snowflake', () => {
      const unknown = toChatInvocation(
        interaction({ user: { id: 'not-a-number' } }, { name: 'admin', options: [{ type: 3, name: 'code', value: 'x' }] }),
      );
      expect(unknown?.command).toBe('admin');
      expect(unknown?.options).toEqual({});
      expect(unknown?.externalUserId).toBe('');
    });

    it('is not a direct message in a server, a group DM or another context', () => {
      expect(toChatInvocation(interaction({ context: 2 }))?.directMessage).toBe(false);
      expect(toChatInvocation(interaction({ guild_id: '1' }))?.directMessage).toBe(false);
      expect(toChatInvocation(interaction({ context: undefined }))?.directMessage).toBe(true);
    });
  });

  describe('direct messages', () => {
    it('sends only when ready, only to a snowflake, with mentions off', async () => {
      const h = harness(ON);
      await h.transport.connect(jest.fn());
      await h.transport.sendDirectMessage(USER_ID, { text: 'early' });
      h.gateway.emit('ready', { application: { id: APP_ID } }, 0);
      await flush();
      h.calls.log.length = 0;
      await h.transport.sendDirectMessage('@everyone', { text: 'x' });
      await h.transport.sendDirectMessage(USER_ID, { text: 'result' });
      expect(h.calls.log).toEqual([`dm ${USER_ID}`]);
      expect(h.calls.bodies).toEqual([{ content: 'result', allowed_mentions: { parse: [] } }]);
    });
  });

  it('the source never logs the token variable or listens to library debug events', () => {
    const source = readFileSync(join(__dirname, 'discord-transport.ts'), 'utf8');
    const logCalls = source.match(/this\.logger\.\w+\([^;]*\);/g) ?? [];
    expect(logCalls.length).toBeGreaterThan(5);
    for (const call of logCalls) {
      expect(call).not.toMatch(/\$\{[^}]*token[^}]*\}/i);
      expect(call).not.toMatch(/\.message/);
    }
    expect(source).not.toMatch(/\.on\(\s*['"]debug['"]/);
    expect(source).not.toMatch(/console\./);
  });
});
