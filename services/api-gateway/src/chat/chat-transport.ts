import { Injectable } from '@nestjs/common';
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

/**
 * CHAT-STATE-PERSIST-01: options for sendToUser. dedupeKey is a stable key
 * for one message (the delivery uses the run id and the part number): the
 * chat service may use it to drop a repeat of the same message sent again
 * after a crash (Discord: the direct message's nonce with enforce_nonce).
 * Made only of ids; never text.
 */
export interface ChatSendOptions {
  readonly dedupeKey?: string;
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
 * CHAT-DISCORD-DM-01: one plain message (no slash command) in the direct
 * message with the bot, from a human author other than the bot. The
 * transport passes nothing else (no server message, no bot or system author,
 * no other message type, no author id that is not a snowflake). Every field
 * is untrusted: the text is the task and is never logged, audited or echoed.
 */
export interface ChatPlainMessage {
  readonly channel: ChatChannel;
  /** The message content, trimmed; empty for an attachment or sticker only. */
  readonly text: string;
  /** The outside user id of the author (Discord: a snowflake as a decimal string). */
  readonly externalUserId: string;
  /** Opaque to everyone but the transport that made it (ids to reply with). */
  readonly ref: object;
}

/**
 * Returns the answer, which the transport sends as a reply to the message in
 * the direct message (mentions off), or null to answer nothing.
 */
export type ChatMessageHandler = (message: ChatPlainMessage) => Promise<ChatReplyMessage | null>;

/**
 * off: never connected (switch off, no token, or under tests).
 * connecting: connecting or reconnecting.
 * ready: connected; commands are answered.
 * stopped: gave up (connect failed, a fatal close code, or the identify guard) until restart.
 */
export type ChatTransportState = 'off' | 'connecting' | 'ready' | 'stopped';

/**
 * CHAT-USER-INSTALL-01: the chat service refused to open or use the direct
 * message with this user (Discord: HTTP 403 with code 50007 or 50278, for
 * example a user who installed the bot to their own account but shares no
 * server with it). Not a failed attempt: the delivery holds the message until
 * the user's next command or button press and sends it as a follow-up then.
 * Carries no id and no text.
 */
export class ChatDirectMessageRefusedError extends Error {
  constructor() {
    super('The chat service refused the direct message');
    this.name = 'ChatDirectMessageRefusedError';
  }
}

/**
 * CHAT-USER-INSTALL-01: the public links the Connections page shows (the
 * install link and the bot's profile). Built only from public ids; no secret.
 */
export interface ChatInstallLinks {
  readonly installUrl: string;
  readonly botProfileUrl: string;
}

export interface ChatTransport {
  readonly channel: ChatChannel;
  readonly state: ChatTransportState;
  /**
   * Starts the connection when allowed. Never throws, never blocks on the
   * network. True when a connection was started. Button presses go to
   * onComponent (slice C2); without it they are ignored. CHAT-DISCORD-DM-01:
   * plain direct messages go to onMessage; without it they are ignored.
   */
  connect(
    handler: ChatCommandHandler,
    onComponent?: ChatComponentHandler,
    onMessage?: ChatMessageHandler,
  ): Promise<boolean>;
  /** Closes the connection; safe to call in any state. */
  disconnect(): Promise<void>;
  /** Registers the command list with the chat service (the transport calls it itself once ready). */
  registerCommands(): Promise<void>;
  /** Answers one invocation; null answers nothing. */
  reply(invocation: ChatCommandInvocation, message: ChatReplyMessage | null): Promise<void>;
  /**
   * CHAT-USER-INSTALL-01 (replaces sendDirectMessage): sends a message to an
   * outside user, with buttons when it has them. When the user's latest
   * command or button press is recent enough, the message goes as a
   * follow-up to that interaction (after its own answer); otherwise, or when
   * the follow-up fails, by direct message. A direct message the chat
   * service refuses throws ChatDirectMessageRefusedError; other failures
   * throw as they are. CHAT-STATE-PERSIST-01: options.dedupeKey, when given,
   * lets the chat service drop a repeat of the same direct message (follow-ups
   * cannot carry it).
   */
  sendToUser(externalUserId: string, message: ChatReplyMessage, options?: ChatSendOptions): Promise<void>;
  /** CHAT-USER-INSTALL-01: the install and bot links while connected and known, else null. */
  installLinks(): ChatInstallLinks | null;
}

/**
 * A listener for ChatActivityNotifier: one outside user just used a command,
 * pressed a button or (CHAT-DISCORD-DM-01) sent a plain direct message.
 */
export type ChatActivityListener = (channel: ChatChannel, externalUserId: string) => void;

/**
 * CHAT-USER-INSTALL-01: tells the delivery that an outside user is active
 * (a command or a button press in the direct message), so results held for
 * that user go out now as follow-ups. CHAT-DISCORD-DM-01: a plain direct
 * message notifies too; it carries no interaction token, so held results go
 * by direct message (or wait for the next command or button press). A small shared notifier, so the command
 * and component handlers reach the delivery without a Nest dependency cycle
 * (the delivery already depends on the approval service). Memory only;
 * nothing is logged here. notify never throws.
 */
@Injectable()
export class ChatActivityNotifier {
  private readonly listeners = new Set<ChatActivityListener>();

