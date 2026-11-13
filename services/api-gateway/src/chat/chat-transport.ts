import type { ChatChannel } from './chat-link.service';

/**
 * CHAT-DISCORD-01 slice B (stage-start section 2): the channel-neutral side of
 * a chat transport. The Discord transport (discord/discord-transport.ts)
 * implements it; tests use FakeChatTransport below and never connect.
 *
 * Every field of an invocation comes from the outside chat service and is
 * untrusted data: the command handler reads only the command name and its
 * typed string options, never logs them, and never echoes them except where
 * the design says so.
 */

/** Nest provider token for the chat transport (the Discord transport in the app, a fake in tests). */
export const CHAT_TRANSPORT = Symbol('CHAT_TRANSPORT');

/** One slash command as the transport received it. */
export interface ChatCommandInvocation {
  readonly channel: ChatChannel;
  /** The command's default (English) name, as the chat service sends it. */
  readonly command: string;
  /** String options only, by option name; values are untrusted text. */
  readonly options: Readonly<Record<string, string>>;
  /** The outside user id (Discord: a snowflake as a decimal string). */
  readonly externalUserId: string;
  /** The outside display name; used only for the link claim (held 10 minutes on the code row). */
  readonly displayName: string | null;
  /** The interaction locale as sent (for example en-US, zh-TW). */
  readonly locale: string | null;
  /** True only in the direct message with the bot. */
  readonly directMessage: boolean;
  /** Opaque to everyone but the transport that made it (ids and tokens to answer with). */
  readonly ref: object;
}

/** A reply is plain text; the transport turns mentions off and cuts it to the channel's limit. */
export interface ChatReplyMessage {
  readonly text: string;
}

/** Returns the reply, or null to answer nothing (for example a silenced /link). */
export type ChatCommandHandler = (invocation: ChatCommandInvocation) => Promise<ChatReplyMessage | null>;

/**
 * off: never connected (switch off, no token, or under tests).
 * connecting: connecting or reconnecting.
 * ready: connected; commands are answered.
 * stopped: gave up (connect failed, a fatal close code, or the identify guard) until restart.
 */
export type ChatTransportState = 'off' | 'connecting' | 'ready' | 'stopped';

export interface ChatTransport {
  readonly channel: ChatChannel;
  readonly state: ChatTransportState;
  /** Starts the connection when allowed. Never throws, never blocks on the network. True when a connection was started. */
  connect(handler: ChatCommandHandler): Promise<boolean>;
  /** Closes the connection; safe to call in any state. */
  disconnect(): Promise<void>;
  /** Registers the command list with the chat service (the transport calls it itself once ready). */
  registerCommands(): Promise<void>;
  /** Answers one invocation; null answers nothing. */
  reply(invocation: ChatCommandInvocation, message: ChatReplyMessage | null): Promise<void>;
  /** Sends a direct message to an outside user (used from slice C1). */
  sendDirectMessage(externalUserId: string, message: ChatReplyMessage): Promise<void>;
}

/** In-memory transport for tests: records everything, connects to nothing. */
export class FakeChatTransport implements ChatTransport {
  readonly channel: ChatChannel = 'discord';
  state: ChatTransportState = 'off';
  handler: ChatCommandHandler | null = null;
  connectCalls = 0;
  disconnectCalls = 0;
  registeredCommands = 0;
  readonly replies: Array<{ invocation: ChatCommandInvocation; message: ChatReplyMessage | null }> = [];
  readonly directMessages: Array<{ externalUserId: string; message: ChatReplyMessage }> = [];

  constructor(private readonly allowConnect = true) {}

  async connect(handler: ChatCommandHandler): Promise<boolean> {
    this.connectCalls += 1;
    if (!this.allowConnect) {
      return false;
    }
    this.handler = handler;
    this.state = 'ready';
    await this.registerCommands();
    return true;
  }

  async disconnect(): Promise<void> {
    this.disconnectCalls += 1;
    this.handler = null;
    this.state = this.state === 'off' ? 'off' : 'stopped';
  }

  async registerCommands(): Promise<void> {
    this.registeredCommands += 1;
  }

  async reply(invocation: ChatCommandInvocation, message: ChatReplyMessage | null): Promise<void> {
    this.replies.push({ invocation, message });
  }

  async sendDirectMessage(externalUserId: string, message: ChatReplyMessage): Promise<void> {
    this.directMessages.push({ externalUserId, message });
  }

  /** Simulates one incoming command: the handler answers, the reply is recorded. */
  async invoke(invocation: Omit<ChatCommandInvocation, 'channel' | 'ref'>): Promise<ChatReplyMessage | null> {
    if (!this.handler) {
      throw new Error('fake transport is not connected');
    }
    const full: ChatCommandInvocation = { ...invocation, channel: this.channel, ref: {} };
    const message = await this.handler(full);
    await this.reply(full, message);
    return message;
  }
}
