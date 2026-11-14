import type { ChatChannel } from './chat-link.service';

/**
 * CHAT-DISCORD-01 slices B and C2 (stage-start section 2): the channel-neutral
 * side of a chat transport. The Discord transport (discord/discord-transport.ts)
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

/**
 * Slice C2: one button under a direct message. customId is the server's own
 * opaque value (never text from the chat service); style is approve (green)
 * or reject (red).
 */
export interface ChatButton {
  readonly customId: string;
  readonly label: string;
  readonly style: 'approve' | 'reject';
}

/** A reply is plain text; the transport turns mentions off and cuts it to the channel's limit. */
export interface ChatReplyMessage {
  readonly text: string;
  /** Slice C2: buttons under a direct message (at most 5, one row). */
  readonly buttons?: readonly ChatButton[];
}

/** Returns the reply, or null to answer nothing (for example a silenced /link). */
export type ChatCommandHandler = (invocation: ChatCommandInvocation) => Promise<ChatReplyMessage | null>;

/** Slice C2: one button press as the transport received it. Every field is untrusted. */
export interface ChatComponentPress {
  readonly channel: ChatChannel;
  /** The button's custom id as the chat service sends it back (untrusted). */
  readonly customId: string;
  /** The outside user id of the presser. */
  readonly externalUserId: string;
  readonly locale: string | null;
  /** True only in the direct message with the bot. */
  readonly directMessage: boolean;
  /** Opaque to everyone but the transport that made it. */
  readonly ref: object;
}

/**
 * update: the message the button is on is edited to this text and its
 * buttons are removed. ephemeral: a reply only the presser sees; the message
 * and its buttons stay as they are.
 */
export type ChatComponentResponse =
  | { readonly kind: 'update'; readonly message: ChatReplyMessage }
  | { readonly kind: 'ephemeral'; readonly message: ChatReplyMessage };

export type ChatComponentHandler = (press: ChatComponentPress) => Promise<ChatComponentResponse>;

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
  /**
   * Starts the connection when allowed. Never throws, never blocks on the
   * network. True when a connection was started. Button presses go to
   * onComponent (slice C2); without it they are ignored.
   */
  connect(handler: ChatCommandHandler, onComponent?: ChatComponentHandler): Promise<boolean>;
  /** Closes the connection; safe to call in any state. */
  disconnect(): Promise<void>;
  /** Registers the command list with the chat service (the transport calls it itself once ready). */
  registerCommands(): Promise<void>;
  /** Answers one invocation; null answers nothing. */
  reply(invocation: ChatCommandInvocation, message: ChatReplyMessage | null): Promise<void>;
  /** Sends a direct message to an outside user (used from slice C1; with buttons from slice C2). */
  sendDirectMessage(externalUserId: string, message: ChatReplyMessage): Promise<void>;
}

/** In-memory transport for tests: records everything, connects to nothing. */
export class FakeChatTransport implements ChatTransport {
  readonly channel: ChatChannel = 'discord';
  state: ChatTransportState = 'off';
  handler: ChatCommandHandler | null = null;
  componentHandler: ChatComponentHandler | null = null;
  connectCalls = 0;
  disconnectCalls = 0;
  registeredCommands = 0;
  readonly replies: Array<{ invocation: ChatCommandInvocation; message: ChatReplyMessage | null }> = [];
  readonly directMessages: Array<{ externalUserId: string; message: ChatReplyMessage }> = [];
  readonly componentResponses: Array<{ press: ChatComponentPress; response: ChatComponentResponse }> = [];

  constructor(private readonly allowConnect = true) {}

  async connect(handler: ChatCommandHandler, onComponent?: ChatComponentHandler): Promise<boolean> {
    this.connectCalls += 1;
    if (!this.allowConnect) {
      return false;
    }
    this.handler = handler;
    this.componentHandler = onComponent ?? null;
    this.state = 'ready';
    await this.registerCommands();
    return true;
  }

  async disconnect(): Promise<void> {
    this.disconnectCalls += 1;
    this.handler = null;
    this.componentHandler = null;
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

  /** Simulates one button press: the component handler answers, the response is recorded. */
  async press(press: Omit<ChatComponentPress, 'channel' | 'ref'>): Promise<ChatComponentResponse> {
    if (!this.componentHandler) {
      throw new Error('fake transport has no component handler');
    }
    const full: ChatComponentPress = { ...press, channel: this.channel, ref: {} };
    const response = await this.componentHandler(full);
    this.componentResponses.push({ press: full, response });
    return response;
  }
}