  /** Adds a listener; returns the function that removes it. */
  onActivity(listener: ChatActivityListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(channel: ChatChannel, externalUserId: string): void {
    if (typeof externalUserId !== 'string' || externalUserId.length === 0) {
      return;
    }
    for (const listener of this.listeners) {
      try {
        listener(channel, externalUserId);
      } catch {
        // A listener never breaks the command or the press.
      }
    }
  }
}

/** In-memory transport for tests: records everything, connects to nothing. */
export class FakeChatTransport implements ChatTransport {
  readonly channel: ChatChannel = 'discord';
  state: ChatTransportState = 'off';
  handler: ChatCommandHandler | null = null;
  componentHandler: ChatComponentHandler | null = null;
  /** CHAT-DISCORD-DM-01: the plain-message handler given to connect, if any. */
  messageHandler: ChatMessageHandler | null = null;
  connectCalls = 0;
  disconnectCalls = 0;
  registeredCommands = 0;
  readonly replies: Array<{ invocation: ChatCommandInvocation; message: ChatReplyMessage | null }> = [];
  /** Every message sent to a user (sendToUser). */
  readonly directMessages: Array<{ externalUserId: string; message: ChatReplyMessage }> = [];
  /** CHAT-STATE-PERSIST-01: the dedupe key of each message sent (same order as directMessages). */
  readonly dedupeKeys: Array<string | undefined> = [];
  readonly componentResponses: Array<{ press: ChatComponentPress; response: ChatComponentResponse }> = [];
  /** CHAT-DISCORD-DM-01: every plain message and the answer sent as its reply (null: nothing sent). */
  readonly messageReplies: Array<{ message: ChatPlainMessage; reply: ChatReplyMessage | null }> = [];
  /** Users whose messages are refused (sendToUser throws ChatDirectMessageRefusedError). */
  readonly refusedUsers = new Set<string>();
  /** What installLinks() answers while ready. */
  links: ChatInstallLinks | null = null;

  constructor(private readonly allowConnect = true) {}

  async connect(
    handler: ChatCommandHandler,
    onComponent?: ChatComponentHandler,
    onMessage?: ChatMessageHandler,
  ): Promise<boolean> {
    this.connectCalls += 1;
    if (!this.allowConnect) {
      return false;
    }
    this.handler = handler;
    this.componentHandler = onComponent ?? null;
    this.messageHandler = onMessage ?? null;
    this.state = 'ready';
    await this.registerCommands();
    return true;
  }

  async disconnect(): Promise<void> {
    this.disconnectCalls += 1;
    this.handler = null;
    this.componentHandler = null;
    this.messageHandler = null;
    this.state = this.state === 'off' ? 'off' : 'stopped';
  }

  async registerCommands(): Promise<void> {
    this.registeredCommands += 1;
  }

  async reply(invocation: ChatCommandInvocation, message: ChatReplyMessage | null): Promise<void> {
    this.replies.push({ invocation, message });
  }

  async sendToUser(externalUserId: string, message: ChatReplyMessage, options?: ChatSendOptions): Promise<void> {
    if (this.refusedUsers.has(externalUserId)) {
      throw new ChatDirectMessageRefusedError();
    }
    this.directMessages.push({ externalUserId, message });
    this.dedupeKeys.push(options?.dedupeKey);
  }

  installLinks(): ChatInstallLinks | null {
    return this.state === 'ready' ? this.links : null;
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

  /** CHAT-DISCORD-DM-01: simulates one plain direct message: the message handler answers, the reply is recorded. */
  async send(message: Omit<ChatPlainMessage, 'channel' | 'ref'>): Promise<ChatReplyMessage | null> {
    if (!this.messageHandler) {
      throw new Error('fake transport has no message handler');
    }
    const full: ChatPlainMessage = { ...message, channel: this.channel, ref: {} };
    const reply = await this.messageHandler(full);
    this.messageReplies.push({ message: full, reply });
    return reply;
  }
}
