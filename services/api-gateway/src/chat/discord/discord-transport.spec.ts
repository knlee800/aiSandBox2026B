import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import {
  GatewayCloseCodes,
  GatewayDispatchEvents,
  GatewayIntentBits,
  InteractionResponseType,
  TextInputStyle,
  MessageType,
  InteractionType,
  ApplicationCommandType,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  RESTJSONErrorCodes,
} from '@discordjs/core';
import { WebSocketShardEvents } from '@discordjs/ws';
import {
  ChatDirectMessageRefusedError,
  ChatTransportNotReadyError,
  type ChatAutocompleteRequest,
  type ChatCommandInvocation,
  type ChatComponentPress,
  type ChatComponentResponse,
  type ChatPlainMessage,
  type ChatReplyMessage,
} from '../chat-transport';
import * as transportModule from './discord-transport';
import {
  DISCORD_ANSWER_WAIT_MS,
  DISCORD_CHOICES_MAX,
  DISCORD_COMPONENT_LABEL,
  DISCORD_COMPONENT_TEXT_INPUT,
  DISCORD_INTERACTION_AUTOCOMPLETE,
  DISCORD_INTERACTION_MODAL_SUBMIT,
  DISCORD_PENDING_MESSAGES_MAX,
  DISCORD_TEXT_INPUT_SHORT,
  discordChoices,
  discordModalBody,
  toChatAutocomplete,
  toChatModalSubmit,
  DISCORD_DM_REFUSED_CODES,
  DISCORD_REFERENCE_MAX_AGE_MS,
  discordInstallLinks,
  isDiscordDirectMessageRefused,
  DISCORD_BUTTON_STYLE_DANGER,
  DISCORD_BUTTON_STYLE_SUCCESS,
  DISCORD_COMMAND_DATA_CHAT_INPUT,
  DISCORD_COMPONENT_ACTION_ROW,
  DISCORD_COMPONENT_BUTTON,
  DISCORD_DISPATCH_INTERACTION_CREATE,
  DISCORD_DISPATCH_MESSAGE_CREATE,
  DISCORD_MESSAGE_TYPE_DEFAULT,
  DISCORD_MESSAGE_TYPE_REPLY,
  discordReplyBody,
  toChatPlainMessage,
  DISCORD_EPHEMERAL_FLAG,
  DISCORD_FATAL_CLOSE_CODES,
  DISCORD_GATEWAY_EVENTS,
  DISCORD_GATEWAY_INTENTS,
  DISCORD_INTERACTION_APPLICATION_COMMAND,
  DISCORD_INTERACTION_MESSAGE_COMPONENT,
  DISCORD_MAX_FAILED_IDENTIFIES,
  DISCORD_NONCE_MAX,
  discordNonceOf,
  DiscordCalls,
  DiscordConnection,
  DiscordIdentifyGuard,
  DiscordTransport,
  toChatComponentPress,
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
    async updateMessage(id, _token, body) {
      log.push(`update ${id}`);
      bodies.push(body);
    },
    async deferUpdate(id) {
      log.push(`deferUpdate ${id}`);
    },
    async followUp(appId, _token, body) {
      log.push(`followUp ${appId}`);
      bodies.push(body);
    },
    async replyToMessage(channelId, messageId, body) {
      log.push(`replyToMessage ${channelId} ${messageId}`);
      bodies.push(body);
    },
  };
}

const CUSTOM_ID = 'ap1:a:AAAAAAAAAAAAAAAAAAAAAA';

