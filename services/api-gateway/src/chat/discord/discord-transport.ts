import { Logger } from '@nestjs/common';
import type { APIInteraction, GatewayDispatchPayload, GatewayReadyDispatchData } from '@discordjs/core';
import type { ChatChannel } from '../chat-link.service';
import { isChatDiscordEnabled } from '../chat-switch';
import type {
  ChatCommandHandler,
  ChatCommandInvocation,
  ChatReplyMessage,
  ChatTransport,
  ChatTransportState,
} from '../chat-transport';
import {
  buildDiscordCommands,
  chatCommandOptionMax,
  chatCommandOptionNames,
  DiscordCommandDefinition,
  DISCORD_CONTEXT_BOT_DM,
  DISCORD_OPTION_TYPE_STRING,
  isChatCommandName,
} from './discord-commands';

/**
 * CHAT-DISCORD-01 slice B (stage-start sections 2, 4, 7): the Discord
 * transport. An outbound WebSocket to Discord's gateway (@discordjs/ws) with
 * gateway intents 0, and HTTPS calls (@discordjs/rest through @discordjs/core's
 * API). No inbound address, no listening port.
 *
 * It connects only when CHAT_DISCORD_ENABLED is exactly 'true' AND
 * DISCORD_BOT_TOKEN is set. Otherwise it writes one log line without any value
 * and stays off; the gateway boots normally. Under Jest the real library is
 * never loaded or connected (tests inject a fake connection factory).
 *
 * The token is read from the environment at connect time and handed to the
 * library only. It is never logged, and no library debug event is listened to.
 * Log lines carry event names, numeric close codes, counts and error class
 * names only: never the token, a Discord id, a name or any message text.
 *
 * Identify guard: Discord allows 1000 IDENTIFY calls a day and then resets the
 * token. Every close that comes before a ready (or resumed) session counts as
 * one failed identify; after 20 in 24 hours the transport stops itself until
 * the gateway restarts. Fatal close codes (bad token, bad intents) stop it at
 * once, as the library does not reconnect after them.
 */

export const DISCORD_BOT_TOKEN_ENV = 'DISCORD_BOT_TOKEN';
/** Gateway intents: none. Interactions are not tied to an intent; no privileged intent is asked for. */
export const DISCORD_GATEWAY_INTENTS = 0;
export const DISCORD_MAX_FAILED_IDENTIFIES = 20;
export const DISCORD_IDENTIFY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Answer directly when the handler is done within this time; otherwise defer and edit (Discord allows 3 s). */
export const DISCORD_DEFER_AFTER_MS = 2000;
/** Discord's message limit is 2000 characters. */
export const DISCORD_MESSAGE_MAX = 2000;
/** MessageFlags.Ephemeral, used only for the answer outside a direct message. */
export const DISCORD_EPHEMERAL_FLAG = 64;
/** InteractionType.ApplicationCommand */
export const DISCORD_INTERACTION_APPLICATION_COMMAND = 2;
/** ApplicationCommandType.ChatInput */
export const DISCORD_COMMAND_DATA_CHAT_INPUT = 1;
/** GatewayDispatchEvents.InteractionCreate */
export const DISCORD_DISPATCH_INTERACTION_CREATE = 'INTERACTION_CREATE';
/** GatewayCloseCodes after which the library does not reconnect. */
export const DISCORD_FATAL_CLOSE_CODES: readonly number[] = [4004, 4010, 4011, 4012, 4013, 4014];

/** WebSocketShardEvents names used here. Debug is deliberately not among them. */
export const DISCORD_GATEWAY_EVENTS = {
  closed: 'closed',
  dispatch: 'dispatch',
  error: 'error',
  ready: 'ready',
  resumed: 'resumed',
} as const;

const SNOWFLAKE = /^[0-9]{1,32}$/;

export interface DiscordMessageBody {
  content: string;
  allowed_mentions: { parse: [] };
  flags?: number;
}

/** The REST calls the transport makes, so tests can fake them without the library. */
export interface DiscordCalls {
  reply(interactionId: string, interactionToken: string, body: DiscordMessageBody): Promise<void>;
  defer(interactionId: string, interactionToken: string, flags?: number): Promise<void>;
  editReply(applicationId: string, interactionToken: string, body: DiscordMessageBody): Promise<void>;
  deleteReply(applicationId: string, interactionToken: string): Promise<void>;
  registerGlobalCommands(applicationId: string, commands: DiscordCommandDefinition[]): Promise<void>;
  sendDirectMessage(userId: string, body: DiscordMessageBody): Promise<void>;
}

/** The gateway connection (a WebSocketManager), reduced to what the transport uses. */
export interface DiscordGateway {
  on(event: string, listener: (...args: any[]) => void): unknown;
  connect(): Promise<void>;
  destroy(): unknown;
}

