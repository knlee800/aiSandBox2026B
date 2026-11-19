import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type { GatewayDispatchPayload, GatewayReadyDispatchData } from '@discordjs/core';
import type { ChatChannel } from '../chat-link.service';
import { isChatDiscordEnabled } from '../chat-switch';
import {
  ChatDirectMessageRefusedError,
  ChatTransportNotReadyError,
  type ChatAutocompleteChoice,
  type ChatAutocompleteHandler,
  type ChatAutocompleteRequest,
  type ChatCommandHandler,
  type ChatCommandInvocation,
  type ChatComponentHandler,
  type ChatComponentPress,
  type ChatComponentResponse,
  type ChatInstallLinks,
  type ChatMessageHandler,
  type ChatModal,
  type ChatPlainMessage,
  type ChatReplyMessage,
  type ChatSendOptions,
  type ChatTransport,
  type ChatTransportState,
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
 * gateway intents 0 (CHAT-DISCORD-DM-01: DIRECT_MESSAGES, see below), and HTTPS calls (@discordjs/rest through @discordjs/core's
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
 *
 * Slice C2: buttons. A direct message may carry one row of buttons (the
 * approval message's Approve and Reject). A button press arrives as a
 * message-component interaction (type 3); only a button (component type 2)
 * with a custom id of at most 100 characters is read, and only its custom id,
 * the presser's id and locale and the ids and token to answer with. It goes
 * to the component handler, which decides; the transport answers within
 * Discord's 3 seconds: an update edits the message the button is on and
 * removes its buttons (callback type 7, or after a deferred update, type 6,
 * an edit of the original message); an ephemeral answer is a reply only the
 * presser sees (callback type 4 with the ephemeral flag, or a follow-up).
 * Mentions are off in every message.
 *
 * CHAT-USER-INSTALL-01: any Discord account can add the bot to its own apps
 * (a user install). Such an account may share no server with the bot, and
 * Discord may then refuse the bot's direct messages (HTTP 403, code 50007 or
 * 50278). So the transport keeps, per outside user id, the latest
 * interaction reference (application id, interaction token, time received)
 * of every accepted command and button press in the direct message. It is
 * held in memory only: never logged, stored, returned or put in an audit
 * row; cleared on disconnect and stop; used only while younger than 14
 * minutes (Discord's interaction tokens last 15). sendToUser sends a message
 * as a follow-up to that interaction (mentions off, not ephemeral, buttons
 * kept), after the interaction's own answer; without a fresh reference, or
 * when the follow-up fails, it opens the direct message as before. A refused
 * direct message throws ChatDirectMessageRefusedError (no id, no text).
 * installLinks gives the page the install link and the bot's profile link,
 * built from the application id and the bot user id of the READY payload.
 *
 * CHAT-STATE-PERSIST-01: a message sent with a dedupe key (a result part:
 * run id and part number) carries, on the direct message only, Discord's
 * nonce (the first 25 hex characters of the SHA-256 of the key; Discord
 * allows up to 25 characters) with enforce_nonce true: Discord then returns
 * the earlier message instead of creating a second one with the same nonce
 * within a few minutes, so a part re-sent after a crash between Discord's
 * "sent" and the database write is not shown twice. Follow-ups cannot carry
 * a nonce, so they go without it.
 *
 * CHAT-DISCORD-DM-01: plain direct messages. The gateway intents are
 * DIRECT_MESSAGES (1 << 12), which is not privileged; Discord delivers the
 * content of direct messages to the bot without the privileged
 * MESSAGE_CONTENT intent. A MESSAGE_CREATE is read only when it is in a
 * direct message (no guild_id, no member), from a human author (not a bot,
 * not a system user, not a webhook) other than the bot itself, of type
 * normal (0) or reply (19), with snowflake author, message and channel ids,
 * and only while the bot's own user id is known. Everything else is ignored
 * silently. Only the trimmed content, the author id and the ids to reply
 * with are read. The handler's answer goes out as a reply to that message in
 * the direct message (mentions off, no buttons). A reply Discord refuses
 * (HTTP 403, code 50007 or 50278) is logged once with a reason code and
 * otherwise ignored. A plain message keeps no interaction reference (it has
 * no interaction token). The text, the author id and the channel id are
 * never logged.
 *
 * CHAT-TIDY-01:
 * - Suggestions (autocomplete, interaction type 4) for a command option that
 *   offers them (the /ask agent option): the focused option's name and typed
 *   text go to the autocomplete handler; the answer (callback type 8) holds
 *   at most 25 suggestions, name and value cut to 100 characters. A handler
 *   that fails or is not done within the defer time answers an empty list.
 *   Nothing is logged per keystroke and no interaction reference is kept
 *   (an autocomplete token cannot send follow-ups).
 * - Forms (modals): a button handler may answer a press with a form
 *   (callback type 9) holding one optional one-line text field in a Label
 *   component. Its submit (interaction type 5) goes to the component handler
 *   as a press with the form's custom id and the typed values (each cut to
 *   4000 characters); an update then edits the message the button is on.
 *   A form cannot follow a deferred answer or another form; then nothing is
 *   shown and one line is logged.
 * - Plain messages that arrive while the transport is connecting (Discord
 *   replays missed events while it resumes a session) are kept in memory, at
 *   most 50 (the rest are dropped), and handled once the session is ready or
 *   resumed; they are dropped on disconnect and stop.
 * - sendToUser throws ChatTransportNotReadyError while not ready, and when
 *   the connection went away during the send.
 */

export const DISCORD_BOT_TOKEN_ENV = 'DISCORD_BOT_TOKEN';
/**
 * Gateway intents: GatewayIntentBits.DirectMessages (1 << 12) only, for the
 * MESSAGE_CREATE of plain direct messages (CHAT-DISCORD-DM-01). Not
 * privileged. Interactions are not tied to an intent.
 */
export const DISCORD_GATEWAY_INTENTS = 1 << 12;
/** GatewayDispatchEvents.MessageCreate (CHAT-DISCORD-DM-01) */
export const DISCORD_DISPATCH_MESSAGE_CREATE = 'MESSAGE_CREATE';
/** MessageType.Default and MessageType.Reply: the only message types read (CHAT-DISCORD-DM-01). */
export const DISCORD_MESSAGE_TYPE_DEFAULT = 0;
export const DISCORD_MESSAGE_TYPE_REPLY = 19;
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
/** InteractionType.MessageComponent (slice C2: a button press) */
export const DISCORD_INTERACTION_MESSAGE_COMPONENT = 3;
/** ComponentType.ActionRow and ComponentType.Button */
export const DISCORD_COMPONENT_ACTION_ROW = 1;
export const DISCORD_COMPONENT_BUTTON = 2;
/** ButtonStyle.Success (green) and ButtonStyle.Danger (red) */
export const DISCORD_BUTTON_STYLE_SUCCESS = 3;
export const DISCORD_BUTTON_STYLE_DANGER = 4;
/** Discord's limits: custom id 100 characters, button label 80, 5 buttons in a row. */
export const DISCORD_CUSTOM_ID_MAX = 100;
export const DISCORD_BUTTON_LABEL_MAX = 80;
export const DISCORD_ROW_BUTTONS_MAX = 5;
/** GatewayDispatchEvents.InteractionCreate */
export const DISCORD_DISPATCH_INTERACTION_CREATE = 'INTERACTION_CREATE';
/** GatewayCloseCodes after which the library does not reconnect. */
export const DISCORD_FATAL_CLOSE_CODES: readonly number[] = [4004, 4010, 4011, 4012, 4013, 4014];
/**
 * CHAT-USER-INSTALL-01: an interaction token works for 15 minutes; a
 * reference is used for follow-ups only while younger than 14.
 */
export const DISCORD_REFERENCE_MAX_AGE_MS = 14 * 60 * 1000;
/** At most this many references are kept; the oldest go first. */
export const DISCORD_REFERENCES_MAX = 10000;
/** A follow-up waits at most this long for the interaction's own answer to go out first. */
export const DISCORD_ANSWER_WAIT_MS = 5000;
/**
 * RESTJSONErrorCodes.CannotSendMessagesToThisUser (50007) and
 * CannotSendMessagesToThisUserDueToHavingNoMutualGuilds (50278), sent with HTTP 403.
 */
export const DISCORD_DM_REFUSED_CODES: readonly number[] = [50007, 50278];
export const DISCORD_DM_REFUSED_STATUS = 403;

/** CHAT-STATE-PERSIST-01: Discord's nonce is at most 25 characters. */
export const DISCORD_NONCE_MAX = 25;

/** InteractionType.ApplicationCommandAutocomplete (CHAT-TIDY-01) */
export const DISCORD_INTERACTION_AUTOCOMPLETE = 4;
/** InteractionType.ModalSubmit (CHAT-TIDY-01) */
export const DISCORD_INTERACTION_MODAL_SUBMIT = 5;
/** ComponentType.TextInput and ComponentType.Label (CHAT-TIDY-01: the form's one field) */
export const DISCORD_COMPONENT_TEXT_INPUT = 4;
export const DISCORD_COMPONENT_LABEL = 18;
/** TextInputStyle.Short: a one-line field */
export const DISCORD_TEXT_INPUT_SHORT = 1;
/** Discord's limits: 25 suggestions, each name and value at most 100 characters. */
export const DISCORD_CHOICES_MAX = 25;
export const DISCORD_CHOICE_MAX = 100;
/** Discord's limits: a form title and a field label at most 45 characters, a field value at most 4000. */
export const DISCORD_MODAL_TITLE_MAX = 45;
export const DISCORD_FIELD_LABEL_MAX = 45;
export const DISCORD_FIELD_VALUE_MAX = 4000;
/** CHAT-TIDY-01: plain messages kept while the transport is connecting. */
export const DISCORD_PENDING_MESSAGES_MAX = 50;

/** WebSocketShardEvents names used here. Debug is deliberately not among them. */
export const DISCORD_GATEWAY_EVENTS = {
  closed: 'closed',
  dispatch: 'dispatch',
  error: 'error',
  ready: 'ready',
  resumed: 'resumed',
} as const;

const SNOWFLAKE = /^[0-9]{1,32}$/;

export interface DiscordButtonComponent {
  type: typeof DISCORD_COMPONENT_BUTTON;
  style: typeof DISCORD_BUTTON_STYLE_SUCCESS | typeof DISCORD_BUTTON_STYLE_DANGER;
  label: string;
  custom_id: string;
}

export interface DiscordActionRow {
  type: typeof DISCORD_COMPONENT_ACTION_ROW;
  components: DiscordButtonComponent[];
}

export interface DiscordMessageBody {
  content: string;
  allowed_mentions: { parse: [] };
  flags?: number;
  /** Slice C2: one row of buttons, or [] to remove the buttons of the message being edited. */
  components?: DiscordActionRow[];
  /** CHAT-STATE-PERSIST-01: direct messages only; see discordNonceOf. */
  nonce?: string;
  /** CHAT-STATE-PERSIST-01: with nonce, Discord drops a repeat of the same nonce within a few minutes. */
  enforce_nonce?: boolean;
}

/** CHAT-TIDY-01: one suggestion as Discord takes it (callback type 8). */
export interface DiscordChoice {
  name: string;
  value: string;
}

/** CHAT-TIDY-01: a form as Discord takes it (callback type 9): one optional one-line field in a Label. */
export interface DiscordModalBody {
  custom_id: string;
  title: string;
  components: Array<{
    type: typeof DISCORD_COMPONENT_LABEL;
    label: string;
    component: {
      type: typeof DISCORD_COMPONENT_TEXT_INPUT;
      custom_id: string;
      style: typeof DISCORD_TEXT_INPUT_SHORT;
      max_length: number;
      required: false;
    };
  }>;
}

/** Code points, cut to max. */
function cutText(value: string, max: number): string {
  return Array.from(value).slice(0, max).join('');
}

/** A plain object read from untrusted JSON, or null. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * CHAT-TIDY-01: the suggestions as Discord takes them: strings only, trimmed,
 * name and value cut to 100 characters, empty ones and repeated values left
 * out, at most 25.
 */
export function discordChoices(choices: readonly ChatAutocompleteChoice[]): DiscordChoice[] {
  const result: DiscordChoice[] = [];
  const seen = new Set<string>();
  for (const choice of Array.isArray(choices) ? choices : []) {
    if (result.length >= DISCORD_CHOICES_MAX) break;
    if (!choice || typeof choice.name !== 'string' || typeof choice.value !== 'string') continue;
    const name = cutText(choice.name.trim(), DISCORD_CHOICE_MAX);
    const value = cutText(choice.value, DISCORD_CHOICE_MAX);
    if (name.length === 0 || value.length === 0 || seen.has(value)) continue;
    seen.add(value);
    result.push({ name, value });
  }
  return result;
}

/**
 * CHAT-TIDY-01: the form body, or null when its custom ids are not usable.
 * Title and label are cut to 45 characters; the field's limit is kept
 * between 1 and 4000; the field is never required.
 */
export function discordModalBody(modal: ChatModal): DiscordModalBody | null {
  const field = modal?.field;
  if (
    typeof modal?.customId !== 'string' ||
    modal.customId.length === 0 ||
    modal.customId.length > DISCORD_CUSTOM_ID_MAX ||
    !field ||
    typeof field.customId !== 'string' ||
    field.customId.length === 0 ||
    field.customId.length > DISCORD_CUSTOM_ID_MAX
  ) {
    return null;
  }
  const title = cutText(typeof modal.title === 'string' ? modal.title : '', DISCORD_MODAL_TITLE_MAX);
  const label = cutText(typeof field.label === 'string' ? field.label : '', DISCORD_FIELD_LABEL_MAX);
  if (title.length === 0 || label.length === 0) {
    return null;
  }
  const maxLength = Number.isInteger(field.maxLength)
    ? Math.min(Math.max(field.maxLength, 1), DISCORD_FIELD_VALUE_MAX)
    : DISCORD_FIELD_VALUE_MAX;
  return {
    custom_id: modal.customId,
    title,
    components: [
      {
        type: DISCORD_COMPONENT_LABEL,
        label,
        component: {
          type: DISCORD_COMPONENT_TEXT_INPUT,
          custom_id: field.customId,
          style: DISCORD_TEXT_INPUT_SHORT,
          max_length: maxLength,
          required: false,
        },
      },
    ],
  };
}

/** CHAT-STATE-PERSIST-01: the nonce for a dedupe key: 25 hex characters of its SHA-256 (no id is readable from it). */
export function discordNonceOf(dedupeKey: string): string {
  return createHash('sha256').update(`aisb-chat:${dedupeKey}`).digest('hex').slice(0, DISCORD_NONCE_MAX);
}

/** The REST calls the transport makes, so tests can fake them without the library. */
export interface DiscordCalls {
  reply(interactionId: string, interactionToken: string, body: DiscordMessageBody): Promise<void>;
  defer(interactionId: string, interactionToken: string, flags?: number): Promise<void>;
  editReply(applicationId: string, interactionToken: string, body: DiscordMessageBody): Promise<void>;
  deleteReply(applicationId: string, interactionToken: string): Promise<void>;
  registerGlobalCommands(applicationId: string, commands: DiscordCommandDefinition[]): Promise<void>;
  sendDirectMessage(userId: string, body: DiscordMessageBody): Promise<void>;
  /** Slice C2: callback type 7, edits the message the pressed button is on. */
  updateMessage(interactionId: string, interactionToken: string, body: DiscordMessageBody): Promise<void>;
  /** Slice C2: callback type 6, a deferred update of the message the pressed button is on. */
  deferUpdate(interactionId: string, interactionToken: string): Promise<void>;
  /** Slice C2: a follow-up message to an interaction (an ephemeral answer after a deferred update). */
  followUp(applicationId: string, interactionToken: string, body: DiscordMessageBody): Promise<void>;
  /**
   * CHAT-DISCORD-DM-01: a reply to one message in its channel (the direct
   * message), see discordReplyBody. The real connection always has it;
   * optional so test fakes written before it still type-check (without it,
   * a plain message is handled but not answered).
   */
  replyToMessage?(channelId: string, messageId: string, body: DiscordMessageBody): Promise<void>;
  /**
   * CHAT-TIDY-01: callback type 8, the suggestions for the option being
   * typed. The real connection always has it; optional so older test fakes
   * still type-check (without it no suggestion is answered).
   */
  autocomplete?(interactionId: string, interactionToken: string, choices: DiscordChoice[]): Promise<void>;
  /** CHAT-TIDY-01: callback type 9, opens a form. Optional for the same reason; without it no form opens. */
  showModal?(interactionId: string, interactionToken: string, body: DiscordModalBody): Promise<void>;
}

/** CHAT-DISCORD-DM-01: the Create Message body of a reply: the message reference, never failing when the message is gone. */
export interface DiscordReplyBody extends DiscordMessageBody {
  message_reference: { message_id: string; fail_if_not_exists: false };
}

/**
 * CHAT-DISCORD-DM-01: a reply to the message with this id. Mentions stay off
 * (parse [] and no replied_user, so not even the author is pinged); if the
 * message was deleted meanwhile, Discord sends it as a plain message.
 */
export function discordReplyBody(messageId: string, message: DiscordMessageBody): DiscordReplyBody {
  return { ...message, message_reference: { message_id: messageId, fail_if_not_exists: false } };
}

/** The gateway connection (a WebSocketManager), reduced to what the transport uses. */
export interface DiscordGateway {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
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
    async updateMessage(interactionId, interactionToken, body) {
      await api.interactions.updateMessage(interactionId, interactionToken, body);
    },
    async deferUpdate(interactionId, interactionToken) {
      await api.interactions.deferMessageUpdate(interactionId, interactionToken);
    },
    async followUp(applicationId, interactionToken, body) {
      await api.interactions.followUp(applicationId, interactionToken, body);
    },
    async replyToMessage(channelId, messageId, body) {
      await api.channels.createMessage(channelId, discordReplyBody(messageId, body));
    },
    async autocomplete(interactionId, interactionToken, choices) {
      await api.interactions.createAutocompleteResponse(interactionId, interactionToken, { choices });
    },
    async showModal(interactionId, interactionToken, modal) {
      await api.interactions.createModal(
        interactionId,
        interactionToken,
        modal as unknown as Parameters<typeof api.interactions.createModal>[2],
      );
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

/** CHAT-USER-INSTALL-01: the latest accepted interaction of one outside user. Memory only. */
interface DiscordInteractionReference {
  applicationId: string;
  interactionToken: string;
  receivedAt: number;
  /** Settles once the interaction's own answer has gone out (or failed). */
  answered: Promise<void>;
}

export interface DiscordTransportOptions {
  /** Defaults to process.env, read at connect time. */
  env?: NodeJS.ProcessEnv;
  /** Defaults to the real library. Under Jest only an injected factory is used. */
  factory?: DiscordConnectionFactory;
  now?: () => number;
  deferAfterMs?: number;
  /** CHAT-USER-INSTALL-01: how long a follow-up waits for the interaction's own answer. */
  answerWaitMs?: number;
}

/** CHAT-USER-INSTALL-01: Discord refused the direct message (HTTP 403 with code 50007 or 50278). */
export function isDiscordDirectMessageRefused(error: unknown): boolean {
  const candidate = error as { status?: unknown; code?: unknown } | null;
  if (!candidate || typeof candidate !== 'object' || candidate.status !== DISCORD_DM_REFUSED_STATUS) {
    return false;
  }
  const code = typeof candidate.code === 'number' ? candidate.code : Number(candidate.code);
  return DISCORD_DM_REFUSED_CODES.includes(code);
}

/**
 * CHAT-USER-INSTALL-01: the install link (a user install with the commands
 * scope only) and the bot's profile link, or null unless both ids are
 * snowflakes. Public ids only; no token or secret.
 */
export function discordInstallLinks(applicationId: unknown, botUserId: unknown): ChatInstallLinks | null {
  if (typeof applicationId !== 'string' || !SNOWFLAKE.test(applicationId)) return null;
  if (typeof botUserId !== 'string' || !SNOWFLAKE.test(botUserId)) return null;
  return {
    installUrl: `https://discord.com/oauth2/authorize?client_id=${applicationId}&integration_type=1&scope=applications.commands`,
    botProfileUrl: `https://discord.com/users/${botUserId}`,
  };
}

function errorName(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error';
  return /^[A-Za-z0-9_[\]]{1,64}$/.test(name) ? name : 'Error';
}

function errorStatus(error: unknown): string {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && Number.isInteger(status) ? ` status=${status}` : '';
}

/** Slice C2: one row of the message's buttons; a button without a usable custom id or label is left out. */
function buttonRow(message: ChatReplyMessage): DiscordActionRow[] | undefined {
  const buttons = (message.buttons ?? [])
    .filter(
      (button) =>
        typeof button.customId === 'string' &&
        button.customId.length > 0 &&
        button.customId.length <= DISCORD_CUSTOM_ID_MAX &&
        typeof button.label === 'string' &&
        button.label.length > 0,
    )
    .slice(0, DISCORD_ROW_BUTTONS_MAX)
    .map(
      (button): DiscordButtonComponent => ({
        type: DISCORD_COMPONENT_BUTTON,
        style: button.style === 'approve' ? DISCORD_BUTTON_STYLE_SUCCESS : DISCORD_BUTTON_STYLE_DANGER,
        label: Array.from(button.label).slice(0, DISCORD_BUTTON_LABEL_MAX).join(''),
        custom_id: button.customId,
      }),
    );
  return buttons.length > 0 ? [{ type: DISCORD_COMPONENT_ACTION_ROW, components: buttons }] : undefined;
}

/**
 * The message body: text cut to 2000 characters, mentions off. buttons
 * 'keep' sends the message's own buttons (if any); 'remove' sends
 * components [] so an edited message loses its buttons.
 */
function body(message: ChatReplyMessage, ephemeral: boolean, buttons: 'keep' | 'remove' = 'keep'): DiscordMessageBody {
  const text = Array.from(message.text).slice(0, DISCORD_MESSAGE_MAX).join('');
  const result: DiscordMessageBody = { content: text, allowed_mentions: { parse: [] } };
  if (ephemeral) {
    result.flags = DISCORD_EPHEMERAL_FLAG;
  }
  if (buttons === 'remove') {
    result.components = [];
  } else {
    const row = buttonRow(message);
    if (row) {
      result.components = row;
    }
  }
  return result;
}

function isDirectMessage(interaction: Record<string, unknown>): boolean {
  return (
    !interaction.guild_id &&
    interaction.user !== undefined &&
    (interaction.context === undefined || interaction.context === DISCORD_CONTEXT_BOT_DM)
  );
}

/** The interaction's user (a direct message) or its member's user (a server). */
function interactionUser(interaction: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(interaction.user) ?? asRecord(asRecord(interaction.member)?.user);
}

/** The user's id when it is a snowflake, else ''. */
function interactionUserId(interaction: Record<string, unknown>): string {
  const id = interactionUser(interaction)?.id;
  return typeof id === 'string' && SNOWFLAKE.test(id) ? id : '';
}

/**
 * Turns a raw interaction into an invocation, or null when it is not a
 * slash command. Reads only: ids, token, locale, the user, the command name
 * and the string options the command declares (cut to their maximum).
 */
export function toChatInvocation(raw: unknown, channel: ChatChannel = 'discord'): ChatCommandInvocation | null {
  const interaction = asRecord(raw);
  if (!interaction) return null;
  if (interaction.type !== DISCORD_INTERACTION_APPLICATION_COMMAND) return null;
  const data = asRecord(interaction.data);
  if (!data || data.type !== DISCORD_COMMAND_DATA_CHAT_INPUT || typeof data.name !== 'string') return null;
  if (typeof interaction.id !== 'string' || typeof interaction.token !== 'string') return null;
  if (typeof interaction.application_id !== 'string') return null;

  const user = interactionUser(interaction);
  const externalUserId = interactionUserId(interaction);
  const directMessage = isDirectMessage(interaction);
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

/**
 * Slice C2: turns a raw interaction into a button press, or null when it is
 * not a button press. Reads only: ids, token, locale, the presser's id and
 * the custom id (at most 100 characters; longer is not a press).
 */
export function toChatComponentPress(raw: unknown, channel: ChatChannel = 'discord'): ChatComponentPress | null {
  const interaction = asRecord(raw);
  if (!interaction) return null;
  if (interaction.type !== DISCORD_INTERACTION_MESSAGE_COMPONENT) return null;
  const data = asRecord(interaction.data);
  if (!data || data.component_type !== DISCORD_COMPONENT_BUTTON) return null;
  if (typeof data.custom_id !== 'string' || data.custom_id.length === 0 || data.custom_id.length > DISCORD_CUSTOM_ID_MAX) {
    return null;
  }
  if (typeof interaction.id !== 'string' || typeof interaction.token !== 'string') return null;
  if (typeof interaction.application_id !== 'string') return null;
  const ref: DiscordRef = {
    interactionId: interaction.id,
    interactionToken: interaction.token,
    applicationId: interaction.application_id,
    deferred: false,
  };
  return {
    channel,
    customId: data.custom_id,
    externalUserId: interactionUserId(interaction),
    locale: typeof interaction.locale === 'string' ? interaction.locale : null,
    directMessage: isDirectMessage(interaction),
    ref,
  };
}

/**
 * CHAT-TIDY-01: the typed values of a form submit, by field custom id: text
 * fields only (type 4, in an action row or a Label), the first value of a
 * custom id wins, each cut to 4000 characters. Nothing else is read.
 */
function modalFieldValues(components: unknown): Record<string, string> {
  const values = new Map<string, string>();
  const add = (component: unknown): void => {
    const field = asRecord(component);
    if (
      !field ||
      field.type !== DISCORD_COMPONENT_TEXT_INPUT ||
      typeof field.custom_id !== 'string' ||
      field.custom_id.length === 0 ||
      field.custom_id.length > DISCORD_CUSTOM_ID_MAX ||
      typeof field.value !== 'string' ||
      values.has(field.custom_id)
    ) {
      return;
    }
    values.set(field.custom_id, cutText(field.value, DISCORD_FIELD_VALUE_MAX));
  };
  for (const top of Array.isArray(components) ? components.slice(0, 5) : []) {
    const row = asRecord(top);
    if (row?.type === DISCORD_COMPONENT_ACTION_ROW && Array.isArray(row.components)) {
      row.components.slice(0, 5).forEach(add);
    } else if (row?.type === DISCORD_COMPONENT_LABEL) {
      add(row.component);
    }
  }
  return Object.fromEntries(values);
}

/**
 * CHAT-TIDY-01: turns a raw form submit (interaction type 5) into a press
 * with modalValues, or null. Reads only: ids, token, locale, the user, the
 * form's custom id (at most 100 characters) and the typed text fields.
 */
export function toChatModalSubmit(raw: unknown, channel: ChatChannel = 'discord'): ChatComponentPress | null {
  const interaction = asRecord(raw);
  if (!interaction || interaction.type !== DISCORD_INTERACTION_MODAL_SUBMIT) return null;
  const data = asRecord(interaction.data);
  if (!data) return null;
  if (typeof data.custom_id !== 'string' || data.custom_id.length === 0 || data.custom_id.length > DISCORD_CUSTOM_ID_MAX) {
    return null;
  }
  if (typeof interaction.id !== 'string' || typeof interaction.token !== 'string') return null;
  if (typeof interaction.application_id !== 'string') return null;
  const ref: DiscordRef = {
    interactionId: interaction.id,
    interactionToken: interaction.token,
    applicationId: interaction.application_id,
    deferred: false,
  };
  return {
    channel,
    customId: data.custom_id,
    externalUserId: interactionUserId(interaction),
    locale: typeof interaction.locale === 'string' ? interaction.locale : null,
    directMessage: isDirectMessage(interaction),
    ref,
    modalValues: modalFieldValues(data.components),
  };
}

/** CHAT-TIDY-01: an autocomplete interaction, read: the request and the ids to answer with. */
export interface DiscordAutocomplete {
  request: ChatAutocompleteRequest;
  interactionId: string;
  interactionToken: string;
}

/**
 * CHAT-TIDY-01: turns a raw autocomplete interaction (type 4) into a request,
 * or null. Reads only: ids, token, locale, the user, the command name and the
 * focused option when it is a string option the command declares (its typed
 * text cut to the option's maximum).
 */
export function toChatAutocomplete(raw: unknown, channel: ChatChannel = 'discord'): DiscordAutocomplete | null {
  const interaction = asRecord(raw);
  if (!interaction || interaction.type !== DISCORD_INTERACTION_AUTOCOMPLETE) return null;
  const data = asRecord(interaction.data);
  if (!data || data.type !== DISCORD_COMMAND_DATA_CHAT_INPUT || !isChatCommandName(data.name)) return null;
  if (typeof interaction.id !== 'string' || typeof interaction.token !== 'string') return null;
  const command = data.name;
  const focused = (Array.isArray(data.options) ? data.options : [])
    .map((option) => asRecord(option))
    .find((option) => option?.focused === true);
  if (
    !focused ||
    focused.type !== DISCORD_OPTION_TYPE_STRING ||
    typeof focused.name !== 'string' ||
    !chatCommandOptionNames(command).includes(focused.name)
  ) {
    return null;
  }
  const typed = typeof focused.value === 'string' ? focused.value : '';
  return {
    request: {
      channel,
      command,
      option: focused.name,
      value: cutText(typed, chatCommandOptionMax(command, focused.name)),
      externalUserId: interactionUserId(interaction),
      locale: typeof interaction.locale === 'string' ? interaction.locale : null,
      directMessage: isDirectMessage(interaction),
    },
    interactionId: interaction.id,
    interactionToken: interaction.token,
  };
}

/** CHAT-DISCORD-DM-01: the ids to reply to one plain message with. Memory only; never logged. */
interface DiscordMessageRef {
  channelId: string;
  messageId: string;
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

/**
 * CHAT-DISCORD-DM-01: turns a raw MESSAGE_CREATE into a plain message, or
 * null when it is not one the bot reads: only a message in a direct message
 * (no guild_id, no member), of type normal (0) or reply (19), not from a
 * webhook, from an author who is not a bot, not a system user and not the
 * bot itself (botUserId must be a known snowflake), with snowflake author,
 * message and channel ids. Reads only the content (trimmed), the author id
 * and the message and channel ids.
 */
export function toChatPlainMessage(
  raw: unknown,
  botUserId: string | null,
  channel: ChatChannel = 'discord',
): ChatPlainMessage | null {
  const message = asRecord(raw);
  if (!message) return null;
  if (isPresent(message.guild_id) || isPresent(message.member)) return null;
  if (message.type !== DISCORD_MESSAGE_TYPE_DEFAULT && message.type !== DISCORD_MESSAGE_TYPE_REPLY) return null;
  if (isPresent(message.webhook_id)) return null;
  const author = asRecord(message.author);
  if (!author) return null;
  if (author.bot || author.system) return null;
  if (typeof author.id !== 'string' || !SNOWFLAKE.test(author.id)) return null;
  if (typeof botUserId !== 'string' || !SNOWFLAKE.test(botUserId) || author.id === botUserId) return null;
  if (typeof message.id !== 'string' || !SNOWFLAKE.test(message.id)) return null;
  if (typeof message.channel_id !== 'string' || !SNOWFLAKE.test(message.channel_id)) return null;
  const ref: DiscordMessageRef = { channelId: message.channel_id, messageId: message.id };
  return {
    channel,
    text: typeof message.content === 'string' ? message.content.trim() : '',
    externalUserId: author.id,
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
  private readonly answerWaitMs: number;
  private readonly guard = new DiscordIdentifyGuard();
  /** CHAT-USER-INSTALL-01: per outside user id, the latest accepted interaction. Memory only; never logged. */
  private readonly references = new Map<string, DiscordInteractionReference>();
  private connection: DiscordConnection | null = null;
  private handler: ChatCommandHandler | null = null;
  private componentHandler: ChatComponentHandler | null = null;
  /** CHAT-DISCORD-DM-01: the plain-message handler; without it plain messages are ignored. */
  private messageHandler: ChatMessageHandler | null = null;
  /** CHAT-TIDY-01: the suggestion handler; without it no suggestion is answered. */
  private autocompleteHandler: ChatAutocompleteHandler | null = null;
  /** CHAT-TIDY-01: raw plain messages received while connecting (at most 50). Memory only; never logged. */
  private pendingMessages: unknown[] = [];
  /** CHAT-TIDY-01: plain messages dropped because the queue was full (a count for one log line). */
  private droppedMessages = 0;
  private applicationId: string | null = null;
  private botUserId: string | null = null;
  private sessionUp = false;
  private commandsRegistered = false;
  private currentState: ChatTransportState = 'off';

  constructor(options: DiscordTransportOptions = {}) {
    this.env = options.env ?? process.env;
    this.factory = options.factory ?? createDiscordConnection;
    this.injected = options.factory !== undefined;
    this.now = options.now ?? Date.now;
    this.deferAfterMs = options.deferAfterMs ?? DISCORD_DEFER_AFTER_MS;
    this.answerWaitMs = options.answerWaitMs ?? DISCORD_ANSWER_WAIT_MS;
  }

  get state(): ChatTransportState {
    return this.currentState;
  }

  /** CHAT-USER-INSTALL-01: the number of interaction references held (for tests; never their content). */
  get referenceCount(): number {
    return this.references.size;
  }

  /** CHAT-TIDY-01: the plain messages waiting for the session (for tests; never their content). */
  get pendingMessageCount(): number {
    return this.pendingMessages.length;
  }

  /** CHAT-USER-INSTALL-01: the install and bot links while ready and both ids are known. */
  installLinks(): ChatInstallLinks | null {
    if (this.currentState !== 'ready' || !this.connection) {
      return null;
    }
    return discordInstallLinks(this.applicationId, this.botUserId);
  }

  async connect(
    handler: ChatCommandHandler,
    onComponent?: ChatComponentHandler,
    onMessage?: ChatMessageHandler,
    onAutocomplete?: ChatAutocompleteHandler,
  ): Promise<boolean> {
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
    this.componentHandler = onComponent ?? null;
    this.messageHandler = onMessage ?? null;
    this.autocompleteHandler = onAutocomplete ?? null;
    let connection: DiscordConnection;
    try {
      connection = await this.factory(token, DISCORD_GATEWAY_INTENTS);
    } catch (error) {
      this.currentState = 'stopped';
      this.handler = null;
      this.componentHandler = null;
      this.messageHandler = null;
      this.autocompleteHandler = null;
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
    this.componentHandler = null;
    this.messageHandler = null;
    this.autocompleteHandler = null;
    this.sessionUp = false;
    this.references.clear();
    this.clearPendingMessages();
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

  /**
   * CHAT-USER-INSTALL-01: a follow-up to the user's latest interaction while
   * it is younger than 14 minutes (after that interaction's own answer),
   * else the direct message. A follow-up that fails falls back to the direct
   * message and forgets the reference. A refused direct message throws
   * ChatDirectMessageRefusedError. CHAT-STATE-PERSIST-01: with a dedupe key
   * the direct message carries the nonce and enforce_nonce (the follow-up
   * cannot). CHAT-TIDY-01: not ready, or the connection went away while
   * sending, throws ChatTransportNotReadyError (the delivery does not count
   * it as an attempt).
   */
  async sendToUser(externalUserId: string, message: ChatReplyMessage, options?: ChatSendOptions): Promise<void> {
    const connection = this.connection;
    if (!connection || this.currentState !== 'ready') {
      throw new ChatTransportNotReadyError();
    }
    if (!SNOWFLAKE.test(externalUserId)) {
      return;
    }
    const outgoing = body(message, false);
    const reference = this.freshReference(externalUserId);
    if (reference) {
      await this.waitForAnswer(reference);
      try {
        await connection.calls.followUp(reference.applicationId, reference.interactionToken, outgoing);
        return;
      } catch (error) {
        if (this.references.get(externalUserId) === reference) {
          this.references.delete(externalUserId);
        }
        this.logger.warn(`chat discord follow-up failed reason=${errorName(error)}${errorStatus(error)}`);
      }
      if (!this.stillReady(connection)) {
        throw new ChatTransportNotReadyError();
      }
    }
    const dedupeKey = typeof options?.dedupeKey === 'string' && options.dedupeKey.length > 0 ? options.dedupeKey : null;
    const direct: DiscordMessageBody = dedupeKey
      ? { ...outgoing, nonce: discordNonceOf(dedupeKey), enforce_nonce: true }
      : outgoing;
    try {
      await connection.calls.sendDirectMessage(externalUserId, direct);
    } catch (error) {
      if (isDiscordDirectMessageRefused(error)) {
        throw new ChatDirectMessageRefusedError();
      }
      if (!this.stillReady(connection)) {
        throw new ChatTransportNotReadyError();
      }
      throw error;
    }
  }

  /** CHAT-TIDY-01: true while this connection is still the ready one. */
  private stillReady(connection: DiscordConnection): boolean {
    return this.connection === connection && this.currentState === 'ready';
  }

  /** The user's latest reference while younger than 14 minutes; an older one is forgotten. */
  private freshReference(externalUserId: string): DiscordInteractionReference | null {
    const reference = this.references.get(externalUserId);
    if (!reference) {
      return null;
    }
    if (this.now() - reference.receivedAt >= DISCORD_REFERENCE_MAX_AGE_MS) {
      this.references.delete(externalUserId);
      return null;
    }
    return reference;
  }

  /**
   * Keeps the latest reference of an accepted interaction (in the direct
   * message, from a snowflake user). Returns the function that marks the
   * interaction's own answer as done.
   */
  private remember(externalUserId: string, directMessage: boolean, ref: DiscordRef): () => void {
    if (!directMessage || !SNOWFLAKE.test(externalUserId)) {
      return () => undefined;
    }
    const now = this.now();
    for (const [key, held] of this.references) {
      if (now - held.receivedAt >= DISCORD_REFERENCE_MAX_AGE_MS) this.references.delete(key);
    }
    this.references.delete(externalUserId);
    while (this.references.size >= DISCORD_REFERENCES_MAX) {
      const oldest = this.references.keys().next().value;
      if (oldest === undefined) break;
      this.references.delete(oldest);
    }
    let settle: () => void = () => undefined;
    const answered = new Promise<void>((resolve) => {
      settle = resolve;
    });
    this.references.set(externalUserId, {
      applicationId: ref.applicationId,
      interactionToken: ref.interactionToken,
      receivedAt: now,
      answered,
    });
    return settle;
  }

  /** Waits for the interaction's own answer, at most answerWaitMs. */
  private async waitForAnswer(reference: DiscordInteractionReference): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, this.answerWaitMs);
      timer.unref?.();
    });
    await Promise.race([reference.answered, limit]);
    if (timer) clearTimeout(timer);
  }

  private listen(gateway: DiscordGateway): void {
    gateway.on(DISCORD_GATEWAY_EVENTS.ready, (data: unknown) => {
      this.onReady(data as GatewayReadyDispatchData);
    });
    gateway.on(DISCORD_GATEWAY_EVENTS.resumed, () => {
      this.sessionUp = true;
      if (this.currentState === 'connecting') this.currentState = 'ready';
      this.drainPendingMessages();
    });
    gateway.on(DISCORD_GATEWAY_EVENTS.closed, (code: unknown) => {
      this.onClosed(code);
    });
    gateway.on(DISCORD_GATEWAY_EVENTS.error, (error: unknown) => {
      this.logger.warn(`chat discord error reason=${errorName(error)}`);
    });
    gateway.on(DISCORD_GATEWAY_EVENTS.dispatch, (raw: unknown) => {
      const payload = raw as GatewayDispatchPayload | null | undefined;
      const event = payload ? (payload as { t?: unknown }).t : undefined;
      if (event === DISCORD_DISPATCH_INTERACTION_CREATE) {
        void this.onInteraction((payload as { d?: unknown }).d);
      } else if (event === DISCORD_DISPATCH_MESSAGE_CREATE) {
        void this.onMessage((payload as { d?: unknown }).d);
      }
    });
  }

  private onReady(data: GatewayReadyDispatchData): void {
    if (this.currentState === 'stopped' || !this.connection) {
      return;
    }
    const applicationId = data?.application?.id;
    this.applicationId = typeof applicationId === 'string' && SNOWFLAKE.test(applicationId) ? applicationId : null;
    // CHAT-USER-INSTALL-01: the bot's own user id, for the bot profile link on the Connections page.
    const botUserId = (data as { user?: { id?: unknown } } | undefined)?.user?.id;
    this.botUserId = typeof botUserId === 'string' && SNOWFLAKE.test(botUserId) ? botUserId : null;
    this.sessionUp = true;
    this.currentState = 'ready';
    this.logger.log('chat discord ready');
    if (!this.commandsRegistered) {
      void this.registerCommands();
    }
    this.drainPendingMessages();
  }

  /**
   * CHAT-TIDY-01: once ready, the plain messages kept while connecting are
   * handled as if they had just arrived. One counts-only log line.
   */
  private drainPendingMessages(): void {
    if (this.currentState !== 'ready') {
      return;
    }
    const queued = this.pendingMessages;
    const dropped = this.droppedMessages;
    this.pendingMessages = [];
    this.droppedMessages = 0;
    if (queued.length === 0 && dropped === 0) {
      return;
    }
    this.logger.log(`chat discord queued messages handled count=${queued.length} dropped=${dropped}`);
    for (const raw of queued) {
      void this.onMessage(raw);
    }
  }

  private clearPendingMessages(): void {
    this.pendingMessages = [];
    this.droppedMessages = 0;
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
    this.componentHandler = null;
    this.messageHandler = null;
    this.autocompleteHandler = null;
    this.references.clear();
    this.clearPendingMessages();
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
    const type = asRecord(raw)?.type;
    // CHAT-TIDY-01: a form submit is answered like a button press.
    if (type === DISCORD_INTERACTION_MESSAGE_COMPONENT || type === DISCORD_INTERACTION_MODAL_SUBMIT) {
      await this.onComponent(raw);
      return;
    }
    if (type === DISCORD_INTERACTION_AUTOCOMPLETE) {
      await this.onAutocomplete(raw);
      return;
    }
    const handler = this.handler;
    if (!handler || this.currentState !== 'ready') {
      return;
    }
    const invocation = toChatInvocation(raw, this.channel);
    if (!invocation) {
      return;
    }
    const answered = this.remember(invocation.externalUserId, invocation.directMessage, invocation.ref as DiscordRef);
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
    } finally {
      answered();
    }
  }

  /**
   * CHAT-TIDY-01: suggestions while an option is typed. Answered within the
   * defer time with what the handler gave (an empty list when it failed or
   * was late). Nothing is logged per keystroke and no reference is kept.
   */
  private async onAutocomplete(raw: unknown): Promise<void> {
    const handler = this.autocompleteHandler;
    const connection = this.connection;
    if (!handler || !connection || this.currentState !== 'ready' || !connection.calls.autocomplete) {
      return;
    }
    const parsed = toChatAutocomplete(raw, this.channel);
    if (!parsed) {
      return;
    }
    let choices: DiscordChoice[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const late = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), this.deferAfterMs);
        timer.unref?.();
      });
      const answered = handler(parsed.request).then(
        (list) => list,
        () => null,
      );
      choices = discordChoices((await Promise.race([answered, late])) ?? []);
    } catch {
      choices = [];
    } finally {
      if (timer) clearTimeout(timer);
    }
    try {
      await connection.calls.autocomplete(parsed.interactionId, parsed.interactionToken, choices);
    } catch {
      // Nothing is logged per keystroke; the user just sees no suggestions.
    }
  }

  /**
   * Slice C2: a button press, answered within Discord's 3 seconds (a deferred
   * update when the handler is slow). CHAT-TIDY-01: a form submit too.
   */
  private async onComponent(raw: unknown): Promise<void> {
    const handler = this.componentHandler;
    if (!handler || this.currentState !== 'ready') {
      return;
    }
    const press = toChatComponentPress(raw, this.channel) ?? toChatModalSubmit(raw, this.channel);
    if (!press) {
      return;
    }
    const answered = this.remember(press.externalUserId, press.directMessage, press.ref as DiscordRef);
    try {
      const pending = handler(press);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const late = new Promise<'late'>((resolve) => {
        timer = setTimeout(() => resolve('late'), this.deferAfterMs);
        timer.unref?.();
      });
      const first = await Promise.race([pending.then((response) => ({ response })), late]);
      if (timer) clearTimeout(timer);
      if (first !== 'late') {
        await this.respond(press, first.response);
        return;
      }
      const ref = press.ref as DiscordRef;
      const connection = this.connection;
      if (!connection) return;
      await connection.calls.deferUpdate(ref.interactionId, ref.interactionToken);
      ref.deferred = true;
      await this.respond(press, await pending);
    } catch (error) {
      this.logger.warn(`chat discord press failed reason=${errorName(error)}${errorStatus(error)}`);
    } finally {
      answered();
    }
  }

  /**
   * CHAT-DISCORD-DM-01: a plain direct message. No 3-second limit applies
   * (it is not an interaction), so the handler is awaited and its answer
   * goes out as a reply to the message, mentions off and without buttons.
   * A refused reply is logged once with a reason code; any failure is logged
   * by class and status only, never with the text or an id.
   */
  private async onMessage(raw: unknown): Promise<void> {
    const handler = this.messageHandler;
    if (!handler) {
      return;
    }
    if (this.currentState === 'connecting' && this.connection) {
      // CHAT-TIDY-01: a resume replays missed events before it is done; keep them until ready.
      if (this.pendingMessages.length < DISCORD_PENDING_MESSAGES_MAX) {
        this.pendingMessages.push(raw);
      } else {
        this.droppedMessages += 1;
      }
      return;
    }
    if (this.currentState !== 'ready') {
      return;
    }
    const message = toChatPlainMessage(raw, this.botUserId, this.channel);
    if (!message) {
      return;
    }
    let answer: ChatReplyMessage | null;
    try {
      answer = await handler(message);
    } catch (error) {
      this.logger.warn(`chat discord message failed reason=${errorName(error)}`);
      return;
    }
    const connection = this.connection;
    if (!answer || !connection || this.currentState !== 'ready' || !connection.calls.replyToMessage) {
      return;
    }
    const ref = message.ref as DiscordMessageRef;
    try {
      await connection.calls.replyToMessage(ref.channelId, ref.messageId, body({ text: answer.text }, false));
    } catch (error) {
      if (isDiscordDirectMessageRefused(error)) {
        this.logger.warn('chat discord message reply refused reason=dm_refused');
      } else {
        this.logger.warn(`chat discord message reply failed reason=${errorName(error)}${errorStatus(error)}`);
      }
    }
  }

  /**
   * update: edit the pressed message and remove its buttons. ephemeral: an
   * answer only the presser sees. modal (CHAT-TIDY-01): open the form; only
   * as the first answer to a button press (never after a deferral or to a
   * form submit), else nothing is shown and one line is logged.
   */
  private async respond(press: ChatComponentPress, response: ChatComponentResponse): Promise<void> {
    const connection = this.connection;
    const ref = press.ref as DiscordRef;
    if (!connection || !ref || typeof ref.interactionToken !== 'string') {
      return;
    }
    if (response.kind === 'modal') {
      const modal = discordModalBody(response.modal);
      if (!modal || ref.deferred || press.modalValues !== undefined || !connection.calls.showModal) {
        this.logger.warn('chat discord form not shown reason=not_allowed');
        return;
      }
      await connection.calls.showModal(ref.interactionId, ref.interactionToken, modal);
      return;
    }
    if (response.kind === 'update') {
      const update = body(response.message, false, 'remove');
      if (ref.deferred) {
        await connection.calls.editReply(ref.applicationId, ref.interactionToken, update);
      } else {
        await connection.calls.updateMessage(ref.interactionId, ref.interactionToken, update);
      }
      return;
    }
    const answer = body({ text: response.message.text }, true);
    if (ref.deferred) {
      await connection.calls.followUp(ref.applicationId, ref.interactionToken, answer);
    } else {
      await connection.calls.reply(ref.interactionId, ref.interactionToken, answer);
    }
  }
}