function buttonPress(overrides: Record<string, unknown> = {}, data: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '444444444444444444',
    application_id: APP_ID,
    type: InteractionType.MessageComponent,
    token: 'interaction-token',
    locale: 'zh-CN',
    context: 1,
    user: { id: USER_ID, username: 'keith_user', global_name: 'Keith Display' },
    message: { id: '555555555555555555', content: 'Step 2 is waiting' },
    data: { component_type: ComponentType.Button, custom_id: CUSTOM_ID, ...data },
    ...overrides,
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
    // CHAT-DISCORD-DM-01: DIRECT_MESSAGES only; no privileged intent (members, presences, message content).
    expect(DISCORD_GATEWAY_INTENTS).toBe(GatewayIntentBits.DirectMessages);
    expect(DISCORD_GATEWAY_INTENTS).toBe(4096);
    expect(
      DISCORD_GATEWAY_INTENTS &
        (GatewayIntentBits.GuildMembers | GatewayIntentBits.GuildPresences | GatewayIntentBits.MessageContent),
    ).toBe(0);
    expect(DISCORD_DISPATCH_MESSAGE_CREATE).toBe(GatewayDispatchEvents.MessageCreate);
    expect(DISCORD_MESSAGE_TYPE_DEFAULT).toBe(MessageType.Default);
    expect(DISCORD_MESSAGE_TYPE_REPLY).toBe(MessageType.Reply);
    expect(DISCORD_INTERACTION_APPLICATION_COMMAND).toBe(InteractionType.ApplicationCommand);
    expect(DISCORD_COMMAND_DATA_CHAT_INPUT).toBe(ApplicationCommandType.ChatInput);
    expect(DISCORD_DISPATCH_INTERACTION_CREATE).toBe(GatewayDispatchEvents.InteractionCreate);
    expect(DISCORD_EPHEMERAL_FLAG).toBe(MessageFlags.Ephemeral);
    expect(DISCORD_INTERACTION_MESSAGE_COMPONENT).toBe(InteractionType.MessageComponent);
    expect(DISCORD_COMPONENT_ACTION_ROW).toBe(ComponentType.ActionRow);
    expect(DISCORD_COMPONENT_BUTTON).toBe(ComponentType.Button);
    expect(DISCORD_BUTTON_STYLE_SUCCESS).toBe(ButtonStyle.Success);
    expect(DISCORD_BUTTON_STYLE_DANGER).toBe(ButtonStyle.Danger);
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

    it('connects with the DIRECT_MESSAGES intent and the token, without waiting for the session', async () => {
      const h = harness(ON);
      expect(await h.transport.connect(jest.fn())).toBe(true);
      expect(h.factory).toHaveBeenCalledTimes(1);
      expect(h.factory).toHaveBeenCalledWith(TOKEN, GatewayIntentBits.DirectMessages);
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

  describe('button presses (C2)', () => {
    async function ready(onComponent: jest.Mock, deferAfterMs = 50): Promise<Harness> {
      const h = harness(ON, Date.now, deferAfterMs);
      await h.transport.connect(jest.fn(async () => ({ text: 'command' })), onComponent);
      h.gateway.emit('ready', { application: { id: APP_ID } }, 0);
      await flush();
      h.calls.log.length = 0;
      return h;
    }

    function dispatch(h: Harness, raw: Record<string, unknown>): void {
      h.gateway.emit('dispatch', { t: 'INTERACTION_CREATE', op: 0, s: 1, d: raw }, 0);
    }

    const update: ChatComponentResponse = { kind: 'update', message: { text: 'Approved @everyone' } };
    const ephemeral: ChatComponentResponse = { kind: 'ephemeral', message: { text: 'No longer works' } };

    it('a press goes to the component handler with the custom id, presser and locale only', async () => {
      const onComponent = jest.fn(async () => update);
      const h = await ready(onComponent);
      dispatch(h, buttonPress());
      await flush();
      expect(onComponent).toHaveBeenCalledTimes(1);
      const press = (onComponent.mock.calls[0] as unknown[])[0] as ChatComponentPress;
      expect(press).toEqual(
        expect.objectContaining({
          channel: 'discord',
          customId: CUSTOM_ID,
          externalUserId: USER_ID,
          locale: 'zh-CN',
          directMessage: true,
        }),
      );
      expect(Object.keys(press).sort()).toEqual(['channel', 'customId', 'directMessage', 'externalUserId', 'locale', 'ref']);
    });

    it('an update edits the pressed message at once (type 7) and removes its buttons, mentions off', async () => {
      const h = await ready(jest.fn(async () => update));
      dispatch(h, buttonPress());
      await flush();
      expect(h.calls.log).toEqual(['update 444444444444444444']);
      expect(h.calls.bodies).toEqual([{ content: 'Approved @everyone', allowed_mentions: { parse: [] }, components: [] }]);
    });

    it('an ephemeral answer is a reply only the presser sees; the message is not edited', async () => {
      const h = await ready(jest.fn(async () => ephemeral));
      dispatch(h, buttonPress());
      await flush();
      expect(h.calls.log).toEqual(['reply 444444444444444444 token']);
      expect(h.calls.bodies).toEqual([{ content: 'No longer works', allowed_mentions: { parse: [] }, flags: 64 }]);
    });

    it('a slow handler: a deferred update within the window, then an edit of the message or a follow-up', async () => {
      let release: (value: ChatComponentResponse) => void = () => undefined;
      const onComponent = jest.fn(
        () =>
          new Promise<ChatComponentResponse>((resolve) => {
            release = resolve;
          }),
      );
      const h = await ready(onComponent, 5);
      dispatch(h, buttonPress());
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(h.calls.log).toEqual(['deferUpdate 444444444444444444']);
      release(update);
      await flush();
      expect(h.calls.log).toEqual(['deferUpdate 444444444444444444', `edit ${APP_ID}`]);
      expect(h.calls.bodies).toEqual([{ content: 'Approved @everyone', allowed_mentions: { parse: [] }, components: [] }]);

      h.calls.log.length = 0;
      h.calls.bodies.length = 0;
      dispatch(h, buttonPress());
      await new Promise((resolve) => setTimeout(resolve, 30));
      release(ephemeral);
      await flush();
      expect(h.calls.log).toEqual(['deferUpdate 444444444444444444', `followUp ${APP_ID}`]);
      expect(h.calls.bodies).toEqual([{ content: 'No longer works', allowed_mentions: { parse: [] }, flags: 64 }]);
    });

    it('ignores other components, a custom id over 100 characters, presses without a handler, before ready or after disconnect', async () => {
      const onComponent = jest.fn(async () => update);
      const h = await ready(onComponent);
      dispatch(h, buttonPress({}, { component_type: ComponentType.StringSelect }));
      dispatch(h, buttonPress({}, { custom_id: 'x'.repeat(101) }));
      dispatch(h, buttonPress({}, { custom_id: '' }));
      dispatch(h, buttonPress({}, { custom_id: 5 }));
      dispatch(h, buttonPress({ token: undefined }));
      await flush();
      expect(onComponent).not.toHaveBeenCalled();
      expect(h.calls.log).toEqual([]);

      const noHandler = harness(ON);
      const commands = jest.fn(async () => ({ text: 'command' }));
      await noHandler.transport.connect(commands);
      noHandler.gateway.emit('ready', { application: { id: APP_ID } }, 0);
      await flush();
      noHandler.calls.log.length = 0;
      noHandler.gateway.emit('dispatch', { t: 'INTERACTION_CREATE', op: 0, s: 1, d: buttonPress() }, 0);
      await flush();
      expect(commands).not.toHaveBeenCalled();
      expect(noHandler.calls.log).toEqual([]);

      await h.transport.disconnect();
      dispatch(h, buttonPress());
      await flush();
      expect(onComponent).not.toHaveBeenCalled();
    });

    it('a handler failure is logged by class name only, with no answer', async () => {
      const h = await ready(
        jest.fn(async () => {
          throw new RangeError(`boom ${CUSTOM_ID}`);
        }),
      );
      dispatch(h, buttonPress());
      await flush();
      expect(h.calls.log).toEqual([]);
      expect(logs).toContain('warn: chat discord press failed reason=RangeError');
      expect(logs.join('\n')).not.toContain(CUSTOM_ID);
    });

    it('toChatComponentPress: a press in a server or another context is not a direct message', () => {
      expect(toChatComponentPress(buttonPress())?.directMessage).toBe(true);
      expect(
        toChatComponentPress(buttonPress({ guild_id: '1', user: undefined, member: { user: { id: USER_ID } }, context: 0 }))
          ?.directMessage,
      ).toBe(false);
      expect(toChatComponentPress(buttonPress({ user: { id: 'not-a-number' } }))?.externalUserId).toBe('');
      expect(toChatComponentPress(interaction())).toBeNull();
      expect(toChatInvocation(buttonPress())).toBeNull();
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
    it('sends only when ready (CHAT-TIDY-01: before that it throws the typed not-ready error), only to a snowflake, with mentions off', async () => {
      const h = harness(ON);
      await expect(h.transport.sendToUser(USER_ID, { text: 'off' })).rejects.toBeInstanceOf(ChatTransportNotReadyError);
      await h.transport.connect(jest.fn());
      await expect(h.transport.sendToUser(USER_ID, { text: 'early' })).rejects.toBeInstanceOf(ChatTransportNotReadyError);
      h.gateway.emit('ready', { application: { id: APP_ID } }, 0);
      await flush();
      h.calls.log.length = 0;
      await h.transport.sendToUser('@everyone', { text: 'x' });
      await h.transport.sendToUser(USER_ID, { text: 'result' });
      expect(h.calls.log).toEqual([`dm ${USER_ID}`]);
      expect(h.calls.bodies).toEqual([{ content: 'result', allowed_mentions: { parse: [] } }]);
    });

    it('C2: a direct message with buttons sends one row (Approve green, Reject red); unusable buttons are left out', async () => {
      const h = harness(ON);
      await h.transport.connect(jest.fn());
      h.gateway.emit('ready', { application: { id: APP_ID } }, 0);
      await flush();
      h.calls.bodies.length = 0;
      const message: ChatReplyMessage = {
        text: 'Step 2 is waiting',
        buttons: [
          { customId: 'ap1:a:AAAAAAAAAAAAAAAAAAAAAA', label: 'Approve', style: 'approve' },
          { customId: 'ap1:r:AAAAAAAAAAAAAAAAAAAAAA', label: `Reject ${'x'.repeat(100)}`, style: 'reject' },
          { customId: 'y'.repeat(101), label: 'Too long', style: 'approve' },
          { customId: '', label: 'Empty', style: 'approve' },
          { customId: 'ok', label: '', style: 'approve' },
        ],
      };
      await h.transport.sendToUser(USER_ID, message);
      expect(h.calls.bodies).toEqual([
        {
          content: 'Step 2 is waiting',
          allowed_mentions: { parse: [] },
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                { type: ComponentType.Button, style: ButtonStyle.Success, label: 'Approve', custom_id: 'ap1:a:AAAAAAAAAAAAAAAAAAAAAA' },
                { type: ComponentType.Button, style: ButtonStyle.Danger, label: `Reject ${'x'.repeat(73)}`, custom_id: 'ap1:r:AAAAAAAAAAAAAAAAAAAAAA' },
              ],
            },
          ],
        },
      ]);
      // A plain message has no components key at all.
      await h.transport.sendToUser(USER_ID, { text: 'plain', buttons: [] });
      expect(h.calls.bodies[1]).toEqual({ content: 'plain', allowed_mentions: { parse: [] } });
    });

    it('CHAT-STATE-PERSIST-01: a dedupe key gives the direct message Discord’s nonce (25 characters) with enforce_nonce', async () => {
      const h = harness(ON);
      await h.transport.connect(jest.fn());
      h.gateway.emit('ready', { application: { id: APP_ID } }, 0);
      await flush();
      h.calls.bodies.length = 0;
      await h.transport.sendToUser(USER_ID, { text: 'part 3' }, { dedupeKey: 'chat-result:collab-run-1:3' });
      await h.transport.sendToUser(USER_ID, { text: 'part 3 again' }, { dedupeKey: 'chat-result:collab-run-1:3' });
      await h.transport.sendToUser(USER_ID, { text: 'part 4' }, { dedupeKey: 'chat-result:collab-run-1:4' });
      await h.transport.sendToUser(USER_ID, { text: 'no key' });
      await h.transport.sendToUser(USER_ID, { text: 'empty key' }, { dedupeKey: '' });
      const bodies = h.calls.bodies as Array<Record<string, unknown>>;
      const nonce = discordNonceOf('chat-result:collab-run-1:3');
      expect(nonce).toMatch(/^[0-9a-f]{25}$/);
      expect(DISCORD_NONCE_MAX).toBe(25);
      expect(bodies[0]).toEqual({ content: 'part 3', allowed_mentions: { parse: [] }, nonce, enforce_nonce: true });
      // The same part re-sent carries the same nonce, so Discord returns the earlier message.
      expect(bodies[1].nonce).toBe(nonce);
      expect(bodies[2].nonce).toBe(discordNonceOf('chat-result:collab-run-1:4'));
      expect(bodies[2].nonce).not.toBe(nonce);
      // The nonce holds no id: it is a hash.
      expect(String(nonce)).not.toContain('collab-run-1');
      expect(bodies[3]).toEqual({ content: 'no key', allowed_mentions: { parse: [] } });
      expect(bodies[4]).toEqual({ content: 'empty key', allowed_mentions: { parse: [] } });
    });

    it('CHAT-STATE-PERSIST-01: Discord’s message body type knows nonce and enforce_nonce', () => {
      // Compile-time check against discord-api-types (the Create Message JSON params).
      const body: import('@discordjs/core').RESTPostAPIChannelMessageJSONBody = {
        content: 'x',
        nonce: discordNonceOf('k'),
        enforce_nonce: true,
      };
      expect(body.enforce_nonce).toBe(true);
    });
  });

  describe('any Discord account: user installs, follow-ups and refused direct messages (CHAT-USER-INSTALL-01)', () => {
    const OTHER_USER = '876543210987654321';
    const BOT_USER_ID = '333333333333333333';
    const APPROVE: ChatReplyMessage = {
      text: 'Step 2 is waiting @everyone',
      buttons: [{ customId: 'ap1:a:AAAAAAAAAAAAAAAAAAAAAA', label: 'Approve', style: 'approve' }],
    };
    let now: number;
    let followUps: Array<{ appId: string; token: string; body: unknown }>;

    async function readyWith(
      handler: jest.Mock = jest.fn(async () => ({ text: 'reply' })),
      options: { onComponent?: jest.Mock; deferAfterMs?: number; answerWaitMs?: number } = {},
    ): Promise<Harness> {
      const gateway = new FakeGateway();
      const calls = fakeCalls();
      calls.followUp = async (appId, token, body) => {
        calls.log.push(`followUp ${appId}`);
        followUps.push({ appId, token, body });
      };
      let closed = 0;
      const factory = jest.fn(async (): Promise<DiscordConnection> => ({ calls, gateway, close: () => (closed += 1) }));
      const transport = new DiscordTransport({
        env: ON,
        factory,
        now: () => now,
        deferAfterMs: options.deferAfterMs ?? 50,
        answerWaitMs: options.answerWaitMs ?? 1000,
      });
      await transport.connect(handler, options.onComponent);
      gateway.emit('ready', { application: { id: APP_ID }, user: { id: BOT_USER_ID } }, 0);
      await flush();
      calls.log.length = 0;
      calls.bodies.length = 0;
      return { transport, gateway, calls, factory, closeCalls: () => closed };
    }

    function dispatch(h: Harness, raw: Record<string, unknown>): void {
      h.gateway.emit('dispatch', { t: 'INTERACTION_CREATE', op: 0, s: 1, d: raw }, 0);
    }

    /** A command from an account that added the bot to its own apps (authorizing owner key 1 = user install). */
    function userInstall(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return interaction({ authorizing_integration_owners: { '1': USER_ID }, context: 1, ...overrides });
    }

    function refusal(code: number): Error {
      return Object.assign(new Error(`Cannot send messages to this user ${USER_ID}`), {
        status: 403,
        code,
        name: `DiscordAPIError[${code}]`,
      });
    }

    beforeEach(() => {
      now = Date.parse('2026-11-19T10:00:00.000Z');
      followUps = [];
    });

    it('a user-install command in the bot direct message (no guild_id, context 1) is accepted and answered there', async () => {
      const handler = jest.fn(async () => ({ text: 'hello' }));
      const h = await readyWith(handler);
      const raw = userInstall();
      expect(raw.guild_id).toBeUndefined();
      dispatch(h, raw);
      await flush();
      expect(handler).toHaveBeenCalledTimes(1);
      const invocation = (handler.mock.calls[0] as unknown[])[0] as ChatCommandInvocation;
      expect(invocation).toEqual(expect.objectContaining({ externalUserId: USER_ID, directMessage: true, command: 'status' }));
      expect(h.calls.log).toEqual(['reply 222222222222222222 token']);
      expect(h.calls.bodies).toEqual([{ content: 'hello', allowed_mentions: { parse: [] } }]);
      expect(h.transport.referenceCount).toBe(1);
    });

    it('a user-install command in a server, or in another context, is refused: ephemeral and no reference kept', async () => {
      const handler = jest.fn(async () => ({ text: 'use the DM' }));
      const h = await readyWith(handler);
      dispatch(
        h,
        userInstall({ guild_id: '444444444444444444', context: 0, user: undefined, member: { user: { id: USER_ID } } }),
      );
      dispatch(h, userInstall({ context: 2 }));
      await flush();
      expect(handler).toHaveBeenCalledTimes(2);
      for (const call of handler.mock.calls as unknown[][]) {
        expect((call[0] as ChatCommandInvocation).directMessage).toBe(false);
      }
      expect(h.calls.bodies).toEqual([
        { content: 'use the DM', allowed_mentions: { parse: [] }, flags: 64 },
        { content: 'use the DM', allowed_mentions: { parse: [] }, flags: 64 },
      ]);
      expect(h.transport.referenceCount).toBe(0);
      await h.transport.sendToUser(USER_ID, { text: 'result' });
      expect(h.calls.log.slice(-1)).toEqual([`dm ${USER_ID}`]);
    });

    it('a fresh reference sends a follow-up (mentions off, not ephemeral, buttons kept); after 14 minutes the direct message', async () => {
      expect(DISCORD_REFERENCE_MAX_AGE_MS).toBe(14 * 60 * 1000);
      const h = await readyWith();
      dispatch(h, userInstall());
      await flush();
      h.calls.log.length = 0;
      h.calls.bodies.length = 0;

      now += DISCORD_REFERENCE_MAX_AGE_MS - 1;
      await h.transport.sendToUser(USER_ID, APPROVE);
      expect(h.calls.log).toEqual([`followUp ${APP_ID}`]);
      expect(followUps).toEqual([
        {
          appId: APP_ID,
          token: 'interaction-token',
          body: {
            content: 'Step 2 is waiting @everyone',
            allowed_mentions: { parse: [] },
            components: [
              {
                type: ComponentType.ActionRow,
                components: [
                  { type: ComponentType.Button, style: ButtonStyle.Success, label: 'Approve', custom_id: 'ap1:a:AAAAAAAAAAAAAAAAAAAAAA' },
                ],
              },
            ],
          },
        },
      ]);

      now += 1;
      await h.transport.sendToUser(USER_ID, { text: 'later' });
      expect(h.calls.log).toEqual([`followUp ${APP_ID}`, `dm ${USER_ID}`]);
      expect(h.transport.referenceCount).toBe(0);
    });

    it('a reference belongs to its user only: another user gets the direct message', async () => {
      const h = await readyWith();
      dispatch(h, userInstall());
      await flush();
      h.calls.log.length = 0;
      await h.transport.sendToUser(OTHER_USER, { text: 'result' });
      expect(h.calls.log).toEqual([`dm ${OTHER_USER}`]);
      expect(followUps).toEqual([]);
    });

    it('a button press keeps a reference too; the latest interaction wins', async () => {
      const onComponent = jest.fn(async (): Promise<ChatComponentResponse> => ({ kind: 'ephemeral', message: { text: 'ok' } }));
      const h = await readyWith(undefined, { onComponent });
      dispatch(h, userInstall());
      await flush();
      now += 60 * 1000;
      dispatch(h, buttonPress({ token: 'press-token' }));
      await flush();
      expect(h.transport.referenceCount).toBe(1);
      await h.transport.sendToUser(USER_ID, { text: 'result' });
      expect(followUps.map((entry) => entry.token)).toEqual(['press-token']);
    });

    it('the follow-up goes out only after the command’s own answer', async () => {
      let release: (value: ChatReplyMessage | null) => void = () => undefined;
      const handler = jest.fn(
        () =>
          new Promise<ChatReplyMessage | null>((resolve) => {
            release = resolve;
          }),
      );
      const h = await readyWith(handler, { deferAfterMs: 60 * 1000, answerWaitMs: 60 * 1000 });
      dispatch(h, userInstall());
      await flush();
      const sending = h.transport.sendToUser(USER_ID, { text: 'result' });
      await flush();
      expect(h.calls.log).toEqual([]);
      release({ text: 'the reply' });
      await sending;
      expect(h.calls.log).toEqual(['reply 222222222222222222 token', `followUp ${APP_ID}`]);
    });

    it('waits for the answer at most answerWaitMs', async () => {
      const h = await readyWith(jest.fn(() => new Promise<ChatReplyMessage | null>(() => undefined)), {
        deferAfterMs: 60 * 1000,
        answerWaitMs: 20,
      });
      dispatch(h, userInstall());
      await flush();
      await h.transport.sendToUser(USER_ID, { text: 'result' });
      expect(h.calls.log).toEqual([`followUp ${APP_ID}`]);
      expect(DISCORD_ANSWER_WAIT_MS).toBe(5000);
    });

    it('a follow-up that fails falls back to the direct message and forgets the reference, logged by class and status only', async () => {
      const h = await readyWith();
      h.calls.followUp = async () => {
        throw Object.assign(new Error('Unknown Webhook interaction-token'), { status: 404, name: 'DiscordAPIError' });
      };
      dispatch(h, userInstall());
      await flush();
      h.calls.log.length = 0;
      await h.transport.sendToUser(USER_ID, { text: 'result' });
      expect(h.calls.log).toEqual([`dm ${USER_ID}`]);
      expect(h.transport.referenceCount).toBe(0);
      expect(logs).toContain('warn: chat discord follow-up failed reason=DiscordAPIError status=404');
      expect(logs.join('\n')).not.toContain('interaction-token');
      expect(logs.join('\n')).not.toContain(USER_ID);
    });

    it('CHAT-STATE-PERSIST-01: a follow-up never carries the nonce; the direct message it falls back to does', async () => {
      const h = await readyWith();
      dispatch(h, userInstall());
      await flush();
      h.calls.log.length = 0;
      await h.transport.sendToUser(USER_ID, { text: 'part 1' }, { dedupeKey: 'chat-result:run-9:1' });
      expect(followUps.map((entry) => entry.body)).toEqual([{ content: 'part 1', allowed_mentions: { parse: [] } }]);
      h.calls.followUp = async () => {
        throw Object.assign(new Error('Unknown Webhook'), { status: 404, name: 'DiscordAPIError' });
      };
      await h.transport.sendToUser(USER_ID, { text: 'part 2' }, { dedupeKey: 'chat-result:run-9:2' });
      expect(h.calls.log).toEqual([`followUp ${APP_ID}`, `dm ${USER_ID}`]);
      expect(h.calls.bodies.slice(-1)).toEqual([
        { content: 'part 2', allowed_mentions: { parse: [] }, nonce: discordNonceOf('chat-result:run-9:2'), enforce_nonce: true },
      ]);
    });

    it.each([50007, 50278])('a direct message refused with HTTP 403 and code %i throws ChatDirectMessageRefusedError', async (code) => {
      const h = await readyWith();
      h.calls.sendDirectMessage = async () => {
        throw refusal(code);
      };
      const error = await h.transport.sendToUser(USER_ID, { text: 'result' }).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ChatDirectMessageRefusedError);
      expect((error as Error).name).toBe('ChatDirectMessageRefusedError');
      expect((error as Error).message).not.toContain(USER_ID);
    });

    it('a refused follow-up then a refused direct message also throws the refused error', async () => {
      const h = await readyWith();
      h.calls.followUp = async () => {
        throw Object.assign(new Error('Invalid Webhook Token'), { status: 401, name: 'DiscordAPIError' });
      };
      h.calls.sendDirectMessage = async () => {
        throw refusal(50007);
      };
      dispatch(h, userInstall());
      await flush();
      await expect(h.transport.sendToUser(USER_ID, { text: 'result' })).rejects.toBeInstanceOf(ChatDirectMessageRefusedError);
    });

    it('other direct message errors are thrown unchanged', async () => {
      const h = await readyWith();
      const missingAccess = Object.assign(new Error('Missing Access'), { status: 403, code: 50001 });
      const serverError = Object.assign(new Error('Internal Server Error'), { status: 500 });
      for (const failure of [missingAccess, serverError]) {
        h.calls.sendDirectMessage = async () => {
          throw failure;
        };
        await expect(h.transport.sendToUser(USER_ID, { text: 'result' })).rejects.toBe(failure);
      }
      expect(isDiscordDirectMessageRefused({ status: 403, code: 50007 })).toBe(true);
      expect(isDiscordDirectMessageRefused({ status: 403, code: '50278' })).toBe(true);
      expect(isDiscordDirectMessageRefused({ status: 401, code: 50007 })).toBe(false);
      expect(isDiscordDirectMessageRefused({ status: 403, code: 50001 })).toBe(false);
      expect(isDiscordDirectMessageRefused(null)).toBe(false);
      expect(DISCORD_DM_REFUSED_CODES).toEqual([
        RESTJSONErrorCodes.CannotSendMessagesToThisUser,
        RESTJSONErrorCodes.CannotSendMessagesToThisUserDueToHavingNoMutualGuilds,
      ]);
    });

    it('references are memory only: cleared on disconnect and on a stop, never logged', async () => {
      const h = await readyWith();
      dispatch(h, userInstall());
      await flush();
      expect(h.transport.referenceCount).toBe(1);
      await h.transport.disconnect();
      expect(h.transport.referenceCount).toBe(0);

      const stopped = await readyWith();
      dispatch(stopped, userInstall());
      await flush();
      expect(stopped.transport.referenceCount).toBe(1);
      stopped.gateway.emit('closed', GatewayCloseCodes.AuthenticationFailed, 0);
      await flush();
      expect(stopped.transport.state).toBe('stopped');
      expect(stopped.transport.referenceCount).toBe(0);
      expect(logs.join('\n')).not.toContain('interaction-token');
    });

    it('install links: from the READY application id and bot user id while ready; null otherwise', async () => {
      const h = await readyWith();
      const links = h.transport.installLinks();
      expect(links).toEqual({
        installUrl: `https://discord.com/oauth2/authorize?client_id=${APP_ID}&integration_type=1&scope=applications.commands`,
        botProfileUrl: `https://discord.com/users/${BOT_USER_ID}`,
      });
      expect(JSON.stringify(links)).not.toContain(TOKEN);
      await h.transport.disconnect();
      expect(h.transport.installLinks()).toBeNull();

      const plain = harness(ON);
      await plain.transport.connect(jest.fn());
      expect(plain.transport.installLinks()).toBeNull();
      plain.gateway.emit('ready', { application: { id: APP_ID } }, 0);
      await flush();
      expect(plain.transport.installLinks()).toBeNull();
      plain.gateway.emit('ready', { application: { id: APP_ID }, user: { id: '<@1>' } }, 0);
      expect(plain.transport.installLinks()).toBeNull();

      expect(discordInstallLinks('12x', BOT_USER_ID)).toBeNull();
      expect(discordInstallLinks(APP_ID, undefined)).toBeNull();
      expect(discordInstallLinks(APP_ID, '1 OR 1')).toBeNull();
      expect(discordInstallLinks(APP_ID, BOT_USER_ID)?.installUrl).toContain('integration_type=1');
    });
  });

  describe('plain direct messages (CHAT-DISCORD-DM-01)', () => {
    const BOT_USER_ID = '333333333333333333';
    const DM_CHANNEL_ID = '666666666666666666';
    const MESSAGE_ID = '777777777777777777';
    const TEXT_MARKER = 'MARKER-dm-text-do-not-log';

    function plainMessage(overrides: Record<string, unknown> = {}, author: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        id: MESSAGE_ID,
        channel_id: DM_CHANNEL_ID,
        type: MessageType.Default,
        content: `  ${TEXT_MARKER} plan my week \n`,
        author: { id: USER_ID, username: 'keith_user', global_name: 'Keith Display', ...author },
        mentions: [],
        attachments: [],
        ...overrides,
      };
    }

    async function readyWith(
      onMessage: jest.Mock | undefined,
      botUserId: string | null = BOT_USER_ID,
      command: jest.Mock = jest.fn(async () => ({ text: 'command' })),
    ): Promise<Harness> {
      const h = harness(ON);
      await h.transport.connect(command, undefined, onMessage);
      h.gateway.emit('ready', { application: { id: APP_ID }, ...(botUserId ? { user: { id: botUserId } } : {}) }, 0);
      await flush();
      h.calls.log.length = 0;
      h.calls.bodies.length = 0;
      logs.length = 0;
      return h;
    }

    function send(h: Harness, raw: Record<string, unknown>): void {
      h.gateway.emit('dispatch', { t: GatewayDispatchEvents.MessageCreate, op: 0, s: 2, d: raw }, 0);
    }

    function refused(code: number): Error {
      return Object.assign(new Error(`Cannot send messages to this user ${USER_ID} ${DM_CHANNEL_ID}`), {
        status: 403,
        code,
        name: `DiscordAPIError[${code}]`,
      });
    }

    function expectNoValuesLogged(): void {
      const all = logs.join('\n');
      expect(all).not.toContain(TEXT_MARKER);
      expect(all).not.toContain(USER_ID);
      expect(all).not.toContain(DM_CHANNEL_ID);
      expect(all).not.toContain(MESSAGE_ID);
    }

    it('a direct message goes to the message handler (trimmed text and author id only) and is answered as a reply, mentions off', async () => {
      const onMessage = jest.fn(async (): Promise<ChatReplyMessage> => ({
        text: 'started @everyone',
        buttons: [{ customId: 'ap1:a:AAAAAAAAAAAAAAAAAAAAAA', label: 'Approve', style: 'approve' }],
      }));
      const command = jest.fn();
      const h = await readyWith(onMessage, BOT_USER_ID, command);
      send(h, plainMessage());
      await flush();
      expect(command).not.toHaveBeenCalled();
      expect(onMessage).toHaveBeenCalledTimes(1);
      const received = (onMessage.mock.calls[0] as unknown[])[0] as ChatPlainMessage;
      expect(received).toEqual({
        channel: 'discord',
        text: `${TEXT_MARKER} plan my week`,
        externalUserId: USER_ID,
        ref: expect.any(Object),
      });
      // The display name and anything else in the message are not read.
      expect(JSON.stringify(received)).not.toContain('Keith Display');
      expect(h.calls.log).toEqual([`replyToMessage ${DM_CHANNEL_ID} ${MESSAGE_ID}`]);
      // No buttons on a reply to a plain message.
      expect(h.calls.bodies).toEqual([{ content: 'started @everyone', allowed_mentions: { parse: [] } }]);
      // A message keeps no interaction reference: a later result goes by direct message.
      expect(h.transport.referenceCount).toBe(0);
      await h.transport.sendToUser(USER_ID, { text: 'result' });
      expect(h.calls.log).toEqual([`replyToMessage ${DM_CHANNEL_ID} ${MESSAGE_ID}`, `dm ${USER_ID}`]);
      expectNoValuesLogged();
    });

    it('a reply (type 19) is read too; empty content (an attachment or sticker only) reaches the handler as empty text', async () => {
      const onMessage = jest.fn(async () => ({ text: 'ok' }));
      const h = await readyWith(onMessage);
      send(h, plainMessage({ type: MessageType.Reply, message_reference: { message_id: '1' } }));
      send(h, plainMessage({ content: '', attachments: [{ id: '1' }] }));
      send(h, plainMessage({ content: undefined, sticker_items: [{ id: '1' }] }));
      await flush();
      expect(onMessage.mock.calls.map((call) => ((call as unknown[])[0] as ChatPlainMessage).text)).toEqual([
        `${TEXT_MARKER} plan my week`,
        '',
        '',
      ]);
    });

    it('ignores server messages, bots, system users, webhooks, the bot itself, other types and non-snowflake ids, silently', async () => {
      const onMessage = jest.fn(async () => ({ text: 'x' }));
      const h = await readyWith(onMessage);
      const ignored: Array<Record<string, unknown>> = [
        plainMessage({ guild_id: '888888888888888888' }),
        plainMessage({ member: { roles: [] } }),
        plainMessage({}, { bot: true }),
        plainMessage({}, { system: true }),
        plainMessage({ webhook_id: '999999999999999999' }),
        plainMessage({}, { id: BOT_USER_ID }),
        plainMessage({ type: MessageType.ChatInputCommand }),
        plainMessage({ type: MessageType.UserJoin }),
        plainMessage({ type: MessageType.ThreadCreated }),
        plainMessage({ type: '0' }),
        plainMessage({}, { id: '<@123>' }),
        plainMessage({}, { id: 123 }),
        plainMessage({ author: undefined }),
        plainMessage({ id: 'not-a-snowflake' }),
        plainMessage({ channel_id: '../channels/1' }),
      ];
      for (const raw of ignored) send(h, raw);
      h.gateway.emit('dispatch', { t: GatewayDispatchEvents.MessageCreate, d: null }, 0);
      h.gateway.emit('dispatch', { t: GatewayDispatchEvents.MessageUpdate, d: plainMessage() }, 0);
      h.gateway.emit('dispatch', { t: GatewayDispatchEvents.InteractionCreate, d: plainMessage() }, 0);
      await flush();
      expect(onMessage).not.toHaveBeenCalled();
      expect(h.calls.log).toEqual([]);
      expect(logs).toEqual([]);
      // The same messages through the parser directly.
      for (const raw of ignored) expect(toChatPlainMessage(raw, BOT_USER_ID)).toBeNull();
      expect(toChatPlainMessage(plainMessage(), BOT_USER_ID)).not.toBeNull();
    });

    it('while the bot’s own user id is unknown, nothing is read (fail closed)', async () => {
      const onMessage = jest.fn(async () => ({ text: 'x' }));
      const h = await readyWith(onMessage, null);
      send(h, plainMessage());
      await flush();
      expect(onMessage).not.toHaveBeenCalled();
      expect(toChatPlainMessage(plainMessage(), null)).toBeNull();
      expect(toChatPlainMessage(plainMessage(), 'bot')).toBeNull();
    });

    it('no message handler, or after disconnect: ignored; CHAT-TIDY-01: before ready it waits for the session', async () => {
      const without = await readyWith(undefined);
      send(without, plainMessage());
      await flush();
      expect(without.calls.log).toEqual([]);

      const onMessage = jest.fn(async () => ({ text: 'x' }));
      const h = harness(ON);
      await h.transport.connect(jest.fn(), undefined, onMessage);
      send(h, plainMessage());
      await flush();
      expect(onMessage).not.toHaveBeenCalled();
      expect(h.transport.pendingMessageCount).toBe(1);
      h.gateway.emit('ready', { application: { id: APP_ID }, user: { id: BOT_USER_ID } }, 0);
      await flush();
      expect(onMessage).toHaveBeenCalledTimes(1);
      onMessage.mockClear();
      await h.transport.disconnect();
      send(h, plainMessage());
      await flush();
      expect(onMessage).not.toHaveBeenCalled();
    });

    it('a null answer sends nothing', async () => {
      const h = await readyWith(jest.fn(async () => null));
      send(h, plainMessage());
      await flush();
      expect(h.calls.log).toEqual([]);
    });

    it.each(DISCORD_DM_REFUSED_CODES.map((code) => [code]))(
      'a refused reply (403, code %i) is logged once with a reason code and otherwise ignored',
      async (code) => {
        const h = await readyWith(jest.fn(async () => ({ text: 'started' })));
        h.calls.replyToMessage = async () => {
          throw refused(code);
        };
        send(h, plainMessage());
        await flush();
        expect(logs).toEqual(['warn: chat discord message reply refused reason=dm_refused']);
        expect(h.transport.state).toBe('ready');
        expectNoValuesLogged();
      },
    );

    it('another reply failure, or a handler failure, is logged by class and status only', async () => {
      const h = await readyWith(jest.fn(async () => ({ text: 'started' })));
      h.calls.replyToMessage = async () => {
        throw Object.assign(new Error(`Missing Access ${DM_CHANNEL_ID}`), { status: 500, name: 'DiscordAPIError' });
      };
      send(h, plainMessage());
      await flush();
      expect(logs).toEqual(['warn: chat discord message reply failed reason=DiscordAPIError status=500']);

      logs.length = 0;
      const failing = await readyWith(
        jest.fn(async () => {
          throw new RangeError(`boom ${TEXT_MARKER} ${USER_ID}`);
        }),
      );
      send(failing, plainMessage());
      await flush();
      expect(failing.calls.log).toEqual([]);
      expect(logs).toEqual(['warn: chat discord message failed reason=RangeError']);
      expectNoValuesLogged();
    });

    it('the reply body: a message reference that never fails, mentions off; Discord’s body type knows it', () => {
      expect(discordReplyBody(MESSAGE_ID, { content: 'hi', allowed_mentions: { parse: [] } })).toEqual({
        content: 'hi',
        allowed_mentions: { parse: [] },
        message_reference: { message_id: MESSAGE_ID, fail_if_not_exists: false },
      });
      // Compile-time check against discord-api-types (the Create Message JSON params).
      const body: import('@discordjs/core').RESTPostAPIChannelMessageJSONBody = discordReplyBody(MESSAGE_ID, {
        content: 'x',
        allowed_mentions: { parse: [] },
      });
      expect(body.message_reference?.fail_if_not_exists).toBe(false);
      expect(body.allowed_mentions?.replied_user).toBeUndefined();
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
  describe('CHAT-TIDY-01', () => {
    const TYPED_MARKER = 'MARKER-typed-agent-do-not-log';
    const REASON_MARKER = 'MARKER-reject-reason-do-not-log';

    it('the new numbers match the library enums', () => {
      expect(DISCORD_INTERACTION_AUTOCOMPLETE).toBe(InteractionType.ApplicationCommandAutocomplete);
      expect(DISCORD_INTERACTION_MODAL_SUBMIT).toBe(InteractionType.ModalSubmit);
      expect(DISCORD_COMPONENT_TEXT_INPUT).toBe(ComponentType.TextInput);
      expect(DISCORD_COMPONENT_LABEL).toBe(ComponentType.Label);
      expect(DISCORD_TEXT_INPUT_SHORT).toBe(TextInputStyle.Short);
      expect(InteractionResponseType.ApplicationCommandAutocompleteResult).toBe(8);
      expect(InteractionResponseType.Modal).toBe(9);
    });

    describe('/ask agent suggestions (autocomplete, interaction type 4)', () => {
      function typing(value: unknown = 'sal', overrides: Record<string, unknown> = {}, options?: unknown[]): Record<string, unknown> {
        return {
          id: '888888888888888888',
          application_id: APP_ID,
          type: InteractionType.ApplicationCommandAutocomplete,
          token: 'autocomplete-token',
          locale: 'en-US',
          context: 1,
          user: { id: USER_ID, username: 'keith_user' },
          data: {
            type: ApplicationCommandType.ChatInput,
            name: 'ask',
            options: options ?? [
              { type: 3, name: 'text', value: 'x' },
              { type: 3, name: 'agent', value, focused: true },
            ],
          },
          ...overrides,
        };
      }

      async function readyWithSuggestions(handler: jest.Mock): Promise<Harness & { answers: Array<{ id: string; token: string; choices: unknown }> }> {
        const h = harness(ON);
        const answers: Array<{ id: string; token: string; choices: unknown }> = [];
        h.calls.autocomplete = async (id, token, choices) => {
          answers.push({ id, token, choices });
        };
        await h.transport.connect(jest.fn(), undefined, undefined, handler);
        h.gateway.emit('ready', { application: { id: APP_ID }, user: { id: '333333333333333333' } }, 0);
        await flush();
        logs.length = 0;
        return { ...h, answers };
      }

      function emit(h: Harness, raw: Record<string, unknown>): void {
        h.gateway.emit('dispatch', { t: GatewayDispatchEvents.InteractionCreate, op: 0, s: 3, d: raw }, 0);
      }

      it('reads only the focused declared option and answers callback type 8 with at most 25 suggestions of at most 100 characters; logs nothing, keeps no reference', async () => {
        const handler = jest.fn<Promise<Array<{ name: string; value: string }>>, [ChatAutocompleteRequest]>(async () =>
          Array.from({ length: 30 }, (_, i) => ({ name: `${i} ${'N'.repeat(120)}`, value: `${i} ${'V'.repeat(120)}` })),
        );
        const h = await readyWithSuggestions(handler);
        emit(h, typing(`  ${TYPED_MARKER}  `));
        await flush();
        expect(handler).toHaveBeenCalledWith({
          channel: 'discord',
          command: 'ask',
          option: 'agent',
          value: `  ${TYPED_MARKER}  `,
          externalUserId: USER_ID,
          locale: 'en-US',
          directMessage: true,
        });
        expect(h.answers).toHaveLength(1);
        expect(h.answers[0].id).toBe('888888888888888888');
        expect(h.answers[0].token).toBe('autocomplete-token');
        const choices = h.answers[0].choices as Array<{ name: string; value: string }>;
        expect(choices).toHaveLength(DISCORD_CHOICES_MAX);
        for (const choice of choices) {
          expect(Array.from(choice.name).length).toBeLessThanOrEqual(100);
          expect(Array.from(choice.value).length).toBeLessThanOrEqual(100);
        }
        expect(logs).toEqual([]);
        expect(h.transport.referenceCount).toBe(0);
      });

      it('a failing or late handler answers an empty list; nothing logged', async () => {
        const failing = await readyWithSuggestions(jest.fn(async () => {
          throw new Error(`db ${TYPED_MARKER}`);
        }));
        emit(failing, typing());
        await flush();
        expect(failing.answers.map((answer) => answer.choices)).toEqual([[]]);

        const late = await readyWithSuggestions(jest.fn(() => new Promise(() => undefined)));
        emit(late, typing());
        await new Promise((resolve) => setTimeout(resolve, 80));
        await flush();
        expect(late.answers.map((answer) => answer.choices)).toEqual([[]]);
        expect(logs).toEqual([]);
      });

      it('no focused option, an undeclared option, another command, a non-string option, before ready or without a handler: nothing', async () => {
        const handler = jest.fn(async () => [{ name: 'A', value: 'A' }]);
        const h = await readyWithSuggestions(handler);
        emit(h, typing('x', {}, [{ type: 3, name: 'agent', value: 'x' }]));
        emit(h, typing('x', {}, [{ type: 3, name: 'code', value: 'x', focused: true }]));
        emit(h, typing('x', { data: { type: 1, name: 'nope', options: [{ type: 3, name: 'agent', value: 'x', focused: true }] } }));
        emit(h, typing('x', {}, [{ type: 4, name: 'agent', value: 1, focused: true }]));
        emit(h, typing('x', { token: 7 }));
        await flush();
        expect(handler).not.toHaveBeenCalled();
        expect(h.answers).toEqual([]);

        const idle = harness(ON);
        await idle.transport.connect(jest.fn(), undefined, undefined, handler);
        emit(idle, typing());
        await flush();
        expect(handler).not.toHaveBeenCalled();

        const none = harness(ON);
        await none.transport.connect(jest.fn());
        none.gateway.emit('ready', { application: { id: APP_ID } }, 0);
        await flush();
        none.calls.log.length = 0;
        emit(none, typing());
        await flush();
        expect(none.calls.log).toEqual([]);
      });

      it('toChatAutocomplete cuts the typed text to the option limit and reads the presser in a server too', () => {
        const parsed = toChatAutocomplete(typing('a'.repeat(150)));
        expect(parsed?.request.value).toHaveLength(100);
        const inServer = toChatAutocomplete(typing('a', { user: undefined, member: { user: { id: USER_ID } }, guild_id: '1', context: 0 }));
        expect(inServer?.request).toMatchObject({ externalUserId: USER_ID, directMessage: false });
        expect(toChatAutocomplete({ ...typing(), type: InteractionType.ApplicationCommand })).toBeNull();
        expect(toChatAutocomplete(null)).toBeNull();
      });

      it('discordChoices: strings only, trimmed names, empty and repeated values left out, at most 25', () => {
        expect(
          discordChoices([
            { name: '  Sales  ', value: 'Sales' },
            { name: 'again', value: 'Sales' },
            { name: '', value: 'x' },
            { name: 'y', value: '' },
            { name: 1, value: 'z' } as never,
            null as never,
          ]),
        ).toEqual([{ name: 'Sales', value: 'Sales' }]);
        expect(discordChoices('nope' as never)).toEqual([]);
      });
    });

    describe('the reject form (callback type 9) and its submit (interaction type 5)', () => {
      const FORM = { customId: 'ap1:f:AAAAAAAAAAAAAAAAAAAAAA', title: 'Reject this step', field: { customId: 'reason', label: 'Reason (optional)', maxLength: 500 } };

      function formSubmit(components: unknown[], overrides: Record<string, unknown> = {}): Record<string, unknown> {
        return {
          id: '999999999999999999',
          application_id: APP_ID,
          type: InteractionType.ModalSubmit,
          token: 'interaction-token',
          locale: 'zh-TW',
          context: 1,
          user: { id: USER_ID, username: 'keith_user' },
          message: { id: '555555555555555555' },
          data: { custom_id: FORM.customId, components },
          ...overrides,
        };
      }

      const LABELLED = [{ type: ComponentType.Label, id: 1, component: { type: ComponentType.TextInput, id: 2, custom_id: 'reason', value: ` ${REASON_MARKER} ` } }];

      async function readyWithPresses(onComponent: jest.Mock): Promise<Harness & { modals: Array<{ id: string; body: unknown }> }> {
        const h = harness(ON);
        const modals: Array<{ id: string; body: unknown }> = [];
        h.calls.showModal = async (id, _token, body) => {
          h.calls.log.push(`modal ${id}`);
          modals.push({ id, body });
        };
        await h.transport.connect(jest.fn(), onComponent);
        h.gateway.emit('ready', { application: { id: APP_ID } }, 0);
        await flush();
        h.calls.log.length = 0;
        h.calls.bodies.length = 0;
        logs.length = 0;
        return { ...h, modals };
      }

      function emit(h: Harness, raw: Record<string, unknown>): void {
        h.gateway.emit('dispatch', { t: GatewayDispatchEvents.InteractionCreate, op: 0, s: 3, d: raw }, 0);
      }

      it('a press answered with a form opens it: one optional one-line field in a Label, its limit kept', async () => {
        const h = await readyWithPresses(jest.fn(async (): Promise<ChatComponentResponse> => ({ kind: 'modal', modal: FORM })));
        emit(h, buttonPress());
        await flush();
        expect(h.calls.log).toEqual(['modal 444444444444444444']);
        expect(h.modals[0].body).toEqual({
          custom_id: FORM.customId,
          title: 'Reject this step',
          components: [
            {
              type: ComponentType.Label,
              label: 'Reason (optional)',
              component: { type: ComponentType.TextInput, custom_id: 'reason', style: TextInputStyle.Short, max_length: 500, required: false },
            },
          ],
        });
      });

      it('the submit goes to the component handler with the typed values (Label or action row); an update edits the message', async () => {
        const onComponent = jest.fn(async (): Promise<ChatComponentResponse> => ({ kind: 'update', message: { text: 'Rejected' } }));
        const h = await readyWithPresses(onComponent);
        emit(h, formSubmit(LABELLED));
        await flush();
        const press = (onComponent.mock.calls[0] as unknown as [ChatComponentPress])[0];
        expect(press).toMatchObject({
          channel: 'discord',
          customId: FORM.customId,
          externalUserId: USER_ID,
          locale: 'zh-TW',
          directMessage: true,
          modalValues: { reason: ` ${REASON_MARKER} ` },
        });
        expect(h.calls.log).toEqual(['update 999999999999999999']);
        expect(h.calls.bodies).toEqual([{ content: 'Rejected', allowed_mentions: { parse: [] }, components: [] }]);
        expect(h.transport.referenceCount).toBe(1);

        const legacy = toChatModalSubmit(formSubmit([{ type: ComponentType.ActionRow, components: [{ type: ComponentType.TextInput, custom_id: 'reason', value: 'x'.repeat(5000) }] }]));
        expect(legacy?.modalValues?.reason).toHaveLength(4000);
        expect(logs.join('\n')).not.toContain(REASON_MARKER);
      });

      it('toChatModalSubmit reads text fields only, the first value of a custom id, and refuses a bad custom id', () => {
        expect(
          toChatModalSubmit(
            formSubmit([
              ...LABELLED,
              { type: ComponentType.Label, component: { type: ComponentType.TextInput, custom_id: 'reason', value: 'second' } },
              { type: ComponentType.Label, component: { type: ComponentType.StringSelect, custom_id: 'pick', values: ['a'] } },
              { type: ComponentType.Label, component: { type: ComponentType.TextInput, custom_id: '__proto__', value: 'p' } },
              { type: ComponentType.TextDisplay, content: 'x' },
            ]),
          )?.modalValues,
        ).toEqual(Object.fromEntries([['reason', ` ${REASON_MARKER} `], ['__proto__', 'p']]));
        expect(toChatModalSubmit(formSubmit([], { data: { custom_id: 'x'.repeat(101), components: [] } }))).toBeNull();
        expect(toChatModalSubmit(formSubmit([], { data: { components: [] } }))).toBeNull();
        expect(toChatModalSubmit(formSubmit(LABELLED, { type: InteractionType.MessageComponent }))).toBeNull();
        expect(toChatModalSubmit(formSubmit(LABELLED))?.modalValues).toBeDefined();
        expect(toChatComponentPress(formSubmit(LABELLED))).toBeNull();
        expect(toChatModalSubmit(buttonPress())).toBeNull();
      });

      it('a form is never shown after a deferral or in answer to a submit: nothing shown, one line logged', async () => {
        const slow = jest.fn(
          () => new Promise<ChatComponentResponse>((resolve) => setTimeout(() => resolve({ kind: 'modal', modal: FORM }), 80)),
        );
        const h = await readyWithPresses(slow);
        emit(h, buttonPress());
        await new Promise((resolve) => setTimeout(resolve, 120));
        await flush();
        expect(h.calls.log).toEqual(['deferUpdate 444444444444444444']);
        expect(logs).toContain('warn: chat discord form not shown reason=not_allowed');

        const again = await readyWithPresses(jest.fn(async (): Promise<ChatComponentResponse> => ({ kind: 'modal', modal: FORM })));
        emit(again, formSubmit(LABELLED));
        await flush();
        expect(again.calls.log).toEqual([]);
        expect(logs).toContain('warn: chat discord form not shown reason=not_allowed');
      });

      it('discordModalBody: title and label cut to 45, the limit kept between 1 and 4000, unusable custom ids refused', () => {
        const body = discordModalBody({ customId: 'f', title: 'T'.repeat(60), field: { customId: 'r', label: 'L'.repeat(60), maxLength: 9000 } });
        expect(body?.title).toHaveLength(45);
        expect(body?.components[0].label).toHaveLength(45);
        expect(body?.components[0].component.max_length).toBe(4000);
        expect(discordModalBody({ ...FORM, field: { ...FORM.field, maxLength: 0 } })?.components[0].component.max_length).toBe(1);
        expect(discordModalBody({ ...FORM, customId: '' })).toBeNull();
        expect(discordModalBody({ ...FORM, customId: 'x'.repeat(101) })).toBeNull();
        expect(discordModalBody({ ...FORM, field: { ...FORM.field, customId: '' } })).toBeNull();
        expect(discordModalBody({ ...FORM, title: '' })).toBeNull();
      });
    });

    describe('plain messages during a reconnect', () => {
      const BOT_ID = '333333333333333333';
      const CHANNEL_ID = '666666666666666666';

      function message(index: number): Record<string, unknown> {
        return {
          id: String(700000000000000000 + index),
          channel_id: CHANNEL_ID,
          type: MessageType.Default,
          content: `message ${index}`,
          author: { id: USER_ID, username: 'keith_user' },
        };
      }

      async function connected(onMessage: jest.Mock): Promise<Harness> {
        const h = harness(ON);
        await h.transport.connect(jest.fn(), undefined, onMessage);
        h.gateway.emit('ready', { application: { id: APP_ID }, user: { id: BOT_ID } }, 0);
        await flush();
        logs.length = 0;
        return h;
      }

      function send(h: Harness, raw: Record<string, unknown>): void {
        h.gateway.emit('dispatch', { t: GatewayDispatchEvents.MessageCreate, op: 0, s: 2, d: raw }, 0);
      }

      it('messages replayed while resuming are kept and handled, in order, once the session is resumed', async () => {
        const onMessage = jest.fn(async () => null);
        const h = await connected(onMessage);
        h.gateway.emit('closed', 1006, 0);
        expect(h.transport.state).toBe('connecting');
        for (let i = 1; i <= 3; i += 1) send(h, message(i));
        await flush();
        expect(onMessage).not.toHaveBeenCalled();
        expect(h.transport.pendingMessageCount).toBe(3);
        h.gateway.emit('resumed', 0);
        await flush();
        expect(onMessage.mock.calls.map((call) => (call as unknown as [ChatPlainMessage])[0].text)).toEqual(['message 1', 'message 2', 'message 3']);
        expect(h.transport.pendingMessageCount).toBe(0);
        expect(logs).toContain('log: chat discord queued messages handled count=3 dropped=0');
        expect(logs.join('\n')).not.toContain('message 1');
      });

      it(`at most ${DISCORD_PENDING_MESSAGES_MAX} are kept; the rest are dropped (counted in one line)`, async () => {
        const onMessage = jest.fn(async () => null);
        const h = await connected(onMessage);
        h.gateway.emit('closed', 1006, 0);
        for (let i = 1; i <= DISCORD_PENDING_MESSAGES_MAX + 5; i += 1) send(h, message(i));
        expect(h.transport.pendingMessageCount).toBe(DISCORD_PENDING_MESSAGES_MAX);
        h.gateway.emit('ready', { application: { id: APP_ID }, user: { id: BOT_ID } }, 0);
        await flush();
        expect(onMessage).toHaveBeenCalledTimes(DISCORD_PENDING_MESSAGES_MAX);
        expect(logs).toContain(`log: chat discord queued messages handled count=${DISCORD_PENDING_MESSAGES_MAX} dropped=5`);
      });

      it('the queue is cleared on disconnect and on stop', async () => {
        const onMessage = jest.fn(async () => null);
        const h = await connected(onMessage);
        h.gateway.emit('closed', 1006, 0);
        send(h, message(1));
        expect(h.transport.pendingMessageCount).toBe(1);
        await h.transport.disconnect();
        expect(h.transport.pendingMessageCount).toBe(0);

        const stopped = await connected(onMessage);
        stopped.gateway.emit('closed', 1006, 0);
        send(stopped, message(2));
        stopped.gateway.emit('closed', GatewayCloseCodes.AuthenticationFailed, 0);
        expect(stopped.transport.state).toBe('stopped');
        expect(stopped.transport.pendingMessageCount).toBe(0);
        stopped.gateway.emit('resumed', 0);
        await flush();
        expect(onMessage).not.toHaveBeenCalled();
      });
    });

    it('sendToUser: the connection going away during the send throws the typed not-ready error', async () => {
      const h = harness(ON);
      h.calls.sendDirectMessage = async () => {
        await h.transport.disconnect();
        throw new Error('socket closed');
      };
      await h.transport.connect(jest.fn());
      h.gateway.emit('ready', { application: { id: APP_ID } }, 0);
      await flush();
      await expect(h.transport.sendToUser(USER_ID, { text: 'result' })).rejects.toBeInstanceOf(ChatTransportNotReadyError);
      // A plain failure while still connected is thrown as it is (a counted attempt).
      const failing = harness(ON);
      failing.calls.sendDirectMessage = async () => {
        throw new Error('boom');
      };
      await failing.transport.connect(jest.fn());
      failing.gateway.emit('ready', { application: { id: APP_ID } }, 0);
      await flush();
      await expect(failing.transport.sendToUser(USER_ID, { text: 'result' })).rejects.toThrow('boom');
    });
  });
});