export interface DiscordConnection {
  calls: DiscordCalls;
  gateway: DiscordGateway;
  /** Releases library timers (REST sweepers). */
  close(): void;
}

export type DiscordConnectionFactory = (token: string, intents: number) => Promise<DiscordConnection>;

/** The real connection. Loads the Discord libraries only when called. */
export const createDiscordConnection: DiscordConnectionFactory = async (token, intents) => {
  const [{ REST }, { WebSocketManager }, { API }] = await Promise.all([
    import('@discordjs/rest'),
    import('@discordjs/ws'),
    import('@discordjs/core'),
  ]);
  const rest = new REST({ version: '10' }).setToken(token);
  const gateway = new WebSocketManager({ token, intents, rest });
  const api = new API(rest);
  const calls: DiscordCalls = {
    async reply(interactionId, interactionToken, body) {
      await api.interactions.reply(interactionId, interactionToken, body);
    },
    async defer(interactionId, interactionToken, flags) {
      await api.interactions.defer(interactionId, interactionToken, flags === undefined ? {} : { flags });
    },
    async editReply(applicationId, interactionToken, body) {
      await api.interactions.editReply(applicationId, interactionToken, body);
    },
    async deleteReply(applicationId, interactionToken) {
      await api.interactions.deleteReply(applicationId, interactionToken);
    },
    async registerGlobalCommands(applicationId, commands) {
      await api.applicationCommands.bulkOverwriteGlobalCommands(
        applicationId,
        commands as unknown as Parameters<typeof api.applicationCommands.bulkOverwriteGlobalCommands>[1],
      );
    },
    async sendDirectMessage(userId, body) {
      const channel = await api.users.createDM(userId);
      await api.channels.createMessage(channel.id, body);
    },
  };
  return {
    calls,
    gateway,
    close: () => {
      rest.clearHashSweeper();
      rest.clearHandlerSweeper();
    },
  };
};

/** Counts failed identifies in a sliding window; trips at the limit. */
export class DiscordIdentifyGuard {
  private failures: number[] = [];

  constructor(
    private readonly limit = DISCORD_MAX_FAILED_IDENTIFIES,
    private readonly windowMs = DISCORD_IDENTIFY_WINDOW_MS,
  ) {}

  /** Records one failure; true when the limit is reached. */
  recordFailure(now: number): boolean {
    this.failures = this.failures.filter((at) => at > now - this.windowMs);
    this.failures.push(now);
    return this.failures.length >= this.limit;
  }

  count(now: number): number {
    return this.failures.filter((at) => at > now - this.windowMs).length;
  }
}

interface DiscordRef {
  interactionId: string;
  interactionToken: string;
  applicationId: string;
  deferred: boolean;
}

export interface DiscordTransportOptions {
  /** Defaults to process.env, read at connect time. */
  env?: NodeJS.ProcessEnv;
  /** Defaults to the real library. Under Jest only an injected factory is used. */
  factory?: DiscordConnectionFactory;
  now?: () => number;
  deferAfterMs?: number;
}

function errorName(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error';
  return /^[A-Za-z0-9_[\]]{1,64}$/.test(name) ? name : 'Error';
}

function errorStatus(error: unknown): string {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && Number.isInteger(status) ? ` status=${status}` : '';
}

function body(message: ChatReplyMessage, ephemeral: boolean): DiscordMessageBody {
  const text = Array.from(message.text).slice(0, DISCORD_MESSAGE_MAX).join('');
  const result: DiscordMessageBody = { content: text, allowed_mentions: { parse: [] } };
  if (ephemeral) {
    result.flags = DISCORD_EPHEMERAL_FLAG;
  }
  return result;
}

/**
 * Turns a raw interaction into an invocation, or null when it is not a
 * slash command. Reads only: ids, token, locale, the user, the command name
 * and the string options the command declares (cut to their maximum).
 */
export function toChatInvocation(raw: unknown, channel: ChatChannel = 'discord'): ChatCommandInvocation | null {
  const interaction = raw as Partial<APIInteraction> & Record<string, any>;
  if (!interaction || typeof interaction !== 'object') return null;
  if (interaction.type !== DISCORD_INTERACTION_APPLICATION_COMMAND) return null;
  const data = interaction.data as Record<string, any> | undefined;
  if (!data || data.type !== DISCORD_COMMAND_DATA_CHAT_INPUT || typeof data.name !== 'string') return null;
  if (typeof interaction.id !== 'string' || typeof interaction.token !== 'string') return null;
  if (typeof interaction.application_id !== 'string') return null;

  const user = (interaction.user ?? interaction.member?.user) as Record<string, any> | undefined;
  const externalUserId = typeof user?.id === 'string' && SNOWFLAKE.test(user.id) ? user.id : '';
  const directMessage =
    !interaction.guild_id &&
    interaction.user !== undefined &&
    (interaction.context === undefined || interaction.context === DISCORD_CONTEXT_BOT_DM);
  const displayName =
    typeof user?.global_name === 'string'
      ? user.global_name
      : typeof user?.username === 'string'
        ? user.username
        : null;

  const options: Record<string, string> = {};
  if (isChatCommandName(data.name) && Array.isArray(data.options)) {
    const allowed = chatCommandOptionNames(data.name);
    for (const option of data.options as Array<Record<string, unknown>>) {
      if (
        option &&
        option.type === DISCORD_OPTION_TYPE_STRING &&
        typeof option.name === 'string' &&
        allowed.includes(option.name) &&
        typeof option.value === 'string' &&
        !Object.prototype.hasOwnProperty.call(options, option.name)
      ) {
        options[option.name] = Array.from(option.value)
          .slice(0, chatCommandOptionMax(data.name, option.name))
          .join('');
      }
    }
  }

  const ref: DiscordRef = {
    interactionId: interaction.id,
    interactionToken: interaction.token,
    applicationId: interaction.application_id,
    deferred: false,
  };
  return {
    channel,
    command: data.name,
    options,
    externalUserId,
    displayName,
    locale: typeof interaction.locale === 'string' ? interaction.locale : null,
    directMessage,
    ref,
  };
}

export class DiscordTransport implements ChatTransport {
  readonly channel: ChatChannel = 'discord';
  private readonly logger = new Logger('ChatDiscord');
  private readonly env: NodeJS.ProcessEnv;
  private readonly factory: DiscordConnectionFactory;
  private readonly injected: boolean;
  private readonly now: () => number;
  private readonly deferAfterMs: number;
  private readonly guard = new DiscordIdentifyGuard();
  private connection: DiscordConnection | null = null;
  private handler: ChatCommandHandler | null = null;
  private applicationId: string | null = null;
  private sessionUp = false;
  private commandsRegistered = false;
  private currentState: ChatTransportState = 'off';

  constructor(options: DiscordTransportOptions = {}) {
    this.env = options.env ?? process.env;
    this.factory = options.factory ?? createDiscordConnection;
    this.injected = options.factory !== undefined;
    this.now = options.now ?? Date.now;
    this.deferAfterMs = options.deferAfterMs ?? DISCORD_DEFER_AFTER_MS;
  }

  get state(): ChatTransportState {
    return this.currentState;
  }

  async connect(handler: ChatCommandHandler): Promise<boolean> {
    if (this.currentState !== 'off') {
      return false;
    }
    if (!isChatDiscordEnabled(this.env)) {
      this.logger.log('chat discord off reason=switch_off');
      return false;
    }
    const token = (this.env[DISCORD_BOT_TOKEN_ENV] ?? '').trim();
    if (token.length === 0) {
      this.logger.log('chat discord off reason=token_missing');
      return false;
    }
    if (!this.injected && this.env.JEST_WORKER_ID !== undefined) {
      this.logger.log('chat discord off reason=test_environment');
      return false;
    }

    this.currentState = 'connecting';
    this.handler = handler;
    let connection: DiscordConnection;
    try {
      connection = await this.factory(token, DISCORD_GATEWAY_INTENTS);
    } catch (error) {
      this.currentState = 'stopped';
      this.handler = null;
      this.logger.warn(`chat discord connect failed reason=${errorName(error)}`);
      return false;
    }
    this.connection = connection;
    this.listen(connection.gateway);
    this.logger.log('chat discord connecting');
    // The library's first connect waits for a ready session without a time
    // limit, so it is never awaited here: the gateway boot does not wait.
    void connection.gateway.connect().catch((error: unknown) => {
      this.stop(`connect_failed reason=${errorName(error)}${errorStatus(error)}`);
    });
    return true;
  }

  async disconnect(): Promise<void> {
    const connection = this.connection;
    this.connection = null;
    this.handler = null;
    this.sessionUp = false;
    if (this.currentState !== 'off') {
      this.currentState = 'stopped';
    }
    if (connection) {
      await this.release(connection);
    }
  }

  async registerCommands(): Promise<void> {
    const connection = this.connection;
    if (!connection || !this.applicationId) {
      return;
    }
    const commands = buildDiscordCommands();
    try {
      await connection.calls.registerGlobalCommands(this.applicationId, commands);
      this.commandsRegistered = true;
      this.logger.log(`chat discord commands registered count=${commands.length}`);
    } catch (error) {
      this.logger.warn(`chat discord commands not registered reason=${errorName(error)}${errorStatus(error)}`);
    }
  }

  async reply(invocation: ChatCommandInvocation, message: ChatReplyMessage | null): Promise<void> {
    const connection = this.connection;
    const ref = invocation.ref as DiscordRef;
    if (!connection || !ref || typeof ref.interactionToken !== 'string') {
      return;
    }
    const ephemeral = !invocation.directMessage;
    if (!ref.deferred) {
      if (message) {
        await connection.calls.reply(ref.interactionId, ref.interactionToken, body(message, ephemeral));
      }
      return;
    }
    if (message) {
      await connection.calls.editReply(ref.applicationId, ref.interactionToken, body(message, ephemeral));
    } else {
      await connection.calls.deleteReply(ref.applicationId, ref.interactionToken);
    }
  }

  async sendDirectMessage(externalUserId: string, message: ChatReplyMessage): Promise<void> {
    const connection = this.connection;
    if (!connection || this.currentState !== 'ready' || !SNOWFLAKE.test(externalUserId)) {
      return;
    }
    await connection.calls.sendDirectMessage(externalUserId, body(message, false));
  }

  private listen(gateway: DiscordGateway): void {
    gateway.on(DISCORD_GATEWAY_EVENTS.ready, (data: GatewayReadyDispatchData) => {
      this.onReady(data);
    });
    gateway.on(DISCORD_GATEWAY_EVENTS.resumed, () => {
      this.sessionUp = true;
      if (this.currentState === 'connecting') this.currentState = 'ready';
    });
    gateway.on(DISCORD_GATEWAY_EVENTS.closed, (code: unknown) => {
      this.onClosed(code);
    });
    gateway.on(DISCORD_GATEWAY_EVENTS.error, (error: unknown) => {
      this.logger.warn(`chat discord error reason=${errorName(error)}`);
    });
    gateway.on(DISCORD_GATEWAY_EVENTS.dispatch, (payload: GatewayDispatchPayload) => {
      if (payload && (payload as { t?: unknown }).t === DISCORD_DISPATCH_INTERACTION_CREATE) {
        void this.onInteraction((payload as { d?: unknown }).d);
      }
    });
  }

  private onReady(data: GatewayReadyDispatchData): void {
    if (this.currentState === 'stopped' || !this.connection) {
      return;
    }
    const applicationId = data?.application?.id;
    this.applicationId = typeof applicationId === 'string' && SNOWFLAKE.test(applicationId) ? applicationId : null;
    this.sessionUp = true;
    this.currentState = 'ready';
    this.logger.log('chat discord ready');
    if (!this.commandsRegistered) {
      void this.registerCommands();
    }
  }

  private onClosed(code: unknown): void {
    if (this.currentState === 'stopped' || !this.connection) {
      return;
    }
    const closeCode = typeof code === 'number' && Number.isInteger(code) ? code : 0;
    const hadSession = this.sessionUp;
    this.sessionUp = false;
    this.currentState = 'connecting';
    if (DISCORD_FATAL_CLOSE_CODES.includes(closeCode)) {
      this.stop(`close_code code=${closeCode}`);
      return;
    }
    if (!hadSession && this.guard.recordFailure(this.now())) {
      this.stop(`identify_limit failures=${this.guard.count(this.now())}`);
      return;
    }
    this.logger.log(`chat discord closed code=${closeCode}`);
  }

  private stop(reason: string): void {
    if (this.currentState === 'stopped') {
      return;
    }
    this.currentState = 'stopped';
    this.sessionUp = false;
    this.handler = null;
    this.logger.warn(`chat discord stopped ${reason}`);
    const connection = this.connection;
    this.connection = null;
    if (connection) {
      void this.release(connection);
    }
  }

  private async release(connection: DiscordConnection): Promise<void> {
    try {
      await connection.gateway.destroy();
    } catch (error) {
      this.logger.warn(`chat discord close failed reason=${errorName(error)}`);
    }
    try {
      connection.close();
    } catch {
      // timers only
    }
  }

  private async onInteraction(raw: unknown): Promise<void> {
    const handler = this.handler;
    if (!handler || this.currentState !== 'ready') {
      return;
    }
    const invocation = toChatInvocation(raw, this.channel);
    if (!invocation) {
      return;
    }
    try {
      const pending = handler(invocation);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<'late'>((resolve) => {
        timer = setTimeout(() => resolve('late'), this.deferAfterMs);
        timer.unref?.();
      });
      const first = await Promise.race([pending.then((message) => ({ message })), late]);
      if (timer) clearTimeout(timer);
      if (first !== 'late') {
        await this.reply(invocation, first.message);
        return;
      }
      const ref = invocation.ref as DiscordRef;
      const connection = this.connection;
      if (!connection) return;
      await connection.calls.defer(
        ref.interactionId,
        ref.interactionToken,
        invocation.directMessage ? undefined : DISCORD_EPHEMERAL_FLAG,
      );
      ref.deferred = true;
      await this.reply(invocation, await pending);
    } catch (error) {
      this.logger.warn(`chat discord interaction failed reason=${errorName(error)}${errorStatus(error)}`);
    }
  }
}
